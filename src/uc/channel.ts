
import * as fs from 'node:fs/promises';
import {Worker} from 'node:worker_threads';
import {MAPPattern} from '../core/index.js';
import {c, ChannelInfo, log, base, gliderPatterns, Vertex, dijkstra, unparseChannelRecipe, objectsToString, RecipeData, loadRecipes, saveRecipes} from './base.js';
import type {findChannelResults} from './channel_searcher.js';


/** Turns a single-channel sequence into a `Pattern`. */
export function createChannelPattern(info: ChannelInfo, recipe: [number, number][]): {p: MAPPattern, xPos: number, yPos: number, total: number} {
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
    let target = base.loadApgcode(info.start.apgcode).shrinkToFit();
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + info.start.spacing;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - info.start.lane + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    total += c.GLIDER_TARGET_SPACING;
    return {p, xPos, yPos, total};
}


function addChannelSearchData(info: ChannelInfo, data: RecipeData['channels'][string], out: RecipeData['channels'][string]): void {
    for (let recipe of data.moveRecipes) {
        let index = out.moveRecipes.findIndex(x => x.move === recipe.move);
        let entry = out.moveRecipes[index];
        if (entry === undefined) {
            console.log(`\x1b[92mNew recipe: move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.moveRecipes.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.moveRecipes.splice(index, 1);
            out.moveRecipes.push(recipe);
        }
    }
    for (let recipe of data.recipes90Deg) {
        let index = out.recipes90Deg.findIndex(x => x.lane === recipe.lane && x.ix === recipe.ix && x.move === recipe.move && x.timing === recipe.timing);
        let entry = out.recipes90Deg[index];
        if (entry === undefined) {
            console.log(`\x1b[92mNew recipe: 90 degree emit ${recipe.lane}${recipe.ix} timing ${recipe.timing} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.recipes90Deg.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): 90 degree emit ${recipe.lane}${recipe.ix}  timing ${recipe.timing} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.recipes90Deg.splice(index, 1);
            out.recipes90Deg.push(recipe);
        }
    }
    for (let recipe of data.recipes0Deg) {
        let index = out.recipes0Deg.findIndex(x => x.lane === recipe.lane && x.move === recipe.move && x.timing === recipe.timing);
        let entry = out.recipes0Deg[index];
        if (entry === undefined) {
            console.log(`\x1b[92mNew recipe: 0 degree emit ${recipe.lane} timing ${recipe.timing} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.recipes0Deg.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[92mImproved recipe (${entry.time} to ${recipe.time}): 0 degree emit ${recipe.lane} timing ${recipe.timing} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.recipes0Deg.splice(index, 1);
            out.recipes0Deg.push(recipe);
        }
    }
    if (data.destroyRecipe) {
        if (!out.destroyRecipe) {
            out.destroyRecipe = data.destroyRecipe;
            console.log(`\x1b[94mNew recipe: destroy: ${unparseChannelRecipe(info, out.destroyRecipe.recipe)}\x1b[0m`);
        } else if (out.destroyRecipe.time > data.destroyRecipe.time) {
            out.destroyRecipe = data.destroyRecipe;
            console.log(`\x1b[94mImproved recipe (${out.destroyRecipe.time} to ${data.destroyRecipe.time}): destroy: ${unparseChannelRecipe(info, out.destroyRecipe.recipe)}\x1b[0m`);
        }
    }
    for (let recipe of data.recipes90DegDestroy) {
        let index = out.recipes90DegDestroy.findIndex(x => x.lane === recipe.lane && x.ix === recipe.ix && x.timing === recipe.timing);
        let entry = out.recipes90DegDestroy[index];
        if (entry === undefined) {
            console.log(`\x1b[94mNew recipe: 90 degree emit ${recipe.lane}${recipe.ix} timing ${recipe.timing} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.recipes90DegDestroy.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 90 degree emit ${recipe.lane}${recipe.ix} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.recipes90DegDestroy.splice(index, 1);
            out.recipes90DegDestroy.push(recipe);
        }
    }
    for (let recipe of data.recipes0DegDestroy) {
        let index = out.recipes0DegDestroy.findIndex(x => x.lane === recipe.lane && x.timing === recipe.timing);
        let entry = out.recipes0DegDestroy[index];
        if (entry === undefined) {
            console.log(`\x1b[94mNew recipe: 0 degree emit ${recipe.lane} timing ${recipe.timing} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.recipes0DegDestroy.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[94mImproved recipe (${entry.time} to ${recipe.time}): 0 degree emit ${recipe.lane} timing ${recipe.timing} destroy: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.recipes0DegDestroy.splice(index, 1);
            out.recipes0DegDestroy.push(recipe);
        }
    }
    for (let recipe of data.createHandRecipes) {
        let index = out.createHandRecipes.findIndex(x => x.obj.code === recipe.obj.code && x.obj.x === recipe.obj.x && x.obj.y === recipe.obj.y && x.move === recipe.move);
        let entry = out.createHandRecipes[index];
        if (entry === undefined) {
            console.log(`\x1b[95mNew recipe: create ${objectsToString([recipe.obj])} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            out.createHandRecipes.push(recipe);
        } else if (entry.time > recipe.time) {
            console.log(`\x1b[95mImproved recipe (${entry.time} to ${recipe.time}): create ${objectsToString([recipe.obj])} move ${recipe.move}: ${unparseChannelRecipe(info, recipe.recipe)}\x1b[0m`);
            entry.recipe = recipe.recipe;
            entry.time = recipe.time;
            out.createHandRecipes.splice(index, 1);
            out.createHandRecipes.push(recipe);
        }
    }
}

/** Performs a restricted-channel search. */
export async function searchChannel(type: string, threads: number, maxSpacing: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await loadRecipes();
    let out = recipes.channels[type];
    let filter = new Set<string>();
    let depth = 0;
    let workers: Worker[] = [];
    for (let i = 0; i < threads; i++) {
        workers.push(new Worker(`${import.meta.dirname}/channel_searcher.js`));
    }
    while (true) {
        log(`Searching depth ${depth}`);
        let start = performance.now();
        let recipeCount = 0;
        let finished: ReturnType<typeof findChannelResults>[] = [];
        let starts: [number, number][][] = [];
        for (let a = info.minSpacing; a < maxSpacing; a++) {
            for (let b = 0; b < info.channels.length; b++) {
                for (let c = info.minSpacing; c < maxSpacing; c++) {
                    for (let d = 0; d < info.channels.length; d++) {
                        if (a + c > depth || c < info.minSpacings[b][d] || (info.excludeSpacings && info.excludeSpacings[b][d].includes(c))/* || filter.has(`${a}:${b} ${c}:${d}`)*/) {
                            continue;
                        }
                        starts.push([[a, b], [c, d]]);
                    }
                }
            }
        }
        let startedCount = 0;
        let finishedCount = 0;
        let checkedRecipes = 0;
        for (let i = 0; i < threads; i++) {
            let starts2 = starts.filter((_, j) => j % threads === i);
            let worker = workers[i];
            worker.removeAllListeners('message');
            worker.on('message', ([type, data]) => {
                if (type === 'starting') {
                    recipeCount += data;
                    startedCount++;
                    if (startedCount === threads) {
                        log(`Checking ${recipeCount} recipes`);
                    }
                } else if (type === 'update') {
                    checkedRecipes += data.count;
                    addChannelSearchData(info, data.out, out);
                } else if (type === 'completed') {
                    finished.push(data);
                    finishedCount++;
                    if (finishedCount === threads) {
                        clearInterval(interval);
                        resolve();
                    }
                } else {
                    throw new Error(`Invalid Worker message type: '${type}'`);
                }
            });
            worker.postMessage({info, depth, maxSpacing, filter, starts: starts2});
        }
        let {promise, resolve} = Promise.withResolvers<void>();
        let interval = setInterval(() => {
            if (startedCount === threads && checkedRecipes > 0 && recipeCount > 0) {
                log(`${checkedRecipes - 1}/${recipeCount} (${((checkedRecipes - 1) / recipeCount * 100).toFixed(3)}%) recipes checked`);
            }
            }, 3100);
        await promise;
        let possibleUseful = '';
        for (let data of finished) {
            addChannelSearchData(info, data.data, out);
            possibleUseful += data.possibleUseful;
            for (let key of data.newFilter) {
                filter.add(key);
            }
        }
        let time = (performance.now() - start) / 1000;
        log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second)`);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n` + possibleUseful);
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
                i++;
                while (recipe[i][1] < 0 && i < recipe.length) {
                    if (recipe[i][0] !== -1) {
                        spacing += recipe[i][0];
                    }
                    i++;
                }
                if (i < recipe.length) {
                    channel = recipe[i][1];
                }
            }
        } else {
            if (lastUses[channel] < info.minSpacings[channel][channel] || (info.excludeSpacings && info.excludeSpacings[channel][channel].includes(lastUses[channel]))) {
                throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]}`);
            }
            if (prevChannel && (spacing < info.minSpacings[prevChannel][channel] || (info.excludeSpacings && info.excludeSpacings[prevChannel][channel].includes(spacing)))) {
                throw new Error(`Invalid restricted-channel sequence, channel ${channel} used again after ${lastUses[channel]}`);
            }
            for (let j = 0; j < info.channels.length; j++) {
                lastUses[channel] += spacing;
            }
            lastUses[channel] = 0;
        }
        out.push([spacing, channel]);
        prevChannel = channel;
    }
    return out;
}


/** Turns a slow salvo into a restricted-channel synthesis using a 90-degree elbow. */
/** Turns a slow salvo into a restricted-channel synthesis using a 0-degree elbow. */


/** Turns a slow salvo into a restricted-channel synthesis using a 90-degree elbow and Dijkstra's algorithm. */
export function salvoToChannel90DegDijkstra(type: string, recipes: RecipeData, salvo: [number, number][], ix: 'i' | 'x', depth: number, forceEndElbow?: false | number): {recipe: [number, number][], time: number, move: number} {
    let info = c.CHANNEL_INFO[type];
    type T = [[number, number][], number];
    let data = recipes.channels[type];
    let startVertex: Vertex<T> = [];
    let graph: Vertex<T>[] = [startVertex, []];
    let prevLayer: {elbowPos: number, index: number, currentTiming: number, vertex: Vertex<T>}[] = [{elbowPos: 0, index: 0, currentTiming: 0, vertex: startVertex}];
    for (let i = 0; i < depth; i++) {
        for (let {elbowPos, index, currentTiming, vertex} of prevLayer) {
            let [lane, timing] = salvo[index];
            if (index === salvo.length - 1) {
                if (forceEndElbow === false) {
                    for (let recipe of data.recipes90DegDestroy) {
                        if (elbowPos + recipe.lane !== lane || (c.GLIDER_SLOPE !== 0 && (elbowPos % 2 ? recipe.ix === ix : recipe.ix !== ix))) {
                            continue;
                        }
                        if (timing === -1) {
                            vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                        } else {
                            let newTiming = (currentTiming + recipe.timing) % info.period;
                            if (timing === newTiming) {
                                vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                            } else {
                                let adjust = timing - newTiming;
                                if (adjust < 0) {
                                    adjust += info.period;
                                }
                                vertex.push([1, recipe.time, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), 0]]);
                            }
                        }
                    }
                } else {
                    for (let recipe of data.recipes90Deg) {
                        if (elbowPos + recipe.lane !== lane || (c.GLIDER_SLOPE !== 0 && (elbowPos % 2 ? recipe.ix === ix : recipe.ix !== ix))) {
                            continue;
                        }
                        let newElbowPos = elbowPos + recipe.move;
                        if (forceEndElbow !== undefined) {
                            if (newElbowPos !== forceEndElbow) {
                                let moveAmount = forceEndElbow - newElbowPos;
                                let moveRecipe = data.moveRecipes.find(x => x.move === moveAmount);
                                if (moveRecipe) {
                                    if (timing === -1) {
                                        vertex.push([1, recipe.time + moveRecipe.time, [recipe.recipe.concat(moveRecipe.recipe), forceEndElbow]]);
                                    } else {
                                        let newTiming = (currentTiming + recipe.timing) % info.period;
                                        if (timing === newTiming) {
                                            vertex.push([1, recipe.time + moveRecipe.time, [recipe.recipe.concat(moveRecipe.recipe), forceEndElbow]]);
                                        } else {
                                            let adjust = timing - newTiming;
                                            if (adjust < 0) {
                                                adjust += info.period;
                                            }
                                            vertex.push([1, recipe.time + adjust + moveRecipe.time, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe, moveRecipe.recipe), forceEndElbow]]);
                                        }
                                    }
                                }
                            }
                        } else {
                            if (timing === -1) {
                                vertex.push([1, recipe.time, [recipe.recipe, newElbowPos]]);
                            } else {
                                let newTiming = (currentTiming + recipe.timing) % info.period;
                                if (timing === newTiming) {
                                    vertex.push([1, recipe.time, [recipe.recipe, newElbowPos]]);
                                } else {
                                    let adjust = timing - newTiming;
                                    if (adjust < 0) {
                                        adjust += info.period;
                                    }
                                    vertex.push([1, recipe.time + adjust, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), newElbowPos]]);
                                }
                            }
                        }
                    }
                }
            } else {
                console.log('hi', data.recipes90Deg.length);
                for (let recipe of data.recipes90Deg) {
                    if (elbowPos + recipe.lane !== lane || (c.GLIDER_SLOPE !== 0 && (elbowPos % 2 ? recipe.ix === ix : recipe.ix !== ix))) {
                        continue;
                    }
                    console.log(recipe);
                    let newVertex: Vertex<T> = [];
                    let newElbowPos = elbowPos + recipe.move;
                    vertex.push([graph.length, recipe.time, [recipe.recipe, newElbowPos]]);
                    graph.push(newVertex);
                    let newTiming = (currentTiming + recipe.timing) % info.period;
                    if (timing === -1) {
                        vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                        prevLayer.push({elbowPos: newElbowPos, index: index + 1, currentTiming: newTiming, vertex: newVertex});
                    } else {
                        if (timing === newTiming) {
                            vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                            prevLayer.push({elbowPos: newElbowPos, index: index + 1, currentTiming: newTiming, vertex: newVertex});
                        } else {
                            let adjust = timing - newTiming;
                            if (adjust < 0) {
                                adjust += info.period;
                            }
                            vertex.push([1, recipe.time + adjust, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), newElbowPos]]);
                            prevLayer.push({elbowPos: newElbowPos, index: index + 1, currentTiming: newTiming + adjust, vertex: newVertex});
                        }
                    }
                }
                for (let recipe of data.moveRecipes) {
                    let newVertex: Vertex<T> = [];
                    let newElbowPos = elbowPos + recipe.move;
                    vertex.push([graph.length, recipe.time, [recipe.recipe, newElbowPos]]);
                    graph.push(newVertex);
                    prevLayer.push({elbowPos: newElbowPos, index: index + 1, currentTiming: (currentTiming + recipe.time) % info.period, vertex: newVertex});
                }
            }
        }
    }
    let edges = 0;
    for (let vertex of graph) {
        edges += vertex.length;
    }
    console.log(`Got problem, ${graph.length} vertices, ${edges} edges`);
    let path = dijkstra(graph, 1);
    let out: [number, number][][] = [];
    let move: number | undefined = undefined;
    for (let i = 0; i < path.length; i++) {
        let [vertex, edge] = path[i];
        let data = graph[vertex][edge][2];
        out.push(data[0]);
        if (i === path.length - 1) {
            move = data[1];
        }
    }
    if (!move) {
        throw new Error('Missing move (there is a bug)!');
    }
    let recipe = mergeChannelRecipes(info, ...out);
    let time = 0;
    for (let [spacing] of recipe) {
        time += spacing;
    }
    return {recipe, time, move};
}

/** Turns a slow salvo into a restricted-channel synthesis using a 0-degree elbow and Dijkstra's algorithm. */
export function salvoToChannel0DegDijkstra(type: string, recipes: RecipeData, salvo: [number, number][], minElbow?: number, maxElbow?: number, forceEndElbow?: false | number): {recipe: [number, number][], time: number, move: number} {
    let info = c.CHANNEL_INFO[type];
    type T = [[number, number][], number];
    let data = recipes.channels[type];
    let startVertex: Vertex<T> = [];
    let graph: Vertex<T>[] = [startVertex, []];
    let prevLayer: {elbowPos: number, currentTiming: number, vertex: Vertex<T>}[] = [{elbowPos: 0, currentTiming: 0, vertex: startVertex}];
    for (let i = 0; i < salvo.length; i++) {
        let [lane, timing] = salvo[i];
        for (let {elbowPos, currentTiming, vertex} of prevLayer) {
            if (i === salvo.length - 1) {
                if (forceEndElbow === false) {
                    for (let recipe of data.recipes0DegDestroy) {
                        if (lane !== ((c.GLIDER_SLOPE !== 0 && elbowPos % 2 === 1) ? -recipe.lane : recipe.lane)) {
                            continue;
                        }
                        if (timing === -1) {
                            vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                        } else {
                            let newTiming = (currentTiming + recipe.timing) % info.period;
                            if (timing === newTiming) {
                                vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                            } else {
                                let adjust = timing - newTiming;
                                if (adjust < 0) {
                                    adjust += info.period;
                                }
                                vertex.push([1, recipe.time, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), 0]]);
                            }
                        }
                    }
                } else {
                    for (let recipe of data.recipes0Deg) {
                        if (lane !== ((c.GLIDER_SLOPE !== 0 && elbowPos % 2 === 1) ? -recipe.lane : recipe.lane)) {
                            continue;
                        }
                        let newElbowPos = elbowPos + recipe.move;
                        if (forceEndElbow !== undefined) {
                            if (newElbowPos !== forceEndElbow) {
                                let moveAmount = forceEndElbow - newElbowPos;
                                let moveRecipe = data.moveRecipes.find(x => x.move === moveAmount);
                                if (moveRecipe) {
                                    if (timing === -1) {
                                        vertex.push([1, recipe.time + moveRecipe.time, [recipe.recipe.concat(moveRecipe.recipe), forceEndElbow]]);
                                    } else {
                                        let newTiming = (currentTiming + recipe.timing) % info.period;
                                        if (timing === newTiming) {
                                            vertex.push([1, recipe.time + moveRecipe.time, [recipe.recipe.concat(moveRecipe.recipe), forceEndElbow]]);
                                        } else {
                                            let adjust = timing - newTiming;
                                            if (adjust < 0) {
                                                adjust += info.period;
                                            }
                                            vertex.push([1, recipe.time + adjust + moveRecipe.time, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe, moveRecipe.recipe), forceEndElbow]]);
                                        }
                                    }
                                }
                            }
                        } else {
                            if (timing === -1) {
                                vertex.push([1, recipe.time, [recipe.recipe, newElbowPos]]);
                            } else {
                                let newTiming = (currentTiming + recipe.timing) % info.period;
                                if (timing === newTiming) {
                                    vertex.push([1, recipe.time, [recipe.recipe, newElbowPos]]);
                                } else {
                                    let adjust = timing - newTiming;
                                    if (adjust < 0) {
                                        adjust += info.period;
                                    }
                                    vertex.push([1, recipe.time + adjust, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), newElbowPos]]);
                                }
                            }
                        }
                    }
                }
            } else {
                for (let recipe of data.recipes0Deg) {
                    if (lane !== ((c.GLIDER_SLOPE !== 0 && elbowPos % 2 === 1) ? -recipe.lane : recipe.lane)) {
                        continue;
                    }
                    let newVertex: Vertex<T> = [];
                    let newElbowPos = elbowPos + recipe.move;
                    vertex.push([graph.length, recipe.time, [recipe.recipe, newElbowPos]]);
                    graph.push(newVertex);
                    let newTiming = (currentTiming + recipe.timing) % info.period;
                    if (timing === -1) {
                        vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                        prevLayer.push({elbowPos: newElbowPos, currentTiming: newTiming, vertex: newVertex});
                    } else {
                        if (timing === newTiming) {
                            vertex.push([1, recipe.time, [recipe.recipe, 0]]);
                            prevLayer.push({elbowPos: newElbowPos, currentTiming: newTiming, vertex: newVertex});
                        } else {
                            let adjust = timing - newTiming;
                            if (adjust < 0) {
                                adjust += info.period;
                            }
                            vertex.push([1, recipe.time + adjust, [([[adjust, -1]] as [number, number][]).concat(recipe.recipe), newElbowPos]]);
                            prevLayer.push({elbowPos: newElbowPos, currentTiming: newTiming + adjust, vertex: newVertex});
                        }
                    }
                }
            }
        }
    }
    let path = dijkstra(graph, 1);
    let out: [number, number][][] = [];
    let move: number | undefined = undefined;
    for (let i = 0; i < path.length; i++) {
        let [vertex, edge] = path[i];
        let data = graph[vertex][edge][2];
        out.push(data[0]);
        if (i === path.length - 1) {
            move = data[1];
        }
    }
    if (!move) {
        throw new Error('Missing move (there is a bug)!');
    }
    let recipe = mergeChannelRecipes(info, ...out);
    let time = 0;
    for (let [spacing] of recipe) {
        time += spacing;
    }
    return {recipe, time, move};
}
