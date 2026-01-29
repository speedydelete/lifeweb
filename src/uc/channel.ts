
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {MAPPattern} from '../core/index.js';
import {c, log, ChannelInfo, base, gliderPatterns, getRecipes, saveRecipes, RecipeData, unparseChannelRecipe} from './base.js';
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


function _getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing?: number, prev?: number): [number, number][][] {
    let out: [number, number][][] = [];
    let limit = maxSpacing ? Math.min(depth, maxSpacing) : depth;
    for (let channel = 0; channel < info.channels.length; channel++) {
        for (let spacing = prev === undefined ? info.minSpacing : info.minSpacings[prev][channel]; spacing <= limit; spacing++) {
            if (prev && info.excludeSpacings?.[prev]?.[channel]?.includes(spacing)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            out.push([elt]);
            if (depth - spacing > info.minSpacing) {
                for (let recipe of _getRecipesForDepth(info, depth - spacing, maxSpacing, channel)) {
                    recipe.unshift(elt);
                    out.push(recipe);
                }
            }
        }
    }
    return out;
}

function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing?: number, prev?: number): [number, number][][] {
    if (info.channels.length === 1 || prev) {
        return _getRecipesForDepth(info, depth, maxSpacing, prev);
    } else {
        let out: [number, number][][] = [];
        for (let channel = 0; channel < info.channels.length; channel++) {
            for (let recipe of _getRecipesForDepth(info, depth, maxSpacing, channel)) {
                recipe.unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}


export async function searchChannel(type: string, threads: number, depth: number, maxSpacing?: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await getRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    let filter: string[] = [];
    while (true) {
        log(`Searching depth ${depth}`, true);
        let start = performance.now();
        let recipesToCheck: ChannelRecipeData = [];
        for (let recipe of getRecipesForDepth(info, depth, maxSpacing, info.forceStart ? info.forceStart[info.forceStart.length - 1][1] : undefined)) {
            let key = recipe.map(x => x[0] + ':' + x[1]).join(' ');
            let time = recipe.map(x => x[0]).filter(x => x !== -1).reduce((x, y) => x + y);
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
        log(`Checking ${recipeCount} recipes`, true);
        let possibleUseful: string;
        if (threads === 1 || recipeCount < 3000) {
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
                        out.moveRecipes.push(recipe);
                    } else if (entry.time > recipe.time) {
                        entry.recipe = recipe.recipe;
                        entry.time = recipe.time;
                    }
                }
                for (let recipe of data.recipes90Deg) {
                    let entry = out.recipes90Deg.find(x => x.lane === recipe.lane && x.ix === recipe.ix && x.move === recipe.move);
                    if (entry === undefined) {
                        out.recipes90Deg.push(recipe);
                    } else if (entry.time > recipe.time) {
                        entry.recipe = recipe.recipe;
                        entry.time = recipe.time;
                    }
                }
                for (let recipe of data.recipes0Deg) {
                    let entry = out.recipes0Deg.find(x => x.lane === recipe.lane && x.move === recipe.move);
                    if (entry === undefined) {
                        out.recipes0Deg.push(recipe);
                    } else if (entry.time > recipe.time) {
                        entry.recipe = recipe.recipe;
                        entry.time = recipe.time;
                    }
                }
                for (let recipe of data.createHandRecipes) {
                    let entry = out.createHandRecipes.find(x => x.obj.code === recipe.obj.code && x.obj.x === recipe.obj.x && x.obj.y === recipe.obj.y && x.move === recipe.move);
                    if (entry === undefined) {
                        out.createHandRecipes.push(recipe);
                    } else if (entry.time > recipe.time) {
                        entry.recipe = recipe.recipe;
                        entry.time = recipe.time;
                    }
                }
            }
        }
        let time = (performance.now() - start) / 1000;
        log(`Depth ${depth} complete, took ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second)`, true);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n` + possibleUseful);
        }
        depth++;
    }
}
