
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {numericSorter, MAPPattern, toCatagolueRule, createPattern} from '../core/index.js';
import * as c from './config.js';

export * from './config.js';
export * as c from './config.js';


// this is for school chromebook running

export async function redraw(): Promise<void> {
    if (typeof requestAnimationFrame === 'function') {
        await new Promise(resolve => {
            requestAnimationFrame(() => requestAnimationFrame(resolve));
        });
    }
}


// we make the max generations configurable at runtime like this
export let maxGenerations = c.MAX_GENERATIONS;
export function setMaxGenerations(value: number): void {
    maxGenerations = value;
}


/** An empty pattern in the rule being searched in. */
export let base = createPattern(c.RULE) as MAPPattern;


// we have to compute all the orientations of the spaceships

/** Holds all orientations of every spaceship. */
export let shipPatterns: {[key: string]: MAPPattern[]} = {};

for (let [key, value] of Object.entries(c.SPACESHIPS)) {
    let p = base.copy();
    p.height = value.height;
    p.width = value.width;
    p.size = value.height * value.width;
    p.data = new Uint8Array(p.size);
    for (let i of value.cells) {
        p.data[i] = 1;
    }
    let ps: MAPPattern[] = [p.copy()];
    for (let i = 1; i < value.period; i++) {
        p.runGeneration();
        ps.push(p.copy());
    }
    shipPatterns[key] = ps;
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


export const LETTERS = 'abcdefghijklmopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

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

/** Parses a channel recipe string. */
export function parseChannelRecipe(info: c.ChannelInfo, data: string): [[number, number, number][], number] {
    let out: [number, number, number][] = [];
    let time = 0;
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (part === '') {
            continue;
        }
        let timing: number;
        let channel: number;
        if (part.startsWith('(') || part.startsWith('+')) {
            timing = parseInt(part.slice(1));
            time += timing;
            channel = part.startsWith('(') ? -1 : -2;
        } else if (part.length === 1 && LETTERS.includes(part[0])) {
            timing = -1;
            channel = LETTERS.indexOf(part[0]);
        } else {
            timing = parseInt(part);
            let end = part[part.length - 1];
            let index = LETTERS.indexOf(end);
            if (part.length === 1 && index !== -1) {
                timing = -1;
                channel = index;
            } else if (index === -1) {
                if (info.channels.length === 1) {
                    time += timing;
                    channel = 0;
                } else {
                    time += Math.max(timing, info.minSpacing);
                    channel = 0;
                }
            } else {
                time += timing;
                channel = index;
            }
        }
        let slow = 0;
        let index = part.indexOf('+', 1);
        if (index !== -1) {
            if (part[index + 1] === 'n') {
                slow = 1;
            } else {
                slow = parseInt(part.slice(index + 1));
            }
        }
        out.push([timing, channel, slow]);
    }
    return [out, time];
}

/** Turns a channel recipe into a string */
export function channelRecipeToString(info: c.ChannelInfo, data: [number, number, number][]): string {
    if (info.channels.length === 1) {
        return data.map(x => {
            let out: string;
            if (x[1] >= 0) {
                out = String(x[0]);
            } else if (x[1] === -1) {
                out = `(${x[0]})`;
            } else if (x[1] === -2) {
                out = `+${x[0]}`;
            } else {
                throw new Error(`Invalid recipe: ${JSON.stringify(data)}`);
            }
            if (x[2] > 0) {
                if (x[2] > 1) {
                    out += `+${x[2]}n`;
                } else {
                    out += '+n';
                }
            }
            return out;
        }).join(', ');
    } else {
        return data.map(x => {
            let out: string;
            if (x[1] >= 0) {
                if (x[0] === -1) {
                    out = LETTERS[x[1]];
                } else {
                    out = x[0] + LETTERS[x[1]];
                }
            } else if (x[1] === -1) {
                out = `(${x[0]})`;
            } else if (x[1] === -2) {
                out = `+${x[0]}`;
            } else {
                throw new Error(`Invalid recipe: ${JSON.stringify(data)}`);
            }
            if (x[2] > 0) {
                if (x[2] > 1) {
                    out += `+(${x[2]})`;
                }
                out += '+';
            }
            return out;
        }).join(', ');
    }
}


// basic types for objects

export const SHIP_DIRECTIONS = ['NW', 'NE', 'SW', 'SE', 'N', 'E', 'S', 'W', 'NW2', 'NE2', 'SW2', 'SE2', 'N2', 'E2', 'S2', 'W2'];

/** Base type for `CAObjects`. */
export interface BaseObject {
    /** The non-canonical prefixed apgcode. */
    code: string;
    /** The x coordinate of the top-left corner. */
    x: number;
    /** The y coordinate of the top-left corner. */
    y: number;
}

/** Represents a still life. */
export interface StillLife extends BaseObject {
    type: 'sl';
    /** The reason why this exists is because sometimes `StillLifes` are used to make `Oscillators` */
    timing?: number;
}

/** Represents an oscillator. */
export interface Oscillator extends BaseObject {
    type: 'osc';
    /** The period of the oscillator. */
    period: number;
    /** Either the number of generations since the start or that modulo the period. */
    timing: number;
}

export type StableObject = StillLife | Oscillator;

export interface Spaceship extends BaseObject {
    type: 'ship';
    /** The canonical apgcode of the spaceship. */
    code: string;
    /** The direction it is moving. */
    dir: c.ShipDirection;
    /** T number of generations from the start it took to get here. */
    timing: number;
}

export interface OtherObject extends BaseObject {
    type: 'other';
    /** The "actual" unprefixed apgcode representing the object. */
    realCode: string;
    /** The number of generations before it was categorized. */
    timing: number;
}

/** Represents a classified object. */
export type CAObject = StillLife | Oscillator | Spaceship | OtherObject;


/** Normalizes an oscillator to its canonical apgcode (but without rotation or reflection). */
export function normalizeOscillator(obj: Oscillator, modTiming: boolean = true): Oscillator {
    let p = base.loadApgcode(obj.code.slice(obj.code.indexOf('_') + 1)).shrinkToFit();
    let newCode = p.toApgcode();
    let timing = 0;
    let xOffset = p.xOffset;
    let yOffset = p.yOffset;
    for (let i = 0; i < obj.period; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let code = p.toApgcode();
        if (code.length < newCode.length || (code.length === newCode.length && code < newCode)) {
            newCode = code;
            xOffset = p.xOffset;
            yOffset = p.yOffset;
            timing = i + 1;
        }
    }
    timing += obj.timing;
    if (modTiming) {
        timing %= obj.period;
    }
    return {
        type: 'osc',
        code: `xp${obj.period}_${newCode}`,
        x: obj.x + xOffset,
        y: obj.y + yOffset,
        period: obj.period,
        timing,
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

/** A sorting function that sorts objects by their (x, y) displacement. */
export function xyCompare(a: CAObject, b: CAObject): number {
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
            out.push(`${obj.code} (${obj.x}, ${obj.y}, ${obj.timing})`);
        } else if (obj.type === 'ship') {
            out.push(`${obj.code} (${obj.dir}, ${obj.x}, ${obj.y}, ${obj.timing})`);
        } else {
            out.push(`${obj.code} (${obj.realCode}, ${obj.x}, ${obj.y}, ${obj.timing})`);
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
                period: parseInt(code.slice(2)),
                timing: parseInt(args[2]),
            });
        } else if (code.startsWith('xq') && SHIP_DIRECTIONS.includes(args[0])) {
            out.push({
                type: 'ship',
                code,
                x: parseInt(args[1]),
                y: parseInt(args[2]),
                dir: args[0] as c.ShipDirection,
                timing: parseInt(args[3]),
            });
        } else {
            out.push({
                type: 'other',
                code,
                x: parseInt(args[1].slice(1)),
                y: parseInt(args[2]),
                realCode: args[0],
                timing: parseInt(args[3]),
            });
        }
    }
    return out;
}


/** Stores information about a spaceship. */
export interface ShipInfo {
    code: string;
    /** The direction it is moving. */
    dir: c.ShipDirection;
    /** The lane number, relative to the initial xOffset and yOffset properties. This is not the same system as that used for B3/S23 conduits. */
    lane: number;
    /** The timing value of the spaceship. */
    timing: number;
}

/** Gets information on a spaceship. */
export function getShipInfo(info: {ship: c.SpaceshipInfo, period: number}, obj: Spaceship): ShipInfo {
    let dir = obj.dir;
    if (dir.endsWith('2')) {
        dir = dir.slice(0, -1) as c.ShipDirection;
    }
    let slope = c.SPACESHIPS[info.ship.code].slope;
    let lane: number;
    if ((obj.dir.startsWith('N') && !obj.dir.startsWith('NE')) || (obj.dir.startsWith('S') && !obj.dir.startsWith('SW'))) {
        lane = obj.x - (obj.y * slope);
    } else {
        lane = (obj.x * slope) + obj.y;
    }
    return {code: obj.code, dir: obj.dir, lane: lane + c.LANE_OFFSET, timing: obj.timing % parseInt(obj.code.slice(2))};
}


/** Stores information about slow salvos. */
export interface SalvoRecipes {
    searchResults: {[key: string]: [number, number, CAObject[] | string][]};
    recipes: {[key: string]: [StableObject, CAObject[], [number, number][][]]};
    moveRecipes: {[key: string]: [StableObject, StableObject, [number, number][][]]};
    splitRecipes: {[key: string]: [StableObject, StableObject[], [number, number][][]]};
    destroyRecipes: {[key: string]: [number, number][][]};
    oneTimeTurners: {[key: string]: [StableObject, Spaceship, [number, number][][]]};
    oneTimeSplitters: {[key: string]: [StableObject, Spaceship[], [number, number][][]]};
    elbowRecipes: {[key: string]: [StableObject, StableObject, Spaceship, [number, number][][]]};
}


/** Stores information about channel elbows. */
export type ElbowData = {[key: string]: (
    {type: 'normal', result: CAObject[], results: CAObject[][], flippedResult: CAObject[], flippedResults: CAObject[][]} |
    {type: 'alias', elbow: string, flipped: boolean, move: number, timing: number} |
    {type: 'convert', elbow: string, flipped: boolean, move: number, timing: number, emit?: ShipInfo[]} |
    {type: 'destroy', emit?: ShipInfo[]} |
    {type: 'no collision'} |
    {type: 'bad'}
)[]};

export interface Elbow {
    str: string;
    timingStr: string;
    code: string;
    lane: number;
    period: number;
    timing: number;
}

/** Stores a complete channel recipe. */
export interface ChannelRecipe {
    /** The starting elbow. */
    start: string;
    /** The sequence of timing gaps, format for each one is `[timing, channel, slowPeriod]`, channel -1 is "next working input", channel -2 is "add to the previous one when combining". */
    recipe: [number, number, number][];
    /** The sum of the timing gaps. */
    time: number;
    /** The new elbow if present. */
    end?: Elbow & {
        /** The number of cells in the y direction by which the elbow is moved. */
        move: number;
        /** Whether the elbow is a flipped version. */
        flipped: boolean;
    };
    /** Spaceships it emits. */
    emit?: ShipInfo[];
    /** An object it creates. */
    create?: StableObject;
}

export function parseElbow(elbow: string): Elbow {
    let parts = elbow.split('/');
    let timing = parts[2] ? parseInt(parts[2]) : 0;
    let str = `${parts[0]}/${parts[1]}`;
    let timingStr = str;
    if (elbow.startsWith('xp')) {
        timingStr += '/' + timing;
    }
    return {
        str,
        timingStr,
        code: parts[0],
        lane: parseInt(parts[1]),
        timing,
        period: elbow.startsWith('xp') ? parseInt(elbow.slice(2)) : 1,
    };
}

const CHANNEL_RECIPE_SECTION_NAMES = ['move', 'destroy', '90-degree', '180-degree', '0-degree', 'create', '90-degree and destroy', '180-degree and destroy', '0-degree and destroy', 'create and destroy'];

/** Creates a human-readable presentation of a `ChannelRecipe` object. */
export function channelRecipeInfoToString(recipe: ChannelRecipe): string {
    let out = recipe.start;
    if (recipe.end) {
        out += ` to ${recipe.end.timingStr} move ${recipe.end.move}`;
        if (recipe.end.flipped) {
            out += ' flip';
        }
    } else {
        out += ` destroy`;
    }
    if (recipe.emit) {
        for (let ship of recipe.emit) {
            out += ` emit ${ship.code} ${ship.dir} lane ${ship.lane} timing ${ship.timing}`;
        }
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
                out.searchResults[apgcode] = data.map(x => x.split(': ')).map(x => [...parseSlowSalvo(info, x[0])[0], x[1] === 'nothing' ? [] : (x[1] === 'linear' || x[1] === 'eater' || x[1].includes('reflector') || x[1].includes('splitter') || x[1] === 'factory' ? x[1] : stringToObjects(x[1]))]);
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
                let [elbow, fullData] = line.split(': ');
                let value: ElbowData[string] = [];
                for (let data of fullData.split(' | ')) {
                    if (data === 'destroy') {
                        value.push({type: 'destroy'});
                    } else if (data === 'bad') {
                        value.push({type: 'bad'});
                    } else if (data === 'no collision') {
                        value.push({type: 'no collision'});
                    } else if (data.startsWith('-> ') || data.startsWith('= ')) {
                        let parts = data.split(' ');
                        let type = parts[0];
                        let elbow = parts[1];
                        parts = parts.slice(2);
                        let flipped = false;
                        if (parts[0] === 'flip') {
                            flipped = true;
                            parts = parts.slice(1);
                        }
                        let move = parseInt(parts[1]);
                        let timing = parseInt(parts[3]);
                        let emit: ShipInfo[] | undefined = undefined;
                        if (parts[4] === 'emit') {
                            parts = parts.slice(4);
                            emit = [];
                            while (parts[0] === 'emit') {
                                let code = data[1];
                                let dir = data[2] as c.ShipDirection;
                                let lane = parseInt(data[4]);
                                let timing = parseInt(data[6]);
                                emit.push({code, dir, lane, timing});
                                data = data.slice(7);
                            }
                        }
                        value.push({type: type === '=' ? 'alias' : 'convert', elbow, flipped, move, timing, emit});
                    } else {
                        let values = data.split(' / ').map(stringToObjects);
                        value.push({
                            type: 'normal',
                            result: values[0],
                            results: values.slice(1, 4), 
                            flippedResult: values[4], 
                            flippedResults: values.slice(5),
                        });
                    }
                }
                out.elbows[elbow] = value;
            }
        } else if (section === 'elbow scores') {
            return;
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
                    let elbow = parseElbow(data[2]);
                    let move = parseInt(data[4]);
                    let flipped = false;
                    if (data[5] === 'flip') {
                        flipped = true;
                    }
                    recipe.end = {...elbow, move, flipped};
                }
                if (data[0] === 'emit') {
                    recipe.emit = [];
                    while (data[0] === 'emit') {
                        let code = data[1];
                        let dir = data[2] as c.ShipDirection;
                        let lane = parseInt(data[4]);
                        let timing = parseInt(data[6]);
                        recipe.emit.push({code, dir, lane, timing});
                        data = data.slice(7);
                    }
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
    if ((typeof window === 'object' && window === globalThis) || !exists(recipeFile)) {
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
            } else {
                return numericSorter(a, b);
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
            out += `${key}:\n${value.map(([lane, timing, data]) => salvoToString(info, [[lane, timing]]) + ': ' + (typeof data === 'object' ? objectsToString(data) : data)).join('\n')}\n\n`;
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
        let entries = Object.entries(elbowGroups).sort(([x], [y]) => {
            if (x.startsWith('xs')) {
                if (y.startsWith('xs')) {
                    let value = parseInt(x.slice(2)) - parseInt(y.slice(2));
                    if (value !== 0) {
                        return value;
                    } else if (x < y) {
                        return -1;
                    } else if (x > y) {
                        return 1;
                    } else {
                        return 0;
                    }
                } else {
                    return -1;
                }
            } else {
                if (y.startsWith('xs')) {
                    return 1;
                } else {
                    let value = parseInt(x.slice(2)) - parseInt(y.slice(2));
                    if (value !== 0) {
                        return value;
                    } else if (x < y) {
                        return -1;
                    } else if (x > y) {
                        return 1;
                    } else {
                        return 0;
                    }
                }
            }
        });
        for (let [_, data] of entries) {
            data = data.sort((a, b) => a[1] - b[1]);
            for (let [key, _, value] of data) {
                let strs: string[] = [];
                for (let x of value) {
                    if (x.type === 'normal') {
                        strs.push(`${objectsToString(x.result)} / ${x.results.map(objectsToString).join(' / ')} / ${objectsToString(x.flippedResult)} / ${x.flippedResults.map(objectsToString).join(' / ')}`);
                    } else if (x.type === 'alias' || x.type === 'convert') {
                        let str = `${x.type === 'alias' ? '=' : '->'} ${x.elbow}${x.flipped ? ' flip' : ''} move ${x.move} timing ${x.timing}`;
                        if (x.type === 'convert' && x.emit) {
                            for (let ship of x.emit) {
                                str += ` emit ${ship.code} ${ship.dir} lane ${ship.lane} timing ${ship.timing}`;
                            }
                        }
                        strs.push(str);
                    } else if (x.type === 'destroy') {
                        let str = 'destroy';
                        if (x.emit) {
                            for (let ship of x.emit) {
                                str += ` emit ${ship.code} ${ship.dir} lane ${ship.lane} timing ${ship.timing}`;
                            }
                        }
                        strs.push(str);
                    } else if (x.type === 'no collision') {
                        strs.push('no collision');
                    } else {
                        strs.push('bad');
                    }
                }
                out += `${key}: ${strs.join(' | ')}\n`;
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
                    let dir = recipe.emit[0].dir;
                    if (dir === 'N' || dir === 'NW' || dir === 'N2' || dir === 'NW2') {
                        key = '180-degree';
                    } else if (dir === 'S' || dir === 'SE' || dir === 'S2' || dir === 'SE2') {
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
            if (!(key in sections)) {
                console.error(`\x1b[91mCannot save recipe: ${channelRecipeInfoToString(recipe)}: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
                continue;
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
                let groups: {[key: string]: string[]} = {};
                for (let recipe of recipes) {
                    let str = channelRecipeInfoToString(recipe) + ': ' + channelRecipeToString(info, recipe.recipe) + '\n';
                    if (recipe.start in groups) {
                        groups[recipe.start].push(str);
                    } else {
                        groups[recipe.start] = [str];
                    }
                }
                for (let key of Object.keys(groups).sort(numericSorter)) {
                    out += groups[key].sort(numericSorter).join('') + '\n';
                }
            }
        }
    }
    await fs.writeFile(recipeFile, out.slice(0, -1));
}
