
import {lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, ShipDirection, maxGenerations, setMaxGenerations, base, shipPatterns, channelRecipeToString, StableObject, CAObject, normalizeOscillator, objectsToString, ShipInfo, getShipInfo, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
import {findOutcome} from './runner.js';
import {getCollision} from './slow_salvos.js';


export function runInjection(info: ChannelInfo, elbow: [string, number], elbowTiming: number, elbowPeriod: number, recipe: [number, number][], override?: [MAPPattern, number], doFinal: boolean = true): MAPPattern {
    let phaseOffset = 0;
    for (let [spacing] of recipe) {
        phaseOffset += spacing;
    }
    phaseOffset = (info.ship.period - (phaseOffset % info.ship.period)) % info.ship.period;
    let gliders: MAPPattern[] = [];
    let total = 0;
    let timingOffset = elbowTiming;
    while (recipe.length > 0 && recipe[0][1] === -2) {
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
        if (override && i < recipe.length - override[1]) {
            total += timing;
            continue;
        }
        let y = Math.floor(total * info.ship.dy / info.ship.period);
        if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
            y++;
        }
        let x = Math.floor(y * info.ship.slope) + info.channels[channel];
        let p = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period].copy();
        p.xOffset += x;
        p.yOffset += y;
        gliders.push(p);
        total += timing;
    }
    if (override) {
        total -= override[0].generation;
    }
    let y = Math.floor(total * info.ship.dy / info.ship.period) + c.GLIDER_TARGET_SPACING;
    let x = Math.floor(y * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    for (let glider of gliders) {
        glider.xOffset -= x;
        glider.yOffset -= y;
    }
    let p: MAPPattern;
    if (override) {
        p = override[0];
    } else {
        p = base.loadApgcode(elbow[0].slice(elbow[0].indexOf('_') + 1)).shrinkToFit();
        let yPos = c.GLIDER_TARGET_SPACING;
        if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
            yPos--;
        }
        let xPos = Math.floor(yPos * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
        while (xPos < 0 || yPos < 0) {
            xPos++;
            yPos++;
        }
        if (timingOffset > 0) {
            p.run(timingOffset).shrinkToFit();
            for (let glider of gliders) {
                glider.xOffset += p.xOffset;
                glider.yOffset += p.yOffset;
            }
            xPos += p.xOffset;
            yPos += p.yOffset;
            p.xOffset = 0;
            p.yOffset = 0;
            p.generation = 0;
        }
        p.offsetBy(xPos, yPos);
        let toInsert = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period];
        p.ensure(toInsert.width, toInsert.height);
        p.insert(toInsert, 0, 0);
    }
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
            if (xDiff - last.width < 3 || yDiff - last.height < 3 || ((xDiff < last.width + c.INJECTION_SPACING) && (yDiff < last.height + c.INJECTION_SPACING)) || (xDiff + p.width <= last.width) || (yDiff + p.height <= last.height)) {
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
    if (doFinal) {
        let prevPop = p.population;
        for (let i = 0; i < 256; i++) {
            p.run(info.ship.popPeriod);
            let pop = p.population;
            if (pop !== prevPop) {
                return p;
            }
            prevPop = pop;
        }
    }
    return p;
}


export interface RunState {
    p: MAPPattern;
    elbow: [string, number, number];
    recipe: [number, number][];
    time: number;
    startX: number;
    startY: number;
}

export interface StrRunState {
    p: string;
    xOffset: number;
    yOffset: number;
    generation: number;
    elbow: [string, number, number];
    recipe: [number, number][];
    time: number;
    startX: number;
    startY: number;
}

export function createState(info: ChannelInfo, elbow: [string, number, number]): RunState {
    let p = base.loadApgcode(elbow[0].slice(elbow[0].indexOf('_') + 1)).shrinkToFit();
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
    p.xOffset = startX;
    p.yOffset = startY;
    // console.log(p.toRLE());
    return {p, elbow, recipe: [], time: 0, startX, startY};
}

function runState(info: ChannelInfo, state: RunState, nextGlider: number, channel: number, injected: boolean = false): RunState {
    let subtractTime = injected;
    // console.log(Object.assign({}, state, {p: undefined}));
    let p = state.p.copy();
    while (true) {
        let timing = p.generation - (subtractTime ? state.time : 0) - (injected ? info.minSpacing + nextGlider : nextGlider);
        let mod = timing % info.ship.period;
        if (mod < 0) {
            mod += info.ship.period;
        }
        let q = shipPatterns[info.ship.code][mod];
        let dist = (timing - mod) / info.ship.period;
        let x = state.startX + dist * info.ship.dx + info.channels[channel];
        let y = state.startY + dist * info.ship.dy;
        let xDiff = p.xOffset - x;
        let yDiff = p.yOffset - y;
        // console.log(`time = ${p.generation}, timing = ${timing}, dist = ${dist}, x = ${x}, y = ${y}, p.xOffset = ${p.xOffset}, p.yOffset = ${p.yOffset}, xDiff = ${xDiff}, yDiff = ${yDiff}`);
        if (xDiff - q.width < 3 || yDiff - q.height < 3 || ((xDiff < q.width + c.INJECTION_SPACING) && (yDiff < q.height + c.INJECTION_SPACING)) || (xDiff + p.width <= q.width) || (yDiff + p.height <= q.height)) {
            if (injected) {
                // console.log('returning');
                // console.log(p.toRLE());
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
            // console.log('injecting');
            // console.log(p.toRLE());
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
    //     msg += `\n    ${i}:\n        stables: ${objectsToString(value.stables)}\n        ships: ${value.ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}}`;
    // }
    // msg += `\ntotal period: ${expecteds.period}`;
    // console.log(msg);
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

export function resolveElbow(info: ChannelInfo, elbows: ElbowData, recipe: ChannelRecipe, depth: number = 0): {recipes: ChannelRecipe[], possibleUseful: string} {
    if (depth === 64) {
        console.error(`\x1b[91mThere is a recursive elbow (please report to speedydelete)\x1b[0m`);
        return {recipes: [], possibleUseful: ''};
    }
    if (!recipe.end) {
        return {recipes: [recipe], possibleUseful: getStringRecipe(info, recipe)};
    }
    if (!(recipe.end.elbow in elbows)) {
        return {recipes: [recipe], possibleUseful: ''};
    }
    let outcomes = elbows[recipe.end.elbow];
    let out: ChannelRecipe[] = [];
    let possibleUseful = '';
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
            let value = resolveElbow(info, elbows, recipe2, depth + 1);
            out.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        }
    }
    return {recipes: out, possibleUseful};
}


function isTooBig(obj: string, limit: number, overrides: string[]): boolean {
    if (obj.startsWith('xs')) {
        if (parseInt(obj.slice(2)) > limit) {
            let index = obj.indexOf('_');
            let p = base.loadApgcode(obj.slice(index + 1, obj.indexOf('/')));
            if (overrides.includes(p.toCanonicalApgcode(1, obj.slice(0, index)))) {
                return false;
            } else {
                return true;
            }
        } else {
            return false;
        }
    }
    let period = parseInt(obj.slice(2));
    let p = base.loadApgcode(obj.slice(obj.indexOf('_') + 1, obj.indexOf('/')));
    if (p.population > limit) {
        if (overrides.includes(p.toCanonicalApgcode(1, 'xp' + period))) {
            return false;
        }
        return true;
    }
    for (let i = 0; i < period - 1; i++) {
        p.runGeneration();
        if (p.population > limit) {
            if (overrides.includes(p.toCanonicalApgcode(1, 'xp' + period))) {
                return false;
            }
            return true;
        }
    }
    return false;
}

interface CheckerObjectData {
    obj: StableObject;
    period: number;
    lane: number;
    spacing: number;
}

function checkRecipe(info: ChannelInfo, elbows: ElbowData, newElbows: string[], state: RunState, nextGlider: number, nextChannel: number): {state: RunState, outcome: string, recipes?: ChannelRecipe[], possibleUseful?: string} {
    // console.log(`\x1b[94m${nextGlider}:\x1b[0m\n${state.p.toRLE()}`);
    state = runState(info, state, nextGlider, nextChannel, true);
    let p = state.p.copy();
    // console.log(p.toRLE());
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
        } else if (obj.type === 'osc') {
            return normalizeOscillator(obj);
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
    if (create && (emit || isTooBig(create.code, c.CREATE_SIZE_LIMIT, c.CREATE_SIZE_LIMIT_OVERRIDES))) {
        return {state, outcome};
    }
    let end: ChannelRecipe['end'] | undefined = undefined;
    let endResult: Parameters<typeof findNextWorkingInput>[3] = undefined;
    if (endElbowData) {
        let [elbow, result] = endElbowData;
        if (isTooBig(elbow.obj.code, c.ELBOW_SIZE_LIMIT, c.ELBOW_SIZE_LIMIT_OVERRIDES)) {
            return {state, outcome};
        }
        endResult = {data: result, x: elbow.obj.x, y: elbow.obj.y};
        let str = `${elbow.obj.code}/${elbow.lane}`;
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
    let out: ChannelRecipe = {start: `${state.elbow[0]}/${state.elbow[1]}`, recipe: state.recipe.slice(), time: state.time, end, create, emit};
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
        let {recipes} = resolveElbow(info, elbows, out);
        return {state, outcome, recipes};
    } else {
        return {state, outcome, possibleUseful: `probably broken ${channelRecipeInfoToString(out)}: ${channelRecipeToString(info, state.recipe)}\n`};
    }
}


function runStart(info: ChannelInfo, elbows: ElbowData, newElbows: string[], state: RunState, maxSpacing: number): {states: RunState[], recipes: ChannelRecipe[], possibleUseful: string, recipesChecked: number} {
    let states: RunState[] = [];
    let recipes: ChannelRecipe[] = [];
    let possibleUseful = '';
    let recipesChecked = 0;
    let startChannel = (state.recipe[state.recipe.length - 1] ?? [0, 0])[1];
    for (let channel = 0; channel < info.channels.length; channel++) {
        let timings: number[] = [];
        for (let timing = info.minSpacings[startChannel][channel]; timing <= maxSpacing; timing++) {
            timings.push(timing);
        }
        let outcomes: string[] = [];
        // console.log(Object.assign({}, state, {p: undefined}));
        let p = state.p.copy();
        while (timings.length > 0) {
            let timing = p.generation - state.time - timings[0];
            let mod = timing % info.ship.period;
            if (mod < 0) {
                mod += info.ship.period;
            }
            let q = shipPatterns[info.ship.code][mod];
            let dist = (timing - mod) / info.ship.period;
            let x = state.startX + dist * info.ship.dx + info.channels[channel];
            let y = state.startY + dist * info.ship.dy;
            let xDiff = p.xOffset - x;
            let yDiff = p.yOffset - y;
            // console.log(`time = ${p.generation}, timing = ${timing}, dist = ${dist}, x = ${x}, y = ${y}, p.xOffset = ${p.xOffset}, p.yOffset = ${p.yOffset}, xDiff = ${xDiff}, yDiff = ${yDiff}`);
            if (xDiff - q.width < 3 || yDiff - q.height < 3 || ((xDiff < q.width + c.INJECTION_SPACING) && (yDiff < q.height + c.INJECTION_SPACING)) || (xDiff + p.width <= q.width) || (yDiff + p.height <= q.height)) {
                let r = p.copy();
                r.offsetBy(Math.max(xDiff, 0), Math.max(yDiff, 0));
                r.insert(q, Math.max(-xDiff, 0), Math.max(-yDiff, 0));
                let data = checkRecipe(info, elbows, newElbows, {
                    p: r,
                    elbow: state.elbow,
                    recipe: state.recipe.slice(),
                    time: state.time,
                    startX: state.startX,
                    startY: state.startY,
                }, timings[0], channel);
                timings.shift();
                recipesChecked++;
                states.unshift(data.state);
                if (data.recipes) {
                    recipes.push(...data.recipes);
                }
                if (data.possibleUseful) {
                    possibleUseful += data.possibleUseful;
                }
                // console.log(channelRecipeToString(info, data.state.recipe) + ': ' + data.outcome);
                outcomes.unshift(data.outcome);
                let found = false;
                for (let period = 1; period < Math.floor(outcomes.length / 3); period++) {
                    let found2 = false;
                    for (let i = 0; i < period; i++) {
                        if (outcomes[i] === 'no stabilize' || outcomes[i] === 'linear' || outcomes[i] !== outcomes[i + period] || outcomes[i] !== outcomes[i + period * 2]) {
                            found2 = true;
                            break;
                        }
                    }
                    if (!found2) {
                        found = true;
                        states = states.slice(period * 2);
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            p.runGeneration();
            p.shrinkToFit();
        }
    }
    return {states, recipes, possibleUseful, recipesChecked};
}


export interface WorkerData {
    info: ChannelInfo;
    maxGenerations: number;
    outputFile?: string;
    maxSpacing: number;
}

export interface WorkerStartData {
    elbows: ElbowData;
    starts: StrRunState[];
}

export interface WorkerOutput {
    complete: boolean;
    startsChecked: number;
    recipesChecked: number;
    states: StrRunState[];
    recipes: ChannelRecipe[];
    possibleUseful: string[];
    newElbows: string[];
}

// @ts-ignore
if (import.meta.main || ('__wrecked_isWorker' in globalThis && globalThis.__wrecked_isWorker)) {
    if (typeof process === 'object' && process && typeof process.env === 'object') {
        process.env.FORCE_COLOR = '1';
    }
    let {parentPort, workerData: _workerData} = await import('node:worker_threads');
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let workerData: WorkerData = _workerData;
    let info = workerData.info;
    let maxSpacing = workerData.maxSpacing;
    setMaxGenerations(workerData.maxGenerations);
    if (workerData.outputFile !== undefined) {
        let originalWrite = process.stdout.write.bind(process.stdout);
        let {appendFileSync} = await import('node:fs');
        process.stdout.write = function(data: string | Uint8Array, encoding: NodeJS.BufferEncoding | ((error?: Error | null) => void) = 'utf-8', callback?: (error?: Error | null) => void): boolean {
            if (typeof encoding === 'function') {
                callback = encoding;
                encoding = 'utf-8';
            }
            if (data instanceof Uint8Array) {
                let str = '';
                for (let byte of data) {
                    str += String.fromCharCode(byte);
                }
                data = str;
                encoding = 'latin1';
            }
            let stripped = data.replaceAll(/\x1b\[([0-9;]+)m/g, '');
            appendFileSync(workerData.outputFile as string, stripped, encoding);
            return originalWrite(data, encoding, callback);
        }
    }
    parentPort.on('message', (data: WorkerStartData) => {
        let lastUpdate = performance.now();
        let startsChecked = 0;
        let recipesChecked = 0;
        let states: StrRunState[] = [];
        let recipes: ChannelRecipe[] = [];
        let possibleUseful: string[] = [];
        let newElbows: string[] = [];
        for (let start of data.starts) {
            let state = Object.assign(start, {p: base.loadApgcode(start.p).shrinkToFit()});
            state.p.xOffset = state.xOffset;
            state.p.yOffset = state.yOffset;
            state.p.generation = state.generation;
            let value = runStart(info, data.elbows, newElbows, state, maxSpacing);
            startsChecked++;
            recipesChecked += value.recipesChecked;
            states.push(...value.states.map(x => Object.assign(x, {
                p: x.p.toApgcode(),
                xOffset: x.p.xOffset,
                yOffset: x.p.yOffset,
                generation: x.p.generation,
            })));
            recipes.push(...value.recipes);
            possibleUseful.push(value.possibleUseful);
            let now = performance.now();
            if (now - lastUpdate > 5000) {
                lastUpdate = now;
                parentPort.postMessage({complete: false, startsChecked, recipesChecked, states, recipes, possibleUseful, newElbows} satisfies WorkerOutput);
                startsChecked = 0;
                recipesChecked = 0;
                states = [];
                recipes = [];
                possibleUseful = [];
                newElbows = [];
            }
        }
        parentPort.postMessage({complete: true, startsChecked, recipesChecked, states, recipes, possibleUseful, newElbows} satisfies WorkerOutput);
    });
}
