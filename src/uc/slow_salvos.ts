
import {gcd, MAPPattern} from '../core/index.js';
import {c, SalvoInfo, log, base, gliderPattern, gliderPatterns, Spaceship, StableObject, CAObject, translateObjects, objectsToString, stringToObjects, RecipeData, loadRecipes, saveRecipes} from './base.js';
import {separateObjects, findOutcome} from './runner.js';


/** Turns a salvo into a `Pattern`. */
export function createSalvoPattern(info: {gliderSpacing: number}, target: string, lanes: [number, number][]): MAPPattern {
    lanes = lanes.reverse();
    let minLane = 0;
    for (let [lane] of lanes) {
        if (lane < minLane) {
            minLane = lane;
        }
    }
    let p = base.copy();
    for (let i = 0; i < lanes.length; i++) {
        let [lane, timing] = lanes[i];
        if (timing === -1) {
            timing = 0;
        }
        let y = i * info.gliderSpacing;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        if (timing === 0) {
            p.ensure(x + gliderPattern.width, y + gliderPattern.height);
            p.insert(gliderPattern, x, y);
        } else {
            if (timing > c.GLIDER_PERIOD) {
                let periods = Math.floor(timing / c.GLIDER_PERIOD);
                x += c.GLIDER_DX * periods;
                y += c.GLIDER_DY * periods;
                timing -= periods;
            }
            let q = gliderPatterns[timing];
            p.ensure(x + q.width, y + q.height);
            p.insert(q, x, y);
        }
    }
    let q = base.loadApgcode(target).shrinkToFit();
    let yPos = (lanes.length - 1) * info.gliderSpacing + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) + c.LANE_OFFSET - minLane;
    p.ensure(q.width + xPos, q.height + yPos);
    p.insert(q, xPos, yPos);
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    return p;
}

/** Reads a slow salvo from a `Pattern`. */
export function patternToSalvo(info: c.SalvoInfo, p: MAPPattern): [string, [number, number][]] {
    let objs = separateObjects(p, 1, 256);
    if (objs === false) {
        throw new Error('Object separation failed!');
    }
    let target: StableObject | null = null;
    let ships: Spaceship[] = [];
    for (let obj of objs) {
        if (obj.type === 'ship') {
            ships.push(obj);
        } else if (obj.type === 'sl' || obj.type === 'osc') {
            if (target !== null) {
                throw new Error('More than 1 target!');
            }
            target = obj;
        } else {
            throw new Error(`Invalid object: ${obj}`);
        }
    }
    if (!target) {
        throw new Error('No target!');
    }
    let lanes: [number, number, number][] = [];
    for (let ship of ships) {
        let x = target.x - ship.x;
        let y = target.y - ship.y;
        let lane = (y * c.GLIDER_SLOPE) - x + c.LANE_OFFSET;
        let timing = x + y;
        lanes.push([lane, ship.timing, timing]);
    }
    lanes = lanes.sort((a, b) => a[2] - b[2]);
    return [target.code, lanes.map(x => [x[0], x[1] % info.period])];
}


const SALVO_INFO = {gliderSpacing: 0};

export function getCollision(code: string, lane: number, timing: number = 0, flip?: boolean, isElbow?: boolean): false | 'no collision' | 'no stabilize' | 'linear' | 'no' | CAObject[] {
    let inc = c.GLIDER_POPULATION_PERIOD;
    if (code.startsWith('xp')) {
        let period = parseInt(code.slice(2));
        inc = inc * period / gcd(inc, period);
    }
    let p = createSalvoPattern(SALVO_INFO, code.slice(code.indexOf('_') + 1), [[lane, timing]]);
    if (flip) {
        p.flipDiagonal();
        let temp = p.xOffset;
        p.xOffset = p.yOffset;
        p.yOffset = temp;
    }
    let prevPop = p.population;
    for (let i = 0; i < c.MAX_WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            if (i === 0) {
                return 'no';
            }
            p.generation = 0;
            return findOutcome(p, isElbow);
        }
        prevPop = pop;
    }
    return 'no collision';
}

export function getSalvoCollision(code: string, lane: number, timing: number = 0, flip?: boolean, isElbow?: boolean): false | 'no stabilize' | 'no collision' | 'no' | 'linear' | CAObject[] {
    let out = getCollision(code, lane, timing, flip, isElbow);
    if (typeof out === 'object') {
        for (let obj of out) {
            if (obj.type === 'osc') {
                obj.timing %= parseInt(obj.code.slice(2));
            }
        }
    }
    return out;
}


export function get1GSalvos(info: SalvoInfo, target: string, timing: number, reflectorSearch?: boolean): false | [Set<string>, [number, number, false | null | CAObject[] | string][]] {
    let index = target.indexOf('_');
    let prefix = target.slice(0, index);
    let canonicalTarget = base.loadApgcode(target.slice(index + 1)).toCanonicalApgcode(prefix.startsWith('xs') ? 1 : parseInt(prefix.slice(2)), prefix);
    let lane = 0;
    let data = getSalvoCollision(target, lane, timing);
    if (data === 'no') {
        return false;
    }
    while (data !== 'no collision') {
        lane--;
        data = getSalvoCollision(target, lane, timing);
        if (data === 'no') {
            return false;
        }
        if (lane === -info.laneLimit) {
            return false;
        }
    }
    lane--;
    data = getSalvoCollision(target, lane, timing);
    if (data === 'no') {
        return false;
    }
    while (data !== 'no collision') {
        lane--;
        data = getSalvoCollision(target, lane, timing);
        if (data === 'no') {
            return false;
        }
        if (lane === -info.laneLimit) {
            return false;
        }
    }
    lane++;
    let failed = false;
    let newObjs = new Set<string>();
    let out: [number, number, false | null | CAObject[] | string][] = [];
    let hadCollision = false;
    for (; lane < info.laneLimit; lane++) {
        let data = getSalvoCollision(target, lane, timing);
        if (data === 'no') {
            return false;
        }
        if (data === 'linear') {
            out.push([lane, timing, 'linear']);
            continue;
        } else if (data === 'no collision') {
            if (!hadCollision) {
                continue;
            }
            if (failed) {
                break;
            } else {
                failed = true;
                continue;
            }
        } else if (data === 'no stabilize') {
            continue;
        } else if (data) {
            let obj: CAObject | undefined;
            if (reflectorSearch) {
                for (let testObj of data) {
                    let index = testObj.code.indexOf('_');
                    let prefix = testObj.code.slice(0, index);
                    let data = testObj.code.slice(index + 1);
                    let period: number;
                    if (testObj.type === 'sl') {
                        period = 1;
                    } else if (testObj.type === 'osc') {
                        period = parseInt(prefix.slice(2));
                    } else {
                        continue;
                    }
                    let code = base.loadApgcode(data).toCanonicalApgcode(period, prefix);
                    if (code === canonicalTarget) {
                        obj = testObj;
                        break;
                    }
                }
            } else {
                obj = data.find(x => (x.type === 'sl' || x.type === 'osc') && x.code === target);
            }
            if (obj) {
                if (obj.code === target && obj.x === 0 && obj.y === 0) {
                    if (data.length === 1) {
                        out.push([lane, timing, 'eater']);
                        continue;
                    } else if (data.every(x => x === obj || x.type === 'ship')) {
                        if (data.length === 2) {
                            out.push([lane, timing, 'reflector']);
                        } else {
                            out.push([lane, timing, 'splitter']);
                        }
                    } else if (data.length === 2) {
                        out.push([lane, timing, 'factory']);
                    }
                } else if (data.every(x => x === obj || x.type === 'ship')) {
                    if (data.length === 2) {
                        out.push([lane, timing, 'failed reflector']);
                    } else if (data.length > 2) {
                        out.push([lane, timing, 'failed splitter']);
                    }
                } else if (data.length === 2) {
                    out.push([lane, timing, 'failed factory']);
                }
            }
        }
        out.push([lane, timing, data]);
        if (!hadCollision) {
            hadCollision = true;
        }
        failed = false;
        if (data) {
            for (let obj of data) {
                if (obj.type === 'sl' || obj.type === 'osc') {
                    newObjs.add(obj.code);
                }
            }
        }
        if (lane === info.laneLimit - 1) {
            return false;
        }
    }
    return [newObjs, out];
}

function addRecipe<T extends number>(info: c.SalvoInfo, index: T, entry: {[K in T]: [number, number][][]}, recipe: [number, number][]): void {
    if (!entry[index].some(x => x.length === recipe.length && x.every((y, i) => y[0] === recipe[i][0] && y[1] === recipe[i][1]))) {
        entry[index].push(recipe);
        if (info.maxRecipes && entry[index].length > info.maxRecipes) {
            entry[index] = entry[index].sort((a, b) => a.length - b.length).slice(0, info.maxRecipes);
        }
    }
}

function compileRecipes(info: c.SalvoInfo, data: {[key: string]: [number, number, false | null | CAObject[] | string][]}, code: string, prefix: [number, number][], x: number, y: number, totalTiming: number, count: number, limit: number, out: RecipeData['salvos'][string], start: StableObject): void {
    for (let [lane, timing, objs] of data[code]) {
        timing = (timing + totalTiming) % info.period;
        if (!objs || typeof objs === 'string') {
            continue;
        }
        let recipe = prefix.slice();
        recipe.push([lane + x - y * c.GLIDER_SLOPE, timing]);
        objs = translateObjects(objs, x, y);
        let key = `${start.code} to ${objectsToString(objs)}`;
        let stable: StableObject[] = [];
        let ships: Spaceship[] = [];
        let found = false;
        for (let obj of objs) {
            if (obj.type === 'sl' || obj.type === 'osc') {
                stable.push(obj);
            } else if (obj.type === 'ship') {
                ships.push(obj);
            } else {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
        if (stable.length > 0 && ships.length > 0) {
            if (!(stable.length === 1 && ships.length === 1)) {
                continue;
            }
        }
        if (key in out.recipes) {
            addRecipe(info, 2, out.recipes[key], recipe);
        } else {
            out.recipes[key] = [start, objs, [recipe]];
        }
        if (stable.every(x => info.intermediateObjects.includes(x.code))) {
            if (ships.length > 0) {
                if (stable.length === 0) {
                    if (ships.length === 1) {
                        if (key in out.oneTimeTurners) {
                            addRecipe(info, 2, out.oneTimeTurners[key], recipe);
                        } else {
                            out.oneTimeTurners[key] = [start, ships[0], [recipe]];
                        }
                    } else {
                        if (key in out.oneTimeSplitters) {
                            addRecipe(info, 2, out.oneTimeSplitters[key], recipe);
                        } else {
                            out.oneTimeSplitters[key] = [start, ships, [recipe]];
                        }
                    }
                } else if (stable.length === 1 && ships.length === 1) {
                    if (key in out.elbowRecipes) {
                        addRecipe(info, 3, out.elbowRecipes[key], recipe);
                    } else {
                        out.elbowRecipes[key] = [start, stable[0], ships[0], [recipe]];
                    }
                }
            } else {
                if (stable.length === 0) {
                    if (key in out.destroyRecipes) {
                        let entry = out.destroyRecipes[key];
                        if (!entry.some(x => x.length === recipe.length && x.every((y, i) => y[0] === recipe[i][0] && y[1] === recipe[i][1]))) {
                            entry.push(recipe);
                            if (info.maxRecipes && entry.length > info.maxRecipes) {
                                out.destroyRecipes[key] = entry.sort((a, b) => a.length - b.length).slice(0, info.maxRecipes);
                            }
                        }
                    }
                } else if (stable.length === 1) {
                    if (key in out.moveRecipes) {
                        addRecipe(info, 2, out.moveRecipes[key], recipe);
                    } else {
                        out.moveRecipes[key] = [start, stable[0], [recipe]];
                    }
                } else {
                    if (key in out.splitRecipes) {
                        addRecipe(info, 2, out.splitRecipes[key], recipe);
                    } else {
                        out.splitRecipes[key] = [start, stable, [recipe]];
                    }
                }
            }
        }
        if (count < limit) {
            if (objs.length === 1 && (objs[0].type === 'sl' || objs[0].type === 'osc') && objs[0].code in data) {
                let newTiming = totalTiming;
                if (objs[0].type === 'osc') {
                    newTiming = (newTiming + objs[0].timing) % info.period;
                }
                compileRecipes(info, data, objs[0].code, recipe, objs[0].x, objs[0].y, newTiming, count + 1, limit, out, start);
            }
        }
    }
}

/** Searches slow salvos. */
export async function searchSalvos(type: string, start: string, noCompile?: boolean): Promise<void> {
    let info = c.SALVO_INFO[type];
    let recipes = await loadRecipes();
    let results = recipes.salvos[type].searchResults;
    let done = new Set<string>();
    let forInput: {[key: string]: [number, number, false | null | CAObject[] | string][]} = {};
    let queue = [start];
    let depth = 0;
    while (true) {
        if (queue.length === 0) {
            log(`No objects to search!`);
            process.exit(0);
        }
        log(`Searching depth ${depth + 1} (${queue.length} objects)`);
        let newQueue: string[] = [];
        for (let j = 0; j < queue.length; j++) {
            let code = queue[j];
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            if (code.startsWith('xs')) {
                let data = get1GSalvos(info, code, 0);
                if (data) {
                    let [newObjs, newOut] = data;
                    forInput[code] = newOut;
                    results[code] = newOut.filter(x => x[2]) as [number, number, CAObject[]][];
                    newQueue.push(...newObjs);
                }
            } else {
                let out: (typeof forInput)[string] = [];
                for (let timing = 0; timing < info.period; timing++) {
                    let data = get1GSalvos(info, code, timing);
                    if (data) {
                        let [newObjs, newOut] = data;
                        out.push(...newOut);
                        let toAdd = newOut.filter(x => x[2]) as [number, number, CAObject[]][];
                        if (results[code]) {
                            results[code].push(...toAdd);
                        } else {
                            results[code] = toAdd;
                        }
                        newQueue.push(...newObjs);
                    }
                }
                if (out.length > 0) {
                    forInput[code] = out;
                }
            }
            log(`Depth ${depth + 1} ${(j / queue.length * 100).toFixed(3)}% complete`, true);
        }
        queue = newQueue;
        if (noCompile) {
            await saveRecipes(recipes);
            depth++;
            continue;
        }
        log(`Depth ${depth + 1} 100.00% complete, compiling recipes`);
        if (start === info.startObject) {
            for (let i = 0; i < info.intermediateObjects.length; i++) {
                let obj = info.intermediateObjects[i];
                if (obj in forInput) {
                    let start = stringToObjects(obj + ' (0, 0)')[0] as StableObject;
                    compileRecipes(info, forInput, obj, [], 0, 0, 0, 0, depth, recipes.salvos[type], start);
                }
                log(`Finished compiling recipes for ${i + 1}/${info.intermediateObjects.length} (${((i + 1) / info.intermediateObjects.length * 100).toFixed(1)}%) objects`, true);
            }
        } else {
            let obj = stringToObjects(start + ' (0, 0)')[0] as StableObject;
            compileRecipes(info, forInput, start, [], 0, 0, 0, 0, depth, recipes.salvos[type], obj);
        }
        log('Compiled all recipes');
        await saveRecipes(recipes);
        depth++;
        if (depth === 4) {
            process.exit(0);
        }
    }
}
