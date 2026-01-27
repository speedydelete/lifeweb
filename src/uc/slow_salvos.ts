
import {MAPPattern} from '../core/index.js';
import {c, StillLife, Spaceship, StableObject, CAObject, base, gliderPattern, translateObjects, objectsToString, stringToObjects, findOutcome, getRecipes, saveRecipes} from './base.js';


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
        let y = i * c.GLIDER_SPACING;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + gliderPattern.width, y + gliderPattern.height);
        p.insert(gliderPattern, x, y);
    }
    let q = base.loadApgcode(target).shrinkToFit();
    let yPos = (lanes.length - 1) * c.GLIDER_SPACING + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - c.LANE_OFFSET + 5 - minLane;
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
    data = findSalvoResult(target, [lane]);
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
    let hadCollision = false;
    for (; lane < c.LANE_LIMIT; lane++) {
        console.log('searching', target, lane);
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

function getForOutputRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [StableObject, CAObject[], StableObject[], Spaceship[], number[][]]}, start: StableObject, add?: CAObject[]): void {
    let startStr: string;
    if (start.type === 'sl') {
        startStr = `${start.code} to `;
    } else {
        startStr = `${start.code} (${start.phase}) to `;
    }
    for (let [lane, objs] of data[code]) {
        if (!objs) {
            continue;
        }
        let recipe = prefix.concat(lane + x - y);
        if (add) {
            objs = objs.concat(add.map(value => {
                let out = structuredClone(value);
                if ('at' in out) {
                    out.at = count;
                }
                return out;
            }));
        }
        objs = translateObjects(objs, x, y);
        let str = startStr + objectsToString(objs);
        if (str in out) {
            out[str][4].push(recipe);
        } else {
            let stable: StableObject[] = [];
            let ships: Spaceship[] = [];
            for (let obj of objs) {
                if (obj.type === 'sl' || obj.type === 'osc') {
                    stable.push(obj);
                } else if (obj.type === 'ship') {
                    ships.push(obj);
                }
            }
            out[str] = [start, objs, stable, ships, [recipe]];
        }
        if (count < limit) {
            if (objs.length === 1 && objs[0].type === 'sl' && objs[0].code in data) {
                getForOutputRecipes(data, objs[0].code, recipe, objs[0].x, objs[0].y, count + 1, limit, out, start);
            }
        }
    }
}

function addRecipes<T extends PropertyKey>(data: {[K in T]?: number[][]}, newData: number[][], key: T): void {
    if (data[key]) {
        for (let recipe of newData) {
            if (!data[key].some(x => x.length === recipe.length && x.every((y, i) => y === recipe[i]))) {
                data[key].push(recipe);
            }
        }
    } else {
        data[key] = newData;
    }
}

function addRecipesSubkey<T extends PropertyKey, U extends PropertyKey>(data: {[K in T]?: {[K in U]: number[][]}}, newData: {[K in U]: number[][]}, key: T, subkey: U): void {
    if (data[key]) {
        for (let recipe of newData[subkey]) {
            if (!data[key][subkey].some(x => x.length === recipe.length && x.every((y, i) => y === recipe[i]))) {
                data[key][subkey].push(recipe);
            }
        }
    } else {
        data[key] = newData;
    }
}

export async function searchSalvos(start: string, limit: number): Promise<void> {
    let recipes = await getRecipes();
    let done = new Set<string>();
    let forInput: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [start];
    let prevUpdateTime = performance.now();
    for (let i = 0; i < limit; i++) {
        console.log(`Searching depth ${i + 1}`);
        prevUpdateTime = performance.now();
        let newQueue: string[] = [];
        for (let j = 0; j < queue.length; j++) {
            let code = queue[j];
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
            let now = performance.now();
            if (now - prevUpdateTime > 1000) {
                console.log(`Depth ${i + 1} ${(j / queue.length * 100).toFixed(2)}% complete`);
                prevUpdateTime = now;
            }
        }
        console.log(`Depth ${i + 1} 100.00% complete`);
        prevUpdateTime = performance.now();
        queue = newQueue;
        let forOutput: {[key: string]: [StableObject, CAObject[], StableObject[], Spaceship[], number[][]]} = {};
        console.log('Compiling recipes');
        prevUpdateTime = performance.now();
        if (start === c.START_OBJECT) {
            for (let i = 0; i < c.INTERMEDIATE_OBJECTS.length; i++) {
                let obj = c.INTERMEDIATE_OBJECTS[i];
                if (obj in forInput) {
                    let start = stringToObjects(obj + ' (0, 0)')[0] as StableObject;
                    getForOutputRecipes(forInput, obj, [], 0, 0, 0, limit - 1, forOutput, start);
                }
                let now = performance.now();
                if (now - prevUpdateTime > 1000) {
                    console.log(`Finished compiling recipes for ${i + 1} out of ${c.INTERMEDIATE_OBJECTS.length} objects`);
                    prevUpdateTime = now;
                }
            }
        }
        console.log('Compiled all recipes');
        prevUpdateTime = performance.now();
        for (let obj of start === c.START_OBJECT ? c.INTERMEDIATE_OBJECTS : [start]) {

        }
        let data = recipes.salvos;
        for (let key in forInput) {
            if (!(key in data.forInput)) {
                data.forInput[key] = forInput[key].filter(x => x[1]) as [number, CAObject[]][];
            }
        }
        for (let [key, value] of Object.entries(forOutput)) {
            addRecipesSubkey(data.forOutput, [value[0], value[1], value[4]] as const, key, 2);
        }
        for (let [key, [input, outFull, outStable, outShips, recipes]] of Object.entries(forOutput)) {
            if (outFull.length !== outStable.length + outShips.length) {
                continue;
            }
            if (outStable.length === 0) {
                if (outShips.length === 0) {
                    addRecipes(data.destroyRecipes, recipes, input.code);
                } else if (outShips.length === 1) {
                    addRecipesSubkey(data.oneTimeTurners, [input, outShips[0], recipes] as const, key, 2);
                } else {
                    addRecipesSubkey(data.oneTimeSplitters, [input, outShips, recipes] as const, key, 2);
                }
            } else {
                if (outShips.length === 0 && outStable.every(x => c.INTERMEDIATE_OBJECTS.includes(x.code))) {
                    if (outStable.length === 1) {
                        addRecipesSubkey(data.moveRecipes, [input, outStable[1], recipes] as const, key, 2);
                    } else {
                        addRecipesSubkey(data.splitRecipes, [input, outStable, recipes] as const, key, 2);
                    }
                }
            }
        }
        await saveRecipes(recipes);
    }
}
