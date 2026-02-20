
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {MAPPattern} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, log, base, gliderPatterns, channelRecipeToString, ChannelRecipe, channelRecipeInfoToString, RecipeData, loadRecipes, saveRecipes} from './base.js';
import type {ShipInfo} from './channel_searcher.js';


/** Turns a single-channel sequence into a `Pattern`. */
export function createChannelPattern(info: ChannelInfo, elbow: string | [string, number], recipe: [number, number][]): {p: MAPPattern, xPos: number, yPos: number, total: number} {
    if (typeof elbow === 'string') {
        let parts = elbow.split('/');
        elbow = [parts[0].slice(parts[0].indexOf('_') + 1), parseInt(parts[1])];
    }
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
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
    let target = base.loadApgcode(elbow[0]).shrinkToFit();
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + elbow[1];
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    total += c.GLIDER_TARGET_SPACING;
    return {p, xPos, yPos, total};
}


function addNewRecipes(info: ChannelInfo, data: ChannelRecipe[], out: {[key: string]: ChannelRecipe}): void {
    for (let recipe of data) {
        let key = channelRecipeInfoToString(recipe);
        if (key in out && out[key].time < recipe.time) {
            continue;
        }
        let color: string;
        if (out.end) {
            if (out.create) {
                if (out.emit) {
                    color = '96';
                } else {
                    color = '95';
                }
            } else {
                color = '92';
            }
        } else {
            color = '94';
        }
        console.log(`\x1b[${color}m${key in out ? 'Improved' : 'New'} recipe: ${key}: ${channelRecipeToString(info, recipe.recipe)}`);
        out[key] = recipe;
    }
}

/** Performs a restricted-channel search. */
export async function searchChannel(type: string, threads: number, maxSpacing: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let msg = `\n${type} search in ${base.ruleStr} with max spacing ${maxSpacing} and max generations ${maxGenerations}:\n`;
    if (existsSync('possible_useful.txt')) {
        let stat = await fs.stat('possible_useful.txt');
        if (stat.size > 0) {
            msg = '\n' + msg;
        }
        await fs.appendFile('possible_useful.txt', msg);
    }
    let recipes = await loadRecipes();
    let out = recipes.channels[type];
    let depth = 0;
    let starts: [number, number][][] = [];
    for (let a = info.minSpacing; a < maxSpacing; a++) {
        for (let b = 0; b < info.channels.length; b++) {
            starts.push([[a, b]]);
            for (let c = info.minSpacing; c < maxSpacing; c++) {
                for (let d = 0; d < info.channels.length; d++) {
                    if (c < info.minSpacings[b][d] || (info.excludeSpacings && info.excludeSpacings[b][d].includes(c))) {
                        continue;
                    }
                    starts.push([[a, b], [c, d]]);
                    for (let e = info.minSpacing; e < maxSpacing; e++) {
                        for (let f = 0; f < info.channels.length; f++) {
                            if (e < info.minSpacings[d][f] || (info.excludeSpacings && info.excludeSpacings[d][f].includes(e))) {
                                continue;
                            }
                            starts.push([[a, b], [c, d], [e, f]]);
                        }
                    }
                }
            }
        }
    }
    console.log(`Compiled ${starts.length} starts`);
    let workers: Worker[] = [];
    for (let i = 0; i < threads; i++) {
        // @ts-ignore
        workers.push(new Worker(`${import.meta.dirname}/channel_searcher.js`, {workerData: {
            info,
            maxGenerations,
            starts: starts.filter((_, j) => j % threads === i),
        }}));
    }
    while (true) {
        log(`Searching depth ${depth}`);
        let start = performance.now();
        let recipeCount = 0;
        let finished: {recipes: ChannelRecipe[], newElbows: string[], possibleUseful: string, recipeCount: number}[] = [];
        let startedCount = 0;
        let finishedCount = 0;
        let checkedRecipes = 0;
        let timeout: NodeJS.Timeout | null = null;
        let interval: NodeJS.Timeout | null = null;
        for (let worker of workers) {
            worker.removeAllListeners('message');
            worker.on('message', ([type, data]) => {
                if (type === 'starting') {
                    recipeCount += data;
                    startedCount++;
                    if (startedCount === threads) {
                        log(`Checking ${recipeCount} recipes`);
                        timeout = setTimeout(() => {
                            interval = setInterval(() => {
                                if (startedCount === threads && checkedRecipes > 0 && recipeCount > 0) {
                                    log(`${checkedRecipes - 1}/${recipeCount} (${((checkedRecipes - 1) / recipeCount * 100).toFixed(3)}%) recipes checked`);
                                }
                            }, 5000);
                        }, 2500);
                    }
                } else if (type === 'update') {
                    checkedRecipes += data.count;
                    addNewRecipes(info, data.recipes, out.recipes);
                } else if (type === 'completed') {
                    finished.push(data);
                    finishedCount++;
                    if (finishedCount === threads) {
                        if (timeout !== null) {
                            clearTimeout(timeout);
                        }
                        if (interval !== null) {
                            clearInterval(interval);
                        }
                        resolve();
                    }
                } else {
                    throw new Error(`Invalid Worker message type: '${type}'`);
                }
            });
            worker.postMessage({info, depth, maxSpacing});
        }
        let {promise, resolve} = Promise.withResolvers<void>();
        await promise;
        let possibleUseful = '';
        for (let data of finished) {
            addNewRecipes(info, data.recipes, out.recipes);
            possibleUseful += data.possibleUseful;
        }
        let time = (performance.now() - start) / 1000;
        log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second)`);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n${possibleUseful}`);
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
        if (channel === -1) {
            if (i !== recipe.length - 1) {
                if (recipe[i + 1][0] === -1) {
                    i++;
                    channel = recipe[i][1];
                } else {
                    channel = 0;
                }
            }
        } else if (channel === -2) {
            for (let j = 0; j < info.channels.length; j++) {
                lastUses[channel] += spacing;
            }
            if (out.length === 0) {
                out.push([channel, spacing]);
            } else {
                out[out.length - 1][0] += spacing;
            }
            continue;
        } else {
            for (let j = 0; j < info.channels.length; j++) {
                lastUses[channel] += spacing;
            }
            if (lastUses[channel] < info.minSpacings[channel][channel] || (info.excludeSpacings && info.excludeSpacings[channel][channel].includes(lastUses[channel]))) {
                throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]} generations`);
            }
            if (prevChannel && (spacing < info.minSpacings[prevChannel][channel] || (info.excludeSpacings && info.excludeSpacings[prevChannel][channel].includes(spacing)))) {
                throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]} generations`);
            }
            lastUses[channel] = 0;
        }
        out.push([spacing, channel]);
        prevChannel = channel;
    }
    return out;
}


interface RecipeProgress {
    recipes: [number, number][][];
    time: number;
    index: number;
    elbow: string;
    elbowPos: number;
}

/** Converts a slow salvo to a restricted-channel recipe. */
export function salvoToChannel(info: ChannelInfo, recipeData: RecipeData['channels'][string], startElbow: string, salvo: [number, number][], dir: 'up' | 'down' | 'left' | 'right', depth?: number, forceEndElbow?: false | number, minElbow?: number, maxElbow?: number): {recipe: [number, number][], time: number, elbow: false | [string, number]} {
    let prevLayer: RecipeProgress[] = [{recipes: [], time: 0, index: 0, elbow: startElbow, elbowPos: 0}];
    let moveRecipes: (ChannelRecipe & {end: [string, number]})[] = [];
    let emitRecipes: (ChannelRecipe & {end: [string, number], emit: ShipInfo})[] = [];
    let emitDestroyRecipes: (ChannelRecipe & {emit: ShipInfo})[] = [];
    let destroyRecipes: ChannelRecipe[] = [];
    for (let recipe of Object.values(recipeData.recipes)) {
        if (recipe.create) {
            continue;
        }
        if (recipe.end) {
            if (recipe.emit) {
                if (recipe.emit.dir === dir) {
                    // @ts-ignore
                    emitRecipes.push(recipe);   
                }
            } else {
                // @ts-ignore
                moveRecipes.push(recipe);
            }
        } else if (recipe.emit) {
            if (recipe.emit.dir === dir) {
                // @ts-ignore
                emitDestroyRecipes.push(recipe);
            }
        } else {
            destroyRecipes.push(recipe);
        }
    }
    depth ??= salvo.length;
    let out: {recipes: [number, number][][], time: number, elbow: false | [string, number]}[] = [];
    for (let i = 0; i < depth; i++) {
        let nextLayer: RecipeProgress[] = [];
        for (let {recipes, time, index, elbow, elbowPos} of prevLayer) {
            if (index < salvo.length) {
                for (let recipe of emitRecipes) {
                    if (recipe.start === elbow && recipe.emit.lane === salvo[index][0] && recipe.emit.timing === salvo[index][1]) {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        let newElbowPos = elbowPos + recipe.end[1];
                        if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                            continue;
                        }
                        if (index + 1 === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                            out.push({
                                recipes: recipes2,
                                time: time + recipe.time,
                                elbow: recipe.end,
                            })
                        } else {
                            let recipes2 = recipes.slice();
                            recipes2.push(recipe.recipe);
                            nextLayer.push({
                                recipes: recipes2,
                                time: time + recipe.time,
                                index: index + 1,
                                elbow: recipe.end[0],
                                elbowPos: elbowPos + recipe.end[1],
                            })
                        }
                    }
                }
            }
            for (let recipe of moveRecipes) {
                if (recipe.start === elbow) {
                    let recipes2 = recipes.slice();
                    recipes2.push(recipe.recipe);
                    let newElbowPos = elbowPos + recipe.end[1];
                    if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                        continue;
                    }
                    if (index === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                        out.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            elbow: recipe.end,
                        })
                    } else {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        nextLayer.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            index,
                            elbow: recipe.end[0],
                            elbowPos: elbowPos + recipe.end[1],
                        })
                    }
                }
            }
            if (index === salvo.length - 1 && forceEndElbow === false) {
                for (let recipe of emitDestroyRecipes) {
                    if (recipe.start === elbow && recipe.emit.lane === salvo[index][0] && recipe.emit.timing === salvo[index][1]) {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        out.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            elbow: false,
                        });
                    }
                }
            }
            if (index === salvo.length && forceEndElbow === false) {
                for (let recipe of destroyRecipes) {
                    if (recipe.start === elbow) {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        out.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            elbow: false,
                        });
                    }
                }
            }
        }
        prevLayer = nextLayer;
    }
    if (out.length === 0) {
        throw new Error('No recipes found!');
    }
    let best = out[0];
    for (let recipe of out.slice(1)) {
        if (recipe.time < best.time) {
            best = recipe;
        }
    }
    let recipe = mergeChannelRecipes(info, ...best.recipes);
    let time = 0;
    for (let [spacing] of recipe) {
        time += spacing;
    }
    return {
        recipe,
        time,
        elbow: best.elbow,
    };
}
