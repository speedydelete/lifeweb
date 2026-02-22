
import {MessagePort} from 'node:worker_threads';
import {APGCODE_CHARS, lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, base, gliderPatterns, channelRecipeToString, StableObject, Spaceship, CAObject, normalizeOscillator, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
import {findOutcome} from './runner.js';
import {getCollision} from './slow_salvos.js';


function getRecipesForDepthSingleChannel(info: ChannelInfo, depth: number, maxSpacing: number): [[number, number][], number][] {
    let out: [[number, number][], number][] = [];
    let limit = Math.min(maxSpacing, depth);
    for (let spacing = info.minSpacing; spacing <= limit; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let elt: [number, number] = [spacing, 0];
        if (spacing === depth) {
            out.push([[elt], spacing]);
        } else if (depth - spacing >= info.minSpacing) {
            for (let recipe of getRecipesForDepthSingleChannel(info, depth - spacing, maxSpacing)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthMultiChannel(info: ChannelInfo, depth: number, maxSpacing: number, prev: number | undefined, lastUses: number[]): [[number, number][], number][] {
    let out: [[number, number][], number][] = [];
    for (let channel = 0; channel < info.channels.length; channel++) {
        let start: number;
        if (prev === undefined) {
            start = info.minSpacing;
        } else {
            start = info.minSpacings[prev][channel];
        }
        start = Math.max(start, info.minSpacings[channel][channel] - lastUses[channel]);
        for (let spacing = start; spacing <= maxSpacing; spacing++) {
            if (prev && info.excludeSpacings && info.excludeSpacings[prev][channel].includes(spacing)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            out.push([[elt], spacing]);
            if (depth > 0) {
                let newLastUses = lastUses.map(x => x + spacing);
                newLastUses[channel] = 0;
                for (let recipe of getRecipesForDepthMultiChannel(info, depth - 1, maxSpacing, channel, newLastUses)) {
                    if (recipe[1] + spacing === depth) {
                        recipe[0].unshift(elt);
                        recipe[1] += spacing;
                        out.push(recipe);
                    }
                }
            }
        }
    }
    return out;
}

function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing: number, prev?: number): [[number, number][], number][] {
    if (info.channels.length === 1) {
        return getRecipesForDepthSingleChannel(info, depth, maxSpacing);
    } else if (prev) {
        return getRecipesForDepthMultiChannel(info, depth, maxSpacing, prev, (new Array(info.channels.length)).fill(Infinity));
    } else {
        let out: [[number, number][], number][] = [];
        let lastUses = (new Array(info.channels.length)).fill(Infinity);
        for (let channel = 0; channel < info.channels.length; channel++) {
            let newLastUses = lastUses.slice();
            newLastUses[channel] = 0;
            for (let recipe of getRecipesForDepthMultiChannel(info, depth, maxSpacing, channel, newLastUses)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}


export function runInjection(info: ChannelInfo, elbow: [string, number], recipe: [number, number][]): MAPPattern {
    let phaseOffset = 0;
    for (let [spacing] of recipe) {
        phaseOffset += spacing;
    }
    phaseOffset = (c.GLIDER_PERIOD - (phaseOffset % c.GLIDER_PERIOD)) % c.GLIDER_PERIOD;
    let gliders: MAPPattern[] = [];
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
            continue;
        }
        let y = Math.floor(total / c.GLIDER_PERIOD);
        if ((total % c.GLIDER_PERIOD) + phaseOffset >= c.GLIDER_PERIOD) {
            y++;
        }
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.channels[channel];
        let p = gliderPatterns[(total + phaseOffset) % c.GLIDER_PERIOD].copy();
        p.xOffset += x;
        p.yOffset += y;
        gliders.push(p);
        total += timing;
    }
    let y = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let x = Math.floor(y * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    gliders.forEach(g => {
        g.xOffset -= x;
        g.yOffset -= y;
    });
    let p = base.loadApgcode(elbow[0]).shrinkToFit();
    let yPos = c.GLIDER_TARGET_SPACING;
    if ((total % c.GLIDER_PERIOD) + phaseOffset >= c.GLIDER_PERIOD) {
        yPos--;
    }
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    p.offsetBy(xPos, yPos);
    p.insert(gliderPatterns[(total + phaseOffset) % c.GLIDER_PERIOD], 0, 0);
    total += c.GLIDER_TARGET_SPACING;
    let i = 0;
    while (gliders.length > 0) {
        for (let g of gliders) {
            g.runGeneration();
            g.shrinkToFit();
        }
        p.runGeneration();
        p.shrinkToFit();
        while (gliders.length > 0) {
            let last = gliders[gliders.length - 1];
            let xDiff = p.xOffset - last.xOffset;
            let yDiff = p.yOffset - last.yOffset;
            // console.log(`\x1b[92mxDiff = ${xDiff}, yDiff = ${yDiff}\x1b[0m`);
            if (xDiff < 2 || yDiff < 2 || (xDiff < last.width + c.INJECTION_SPACING) && (yDiff < last.height + c.INJECTION_SPACING)) {
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
                // console.log(`\x1b[94minjecting (${gliders.length} gliders remaining)\x1b[0m\n${p.toRLE()}`);
            } else {
                break;
            }
        }
        i++;
        if (i > total + maxGenerations) {
            // console.log(`\x1b[91mforced\x1b[0m\n${p.toRLE()}`);
            while (gliders.length > 0) {
                let last = gliders[gliders.length - 1];
                let xDiff = p.xOffset - last.xOffset;
                let yDiff = p.yOffset - last.yOffset;
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
            }
            break;
        }
    }
    return p;
}


export interface ShipInfo {
    dir: 'up' | 'down' | 'left' | 'right';
    lane: number;
    timing: number;
}

export function getShipInfo(info: ChannelInfo, obj: Spaceship): ShipInfo {
    let dir: 'up' | 'down' | 'left' | 'right';
    let lane: number;
    if (obj.dir === 'N' || obj.dir === 'NE') {
        dir = 'up';
        lane = obj.x - (obj.y * c.GLIDER_SLOPE);
    } else if (obj.dir === 'W' || obj.dir === 'SW') {
        dir = 'left';
        lane = (obj.x * c.GLIDER_SLOPE) + obj.y;
    } else if (obj.dir === 'S' || obj.dir === 'SE') {
        dir = 'down';
        lane = obj.x - (obj.y * c.GLIDER_SLOPE);
    } else {
        dir = 'right';
        lane = (obj.x * c.GLIDER_SLOPE) + obj.y;
    }
    return {dir, lane, timing: obj.timing % info.period};
}


// import {objectsToString} from './base.js';

interface ExpectedResult {
    stables: StableObject[];
    ships: ShipInfo[];
    others: string[];
    period: number;
}

function isNextWorkingInput(info: ChannelInfo, elbow: [string, number], recipe: ChannelRecipe, next: number, expected: ExpectedResult): boolean {
    let test = recipe.recipe.slice();
    test.push([next, 0]);
    let p = runInjection(info, elbow, test);
    if (expected.period > 1) {
        let prevPop = p.population;
        for (let i = 0; i < 256; i++) {
            p.run(expected.period);
            let pop = p.population;
            if (pop !== prevPop) {
                break;
            }
            prevPop = pop;
        }
    }
    let objs = findOutcome(p);
    if (typeof objs !== 'object') {
        return false;
    }
    let expectedShips = expected.ships;
    if (!recipe.end) {
        expectedShips = expectedShips.slice();
        expectedShips.push({dir: 'down', lane: elbow[1], timing: 0});
    }
    let stables: StableObject[] = [];
    let ships: ShipInfo[] = [];
    let others: string[] = [];
    for (let obj of objs) {
        if (obj.type === 'sl') {
            stables.push(obj);
        } else if (obj.type === 'osc') {
            stables.push(normalizeOscillator(obj));
        } else if (obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
            ships.push(getShipInfo(info, obj));
        } else {
            others.push(obj.code);
        }
    }
    // console.log(`\x1b[94mgot:\n    stables: ${objectsToString(stables)}\n    ships: ${ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n    others: ${others.join(', ')}\x1b[0m`);
    if (stables.length !== expected.stables.length || ships.length !== expected.ships.length || others.length !== expected.others.length) {
        return false;
    }
    for (let a of expected.stables) {
        if (!stables.some(b => a.code === b.code && a.x === b.x && a.y === b.y)) {
            return false;
        }
    }
    for (let a of expected.ships) {
        if (!ships.some(b => a.dir === b.dir && a.lane === b.lane && a.timing === b.timing)) {
            return false;
        }
    }
    for (let a of expected.others) {
        if (!others.some(b => a === b)) {
            return false;
        }
    }
    return true;
}

export function findNextWorkingInput(info: ChannelInfo, elbow: [string, number], recipe: ChannelRecipe, result: CAObject[] | undefined): false | number {
    let expected: ExpectedResult = {stables: [], ships: [], others: [], period: 1};
    if (recipe.end) {
        if (!result) {
            throw new Error('No result! (there is a bug)');
        }
        for (let obj of result) {
            if (obj.type === 'sl') {
                expected.stables.push(obj);
            } else if (obj.type === 'osc') {
                if (expected.period !== 0) {
                    expected.period = lcm(expected.period, parseInt(obj.code.slice(2)));
                }
                expected.stables.push(normalizeOscillator(obj));
            } else if (obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
                if (expected.period !== 0) {
                    expected.period = lcm(expected.period, c.GLIDER_POPULATION_PERIOD);
                }
                expected.ships.push(getShipInfo(info, obj));
            } else {
                expected.period = 0;
                expected.others.push(obj.code);
            }
        }
    }
    if (recipe.create) {
        if (recipe.create.type === 'sl') {
            expected.stables.push(recipe.create);
        } else {
            if (expected.period !== 0) {
                expected.period = lcm(expected.period, parseInt(recipe.create.code.slice(2)));
            }
            expected.stables.push(normalizeOscillator(recipe.create));
        }
    }
    if (recipe.emit) {
        if (expected.period !== 0) {
            expected.period = lcm(expected.period, c.GLIDER_POPULATION_PERIOD);
        }
        expected.ships.push(recipe.emit);
    }
    // console.log(`\x1b[92mexpected:\n    stables: ${objectsToString(expected[0])}\n    ships: ${expected[1].map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n    others: ${expected[2].join(', ')}\x1b[0m`);
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(info, elbow, recipe, mid, expected) && isNextWorkingInput(info, elbow, recipe, mid + expected.period, expected) && isNextWorkingInput(info, elbow, recipe, mid + expected.period * 2, expected)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}\x1b[0m`);
    }
    if (low === info.maxNextSpacing) {
        console.log(`\x1b[93mUnable to find next possible glider spacing: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
        // throw new Error('hi');
        return false;
    }
    return low;
}


const APGCODE_POP_MAP: {[key: string]: number} = {};
for (let i = 0; i < 32; i++) {
    APGCODE_POP_MAP[APGCODE_CHARS[i]] = Array.from(i.toString(2)).filter(x => x === '1').length;
}

function isTooBig(code: string): boolean {
    if (code.startsWith('xs')) {
        return parseInt(code.slice(2)) > 12;
    } else {
        let pop = 0;
        for (let i = code.indexOf('_') + 1; i < code.length; i++) {
            let char = code[i];
            if (char >= 'w') {
                continue;
            }
            pop += APGCODE_POP_MAP[char];
        }
        return pop > 12;
    }
}


export function checkChannelRecipe(info: ChannelInfo, elbows: ElbowData, recipe: [number, number][], time: number, elbowStr: string, elbowData: [string, number], badElbows: Set<string>, newElbows?: string[]): undefined | {recipe?: ChannelRecipe, possibleUseful?: string} {
    let possibleUseful: string | undefined = undefined;
    let result: false | 'linear' | CAObject[];
    let strRecipe = channelRecipeToString(info, recipe);
    result = findOutcome(runInjection(info, elbowData, recipe));
    if (result === false) {
        return;
    }
    if (result === 'linear') {
        return {possibleUseful: `Linear growth: ${strRecipe}\n`};
    }
    let so1: {obj: StableObject, lane: number, spacing: number} | undefined = undefined;
    let so2: {obj: StableObject, lane: number, spacing: number} | undefined = undefined;
    let emit: ChannelRecipe['emit'] | undefined = undefined;
    let found = false;
    for (let obj of result) {
        if (obj.type === 'sl' || obj.type === 'osc') {
            if (so1 && so2) {
                found = true;
                break;
            }
            let lane = Math.floor(obj.y * c.GLIDER_SLOPE) - obj.x + elbowData[1];
            let spacing = Math.floor(obj.x * c.GLIDER_SLOPE) + obj.y;
            let value = {obj, lane, spacing};
            if (so1 === undefined) {
                so1 = value;
            } else {
                so2 = value;
            }
        } else if (!emit && obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
            emit = getShipInfo(info, obj);
        } else {
            found = true;
            if (info.possiblyUsefulFilter.includes(obj.code)) {
                break;
            }
            if (obj.type === 'ship' && obj.code !== c.GLIDER_APGCODE) {
                possibleUseful = `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
            } else if (obj.type === 'other' && obj.code.startsWith('xq')) {
                let type = findType(base.loadApgcode(obj.realCode), parseInt(obj.code.slice(2)));
                if (type.disp) {
                    let lane: number;
                    if (type.disp[0] === 0) {
                        lane = obj.y;
                    } else if (type.disp[1] === 0) {
                        lane = obj.x;
                    } else if (Math.sign(type.disp[0]) === Math.sign(type.disp[1])) {
                        lane = obj.x - obj.y;
                    } else {
                        lane = obj.x + obj.y;
                    }
                    possibleUseful = `Creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${strRecipe}\n`;
                } else {
                    possibleUseful = `Creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${strRecipe}\n`;
                }
            }
            break;
        }
    }
    if (found) {
        return {possibleUseful};
    }
    let create: StableObject | undefined = undefined;
    let endElbowData: [{obj: StableObject, lane: number, spacing: number}, CAObject[]] | undefined = undefined;
    if (so1) {
        if (isTooBig(so1.obj.code)) {
            return;
        }
        if (so2) {
            if (isTooBig(so2.obj.code)) {
                return;
            }
            let so1Result = getCollision(so1.obj.code, so1.lane);
            let so2Result = getCollision(so2.obj.code, so2.lane);
            if (typeof so1Result === 'object') {
                if (typeof so2Result === 'object') {
                    return;
                } else {
                    endElbowData = [so1, so1Result];
                    create = so2.obj;
                }
            } else {
                if (typeof so2Result === 'object') {
                    endElbowData = [so2, so2Result];
                    create = so1.obj;
                } else {
                    return;
                }
            }
        } else {
            let result = getCollision(so1.obj.code, so1.lane);
            if (typeof result === 'object') {
                endElbowData = [so1, result];
            } else {
                create = so1.obj;
            }
        }
    }
    if (create && emit) {
        return;
    }
    let end: ChannelRecipe['end'] | undefined = undefined;
    let endResult: CAObject[] | undefined = undefined;
    let addGliders = 0;
    if (endElbowData) {
        let [elbow, result] = endElbowData;
        endResult = result;
        let str = `${elbow.obj.code}/${elbow.lane}`;
        if (badElbows.has(str)) {
            return;
        }
        let move = elbow.spacing;
        if (str in elbows) {
            let data = elbows[str];
            let flipped = false;
            while (data.type === 'convert' || data.type === 'alias') {
                if (data.type === 'convert') {
                    addGliders++;
                }
                flipped = flipped !== data.flipped;
                str = data.elbow;
            }
            if (data.type === 'normal') {
                end = {elbow: str, move, flipped};
            } else {
                addGliders++;
            }
        } else {
            end = {elbow: str, move, flipped: false};
            if (newElbows && !newElbows.includes(str)) {
                newElbows.push(str);
            }
        }
    }
    let value: ChannelRecipe = {start: elbowStr, recipe, time, end, create, emit};
    let outputValue = false;
    let next = findNextWorkingInput(info, elbowData, value, endResult);
    if (next !== false) {
        let found = false;
        for (let i = 0; i < addGliders; i++) {
            value.recipe.push([next, 0]);
            value.time += next;
            let result = findNextWorkingInput(info, elbowData, value, endResult);
            if (result !== false) {
                next = result;
            } else {
                possibleUseful = `probably broken ${channelRecipeInfoToString(value)}: ${strRecipe}\n`;
                found = true;
                break;
            }
        }
        if (!found) {
            value.recipe.push([next, -1]);
            value.time += next;
            outputValue = true;
            possibleUseful = `${channelRecipeInfoToString(value)}: ${channelRecipeToString(info, value.recipe)}\n`;
        }
    } else {
        for (let i = 0; i < addGliders; i++) {
            value.recipe.push([info.maxNextSpacing, 0]);
            value.time += info.maxNextSpacing;
        }
        possibleUseful = `probably broken ${channelRecipeInfoToString(value)}: ${strRecipe}\n`;
    }
    if (outputValue) {
        if (possibleUseful) {
            return {recipe: value, possibleUseful};
        } else {
            return {recipe: value};
        }
    } else if (possibleUseful) {
        return {possibleUseful};
    }
}

export function findChannelResults(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, elbow: string, depth: number, maxSpacing: number, starts?: [number, number][][], parentPort?: MessagePort | null): {recipes: ChannelRecipe[], newElbows: string[], possibleUseful: string, recipeCount: number} {
    let elbowParts = elbow.split('/');
    let elbowLane = parseInt(elbowParts[1]);
    let elbowData: [string, number] = [elbowParts[0].slice(elbowParts[0].indexOf('_') + 1), elbowLane];
    let newRecipes: ChannelRecipe[] = [];
    let newElbows: string[] = [];
    let possibleUseful = '';
    let recipes: [[number, number][], number][] = [];
    if (starts) {
        for (let start of starts) {
            let startTime = start.map(x => x[0]).reduce((x, y) => x + y);
            if (startTime > depth) {
                continue;
            }
            if (startTime === depth) {
                recipes.push([start.slice(), startTime]);
            }
            if (start.length < 3) {
                continue;
            }
            let last = start[start.length - 1];
            for (let [recipe, time] of getRecipesForDepth(info, depth - startTime, maxSpacing, last[1])) {
                recipe.unshift(...start);
                time += startTime;
                recipes.push([recipe, time]);
            }
        }
    }
    if (parentPort) {
        parentPort.postMessage(['starting', recipes.length]);
    }
    let count = 0;
    let lastUpdate = performance.now();
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 5000) {
            lastUpdate = now;
            if (parentPort) {
                parentPort.postMessage(['update', {count, recipes: newRecipes, newElbows: newElbows}]);
                newRecipes = [];
                newElbows = [];
            }
            count = 0;
        }
        count++;
        let [recipe, time] = recipes[i];
        let value = checkChannelRecipe(info, elbows, recipe, time, elbow, elbowData, badElbows, newElbows);
        if (value) {
            if (value.recipe) {
                newRecipes.push(value.recipe);
            }
            if (value.possibleUseful) {
                possibleUseful += value.possibleUseful;
            }
        }
    }
    return {recipes: newRecipes, newElbows, possibleUseful, recipeCount: recipes.length};
}
