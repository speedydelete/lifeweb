
import {MessagePort, parentPort, workerData} from 'node:worker_threads';
import {gcd, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, maxGenerations, setMaxGenerations, StillLife, Spaceship, CAObject, base, gliderPatterns, channelRecipeToString, objectsToString, RecipeData, ChannelRecipe, channelRecipeInfoToString, stringToObjects} from './base.js';
import {separateObjects, stabilize, findOutcome} from './runner.js';
import {createSalvoPattern} from './slow_salvos.js';
import {createChannelPattern} from './channel.js';

/* TODO:
make it record 180deg recipes and xWSS recipes that leave behind elbows (as unlikely as these are they could exist...)
generalize object-creation recipes a bit
catalog multi-output-glider recipes...
*/


let info: ChannelInfo = workerData.info;

setMaxGenerations(workerData.maxGenerations);

let starts: [number, number][][] = workerData.starts;


function getRecipesForDepthSingleChannel(depth: number, maxSpacing: number): [[number, number][], number][] {
    let out: [[number, number][], number][] = [];
    let limit = Math.min(maxSpacing, depth);
    for (let spacing = info.minSpacing; spacing <= limit; spacing++) {
        if (info.excludeSpacings && info.excludeSpacings[0][0].includes(spacing)) {
            continue;
        }
        let elt: [number, number] = [spacing, 0];
        if (spacing === depth) {
            out.push([[elt], spacing]);
        } else if (depth - spacing >= info.minSpacing) {
            for (let recipe of getRecipesForDepthSingleChannel(depth - spacing, maxSpacing)) {
                recipe[0].unshift(elt);
                recipe[1] += spacing;
                out.push(recipe);
            }
        }
    }
    return out;
}

function getRecipesForDepthMultiChannel(depth: number, maxSpacing: number, prev: number | undefined, lastUses: number[]): [[number, number][], number][] {
    let out: [[number, number][], number][] = [];
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
            let elt: [number, number] = [spacing, channel];
            out.push([[elt], spacing]);
            if (depth > 0) {
                let newLastUses = lastUses.map(x => x + spacing);
                newLastUses[channel] = 0;
                for (let recipe of getRecipesForDepthMultiChannel(depth - 1, maxSpacing, channel, newLastUses)) {
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

function getRecipesForDepth(depth: number, maxSpacing: number, prev?: number): [[number, number][], number][] {
    if (info.channels.length === 1) {
        return getRecipesForDepthSingleChannel(depth, maxSpacing);
    } else if (prev) {
        return getRecipesForDepthMultiChannel(depth, maxSpacing, prev, (new Array(info.channels.length)).fill(Infinity));
    } else {
        let out: [[number, number][], number][] = [];
        let lastUses = (new Array(info.channels.length)).fill(Infinity);
        for (let channel = 0; channel < info.channels.length; channel++) {
            let newLastUses = lastUses.slice();
            newLastUses[channel] = 0;
            for (let recipe of getRecipesForDepthMultiChannel(depth, maxSpacing, channel, newLastUses)) {
                recipe[0].unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}


function runInjection(elbow: [string, number], recipe: [number, number][]/*, debug: boolean = false*/): MAPPattern {
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
    let y = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let x = Math.floor(y * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    gliders.forEach(g => {
        g.xOffset -= x;
        g.yOffset -= y;
    });
    let p = base.loadApgcode(elbow[0]).shrinkToFit();
    let yPos = c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - elbow[1] + c.LANE_OFFSET;
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
            if (xDiff < 2 || yDiff < 2 || (xDiff < last.width + c.INJECTION_SPACING) && (yDiff < last.height + c.INJECTION_SPACING)) {
            // if ((xDiff < last.width + c.INJECTION_SPACING) || (yDiff < last.height + c.INJECTION_SPACING)) {
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
        if (i > total + maxGenerations) {
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

function findChannelOutcome(elbow: [string, number], recipe: [number, number][], mergeAll: boolean = false): false | 'linear' | CAObject[] {
    if (recipe.length < 2) {
        let {p, xPos, yPos} = createChannelPattern(info, elbow, recipe);
        p.xOffset -= xPos;
        p.yOffset -= yPos;
        return findOutcome(p, mergeAll);
    } else {
        return findOutcome(runInjection(elbow, recipe), mergeAll);
    }
}


function isNextWorkingInput(elbow: [string, number], recipe: [number, number][], expectedAsh: string[], expectedAshPeriod: number, next: number): boolean {
    let test = recipe.slice();
    test.push([next, 0]);
    // console.log(`\x1b[95m${channelRecipeToString(info, test)}\x1b[0m`);
    let p: MAPPattern;
    if (recipe.length < 2) {
        let data = createChannelPattern(info, elbow, test);
        p = data.p;
        p.xOffset -= data.xPos;
        p.yOffset -= data.yPos;
    } else {
        p = runInjection(elbow, test);
    }
    // console.log(p.toRLE());
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

function findNextWorkingInput(elbow: [string, number], recipe: [number, number][], expectedAsh: string[], expectedAshPeriod: number/*, low: number, high: number*/): false | [number, number][] {
    // console.log(`\x1b[92mexpected: ${expectedAsh[0]} (period: ${expectedAsh[1]})\x1b[0m`);
    let low = info.minSpacing;
    let high = info.maxNextSpacing;
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(elbow, recipe, expectedAsh, expectedAshPeriod, mid) && isNextWorkingInput(elbow, recipe, expectedAsh, expectedAshPeriod, mid + 1) && isNextWorkingInput(elbow, recipe, expectedAsh, expectedAshPeriod, mid + 2)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}\x1b[0m`);
    }
    if (low === info.maxNextSpacing) {
        console.log(`\x1b[93mUnable to find next possible glider spacing: ${channelRecipeToString(info, recipe)}\x1b[0m`);
        return false;
        // throw new Error('hi');
    }
    recipe = recipe.slice();
    recipe.push([low, -1]);
    return recipe;
}


const SALVO_INFO = {gliderSpacing: 0};

function getCollision(code: string, lane: number): false | string {
    let inc = c.GLIDER_POPULATION_PERIOD;
    if (code.startsWith('xp')) {
        let period = parseInt(code.slice(2));
        inc = inc * period / gcd(inc, period);
    }
    let p = createSalvoPattern(SALVO_INFO, code.slice(code.indexOf('_') + 1), [[lane, 0]])[0];
    let prevPop = p.population;
    for (let i = 0; i < c.MAX_WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            let out = findOutcome(p, true);
            if (typeof out === 'object') {
                return objectsToString(out);
            } else {
                return false;
            }
        }
        prevPop = pop;
    }
    return false;
}


export function findChannelResults(elbows: RecipeData['channels'][string]['elbows'], elbow: string, depth: number, maxSpacing: number, parentPort: MessagePort): void {
    let elbowParts = elbow.split('/');
    let elbowLane = parseInt(elbowParts[1]);
    let elbowData: [string, number] = [elbowParts[0].slice(elbowParts[0].indexOf('_') + 1), elbowLane];
    let newRecipes: ChannelRecipe[] = [];
    let newElbows: string[] = [];
    let possibleUseful = '';
    let recipes: [[number, number][], number][] = [];
    for (let start of starts) {
        let startTime = start.map(x => x[0]).reduce((x, y) => x + y);
        if (info.forceStart) {
            start.unshift(...info.forceStart);
            startTime += info.forceStart.map(x => x[0]).reduce((x, y) => x + y);
        }
        if (startTime > depth) {
            continue;
        }
        if (startTime === depth) {
            recipes.push([start, startTime]);
        }
        if (start.length < 3) {
            continue;
        }
        let last = start[start.length - 1];
        for (let [recipe, time] of getRecipesForDepth(depth - startTime, maxSpacing, last[1])) {
            recipe.unshift(...start);
            time += startTime;
            recipes.push([recipe, time]);
        }
    }
    parentPort.postMessage(['starting', recipes.length]);
    let count = 0;
    let lastUpdate = performance.now();
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 5000) {
            lastUpdate = now;
            parentPort.postMessage(['update', {count, recipes: newRecipes}]);
            count = 0;
        }
        count++;
        let [recipe, time] = recipes[i];
        let result: false | 'linear' | CAObject[];
        let strRecipe = channelRecipeToString(info, recipe);
        result = findChannelOutcome(elbowData, recipe);
        if (result === false) {
            continue;
        }
        if (result === 'linear') {
            possibleUseful += `Linear growth: ${strRecipe}\n`;
            continue;
        }
        let sl1: {obj: StillLife, lane: number, spacing: number} | undefined = undefined;
        let sl2: {obj: StillLife, lane: number, spacing: number} | undefined = undefined;
        let emit: ChannelRecipe['emit'] | undefined = undefined;
        let found = false;
        for (let obj of result) {
            if (obj.type === 'sl') {
                if (sl1 && sl2) {
                    found = true;
                    break;
                }
                let lane = Math.floor(obj.y * c.GLIDER_SLOPE) - obj.x + elbowLane;
                let spacing = Math.floor(obj.x * c.GLIDER_SLOPE) + obj.y;
                let value = {obj, lane, spacing};
                if (sl1 === undefined) {
                    sl1 = value;
                } else {
                    sl2 = value;
                }
            } else if (!emit && obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
                let dir: 'up' | 'down' | 'left' | 'right';
                let lane: number;
                if (obj.dir === 'N' || obj.dir === 'NE') {
                    dir = 'up';
                    lane = obj.x - (obj.y * c.GLIDER_SLOPE);
                } else if (obj.dir === 'W' || obj.dir === 'SW') {
                    dir = 'left';
                    lane = (obj.x * c.GLIDER_SLOPE) + obj.y;
                } else if (obj.dir === 'S' || obj.dir === 'SE') {
                    dir = 'down';
                    lane = obj.x - (obj.y * c.GLIDER_SLOPE);
                } else {
                    dir = 'right';
                    lane = (obj.x * c.GLIDER_SLOPE) + obj.y;
                }
                let timing = obj.timing - (time % c.GLIDER_PERIOD);
                if (timing < 0) {
                    timing += c.GLIDER_PERIOD;
                }
                timing %= info.period;
                emit = {dir, lane, timing};
            } else {
                found = true;
                if (info.possiblyUsefulFilter.includes(obj.code)) {
                    break;
                }
                if (obj.type === 'osc' && !obj.code.startsWith('xp2')) {
                    possibleUseful += `Creates ${obj.code}: ${strRecipe}\n`;
                } else if (obj.type === 'ship' && obj.code !== c.GLIDER_APGCODE) {
                    possibleUseful += `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
                } else if (obj.type === 'other' && obj.code.startsWith('xq')) {
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
                break;
            }
        }
        if (found) {
            continue;
        }
        let create: StillLife | undefined = undefined;
        let elbow: {obj: StillLife, lane: number, spacing: number} | undefined = undefined;
        let elbowResult: string | false | undefined = undefined;
        if (sl1) {
            if (sl2) {
                let sl1Result = getCollision(sl1.obj.code, sl1.lane);
                let sl2Result = getCollision(sl2.obj.code, sl2.lane);
                if (sl1Result) {
                    if (sl2Result) {
                        continue;
                    } else {
                        create = sl2.obj;
                        elbow = sl1;
                        elbowResult = sl1Result;
                    }
                } else {
                    if (sl2Result) {
                        create = sl1.obj;
                        elbow = sl2;
                        elbowResult = sl2Result;
                    } else {
                        continue;
                    }
                }
            } else {
                elbow = sl1;
            }
        }
        let end: [string, number] | undefined = undefined;
        if (elbow) {
            let elbowStr = `${elbow.obj.code}/${elbow.lane}`;;
            if (elbowStr in elbows) {
                end = [elbowStr, elbow.spacing];
                let value = elbows[elbowStr];
                if (typeof value === 'string') {
                } else {
                    let [newStr, flipped] = elbows[elbowStr];
                }
            } else {
                let cells = parseInt(elbow.obj.code.slice(2));
                if (cells > info.maxElbowCells) {
                    continue;
                }
                if (!elbowResult) {
                    elbowResult = getCollision(elbow.obj.code, elbow.lane);
                }
                if (!elbowResult) {
                    continue;
                }
                elbowResult = objectsToString(stringToObjects(elbowResult).map(obj => {
                    obj.x -= elbow.obj.x;
                    obj.y -= elbow.obj.y;
                    return obj;
                }));
            }
        }
        possibleUseful += channelRecipeInfoToString(value) + '\n';
    }
    parentPort.postMessage(['completed', {recipes: newRecipes, newElbows, possibleUseful, recipeCount: recipes.length}]);
}


if (!parentPort) {
    throw new Error('No parent port!');
}

parentPort.on('message', data => {
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let out = findChannelResults(data.elbows, data.elbow, data.depth, data.maxSpacing, parentPort);
    parentPort.postMessage(['completed', out]);
});
