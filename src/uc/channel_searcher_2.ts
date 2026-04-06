
import {MessagePort} from 'node:worker_threads';
import {lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, ShipDirection, maxGenerations, setMaxGenerations, base, shipPatterns, channelRecipeToString, StableObject, CAObject, normalizeOscillator, objectsToString, ShipInfo, getShipInfo, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
import {findOutcome} from './runner.js';
import {getCollision} from './slow_salvos.js';


interface RunState {
    p: MAPPattern;
    elbow: [string, number, number];
    recipe: [number, number][];
    time: number;
    startX: number;
    startY: number;
}

export function createState(info: ChannelInfo, elbow: [string, number, number]): RunState {
    let p = base.loadApgcode(elbow[0]).shrinkToFit();
    let yPos = c.GLIDER_TARGET_SPACING;
    let timing = elbow[2];
    if (timing > info.ship.period) {
        let mod = timing % info.ship.period;
        yPos += (timing - (info.ship.period - mod)) / info.ship.period + 1;
        timing = mod;
    }
    while (timing > info.ship.period) {
        yPos++;
        timing -= info.ship.period;
    }
    let xPos = Math.floor(yPos * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
    p.offsetBy(Math.max(xPos, 0), Math.max(yPos, 0));
    let toInsert = shipPatterns[info.ship.code][timing];
    p.ensure(toInsert.width, toInsert.height);
    let startX = Math.max(-xPos, 0);
    let startY = Math.max(-yPos, 0);
    p.insert(toInsert, startX, startY);
    startX += p.xOffset;
    startY += p.yOffset;
    return {p, elbow, recipe: [], time: 0, startX, startY};
}

function runState(info: ChannelInfo, state: RunState, nextGlider: number, channel: number): RunState {
    let p = state.p.copy();
    let injected = false;
    while (true) {
        let timing = p.generation + state.time + (injected ? info.minSpacing : nextGlider);
        let mod = timing % info.ship.period;
        let q = shipPatterns[info.ship.code][info.ship.period - mod];
        let dist = (timing - mod) / info.ship.period;
        let x = q.xOffset + state.startX - dist * info.ship.dx + info.channels[channel];
        let y = q.yOffset + state.startY - dist * info.ship.dy;
        let xDiff = p.xOffset - x;
        let yDiff = p.yOffset - y;
        if (xDiff < 3 || yDiff < 3 || ((xDiff < q.width + c.INJECTION_SPACING) && (yDiff < q.height + c.INJECTION_SPACING)) || (xDiff + p.width <= q.width) || (yDiff + p.height <= q.height)) {
            if (injected) {
                let recipe = state.recipe.slice();
                recipe.push([nextGlider, channel]);
                return {
                    p,
                    elbow: state.elbow,
                    recipe,
                    time: state.time + nextGlider,
                    startX: state.startX,
                    startY: state.startY,
                };
            } else {
                injected = true;
            }
            p.offsetBy(Math.max(xDiff, 0), Math.max(yDiff, 0));
            p.insert(q, Math.max(-xDiff, 0), Math.max(-yDiff, 0));
        }
        p.runGeneration();
        p.shrinkToFit();
    }
}

interface ExpectedResult {
    data: {
        stables: StableObject[];
        ships: ShipInfo[];
        period: number;
    }[];
    period: number;
    offsets: Set<number>;
}


function getExpected(info: ChannelInfo, elbow: [string, number, number], recipe: ChannelRecipe, results: {data: CAObject[][], x: number, y: number} | undefined): ExpectedResult {
    let data: ExpectedResult['data'] = [];
    let period = 0;
    if (recipe.end) {
        if (!results) {
            throw new Error('No results! (there is a bug)');
        }
        for (let result of results.data) {
            let out: (typeof data)[number] = {stables: [], ships: [], period: 1};
            for (let obj of result) {
                obj = structuredClone(obj);
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj);
                }
                obj.x += results.x;
                obj.y += results.y;
                if (obj.type === 'sl') {
                    out.stables.push(obj);
                } else if (obj.type === 'osc') {
                    out.period = lcm(out.period, obj.period);
                    out.stables.push(obj);
                } else if (obj.type === 'ship') {
                    out.period = lcm(out.period, c.SPACESHIPS[obj.code].popPeriod);
                    out.ships.push(getShipInfo(info, obj));
                } else {
                    throw new Error(`Invalid object for getting expected: ${JSON.stringify(obj, undefined, 4)}`);
                }
            }
            if (recipe.create) {
                if (recipe.create.type === 'sl') {
                    out.stables.push(recipe.create);
                } else {
                    out.period = lcm(out.period, recipe.create.period);
                    out.stables.push(normalizeOscillator(recipe.create));
                }
            }
            if (recipe.emit) {
                for (let ship of recipe.emit) {
                    out.period = lcm(out.period, c.SPACESHIPS[ship.code].popPeriod);
                }
                out.ships.push(...recipe.emit);
            }
            period = lcm(period, out.period);
            data.push(out);
        }
    } else {
        let out: (typeof data)[number] = {
            stables: [],
            ships: [{
                code: info.ship.code,
                dir: info.ship.slope === 0 ? 'S' : 'SE',
                lane: elbow[1],
                timing: 0
            }],
            period: 1,
        };
        if (recipe.create) {
            if (recipe.create.type === 'sl') {
                out.stables.push(recipe.create);
            } else {
                out.period = lcm(out.period, recipe.create.period);
                out.stables.push(normalizeOscillator(recipe.create));
            }
        }
        if (recipe.emit) {
            for (let ship of recipe.emit) {
                out.period = lcm(out.period, c.SPACESHIPS[ship.code].popPeriod);
            }
            out.ships.push(...recipe.emit);
        }
        period = lcm(period, out.period);
        data.push(out);
    }
    let out: ExpectedResult = {data, period, offsets: new Set()};
    for (let i = 0; i < data.length; i++) {
        out.offsets.add(i);
    }
    return out;
}

function checkNextWorkingInput(info: ChannelInfo, state: RunState, expected: ExpectedResult['data'][number]): boolean {
    let p = state.p;
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
    let objs = findOutcome(p, undefined, undefined, true);
    if (typeof objs !== 'object') {
        return false;
    }
    let stables: StableObject[] = [];
    let ships: ShipInfo[] = [];
    for (let obj of objs) {
        if (obj.type === 'sl') {
            stables.push(obj);
        } else if (obj.type === 'osc') {
            stables.push(normalizeOscillator(obj));
        } else if (obj.type === 'ship') {
            ships.push(getShipInfo(info, obj));
        } else {
            return false;
        }
    }
    // console.log(`\x1b[94mgot:\n    stables: ${objectsToString(stables)}\n    ships: ${ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n    others: ${others.join(', ')}\x1b[0m`);
    if (stables.length !== expected.stables.length || ships.length !== expected.ships.length) {
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
    return true;
}

function isNextWorkingInput(info: ChannelInfo, state: RunState, next: number, expecteds: ExpectedResult): boolean {
    state = runState(info, state, next, 0);
    if (expecteds.offsets.size === 1) {
        return checkNextWorkingInput(info, state, expecteds.data[(next + Array.from(expecteds.offsets)[0]) % expecteds.data.length]);
    } else {
        let data = expecteds.data.map(x => checkNextWorkingInput(info, state, x));
        if (data.every(x => x === false)) {
            return false;
        }
        for (let i = 0; i < data.length; i++) {
            if (i in expecteds.offsets) {
                if (!data[i]) {
                    expecteds.offsets.delete(i);
                }
            }
        }
        return true;
    }
}

export function findNextWorkingInput(info: ChannelInfo, state: RunState, recipe: ChannelRecipe, results: {data: CAObject[][], x: number, y: number} | undefined): false | number {
    // console.log(recipe);
    let expecteds = getExpected(info, state.elbow, recipe, results);
    // let msg = '\x1b[92mexpecteds:';
    // for (let i = 0; i < expecteds.data.length; i++) {
    //     let value = expecteds.data[i];
    //     msg += `\n    ${i}:\n        stables: ${objectsToString(value.stables)}\n        ships: ${value.ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\n        others: ${value.others.join(', ')}`;
    // }
    // msg += `\ntotal period: ${expecteds.period}`;
    // console.log(msg + '\x1b[0m');
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    let i = 0;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(info, state, mid, expecteds) && isNextWorkingInput(info, state, mid + 1, expecteds) && isNextWorkingInput(info, state, mid + 2, expecteds)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}\x1b[0m`);
        i++;
    }
    if (low >= info.maxNextSpacing) {
        if (!recipe.create) {
            console.error(`\x1b[91mUnable to find next possible glider spacing: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
        }
        return false;
    }
    return low;
}


function getStringRecipe(info: ChannelInfo, recipe: ChannelRecipe): string {
    return `${channelRecipeInfoToString(recipe)}: ${channelRecipeToString(info, recipe.recipe)}\n`;
}

export function resolveElbow(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, recipe: ChannelRecipe, depth: number = 0): {recipes: ChannelRecipe[], possibleUseful: string} {
    if (depth === 64) {
        console.error(`\x1b[91mThere is a recursive elbow (please report to speedydelete)\x1b[0m`);
        return {recipes: [], possibleUseful: ''};
    }
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
    // console.log(`resolving ${recipe.end.elbow}`);
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
            // idk if you should do this
            // if (recipe2.emit && info.period > 1) {
            //     for (let ship of recipe2.emit) {
            //         ship.timing = (ship.timing + elbow.timing) % info.period;
            //     }
            // }
            let value = resolveElbow(info, elbows, badElbows, recipe2, depth + 1);
            out.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        }
    }
    // console.log(`resolution result for ${channelRecipeInfoToString(recipe)}:`, out);
    // console.log(')');
    return {recipes: out, possibleUseful};
}


function elbowIsTooBig(elbow: string): boolean {
    if (elbow.startsWith('xs')) {
        return parseInt(elbow.slice(2)) > c.MAX_ELBOW_POPULATION;
    }
    let period = parseInt(elbow.slice(2));
    let p = base.loadApgcode(elbow.slice(elbow.indexOf('_') + 1, elbow.indexOf('/')));
    if (p.population > c.MAX_ELBOW_POPULATION) {
        return false;
    }
    for (let i = 0; i < period - 1; i++) {
        p.runGeneration();
        if (p.population > c.MAX_ELBOW_POPULATION) {
            return false;
        }
    }
    return true;
}

interface CheckerObjectData {
    obj: StableObject;
    period: number;
    lane: number;
    spacing: number;
}

function checkRecipe(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, newElbows: string[], state: RunState, nextGlider: number, nextChannel: number): {state: RunState, outcome: string, recipes?: ChannelRecipe[], possibleUseful?: string} {
    state = runState(info, state, nextGlider, nextChannel);
    let p = state.p.copy();
    let prevPop = p.population;
    for (let i = 0; i < 256; i++) {
        p.run(info.ship.popPeriod);
        let pop = p.population;
        if (pop !== prevPop) {
            break;
        }
        prevPop = pop;
    }
    let result = findOutcome(p);
    if (result === false || result === 'no stabilize') {
        return {state, outcome: String(result)};
    } else if (result === 'linear') {
        return {state, outcome: String(result), possibleUseful: `Linear growth: ${channelRecipeToString(info, state.recipe)}\n`};
    }
    let outcome = objectsToString(result.map(obj => {
        if (obj.type === 'ship') {
            return {
                type: 'ship',
                code: obj.code,
                dir: obj.dir,
                timing: 0,
                x: 0,
                y: 0,
                at: 0,
            };
        } else {
            return obj;
        }
    }));
    let so1: CheckerObjectData | undefined = undefined;
    let so2: CheckerObjectData | undefined = undefined;
    let emit: ShipInfo[] | undefined = undefined;
    for (let obj of result) {
        if (obj.type === 'sl' || obj.type === 'osc') {
            if (so1 && so2) {
                return {state, outcome};
            }
            if (obj.type === 'osc') {
                obj = normalizeOscillator(obj);
            }
            let period = obj.type === 'osc' ? obj.period : 1;
            let lane = Math.floor(obj.y * info.ship.slope) - obj.x + state.elbow[1];
            let value = {obj, period, lane, spacing: obj.y};
            if (so1 === undefined) {
                so1 = value;
            } else {
                so2 = value;
            }
        } else if (obj.type === 'ship') {
            let ship = getShipInfo(info, obj);
            if (emit) {
                let dir = ship.dir;
                if (dir.endsWith('2')) {
                    dir = dir.slice(0, -1) as ShipDirection;
                }
                if (emit.some(x => dir !== (x.dir.endsWith('2') ? x.dir.slice(0, -1) : x.dir))) {
                    return {state, outcome};
                }
                emit.push(ship);
            } else {
                emit = [ship];
            }
        } else {
            if (info.possiblyUsefulFilter.includes(obj.code)) {
                return {state, outcome};
            }
            if (obj.type === 'other' && obj.code.startsWith('xq')) {
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
                    return {state, outcome, possibleUseful: `creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}\n`};
                } else {
                    return {state, outcome, possibleUseful: `creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}\n`};
                }
            }
            return {state, outcome, possibleUseful: `creates ${obj.code} and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}`};
        }
    }
    let create: StableObject | undefined = undefined;
    let endElbowData: [CheckerObjectData, CAObject[][]] | undefined = undefined;
    if (so1) {
        if (so2) {
            let so1Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                so1Result.push(getCollision(info, so1.obj.code, so1.lane, i, undefined, undefined, true));
            }
            let so2Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so2.period; i++) {
                so2Result.push(getCollision(info, so2.obj.code, so2.lane, i, undefined, undefined, true));
            }
            if (so1Result.every(x => typeof x === 'object')) {
                endElbowData = [so1, so1Result];
                create = so2.obj;
                if (emit) {
                    return {state, outcome};
                }
            } else {
                if (so2Result.every(x => typeof x === 'object')) {
                    endElbowData = [so2, so2Result];
                    create = so1.obj;
                } else {
                    return {state, outcome};
                }
            }
        } else {
            let result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                result.push(getCollision(info, so1.obj.code, so1.lane, i, undefined, undefined, true));
            }
            if (result.every(x => typeof x === 'object')) {
                endElbowData = [so1, result];
            } else {
                create = so1.obj;
            }
        }
    }
    if (create && emit) {
        return {state, outcome};
    }
    let end: ChannelRecipe['end'] | undefined = undefined;
    let endResult: Parameters<typeof findNextWorkingInput>[3] = undefined;
    if (endElbowData) {
        let [elbow, result] = endElbowData;
        if (elbowIsTooBig(elbow.obj.code)) {
            return {state, outcome};
        }
        endResult = {data: result, x: elbow.obj.x, y: elbow.obj.y};
        let str = `${elbow.obj.code}/${elbow.lane}`;
        if (badElbows.has(str)) {
            return {state, outcome};
        }
        if (elbow.obj.type === 'sl') {
            end = {elbow: str, period: 1, move: elbow.spacing, flipped: false, timing: 0};
        } else {
            end = {elbow: str, period: elbow.obj.period, move: elbow.spacing, flipped: false, timing: elbow.obj.timing};
        }
        if (!(str in elbows) && newElbows && !newElbows.includes(str)) {
            // console.log(`New elbow detected: ${str} in recipe ${strRecipe}`);
            newElbows.push(str);
        }
    }
    let out: ChannelRecipe = {start: `${state.elbow[0]}/${state.elbow[1]}`, recipe: state.recipe, time: state.time, end, create, emit};
    let next = findNextWorkingInput(info, state, out, endResult);
    if (next !== false) {
        out.recipe.push([next, -1]);
        out.time += next;
        if (out.end && out.end.period > 1) {
            out.end.timing = (out.end.timing + next) % out.end.period;
        }
        if (out.emit && info.period > 1) {
            for (let ship of out.emit) {
                ship.timing = (ship.timing + next) % info.period;
            }
        }
        let {recipes, possibleUseful} = resolveElbow(info, elbows, badElbows, out);
        return {state, outcome, recipes, possibleUseful};
    } else {
        return {state, outcome, possibleUseful: `probably broken ${channelRecipeInfoToString(out)}: ${channelRecipeToString(info, state.recipe)}\n`};
    }
}


export function runJob(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, newElbows: string[], state: RunState, maxSpacing: number): {recipes: ChannelRecipe[], possibleUseful: string} {
    let recipes: ChannelRecipe[] = [];
    let possibleUseful = '';
    let startChannel = (state.recipe[state.recipe.length - 1] ?? [0, 0])[1];
    for (let channel of info.channels) {
        let outcomes: string[] = [];
        for (let timing = info.minSpacings[startChannel][channel]; timing < maxSpacing; timing++) {
            let data = checkRecipe(info, elbows, badElbows, newElbows, state, timing, channel);
            if (data.recipes) {
                recipes.push(...data.recipes);
            }
            if (data.possibleUseful) {
                possibleUseful += data.possibleUseful;
            }
            let outcome = data.outcome;
            let found = false;
            for (let period = 0; period < Math.floor(outcomes.length / 3); period++) {
                for (let i = 1; i < 4; i++) {
                    if (outcome !== outcomes[period * i]) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (found) {
                break;
            }
            outcomes.unshift(outcome);
        }
    }
    return {recipes, possibleUseful};
}
