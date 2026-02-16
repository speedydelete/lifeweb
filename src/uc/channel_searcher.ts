
import {parentPort, workerData} from 'node:worker_threads';
import {findType, MAPPattern} from '../core/index.js';
import {c, ChannelInfo, log, StillLife, Spaceship, CAObject, base, gliderPatterns, unparseChannelRecipe, RecipeData, separateObjects, stabilize, findOutcome} from './base.js';
import {createChannelPattern} from './channel.js';


let info: ChannelInfo = workerData.info;
let starts: [number, number][][] = workerData.starts;

let expectedAsh: string[][] = workerData.expectedAsh;
let expectedAshPeriod: number = workerData.expectedAshPeriod;

let filter = new Set<string>();


function getRecipesForDepthSingleChannel(depth: number, maxSpacing: number, prevKey: string | undefined): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
    let limit = Math.min(maxSpacing, depth);
    for (let spacing = info.minSpacing; spacing <= limit; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let key = prevKey === undefined ? `${spacing}:0` : prevKey + ` ${spacing}:0`;
        if (filter.has(key)) {
            continue;
        }
        let elt: [number, number] = [spacing, 0];
        if (spacing === depth) {
            out.push([[elt], spacing, key]);
        } else if (depth - spacing >= info.minSpacing) {
            for (let recipe of getRecipesForDepthSingleChannel(depth - spacing, maxSpacing, key)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthMultiChannel(depth: number, maxSpacing: number, prev: number | undefined, prevKey: string | undefined, lastUses: number[]): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
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
            let key = prevKey === undefined ? `${spacing}:${channel}` : prevKey + ` ${spacing}:${channel}`;
            if (filter.has(key)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            out.push([[elt], spacing, key]);
            if (depth > 0) {
                let newLastUses = lastUses.map(x => x + spacing);
                newLastUses[channel] = 0;
                for (let recipe of getRecipesForDepthMultiChannel(depth - 1, maxSpacing, channel, key, newLastUses)) {
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

function getRecipesForDepth(depth: number, maxSpacing: number, prev?: [number, string]): [[number, number][], number, string][] {
    if (info.channels.length === 1) {
        return getRecipesForDepthSingleChannel(depth, maxSpacing, undefined);
    } else if (prev) {
        return getRecipesForDepthMultiChannel(depth, maxSpacing, prev[0], prev[1], (new Array(info.channels.length)).fill(Infinity));
    } else {
        let out: [[number, number][], number, string][] = [];
        let lastUses = (new Array(info.channels.length)).fill(Infinity);
        for (let channel = 0; channel < info.channels.length; channel++) {
            let newLastUses = lastUses.slice();
            newLastUses[channel] = 0;
            for (let recipe of getRecipesForDepthMultiChannel(depth, maxSpacing, channel, `${channel}:-1`, newLastUses)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}

function runInjection(recipe: [number, number][]/*, debug: boolean = false*/): MAPPattern {
    let gliders: MAPPattern[] = [];
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
            continue;
        }
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.channels[channel];
        let p = gliderPatterns[total % c.GLIDER_PERIOD].copy();
        p.xOffset += x;
        p.yOffset += y;
        gliders.push(p);
        total += timing;
    }
    let y = Math.floor(total / c.GLIDER_PERIOD) + info.start.spacing;
    let x = Math.floor(y * c.GLIDER_SLOPE) - info.start.lane + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    gliders.forEach(g => {
        g.xOffset -= x;
        g.yOffset -= y;
    });
    let p = base.loadApgcode(info.start.apgcode).shrinkToFit();
    let yPos = info.start.spacing;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - info.start.lane + c.LANE_OFFSET;
    p.offsetBy(xPos, yPos);
    p.insert(gliderPatterns[total % c.GLIDER_PERIOD], 0, 0);
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
            // if (xDiff < 2 || yDiff < 2 || (xDiff < last.width + c.INJECTION_SPACING) && (yDiff < last.height + c.INJECTION_SPACING)) {
            if ((xDiff < last.width + c.INJECTION_SPACING) || (yDiff < last.height + c.INJECTION_SPACING)) {
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
                // if (debug) {
                //     console.log(`\x1b[94minjecting (${gliders.length} gliders remaining)\x1b[0m\n${p.toRLE()}`);
                // }
            } else {
                break;
            }
        }
        i++;
        if (i > total + c.MAX_GENERATIONS) {
            // if (debug) {
            //     console.log(`\x1b[91mforced\x1b[0m\n${p.toRLE()}`);
            // }
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

function findChannelOutcome(recipe: [number, number][], mergeAll: boolean = false): false | 'linear' | CAObject[] {
    if (recipe.length < 2) {
        let {p, xPos, yPos} = createChannelPattern(info, recipe);
        p.xOffset -= xPos;
        p.yOffset -= yPos;
        return findOutcome(p, mergeAll);
    } else {
        return findOutcome(runInjection(recipe), mergeAll);
    }
}

function isNextWorkingInput(recipe: [number, number][], expectedAsh: string[], expectedAshPeriod: number, next: number): boolean {
    let test = recipe.slice();
    test.push([next, 0]);
    // console.log(`\x1b[95m${unparseChannelRecipe(info, test)}\x1b[0m`);
    let p: MAPPattern;
    if (recipe.length < 2) {
        let data = createChannelPattern(info, test);
        p = data.p;
        p.xOffset -= data.xPos;
        p.yOffset -= data.yPos;
    } else {
        p = runInjection(test);
    }
    let period = stabilize(p);
    // console.log(p.toRLE());
    if (typeof period !== 'number') {
        return false;
    }
    for (let i = 0; i < expectedAshPeriod; i++) {
        let result = separateObjects(p, period * 4, period * 4, true);
        if (result) {
            let key = result.map(x => x.code).sort().join(' ');
            // console.log(key);
            if (expectedAsh.includes(key)) {
                return true;
            }
            // hotfix
            if (result.length === 3 && key.startsWith('xq4_153 xq4_153 xs')) {
                return true;
            }
        }
        p.runGeneration();
    }
    return false;
}

function findNextWorkingInput(recipe: [number, number][], expectedAsh: string[], expectedAshPeriod: number/*, low: number, high: number*/): [number, number][] {
    // console.log(`\x1b[92mexpected: ${expectedAsh[0]} (period: ${expectedAsh[1]})\x1b[0m`);
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(recipe, expectedAsh, expectedAshPeriod, mid) && isNextWorkingInput(recipe, expectedAsh, expectedAshPeriod, mid + 1) && isNextWorkingInput(recipe, expectedAsh, expectedAshPeriod, mid + 2)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}\x1b[0m`);
    }
    if (low === info.maxNextSpacing) {
        // throw new Error('bruh');
        return recipe;
    } else {
        recipe = recipe.slice();
        recipe.push([low, -1]);
        return recipe;
    }
}

// function findNextWorkingInput(recipe: [number, number][], expectedAsh: string): [number, number][] {
//     for (let spacing = info.minSpacing; spacing < info.maxNextSpacing; spacing += 32) {
//         if (isNextWorkingInput(recipe, expectedAsh, spacing + 32) && isNextWorkingInput(recipe, expectedAsh, spacing + 33) && isNextWorkingInput(recipe, expectedAsh, spacing + 34)) {
//             return findNextWorkingInputBinarySearch(recipe, expectedAsh, spacing, spacing + 32);
//         }
//     }
//     throw new Error('bruh');
//     return recipe;
// }

function addObjects(recipe: [number, number][], strRecipe: string, time: number, move: number | null, shipData: [Spaceship, 'up' | 'down' | 'left' | 'right', number] | null, hand: StillLife | null, expectedAsh: string[][], expectedAshPeriod: number, out: RecipeData['channels'][string]): string | undefined {
    if (move === null) {
        if (shipData) {
            let [ship, dir, timing] = shipData;
            if (dir === 'up') {
                return `${ship.code} ${ship.dir} timing ${timing} lane ${ship.x - ship.y}: ${strRecipe}\n`;
            } else if (dir === 'down') {
                let lane = ship.x - ship.y;
                out.recipes0DegDestroy.push({recipe, time, lane, timing});
                for (let i = 1; i < info.period; i++) {
                    let newRecipe = recipe.slice();
                    newRecipe.unshift([i, -2]);
                    out.recipes0DegDestroy.push({recipe: newRecipe, time: time + i, lane, timing: (timing + i) % info.period});
                }
                return `0 degree emit ${lane} timing ${timing} destroy: ${strRecipe}\n`;
            } else {
                let lane = ship.x + ship.y;
                let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
                out.recipes90DegDestroy.push({recipe, time, lane, ix, timing});
                for (let i = 1; i < info.period; i++) {
                    let newRecipe = recipe.slice();
                    newRecipe.unshift([i, -2]);
                    out.recipes90DegDestroy.push({recipe: newRecipe, time: time + i, lane, ix, timing: (timing + i) % info.period});
                }
                return `90 degree emit ${lane}${ix} timing ${timing} destroy: ${strRecipe}\n`;
            }
        } else {
            return;
        }
    }
    if (shipData) {
        recipe = findNextWorkingInput(recipe, expectedAsh.map(x => x.concat(c.GLIDER_APGCODE).sort().join(' ')), expectedAshPeriod);
        strRecipe = unparseChannelRecipe(info, recipe);
        let [ship, dir, timing] = shipData;
        if (dir === 'up') {
            return;
        }
        if (dir === 'down') {
            let lane = ship.x - ship.y;
            out.recipes0Deg.push({recipe, time, lane, timing, move});
            for (let i = 1; i < info.period; i++) {
                let newRecipe = recipe.slice();
                newRecipe.unshift([i, -2]);
                out.recipes0Deg.push({recipe: newRecipe, time: time + i, lane, timing: (timing + i) % info.period, move});
            }
            return `0 degree emit ${lane} timing ${timing} move ${move}: ${strRecipe}\n`;
        } else {
            let lane = ship.x + ship.y;
            let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
            out.recipes90Deg.push({recipe, time, lane, ix, timing, move});
            for (let i = 1; i < info.period; i++) {
                let newRecipe = recipe.slice();
                newRecipe.unshift([i, -2]);
                out.recipes90Deg.push({recipe: newRecipe, time: time + i, lane, ix, timing: (timing + i) % info.period, move});
            }
            return `90 degree emit ${lane}${ix} timing ${timing} move ${move}: ${strRecipe}\n`;
        }
    } else if (hand) {
        recipe = findNextWorkingInput(recipe, expectedAsh.map(x => x.concat(hand.code).sort().join(' ')), expectedAshPeriod);
        strRecipe = unparseChannelRecipe(info, recipe);
        out.createHandRecipes.push({recipe, time, obj: hand, move});
        return `create hand ${hand.code} (${hand.x}, ${hand.y}) move ${move}: ${strRecipe}\n`;
    } else {
        recipe = findNextWorkingInput(recipe, expectedAsh.map(x => x.sort().join(' ')), expectedAshPeriod);
        strRecipe = unparseChannelRecipe(info, recipe);
        if (move === 0) {
            return;
        }
        out.moveRecipes.push({recipe, time, move});
        return `move ${move}: ${strRecipe}\n`;
    }
}

export function findChannelResults(depth: number, maxSpacing: number, parentPort?: (typeof import('node:worker_threads'))['parentPort']): {data: RecipeData['channels'][string], possibleUseful: string, recipeCount: number} {
    let out: RecipeData['channels'][string] = {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], recipes0DegDestroy: [], recipes90DegDestroy: [], createHandRecipes: []};
    let possibleUseful = '';
    let recipes: [[number, number][], number, string][] = [];
    for (let start of starts) {
        let startTime = start.map(x => x[0]).reduce((x, y) => x + y);
        if (info.forceStart) {
            start.unshift(...info.forceStart);
            startTime += info.forceStart.map(x => x[0]).reduce((x, y) => x + y);
        }
        if (startTime > depth) {
            continue;
        }
        let startKey = start.map(x => `${x[0]}:${x[1]} `).join('');
        if (startTime === depth) {
            recipes.push([start, startTime, startKey.slice(0, -1)]);
        }
        if (start.length < 3) {
            continue;
        }
        let last = start[start.length - 1];
        for (let [recipe, time, key] of getRecipesForDepth(depth - startTime, maxSpacing, [last[1], `${last[0]}:${last[1]}`])) {
            key = startKey + key;
            recipe.unshift(...start);
            time += startTime;
            recipes.push([recipe, time, key]);
        }
    }
    // recipes = [[[[75, 0], [73, 0], [72, 0], [67, 0], [61, 0]], 348, '75:0 73:0 72:0 67:0 61:0']];
    if (parentPort) {
        parentPort.postMessage(['starting', recipes.length]);
    } else {
        log(`Checking ${recipes.length} recipes`);
    }
    let count = 0;
    let lastUpdate = performance.now();
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 5000) {
            lastUpdate = now;
            if (parentPort) {
                parentPort.postMessage(['update', {count, out}]);
                count = 0;
            } else {
                log(`${i - 1}/${recipes.length} (${((i - 1) / recipes.length * 100).toFixed(3)}%) recipes checked`);
            }
        }
        count++;
        let [recipe, time, key] = recipes[i];
        let result: false | 'linear' | CAObject[];
        let strRecipe = unparseChannelRecipe(info, recipe);
        result = findChannelOutcome(recipe);
        if (result === false) {
            continue;
        }
        if (result === 'linear') {
            possibleUseful += `Linear growth: ${strRecipe}\n`;
            continue;
        }
        let move: number | null = null;
        let shipData: [Spaceship, 'up' | 'down' | 'left' | 'right', number] | null = null;
        let hand: StillLife | null = null;
        let found = false;
        if (result.length === 0) {
            filter.add(key + ' ');
            if (!out.destroyRecipe || out.destroyRecipe.time > time) {
                out.destroyRecipe = {recipe, time};
            }
        }
        if (result.some(x => x.type === 'other') || (result.every(x => x.type === 'ship') && !result.some(x => x.type === 'ship' && x.code === c.GLIDER_APGCODE))) {
            filter.add(key + ' ');
            continue;
        }
        for (let obj of result) {
            if (obj.type === 'sl') {
                let lane = obj.y - obj.x + info.start.lane;
                let spacing = obj.x + obj.y;
                // if (result.length === 1 && ((obj.code === 'xs2_11' && lane === -4) || (obj.code === 'xs2_3' && lane === -3))) {
                //     possibleUseful += `Snarkmaker (${obj.code === 'xs2_11' ? 'left' : 'right'}): ${strRecipe}\n`;
                // }
                if (move === null && obj.code in info.elbows && info.elbows[obj.code].includes(lane)) {
                    move = spacing;
                } else if (!hand && (Math.abs(lane) > info.minHandSpacing || (move !== null && (spacing - move) > info.minHandSpacing))) {
                    hand = obj;        
                } else {
                    found = true;
                    break;
                }
            } else if (!shipData && obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
                let dir: 'up' | 'down' | 'left' | 'right';
                if (obj.dir.startsWith('N')) {
                    dir = obj.dir.startsWith('NE') ? 'right' : 'up';
                } else if (obj.dir.startsWith('S')) {
                    dir = obj.dir.startsWith('SW') ? 'left' : 'down';
                } else {
                    dir = obj.dir.startsWith('W') ? 'left' : 'right';
                }
                shipData = [obj, dir, obj.timing % info.period];
            } else {
                if (info.possiblyUsefulFilter && info.possiblyUsefulFilter.includes(obj.code)) {
                    continue;
                }
                if (obj.type === 'ship' && obj.code !== c.GLIDER_APGCODE) {
                    possibleUseful += `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
                } else if (obj.type === 'other' && obj.code.startsWith('xq')) {
                    filter.add(key + ' ');
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
                found = true;
                break;
            }
        }
        if (found || (shipData && hand)) {
            continue;
        }
        let value = addObjects(recipe, strRecipe, time, move, shipData, hand, expectedAsh, expectedAshPeriod, out);
        if (value) {
            possibleUseful += value;
        }
    }
    return {data: out, possibleUseful, recipeCount: recipes.length};
}


if (!parentPort) {
    throw new Error('No parent port!');
}

parentPort.on('message', data => {
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let out = findChannelResults(data.depth, data.maxSpacing, parentPort);
    parentPort.postMessage(['completed', out]);
});
