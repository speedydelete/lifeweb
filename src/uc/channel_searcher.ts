
import {MAPPattern, findType} from '../core/index.js';
import {c, log, ChannelInfo, base, StillLife, Spaceship, unparseChannelRecipe, findOutcome, RecipeData} from './base.js';
import {createChannelPattern} from './channel.js';


function getRecipesForDepthSingleChannel(info: ChannelInfo, depth: number, maxSpacing: number, filter: Set<string>, prevKey: string | undefined): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
    let limit = Math.max(maxSpacing, depth);
    for (let spacing = info.minSpacing; spacing < limit; spacing++) {
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
        } else if (depth - spacing > info.minSpacing) {
            for (let recipe of getRecipesForDepthSingleChannel(info, depth - spacing, maxSpacing, filter, key)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthSingleChannelGliderDepth(info: ChannelInfo, depth: number, maxSpacing: number, filter: Set<string>, prevKey: string | undefined): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
    for (let spacing = info.minSpacing; spacing < maxSpacing; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let key = prevKey === undefined ? `${spacing}:0` : prevKey + ` ${spacing}:0`;
        if (filter.has(key)) {
            continue;
        }
        let elt: [number, number] = [spacing, 0];
        out.push([[elt], spacing, key]);
        if (depth > 0) {
            for (let recipe of getRecipesForDepthSingleChannelGliderDepth(info, depth - 1, maxSpacing, filter, key)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthMultiChannel(info: ChannelInfo, depth: number, maxSpacing: number, filter: Set<string>, prev: number | undefined, prevKey: string | undefined, lastUses: number[]): [[number, number][], number, string][] {
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
                for (let recipe of getRecipesForDepthMultiChannel(info, depth - 1, maxSpacing, filter, channel, key, newLastUses)) {
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

function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing: number, filter: Set<string>, prev?: [number, string], gliderDepth: boolean = false): [[number, number][], number, string][] {
    if (info.channels.length === 1) {
        if (gliderDepth) {
            return getRecipesForDepthSingleChannelGliderDepth(info, depth, maxSpacing, filter, undefined);
        } else {
            return getRecipesForDepthSingleChannel(info, depth, maxSpacing, filter, undefined);
        }
    } else if (prev) {
        return getRecipesForDepthMultiChannel(info, depth, maxSpacing, filter, prev[0], prev[1], (new Array(info.channels.length)).fill(Infinity));
    } else {
        let out: [[number, number][], number, string][] = [];
        let lastUses = (new Array(info.channels.length)).fill(Infinity);
        for (let channel = 0; channel < info.channels.length; channel++) {
            let newLastUses = lastUses.slice();
            newLastUses[channel] = 0;
            for (let recipe of getRecipesForDepthMultiChannel(info, depth, maxSpacing, filter, channel, `${channel}:-1`, newLastUses)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}


function addObjects(recipe: [number, number][], strRecipe: string, time: number, move: number | null, shipData: [Spaceship, 'up' | 'down' | 'left' | 'right', number] | null, hand: StillLife | null, out: RecipeData['channels'][string]): string | undefined {
    if (move === null) {
        if (shipData) {
            let [ship, dir, timing] = shipData;
            if (dir === 'up') {
                return `${ship.code} ${ship.dir} lane ${ship.x - ship.y}: ${strRecipe}\n`;
            } else if (dir === 'down') {
                let lane = ship.x - ship.y;
                out.recipes0DegDestroy.push({recipe, time, lane, timing});
                return `0 degree emit ${lane} destroy: ${strRecipe}\n`;
            } else {
                let lane = ship.x + ship.y;
                let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
                out.recipes90DegDestroy.push({recipe, time, lane, ix, timing});
                return `90 degree emit ${lane}${ix} destroy: ${strRecipe}\n`;
            }
        } else {
            return;
        }
    }
    if (shipData) {
        let [ship, dir, timing] = shipData;
        if (dir === 'up') {
            return;
        }
        if (dir === 'down') {
            let lane = ship.x - ship.y;
            out.recipes0Deg.push({recipe, time, lane, timing, move});
            return `0 degree emit ${lane} move ${move}: ${strRecipe}\n`;
        } else {
            let lane = ship.x + ship.y;
            let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
            out.recipes90Deg.push({recipe, time, lane, ix, timing, move});
            return `90 degree emit ${lane}${ix} move ${move}: ${strRecipe}\n`;
        }
    } else if (hand) {
        out.createHandRecipes.push({recipe, time, obj: hand, move});
        return `create hand ${hand.code} (${hand.x}, ${hand.y}) move ${move}: ${strRecipe}\n`;
    } else {
        if (move === 0) {
            return;
        }
        out.moveRecipes.push({recipe, time, move});
        return `move ${move}: ${strRecipe}\n`;
    }
}

export function findChannelResults(info: ChannelInfo, depth: number, maxSpacing: number, filter: Set<string>, done: Set<string>, starts?: [number, number][][], prev?: [number, string], gliderDepth?: boolean, parentPort?: (typeof import('node:worker_threads'))['parentPort']): {data: RecipeData['channels'][string], possibleUseful: string, newFilter: Set<string>, newDone: Set<string>, recipeCount: number} {
    let out: RecipeData['channels'][string] = {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], recipes0DegDestroy: [], recipes90DegDestroy: [], createHandRecipes: []};
    let possibleUseful = '';
    let newFilter = new Set<string>();
    let newDone = new Set<string>();
    let recipes: [[number, number][], number, string][] = [];
    if (starts) {
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
                let key = startKey.slice(0, -1);
                if (!done.has(key)) {
                    done.add(key);
                    newDone.add(key);
                    recipes.push([start, startTime, startKey.slice(0, -1)]);
                }
            }
            let last = start[start.length - 1];
            for (let [recipe, time, key] of getRecipesForDepth(info, depth - startTime, maxSpacing, filter, [last[1], `${last[0]}:${last[1]}`], gliderDepth)) {
                key = startKey + key;
                if (done.has(key)) {
                    continue;
                }
                done.add(key);
                newDone.add(key);
                recipe.unshift(...start);
                time += startTime;
                recipes.push([recipe, time, key]);
            }
        }
    } else {
        recipes = getRecipesForDepth(info, depth, maxSpacing, filter, prev, gliderDepth);
    }
    if (parentPort) {
        parentPort.postMessage(['starting', recipes.length]);
    } else {
        log(`Checking ${recipes.length} recipes`);
    }
    let count = 0;
    let lastUpdate = performance.now();
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 3000) {
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
        let [p, xPos, yPos, total] = createChannelPattern(info, recipe);
        let strRecipe = unparseChannelRecipe(info, recipe);
        let result = findOutcome(p, xPos, yPos, strRecipe, Math.max(total / c.GLIDER_DY, 0));
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
            newFilter.add(key + ' ');
            if (!out.destroyRecipe || out.destroyRecipe.time > time) {
                out.destroyRecipe = {recipe, time};
            }
        }
        if (result.every(x => x.type === 'ship' || x.type === 'other') && !result.some(x => x.type === 'ship' && x.code === c.GLIDER_APGCODE && !(x.dir.startsWith('N') && !x.dir.startsWith('NE')))) {
            newFilter.add(key + ' ');
            continue;
        }
        for (let obj of result) {
            if (obj.type === 'sl') {
                let lane = obj.y - obj.x;
                let spacing = obj.x + obj.y;
                // if (result.length === 1 && ((obj.code === 'xs2_11' && lane === -4) || (obj.code === 'xs2_3' && lane === -3))) {
                //     possibleUseful += `Snarkmaker (${obj.code === 'xs2_11' ? 'left' : 'right'}): ${strRecipe}\n`;
                // }
                if (move === null && obj.code in info.elbows && info.elbows[obj.code].includes(lane)) {
                    move = spacing;
                } else if (!hand && (Math.abs(lane) > info.minHandSpacing || (move && (spacing - move) > info.minHandSpacing))) {
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
                if (obj.type === 'ship'  && obj.code !== c.GLIDER_APGCODE) {
                    possibleUseful += `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
                } else if (obj.type === 'other' && obj.code.startsWith('xq')) {
                    newFilter.add(key + ' ');
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
        addObjects(recipe, strRecipe, time, move, shipData, hand, out);
    }
    return {data: out, possibleUseful, newFilter, newDone, recipeCount: recipes.length};
}


// @ts-ignore
if (import.meta.main) {
    // @ts-ignore
    let {parentPort, workerData} = await import('node:worker_threads');
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let data = findChannelResults(workerData.info, workerData.depth, workerData.maxSpacing, workerData.filter, workerData.done, workerData.starts, workerData.prev, workerData.gliderDepth, parentPort);
    parentPort.postMessage(['completed', data]);
}
