
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {lcm, MAPPattern} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, log, base, shipPatterns, channelRecipeToString, CAObject, normalizeOscillator, xyCompare, objectsToString, ShipInfo, ElbowData, ChannelRecipe, channelRecipeInfoToString, RecipeData, loadRecipes, saveRecipes} from './base.js';
import {findOutcome} from './runner.js';
import {patternToSalvo, getCollision} from './slow_salvos.js';
import {runInjection, resolveElbow, findChannelResults} from './channel_searcher.js';


/** Turns a single-channel sequence into a `Pattern`. */
export function createChannelPattern(info: ChannelInfo, elbow: string | [string, number], recipe: [number, number][]): {p: MAPPattern, xPos: number, yPos: number, total: number} {
    if (typeof elbow === 'string') {
        let parts = elbow.split('/');
        elbow = [parts[0].slice(parts[0].indexOf('_') + 1), parseInt(parts[1])];
    }
    let phaseOffset = 0;
    for (let [spacing] of recipe) {
        phaseOffset += spacing;
    }
    phaseOffset = (info.ship.period - (phaseOffset % info.ship.period)) % info.ship.period;
    let p = base.copy();
    let total = 0;
    let timingOffset = 0;
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
        let y = Math.floor(total * info.ship.dy / info.ship.period);
        if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
            y++;
        }
        let x = Math.floor(y * info.ship.slope) + info.channels[channel];
        let q = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period].copy();
        p.ensure(x + q.width, y + q.height);
        p.insert(q, x, y);
        total += timing;
    }
    let y = Math.floor(total * info.ship.dy / info.ship.period);
    if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
        y++;
    }
    let x = Math.floor(y * info.ship.slope);
    if (recipe.length > 0 && info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    let q = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period];
    p.ensure(x + q.width, y + q.height);
    p.insert(q, x, y);
    let target = base.loadApgcode(elbow[0]).shrinkToFit();
    if (timingOffset > 0) {
        target.run(timingOffset).shrinkToFit();
    }
    let yPos = Math.floor(total * info.ship.dy / info.ship.period) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
    if (xPos < 0) {
        yPos -= Math.floor(xPos * info.ship.slope);
        xPos = 0;
    }
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    total += c.GLIDER_TARGET_SPACING;
    return {p, xPos, yPos, total};
}


function checkElbow(info: ChannelInfo, elbows: ElbowData, badElbows: Set<string>, elbow: string, elbowData: [string, number]): undefined | ElbowData['string'] {
    let period = 1;
    if (elbow.startsWith('xp')) {
        period = parseInt(elbow.slice(2));
    }
    let out: ElbowData[string] = [];
    for (let timing = 0; timing < period; timing++) {
        let isSame = true;
        let prevResult: string | null = null;
        for (let i = 0; i < 3; i++) {
            let p = runInjection(info, elbowData, [[info.minSpacing + timing + i * period, 0]]);
            // console.log(p.toRLE());
            let objs = findOutcome(p, true);
            if (typeof objs !== 'object') {
                return;
            }
            for (let obj of objs) {
                if (obj.type === 'ship') {
                    obj.x = Math.floor(obj.y * info.ship.slope) - obj.x;
                    obj.y = 0;
                    obj.timing = 0;
                } else if (obj.type === 'osc') {
                    obj.timing = 0;
                }
            }
            let result = objectsToString(objs);
            // throw new Error(result);
            if (prevResult && result !== prevResult) {
                isSame = false;
                break;
            }
            prevResult = result;
        }
        let result = getCollision(info, elbowData[0], elbowData[1], timing, undefined, true);
        if (typeof result !== 'object') {
            out.push({type: 'bad'});
            continue;
        }
        if (!isSame) {
            // console.log('results are not the same');
            let codeStr = result.map(x => x.code).sort().join(' ');
            for (let [key, value] of Object.entries(elbows)) {
                if (elbow === key) {
                    continue;
                }
                for (let data of value) {
                    if (data.type === 'normal') {
                        if (result.length !== data.result.length) {
                            continue;
                        }
                        let result2: CAObject[] = [];
                        let flipped = false;
                        if (codeStr === data.result.map(x => x.code).sort().join(' ')) {
                            result2 = data.result;
                        } else if (codeStr === data.flippedResult.map(x => x.code).sort().join(' ')) {
                            result2 = data.flippedResult;
                            flipped = true;
                        } else {
                            continue;
                        }
                        result2 = result2.filter(x => x.type === 'sl' || x.type === 'osc').sort(xyCompare);
                        if (!result[0] || !result2[0] || result[0].code !== result2[0].code) {
                            continue;
                        }
                        let xDiff = result[0].x - result2[0].x;
                        let yDiff = result[0].x - result2[0].x;
                        if (xDiff !== yDiff * info.ship.slope) {
                            continue;
                        }
                        let found2 = false;
                        for (let i = 1; i < result.length; i++) {
                            let obj = result[i];
                            let obj2 = result2[i];
                            if (obj.code !== obj2.code || obj.x - obj2.x !== xDiff || obj.y - obj2.y !== yDiff) {
                                found2 = true;
                                break;
                            }
                        }
                        if (!found2) {
                            let timing = (result[0].type === 'osc' ? result[0].timing : 0) - (result2[0].type === 'osc' ? result2[0].timing : 0);
                            out.push({type: 'alias', elbow: key, flipped, move: yDiff, timing});
                        }
                    }
                }
            }
            let flippedResult = getCollision(info, elbowData[0], elbowData[1], timing, true, true);
            if (typeof flippedResult !== 'object') {
                out.push({type: 'bad'});
                continue;
            }
            out.push({type: 'normal', time: 0, result, flippedResult});
        } else {
            if (result.length === 0) {
                out.push({type: 'destroy'});
            } else if (result.length === 1) {
                let obj = result[0];
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj);
                }
                let lane = Math.floor(obj.y * info.ship.slope) - obj.x + elbowData[1];
                let spacing = Math.floor(obj.x * info.ship.slope) + obj.y;
                let str = `${obj.code}/${lane}`;
                if (!info.ship.glideSymmetric) {
                    out.push({type: 'convert', elbow: str, flipped: false, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing});
                    continue;
                }
                let p = createChannelPattern(info, [obj.code.slice(obj.code.indexOf('_') + 1), lane], []).p;
                p.flipDiagonal();
                let data = patternToSalvo({ship: info.ship, period: 1}, p);
                let flippedStr = `${data[0]}/${data[1][0][0]}`;
                if (badElbows.has(str)) {
                    if (!badElbows.has(flippedStr)) {
                        // console.log('adding flipped');
                        badElbows.add(flippedStr);
                    }
                    out.push({type: 'bad'});
                    continue;
                }
                if (badElbows.has(flippedStr)) {
                    if (!badElbows.has(str)) {
                        // console.log('adding flipped');
                        badElbows.add(str);
                    }
                    out.push({type: 'bad'});
                    continue;
                }
                if (flippedStr in elbows) {
                    out.push({type: 'convert', elbow: flippedStr, flipped: true, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing});
                } else {
                    out.push({type: 'convert', elbow: str, flipped: false, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing});
                }
            } else {
                out.push({type: 'bad'});
            }
        }
    }
    // if (elbow === 'xs4_33/7') {
    //     console.log(out);
    //     throw new Error('haiiii');
    // }
    return out;
}

function addElbow(info: ChannelInfo, elbow: string, data: RecipeData['channels'][string], depth: number = 0): undefined | false | ElbowData {
    if (elbow in data.elbows || data.badElbows.has(elbow)) {
        return;
    }
    let elbowParts = elbow.split('/');
    let elbowData: [string, number] = [elbowParts[0].slice(elbowParts[0].indexOf('_') + 1), parseInt(elbowParts[1])];
    let result = checkElbow(info, data.elbows, data.badElbows, elbow, elbowData);
    if (!result || result.every(x => x.type === 'bad')) {
        data.badElbows.add(elbow);
        return false;
    }
    // console.log(result);
    let out: ElbowData = {[elbow]: result};
    for (let value of result) {
        if ((value.type === 'alias' || value.type === 'convert') && !(value.elbow in data.elbows)) {
            if (depth === 16) {
                return;
            }
            let newOut = addElbow(info, value.elbow, data, depth + 1);
            if (newOut === undefined) {
                continue;
            } else if (newOut === false || Object.values(newOut).every(x => x.every(y => y.type === 'bad'))) {
                data.badElbows.add(elbow);
                data.badElbows.add(value.elbow);
                return false;
            } else {
                Object.assign(out, newOut);
            }
        }
    }
    return out;
}

function expandRecipes(info: ChannelInfo, recipes: ChannelRecipe[]): ChannelRecipe[] {
    let out: ChannelRecipe[] = [];
    for (let recipe of recipes) {
        let period = 1;
        if (recipe.emit && info.period > 1) {
            period = lcm(period, info.period);
        }
        if (recipe.end && recipe.end.elbow.startsWith('xp')) {
            period = lcm(period, recipe.end.period);
        }
        if (recipe.create && recipe.create.type === 'osc') {
            period = lcm(period, recipe.create.period);
        }
        out.push(recipe);
        if (period > 1) {
            for (let i = 1; i < period; i++) {
                let recipe2 = structuredClone(recipe);
                recipe2.recipe.unshift([i, -2]);
                recipe2.time += i;
                if (recipe2.emit && info.period > 1) {
                    for (let ship of recipe2.emit) {
                        ship.timing = (ship.timing + i) % info.period;
                    }
                }
                if (recipe2.end && recipe2.end.elbow.startsWith('xp')) {
                    recipe2.end.timing = (recipe2.end.timing + i) % recipe2.end.period;
                }
                if (recipe2.create && recipe2.create.type === 'osc') {
                    recipe2.create.timing = (recipe2.create.timing + i) % recipe2.create.period;
                }
                out.push(recipe2);
            }
        }
    }
    return out;
}

function addNewRecipes(info: ChannelInfo, data: {recipes: ChannelRecipe[], newElbows: string[]}, out: RecipeData['channels'][string]): string {
    for (let elbow of data.newElbows) {
        let value = addElbow(info, elbow, out);
        if (value) {
            for (let key in value) {
                if (key in out.elbows) {
                    throw new Error(`Attempted overwrite: ${key} (there is a bug)`);
                }
                out.elbows[key] = value[key];
            }
        }
    }
    let possibleUseful = '';
    let recipes: ChannelRecipe[] = [];
    for (let recipe of data.recipes) {
        if (recipe.end && data.newElbows.includes(recipe.end.elbow)) {
            let value = resolveElbow(info, out.elbows, out.badElbows, recipe);
            recipes.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        } else {
            recipes.push(recipe);
        }
    }
    // if (data.recipes.length > 0) {
    //     console.log(recipes);
    //     throw new Error('hi');
    // }
    recipes = expandRecipes(info, recipes);
    for (let recipe of recipes) {
        if (recipe.end && out.badElbows.has(recipe.end.elbow)) {
            continue;
        }
        let key = channelRecipeInfoToString(recipe);
        if (key in out.recipes && out.recipes[key].time <= recipe.time) {
            continue;
        }
        let color: string;
        if (recipe.end) {
            if (recipe.create) {
                if (recipe.emit) {
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
        console.log(`\x1b[${color}m${key in out.recipes ? 'Improved' : 'New'} recipe: ${key}: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
        out.recipes[key] = recipe;
    }
    return possibleUseful;
}

/** Performs a restricted-channel search. */
export async function searchChannel(type: string, threads: number, elbow: string, elbowTiming: number, maxSpacing: number, recipesOverride?: [number, number][][]): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let msg = `\n${type} search in ${base.ruleStr} with elbow ${elbow}, max spacing ${maxSpacing}, and max generations ${maxGenerations}:\n`;
    if (existsSync('possible_useful.txt')) {
        let stat = await fs.stat('possible_useful.txt');
        if (stat.size > 0) {
            msg = '\n' + msg;
        }
        await fs.appendFile('possible_useful.txt', msg);
    } else {
        await fs.writeFile('possible_useful.txt', msg);
    }
    let starts: [number, number][][] = [];
    if (recipesOverride) {
        starts = recipesOverride;
    } else {
        for (let a = info.minSpacing; a <= maxSpacing; a++) {
            for (let b = 0; b < info.channels.length; b++) {
                starts.push([[a, b]]);
                for (let c = info.minSpacing; c <= maxSpacing; c++) {
                    for (let d = 0; d < info.channels.length; d++) {
                        if (c < info.minSpacings[b][d] || (info.excludeSpacings && info.excludeSpacings[b][d].includes(c))) {
                            continue;
                        }
                        starts.push([[a, b], [c, d]]);
                        for (let e = info.minSpacing; e <= maxSpacing; e++) {
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
        if (info.forceStart) {
            for (let start of starts) {
                start.unshift(...info.forceStart);
            }
        }
        console.log(`Compiled ${starts.length} starts`);
    }
    let workers: Worker[] = [];
    for (let i = 0; i < threads; i++) {
        let path: string;
        if (typeof window === 'object' && window === globalThis) {
            path = `./channel_searcher.js`;
        } else {
            // @ts-ignore
            path = `${import.meta.dirname}/channel_searcher.js`;
        }
        workers.push(await new Worker(path, {workerData: {
            info,
            maxGenerations,
            starts: starts.filter((_, j) => j % threads === i),
        }}));
    }
    let recipes = await loadRecipes();
    let out = recipes.channels[type];
    if (!(elbow in out.elbows)) {
        let value = addElbow(info, elbow, out);
        if (value) {
            for (let key in value) {
                if (key in out.elbows) {
                    throw new Error(`Attempted overwrite: ${key} (there is a bug)`);
                }
                out.elbows[key] = value[key];
            }
        }
    }
    let depth = info.minSpacing;
    while (true) {
        if (!recipesOverride) {
            await log(`Searching depth ${depth}`);
        }
        let start = performance.now();
        let recipeCount = 0;
        let possibleUseful = '';
        let finished: ReturnType<typeof findChannelResults>[] = [];
        let startedCount = 0;
        let finishedCount = 0;
        let checkedRecipes = 0;
        let timeout: NodeJS.Timeout | null = null;
        let interval: NodeJS.Timeout | null = null;
        let {promise, resolve} = Promise.withResolvers<void>();
        for (let worker of workers) {
            worker.removeAllListeners('message');
            worker.on('message', async ([type, data]) => {
                if (type === 'starting') {
                    recipeCount += data;
                    startedCount++;
                    if (startedCount === threads) {
                        await log(`Checking ${recipeCount} recipes`);
                        timeout = setTimeout(() => {
                            interval = setInterval(async () => {
                                if (!(typeof window === 'object' && window === globalThis) && startedCount === threads && checkedRecipes > 0 && recipeCount > 0) {
                                    await log(`${checkedRecipes - 1}/${recipeCount} (${((checkedRecipes - 1) / recipeCount * 100).toFixed(3)}%) recipes checked`);
                                    await saveRecipes(recipes);
                                }
                            }, 10000);
                        }, 2500);
                    }
                } else if (type === 'update') {
                    checkedRecipes += data.count;
                    possibleUseful += addNewRecipes(info, data, out);
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
            worker.postMessage({elbows: out.elbows, badElbows: out.badElbows, elbow, elbowTiming, depth, maxSpacing, recipesOverride: Boolean(recipesOverride)});
        }
        await promise;
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        if (interval !== null) {
            clearInterval(interval);
        }
        for (let data of finished) {
            possibleUseful += data.possibleUseful;
            possibleUseful += addNewRecipes(info, data, out);
        }
        let time = (performance.now() - start) / 1000;
        await log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${(recipeCount / time).toFixed(3)} recipes/second)`);
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n${possibleUseful}`);
        }
        depth++;
        if (recipesOverride) {
            process.exit(0);
        }
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
export function salvoToChannel(info: ChannelInfo, recipeData: RecipeData['channels'][string], startElbow: string, salvo: [number, number][], dir: c.ShipDirection, depth?: number, beam?: number, forceEndElbow?: false | number, minElbow?: number, maxElbow?: number): {recipe: [number, number][], time: number, elbow: false | [string, number]} {
    let prevLayer: RecipeProgress[] = [{recipes: [], time: 0, index: 0, elbow: startElbow, elbowPos: 0}];
    let moveRecipes: (ChannelRecipe & {end: {}})[] = [];
    let emitRecipes: (ChannelRecipe & {end: {}, emit: {}})[] = [];
    let emitDestroyRecipes: (ChannelRecipe & {emit: {}})[] = [];
    let destroyRecipes: ChannelRecipe[] = [];
    for (let recipe of Object.values(recipeData.recipes)) {
        if (recipe.create) {
            continue;
        }
        if (recipe.end) {
            if (recipe.emit && recipe.emit.length === 1) {
                if (recipe.emit[0].dir === dir) {
                    // @ts-ignore
                    emitRecipes.push(recipe);   
                }
            } else {
                // @ts-ignore
                moveRecipes.push(recipe);
            }
        } else if (recipe.emit && recipe.emit.length === 1) {
            if (recipe.emit[0].dir === dir) {
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
                    if (recipe.start === elbow && recipe.emit[0].lane === salvo[index][0] && recipe.emit[0].timing === salvo[index][1]) {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        let newElbowPos = elbowPos + recipe.end.move;
                        if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                            continue;
                        }
                        if (index + 1 === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                            out.push({
                                recipes: recipes2,
                                time: time + recipe.time,
                                elbow: [recipe.end.elbow, newElbowPos],
                            })
                        } else {
                            let recipes2 = recipes.slice();
                            recipes2.push(recipe.recipe);
                            nextLayer.push({
                                recipes: recipes2,
                                time: time + recipe.time,
                                index: index + 1,
                                elbow: recipe.end.elbow,
                                elbowPos: newElbowPos,
                            })
                        }
                    }
                }
            }
            for (let recipe of moveRecipes) {
                if (recipe.start === elbow) {
                    let recipes2 = recipes.slice();
                    recipes2.push(recipe.recipe);
                    let newElbowPos = elbowPos + recipe.end.move;
                    if ((minElbow !== undefined && newElbowPos < minElbow) || (maxElbow !== undefined && newElbowPos > maxElbow)) {
                        continue;
                    }
                    if (index === salvo.length && (typeof forceEndElbow !== 'number' || forceEndElbow === newElbowPos)) {
                        out.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            elbow: [recipe.end.elbow, newElbowPos],
                        })
                    } else {
                        let recipes2 = recipes.slice();
                        recipes2.push(recipe.recipe);
                        nextLayer.push({
                            recipes: recipes2,
                            time: time + recipe.time,
                            index,
                            elbow: recipe.end.elbow,
                            elbowPos: newElbowPos,
                        })
                    }
                }
            }
            if (index === salvo.length - 1 && forceEndElbow === false) {
                for (let recipe of emitDestroyRecipes) {
                    if (recipe.start === elbow && recipe.emit[0].lane === salvo[index][0] && recipe.emit[0].timing === salvo[index][1]) {
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
        if (beam !== undefined) {
            nextLayer = nextLayer.sort((x, y) => {
                if (x.index < y.index) {
                    return 1;
                } else if (x.index > y.index) {
                    return -1;
                } else {
                    if (x.time < y.time) {
                        return -1;
                    } else if (x.time > y.time) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            });
            nextLayer = nextLayer.slice(0, beam);
        }
        if (nextLayer.length === 0) {
            throw new Error(`Cannot find recipe at depth ${i}!`);
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
