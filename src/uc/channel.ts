
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {Worker} from 'node:worker_threads';
import {lcm, MAPPattern} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, redraw, base, shipPatterns, channelRecipeToString, StableObject, CAObject, normalizeOscillator, xyCompare, objectsToString, ShipInfo, getShipInfo, ElbowData, Elbow, ChannelRecipe, parseElbow, channelRecipeInfoToString, RecipeData, loadRecipes, saveRecipes} from './base.js';
import {findOutcome} from './runner.js';
import {patternToSalvo, getCollision} from './slow_salvos.js';
import {GliderDirection, runInjection, StrRunState, createState, getStringRecipe, resolveElbow, WorkerData, WorkerStartData, WorkerOutput} from './channel_searcher.js';


/** Turns a single-channel sequence into a `Pattern`. */
export function createChannelPattern(info: ChannelInfo, elbow: string | Pick<Elbow, 'code' | 'lane' | 'timing'>, recipe: [number, number, number][]): {p: MAPPattern, xPos: number, yPos: number, total: number} {
    if (typeof elbow === 'string') {
        elbow = parseElbow(elbow);
    }
    let phaseOffset = 0;
    for (let [spacing, channel] of recipe) {
        if (channel !== -1) {
            phaseOffset += spacing;
        }
    }
    phaseOffset = (info.ship.period - (phaseOffset % info.ship.period)) % info.ship.period;
    let p = base.copy();
    let total = 0;
    let timingOffset = elbow.timing;
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
    let target = base.loadApgcode(elbow.code.slice(elbow.code.indexOf('_') + 1)).shrinkToFit();
    if (timingOffset > 0) {
        target.run(timingOffset).shrinkToFit();
    }
    let yPos = Math.floor(total * info.ship.dy / info.ship.period) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * info.ship.slope) - elbow.lane + c.LANE_OFFSET;
    if (xPos < 0) {
        yPos -= Math.floor(xPos * info.ship.slope);
        xPos = 0;
    }
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    total += c.GLIDER_TARGET_SPACING;
    return {p, xPos, yPos, total};
}


function checkElbow(info: ChannelInfo, elbows: ElbowData, elbow: Elbow): undefined | ElbowData['string'] {
    elbow = structuredClone(elbow);
    let elbowObjCode = elbow.code.slice(elbow.code.indexOf('_') + 1);
    let out: ElbowData[string] = [];
    for (let timing = 0; timing < elbow.period; timing++) {
        elbow.timing = timing;
        let result = getCollision(info, elbow.code, elbow.lane, timing, undefined, true);
        if (typeof result !== 'object') {
            if (result === 'no collision') {
                out.push({type: 'no collision'});
            } else {
                out.push({type: 'bad'});
            }
            continue;
        }
        let resultPeriod = 1;
        for (let obj of result) {
            if (obj.type === 'osc') {
                resultPeriod = lcm(resultPeriod, obj.period);
            }
        }
        let isSame = true;
        let results: CAObject[][] = [];
        let prevResult: string | null = null;
        let found = false;
        for (let i = 0; i < 3; i++) {
            let p = runInjection(info, elbow, [[info.minSpacing + i * resultPeriod, 0]]);
            let objs = findOutcome(p, true);
            if (typeof objs !== 'object') {
                found = true;
                break;
            }
            objs = objs.filter(x => x.type === 'sl' || x.type === 'osc').map(obj => {
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj, false);
                }
                return obj;
            });
            results.push(objs);
            let strResult = objectsToString(objs.map(obj => {
                if (obj.type === 'osc') {
                    obj = structuredClone(obj);
                    obj.timing = 0;
                    return obj;
                } else {
                    return obj;
                }
            }));
            if (prevResult && strResult !== prevResult) {
                isSame = false;
            }
            prevResult = strResult;
        }
        if (found) {
            out.push({type: 'bad'});
            continue;
        }
        if (!isSame) {
            results = results.map(x => x.filter(x => x.type === 'sl' || x.type === 'osc').sort(xyCompare));
            let index = 0;
            while (results[index].length === 0) {
                index++;
            }
            let result2 = results[index];
            let found = false;
            let codeStrs = results.map(x => x.map(y => y.code).sort().join(' '));
            for (let [key, value] of Object.entries(elbows)) {
                if (elbow.str === key) {
                    continue;
                }
                for (let data of value) {
                    if (data.type !== 'normal') {
                        continue;
                    }
                    // if (!results.every((x, i) => x.length === data.results[i].length)) {
                    //     console.log(results);
                    //     console.log(data.results);
                    //     console.log(results.map(x => x.length));
                    //     console.log(data.results.map(x => x.length));
                    //     continue;
                    // }
                    let dataResult: CAObject[] = [];
                    let dataResult2: CAObject[] = [];
                    let flipped = false;
                    if (codeStrs.every((x, i) => x === data.results[i].map(x => x.code).sort().join(' '))) {
                        dataResult = data.result;
                        dataResult2 = data.results[index];
                    } else if (info.ship.supportsFlipped && codeStrs.every((x, i) => x === data.flippedResults[i].map(x => x.code).sort().join(' '))) {
                        dataResult = data.flippedResult;
                        dataResult2 = data.flippedResults[index];
                        flipped = true;
                    } else {
                        continue;
                    }
                    dataResult2 = dataResult2.filter(x => x.type === 'sl' || x.type === 'osc').sort(xyCompare);
                    if (result2[0].code !== dataResult2[0].code) {
                        continue;
                    }
                    let xDiff = result2[0].x - dataResult2[0].x;
                    let yDiff = result2[0].y - dataResult2[0].y;
                    let adjustLane = parseInt(key.slice(key.indexOf('/') + 1));
                    let move: number;
                    if (flipped) {
                        let p = createChannelPattern(info, elbow, []).p;
                        p.flipDiagonal();
                        let temp = p.xOffset;
                        p.xOffset = p.yOffset;
                        p.yOffset = temp;
                        let data = patternToSalvo({ship: info.ship, period: 1}, p);
                        adjustLane -= data[1][0][0];
                        if (xDiff !== (yDiff + adjustLane) * info.ship.slope) {
                            continue;
                        }
                        move = yDiff + adjustLane;
                        let q = base.loadApgcode(elbowObjCode).shrinkToFit();
                        for (let i = 0; i < q.size; i += q.width) {
                            if (q.data[i]) {
                                break;
                            }
                            move++;
                        }
                    } else {
                        adjustLane -= elbow.lane;
                        if (xDiff + adjustLane !== yDiff * info.ship.slope) {
                            continue;
                        }
                        move = xDiff + adjustLane;
                        // let p = base.loadApgcode(elbowObjCode).shrinkToFit();
                        // for (let i = 0; i < p.width; i++) {
                        //     if (p.data[i]) {
                        //         break;
                        //     }
                        //     move++;
                        // }
                    }
                    let found2 = false;
                    for (let i = 1; i < result2.length; i++) {
                        let obj = result2[i];
                        let obj2 = dataResult2[i];
                        if (obj.code !== obj2.code || obj.x - obj2.x !== xDiff || obj.y - obj2.y !== yDiff) {
                            found2 = true;
                            break;
                        }
                    }
                    if (!found2) {
                        let keyPeriod = 1;
                        if (key.startsWith('xp')) {
                            keyPeriod = parseInt(key.slice(2));
                        }
                        let timing = ((result[0]?.timing ?? 0) - (dataResult[0]?.timing ?? 0)) % keyPeriod;
                        out.push({type: 'alias', elbow: key, flipped, move, timing});
                        found = true;
                        break;
                    }
                }
            }
            if (found) {
                continue;
            }
            let flippedResult = getCollision(info, elbow.code, elbow.lane, timing, true, true);
            if (typeof flippedResult !== 'object') {
                out.push({type: 'bad'});
                continue;
            }
            let flippedResults: CAObject[][] = [];
            for (let i = 0; i < 3; i++) {
                let p = runInjection(info, elbow, [[info.minSpacing + i * resultPeriod, 0]]);
                p.flipDiagonal();
                let temp = p.xOffset;
                p.xOffset = p.yOffset;
                p.yOffset = temp;
                let objs = findOutcome(p, true);
                if (typeof objs !== 'object') {
                    console.error(`\x1b[91mThis message should not appear. Please report this to speedydelete. In checkElbow, when computing flippedResults, objs is ${objs} (for elbow ${elbow.timingStr}).\x1b[0m`);
                    return;
                }
                flippedResults.push(objs.filter(obj => obj.type === 'sl' || obj.type === 'osc').map(obj => {
                    if (obj.type === 'osc') {
                        obj = normalizeOscillator(obj, false);
                    }
                    return obj;
                }));
            }
            out.push({type: 'normal', result, results, flippedResult, flippedResults});
        } else {
            let filtered: StableObject[] = [];
            let emit: ShipInfo[] | undefined = undefined;
            let found = false;
            for (let obj of result) {
                if (obj.type === 'sl' || obj.type === 'osc') {
                    filtered.push(obj);
                } else if (obj.type === 'ship') {
                    if (emit) {
                        if (emit.some(x => x.dir !== obj.dir)) {
                            found = true;
                            break;
                        }
                        emit.push(getShipInfo(info, obj));
                    } else {
                        emit = [getShipInfo(info, obj)];
                    }
                } else {
                    found = true;
                    break;
                }
            }
            if (found) {
                out.push({type: 'bad'});
                continue;
            }
            if (filtered.length === 0) {
                out.push({type: 'destroy', emit});
            } else if (filtered.length === 1) {
                let obj = filtered[0];
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj, false);
                }
                let lane = Math.floor(obj.y * info.ship.slope) - obj.x + elbow.lane;
                let spacing = Math.floor(obj.x * info.ship.slope) + obj.y;
                let str = `${obj.code}/${lane}`;
                if (!info.ship.supportsFlipped) {
                    out.push({type: 'convert', elbow: str, flipped: false, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing, emit});
                    continue;
                }
                let p = createChannelPattern(info, {code: obj.code, lane, timing: 0}, []).p;
                p.flipDiagonal();
                let temp = p.xOffset;
                p.xOffset = p.yOffset;
                p.yOffset = temp;
                let data = patternToSalvo({ship: info.ship, period: 1}, p);
                let flippedStr = `${data[0]}/${data[1][0][0]}`;
                if (flippedStr in elbows) {
                    out.push({type: 'convert', elbow: flippedStr, flipped: true, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing, emit});
                } else {
                    out.push({type: 'convert', elbow: str, flipped: false, move: spacing, timing: obj.type === 'sl' ? 0 : obj.timing, emit});
                }
            } else {
                out.push({type: 'bad'});
            }
        }
    }
    return out;
}

function addElbow(info: ChannelInfo, elbow: string | Elbow, data: RecipeData['channels'][string], depth: number = 0): undefined | ElbowData {
    if (typeof elbow === 'string') {
        if (elbow in data.elbows) {
            return;
        }
        elbow = parseElbow(elbow);
    }
    if (elbow.str in data.elbows) {
        return;
    }
    let result: ReturnType<typeof checkElbow>;
    try {
        result = checkElbow(info, data.elbows, elbow);
    } catch (error) {
        console.error(`Error while checking elbow '${elbow}':\n${error instanceof Error ? error.stack : String(error)}`);
        let entry: ElbowData[string] = [];
        for (let i = 0; i < elbow.period; i++) {
            entry.push({type: 'bad'});
        }
        return {[elbow.str]: entry};
    }
    if (!result) {
        let entry: ElbowData[string] = [];
        for (let i = 0; i < elbow.period; i++) {
            entry.push({type: 'bad'});
        }
        return {[elbow.str]: entry};
    }
    let out: ElbowData = {[elbow.str]: result};
    for (let value of result) {
        if ((value.type === 'alias' || value.type === 'convert') && !(value.elbow in data.elbows)) {
            if (depth === 16) {
                return;
            }
            let newOut = addElbow(info, value.elbow, data, depth + 1);
            if (newOut) {
                Object.assign(out, newOut);
            }
            if (newOut === undefined) {
                continue;
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
        if (recipe.end && recipe.end.period > 1) {
            period = lcm(period, recipe.end.period);
        }
        if (recipe.create && recipe.create.type === 'osc') {
            period = lcm(period, recipe.create.period);
        }
        for (let i = 0; i < period; i++) {
            let recipe2 = structuredClone(recipe);
            if (i !== 0) {
                recipe2.recipe.unshift([i, -2, 0]);
                recipe2.time += i;
            }
            if (recipe2.emit && info.period > 1) {
                for (let ship of recipe2.emit) {
                    ship.timing = (ship.timing + i) % info.period;
                }
            }
            if (recipe2.end) {
                if (recipe2.end.period === 1 || recipe2.end.code.startsWith('xs')) {
                    recipe2.end.timing = 0;
                } else {
                    recipe2.end.timing = (recipe2.end.timing + i) % recipe2.end.period;
                }
                recipe2.end.timingStr = `${recipe2.end.code}/${recipe2.end.lane}`;
                if (recipe2.end.period > 1) {
                    recipe2.end.timingStr += `/${recipe2.end.timing}`;
                }
            }
            if (recipe2.create && recipe2.create.type === 'osc') {
                recipe2.create.timing = (recipe2.create.timing + i) % recipe2.create.period;
            }
            out.push(recipe2);
        }
    }
    return out;
}

function addNewRecipes(info: ChannelInfo, data: {recipes: ChannelRecipe[], newElbows: string[]}, out: RecipeData['channels'][string]): string {
    for (let elbow of data.newElbows) {
        if (elbow in out.elbows) {
            continue;
        }
        let value = addElbow(info, elbow, out);
        if (value) {
            for (let key in value) {
                if (key in out.elbows) {
                    throw new Error(`This error should not occur (attempted overwrite: ${key}), please report this to speedydelete`);
                }
                out.elbows[key] = value[key];
            }
        }
    }
    let possibleUseful = '';
    let recipes: ChannelRecipe[] = [];
    for (let recipe of data.recipes) {
        if (recipe.end && data.newElbows.includes(recipe.end.str)) {
            let value = resolveElbow(info, out.elbows, recipe);
            recipes.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        } else {
            recipes.push(recipe);
            possibleUseful += getStringRecipe(info, recipe);
        }
    }
    recipes = expandRecipes(info, recipes);
    for (let recipe of recipes) {
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


const GLIDER_DIRECTION_NUMBERS: GliderDirection[] = ['NW', 'NE', 'SW', 'SE'];

function encodeInts(data: number[]): Uint8Array {
    let out: number[] = [];
    for (let value of data) {
        if (value > -128 && value < 128) {
            out.push(value < 0 ? value + 256 : value);
        } else if (value > -0xff00 && value < 0xff00) {
            if (value < 0) {
                value += 1 << 16;
            }
            out.push(255, (value & 0xff00) >> 8, (value & 0xff));
        } else {
            if (value < 0) {
                value += 2**32;
            }
            out.push(255, 255, (value & 0xff000000) >> 24, (value & 0xff0000) >> 16, (value & 0xff00) >> 8, (value & 0xff));
        }
    }
    return new Uint8Array(out);
}

async function saveStarts(type: string, info: ChannelInfo, starts: StrRunState[], elbow: Elbow, depth: number): Promise<void> {
    let arrays: Uint8Array[] = [];
    let totalLength = 0;
    for (let start of starts) {
        let header: number[] = [start.xOffset, start.yOffset, start.generation, start.startX, start.startY, start.recipe.length];
        for (let [timing, channel] of start.recipe) {
            header.push(timing, channel);
        }
        if (start.gliders) {
            header.push(start.gliders.length);
            for (let glider of start.gliders) {
                header.push(GLIDER_DIRECTION_NUMBERS.findIndex(x => x === glider.dir), glider.x, glider.y, glider.timing);
            }
        } else {
            header.push(0);
        }
        let headerData = encodeInts(header);
        let code: number[] = [];
        let p = base.loadApgcode(start.p);
        let height = p.height;
        let width = p.width;
        let data = p.data;
        for (let stripNum = 0; stripNum < Math.ceil(height / 7); stripNum++) {
            let zeros = 0;
            let start = stripNum * width * 7;
            for (let x = 0; x < width; x++) {
                let value = data[start + x] | (data[start + width + x] << 1) | (data[start + 2 * width + x] << 2) | (data[start + 3 * width + x] << 3) | (data[start + 4 * width + x] << 4) | (data[start + 5 * width + x] << 5) | (data[start + 6 * width + x] << 6);
                if (value === 0) {
                    zeros++;
                } else {
                    if (zeros > 0) {
                        while (zeros > 127) {
                            zeros -= 127;
                            code.push(253);
                        }
                        if (zeros > 0) {
                            if (zeros === 0) {
                                code.push(0);
                            } else {
                                code.push(126 + zeros);
                            }
                        }
                        zeros = 0;
                    }
                    code.push(value);
                }
            }
            code.push(254);
        }
        let array = new Uint8Array(headerData.length + code.length);
        array.set(headerData, 0);
        array.set(code, headerData.length);
        arrays.push(array);
        totalLength += array.length;
    }
    let out = new Uint8Array(totalLength);
    let i = 0;
    for (let array of arrays) {
        out.set(array, i);
        i += array.length;
    }
    let path = `${elbow.code}_${elbow.lane}_${elbow.timing}_depth_${depth}.starts`;
    if (info.aliases) {
        let alias = info.aliases.find(x => !x.includes(' '));
        if (alias) {
            path = alias + '_' + path;
        }
    } else {
        path = type + path;
    }
    await fs.writeFile(path, out);
}


/** Performs a restricted-channel search. */
export async function searchChannel(type: string, threads: number, elbow: Elbow, maxSpacing: number, outputFile?: string, saveProgress?: string): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await loadRecipes();
    let out = recipes.channels[type];
    if (!(elbow.str in out.elbows)) {
        let value = addElbow(info, elbow, out);
        if (value) {
            for (let key in value) {
                if (key in out.elbows) {
                    throw new Error(`This error should not occur (attempted overwrite: ${key}), please report this to speedydelete`);
                }
                out.elbows[key] = value[key];
            }
        }
    }
    let elbowType = out.elbows[elbow.str]?.[elbow.timing]?.type;
    if (elbowType !== 'normal') {
        throw new Error(`Provided elbow '${elbow.timingStr}' is not of type normal, type is ${elbowType}`);
    }
    let msg = `\n${type} search in ${base.ruleStr} with elbow ${elbow.timingStr}, max spacing ${maxSpacing}, and max generations ${maxGenerations}:\n`;
    if (existsSync('possible_useful.txt')) {
        let stat = await fs.stat('possible_useful.txt');
        if (stat.size > 0) {
            msg = '\n' + msg;
        }
        await fs.appendFile('possible_useful.txt', msg);
    } else {
        await fs.writeFile('possible_useful.txt', msg);
    }
    let workers: Worker[] = [];
    for (let i = 0; i < threads; i++) {
        let path: string;
        if (typeof window === 'object' && window === globalThis) {
            path = `./channel_searcher.js`;
        } else {
            path = `${import.meta.dirname}/channel_searcher.js`;
        }
        workers.push(await new Worker(path, {workerData: {info, maxGenerations, outputFile, maxSpacing} satisfies WorkerData}));
    }
    let state = createState(info, elbow);
    let starts: StrRunState[] = [Object.assign(state, {
        p: state.p.toApgcode(),
        xOffset: state.p.xOffset,
        yOffset: state.p.yOffset,
        generation: state.p.generation,
    })];
    let depth = 1;
    while (true) {
        // if (depth === 2) {
        //     process.exit(0);
        // }
        if (starts.length === 0) {
            console.log(`Elbow exhausted`);
            process.exit(0);
        }
        console.log(`Searching depth ${depth} (${starts.length} starts)`);
        await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n`);
        let start = performance.now();
        let newStarts: StrRunState[] = [];
        let finishedCount = 0;
        let startsChecked = 0;
        let recipesChecked = 0;
        let timeout: NodeJS.Timeout | null = null;
        let interval: NodeJS.Timeout | null = null;
        let {promise, resolve} = Promise.withResolvers<void>();
        // <school-chromebook>
        // await redraw();
        // await redraw();
        // await redraw();
        // let nextStartIndex = 0;
        // </school-chromebook>
        for (let i = 0; i < workers.length; i++) {
            let worker = workers[i];
            worker.removeAllListeners('message');
            worker.on('message', async (data: WorkerOutput) => {
                startsChecked += data.startsChecked;
                recipesChecked += data.recipesChecked;
                let possibleUseful = data.possibleUseful.join('');
                newStarts.push(...data.states);
                possibleUseful += addNewRecipes(info, data, out);
                if (possibleUseful.length > 0) {
                    await fs.appendFile('possible_useful.txt', possibleUseful);
                }
                // <school-chromebook>
                // if (startsChecked > 0 && recipesChecked > 0) {
                //     let now = performance.now();
                //     if (now - lastUpdate > 5000) {
                //         lastUpdate = now;
                //         let time = (now - start) / 1000;
                //         console.log(`${startsChecked}/${starts.length} (${(startsChecked / starts.length * 100).toFixed(3)}%) starts checked (${recipesChecked} recipes, ${(startsChecked / time).toFixed(3)} sps, ${(recipesChecked / time).toFixed(3)} rps)`);
                //         await saveRecipes(recipes);
                //     }
                // }
                // await redraw();
                // await redraw();
                // await redraw();
                // if (nextStartIndex === starts.length) {
                //     resolve();
                // } else {
                //     worker.postMessage({
                //         elbows: out.elbows,
                //         starts: [starts[nextStartIndex++]],
                //     } satisfies WorkerStartData);
                // }
                // </school-chromebook><not-school-chromebook>
                if (data.complete) {
                    finishedCount++;
                    if (finishedCount === threads) {
                        resolve();
                    }
                }
                // </not-school-chromebook>
            });
            // <school-chromebook>
            // let lastUpdate = performance.now();
            // await redraw();
            // await redraw();
            // await redraw();
            // worker.postMessage({
            //     elbows: out.elbows,
            //     starts: [starts[nextStartIndex++]],
            // } satisfies WorkerStartData);
            // </school-chromebook><not-school-chromebook>
            worker.postMessage({
                elbows: out.elbows,
                starts: starts.filter((_, j) => j % workers.length === i),
            } satisfies WorkerStartData);
            // </not-school-chromebook>
        }
        // <not-school-chromebook>
        timeout = setTimeout(() => {
            interval = setInterval(async () => {
                if (startsChecked > 0 && recipesChecked > 0) {
                    let time = (performance.now() - start) / 1000;
                    console.log(`${startsChecked}/${starts.length} (${(startsChecked / starts.length * 100).toFixed(3)}%) starts checked (${recipesChecked} recipes, ${(startsChecked / time).toFixed(3)} sps, ${(recipesChecked / time).toFixed(3)} rps)`);
                    await saveRecipes(recipes);
                }
            }, 5000);
        }, 2500);
        // </not-school-chromebook>
        await promise;
        if (timeout !== null) {
            clearTimeout(timeout);
        }
        if (interval !== null) {
            clearInterval(interval);
        }
        let time = (performance.now() - start) / 1000;
        console.log(`Depth ${depth} complete in ${time.toFixed(3)} seconds (${recipesChecked} recipes, ${(startsChecked / time).toFixed(3)} sps, ${(recipesChecked / time).toFixed(3)} rps)`);
        await saveRecipes(recipes);
        starts = newStarts;
        depth++;
        if (saveProgress) {
            saveStarts(type, info, starts, elbow, depth);
        }
    }
}
