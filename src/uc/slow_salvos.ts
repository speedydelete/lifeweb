
import {MAPPattern} from '../core/index.js';
import * as c from './config.js';
import {StillLife, Spaceship, CAObject, getRecipes, saveRecipes, base, findOutcome} from './util.js';


export interface Salvo {
    target: string;
    lanes: number[];
}


export function createSalvoPattern(s: Salvo): [MAPPattern, number, number] {
    let minLane = Math.min(0, ...s.lanes);
    let p = base.copy();
    for (let i = 0; i < s.lanes.length; i++) {
        let lane = s.lanes[i];
        let y = i * c.GLIDER_SPACING_SS;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + c.GLIDER_CELLS[0][0], y + c.GLIDER_CELLS[0][1]);
        for (let cell of c.GLIDER_CELLS[0][2]) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
    let target = base.loadApgcode(s.target);
    let yPos = (s.lanes.length - 1) * c.GLIDER_SPACING_SS + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - c.LANE_OFFSET + target.height - minLane;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}

export function getSalvoKey(data: false | null | CAObject[], input?: string): false | string {
    if (!data) {
        return false;
    }
    let prefix = input === undefined ? '' : input + ' to ';
    if (data.length === 0) {
        return prefix + 'nothing';
    }
    let stillLifes: StillLife[] = [];
    let ships: Spaceship[] = [];
    for (let obj of data) {
        if (obj.type === 'sl') {
            stillLifes.push(obj);
        } else if (obj.type === 'other') {
            return false;
        } else {
            ships.push(obj);
        }
    }
    stillLifes = stillLifes.sort((a, b) => {
        if (a.x < b.x) {
            return -1;
        } else if (a.x > b.x) {
            return 1;
        } else if (a.y < b.y) {
            return -1;
        } else if (a.y > b.y) {
            return 1;
        } else {
            return 0;
        }
    });
    ships = ships.sort((a, b) => {
        if (a.type !== b.type) {
            if (a.type < b.type) {
                return -1;
            } else {
                return 1;
            }
        }
        if (a.t < b.t) {
            return -1;
        } else if (a.t > b.t) {
            return 1;
        }
        let aLane = c.findLane(a);
        let bLane = c.findLane(b);
        if (aLane < bLane) {
            return -1;
        } else if (aLane > bLane) {
            return 1;
        } else {
            return 1;
        }
    });
    let out = '';
    for (let obj of stillLifes) {
        out += obj.code + ' (' + obj.x + ', ' + obj.y + '), ';
    }
    for (let ship of ships) {
        out += `${ship.dir} ${ship.type} lane ${c.findLane(ship)} emitted ${ship.n} timing ${ship.t}, `;
    }
    return out.slice(0, -2);
}


function findSalvoResult(s: Salvo): false | null | true | CAObject[] {
    let [p, xPos, yPos] = createSalvoPattern(s);
    let found = false;
    let prevPop = p.population;
    for (let i = 0; i < s.lanes.length * c.WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            if (i === 0) {
                return true;
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
    let data = findSalvoResult({target, lanes: [lane]});
    if (data === true) {
        return false;
    }
    while (data !== null) {
        lane--;
        data = findSalvoResult({target, lanes: [lane]});
        if (data === true) {
            return false;
        }
        if (lane === -c.LANE_LIMIT) {
            return false;
        }
    }
    lane++;
    for (; lane < c.LANE_LIMIT; lane++) {
        let s = {target, lanes: [lane]};
        let data = findSalvoResult(s);
        if (data === true) {
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

function getForOutputRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [string, StillLife[], Spaceship[], number[][]]}, add: CAObject[] = []): void {
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
        objs = objs.map(value => {
            let out = structuredClone(value);
            out.x += x;
            out.y += y;
            return out;
        });
        let str = getSalvoKey(objs, code);
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
                out[str] = [code, sls, ships, [recipe]];
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
    let forOutput: {[key: string]: [string, StillLife[], Spaceship[], number[][]]} = {};
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
    let stillLifes = new Set(data.stillLifes);
    for (let [key, [input, outLifes, outShips, recipes]] of Object.entries(forOutput)) {
        stillLifes.add(input);
        if (outLifes.length === 0) {
            if (outShips.length === 0) {
                if (data.destroyRecipes[input]) {
                    addRecipes(recipes, data.destroyRecipes[input]);
                } else {
                    data.destroyRecipes[input] = recipes;
                }
            } else {
                let recipes2 = recipes.filter(x => x.length === 1).map(x => x[0]);
                if (recipes2.length > 0) {
                    continue;
                }
                if (outShips.length === 1) {
                    if (data.oneTimeTurners[key]) {
                        let list = data.oneTimeTurners[key];
                        let index = list.findIndex(x => x[0] === input);
                        if (index === -1) {
                            list.push([input, outShips[0], recipes2]);
                        } else {
                            for (let lane of recipes2) {
                                if (!list[index][2].includes(lane)) {
                                    list[index][2].push(lane);
                                }
                            }
                        }
                    } else {
                        data.oneTimeTurners[key] = [[input, outShips[0], recipes2]];
                    }
                } else {
                    key = getSalvoKey(outShips) as string;
                    if (data.oneTimeSplitters[key]) {
                        let list = data.oneTimeSplitters[key];
                        let index = list.findIndex(x => x[0] === input);
                        if (index === -1) {
                            list.push([input, outShips, recipes2]);
                        } else {
                            for (let lane of recipes2) {
                                if (!list[index][2].includes(lane)) {
                                    list[index][2].push(lane);
                                }
                            }
                        }
                    } else {
                        data.oneTimeSplitters[key] = [[input, outShips, recipes2]];
                    }
                }
            }
        } else {
            for (let obj of outLifes) {
                stillLifes.add(obj.code);
            }
            if (outShips.length === 0) {
                if (outLifes.length === 1) {
                    if (data.basicRecipes[key]) {
                        addRecipes(recipes, data.basicRecipes[key][2]);
                    } else {
                        data.basicRecipes[key] = [input, outLifes[1], recipes];
                    }
                } else {
                    if (data.splitRecipes[key]) {
                        addRecipes(recipes, data.splitRecipes[key][2]);
                    } else {
                        data.splitRecipes[key] = [input, outLifes, recipes];
                    }
                }
            }
        }
    }
    data.stillLifes = Array.from(stillLifes);
    data.lastChange = Date.now() / 1000;
    saveRecipes(recipes);
}
