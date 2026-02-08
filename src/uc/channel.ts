
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {MAPPattern} from '../core/index.js';
import {c, ChannelInfo, log, base, gliderPatterns, unparseChannelRecipe, objectsToString, RecipeData, loadRecipes, saveRecipes} from './base.js';
import {ChannelRecipeData, findChannelResults} from './channel_searcher.js';


/** Turns a single-channel sequence into a `Pattern`. */
export function createChannelPattern(info: ChannelInfo, recipe: [number, number][]): [MAPPattern, number, number, number] {
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel === -1) {
            continue;
        }
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.channels[channel];
        let q = gliderPatterns[total % c.GLIDER_PERIOD];
        p.ensure(x + q.width, y + q.height);
        p.insert(q, x, y);
        total += timing;
    }
    let y = Math.floor(total / c.GLIDER_PERIOD);
    let x = Math.floor(y * c.GLIDER_SLOPE);
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    let q = gliderPatterns[total % c.GLIDER_PERIOD];
    p.ensure(x + q.width, y + q.height);
    p.insert(q, x, y);
    let target = base.loadApgcode(info.start.apgcode).shrinkToFit();
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + info.start.spacing;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - info.start.lane + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    return [p, xPos, yPos, total + c.GLIDER_TARGET_SPACING];
}


function getRecipesForDepthSingleChannel(info: ChannelInfo, depth: number, maxSpacing: number, filter: string[], prevKey: string | undefined): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
    let limit = Math.max(maxSpacing, depth);
    for (let spacing = info.minSpacing; spacing < limit; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let key = prevKey === undefined ? `${spacing}:0` : prevKey + ` ${spacing}:0`;
        if (filter.includes(key)) {
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

function getRecipesForDepthSingleChannelGliderDepth(info: ChannelInfo, depth: number, maxSpacing: number, filter: string[], prevKey: string | undefined): [[number, number][], number, string][] {
    let out: [[number, number][], number, string][] = [];
    for (let spacing = info.minSpacing; spacing < maxSpacing; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let key = prevKey === undefined ? `${spacing}:0` : prevKey + ` ${spacing}:0`;
        if (filter.includes(key)) {
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

function getRecipesForDepthMultiChannel(info: ChannelInfo, depth: number, maxSpacing: number, filter: string[], prev: number | undefined, prevKey: string | undefined, lastUses: number[]): [[number, number][], number, string][] {
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
            if (filter.includes(key)) {
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

function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing: number, filter: string[], prev?: [number, string], gliderDepth: boolean = false): [[number, number][], number, string][] {
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

/** Performs a restricted-channel search. */
export async function searchChannel(type: string, maxThreads: number, maxSpacing: number, gliderDepth?: boolean): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await loadRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    let filter: string[] = [];
    let prev: [number, string] | undefined = undefined;
    if (info.forceStart) {
        let data = info.forceStart[info.forceStart.length - 1];
        prev = [data[1], `${data[0]}:${data[1]}`];
    }
    let depth = 0;
    let threads = 1;
    while (true) {
        log(`Searching depth ${depth}`);
        let start = performance.now();
        let recipesToCheck: ChannelRecipeData = [];
        let data = getRecipesForDepth(info, depth, maxSpacing, filter, prev, gliderDepth);
        let heap = process.memoryUsage().heapUsed / 1048576;
        if (heap > 1024) {
            log(`\x1b[91m${Math.round(heap)} MiB of memory currently in use\x1b[0m`);
        }
        for (let [recipe, time, key] of data) {
            if (!done.has(key)) {
                done.add(key);
                if (info.forceStart) {
                    recipe.unshift(...info.forceStart);
                    time += info.forceStart.map(x => x[0]).reduce((x, y) => x + y);
                }
                let data = createChannelPattern(info, recipe);
                if (data) {
                    recipesToCheck.push({recipe, key, p: data[0], xPos: data[1], yPos: data[2], total: data[3], time});
                }
            }
        }
        let recipeCount = recipesToCheck.length;
        log(`Got ${recipeCount} recipes (took ${((performance.now() - start) / 1000).toFixed(3)} seconds)`);
        let possibleUseful: string;
        let finished: RecipeData['channels'][string][] = [];
        if (threads === 1) {
            let data = findChannelResults(info, recipesToCheck);
            finished.push(data[0]);
            possibleUseful = data[1];
            filter.push(...data[2]);
        } else {
            possibleUseful = '';
            recipesToCheck.forEach(x => x.p = (x.p as MAPPattern).toApgcode());
            let workers: Worker[] = [];
            let finishedCount = 0;
            let checkedRecipes = 0;
            for (let i = 0; i < threads; i++) {
                let recipes = recipesToCheck.filter((_, j) => j % threads === i);
                let worker = new Worker(`${import.meta.dirname}/channel_worker.js`, {workerData: {info, recipes}});
                worker.on('message', data => {
                    if (typeof data === 'number') {
                        checkedRecipes += data;
                    } else {
                        finished.push(data[0]);
                        possibleUseful += data[1];
                        filter.push(...data[2]);
                        finishedCount++;
                        if (finishedCount === threads) {
                            clearInterval(interval);
                            resolve();
                        }
                    }
                });
                workers.push(worker);
            }
            let {promise, resolve} = Promise.withResolvers<void>();
            let interval = setInterval(() => log(`${checkedRecipes - 1}/${recipeCount} (${((checkedRecipes - 1) / recipeCount * 100).toFixed(3)}%) recipes checked`), 2200);
            await promise;
        }
        for (let data of finished) {
            for (let recipe of data.moveRecipes) {
                let entry = out.moveRecipes.find(x => x.move === recipe.move);
                if (entry === undefined) {
                    console.log(`\x1b[92mNew recipe: move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.moveRecipes.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
            for (let recipe of data.recipes90Deg) {
                let entry = out.recipes90Deg.find(x => x.lane === recipe.lane && x.ix === recipe.ix && x.move === recipe.move);
                if (entry === undefined) {
                    console.log(`\x1b[92mNew recipe: 90 degree emit ${recipe.lane}${recipe.ix} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.recipes90Deg.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): 90 degree emit ${recipe.lane}${recipe.ix} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
            for (let recipe of data.recipes0Deg) {
                let entry = out.recipes0Deg.find(x => x.lane === recipe.lane && x.move === recipe.move);
                if (entry === undefined) {
                    console.log(`\x1b[92mNew recipe: 0 degree emit ${recipe.lane} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.recipes0Deg.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): 0 degree emit ${recipe.lane} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
            for (let recipe of data.createHandRecipes) {
                let entry = out.createHandRecipes.find(x => x.obj.code === recipe.obj.code && x.obj.x === recipe.obj.x && x.obj.y === recipe.obj.y && x.move === recipe.move);
                if (entry === undefined) {
                    console.log(`\x1b[92mNew recipe: create ${objectsToString([recipe.obj])} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.createHandRecipes.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): create ${objectsToString([recipe.obj])} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
            if (data.destroyRecipe) {
                if (!out.destroyRecipe) {
                    out.destroyRecipe = data.destroyRecipe;
                    console.log(`\x1b[94mNew recipe: destroy: ${unparseChannelRecipe(info, out.destroyRecipe.recipe)}\x1b[0m`);
                } else if (data.destroyRecipe.time < out.destroyRecipe.time) {
                    out.destroyRecipe = data.destroyRecipe;
                    console.log(`\x1b[94mImproved recipe (${out.destroyRecipe.time} to ${data.destroyRecipe.time}): destroy: ${unparseChannelRecipe(info, out.destroyRecipe.recipe)}\x1b[0m`);
                }
            }
            for (let recipe of data.recipes90DegDestroy) {
                let entry = out.recipes90DegDestroy.find(x => x.lane === recipe.lane && x.ix === recipe.ix);
                if (entry === undefined) {
                    console.log(`\x1b[94mNew recipe: 90 degree emit ${recipe.lane}${recipe.ix} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.recipes90DegDestroy.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 90 degree emit ${recipe.lane}${recipe.ix} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
            for (let recipe of data.recipes0DegDestroy) {
                let entry = out.recipes0DegDestroy.find(x => x.lane === recipe.lane);
                if (entry === undefined) {
                    console.log(`\x1b[94mNew recipe: 0 degree emit ${recipe.lane} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    out.recipes0DegDestroy.push(recipe);
                } else if (entry.time > recipe.time) {
                    console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 0 degree emit ${recipe.lane} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                    entry.recipe = recipe.recipe;
                    entry.time = recipe.time;
                }
            }
        }
        let time = (performance.now() - start) / 1000;
        log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second)`);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n` + possibleUseful);
        }
        if (time > 1 && threads < maxThreads) {
            threads = Math.min(maxThreads, threads + Math.ceil(time) - 1);
            log(`\x1b[91mIncreasing to ${threads} threads\x1b[0m`);
        }
        depth++;
    }
}


/** Merges multiple restricted-channel recipes. */
export function mergeChannelRecipes(info: c.ChannelInfo, ...recipes: [number, number][][]): [number, number][] {
    let recipe = recipes.flat();
    let out: [number, number][] = [];
    let lastUses = (new Array(info.channels.length)).fill(Infinity);
    let prevChannel: number | null = null;
    for (let i = 0; i < recipe.length; i++) {
        let [spacing, channel] = recipe[i];
        if (lastUses[channel] < info.minSpacings[channel][channel] || (info.excludeSpacings && info.excludeSpacings[channel][channel].includes(lastUses[channel]))) {
            throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]}`);
        }
        if (prevChannel && (spacing < info.minSpacings[prevChannel][channel] || (info.excludeSpacings && info.excludeSpacings[prevChannel][channel].includes(spacing)))) {
            throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]}`);
        }
        if (channel === -1 && i !== recipe.length - 1 && recipe[i + 1][0] === -1) {
            i++;
            channel = recipe[i][1];
        }
        for (let j = 0; j < info.channels.length; j++) {
            lastUses[channel] += spacing;
        }
        lastUses[channel] = 0;
        out.push([spacing, channel]);
        prevChannel = channel;
    }
    return out;
}

// /** Turns a slow salvo into a restricted-channel synthesis. */
// export function slowSalvoToChannel(info: c.ChannelInfo, salvo: [number, number][]): [number, number][] {
//     let out: [number, number][] = [];
//     for (let lane of salvo) {
        
//     }
// }
