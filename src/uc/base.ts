
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {MAPPattern, toCatagolueRule, createPattern} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';
export * as c from './config.js';


export let maxGenerations = c.MAX_GENERATIONS;

export function setMaxGenerations(value: number): void {
    maxGenerations = value;
}


let prevUpdateTime = performance.now();

export function log(msg: string, notImportant?: boolean): void {
    let now = performance.now();
    if (!notImportant || now - prevUpdateTime > 2000) {
        console.log(msg);
        prevUpdateTime = now;
    }
}


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


export type Edge<T> = [number, number, T];
export type Vertex<T> = Edge<T>[];

/** Runs Dijkstra's algorithm. */
export function dijkstra<T>(graph: Vertex<T>[], target: number): [number, number][] {
    if (target === 0) {
        return [];
    }
    let targetFound = false;
    for (let vertex of graph) {
        for (let edge of vertex) {
            if (edge[0] === target) {
                targetFound = true;
                break;
            }
        }
        if (targetFound) {
            break;
        }
    }
    if (!targetFound) {
        throw new Error('Target unreachable!');
    }
    let dists: number[] = [];
    let prevs: (undefined | [number, number])[] = [];
    let queue: number[] = [];
    for (let i = 0; i < graph.length; i++) {
        dists.push(Infinity);
        prevs.push(undefined);
        queue.push(i);
    }
    dists[0] = 0;
    let found = false;
    while (queue.length > 0) {
        let vertex = queue[0];
        let vertexIndex = 0;
        let dist = dists[vertex];
        for (let i = 1; i < queue.length; i++) {
            let newVertex = queue[i];
            let newDist = dists[newVertex];
            if (newDist < dist) {
                vertex = newVertex;
                vertexIndex = i;
                dist = newDist;
            }
        }
        queue.splice(vertexIndex, 1);
        if (vertex === target) {
            if (dist === Infinity) {
                throw new Error('Target unreachable!');
            }
            found = true;
            break;
        }
        for (let i = 0; i < graph[vertex].length; i++) {
            let edge = graph[vertex][i];
            let newDist = dist + edge[1];
            if (newDist < dists[edge[0]]) {
                dists[edge[0]] = newDist;
                prevs[edge[0]] = [vertex, i];
            }
        }
    }
    if (found) {
        let prev = prevs[target];
        if (!prev) {
            throw new Error('Missing prev for vertex! (there is probably a bug)');
        }
        if (prev[0] === 0) {
            return [prev];
        }
        let out: [number, number][] = [];
        while (prev[0] !== 0) {
            out.push(prev);
            prev = prevs[prev[0]];
            if (!prev) {
                throw new Error('Missing prev for vertex! (there is probably a bug)');
            }
        }
        out.push(prev);
        return out.reverse();
    } else {
        throw new Error('Target unreachable!');
    }
}

export function graphToDOT<T extends [any, any, string]>(graph: Vertex<T>[]): string {
    let out: string[] = [];
    out.push('digraph G {');
    out.push('    node [shape=circle];');
    for (let from = 0; from < graph.length; from++) {
        let edges = graph[from];
        if (edges.length === 0) {
            out.push(`  ${from};`);
            continue;
        }
        for (let [to, weight, payload] of edges) {
            out.push(`    ${from} -> ${to} [label="${payload[2]} (${weight})"];`);
        }
    }
    out.push('}');
    return out.join('\n');
}


export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Parses a slow salvo string. */
export function parseSlowSalvo(info: c.SalvoInfo, data: string): [number, number][] {
    let out: [number, number][] = [];
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (part === '') {
            continue;
        } else if (info.period === 1) {
            out.push([parseInt(part), 0]);
        } else if (!LETTERS.includes(part[part.length - 1])) {
            out.push([parseInt(part), -1]);
        } else if (info.period === 2) {
            out.push([parseInt(part.slice(0, -1)), part[part.length - 1] === 'o' ? 1 : 0]);
        } else {
            out.push([parseInt(part.slice(0, -1)), LETTERS.indexOf(part[part.length - 1])]);
        }
    }
    return out;
}

/** Turns a slow salvo into a string. */
export function salvoToString(info: c.SalvoInfo, data: [number, number][]): string {
    let out: string[] = [];
    for (let [lane, timing] of data) {
        if (timing === -1 || info.period === 1) {
            out.push(String(lane)); 
        } else if (info.period === 2) {
            out.push(lane + (timing === 1 ? 'o' : 'e'));
        } else {
            out.push(lane + LETTERS[timing]);
        }
    }
    return out.join(', ');
}

/** Parses a restricted-channel recipe string. */
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
        } else if (part.startsWith('+')) {
            out.push([parseInt(part.slice(1)), -2]);
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
export function channelRecipeToString(info: c.ChannelInfo, data: [number, number][]): string {
    if (info.channels.length === 1) {
        return data.map(x => {
            if (x[1] >= 0) {
                return x[0];
            } else if (x[1] === -1) {
                return `(${x[0]})`;
            } else if (x[1] === -2) {
                return `+${x[0]}`;
            }
        }).join(', ');
    } else {
        return data.map(x => {
            if (x[1] >= 0) {
                if (x[0] === -1) {
                    return LETTERS[x[1]];
                } else {
                    return x[0] + LETTERS[x[1]];
                }
            } else if (x[1] === -1) {
                return `(${x[0]})`;
            } else if (x[1] === -2) {
                return `+${x[0]}`;
            }
        }).join(', ');
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

export type StableObject = StillLife | Oscillator;

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


/** Normalizes an oscillator to its canonical apgcode (but without rotation or reflection). */
export function normalizeOscillator(obj: Oscillator): Oscillator {
    let period = parseInt(obj.code.slice(2));
    let p = base.loadApgcode(obj.code.slice(obj.code.indexOf('_') + 1)).shrinkToFit();
    let newCode = p.toApgcode();
    p.xOffset = 0;
    p.yOffset = 0;
    let xOffset = 0;
    let yOffset = 0;
    for (let i = 0; i < period; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let code = p.toApgcode();
        if (code.length < newCode.length || (code.length === newCode.length && code < newCode)) {
            newCode = code;
            xOffset = p.xOffset;
            yOffset = p.yOffset;
        }
    }
    return {
        type: 'osc',
        code: `xp${period}_${newCode}`,
        x: obj.x + xOffset,
        y: obj.y + yOffset,
    };
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


export interface SalvoRecipes {
    searchResults: {[key: string]: [number, number, CAObject[]][]};
    recipes: {[key: string]: [StableObject, CAObject[], [number, number][][]]};
    moveRecipes: {[key: string]: [StableObject, StableObject, [number, number][][]]};
    splitRecipes: {[key: string]: [StableObject, StableObject[], [number, number][][]]};
    destroyRecipes: {[key: string]: [number, number][][]};
    oneTimeTurners: {[key: string]: [StableObject, Spaceship, [number, number][][]]};
    oneTimeSplitters: {[key: string]: [StableObject, Spaceship[], [number, number][][]]};
    elbowRecipes: {[key: string]: [StableObject, StableObject, Spaceship, [number, number][][]]};
}


export type ElbowData = {[key: string]: {type: 'normal', time: number, result: CAObject[], flippedResult: CAObject[]} | {type: 'alias', elbow: string, flipped: boolean} | {type: 'destroy'} | {type: 'convert', elbow: string, flipped: boolean}};

export interface ChannelRecipe {
    start: string;
    recipe: [number, number][];
    time: number;
    end?: {
        elbow: string;
        move: number;
        flipped: boolean;
    };
    emit?: {
        dir: 'up' | 'down' | 'left' | 'right';
        lane: number;
        timing: number;
    };
    create?: StableObject;
}

const CHANNEL_RECIPE_SECTION_NAMES = ['move', 'destroy', '90-degree', '180-degree', '0-degree', 'create', '90-degree and destroy', '180-degree and destroy', '0-degree and destroy', 'create and destroy', '90-degree and create', '0-degree and create', '180-degree and create', '0-degree and create', '90-degree and create and destroy', '0-degree and create and destroy', '180-degree and create and destroy'];

export function channelRecipeInfoToString(recipe: ChannelRecipe): string {
    let out = recipe.start;
    if (recipe.end) {
        out += ` to ${recipe.end.elbow} move ${recipe.end.move}`;
        if (recipe.end.flipped) {
            out += ' flip';
        }
    } else {
        out += ` destroy`;
    }
    if (recipe.emit) {
        out += ` emit ${recipe.emit.dir} lane ${recipe.emit.lane} timing ${recipe.emit.timing}`;
    }
    if (recipe.create) {
        out += ` create ${objectsToString([recipe.create])}`;
    }
    return out;
}


/** Represents a recipe file. */
export interface RecipeData {
    salvos: {[key: string]: SalvoRecipes};
    channels: {[key: string]: {
        elbows: ElbowData;
        badElbows: Set<string>;
        recipes: {[key: string]: ChannelRecipe};
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
                out.searchResults[apgcode] = data.map(x => x.split(':')).map(x => [...parseSlowSalvo(info, x[0])[0], stringToObjects(x[1])]);
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
        if (section === 'elbows') {
            for (let line of current) {
                if (line.includes(' = ')) {
                    let [elbow, data] = line.split(' = ');
                    let flipped = false;
                    if (data.endsWith(' (flipped)')) {
                        flipped = true;
                        data = data.slice(0, ' (flipped)'.length);
                    }
                    out.elbows[elbow] = {type: 'alias', elbow: data, flipped};
                } else if (line.includes(' -> ')) {
                    let [elbow, data] = line.split(' -> ');
                    if (data === 'destroy') {
                        out.elbows[elbow] = {type: 'destroy'};
                    } else {
                        let flipped = false;
                        if (data.endsWith(' (flipped)')) {
                            flipped = true;
                            data = data.slice(0, ' (flipped)'.length);
                        }
                        out.elbows[elbow] = {type: 'convert', elbow: data, flipped};
                    }
                } else {
                    let [elbow, data] = line.split(': ');
                    let index = data.lastIndexOf(' ');
                    let time = parseInt(data.slice(index + 1));
                    data = data.slice(0, index);
                    let [resultStr, flippedStr] = data.split(' / ');
                    let result = stringToObjects(resultStr);
                    let flippedResult = stringToObjects(flippedStr);
                    out.elbows[elbow] = {type: 'normal', time, result, flippedResult};
                }
            }
        } else if (section === 'bad elbows') {
            for (let line of current) {
                for (let elbow of line.split(', ')) {
                    out.badElbows.add(elbow);
                }
            }
        } else if (section.includes('recipes')) {
            for (let line of current) {
                let [desc, recipeStr] = line.split(': ');
                let data = desc.split(' ');
                let start = data[0];
                let [actualRecipe, time] = parseChannelRecipe(info, recipeStr);
                let recipe: ChannelRecipe = {start, recipe: actualRecipe, time};
                if (data[1] === 'destroy') {
                    data = data.slice(2);
                } else {
                    let elbow = data[2];
                    let move = parseInt(data[4]);
                    data = data.slice(5);
                    let flipped = false;
                    if (data[0] === 'flip') {
                        flipped = true;
                        data = data.slice(1);
                    }
                    recipe.end = {elbow, move, flipped};
                }
                if (data[0] === 'emit') {
                    let dir = data[1] as 'up' | 'down' | 'left' | 'right';
                    let lane = parseInt(data[3]);
                    let timing = parseInt(data[5]);
                    recipe.emit = {dir, lane, timing};
                    data = data.slice(5);
                }
                if (data[0] === 'create') {
                    recipe.create = stringToObjects(data.slice(1).join(' '))[0] as StillLife;
                }
                out.recipes[desc] = recipe;
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
        channels: Object.fromEntries(Object.keys(c.CHANNEL_INFO).map(x => [x, {elbows: {}, badElbows: new Set(), recipes: {}}])),
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
        } else if (line.endsWith(':') && line.includes(' ')) {
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
        let line = `${key}: ${data.sort((a, b) => a.length - b.length).map(x => salvoToString(info, x)).join(' / ')}`;
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
            out += `${key}:\n${value.map(([lane, timing, data]) => salvoToString(info, [[lane, timing]]) + ': ' + objectsToString(data)).join('\n')}\n\n`;
        }
        out += `\n${type} recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.recipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} move recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.moveRecipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} split recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.splitRecipes).map(x => [x[0], x[1][2]]));
        out += `\n${type} destroy recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.destroyRecipes));
        out += `\n${type} one-time turners:\n\n` + salvoRecipesToString(info, Object.entries(data.oneTimeTurners).map(x => [x[0], x[1][2]]));
        out += `\n${type} one-time splitters:\n\n` + salvoRecipesToString(info, Object.entries(data.oneTimeSplitters).map(x => [x[0], x[1][2]]));
        out += `\n${type} elbow recipes:\n\n` + salvoRecipesToString(info, Object.entries(data.elbowRecipes).map(x => [x[0], x[1][3]]));
    }
    for (let [type, value] of Object.entries(recipeData.channels)) {
        let info = c.CHANNEL_INFO[type];
        out += `\n${type} elbows:\n\n`;
        let elbowGroups: {[key: string]: [string, number, RecipeData['channels'][string]['elbows'][string]][]} = {};
        for (let [obj, data] of Object.entries(value.elbows)) {
            let [code, lane] = obj.split('/');
            if (code in elbowGroups) {
                elbowGroups[code].push([obj, parseInt(lane), data]);
            } else {
                elbowGroups[code] = [[obj, parseInt(lane), data]];
            }
        }
        for (let data of Object.values(elbowGroups)) {
            data = data.sort((a, b) => a[1] - b[1]);
            for (let [key, _, value] of data) {
                let str: string;
                if (value.type === 'normal') {
                    str = `${key}: ${objectsToString(value.result)} (${value.time})`;
                } else if (value.type === 'alias') {
                    str = `${key} = ${value.elbow}`;
                    if (value.flipped) {
                        str += ' (flipped)';
                    }
                } else if (value.type === 'convert') {
                    str = `${key} -> ${value.elbow}`;
                    if (value.flipped) {
                        str += ' (flipped)';
                    }
                } else {
                    str = `${key} -> destroy`;
                }
                out += str + '\n';
            }
            out += '\n';
        }
        let sections: {[key: string]: ChannelRecipe[]} = {};
        for (let key of CHANNEL_RECIPE_SECTION_NAMES) {
            sections[key] = [];
        }
        for (let recipe of Object.values(value.recipes)) {
            let key: string;
            if (!recipe.emit && !recipe.create) {
                if (recipe.end) {
                    key = 'move';
                } else {
                    key = 'destroy';
                }
            } else {
                if (recipe.emit) {
                    let dir = recipe.emit.dir;
                    if (dir === 'up') {
                        key = '180-degree';
                    } else if (dir === 'down') {
                        key = '0-degree';
                    } else {
                        key = '90-degree';
                    }
                    if (recipe.create) {
                        key += ' and create';
                    }
                } else {
                    key = 'create';
                }
                if (!recipe.end) {
                    key += ' and destroy';
                }
            }
            sections[key].push(recipe);
        }
        for (let key of CHANNEL_RECIPE_SECTION_NAMES) {
            out += `\n${type} ${key} recipes:\n\n`;
            let groups: {[key: string]: ChannelRecipe[]} = {};
            for (let recipe of sections[key]) {
                if (recipe.start in groups) {
                    groups[recipe.start].push(recipe);
                } else {
                    groups[recipe.start] = [recipe];
                }
            }
            for (let recipes of Object.values(groups)) {
                for (let recipe of recipes) {
                    out += channelRecipeInfoToString(recipe) + '\n';
                }
                out += '\n';
            }
        }
    }
    await fs.writeFile(recipeFile, out.slice(0, -1));
}
