
import {MAPPattern} from '../core/index.js';
import {c, StillLife, Spaceship, CAObject, base, gliderPattern, translateObjects, objectsToString, findOutcome, getRecipes, saveRecipes} from './util.js';


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
    let q = base.loadApgcode(target);
    let yPos = (lanes.length - 1) * c.GLIDER_SPACING + c.GLIDER_TARGET_SPACING;
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

function getForOutputRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [CAObject[], StillLife[], Spaceship[], number[][]]}, start: string, add: CAObject[] = []): void {
    for (let [lane, objs] of data[code]) {
        if (!objs || objs.length === 0 || objs.some(x => x.type === 'other')) {
            continue;
        }
        let recipe = prefix.concat(lane - y + x);
        objs = objs.concat(add.map(value => {
            let out = structuredClone(value);
            if ('at' in out) {
                out.at = count;
            }
            return out;
        }));
        objs = translateObjects(objs, x, y);
        let str = start + ' to ' + objectsToString(objs);
        if (str) {
            if (str in out) {
                out[str][3].push(recipe);
            } else {
                let sls: StillLife[] = [];
                let ships: Spaceship[] = [];
                for (let obj of objs) {
                    if (obj.type === 'sl') {
                        sls.push(obj);
                    } else if (obj.type === 'ship') {
                        ships.push(obj);
                    }
                }
                out[str] = [objs, sls, ships, [recipe]];
            }
            if (count < limit) {
                if (objs.length === 1 && objs[0].type === 'sl' && objs[0].code in data) {
                    getForOutputRecipes(data, objs[0].code, recipe, objs[0].x, objs[0].y, count + 1, limit, out, start);
                } else {
                    for (let i = 0; i < objs.length; i++) {
                        let obj = objs[i];
                        if (obj.type === 'sl' && obj.code in data) {
                            getForOutputRecipes(data, obj.code, recipe, obj.x, obj.y, count + 1, limit, out, start, objs.toSpliced(i, 1));
                        }
                    }
                }
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

export async function searchSalvos(limit: number): Promise<void> {
    let done = new Set<string>();
    let forInput: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [c.START_OBJECT];
    let prevUpdateTime = performance.now();
    for (let i = 0; i < limit; i++) {
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
            if (now - prevUpdateTime > 1500) {
                console.log(`Depth ${i + 1} ${(j / queue.length).toFixed(2)}% complete`);
                prevUpdateTime = now;
            }
        }
        console.log(`Depth ${i + 1} 100.00% complete`);
        prevUpdateTime = performance.now();
        queue = newQueue;
    }
    console.log('Completed search, compiling recipes');
    let forOutput: {[key: string]: [CAObject[], StillLife[], Spaceship[], number[][]]} = {};
    for (let obj in forInput) {
        getForOutputRecipes(forInput, obj, [], 0, 0, 0, limit - 1, forOutput, obj);
    }
    let recipes = await getRecipes();
    let data = recipes.salvos;
    for (let key in forInput) {
        if (!(key in data.forInput)) {
            data.forInput[key] = forInput[key].filter(x => x[1]) as [number, CAObject[]][];
        }
    }
    for (let key in forOutput) {
        addRecipesSubkey(data.forOutput, [forOutput[key][0], forOutput[key][3]] as const, key, 1);
    }
    for (let [key, [input, outLifes, outShips, recipes]] of Object.entries(forOutput)) {
        if (input.length === 1 && input[0].type === 'sl') {
            if (outLifes.length === 0) {
                if (outShips.length === 0) {
                    addRecipes(data.destroyRecipes, recipes, input[0].code);
                }
            } else {
                if (outShips.length === 0) {
                    if (outLifes.length === 1) {
                        addRecipesSubkey(data.moveRecipes, [input[0], outLifes[1], recipes] as const, key, 2);
                    } else {
                        addRecipesSubkey(data.splitRecipes, [input[0], outLifes, recipes] as const, key, 2);
                    }
                }
            }
        }
        if (outShips.length === 0 && input.every(x => x.type === 'sl')) {
            let shortest = recipes[0];
            for (let recipe of recipes.slice(1)) {
                if (recipe.length < shortest.length) {
                    shortest = recipe;
                }
            }
        }
    }
    saveRecipes(recipes);
}

