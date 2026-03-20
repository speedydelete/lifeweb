
import {MessagePort} from 'node:worker_threads';
import {lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, setMaxGenerations, base, gliderPatterns, channelRecipeToString, StableObject, Spaceship, CAObject, normalizeOscillator, objectsToString, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
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
    let timingOffset = 0;
    while (recipe[0][1] === -2) {
        timingOffset += recipe[0][0];
        recipe.shift();
    }
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
            if (channel === -2) {
                total += timing;
            }
            continue;
        }
        let y = Math.floor(total * c.GLIDER_DY / c.GLIDER_PERIOD);
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
    let y = Math.floor(total * c.GLIDER_DY / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let x = Math.floor(y * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    gliders.forEach(g => {
        g.xOffset -= x;
        g.yOffset -= y;
    });
    let p = base.loadApgcode(elbow[0]).shrinkToFit();
    if (timingOffset > 0) {
        p.run(timingOffset).shrinkToFit();
    }
    let yPos = c.GLIDER_TARGET_SPACING;
    if ((total % c.GLIDER_PERIOD) + phaseOffset >= c.GLIDER_PERIOD) {
        yPos--;
    }
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    p.offsetBy(xPos, yPos);
    let toInsert = gliderPatterns[(total + phaseOffset) % c.GLIDER_PERIOD];
    p.ensure(toInsert.width, toInsert.height);
    p.insert(toInsert, 0, 0);
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
            if (xDiff < 2 || yDiff < 2 || (xDiff < last.width + c.INJECTION_SPACING) && (yDiff < last.height + c.INJECTION_SPACING)) {
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
            } else {
                break;
            }
        }
        i++;
        if (i > total + maxGenerations) {
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
    let period = c.GLIDER_POPULATION_PERIOD;
    if (elbow[0].startsWith('xp')) {
        period = lcm(period, parseInt(elbow[0].slice(2)));
    }
    let prevPop = p.population;
    for (let i = 0; i < 256; i++) {
        p.run(period);
        let pop = p.population;
        if (pop !== prevPop) {
            return p;
        }
        prevPop = pop;
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
    return {dir, lane: lane + c.LANE_OFFSET, timing: obj.timing % info.period};
}


interface ExpectedResult {
    stables: StableObject[];
    ships: ShipInfo[];
    others: string[];
    period: number;
}

function isNextWorkingInput(info: ChannelInfo, elbow: [string, number], recipe: ChannelRecipe, next: number, expecteds: ExpectedResult[]): boolean {
    let test = recipe.recipe.slice();
    test.push([next, 0]);
    let p = runInjection(info, elbow, test);
    let expected = expecteds[next % expecteds.length];
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
        if (!ships.some(b => a.dir === b.dir && a.lane === b.lane)) {
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

export function findNextWorkingInput(info: ChannelInfo, elbow: [string, number], recipe: ChannelRecipe, results: {data: CAObject[][], x: number, y: number} | undefined): false | number {
    let expecteds: ExpectedResult[] = [];
    if (recipe.end) {
        if (!results) {
            throw new Error('No results! (there is a bug)');
        }
        for (let result of results.data) {
            let expected: ExpectedResult = {stables: [], ships: [], others: [], period: 1};
            for (let obj of result) {
                obj = structuredClone(obj);
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj);
                }
                obj.x += results.x;
                obj.y += results.y;
                if (obj.type === 'sl') {
                    expected.stables.push(obj);
                } else if (obj.type === 'osc') {
                    if (expected.period !== 0) {
                        expected.period = lcm(expected.period, obj.period);
                    }
                    expected.stables.push(obj);
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
            if (recipe.create) {
                if (recipe.create.type === 'sl') {
                    expected.stables.push(recipe.create);
                } else {
                    if (expected.period !== 0) {
                        expected.period = lcm(expected.period, recipe.create.period);
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
            expecteds.push(expected);
        }
    } else {
        let expected: ExpectedResult = {stables: [], ships: [{dir: 'down', lane: elbow[1], timing: 0}], others: [], period: 1};
        if (recipe.create) {
            if (recipe.create.type === 'sl') {
                expected.stables.push(recipe.create);
            } else {
                if (expected.period !== 0) {
                    expected.period = lcm(expected.period, recipe.create.period);
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
        expecteds.push(expected);
    }
    // let msg = '\x1b[92mexpecteds:';
    // for (let i = 0; i < expecteds.length; i++) {
    //     let expected = expecteds[i];
    //     msg += `\n    ${i}:\n        stables: ${objectsToString(expected.stables)}\n        ships: ${expected.ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n        others: ${expected.others.join(', ')}`;
    // }
    // console.log(msg + '\x1b[0m');
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    let i = 0;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(info, elbow, recipe, mid, expecteds) && isNextWorkingInput(info, elbow, recipe, mid + 1, expecteds) && isNextWorkingInput(info, elbow, recipe, mid + 2, expecteds)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}\x1b[0m`);
        i++;
    }
    if (low >= info.maxNextSpacing) {
        if (!recipe.create) {
            console.log(`\x1b[91mUnable to find next possible glider spacing: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
        }
        return false;
    }
    return low;
}


function getStringRecipe(info: ChannelInfo, recipe: ChannelRecipe): string {
    return `${channelRecipeInfoToString(recipe)}: ${channelRecipeToString(info, recipe.recipe)}\n`;
}

export function resolveElbow(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, recipe: ChannelRecipe): {recipes: ChannelRecipe[], possibleUseful: string} {
    if (!recipe.end) {
        return {recipes: [recipe], possibleUseful: getStringRecipe(info, recipe)};
    }
    if (badElbows.has(recipe.end.elbow)) {
        return {recipes: [], possibleUseful: ''};
    }
    if (!(recipe.end.elbow in elbows)) {
        return {recipes: [recipe], possibleUseful: ''};
    }
    let outcomes = elbows[recipe.end.elbow];
    let out: ChannelRecipe[] = [];
    let possibleUseful = '';
    // console.log(`(\nresolving ${channelRecipeInfoToString(recipe)}`);
    // console.log('outcomes:', outcomes);
    for (let i = 0; i < outcomes.length; i++) {
        let elbow = outcomes[i];
        if (elbow.type === 'bad') {
            continue;
        }
        if (elbow.type === 'normal') {
            out.push(recipe);
            possibleUseful += getStringRecipe(info, recipe);
            continue;
        }
        let recipe2 = structuredClone(recipe) as ChannelRecipe & {end: {elbow: string, move: number, flipped: boolean, timing: number}};
        if (elbow.type !== 'alias') {
            let value = recipe2.recipe[recipe2.recipe.length - 1];
            let inc = (i + recipe.end.timing) % outcomes.length;
            value[0] += inc;
            value[1] = 0;
            recipe2.recipe.push([info.minSpacing, -1]);
            recipe2.time += inc + info.minSpacing;
        }
        if (elbow.type === 'destroy') {
            (recipe2 as ChannelRecipe).end = undefined;
            out.push(recipe2);
            possibleUseful += getStringRecipe(info, recipe);
        } else {
            recipe2.end.elbow = elbow.elbow;
            recipe2.end.flipped = recipe2.end.flipped !== elbow.flipped;
            recipe2.end.timing += elbow.timing;
            recipe2.end.move += elbow.move;
            let value = resolveElbow(info, elbows, badElbows, recipe2);
            out.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        }
    }
    // console.log(`resolution result for ${channelRecipeInfoToString(recipe)}:`, out);
    // console.log(')');
    return {recipes: out, possibleUseful};
}

interface CheckerObjectData {
    obj: StableObject;
    period: number;
    lane: number;
    spacing: number;
}

export function getRecipeOutcome(info: ChannelInfo, elbows: ElbowData, recipe: [number, number][], time: number, elbowStr: string, elbowData: [string, number], badElbows: Set<string>, newElbows?: string[]): undefined | string | {recipe: ChannelRecipe, possibleUseful?: string, endResult?: Parameters<typeof findNextWorkingInput>[3]} {
    let possibleUseful: string | undefined = undefined;
    let result: false | 'no stabilize' | 'linear' | CAObject[];
    let strRecipe = channelRecipeToString(info, recipe);
    result = findOutcome(runInjection(info, elbowData, recipe), undefined);
    if (result === false || result === 'no stabilize') {
        return;
    }
    if (result === 'linear') {
        return `Linear growth: ${strRecipe}\n`;
    }
    let so1: CheckerObjectData | undefined = undefined;
    let so2: CheckerObjectData | undefined = undefined;
    let emit: ChannelRecipe['emit'] | undefined = undefined;
    let found = false;
    for (let obj of result) {
        if (obj.type === 'sl' || obj.type === 'osc') {
            if (so1 && so2) {
                found = true;
                break;
            }
            if (obj.type === 'osc') {
                obj = normalizeOscillator(obj);
            }
            let period = obj.type === 'osc' ? obj.period : 1;
            let lane = Math.floor(obj.y * c.GLIDER_SLOPE) - obj.x + elbowData[1];
            let spacing = Math.floor(obj.x * c.GLIDER_SLOPE) + obj.y;
            let value = {obj, period, lane, spacing};
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
                possibleUseful = `creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
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
                    possibleUseful = `creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${strRecipe}\n`;
                } else {
                    possibleUseful = `creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${strRecipe}\n`;
                }
            }
            break;
        }
    }
    if (found) {
        return possibleUseful;
    }
    let create: StableObject | undefined = undefined;
    let endElbowData: [CheckerObjectData, CAObject[][]] | undefined = undefined;
    if (so1) {
        if (so2) {
            let so1Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                so1Result.push(getCollision(so1.obj.code, so1.lane, i));
            }
            let so2Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so2.period; i++) {
                so2Result.push(getCollision(so2.obj.code, so2.lane, i));
            }
            if (so1Result.every(x => typeof x === 'object')) {
                if (so2Result.every(x => typeof x === 'object')) {
                    return;
                } else {
                    endElbowData = [so1, so1Result];
                    create = so2.obj;
                }
            } else {
                if (so2Result.every(x => typeof x === 'object')) {
                    endElbowData = [so2, so2Result];
                    create = so1.obj;
                } else {
                    return;
                }
            }
        } else {
            let result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                result.push(getCollision(so1.obj.code, so1.lane, i));
            }
            if (result.every(x => typeof x === 'object')) {
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
    let endResult: Parameters<typeof findNextWorkingInput>[3] = undefined;
    if (endElbowData) {
        let [elbow, result] = endElbowData;
        endResult = {data: result, x: elbow.obj.x, y: elbow.obj.y};
        let str = `${elbow.obj.code}/${elbow.lane}`;
        if (badElbows.has(str)) {
            return;
        }
        if (elbow.obj.type === 'sl') {
            end = {elbow: str, period: 1, move: elbow.spacing, flipped: false, timing: 0};
        } else {
            end = {elbow: str, period: elbow.obj.period, move: elbow.spacing, flipped: false, timing: elbow.obj.timing};
        }
        if (!(str in elbows) && newElbows && !newElbows.includes(str)) {
            newElbows.push(str);
        }
    }
    return {recipe: {start: elbowStr, recipe, time, end, create, emit}, possibleUseful, endResult};
}

export function checkChannelRecipe(info: ChannelInfo, elbows: ElbowData, recipe: [number, number][], time: number, elbowStr: string, elbowData: [string, number], badElbows: Set<string>, newElbows?: string[]): undefined | {recipes?: ChannelRecipe[], possibleUseful?: string} {
    let value = getRecipeOutcome(info, elbows, recipe, time, elbowStr, elbowData, badElbows, newElbows);
    if (value === undefined) {
        return;
    } else if (typeof value === 'string') {
        return {possibleUseful: value};
    }
    let {recipe: out, endResult} = value;
    let next = findNextWorkingInput(info, elbowData, out, endResult);
    if (next !== false) {
        out.recipe.push([next, -1]);
        out.time += next;
        if (out.end && out.end.period > 1) {
            out.end.timing = (out.end.timing + next) % out.end.period;
        }
        let data = resolveElbow(info, elbows, badElbows, out);
        for (let recipe of data.recipes) {
            if (recipe.recipe.some(x => x[1] === -1)) {
                let recipe2: [number, number][] = [];
                for (let i = 0; i < recipe.recipe.length; i++) {
                    let [timing, channel] = recipe.recipe[i];
                    if (channel === -1) {
                        recipe.time -= timing;
                    } else {
                        recipe2.push([timing, channel]);
                    }
                }
                recipe.recipe = recipe2;
            }
            let value = getRecipeOutcome(info, elbows, recipe.recipe, recipe.time, elbowStr, elbowData, badElbows);
            if (typeof value !== 'object') {
                console.error('expected:', recipe);
                console.error('got:', value);
                console.error('\x1b[91mSanity check failed\x1b[0m');
                continue;
            }

            let data = value.recipe;
            let next = findNextWorkingInput(info, elbowData, data, endResult);
            if (!next) {
                console.error('expected:', recipe);
                console.error('got:', value);
                console.error('\x1b[91mSanity check failed\x1b[0m');
                continue;
            }
            data.time += next;
            if (data.end && data.end.period > 1) {
                data.end.timing = (data.end.timing + next) % data.end.period;
            }
            if ((data.end && (!recipe.end || data.end.elbow !== recipe.end.elbow || data.end.flipped !== recipe.end.flipped || data.end.move !== recipe.end.move || data.end.period !== recipe.end.period || data.end.timing !== recipe.end.timing)) || (!data.end && recipe.end) || (data.emit && (!recipe.emit || data.emit.dir !== recipe.emit.dir || data.emit.lane !== recipe.emit.lane || data.emit.timing !== recipe.emit.timing)) || (!data.emit && recipe.emit) || (data.create && (!recipe.create || data.create.type !== recipe.create.type || data.create.code !== recipe.create.code || data.create.x !== recipe.create.x || data.create.y !== recipe.create.y)) || (!data.create && recipe.create)) {
                console.error('expected:', recipe);
                console.error('got:', value);
                console.error('\x1b[91mSanity check failed\x1b[0m');
                continue;
            }
        }
        return data;
    } else {
        return {possibleUseful: `probably broken ${channelRecipeInfoToString(out)}: ${channelRecipeToString(info, recipe)}\n`};
    }
}

export function findChannelResults(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, elbow: string, elbowTiming: number, depth: number, maxSpacing: number, starts?: [number, number][][], parentPort?: MessagePort | null): {recipes: ChannelRecipe[], newElbows: string[], possibleUseful: string, recipeCount: number} {
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
    if (elbowTiming > 0) {
        recipes = recipes.map(x => {
            x[0].unshift([elbowTiming, -2]);
            return [x[0], x[1] + elbowTiming];
        });
    }
    recipes = [[[[86, 0], [65, 0]], 151]];
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
            if (value.recipes) {
                newRecipes.push(...value.recipes);
            }
            if (value.possibleUseful) {
                possibleUseful += value.possibleUseful;
            }
        }
    }
    return {recipes: newRecipes, newElbows, possibleUseful, recipeCount: recipes.length};
}


// @ts-ignore
if (import.meta.main || ('__wrecked_isWorker' in globalThis && globalThis.__wrecked_isWorker)) {
    const {parentPort, workerData} = await import('node:worker_threads');
    let info: ChannelInfo = workerData.info;
    setMaxGenerations(workerData.maxGenerations);
    let starts: [number, number][][] = workerData.starts;
    (parentPort as MessagePort).on('message', data => {
        (parentPort as MessagePort).postMessage(['completed', findChannelResults(info, data.elbows, data.badElbows, data.elbow, data.elbowTiming, data.depth, data.maxSpacing, starts, parentPort)]);
    });
}

// https://conwaylife.com/forums/viewtopic.php?f=2&t=1701
