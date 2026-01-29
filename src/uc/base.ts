
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {MAPPattern, PatternType, findType, getApgcode, getKnots, INTSeparator, toCatagolueRule, createPattern} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';
export * as c from './config.js';


let prevUpdateTime = performance.now();

export function log(msg: string, force?: boolean): void {
    let now = performance.now();
    if (force || now - prevUpdateTime > 1000) {
        console.log(msg);
        prevUpdateTime = now;
    }
}


export const SHIP_DIRECTIONS = ['NW', 'NE', 'SW', 'SE', 'N', 'E', 'S', 'W'];

export interface BaseObject {
    code: string;
    x: number;
    y: number;
}

export interface StillLife extends BaseObject {
    type: 'sl';
}

export interface Oscillator extends BaseObject {
    type: 'osc';
    at: number;
    timing: number;
}

export interface Spaceship extends BaseObject {
    type: 'ship';
    dir: c.ShipDirection;
    at: number;
    timing: number;
}

export interface OtherObject extends BaseObject {
    type: 'other';
    realCode: string;
    at: number;
    timing: number;
}

export type StableObject = StillLife | Oscillator;

export type CAObject = StillLife | Oscillator | Spaceship | OtherObject;


export let base = createPattern(c.RULE) as MAPPattern;

let data = c.SHIP_IDENTIFICATION[c.GLIDER_APGCODE];
let p = base.clearedCopy();
p.height = data.height;
p.width = data.width;
p.size = data.height * data.width;
p.data = new Uint8Array(p.size);
for (let i of data.cells) {
    p.data[i] = 1;
}
export let gliderPattern = p.copy();
export let gliderPatterns: MAPPattern[] = [gliderPattern];
for (let i = 1; i < c.GLIDER_PERIOD; i++) {
    p.runGeneration();
    gliderPatterns.push(p.copy());
}


export function translateObjects<T extends CAObject>(objs: T[], x: number, y: number): T[] {
    return objs.map(obj => {
        obj = structuredClone(obj);
        obj.x += x;
        obj.y += y;
        return obj;
    });
}

function xyCompare(a: CAObject, b: CAObject): number {
    if (a.y === b.y) {
        return a.x - b.x;
    } else {
        return a.y - b.y;
    }
}

export function objectSorter(a: CAObject, b: CAObject): number {
    if (a.type === 'sl' || a.type === 'osc') {
        if (b.type === a.type) {
            if (a.code.length === b.code.length) {
                if (a.code === b.code) {
                    return xyCompare(a, b);
                } else if (a.code < b.code) {
                    return -1;
                } else {
                    return 1;
                }
            } else {
                return a.code.length - b.code.length;
            }
        } else {
            return a.type === 'osc' && b.type === 'sl' ? 1 : -1;
        }
    } else if (a.type === 'ship') {
        if (b.type === a.type) {
            if (a.code.length === b.code.length) {
                if (a.code === b.code) {
                    if (a.at === b.at) {
                        return xyCompare(a, b);
                    } else {
                        return a.at - b.at;
                    }
                } else if (a.code < b.code) {
                    return -1;
                } else {
                    return 1;
                }
            } else {
                return a.code.length - b.code.length;
            }
        } else {
            return b.type === 'other' ? -1 : 1;
        }
    } else {
        if (b.type === 'other') {
            if (a.realCode === b.realCode) {
                if (a.code === b.code) {
                    return xyCompare(a, b);
                } else if (a.code < b.code) {
                    return -1;
                } else {
                    return 1;
                }
            } else if (a.realCode < b.realCode) {
                return -1;
            } else {
                return 1;
            }
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
        a = a.toSorted(objectSorter);
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
        if (obj.type === 'sl') {
            out.push(`${obj.code} (${obj.x}, ${obj.y})`);
        } else if (obj.type === 'osc') {
            out.push(`${obj.code} (${obj.x}, ${obj.y}, ${obj.at}, ${obj.timing})`);
        } else if (obj.type === 'ship') {
            out.push(`${obj.code} (${obj.dir}, ${obj.x}, ${obj.y}, ${obj.at}, ${obj.timing})`);
        } else {
            out.push(`${obj.code} (${obj.realCode}, ${obj.x}, ${obj.y}, ${obj.at}, ${obj.timing})`);
        }
    }
    return out.join(', ');
}

export function stringToObjects(data: string): CAObject[] {
    data = data.trim();
    if (data === 'nothing') {
        return [];
    }
    let objs: string[] = [];
    let inParen = false;
    let current = '';
    for (let char of data) {
        if (char === ',' && !inParen) {
            objs.push(current.trim());
            current = '';
        } else {
            if (char === '(') {
                inParen = true;
            } else if (char === ')') {
                inParen = false;
            }
            current += char;
        }
    }
    current = current.trim();
    if (current.length > 0) {
        objs.push(current);
    }
    let out: CAObject[] = [];
    for (let obj of objs) {
        let data = obj.split(' (');
        let code = data[0];
        let args = data[1].slice(0, -1).split(', ');
        if (code.startsWith('xs')) {
            out.push({
                type: 'sl',
                code,
                x: parseInt(args[0]),
                y: parseInt(args[1]),
            });
        } else if (code.startsWith('xp')) {
            out.push({
                type: 'osc',
                code,
                x: parseInt(args[0]),
                y: parseInt(args[1]),
                at: parseInt(args[2]),
                timing: parseInt(args[3]),
            });
        } else if (code.startsWith('xq') && SHIP_DIRECTIONS.includes(args[0])) {
            out.push({
                type: 'ship',
                code,
                x: parseInt(args[1]),
                y: parseInt(args[2]),
                dir: args[0] as c.ShipDirection,
                at: parseInt(args[3]),
                timing: parseInt(args[4]),
            });
        } else {
            let p = base.loadApgcode(args[0]).shrinkToFit();
            out.push({
                type: 'other',
                code,
                x: parseInt(args[1].slice(1)),
                y: parseInt(args[2]),
                realCode: args[0],
                at: parseInt(args[3]),
                timing: parseInt(args[4]),
            });
        }
    }
    return out;
}


function combineStillLifes(objs: ((StillLife | Oscillator) & {p: MAPPattern, bb: [number, number, number, number]})[]): false | CAObject[] {
    let out: CAObject[] = [];
    let used = new Uint8Array(objs.length);
    for (let i = 0; i < objs.length; i++) {
        let obj = objs[i];
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let isOsc = obj.type === 'osc';
        let data = [];
        for (let j = 0; j < objs.length; j++) {
            if (used[j]) {
                continue;
            }
            let a = obj;
            let b = objs[j];
            let dist = Math.abs(Math.min(a.bb[2], b.bb[2]) - Math.max(a.bb[0], b.bb[0])) + Math.abs(Math.min(a.bb[3], b.bb[3]) - Math.max(a.bb[1], b.bb[1]));
            if (dist <= c.MAX_PSEUDO_DISTANCE) {
                used[j] = 1;
                data.push(objs[j]);
                isOsc ||= objs[j].type === 'osc';
                continue;
            }
            for (let a of data) {
                let dist = Math.abs(Math.min(a.bb[2], b.bb[2]) - Math.max(a.bb[0], b.bb[0])) + Math.abs(Math.min(a.bb[3], b.bb[3]) - Math.max(a.bb[1], b.bb[1]));
                if (dist <= c.MAX_PSEUDO_DISTANCE) {
                    used[j] = 1;
                    data.push(objs[j]);
                    isOsc ||= objs[j].type === 'osc';
                    break;
                }
            }
        }
        if (data.length === 0) {
            if (obj.type === 'sl') {
                out.push({
                    type: 'sl',
                    code: obj.code,
                    x: obj.x,
                    y: obj.y,
                });
            } else {
                out.push({
                    type: 'osc',
                    code: obj.code,
                    x: obj.x,
                    y: obj.y,
                    at: obj.at,
                    timing: obj.timing,
                })
            }
            continue;
        }
        let [minX, minY, maxX, maxY] = obj.bb;
        for (let obj of data) {
            if (obj.bb[0] < minX) {
                minX = obj.bb[0];
            }
            if (obj.bb[1] < minY) {
                minY = obj.bb[1];
            }
            if (obj.bb[2] > maxX) {
                maxX = obj.bb[2];
            }
            if (obj.bb[3] > maxY) {
                maxY = obj.bb[3];
            }
        }
        maxX++;
        maxY++;
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
        let type = findType(p, 2, false);
        if (type.period !== 1 || !type.disp || type.disp[0] !== 0 || type.disp[1] !== 0) {
            return false;
        }
        if (isOsc) {
            let period = obj.type === 'osc' ? parseInt(obj.code.slice(2)) : 1;
            for (let obj of objs) {
                if (obj.type === 'sl') {
                    continue;
                }
                let objPeriod = parseInt(obj.code.slice(2));
                let gcd = period;
                let b = objPeriod;
                while (b > 0) {
                    let temp = b;
                    b = gcd % b;
                    gcd = temp;
                }
                period = (period * objPeriod) / gcd;
            }
            out.push({
                type: 'osc',
                code: p.toApgcode('xp' + period),
                x: minX,
                y: minY,
                at: 0,
                timing: obj.p.generation % period,
            });
        } else {
            out.push({
                type: 'sl',
                code: p.toApgcode('xs' + p.population),
                x: minX,
                y: minY,
            });
        }
    }
    return out;
}

let knots = getKnots(base.trs);

export function separateObjects(p: MAPPattern, sepGens: number, limit: number, input?: string): false | CAObject[] {
    if (p.isEmpty()) {
        return [];
    }
    let sep = new INTSeparator(p, knots);
    sep.generation = p.generation;
    let objs: [MAPPattern, PatternType][] = [];
    let found = false;
    for (let i = 0; i < sepGens; i++) {
        let reassigned = sep.runGeneration();
        let reassigned2 = sep.resolveKnots();
        if (reassigned || reassigned2) {
            continue;
        }
        objs = sep.getObjects().map(x => [x, findType(x, limit)]);
        if (objs.every(([_, x]) => x.stabilizedAt === 0 && x.pops[x.pops.length - 1] !== 0)) {
            found = true;
            break;
        }
    }
    if (!found) {
        if (input) {
            console.log(`Unable to separate objects for ${input}!`);
        } else {
            console.log(`Unable to separate objects!`);
        }
        return false;
    }
    let out: CAObject[] = [];
    let stableObjects: ((StillLife | Oscillator) & {p: MAPPattern, bb: [number, number, number, number]})[] = [];
    for (let [p, type] of objs) {
        if (p.isEmpty()) {
            return false;
        }
        p.shrinkToFit();
        p.generation = sep.generation;
        let apgcode = getApgcode(type);
        if (apgcode.startsWith('xs')) {
            if (apgcode.startsWith('xs0')) {
                return false;
            }
            stableObjects.push({
                type: 'sl',
                code: p.toApgcode('xs' + p.population),
                x: p.xOffset,
                y: p.yOffset,
                p,
                bb: [p.xOffset, p.yOffset, p.xOffset + p.width - 1, p.yOffset + p.height - 1],
            });
        } else if (apgcode.startsWith('xp')) {
            let q = p.copy().run(type.period);
            stableObjects.push({
                type: 'osc',
                code: p.toApgcode('xp' + type.period),
                x: p.xOffset,
                y: p.yOffset,
                at: 0,
                timing: p.generation % type.period,
                p,
                bb: [q.xOffset, q.yOffset, q.xOffset + q.width - 1, q.yOffset + q.height - 1],
            });
        } else if (apgcode in c.SHIP_IDENTIFICATION) {
            let {data: info} = c.SHIP_IDENTIFICATION[apgcode];
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
                                type: 'ship',
                                code: apgcode,
                                x: p.xOffset,
                                y: p.yOffset,
                                dir,
                                at: 0,
                                timing: p.generation,
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
                throw new Error(`Invalid spaceship: ${p.toRLE()}`);
            }
        } else if (apgcode === 'PATHOLOGICAL' || apgcode.startsWith('zz')) {
            return false;
        } else {
            out.push({
                type: 'other',
                code: apgcode,
                x: p.xOffset,
                y: p.yOffset,
                realCode: p.toApgcode(),
                at: 0,
                timing: p.generation,
            });
        }
    }
    let data = combineStillLifes(stableObjects);
    if (!data) {
        return false;
    }
    out.push(...data);
    return out;
}

function stabilize(p: MAPPattern): number | null {
    let pops: number[] = [];
    for (let i = 0; i < c.MAX_GENERATIONS; i++) {
        p.runGeneration();
        let pop = p.population;
        for (let period = 1; period < Math.floor(pops.length / c.PERIOD_SECURITY); period++) {
            let found = true;
            for (let j = 1; j < c.PERIOD_SECURITY; j++) {
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

export function findOutcome(p: MAPPattern, xPos: number, yPos: number, input?: string): [false | CAObject[], number] {
    p.generation = 0;
    let period = stabilize(p);
    if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
        return [false, p.generation];
    }
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    return [separateObjects(p, period * 8, period * 8, input), p.generation - (period + 1) * c.PERIOD_SECURITY - 1];
}


const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function parseChannelRecipe(data: string): [number, number][] {
    let out: [number, number][] = [];
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (part === '') {
            continue;
        }
        if (part.startsWith('(')) {
            out.push([parseInt(part.slice(1)), -1]);
        } else {
            let timing = parseInt(part);
            let end = part[part.length - 1];
            let index = LETTERS.indexOf(end);
            if (index === -1) {
                out.push([timing, 0]);
            } else {
                out.push([timing, index]);
            }
        }
    }
    return out;
}

export function unparseChannelRecipe(info: c.ChannelInfo, data: [number, number][]): string {
    if (info.channels.length === 1) {
        return data.map(x => x[1] === -1 ? `(${x[0]})` : x[0]).join(', ');
    } else {
        return data.map(x => x[1] === -1 ? `(${x[0]})` : x[0] + LETTERS[x[1]]).join(', ');
    }
}


export interface RecipeData {
    salvos: {
        forInput: {[key: string]: [number, CAObject[]][]};
        forOutput: {[key: string]: [CAObject, CAObject[], number[][]]};
        moveRecipes: {[key: string]: [StableObject, StableObject, number[][]]};
        splitRecipes: {[key: string]: [StableObject, StableObject[], number[][]]};
        destroyRecipes: {[key: string]: number[][]};
        oneTimeTurners: {[key: string]: [StableObject, Spaceship, number[][]]};
        oneTimeSplitters: {[key: string]: [StableObject, Spaceship[], number[][]]};
    };
    channels: {[key: string]: {
        moveRecipes: [number, [number, number][]][];
        recipes90Deg: [number, boolean, number, [number, number][]][];
        recipes0Deg: [number, number, [number, number][]][];
        createHandRecipes: [StillLife, number, [number, number][]][];
    }};
}

let recipeFile = `recipes_${toCatagolueRule(c.RULE)}.txt`;

function parseRecipeSections(data: string[]): [string, string[]][] {
    let out: [string, string[]][] = [];
    let name: string | undefined = undefined;
    let current: string[] = [];
    for (let line of data) {
        if (line.endsWith(':')) {
            if (typeof name === 'string' && current.length > 0) {
                out.push([name, current]);
            }
            name = line.slice(0, -1);
            current = [];
        } else {
            current.push(line);
        }
    }
    if (typeof name === 'string' && current.length > 0) {
        out.push([name, current]);
    }
    return out;
}

function addSection(section: string, current: string[], out: RecipeData): void {
    if (section === 'Salvos (for input)') {
        for (let [apgcode, data] of parseRecipeSections(current)) {
            out.salvos.forInput[apgcode] = data.map(x => x.split(':')).map(x => [parseInt(x[0]), stringToObjects(x[1])]);
        }
    } else if (section === 'Salvos (for output)') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.forOutput[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output), data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'Move recipes') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.moveRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output)[0] as StillLife, data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'Split recipes') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.splitRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output) as StillLife[], data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'Destroy recipes') {
        for (let line of current) {
            let [key, data] = line.split(':');
            out.salvos.destroyRecipes[key] = data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)));
        }
    } else if (section === 'One-time turners') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.oneTimeTurners[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output)[0] as Spaceship, data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'One-time splitters') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.oneTimeSplitters[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output) as Spaceship[], data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section.endsWith('move recipes')) {
        let type = section.slice(0, section.indexOf(' '));
        for (let line of current) {
            let [amount, recipe] = line.split(': ');
            out.channels[type].moveRecipes.push([parseInt(amount), parseChannelRecipe(recipe)]);
        }
    } else if (section.endsWith('90-degree recipes')) {
        let type = section.slice(0, section.indexOf(' '));
        for (let line of current) {
            let data = line.split(' ');
            out.channels[type].recipes90Deg.push([parseInt(data[1]), data[1].endsWith('x'), parseInt(data[3]), parseChannelRecipe(data.slice(4).join(' '))]);
        }
    } else if (section.endsWith('0-degree recipes')) {
        let type = section.slice(0, section.indexOf(' '));
        for (let line of current) {
            let data = line.split(' ');
            out.channels[type].recipes0Deg.push([parseInt(data[1]), parseInt(data[3]), parseChannelRecipe(data.slice(4).join(' '))]);
        }
    } else if (section.endsWith('hand creation recipes')) {
        let type = section.slice(0, section.indexOf(' '));
        for (let line of current) {
            let [data, recipe] = line.split(': ');
            let index = data.lastIndexOf(' (');
            let sl = stringToObjects(data.slice(0, index))[0] as StillLife;
            let move = parseInt(data.slice(index + 2 + 'move '.length));
            out.channels[type].createHandRecipes.push([sl, move, parseChannelRecipe(recipe)]);
        }
    }
}

export async function getRecipes(): Promise<RecipeData> {
    let out: RecipeData = {
        salvos: {
            forInput: {},
            forOutput: {},
            moveRecipes: {},
            splitRecipes: {},
            destroyRecipes: {},
            oneTimeTurners: {},
            oneTimeSplitters: {},
        },
        channels: Object.fromEntries(Object.keys(c.CHANNEL_INFO).map(x => [x, {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], createHandRecipes: []}])),
    };
    if (!exists(recipeFile)) {
        return out;
    }
    let data = (await fs.readFile(recipeFile)).toString();
    let section: string | undefined = undefined;
    let current: string[] = [];
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        } else if (line.endsWith(':')) {
            if (section !== undefined) {
                addSection(section, current, out);
            }
            section = line.slice(0, -1);
            current = [];
            continue;
        } else {
            current.push(line);
        }
    }
    if (section !== undefined) {
        addSection(section, current, out);
    }
    return out;
}

function salvoRecipesToString<T extends boolean>(data: T extends true ? {[key: string]: {2: number[][]}} : {[key: string]: number[][]}, type: T, limit?: number): string {
    let groups: {[key: string]: string[]} = {};
    for (let [key, value] of Object.entries(data)) {
        let keyStart = key.split(' ').slice(0, 3).join(' ');
        let data: number[][] = type ? value[2] : value;
        data = data.sort((a, b) => a.length - b.length);
        if (limit) {
            data = data.slice(0, limit);
        }
        let line = `${key}: ${data.sort((a, b) => a.length - b.length).map(x => x.join(', ')).join(' / ')}`;
        if (keyStart in groups) {
            groups[keyStart].push(line);
        } else {
            groups[keyStart] = [line];
        }
    }
    let out = '';
    for (let key of Object.keys(groups).sort()) {
        out += groups[key].sort((a, b) => {
            let aCount = a.split('),').length;
            let bCount = b.split('),').length;
            if (aCount !== bCount) {
                return aCount - bCount;
            } else if (a < b) {
                return -1;
            } else {
                return 1;
            }
        }).join('\n') + '\n\n';
    }
    return out;
}

export async function saveRecipes(data: RecipeData): Promise<void> {
    let out = '';
    out += '\nSalvos (for input):\n\n';
    for (let [key, value] of Object.entries(data.salvos.forInput)) {
        out += `${key}:\n${value.map(([lane, data]) => lane + ': ' + objectsToString(data)).join('\n')}\n\n`;
    }
    out += '\nSalvos (for output):\n\n' + salvoRecipesToString(data.salvos.forOutput, true);
    out += '\nMove recipes:\n\n' + salvoRecipesToString(data.salvos.moveRecipes, true);
    out += '\nSplit recipes:\n\n' + salvoRecipesToString(data.salvos.splitRecipes, true);
    out += '\nDestroy recipes:\n\n' + salvoRecipesToString(data.salvos.destroyRecipes, false);
    out += '\nOne-time turners:\n\n' + salvoRecipesToString(data.salvos.oneTimeTurners, true);
    out += '\nOne-time splitters:\n\n' + salvoRecipesToString(data.salvos.oneTimeSplitters, true);
    for (let [key, value] of Object.entries(data.channels)) {
        let info = c.CHANNEL_INFO[key];
        out += `\n${key} move recipes:` + value.moveRecipes.sort((a, b) => a[0] - b[0]).map(x => `${x[0]}: ${unparseChannelRecipe(info, x[1])}`).join('\n') + '\n\n';
        let groups: {[key: string]: [number, boolean, number, [number, number][]][]} = {};
        for (let recipe of value.recipes90Deg) {
            let key = recipe[0] + (recipe[1] ? 'x' : 'i');
            if (key in groups) {
                groups[key].push(recipe);
            } else {
                groups[key] = [recipe];
            }
        }
        out += `\n${key} 90-degree recipes:\n\n` + Object.values(groups).sort(([a], [b]) => a[1] === b[1] ? a[0] - b[0] : a[0] - b[0]).map(recipes => recipes.sort((a, b) => a[2] - b[2]).map(x => `emit ${x[0]}${x[1] ? 'x' : 'i'} move ${x[2]}: ${unparseChannelRecipe(info, x[3])}`).join('\n') + '\n\n').join('');
        let groups2: {[key: number]: [number, number, [number, number][]][]} = {};
        for (let recipe of value.recipes0Deg) {
            if (recipe[0] in groups2) {
                groups2[recipe[0]].push(recipe);
            } else {
                groups2[recipe[0]] = [recipe];
            }
        }
        out += `\n${key} 0-degree recipes:\n\n` + Object.entries(groups2).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([_, x]) => x.sort((a, b) => a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]).map(x => `emit ${x[0]} move ${x[1]}: ${unparseChannelRecipe(info, x[2])}`).join('\n') + '\n\n').join('');
        let groups3: {[key: string]: [StillLife, number, [number, number][]][]} = {};
        for (let recipe of value.createHandRecipes) {
            let key = objectsToString([recipe[0]]);
            if (key in groups3) {
                groups3[key].push(recipe);
            } else {
                groups3[key] = [recipe];
            }
        }
        out += `\n${key} hand creation recipes:\n\n` + Object.values(groups3).sort((a, b) => objectSorter(a[0][0], b[0][0])).map(recipes => recipes.map(x => `${objectsToString([x[0]])} (move ${x[1]}): ${unparseChannelRecipe(info, x[2])}`).join('\n') + '\n\n').join('');
    }
    await fs.writeFile(recipeFile, out.slice(0, -1));
    out = '';
    out += '\nMove recipes:\n\n' + salvoRecipesToString(data.salvos.moveRecipes, true);
    out += '\nSplit recipes:\n\n' + salvoRecipesToString(data.salvos.splitRecipes, true);
    out += '\nDestroy recipes:\n\n' + salvoRecipesToString(data.salvos.destroyRecipes, false);
    out += '\nOne-time turners:\n\n' + salvoRecipesToString(data.salvos.oneTimeTurners, true);
    out += '\nOne-time splitters:\n\n' + salvoRecipesToString(data.salvos.oneTimeSplitters, true);
    await fs.writeFile(recipeFile.slice(0, -4) + '_useful.txt', out.slice(0, -1));
}
