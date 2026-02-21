
import {MessagePort, parentPort, workerData} from 'node:worker_threads';
import {APGCODE_CHARS, lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, setMaxGenerations, base, gliderPatterns, channelRecipeToString, StableObject, Spaceship, CAObject, normalizeOscillator, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
import {findOutcome} from './runner.js';
import {getCollision} from './slow_salvos.js';


let info: ChannelInfo = workerData.info;

setMaxGenerations(workerData.maxGenerations);

let starts: [number, number][][] = workerData.starts;


function getRecipesForDepthSingleChannel(depth: number, maxSpacing: number): [[number, number][], number][] {
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
            for (let recipe of getRecipesForDepthSingleChannel(depth - spacing, maxSpacing)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthMultiChannel(depth: number, maxSpacing: number, prev: number | undefined, lastUses: number[]): [[number, number][], number][] {
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
                for (let recipe of getRecipesForDepthMultiChannel(depth - 1, maxSpacing, channel, newLastUses)) {
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

function getRecipesForDepth(depth: number, maxSpacing: number, prev?: number): [[number, number][], number][] {
    if (info.channels.length === 1) {
        return getRecipesForDepthSingleChannel(depth, maxSpacing);
    } else if (prev) {
        return getRecipesForDepthMultiChannel(depth, maxSpacing, prev, (new Array(info.channels.length)).fill(Infinity));
    } else {
        let out: [[number, number][], number][] = [];
        let lastUses = (new Array(info.channels.length)).fill(Infinity);
        for (let channel = 0; channel < info.channels.length; channel++) {
            let newLastUses = lastUses.slice();
            newLastUses[channel] = 0;
            for (let recipe of getRecipesForDepthMultiChannel(depth, maxSpacing, channel, newLastUses)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}


function runInjection(elbow: [string, number], recipe: [number, number][]): MAPPattern {
    let phaseOffset = 0;
    for (let [spacing] of recipe) {
        phaseOffset += spacing;
    }
    phaseOffset = 4 - (phaseOffset % 4);
    let gliders: MAPPattern[] = [];
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
            continue;
        }
        let y = Math.floor(total / c.GLIDER_PERIOD);
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
    let yPos = c.GLIDER_TARGET_SPACING - 1;
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

export function getShipInfo(obj: Spaceship): ShipInfo {
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


function isNextWorkingInput(elbow: [string, number], recipe: ChannelRecipe, next: number, expected: [StableObject[], ShipInfo[], string[], number | null]): boolean {
    let test = recipe.recipe.slice();
    test.push([next, 0]);
    let p = runInjection(elbow, test);
    if (expected[3] !== null) {
        let prevPop = p.population;
        for (let i = 0; i < 256; i++) {
            p.run(expected[3]);
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
    let expectedShips = expected[1];
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
            ships.push(getShipInfo(obj));
        } else {
            others.push(obj.code);
        }
    }
    // console.log(`\x1b[94mgot:\n    stables: ${objectsToString(stables)}\n    ships: ${ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n    others: ${others.join(', ')}\x1b[0m`);
    if (stables.length !== expected[0].length || ships.length !== expected[1].length || others.length !== expected[2].length) {
        return false;
    }
    for (let a of expected[0]) {
        if (!stables.some(b => a.code === b.code && a.x === b.x && a.y === b.y)) {
            return false;
        }
    }
    for (let a of expected[1]) {
        if (!ships.some(b => a.dir === b.dir && a.lane === b.lane && a.timing === b.timing)) {
            return false;
        }
    }
    for (let a of expected[2]) {
        if (!others.some(b => a === b)) {
            return false;
        }
    }
    return true;
}

function findNextWorkingInput(elbow: [string, number], recipe: ChannelRecipe, result: CAObject[] | undefined): false | number {
    let expected: [StableObject[], ShipInfo[], string[], number | null] = [[], [], [], 1];
    if (recipe.end) {
        if (!result) {
            throw new Error('No result! (there is a bug)');
        }
        for (let obj of result) {
            if (obj.type === 'sl') {
                expected[0].push(obj);
            } else if (obj.type === 'osc') {
                if (expected[3] !== null) {
                    expected[3] = lcm(expected[3], parseInt(obj.code.slice(2)));
                }
                expected[0].push(normalizeOscillator(obj));
            } else if (obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
                if (expected[3] !== null) {
                    expected[3] = lcm(expected[3], c.GLIDER_POPULATION_PERIOD);
                }
                expected[1].push(getShipInfo(obj));
            } else {
                expected[3] = null;
                expected[2].push(obj.code);
            }
        }
    }
    if (recipe.create) {
        if (recipe.create.type === 'sl') {
            expected[0].push(recipe.create);
        } else {
            expected[0].push(normalizeOscillator(recipe.create));
        }
    }
    if (recipe.emit) {
        expected[1].push(recipe.emit);
    }
    // console.log(`\x1b[92mexpected:\n    stables: ${objectsToString(expected[0])}\n    ships: ${expected[1].map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n    others: ${expected[2].join(', ')}\x1b[0m`);
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(elbow, recipe, mid, expected) && isNextWorkingInput(elbow, recipe, mid + 1, expected) && isNextWorkingInput(elbow, recipe, mid + 2, expected)) {
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
    let char = APGCODE_CHARS[i];
    APGCODE_POP_MAP[char] = Array.from(i.toString(2)).filter(x => x === '1').length;
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

function findChannelResults(elbows: ElbowData, elbow: string, depth: number, maxSpacing: number, parentPort: MessagePort): void {
    let elbowParts = elbow.split('/');
    let elbowLane = parseInt(elbowParts[1]);
    let elbowData: [string, number] = [elbowParts[0].slice(elbowParts[0].indexOf('_') + 1), elbowLane];
    let newRecipes: ChannelRecipe[] = [];
    let newElbows: string[] = [];
    let possibleUseful = '';
    let recipes: [[number, number][], number][] = [];
    for (let start of starts) {
        let startTime = start.map(x => x[0]).reduce((x, y) => x + y);
        if (info.forceStart) {
            start.unshift(...info.forceStart);
            startTime += info.forceStart.map(x => x[0]).reduce((x, y) => x + y);
        }
        if (startTime > depth) {
            continue;
        }
        if (startTime === depth) {
            recipes.push([start, startTime]);
        }
        if (start.length < 3) {
            continue;
        }
        let last = start[start.length - 1];
        for (let [recipe, time] of getRecipesForDepth(depth - startTime, maxSpacing, last[1])) {
            recipe.unshift(...start);
            time += startTime;
            recipes.push([recipe, time]);
        }
    }
    parentPort.postMessage(['starting', recipes.length]);
    let count = 0;
    let lastUpdate = performance.now();
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 5000) {
            lastUpdate = now;
            parentPort.postMessage(['update', {count, recipes: newRecipes}]);
            count = 0;
        }
        count++;
        let [recipe, time] = recipes[i];
        let result: false | 'linear' | CAObject[];
        let strRecipe = channelRecipeToString(info, recipe);
        result = findOutcome(runInjection(elbowData, recipe));
        if (result === false) {
            continue;
        }
        if (result === 'linear') {
            possibleUseful += `Linear growth: ${strRecipe}\n`;
            continue;
        }
        let sl1: {obj: StableObject, lane: number, spacing: number} | undefined = undefined;
        let sl2: {obj: StableObject, lane: number, spacing: number} | undefined = undefined;
        let emit: ChannelRecipe['emit'] | undefined = undefined;
        let found = false;
        for (let obj of result) {
            if (obj.type === 'sl' || obj.type === 'osc') {
                if (sl1 && sl2) {
                    found = true;
                    break;
                }
                let lane = Math.floor(obj.y * c.GLIDER_SLOPE) - obj.x + elbowLane;
                let spacing = Math.floor(obj.x * c.GLIDER_SLOPE) + obj.y;
                let value = {obj, lane, spacing};
                if (sl1 === undefined) {
                    sl1 = value;
                } else {
                    sl2 = value;
                }
            } else if (!emit && obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
                emit = getShipInfo(obj);
            } else {
                found = true;
                if (info.possiblyUsefulFilter.includes(obj.code)) {
                    break;
                }
                if (obj.type === 'ship' && obj.code !== c.GLIDER_APGCODE) {
                    possibleUseful += `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
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
                        possibleUseful += `Creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${strRecipe}\n`;
                    } else {
                        possibleUseful += `Creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${strRecipe}\n`;
                    }
                }
                break;
            }
        }
        if (found) {
            continue;
        }
        let create: StableObject | undefined = undefined;
        let endElbowData: [{obj: StableObject, lane: number, spacing: number}, CAObject[]] | undefined = undefined;
        if (sl1) {
            if (isTooBig(sl1.obj.code)) {
                continue;
            }
            if (sl2) {
                if (isTooBig(sl2.obj.code)) {
                    continue;
                }
                let sl1Result = getCollision(sl1.obj.code, sl1.lane);
                let sl2Result = getCollision(sl2.obj.code, sl2.lane);
                if (typeof sl1Result === 'object') {
                    if (typeof sl2Result === 'object') {
                        continue;
                    } else {
                        endElbowData = [sl1, sl1Result];
                        create = sl2.obj;
                    }
                } else {
                    if (typeof sl2Result === 'object') {
                        endElbowData = [sl2, sl2Result];
                        create = sl1.obj;
                    } else {
                        continue;
                    }
                }
            } else {
                let result = getCollision(sl1.obj.code, sl1.lane);
                if (typeof result === 'object') {
                    endElbowData = [sl1, result];
                } else {
                    create = sl1.obj;
                }
            }
        }
        if (create && emit) {
            continue;
        }
        let end: [string, number] | undefined = undefined;
        let endResult: CAObject[] | undefined = undefined;
        if (endElbowData) {
            let [elbow, result] = endElbowData;
            endResult = result;
            let str = `${elbow.obj.code}/${elbow.lane}`;
            end = [str, elbow.spacing];
            if (!(str in elbows) && !newElbows.includes(str)) {
                newElbows.push(str);
            }
        }
        let value: ChannelRecipe = {start: elbow, recipe, time, end, create, emit};
        let next = findNextWorkingInput(elbowData, value, endResult);
        if (next !== false) {
            value.recipe.push([next, -1]);
            value.time += next;
            newRecipes.push(value);
            possibleUseful += `${channelRecipeInfoToString(value)}: ${channelRecipeToString(info, value.recipe)}\n`;
        } else {
            possibleUseful += `probably broken ${channelRecipeInfoToString(value)}: ${strRecipe}\n`;
        }
    }
    parentPort.postMessage(['completed', {recipes: newRecipes, newElbows, possibleUseful, recipeCount: recipes.length}]);
}


if (!parentPort) {
    throw new Error('No parent port!');
}

parentPort.on('message', data => {
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let out = findChannelResults(data.elbows, data.elbow, data.depth, data.maxSpacing, parentPort);
    parentPort.postMessage(['completed', out]);
});
