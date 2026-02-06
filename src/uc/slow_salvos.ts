
import {MAPPattern} from '../core/index.js';
import {c, SalvoInfo, log, Spaceship, StableObject, CAObject, base, gliderPattern, gliderPatterns, translateObjects, objectsToString, stringToObjects, RecipeData, loadRecipes, saveRecipes, separateObjects, findOutcome} from './base.js';


/** Turns a salvo into a `Pattern`. */
export function createSalvoPattern(info: SalvoInfo, target: string, lanes: [number, number][]): [MAPPattern, number, number] {
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
    return [p, xPos, yPos];
}

/** Reads a slow salvo from a `Pattern`. */
export function patternToSalvo(p: MAPPattern): [string, [number, number][]] {
    let objs = separateObjects(p, 1, 256);
    if (objs === false) {
        throw new Error('Object separation failed!');
    }
    let target: StableObject | null = null;
    let ships: {lane: number, timing: number}[] = [];
    for (let obj of objs) {
        if (obj.type === 'ship') {
            ships.push({lane: obj.x - obj.y, timing: obj.x + obj.y});
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
    let lanes = ships.sort((a, b) => b.timing - a.timing).map<[number, number]>(x => [x.lane, x.timing]);
    let laneOffset = target.y - target.x;
    lanes = lanes.map(x => [x[0] + laneOffset + c.LANE_OFFSET, x[1] % c.GLIDER_PERIOD]);
    return [target.code, lanes];
}


function findSalvoResult(info: SalvoInfo, target: string, lanes: [number, number][]): 'no' | null | false | 'linear' | CAObject[] {
    let [p, xPos, yPos] = createSalvoPattern(info, target.slice(target.indexOf('_') + 1), lanes);
    let found = false;
    let prevPop = p.population;
    for (let i = 0; i < lanes.length * c.WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            if (i === 0) {
                return 'no';
            }
            found = true;
            break;
        }
        prevPop = pop;
    }
    if (!found) {
        return null;
    }
    return findOutcome(p, xPos, yPos, target + ', ' + lanes.join(', '))[0];
}

function get1GSalvos(info: SalvoInfo, target: string, timing: number): false | [Set<string>, [number, number, false | null | CAObject[]][]] {
    let lane = 0;
    let data = findSalvoResult(info, target, [[lane, timing]]);
    if (data === 'no') {
        return false;
    }
    while (data !== null) {
        lane--;
        data = findSalvoResult(info, target, [[lane, timing]]);
        if (data === 'no') {
            return false;
        }
        if (lane === -info.laneLimit) {
            return false;
        }
    }
    data = findSalvoResult(info, target, [[lane, timing]]);
    while (data !== null) {
        lane--;
        data = findSalvoResult(info, target, [[lane, timing]]);
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
    let out: [number, number, false | null | CAObject[]][] = [];
    let hadCollision = false;
    for (; lane < info.laneLimit; lane++) {
        let data = findSalvoResult(info, target, [[lane, timing]]);
        if (data === 'no') {
            return false;
        }
        if (data === 'linear') {
            out.push([lane, timing, [{type: 'other', code: 'linear growth', realCode: 'linear growth', x: 0, y: 0, at: 0, timing: 0}]]);
            continue;
        } else if (data && data.length === 1 && data[0].type === 'sl' && data[0].code === target && data[0].x === 0 && data[0].y === 0) {
            continue;
        }
        out.push([lane, timing, data]);
        if (data === null) {
            if (!hadCollision) {
                continue;
            }
            if (failed) {
                break;
            } else {
                failed = true;
                continue;
            }
        }
        if (!hadCollision) {
            hadCollision = true;
        }
        failed = false;
        if (data) {
            for (let obj of data) {
                if (obj.type === 'sl') {
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
    if (!entry[index].some(x => x.length === recipe.length && x.every((y, i) => y === recipe[i]))) {
        entry[index].push(recipe);
        if (info.maxRecipes && entry[index].length > info.maxRecipes) {
            entry[index] = entry[index].sort((a, b) => a.length - b.length).slice(0, info.maxRecipes);
        }
    }
}

function compileRecipes(info: c.SalvoInfo, data: {[key: string]: [number, number, false | null | CAObject[]][]}, code: string, prefix: [number, number][], x: number, y: number, count: number, limit: number, out: RecipeData['salvos'][string], start: StableObject): void {
    for (let [lane, timing, objs] of data[code]) {
        if (!objs) {
            continue;
        }
        let recipe = prefix.concat([lane + x - y, timing]);
        objs = translateObjects(objs, x, y);
        let key = `${start.code} to ${objectsToString(objs)}`;
        let stable: StableObject[] = [];
        let ships: Spaceship[] = [];
        for (let obj of objs) {
            if (obj.type === 'sl' || obj.type === 'osc') {
                stable.push(obj);
            } else if (obj.type === 'ship') {
                ships.push(obj);
            }
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
            let part: {[key: string]: {2: [number, number][][]}} | undefined = undefined;
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
                        if (!entry.some(x => x.length === recipe.length && x.every((y, i) => y === recipe[i]))) {
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
            if (objs.length === 1 && objs[0].type === 'sl' && objs[0].code in data) {
                compileRecipes(info, data, objs[0].code, recipe, objs[0].x, objs[0].y, count + 1, limit, out, start);
            }
        }
    }
}

/** Searches slow salvos. */
export async function searchSalvos(type: string, start: string, limit: number): Promise<void> {
    let info = c.SALVO_INFO[type];
    let recipes = await loadRecipes();
    let done = new Set<string>();
    let forInput: {[key: string]: [number, number, false | null | CAObject[]][]} = {};
    let queue = [start];
    let i = 0;
    while (true) {
        log(`Searching depth ${i + 1} (${queue.length} objects)`);
        let newQueue: string[] = [];
        for (let j = 0; j < queue.length; j++) {
            let code = queue[j];
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            for (let timing = 0; timing < info.period; timing++) {
                let data = get1GSalvos(info, code, timing);
                if (data) {
                    let [newObjs, newOut] = data;
                    forInput[code] = newOut;
                    newQueue.push(...newObjs);
                }
            }
            log(`Depth ${i + 1} ${(j / queue.length * 100).toFixed(2)}% complete`, true);
        }
        log(`Depth ${i + 1} 100.00% complete, compiling recipes`);
        queue = newQueue;
        if (start === info.startObject) {
            for (let i = 0; i < info.intermediateObjects.length; i++) {
                let obj = info.intermediateObjects[i];
                if (obj in forInput) {
                    let start = stringToObjects(obj + ' (0, 0)')[0] as StableObject;
                    compileRecipes(info, forInput, obj, [], 0, 0, 0, limit - 1, recipes.salvos[type], start);
                }
                log(`Finished compiling recipes for ${i + 1}/${info.intermediateObjects.length} (${((i + 1) / info.intermediateObjects.length * 100).toFixed(1)}%) objects`, true);
            }
        } else {
            let obj = stringToObjects(start + ' (0, 0)')[0] as StableObject;
            compileRecipes(info, forInput, start, [], 0, 0, 0, limit - 1, recipes.salvos[type], obj);
        }
        log('Compiled all recipes');
        await saveRecipes(recipes);
        i++;
    }
}
