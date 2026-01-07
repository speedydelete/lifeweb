
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {MAPPattern, identify, getKnots, INTSeparator, createPattern, toCatagolueRule} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';


export interface BaseObject {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface StillLife extends BaseObject {
    type: 'sl';
    code: string;
}

export interface OtherObject extends BaseObject {
    type: 'other';
    code: string;
}

export interface Spaceship extends BaseObject {
    type: c.ShipName;
    dir: c.ShipDirection;
    t: number;
    n: number;
}

export type CAObject = StillLife | OtherObject | Spaceship;


export let base = createPattern(c.RULE) as MAPPattern;


export function translateObjects<T extends CAObject>(objs: T[], x: number, y: number): T[] {
    return objs.map(obj => {
        obj = structuredClone(obj);
        obj.x += x;
        obj.y += y;
        return obj;
    });
}

function xyCompare(a: CAObject, b: CAObject): number {
    if (a.y < b.y) {
        return -1;
    } else if (a.y > b.y) {
        return 1;
    } else if (a.x < b.x) {
        return -1;
    } else if (a.x > b.x) {
        return 1;
    } else {
        return 0;
    }
}

export function objectSorter(a: CAObject, b: CAObject): number {
    if (a.type === 'sl') {
        if (b.type !== 'sl') {
            return -1;
        } else if (a.code < b.code) {
            return -1;
        } else if (a.code > b.code) {
            return 1;
        } else {
            return xyCompare(a, b);
        }
    } else if (a.type === 'other') {
        if (b.type !== 'other') {
            return 1;
        } else if (a.code < b.code) {
            return -1;
        } else if (a.code > b.code) {
            return 1;
        } else {
            return xyCompare(a, b);
        }
    } else {
        if (b.type === 'other') {
            return -1;
        } else if (a.type === b.type) {
            if (a.t < b.t) {
                return -1;
            } else if (a.t > b.t) {
                return 1;
            } else {
                return xyCompare(a, b);
            }
        } else if (a.type < b.type) {
            return -1;
        } else {
            return 1;
        }
    }
}

export function objectsSorter(a: CAObject[], b: CAObject[]): number {
    if (a.length < b.length) {
        return -1;
    } else if (a.length > b.length) {
        return 1;
    } else {
        // @ts-ignore
        a = a.toSorted(objectSorter);
        // @ts-ignore
        b = b.toSorted(objectSorter);
        for (let i = 0; i < a.length; i++) {
            let out = objectSorter(a[i], b[i]);
            if (out !== 0) {
                return out;
            }
        }
        return 0;
    }
}


export function objectsToString(objs: CAObject[]): string {
    if (objs.length === 0) {
        return 'nothing';
    }
    let out: string[] = [];
    for (let obj of objs.sort(objectSorter)) {
        if (obj.type === 'sl' || obj.type === 'other') {
            out.push(`${obj.code} (${obj.x}, ${obj.y})`);
        } else {
            out.push(`${obj.dir} ${obj.type} (${obj.x}, ${obj.y}) timing ${obj.t} at ${obj.n}`);
        }
    }
    return out.join(', ');
}

export function stringToObjects(data: string): CAObject[] {
    let objs: string[] = [];
    let inParen = false;
    let current = '';
    for (let char of data) {
        if (char === '(') {
            inParen = true;
        } else if (char === ')') {
            inParen = false;
        } else if (char === ',' && !inParen) {
            objs.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    let out: CAObject[] = [];
    for (let obj in objs) {
        let parts = obj.split(' ');
        if (parts[0].startsWith('xs')) {
            let p = base.loadApgcode(parts[0]).shrinkToFit();
            out.push({
                type: 'sl',
                code: parts[0],
                x: parseInt(parts[0].slice(1)),
                y: parseInt(parts[0]),
                width: p.width,
                height: p.height,
            });
        } else if (parts.length === 3) {
            let p = base.loadApgcode(parts[0]).shrinkToFit();
            out.push({
                type: 'other',
                code: parts[0],
                x: parseInt(parts[0].slice(1)),
                y: parseInt(parts[0]),
                width: p.width,
                height: p.height,
            });
        } else {
            let type = parts[1] as c.ShipName;
            out.push({
                type,
                dir: parts[0] as c.ShipDirection,
                x: parseInt(parts[2].slice(1)),
                y: parseInt(parts[3]),
                height: c.SHIP_IDENTIFICATION[type].height,
                width: c.SHIP_IDENTIFICATION[type].width,
                t: parseInt(parts[5]),
                n: parseInt(parts[7]),
            });
        }
    }
    return out;
}


export function distance(a: CAObject, b: CAObject): number {
    return Math.abs(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) + Math.abs(Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
}

function stabilize(p: MAPPattern): number | null {
    let pops: number[] = [];
    for (let i = 0; i < c.MAX_GENERATIONS; i++) {
        p.runGeneration();
        let pop = p.population;
        for (let period = 1; period < Math.min(c.MAX_GENERATIONS, Math.floor(pops.length / c.PERIOD_SECURITY)); period++) {
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return period;
            }
        }
        pops.push(pop);
    }
    return null;
}

function combineStillLifes(objs: (StillLife & {p: MAPPattern})[]): false | CAObject[] {
    let out: CAObject[] = [];
    let used = new Uint8Array(objs.length);
    for (let i = 0; i < objs.length; i++) {
        let obj = objs[i];
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let data = [];
        for (let j = 0; j < objs.length; j++) {
            if (used[j]) {
                continue;
            }
            if (distance(obj, objs[j]) <= c.MAX_PSEUDO_DISTANCE) {
                used[j] = 1;
                data.push(objs[j]);
            }
        }
        if (data.length === 0) {
            out.push({
                type: 'sl',
                code: obj.code,
                x: obj.x,
                y: obj.y,
                width: obj.width,
                height: obj.height,
            });
            continue;
        }
        let minX = obj.x;
        let maxX = obj.x + obj.width;
        let minY = obj.y;
        let maxY = obj.y + obj.height;
        for (let obj of data) {
            if (obj.x < minX) {
                minX = obj.x;
            }
            if (obj.x + obj.width > maxX) {
                maxX = obj.x + obj.width;
            }
            if (obj.y < minY) {
                minY = obj.y;
            }
            if (obj.y + obj.height > maxY) {
                maxY = obj.y + obj.height;
            }
        }
        let p = base.copy();
        p.height = maxY - minY;
        p.width = maxX - minX;
        p.size = p.height * p.width;
        p.data = new Uint8Array(p.size);
        p.insert(obj.p, obj.x - minX, obj.y - minY);
        for (let obj of data) {
            p.insert(obj.p, obj.x - minX, obj.y - minY);
        }
        p.shrinkToFit();
        let type = identify(p, 2, false);
        if (type.period !== 1 || !type.disp || type.disp[0] !== 0 || type.disp[1] !== 0) {
            return false;
        }
        out.push({
            type: 'sl',
            code: p.toApgcode('xs' + p.population),
            x: minX,
            y: minY,
            width: p.width,
            height: p.height,
        });
    }
    return out;
}

let knots = getKnots(base.trs);

export function findOutcome(p: MAPPattern, xPos: number, yPos: number): false | CAObject[] {
    let period = stabilize(p);
    if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
        return false;
    }
    p.run(c.EXTRA_GENERATIONS);
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    let sep = new INTSeparator(p, knots);
    sep.generation = p.generation;
    for (let i = 0; i < c.SEPARATOR_GENERATIONS; i++) {
        sep.runGeneration();
        sep.resolveKnots();
    }
    let out: CAObject[] = [];
    let stillLifes: (StillLife & {p: MAPPattern})[] = [];
    for (let p of sep.getObjects()) {
        if (p.isEmpty()) {
            return false;
        }
        p.shrinkToFit();
        p.generation = sep.generation;
        let type = identify(p, 1024, false);
        if (type.apgcode.startsWith('xs')) {
            if (type.apgcode === 'xs0_0') {
                return false;
            }
            stillLifes.push({
                type: 'sl',
                x: p.xOffset,
                y: p.yOffset,
                width: p.width,
                height: p.height,
                p,
                code: p.toApgcode('xs' + p.population),
            });
        } else if (type.apgcode in c.SHIP_IDENTIFICATION) {
            let {name, data: info} = c.SHIP_IDENTIFICATION[type.apgcode];
            let found = false;
            for (let {height, width, population, data} of info) {
                if (p.height === height && p.width === width && p.population === population) {
                    for (let [cells, dir, timing] of data) {
                        found = true;
                        for (let i of cells) {
                            if (!p.data[i]) {
                                found = false;
                                break;
                            }
                        }
                        if (found) {
                            p.run(timing).shrinkToFit();
                            out.push({
                                type: name,
                                x: p.xOffset,
                                y: p.yOffset,
                                width: p.width,
                                height: p.height,
                                dir,
                                t: p.generation,
                                n: 0,
                            })
                            break;
                        }
                    }
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                throw new Error(`Invalid glider: ${p.toRLE()}`);
            }
        } else if (type.apgcode === 'PATHOLOGICAL' || type.apgcode.startsWith('zz')) {
            return false;
        } else {
            out.push({
                type: 'other',
                x: p.xOffset,
                y: p.yOffset,
                width: p.width,
                height: p.height,
                code: type.apgcode,
            });
        }
    }
    let data = combineStillLifes(stillLifes);
    if (!data) {
        return false;
    }
    out.push(...data);
    return out;
}


export interface RecipeData {
    salvos: {
        forInput: {[key: string]: [number, CAObject[]][]};
        forOutput: {[key: string]: [CAObject[], StillLife[], Spaceship[], number[][]]};
        tileRecipes: {[key: string]: [StillLife[], StillLife[], number[]]},
        basicRecipes: {[key: string]: [StillLife, StillLife, number[][]]};
        splitRecipes: {[key: string]: [StillLife, StillLife[], number[][]]};
        destroyRecipes: {[key: string]: number[][]};
        oneTimeTurners: {[key: string]: [string, StillLife, Spaceship, number[]][]};
        oneTimeSplitters: {[key: string]: [string, StillLife, Spaceship[], number[]][]};
    };
    compilation: {
        tileSize: number;
        tiles: {[key: string]: {[key: string]: number[]}};
    };
}

let recipeFile = `recipes_${toCatagolueRule(c.RULE)}`;

export async function getRecipes(): Promise<RecipeData> {
    if (exists('recipes.json')) {
        return JSON.parse((await fs.readFile(recipeFile)).toString());
    } else {
        return {
            salvos: {
                forInput: {},
                forOutput: {},
                tileRecipes: {},
                basicRecipes: {},
                splitRecipes: {},
                destroyRecipes: {},
                oneTimeTurners: {},
                oneTimeSplitters: {},
            },
            compilation: {
                tileSize: 0,
                tiles: {},
            },
        };
    }
}

export async function saveRecipes(recipes: RecipeData): Promise<void> {
    await fs.writeFile(recipeFile, JSON.stringify(recipes));
}
