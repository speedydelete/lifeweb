
import {MAPPattern} from '../core/index.js';
import * as c from './config.js';
import {StillLife, Spaceship, CAObject, base, translateObjects, objectsToString, findOutcome, getRecipes, saveRecipes} from './util.js';


export interface SalvoInfo<Input extends CAObject = CAObject, Output extends CAObject | null = null> {
    input: (Output extends null ? CAObject : Input)[];
    output: (Output extends null ? Input : Output)[];
    recipes: number[][];
}


export function createSalvoPattern(target: string, lanes: number[]): [MAPPattern, number, number] {
    let minLane = Math.min(0, ...lanes);
    let p = base.copy();
    for (let i = 0; i < lanes.length; i++) {
        let lane = lanes[i];
        let y = i * c.GLIDER_SPACING_SS;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + c.GLIDER_CELLS[0][0], y + c.GLIDER_CELLS[0][1]);
        for (let cell of c.GLIDER_CELLS[0][2]) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
    let q = base.loadApgcode(target);
    let yPos = (lanes.length - 1) * c.GLIDER_SPACING_SS + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - c.LANE_OFFSET + q.height - minLane;
    p.ensure(q.width + xPos, q.height + yPos);
    p.insert(q, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}


function findSalvoResult(target: string, lanes: number[]): 'no' | null | false | CAObject[] {
    let [p, xPos, yPos] = createSalvoPattern(target, lanes);
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
    return findOutcome(p, xPos, yPos);
}

function get1GSalvos(target: string): false | [Set<string>, [number, false | null | CAObject[]][]] {
    let originalTarget = target;
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    let out: [number, false | null | CAObject[]][] = [];
    let failed = false;
    let hadCollision = false;
    let lane = 0;
    let data = findSalvoResult(target, [lane]);
    if (data === 'no') {
        return false;
    }
    while (data !== null) {
        lane--;
        data = findSalvoResult(target, [lane]);
        if (data === 'no') {
            return false;
        }
        if (lane === -c.LANE_LIMIT) {
            return false;
        }
    }
    lane++;
    for (; lane < c.LANE_LIMIT; lane++) {
        let data = findSalvoResult(target, [lane]);
        if (data === 'no') {
            return false;
        }
        if (data && data.length === 1 && data[0].type === 'sl' && data[0].code === originalTarget && data[0].x === 0 && data[0].y === 0) {
            continue;
        }
        out.push([lane, data]);
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
        if (lane === c.LANE_LIMIT - 1) {
            return false;
        }
    }
    return [newObjs, out];
}

function getForOutputRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [CAObject[], StillLife[], Spaceship[], number[][]]}, add: CAObject[] = []): void {
    for (let [lane, objs] of data[code]) {
        if (!objs || objs.length === 0 || objs.some(x => x.type === 'other')) {
            continue;
        }
        let recipe = prefix.concat(lane - y + x);
        objs = objs.concat(add.map(value => {
            let out = structuredClone(value);
            if (out.type !== 'sl' && out.type !== 'other') {
                // @ts-ignore
                out.n = count;
            }
            return out;
        }));
        objs = translateObjects(objs, x, y);
        let str = objectsToString(objs);
        if (str) {
            if (str in out) {
                out[str][3].push(recipe);
            } else {
                let sls: StillLife[] = [];
                let ships: Spaceship[] = [];
                for (let obj of objs) {
                    if (obj.type === 'sl') {
                        sls.push(obj);
                    } else if (obj.type === 'other') {
                        throw new Error('Non-SL or spaceship object present after filtering!');
                    } else {
                        ships.push(obj);
                    }
                }
                out[str] = [objs, sls, ships, [recipe]];
            }
            if (count < limit) {
                if (objs.length === 1 && objs[0].type === 'sl' && objs[0].code in data) {
                    getForOutputRecipes(data, objs[0].code, recipe, objs[0].x, objs[0].y, count + 1, limit, out);
                } else {
                    for (let i = 0; i < objs.length; i++) {
                        let obj = objs[i];
                        if (obj.type === 'sl' && obj.code in data) {
                            getForOutputRecipes(data, obj.code, recipe, obj.x, obj.y, count + 1, limit, out, objs.toSpliced(i, 1));
                        }
                    }
                }
            }
        }
    }
}

function addRecipes(data: number[][], newData: number[][]): void {
    for (let recipe of newData) {
        if (!data.some(x => x.length === recipe.length && x.every((y, i) => y === recipe[i]))) {
            data.push(recipe);
        }
    }
}

export async function searchSalvos(limit: number): Promise<void> {
    let done = new Set<string>();
    let forInput: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [c.START_OBJECT];
    for (let i = 0; i < limit; i++) {
        let newQueue: string[] = [];
        for (let code of queue) {
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            let data = get1GSalvos(code);
            if (data) {
                let [newObjs, newOut] = data;
                forInput[code] = newOut;
                newQueue.push(...newObjs);
            }
        }
        queue = newQueue;
    }
    console.log('Completed search, compiling recipes');
    let forOutput: {[key: string]: [CAObject[], StillLife[], Spaceship[], number[][]]} = {};
    for (let obj in forInput) {
        getForOutputRecipes(forInput, obj, [], 0, 0, 0, limit - 1, forOutput);
    }
    let recipes = await getRecipes();
    let data = recipes.salvos;
    for (let key in forInput) {
        if (!(key in data.forInput)) {
            data.forInput[key] = forInput[key].filter(x => x[1]) as [number, CAObject[]][];
        }
    }
    for (let key in forOutput) {
        if (key in data.forOutput) {
            addRecipes(forOutput[key][3], data.forOutput[key][3]);
        } else {
            data.forOutput[key] = forOutput[key];
        }
    }
    for (let [key, [input, outLifes, outShips, recipes]] of Object.entries(forOutput)) {
        if (input.length === 1 && input[0].type === 'sl') {
            if (outLifes.length === 0) {
                if (outShips.length === 0) {
                    if (data.destroyRecipes[key]) {
                        addRecipes(recipes, data.destroyRecipes[key]);
                    } else {
                        data.destroyRecipes[key] = recipes;
                    }
                } else {
                    let recipes2 = recipes.filter(x => x.length === 1).map(x => x[0]);
                    if (recipes2.length > 0) {
                        if (outShips.length === 1) {
                            if (data.oneTimeTurners[key]) {
                                let list = data.oneTimeTurners[key];
                                let index = list.findIndex(x => x[0] === key);
                                if (index === -1) {
                                    list.push([key, input[0], outShips[0], recipes2]);
                                } else {
                                    for (let lane of recipes2) {
                                        if (!list[index][3].includes(lane)) {
                                            list[index][3].push(lane);
                                        }
                                    }
                                }
                            } else {
                                data.oneTimeTurners[key] = [[key, input[0], outShips[0], recipes2]];
                            }
                        } else {
                            key = objectsToString(outShips);
                            if (data.oneTimeSplitters[key]) {
                                let list = data.oneTimeSplitters[key];
                                let index = list.findIndex(x => x[0] === key);
                                if (index === -1) {
                                    list.push([key, input[0], outShips, recipes2]);
                                } else {
                                    for (let lane of recipes2) {
                                        if (!list[index][3].includes(lane)) {
                                            list[index][3].push(lane);
                                        }
                                    }
                                }
                            } else {
                                data.oneTimeSplitters[key] = [[key, input[0], outShips, recipes2]];
                            }
                        }
                    }
                }
            } else {
                if (outShips.length === 0) {
                    if (outLifes.length === 1) {
                        if (data.basicRecipes[key]) {
                            addRecipes(recipes, data.basicRecipes[key][2]);
                        } else {
                            data.basicRecipes[key] = [input[0], outLifes[1], recipes];
                        }
                    } else {
                        if (data.splitRecipes[key]) {
                            addRecipes(recipes, data.splitRecipes[key][2]);
                        } else {
                            data.splitRecipes[key] = [input[0], outLifes, recipes];
                        }
                    }
                }
            }
        }
        if (outShips.length === 0 && input.every(x => x.type === 'sl')) {
            if (data.tileRecipes[key]) {
                addRecipes(recipes, data.splitRecipes[key][2]);
            } else {
                let shortest = recipes[0];
                for (let recipe of recipes.slice(1)) {
                    if (recipe.length < shortest.length) {
                        shortest = recipe;
                    }
                }
                data.tileRecipes[key] = [input, outLifes, shortest];
            }
        }
    }
    saveRecipes(recipes);
}
