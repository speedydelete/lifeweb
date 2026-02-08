
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {MAPPattern, PatternType, findType, getApgcode, getKnots, INTSeparator, toCatagolueRule, createPattern} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';
export * as c from './config.js';


let prevUpdateTime = performance.now();

export function log(msg: string, notImportant?: boolean): void {
    let now = performance.now();
    if (!notImportant || now - prevUpdateTime > 2000) {
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


export const INFO_ALIASES: {[key: string]: string} = {};

for (let [key, value] of Object.entries(c.SALVO_INFO)) {
    if (value.aliases) {
        for (let alias of value.aliases) {
            INFO_ALIASES[alias.toLowerCase()] = key;
        }
    }
}

for (let [key, value] of Object.entries(c.CHANNEL_INFO)) {
    if (value.aliases) {
        for (let alias of value.aliases) {
            INFO_ALIASES[alias.toLowerCase()] = key;
        }
    }
}


// /** Runs Dijkstra's algorithm. */
// export function dijkstra(graph: Uint32Array): [number, number[]][] {

// }


export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Parses a slow salvo string. */
export function parseSlowSalvo(info: c.SalvoInfo, data: string): [number, number][] {
    let out: [number, number][] = [];
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (info.period === 1) {
            out.push([parseInt(part), 0]);
        } else if (info.period === 2) {
            out.push([parseInt(part.slice(0, -1)), part[part.length - 1] === 'o' ? 1 : 0]);
        } else {
            out.push([parseInt(part.slice(0, -1)), LETTERS.indexOf(part[part.length - 1])]);
        }
    }
    return out;
}

/** Turns a slow salvo into a string. */
export function unparseSlowSalvo(info: c.SalvoInfo, data: [number, number][]): string {
    let out: string[] = [];
    for (let [lane, timing] of data) {
        if (info.period === 1) {
            out.push(String(lane)); 
        } else if (info.period === 2) {
            out.push(lane + (timing === 1 ? 'o' : 'e'));
        } else {
            out.push(lane + LETTERS[timing]);
        }
    }
    return out.join(', ');
}

/** Parses a restricted-cihannel recipe string. */
export function parseChannelRecipe(info: c.ChannelInfo, data: string): [[number, number][], number] {
    let out: [number, number][] = [];
    let time = 0;
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (part === '') {
            continue;
        }
        if (part.startsWith('(')) {
            out.push([parseInt(part.slice(1)), -1]);
        } else if (part.length === 1 && LETTERS.includes(part[0])) {
            out.push([-1, LETTERS.indexOf(part[0])]);
        } else {
            let timing = parseInt(part);
            let end = part[part.length - 1];
            let index = LETTERS.indexOf(end);
            if (part.length === 1 && index !== -1) {
                out.push([-1, index]);
            } else if (index === -1) {
                if (info.channels.length === 1) {
                    time += timing;
                    out.push([timing, 0]);
                } else {
                    time += Math.max(timing, info.minSpacing);
                    out.push([timing, -1]);
                }
            } else {
                time += timing;
                out.push([timing, index]);
            }
        }
    }
    return [out, time];
}

/** Turns a restricted-channel recipe into a string */
export function unparseChannelRecipe(info: c.ChannelInfo, data: [number, number][]): string {
    if (info.channels.length === 1) {
        return data.map(x => x[1] === -1 ? `(${x[0]})` : x[0]).join(', ');
    } else {
        return data.map(x => x[1] === -1 ? `(${x[0]})` : (x[0] === -1 ? LETTERS[x[1]] : x[0] + LETTERS[x[1]])).join(', ');
    }
}


/** Translates a list of `CAObjects[]` by a given amount. */
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

/** A sorting function for objects (can be passed to `Array.prototype.sort`). */
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

/** A sorting function for arrays of objects (can be passed to `Array.prototype.sort`). */
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

/** Turns an array of objects into a normalized string. */
export function objectsToString(objs: CAObject[]): string {
    if (objs.length === 0) {
        return 'nothing';
    }
    let out: string[] = [];
    for (let obj of objs.sort(objectSorter)) {
        if (obj.type === 'sl') {
            out.push(`${obj.code} (${obj.x}, ${obj.y})`);
        } else if (obj.type === 'osc') {
            out.push(`${obj.code} (${obj.x}, ${obj.y})`);
        } else if (obj.type === 'ship') {
            out.push(`${obj.code} (${obj.dir}, ${obj.x}, ${obj.y}, ${obj.at}, ${obj.timing})`);
        } else {
            out.push(`${obj.code} (${obj.realCode}, ${obj.x}, ${obj.y}, ${obj.at}, ${obj.timing})`);
        }
    }
    return out.join(', ');
}

/** Parses a string of objects. */
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


/** Represents a recipe file. */
export interface RecipeData {
    salvos: {[key: string]: {
        searchResults: {[key: string]: [number, CAObject[]][]};
        recipes: {[key: string]: [StableObject, CAObject[], [number, number][][]]};
        moveRecipes: {[key: string]: [StableObject, StableObject, [number, number][][]]};
        splitRecipes: {[key: string]: [StableObject, StableObject[], [number, number][][]]};
        destroyRecipes: {[key: string]: [number, number][][]};
        oneTimeTurners: {[key: string]: [StableObject, Spaceship, [number, number][][]]};
        oneTimeSplitters: {[key: string]: [StableObject, Spaceship[], [number, number][][]]};
        elbowRecipes: {[key: string]: [StableObject, StableObject, Spaceship, [number, number][][]]};
    }};
    channels: {[key: string]: {
        moveRecipes: {recipe: [number, number][], time: number, move: number}[];
        recipes90Deg: {recipe: [number, number][], time: number, lane: number, ix: 'i' | 'x', timing: number, move: number}[];
        recipes0Deg: {recipe: [number, number][], time: number, lane: number, timing: number, move: number}[];
        createHandRecipes: {recipe: [number, number][], time: number, obj: StillLife, move: number}[];
        destroyRecipe?: {recipe: [number, number][], time: number};
        recipes90DegDestroy: {recipe: [number, number][], time: number, lane: number, ix: 'i' | 'x', timing: number}[];
        recipes0DegDestroy: {recipe: [number, number][], time: number, lane: number, timing: number}[];
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

function addSection(section: string, current: string[], recipeData: RecipeData): void {
    let type = '';
    let originalSection = section;
    while (!(type in c.SALVO_INFO || type in c.CHANNEL_INFO) && section.length > 0) {
        type += section[0];
        section = section.slice(1);
    }
    if (section.length === 0) {
        console.log(`\x1b[91mWarning: Invalid section: '${originalSection}'\x1b[0m`);
        return;
    }
    section = section.slice(1);
    if (type in c.SALVO_INFO) {
        let info = c.SALVO_INFO[type];
        let out = recipeData.salvos[type];
        if (section === 'search results') {
            for (let [apgcode, data] of parseRecipeSections(current)) {
                out.searchResults[apgcode] = data.map(x => x.split(':')).map(x => [parseInt(x[0]), stringToObjects(x[1])]);
            }
        } else if (section === 'recipes') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                out.recipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output) as (StableObject | Spaceship)[], data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else if (section === 'move recipes') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                out.moveRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output)[0] as StillLife, data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else if (section === 'split recipes') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                out.splitRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output) as StillLife[], data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else if (section === 'destroy recipes') {
                for (let line of current) {
                let [key, data] = line.split(':');
                out.destroyRecipes[key] = data.split(' / ').map(x => parseSlowSalvo(info, x));
            }
        } else if (section === 'one-time turners') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                out.oneTimeTurners[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output)[0] as Spaceship, data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else if (section === 'one-time splitters') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                out.oneTimeSplitters[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, stringToObjects(output) as Spaceship[], data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else if (section === 'elbow recipes') {
            for (let line of current) {
                let [key, data] = line.split(':');
                let [input, output] = key.split(' to ');
                let objs = stringToObjects(output);
                out.elbowRecipes[key] = [stringToObjects(input + ' (0, 0)')[0] as StillLife, objs[0] as StillLife, objs[1] as Spaceship, data.split(' / ').map(x => parseSlowSalvo(info, x))];
            }
        } else {
            console.log(`\x1b[91mWarning: Unrecognized section: '${originalSection}'\x1b[0m`);
        }
    } else {
        let info = c.CHANNEL_INFO[type];
        let out = recipeData.channels[type];
        if (section === 'move recipes') {
            for (let line of current) {
                let [amount, recipeStr] = line.split(': ');
                let [recipe, time] = parseChannelRecipe(info, recipeStr)
                out.moveRecipes.push({recipe, time, move: parseInt(amount)});
            }
        } else if (section === '90-degree recipes') {
            for (let line of current) {
                let data = line.split(' ');
                let [recipe, time] = parseChannelRecipe(info, data.slice(4).join(' '));
                out.recipes90Deg.push({recipe, time, lane: parseInt(data[1].slice(0, -1)), ix: data[1][data[1].length - 1] as 'i' | 'x', timing: parseInt(data[3]), move: parseInt(data[5])});
            }
        } else if (section === '0-degree recipes') {
            for (let line of current) {
                let data = line.split(' ');
                let [recipe, time] = parseChannelRecipe(info, data.slice(4).join(' '));
                out.recipes0Deg.push({recipe, time, lane: parseInt(data[1]), timing: parseInt(data[3]), move: parseInt(data[5])});
            }
        } else if (section === 'hand creation recipes') {
            for (let line of current) {
                let [data, recipeStr] = line.split(': ');
                let [recipe, time] = parseChannelRecipe(info, recipeStr);
                let index = data.indexOf(')');
                let sl = stringToObjects(data.slice(0, index + 1))[0] as StillLife;
                let move = parseInt(data.slice(index + 2 + 'move '.length));
                out.createHandRecipes.push({recipe, time, obj: sl, move});
            }
        } else if (section.startsWith('destroy recipe')) {
            let [recipe, time] = parseChannelRecipe(info, section.slice('destroy recipe: '.length));
            out.destroyRecipe = {recipe, time};
        } else if (section === '90-degree destroy recipes') {
            for (let line of current) {
                let data = line.split(' ');
                let [recipe, time] = parseChannelRecipe(info, data.slice(4).join(' '));
                out.recipes90DegDestroy.push({recipe, time, lane: parseInt(data[1].slice(0, -1)), ix: data[1][data[1].length - 1] as 'i' | 'x', timing: parseInt(data[3])});
            }
        } else if (section === '0-degree destroy recipes') {
            for (let line of current) {
                let data = line.split(' ');
                let [recipe, time] = parseChannelRecipe(info, data.slice(4).join(' '));
                out.recipes0DegDestroy.push({recipe, time, lane: parseInt(data[1]), timing: parseInt(data[3])});
            }
        } else {
            console.log(`\x1b[91mWarning: Unrecognized section: '${originalSection}'\x1b[0m`);
        }
    }
}

/** Gets and parses the recipe file. */
export async function loadRecipes(): Promise<RecipeData> {
    let out: RecipeData = {
        salvos: Object.fromEntries(Object.keys(c.SALVO_INFO).map(x => [x, {searchResults: {}, recipes: {}, moveRecipes: {}, splitRecipes: {}, destroyRecipes: {}, oneTimeTurners: {}, oneTimeSplitters: {}, elbowRecipes: {}}])),
        channels: Object.fromEntries(Object.keys(c.CHANNEL_INFO).map(x => [x, {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], createHandRecipes: [], recipes90DegDestroy: [], recipes0DegDestroy: []}])),
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

function salvoRecipesToString(info: c.SalvoInfo, recipes: [string, [number, number][][]][]): string {
    let groups: {[key: string]: string[]} = {};
    for (let [key, data] of recipes) {
        let keyStart = key.split(' ').slice(0, 3).join(' ');
        data = data.sort((a, b) => a.length - b.length);
        let line = `${key}: ${data.sort((a, b) => a.length - b.length).map(x => unparseSlowSalvo(info, x)).join(' / ')}`;
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

/** Saves to the recipe file. */
export async function saveRecipes(recipeData: RecipeData): Promise<void> {
    let out = '';
    for (let [type, data] of Object.entries(recipeData.salvos)) {
        let info = c.SALVO_INFO[type];
        out += `\n${type} search results:\n\n`;
        for (let [key, value] of Object.entries(data.searchResults)) {
            out += `${key}:\n${value.map(([lane, data]) => lane + ': ' + objectsToString(data)).join('\n')}\n\n`;
        }
        out += `\n${type} recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.recipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} move recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.moveRecipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} split recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.splitRecipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} destroy recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.destroyRecipes));
        out += `\n${type} one-time turners:\n\n` + salvoRecipesToString(info, Object.entries(data.oneTimeTurners).map(x => [x[0], x[1][2]]));
        out += `\n${type} one-time splitters:\n\n` + salvoRecipesToString(info, Object.entries(data.oneTimeSplitters).map(x => [x[0], x[1][2]]));
        out += `\n${type} elbow recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.elbowRecipes).map(x => [x[0], x[1][3]]));
    }
    for (let [key, value] of Object.entries(recipeData.channels)) {
        let info = c.CHANNEL_INFO[key];
        out += `\n${key} move recipes:\n` + value.moveRecipes.sort((a, b) => a.move - b.move).map(x => `${x.move}: ${unparseChannelRecipe(info, x.recipe)}\n`).join('') + '\n';
        let groups: {[key: string]: RecipeData['channels'][string]['recipes90Deg']} = {};
        for (let recipe of value.recipes90Deg) {
            let key = recipe.lane + recipe.ix;
            if (key in groups) {
                groups[key].push(recipe);
            } else {
                groups[key] = [recipe];
            }
        }
        out += `\n${key} 90-degree recipes:\n\n` + Object.values(groups).sort(([a], [b]) => a.ix === b.ix ? (a.lane === b.lane ? a.move - b.move : a.lane - b.lane) : a.ix.charCodeAt(0) - b.ix.charCodeAt(0)).map(recipes => recipes.sort((a, b) => a.lane - b.lane).map(x => `emit ${x.lane}${x.ix} timing ${x.timing} move ${x.move}: ${unparseChannelRecipe(info, x.recipe)}`).join('\n') + '\n\n').join('');
        let groups2: {[key: number]: RecipeData['channels'][string]['recipes0Deg']} = {};
        for (let recipe of value.recipes0Deg) {
            if (recipe.lane in groups2) {
                groups2[recipe.lane].push(recipe);
            } else {
                groups2[recipe.lane] = [recipe];
            }
        }
        out += `\n${key} 0-degree recipes:\n\n` + Object.entries(groups2).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([_, x]) => x.sort((a, b) => a.lane === b.lane ? a.move - b.move : a.lane - b.lane).map(x => `emit ${x.lane} timing ${x.timing} move ${x.move}: ${unparseChannelRecipe(info, x.recipe)}`).join('\n') + '\n\n').join('');
        let groups3: {[key: string]: RecipeData['channels'][string]['createHandRecipes']} = {};
        for (let recipe of value.createHandRecipes) {
            let key = objectsToString([recipe.obj]);
            if (key in groups3) {
                groups3[key].push(recipe);
            } else {
                groups3[key] = [recipe];
            }
        }
        out += `\n${key} 90-degree and destroy recipes:\n\n` + Object.values(groups).sort(([a], [b]) => a.ix === b.ix ? (a.lane === b.lane ? a.move - b.move : a.lane - b.lane) : a.ix.charCodeAt(0) - b.ix.charCodeAt(0)).map(recipes => recipes.sort((a, b) => a.lane - b.lane).map(x => `emit ${x.lane}${x.ix} timing ${x.timing} move ${x.move}: ${unparseChannelRecipe(info, x.recipe)}`).join('\n') + '\n\n').join('');
        if (value.destroyRecipe) {
            out += `\n${key} destroy recipe: ${unparseChannelRecipe(info, value.destroyRecipe.recipe)}\n\n`;
        }
        let groups4: {[key: number]: RecipeData['channels'][string]['recipes0Deg']} = {};
        for (let recipe of value.recipes0Deg) {
            if (recipe.lane in groups4) {
                groups4[recipe.lane].push(recipe);
            } else {
                groups4[recipe.lane] = [recipe];
            }
        }
        out += `\n${key} 0-degree and destroy recipes:\n\n` + Object.entries(groups4).sort((a, b) => parseInt(a[0]) - parseInt(b[0])).map(([_, x]) => x.sort((a, b) => a.lane === b.lane ? a.move - b.move : a.lane - b.lane).map(x => `emit ${x.lane} timing ${x.timing} move ${x.move}: ${unparseChannelRecipe(info, x.recipe)}`).join('\n') + '\n\n').join('');
        let groups5: {[key: string]: RecipeData['channels'][string]['createHandRecipes']} = {};
        for (let recipe of value.createHandRecipes) {
            let key = objectsToString([recipe.obj]);
            if (key in groups5) {
                groups5[key].push(recipe);
            } else {
                groups5[key] = [recipe];
            }
        }
        out += `\n${key} hand creation recipes:\n\n` + Object.values(groups5).sort((a, b) => objectSorter(a[0].obj, b[0].obj)).map(recipes => recipes.map(x => `${objectsToString([x.obj])} move ${x.move}: ${unparseChannelRecipe(info, x.recipe)}`).join('\n') + '\n\n').join('');
    }
    await fs.writeFile(recipeFile, out.slice(0, -1));
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
                code: p.run(period - obj.p.generation % period).toApgcode('xp' + period),
                x: minX,
                y: minY,
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
        // if (input) {
        //     console.log(`Unable to separate objects for ${input}!`);
        // } else {
        //     console.log(`Unable to separate objects!`);
        // }
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

function stabilize(p: MAPPattern, minGens?: number): number | 'linear' | null {
    let pops: number[] = [p.population];
    for (let i = 0; i < c.MAX_GENERATIONS; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let pop = p.population;
        if (minGens && i < minGens) {
            pops.push(pop);
            continue;
        }
        for (let period = 1; period < Math.floor(pops.length / c.PERIOD_SECURITY); period++) {
            let found = true;
            for (let j = 1; j < c.PERIOD_SECURITY; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                if (period === 1) {
                    let j = pops.length - c.PERIOD_SECURITY;
                    while (p.generation > 0) {
                        if (pop !== pops[j]) {
                            break;
                        }
                        p.generation--;
                        j--;
                    }
                    if (p.generation === 0) {
                        console.log('\x1b[96mbruh\b1b[0m');
                    }
                }
                return period;
            }
            let diff = pop - pops[pops.length - period];
            found = true;
            for (let j = 1; j < c.PERIOD_SECURITY; j++) {
                if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return 'linear';
            }
        }
        pops.push(pop);
    }
    return null;
}

export function findOutcome(p: MAPPattern, xPos: number, yPos: number, input?: string, minGens?: number): false | 'linear' | CAObject[] {
    p.generation = 0;
    let period = stabilize(p, minGens);
    if (period === 'linear') {
        return 'linear';
    } else if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
        return false;
    }
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    return separateObjects(p, period * 8, period * 8, input);
}
