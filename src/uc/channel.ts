
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {MAPPattern} from '../core/index.js';
import {c, log, ChannelInfo, base, gliderPatterns, objectsToString, unparseChannelRecipe, RecipeData, getRecipes, saveRecipes} from './base.js';
import {ChannelRecipeData, findChannelResults} from './channel_searcher.js';


export function createChannelPattern(info: ChannelInfo, recipe: [number, number][]): false | [MAPPattern, number, number, number] {
    let p = base.copy();
    // let total2 = 0;
    // for (let x of recipe) {
    //     if (x[1] === -1) {
    //         continue;
    //     }
    //     total2 += x[0];
    //     if (total2 % 10 > 5) {
    //         return false;
    //     }
    // }
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
    let target = base.loadApgcode(info.start[0]).shrinkToFit();
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - info.start[1] + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    return [p, xPos, yPos, total + c.GLIDER_TARGET_SPACING];
}


function _getRecipesForDepth(info: ChannelInfo, depth: number, filter: string[], maxSpacing: number | undefined, prev: number | undefined, prevKey: string | undefined): [[number, number][], number][] {
    let out: [[number, number][], number][] = [];
    let limit = maxSpacing ? Math.min(depth, maxSpacing) : depth;
    for (let channel = 0; channel < info.channels.length; channel++) {
        for (let spacing = prev === undefined ? info.minSpacing : info.minSpacings[prev][channel]; spacing <= limit; spacing++) {
            if (prev && info.excludeSpacings?.[prev]?.[channel]?.includes(spacing)) {
                continue;
            }
            let key = prevKey === undefined ? `${spacing}:${channel}` : prevKey + ` ${spacing}:${channel}`;
            if (filter.includes(key)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            if (spacing === depth) {
                out.push([[elt], spacing]);
            }
            if (depth - spacing > info.minSpacing) {
                for (let recipe of _getRecipesForDepth(info, depth - spacing, filter, maxSpacing, channel, key)) {
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

function getRecipesForDepth(info: ChannelInfo, depth: number, filter: string[], maxSpacing?: number, prev?: [number, string]): [[number, number][], number][] {
    if (info.channels.length === 1) {
        return _getRecipesForDepth(info, depth, filter, maxSpacing, undefined, '');
    } else if (prev) {
        return _getRecipesForDepth(info, depth, filter, maxSpacing, prev[0], prev[1]);
    } else {
        let out: [[number, number][], number][] = [];
        for (let channel = 0; channel < info.channels.length; channel++) {
            for (let recipe of _getRecipesForDepth(info, depth, filter, maxSpacing, channel, `${channel}:-1`)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}

export async function searchChannel(type: string, maxThreads: number, depth: number, maxSpacing?: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await getRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    let filter: string[] = [];
    let prev: [number, string] | undefined = undefined;
    if (info.forceStart) {
        let data = info.forceStart[info.forceStart.length - 1];
        prev = [data[1], `${data[0]}:${data[1]}`];
    }
    let threads = 1;
    while (true) {
        let start = performance.now();
        let recipesToCheck: ChannelRecipeData = [];
        let data = getRecipesForDepth(info, depth, filter, maxSpacing, prev);
        for (let [recipe, time] of data) {
            let key = recipe.map(x => x[0] + ':' + x[1]).join(' ');
            if (time !== depth) {
                continue;
            }
            if (filter.some(x => key.startsWith(x))) {
                continue;
            }
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
        log(`Checking ${recipeCount} recipes`);
        let heap = process.memoryUsage().heapUsed / 1048576;
        if (heap > 2048) {
            log(`\x1b[91m${Math.round(heap)} MiB of memory currently in use\x1b[0m`);
        }
        let possibleUseful: string;
        if (threads === 1) {
            let data = findChannelResults(info, recipesToCheck, out, undefined, log);
            possibleUseful = data[0];
            filter.push(...data[1]);
        } else {
            possibleUseful = '';
            recipesToCheck.forEach(x => x.p = (x.p as MAPPattern).toApgcode());
            let workers: Worker[] = [];
            let finished: RecipeData['channels'][string][] = [];
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
            for (let data of finished) {
                for (let recipe of data.moveRecipes) {
                    let entry = out.moveRecipes.find(x => x.move === recipe.move);
                    if (entry === undefined) {
                        console.log(`\x1b[92mNew recipe: move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                        out.moveRecipes.push(recipe);
                    } else if (entry.time > recipe.time) {
                        console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
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
                        console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 90 degree emit ${recipe.lane}${recipe.ix} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
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
                        console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 0 degree emit ${recipe.lane} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
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
                        console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): create ${objectsToString([recipe.obj])} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
                        entry.recipe = recipe.recipe;
                        entry.time = recipe.time;
                    }
                }
            }
        }
        let time = (performance.now() - start) / 1000;
        log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second), searching depth ${depth + 1}`);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n` + possibleUseful);
        }
        if (time > 3 && threads < maxThreads) {
            threads++;
            log(`\x1b[91mIncreasing to ${threads} threads\x1b[0m`);
        }
        depth++;
    }
}
