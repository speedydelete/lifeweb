
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {MAPPattern, findType, getApgcode, getKnots, INTSeparator, createPattern, toCatagolueRule} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';
export * as c from './config.js';


export const SHIP_DIRECTIONS = ['NW', 'NE', 'SW', 'SE', 'N', 'E', 'S', 'W'];

export interface BaseObject {
    x: number;
    y: number;
    width: number;
    height: number;
    code: string;
}

export interface StillLife extends BaseObject {
    type: 'sl';
    code: string;
}

export interface Oscillator extends BaseObject {
    type: 'osc';
    at: number;
    phase: number;
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
    p.shrinkToFit();
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
            out.push(`${obj.code} (${obj.x}, ${obj.y}, ${obj.at}, ${obj.phase}, ${obj.timing})`);
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
            let p = base.loadApgcode(code.slice(code.indexOf('_') + 1)).shrinkToFit();
            out.push({
                type: 'sl',
                code,
                x: parseInt(args[0]),
                y: parseInt(args[1]),
                width: p.width,
                height: p.height,
            });
        } else if (code.startsWith('xp')) {
            let phase = parseInt(args[3]);
            let p = base.loadApgcode(code.slice(code.indexOf('_') + 1)).run(phase).shrinkToFit();
            out.push({
                type: 'osc',
                code,
                x: parseInt(args[0]),
                y: parseInt(args[1]),
                width: p.width,
                height: p.height,
                at: parseInt(args[2]),
                phase,
                timing: parseInt(args[4]),
            });
        } else if (code.startsWith('xq') && SHIP_DIRECTIONS.includes(args[0])) {
            let dir = args[0] as c.ShipDirection;
            let timing = parseInt(args[3]);
            let data = c.SHIP_IDENTIFICATION[code];
            let p = base.clearedCopy();
            for (let i of data.cells) {
                p.data[i] = 1;
            }
            if (dir.endsWith('2')) {
                if (dir.length === 3) {
                    p = p.rotateRight().flipHorizontal();
                } else {
                    p = p.flipHorizontal();
                }
                dir = dir.slice(0, -1) as c.ShipDirection;
            }
            if (dir === 'NW' || dir === 'N') {
                p.rotate180();
            } else if (dir === 'NE' || dir === 'E') {
                p.rotateLeft();
            } else if (dir === 'SW' || dir === 'W') {
                p.rotateRight();
            }
            out.push({
                type: 'ship',
                code,
                x: parseInt(args[1]),
                y: parseInt(args[2]),
                width: p.width,
                height: p.height,
                dir: args[0] as c.ShipDirection,
                at: parseInt(args[3]),
                timing,
            });
        } else {
            let p = base.loadApgcode(args[0]).shrinkToFit();
            out.push({
                type: 'other',
                code,
                x: parseInt(args[1].slice(1)),
                y: parseInt(args[2]),
                height: p.height,
                width: p.width,
                realCode: args[0],
                at: parseInt(args[3]),
                timing: parseInt(args[4]),
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
        let type = findType(p, 2, false);
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
        let type = findType(p, 1024, false);
        let apgcode = getApgcode(type);
        if (apgcode.startsWith('xs')) {
            if (apgcode === 'xs0_0') {
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
        } else if (apgcode.startsWith('xp')) {
            let phase = 0;
            let goal = base.loadApgcode(apgcode);
            while (true) {
                let found = false;
                for (let i = 0; i < 2; i++) {
                    if (p.rotateRight().isEqual(goal)) {
                        found = true;
                        break;
                    }
                    if (p.rotateRight().isEqual(goal)) {
                        found = true;
                        break;
                    }
                    if (p.rotateRight().isEqual(goal)) {
                        found = true;
                        break;
                    }
                    if (p.rotateRight().isEqual(goal)) {
                        found = true;
                        break;
                    }
                    p.flipHorizontal();
                }
                if (found) {
                    break;
                }
                phase++;
                p.runGeneration();
            }
            out.push({
                type: 'osc',
                code: p.toApgcode('xp' + type.period),
                x: p.xOffset,
                y: p.yOffset,
                width: p.width,
                height: p.width,
                at: 0,
                phase: type.period - phase,
                timing: p.generation,
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
                                width: p.width,
                                height: p.height,
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
                throw new Error(`Invalid glider: ${p.toRLE()}`);
            }
        } else if (apgcode === 'PATHOLOGICAL' || apgcode.startsWith('zz')) {
            return false;
        } else {
            out.push({
                type: 'other',
                code: apgcode,
                x: p.xOffset,
                y: p.yOffset,
                width: p.width,
                height: p.height,
                realCode: p.toApgcode(),
                at: 0,
                timing: p.generation,
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
        forOutput: {[key: string]: [CAObject, CAObject[], number[][]]};
        // moveRecipes: {[key: string]: [StillLife, StillLife, number[][]]};
        // splitRecipes: {[key: string]: [StillLife, StillLife[], number[][]]};
        // destroyRecipes: {[key: string]: number[][]};
    };
}

type RecipeSection = `salvos.${keyof RecipeData['salvos']}`;

let sectionNames: {[key: string]: RecipeSection} = {
    'Salvos (for input)': 'salvos.forInput',
    'Salvos (for output)': 'salvos.forOutput',
    // 'Move recipes': 'salvos.moveRecipes',
    // 'Split recipes': 'salvos.splitRecipes',
    // 'Destroy recipes': 'salvos.destroyRecipes',
};

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
    if (section === 'salvos.forInput') {
        for (let [apgcode, data] of parseRecipeSections(current)) {
            out.salvos.forInput[apgcode] = data.map(x => x.split(':')).map(x => [parseInt(x[0]), stringToObjects(x[1])]);
        }
    } else if (section === 'salvos.forOutput') {
        for (let line of current) {
            let [key, data] = line.split(':');
            let [input, output] = key.split(' to ');
            out.salvos.forOutput[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output), data.split(' / ').map(x => x.split(', ').map(y => parseInt(y)))];
        }
    }/* else if (section === 'salvos.moveRecipes') {
        for (let [key, data] of parseRecipeSections(current)) {
            let [input, output] = key.split(' to ');
            out.salvos.moveRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output)[0] as StillLife, data.map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'salvos.splitRecipes') {
        for (let [key, data] of parseRecipeSections(current)) {
            let [input, output] = key.split(' to ');
            out.salvos.splitRecipes[key] = [stringToObjects(input)[0] as StillLife, stringToObjects(output) as StillLife[], data.map(x => x.split(', ').map(y => parseInt(y)))];
        }
    } else if (section === 'salvos.destroyRecipes') {
        for (let [key, data] of parseRecipeSections(current)) {
            out.salvos.destroyRecipes[key] = data.map(x => x.split(', ').map(y => parseInt(y)));
        }
    }*/
}

export async function getRecipes(): Promise<RecipeData> {
    let out: RecipeData = {
        salvos: {
            forInput: {},
            forOutput: {},
            // moveRecipes: {},
            // splitRecipes: {},
            // destroyRecipes: {},
        },
    };
    if (!exists(recipeFile)) {
        return out;
    }
    let data = (await fs.readFile(recipeFile)).toString();
    let section: RecipeSection | undefined = undefined;
    let current: string[] = [];
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        } else if (line.endsWith(':') && line.slice(0, -1) in sectionNames) {
            if (section !== undefined) {
                addSection(section, current, out);
            }
            section = sectionNames[line.slice(0, -1)];
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

export async function saveRecipes(data: RecipeData): Promise<void> {
    let out = '\nSalvos (for input):\n\n';
    for (let [key, value] of Object.entries(data.salvos.forInput)) {
        out += `${key}:\n${value.map(([lane, data]) => lane + ': ' + objectsToString(data)).join('\n')}\n\n`;
    }
    let groups: {[key: string]: string[]} = {};
    for (let [key, value] of Object.entries(data.salvos.forOutput)) {
        let keyStart = key.split(' ').slice(0, 3).join(' ');
        let line = `${key}: ${value[2].sort((a, b) => a.length - b.length).map(x => x.join(', ')).join(' / ')}`;
        if (keyStart in groups) {
            groups[keyStart].push(line);
        } else {
            groups[keyStart] = [line];
        }
    }
    out += '\nSalvos (for output):\n\n';
    for (let key of Object.keys(groups).sort()) {
        out += groups[key].sort().join('\n') + '\n\n';
    }
    // out += '\nMove recipes:\n\n';
    // for (let [key, value] of Object.entries(data.salvos.moveRecipes)) {
    //     out += `${key}:\n${value[2].map(x => x.join(', ')).join('\n')}\n\n`;
    // }
    // out += `\nSplit recipes:\n\n`;
    // for (let [key, value] of Object.entries(data.salvos.splitRecipes)) {
    //     out += `${key}:\n${value[2].map(x => x.join(', ')).join('\n')}\n\n`;
    // }
    // out += `\nDestroy recipes:\n\n`;
    // for (let [key, value] of Object.entries(data.salvos.destroyRecipes)) {
    //     out += `${key}:\n${value.map(x => x.join(', ')).join('\n')}\n\n`;
    // }
    await fs.writeFile(recipeFile, out.slice(0, -1));
}
