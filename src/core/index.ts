
/* The main file, exporting everything and also implementing many utility functions. */

import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {stringMD5} from './md5.js';
import {RuleError, RLE_CHARS, SYMMETRY_MEET, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';
import {TRANSITIONS, VALID_TRANSITIONS, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, unparseTransitions, arrayToTransitions, unparseMAP, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPGenB0Pattern, createMAPPattern} from './map.js';
import {unparseHROTRanges, HROTPattern, HROTB0Pattern, createHROTPattern} from './hrot.js';
import {DataHistoryPattern, CoordHistoryPattern, DataSuperPattern, CoordSuperPattern, InvestigatorPattern} from './super.js';
import {FiniteDataPattern, FiniteCoordPattern, TorusDataPattern, TorusCoordPattern} from './bounded.js';
import {AlternatingPattern} from './alternating.js';
import {parseAtRule, TreePattern} from './ruleloader.js';
import {RuleLoaderBgollyPattern} from './ruleloader_bgolly.js';
import {getKnots} from './intsep.js';
import {censusINT, getHashsoup, randomHashsoup} from './search.js';

export * from './pattern.js';
export * from './map.js';
export * from './hrot.js';
export * from './super.js';
export * from './ruleloader.js';
export * from './ruleloader_bgolly.js';
export * from './alternating.js';
export * from './bounded.js';
export * from './minmax.js';
export * from './identify.js';
export * from './intsep.js';
export * from './search.js';


/** Creates a pattern from a rulestring.
 * @param namedRules An object mapping aliases to rules.
 * @param useBgolly This is a temporary parameter until the RuleLoader implementation is fixed. If true, it will output instances of `RuleLoaderBgollyPattern` instead of `TreePattern`.
 */
export function createPattern(rule: string, data: {height: number, width: number, data: Uint8Array} = {height: 0, width: 0, data: new Uint8Array(0)}, namedRules?: {[key: string]: string}, prevName?: string, useBgolly?: boolean): Pattern {
    rule = rule.trim();
    let errors: string[] = [];
    try {
        let out = createMAPPattern(rule, data.height, data.width, data.data);
        if (typeof out === 'object') {
            return out;
        } else {
            rule = out;
        }
    } catch (error) {
        if (error instanceof RuleError) {
            errors.push(error.message);
        } else {
            throw error;
        }
    }
    if (rule.startsWith('R') || rule.startsWith('r')) {
        try {
            let out = createHROTPattern(rule, data.height, data.width, data.data);
            if (typeof out === 'string') {
                rule = out;
            } else {
                return out;
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.startsWith('@')) {
        try {
            if (useBgolly) {
                return new RuleLoaderBgollyPattern(data.height, data.width, data.data, rule);
            }
            let out = parseAtRule(rule);
            let coords = new Map<number, number>();
            let i = 0;
            for (let y = 0; y < data.height; y++) {
                for (let x = 0; x < data.width; x++) {
                    let value = data.data[i++];
                    if (value) {
                        coords.set((x + BIAS) * WIDTH + (y + BIAS), value);
                    }
                }
            }
            return new TreePattern(coords, out.tree.neighborhood, out.tree.data, out.tree.states, prevName ?? rule, out);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('History')) {
        try {
            let p = createPattern(rule.slice(0, -7), data, namedRules, undefined, useBgolly);
            if (p.states !== 2) {
                throw new RuleError('History is only supported for 2-state rules');
            }
            if (p instanceof DataPattern) {
                return new DataHistoryPattern(data.height, data.width, data.data, p);
            } else if (p instanceof CoordPattern) {
                return new CoordHistoryPattern(p.coords, p.range, p);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('Super')) {
        try {
            let p = createPattern(rule.slice(0, -5), data, namedRules, undefined, useBgolly);
            if (p.states !== 2) {
                throw new RuleError('Super is only supported for 2-state rules');
            }
            if (p instanceof DataPattern) {
                return new DataSuperPattern(data.height, data.width, data.data, p);
            } else if (p instanceof CoordPattern) {
                return new CoordSuperPattern(p.coords, p.range, p);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('Investigator')) {
        try {
            let p = createPattern(rule.slice(0, -12), data, namedRules, undefined, useBgolly);
            if (p.states !== 2) {
                throw new RuleError('Investigator is only supported for 2-state rules');
            }
            if (p instanceof DataPattern) {
                return new InvestigatorPattern(data.height, data.width, data.data, p);
            } else if (p instanceof CoordPattern) {
                throw new RuleError(`Investigator is not supported for CoordPatterns`);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.includes(':')) {
        try {
            let parts = rule.split(':');
            if (parts.length > 2) {
                throw new RuleError('Only 1 bounded grid specifier allowed');
            }
            let p = createPattern(parts[0], data, namedRules, prevName, useBgolly);
            let spec = parts[1];
            let type = spec[0];
            let [x, y] = spec.slice(1).split(',').map(x => parseInt(x));
            if (Number.isNaN(x) || Number.isNaN(y)) {
                throw new RuleError(`Invalid bounded grid specifier: '${parts[1]}'`);
            }
            if (type === 'P') {
                if (p instanceof CoordPattern) {
                    return new FiniteCoordPattern(p.coords, p.range, p, x, y);
                } else {
                    return new FiniteDataPattern(data.height, data.width, data.data, p, x, y);
                }
            } else if (type === 'T') {
                if (p instanceof CoordPattern) {
                    return new TorusCoordPattern(p.coords, p.range, p, x, y);;
                } else {
                    let height = y;
                    let width = x;
                    let minX = -Math.floor(width / 2);
                    let maxX = x + minX - 1;
                    let minY = -Math.floor(height / 2);
                    let maxY = y + minY - 1;
                    let out = new TorusDataPattern(data.height, data.width, data.data, p);
                    out.offsetBy(Math.max(0, -(minX + Math.max(0, data.width - maxX))), Math.max(0, -(minY + Math.max(0, data.height - maxY))));
                    out.ensure(height, width);
                    out.xOffset = 0;
                    out.yOffset = 0;
                    out.ruleStr = p.ruleStr + ':T' + width + ',' + height;
                    return out;
                }
            } else {
                throw new RuleError(`Invalid bounded grid specifier: '${parts[1]}'`);
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.startsWith('__ruleloader_bgolly_')) {
        // @ts-ignore
        return new RuleLoaderBgollyPattern(data.height, data.width, data.data, readFileSync(join(import.meta.dirname, '..', rule + '.rule')).toString(), rule);
    }
    if (rule.includes('|')) {
        let patterns = rule.split('|').map(x => createPattern(x, undefined, namedRules, undefined, useBgolly));
        let states = Math.max(...patterns.map(x => x.states));
        let ruleStr = patterns.map(x => x.ruleStr).join('|');
        let symmetry = patterns[0].ruleSymmetry;
        for (let q of patterns.slice(1)) {
            symmetry = SYMMETRY_MEET[symmetry][q.ruleSymmetry];
            if (symmetry === 'C1') {
                break;
            }
        }
        return new AlternatingPattern(data.height, data.width, data.data, patterns, states, ruleStr, symmetry);
    }
    let lower = rule.toLowerCase();
    if (namedRules && lower in namedRules) {
        return createPattern(namedRules[lower], data, namedRules, rule, useBgolly);
    }
    throw new RuleError(errors.join(', '));
}

/** Parses a RLE. 
 * @param namedRules An object mapping aliases to rules.
 * @param useBgolly This is a temporary parameter until the RuleLoader implementation is fixed. If true, it will output instances of `RuleLoaderBgollyPattern` instead of `TreePattern`.
*/
export function parse(rle: string, namedRules?: {[key: string]: string}, useBgolly?: boolean): Pattern {
    let rule = 'B3/S23';
    let xOffset: number | null = null;
    let yOffset: number | null = null;
    let generation = 0;
    let data = '';
    let headerFound = false;
    for (let line of rle.trim().split('\n')) {
        line = line.trim();
        if (line.length === 0) {
            continue;
        } else if (headerFound) {
            data += line;
        } else if (line.startsWith('#')) {
            let char = line[1];
            if (char === 'C' || char === 'c') {
                if (line.startsWith('#CXRLE')) {
                    line = line.slice(3);
                    let index = line.indexOf('Pos=');
                    if (index !== -1) {
                        let data = line.slice(index + 4);
                        let [x, y] = data.split(',');
                        xOffset = parseInt(x);
                        yOffset = parseInt(y);
                    }
                    index = line.indexOf('Gen=');
                    if (index !== -1) {
                        generation = parseInt(line.slice(index + 4));
                    }
                }
            } else if (char === 'P' || char === 'p') {
                let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                xOffset = parseInt(x);
                yOffset = parseInt(y);
            } else if (char === 'r') {
                rule = line.slice(2);
            }
        } else {
            headerFound = true;
            line = line.trim();
            if (line[0] !== 'x') {
                data += line;
            } else {
                let match = line.match(/x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+\s*,?\s*(?:rule\s*=\s*(.*))/);
                if (!match) {
                    throw new Error(`Invaid header line: '${line}'`);
                }
                if (match[1]) {
                    rule = match[1];
                }
            }
        }
    }
    let raw: number[][] = [];
    let currentLine: number[] = [];
    let num = '';
    let prefix = '';
    for (let i = 0; i < data.length; i++) {
        let char = data[i];
        if (char === 'b' || char === 'o') {
            let value = char === 'o' ? 1 : 0;
            if (num === '') {
                currentLine.push(value);
            } else {
                let count = parseInt(num);
                for (let i = 0; i < count; i++) {
                    currentLine.push(value);
                }
                num = '';
            }
        } else if ('0123456789'.includes(char)) {
            num += char;
        } else if (char === '\u0024') {
            raw.push(currentLine);
            currentLine = [];
            if (num !== '') {
                let count = parseInt(num);
                for (let i = 1; i < count; i++) {
                    raw.push([]);
                }
                num = '';
            }
        } else if (char === '.') {
            if (num === '') {
                currentLine.push(0);
            } else {
                let count = parseInt(num);
                for (let i = 0; i < count; i++) {
                    currentLine.push(0);
                }
                num = '';
            }
        } else if ('ABCDEFGHIJKLMNOPQRSTUVWX'.includes(char)) {
            if (prefix) {
                char = prefix + char;
            }
            let value = RLE_CHARS.indexOf(char);
            if (num === '') {
                currentLine.push(value);
            } else {
                let count = parseInt(num);
                for (let i = 0; i < count; i++) {
                    currentLine.push(value);
                }
                num = '';
            }
        } else if ('pqrstuvwxy'.includes(char)) {
            prefix = char;
        }
    }
    raw.push(currentLine);
    let height = raw.length;
    let width = Math.max(...raw.map(x => x.length));
    let pData = new Uint8Array(height * width);
    for (let y = 0; y < raw.length; y++) {
        let i = y * width;
        let line = raw[y];
        for (let x = 0; x < line.length; x++) {
            pData[i] = line[x];
            i++;
        }
    }
    let out = createPattern(rule, {height, width, data: pData}, namedRules, undefined, useBgolly);
    if (xOffset !== null) {
        out.xOffset = xOffset;
    }
    if (yOffset !== null) {
        out.yOffset = yOffset;
    }
    out.generation = generation;
    return out;
}

/** Parses a RLE, but also supports legacy formats like Life 1.05.
 * @param namedRules An object mapping aliases to rules.
 * @param useBgolly This is a temporary parameter until the RuleLoader implementation is fixed. If true, it will output instances of `RuleLoaderBgollyPattern` instead of `TreePattern`.
*/
export function parseWithCompatibility(rle: string, namedRules?: {[key: string]: string}, useBgolly?: boolean): Pattern {
    let lines = rle.trim().split('\n');
    let raw: number[][] = [];
    let rule = 'B3/S23';
    let xOffset: number | null = null;
    let yOffset: number | null = null;
    let generation = 0;
    if (lines[0].startsWith('#L') && (lines[0] === '#Life 1.05' || lines[0] === '#Life 1.06')) {
        if (lines[0] === '#Life 1.05') {
            for (let line of lines.slice(1)) {
                if (line.startsWith('#')) {
                    let char = line[1];
                    if (char === 'P' || char === 'p') {
                        let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                        xOffset = parseInt(x);
                        yOffset = parseInt(y);
                    } else if (char === 'R' || char === 'r') {
                        rule = line.slice(2);
                    } else {
                        raw.push(Array.from(line).map(x => x === '*' ? 1 : 0));
                    }
                }
            }
        } else {
            xOffset = 0;
            yOffset = 0;
            for (let line of lines.slice(1)) {
                let [xStr, yStr] = line.split(' ');
                let x = parseInt(xStr) + xOffset;
                let y = parseInt(yStr) + yOffset;
                while (y < 0) {
                    yOffset--;
                    y++;
                    raw.unshift([]);
                }
                while (y > raw.length) {
                    raw.push([]);
                }
                while (x < 0) {
                    xOffset--;
                    x++;
                    raw.forEach(x => x.unshift(0));
                }
                let row = raw[y];
                while (row.length < x - 1) {
                    row.push(0);
                }
                row.push(1);
            }
        }
    } else if (lines[0].startsWith('!')) {
        for (let line of lines) {
            if (line.startsWith('!')) {
                continue;
            } else {
                raw.push(Array.from(line).map(x => x === 'O' ? 1 : 0));
            }
        }
    } else {
        return parse(rle, namedRules);
    }
    while (raw.length > 0 && raw[raw.length - 1].length === 0) {
        raw.pop();
    }
    let height = raw.length;
    let width = Math.max(...raw.map(x => x.length));
    let data = new Uint8Array(height * width);
    for (let y = 0; y < raw.length; y++) {
        let i = y * width;
        let line = raw[y];
        for (let x = 0; x < line.length; x++) {
            data[i] = line[x];
            i++;
        }
    }
    let out = createPattern(rule, {height, width, data}, namedRules, undefined, useBgolly);
    if (xOffset !== null) {
        out.xOffset = xOffset;
    }
    if (yOffset !== null) {
        out.yOffset = yOffset;
    }
    out.generation = generation;
    return out;
}


const HEX_CHARS = '0123456789abcdef';

/** Turns a rule into its Catagolue equivalent
 * @param namedRules An object mapping aliases to rules.
 */
export function toCatagolueRule(rule: string, customRules?: {[key: string]: string}): string {
    if (rule.includes('|')) {
        return 'xalternating_' + rule.split('|').map(x => toCatagolueRule(x, customRules)).join('_');
    }
    let ruleStr = createPattern(rule, undefined, customRules).ruleStr;
    if (ruleStr.includes('/')) {
        let parts = ruleStr.split('/');
        parts[0] = parts[0];
        parts[1] = parts[1];
        if (parts.length === 2) {
            if (parts[1].endsWith('H')) {
                return `b${parts[0].slice(1)}s${parts[1].slice(1, -1)}h`;
            } else {
                return `b${parts[0].slice(1)}s${parts[1].slice(1)}`;
            }
        } else {
            let isHex = false;
            if (parts[2].endsWith('H')) {
                isHex = true;
                parts[2] = parts[2].slice(-1);
            }
            let out = `g${parts[2]}b${parts[1]}s${parts[0]}`;
            if (isHex) {
                return out + 'h';
            } else {
                return out;
            }
        }
    } else if (ruleStr.startsWith('R')) {
        let parts = ruleStr.split(',');
        let r = parseInt(parts[0].slice(1));
        let c = parseInt(parts[1].slice(1));
        if (parts[2].startsWith('W')) {
            let w = parts[2].slice(1);
            if (c > 2) {
                return `xg${c}r${r}w${w}`;
            } else {
                return `xr${r}w${w}`;
            }
        }
        let s: number[] = [];
        let b: number[] = [];
        let parsingB = false;
        parts[2] = parts[2].slice(1);
        let n: string | null = null;
        for (let part of parts.slice(2)) {
            if (part.length === 0) {
                continue;
            } else if (part.startsWith('B')) {
                parsingB = true;
                part = part.slice(1);
            } else if (part.startsWith('N')) {
                n = part.slice(1);
                continue;
            }
            if (parsingB) {
                b.push(parseInt(part));
            } else {
                s.push(parseInt(part));
            }
        }
        let out = 'r' + r + 'b';
        if (c > 2) {
            out = 'g' + c + out;
        }
        for (let x of [b, s]) {
            for (let i = (2*r + 1)**2 - 1; i > 0; i -= 4) {
                let value = 0;
                if (b.includes(i)) {
                    value |= 8;
                }
                if (b.includes(i - 1)) {
                    value |= 4;
                }
                if (b.includes(i - 2)) {
                    value |= 2;
                }
                if (b.includes(i - 3)) {
                    value |= 1;
                }
                out += HEX_CHARS[value];
            }
            if (x === b) {
                out += 's';
            }
        }
        if (n !== null) {
            out = 'x' + out + 'n';
            if (n === '*') {
                out += 'star';
            } else if (n === '+') {
                out += 'plus';
            } else if (n === '#') {
                out += 'hash';
            } else if (n.startsWith('@')) {
                out += 'at' + n.slice(1);
            } else {
                out += n.toLowerCase();
            }
        }
        if (out.endsWith('h')) {
            out += 'x';
        }
        return out;
    } else if (ruleStr.startsWith('MAP')) {
        if (ruleStr.length < 89) {
            // @ts-ignore
            if (typeof alert === 'function') {
                // @ts-ignore
                alert('bruh');
            }
            throw new RuleError('bruh');
        }
        let out = 'map' + ruleStr.slice(3, 88);
        if (ruleStr.length > 89 && ruleStr[89] === '/') {
            out = 'g' + parseInt(ruleStr.slice(90)) + out;
        }
        if (out.endsWith('h')) {
            out += 'x';
        }
        return 'x' + out;
    } else if (ruleStr.startsWith('W')) {
        return 'xw' + ruleStr.slice(1);
    } else {
        throw new Error(`Invalid rule string: '${ruleStr}' (there is probably a bug in lifeweb)`);
    }
}


/** Options for the soupSearch function */
export interface SoupSearchOptions {
    rule: string;
    symmetry: string;
    soups: number;
    /** The seed for the search, equivalent to apgsearch's -s setting. */
    seed?: string;
    /** An optional function that logs data, will log messages similar to apgsearch. */
    print?: (data: string) => void;
}

/** The output of soupSearch, just an easier-to-use form of the haul files outputted by apgsearch. */
export interface Haul {
    /** The MD5 hash of the rule seed, apgsearch outputs this for some reason. */
    md5: string;
    seed: string;
    rule: string;
    symmetry: string;
    soups: number;
    objects: number;
    census: {[key: string]: number};
    samples: {[key: string]: number[]};
}

/** Uses a trick to redraw the screen if it's running in a browser. */
function redraw(): Promise<number> | undefined {
    if (typeof requestAnimationFrame === 'function') {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }
}

/** Performs a soup search similar to apgsearch, but worse! */
export async function soupSearch(options: SoupSearchOptions): Promise<Haul> {
    let print = options.print;
    let seed = options.seed ?? randomHashsoup();
    if (print) {
        print('Using seed ' + seed);
        await redraw();
    }
    let rule = toCatagolueRule(options.rule);
    let census: {[key: string]: number} = {};
    let samples: {[key: string]: number[]} = {};
    let pattern = createPattern(options.rule);
    if (!(pattern instanceof MAPPattern) || pattern.ruleSymmetry !== 'D8') {
        throw new Error('Cannot search non-INT rules');
    }
    let knots = getKnots(pattern.trs);
    let start = performance.now();
    let prev = start;
    let prevI = 0;
    for (let i = 0; i < options.soups; i++) {
        let {height, width, data} = await getHashsoup(seed + i, options.symmetry);
        let soup = new MAPPattern(height, width, data, pattern.trs, '', 'D8');
        let out = censusINT(soup, knots, print, seed + i);
        for (let key in out) {
            if (key in census) {
                census[key] += out[key];
            } else {
                census[key] = out[key];
            }
            if (!samples[key]) {
                samples[key] = [i];
            } else if (samples[key].length < 10) {
                samples[key].push(i);
            }
            if (print) {
                if (key.startsWith('x')) {
                    if (rule === 'b3s23') {
                        if (key[1] === 'p') {
                            if ((key[2] !== '2' || key[3] !== '_') && key !== 'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401' && key !== 'xp15_4r4z4r4') {
                                print('Rare oscillator detected: \x1b[1;31m' + key + '\x1b[0m in soup ' + seed + i);
                            }
                        } else if (key[1] === 'q' && key !== 'xq4_153' && key !== 'xq4_6frc' && key !== 'xq4_27dee6' && key !== 'xq4_27deee6') {
                            print('Rare spaceship detected: \x1b[1;34m' + key + '\x1b[0m in soup ' + seed + i);
                        }
                    }
                } else if (key.startsWith('y')) {
                    print('Linear-growth pattern detected: \x1b[1;32m' + key + '\x1b[0m in soup ' + seed + i);
                } else if (key.startsWith('z')) {
                    print('Chaotic-growth pattern detected: \x1b[1;32m' + key + '\x1b[0m in soup ' + seed + i);
                } else if (key.startsWith('P')) {
                    print('Pathological object detected in soup ' + seed + i);
                }
            }
        }
        if (print) {
            let now = performance.now();
            if (now - prev > 10000) {
                print(`${rule}/${options.symmetry}: ${i} soups completed (${((i - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(i / ((now - start) / 1000)).toFixed(3)} overall).`);
                prev = now;
                prevI = i;
            }
            await redraw();
        }
    }
    if (print) {
        let now = performance.now();
        print(`${rule}/${options.symmetry}: ${options.soups} soups completed (${((options.soups - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(options.soups / ((now - start) / 1000)).toFixed(3)} overall).`);
    }
    return {
        md5: stringMD5(seed),
        seed,
        rule,
        symmetry: options.symmetry,
        soups: options.soups,
        objects: Object.values(census).reduce((x, y) => x + y),
        census,
        samples,
    };
}


/** Parses a 5S-style speed format. */
export function parseSpeed(speed: string): {dx: number, dy: number, period: number} {
    speed = speed.toLowerCase();
    let disp: string;
    let period: string;
    if (speed.includes('c')) {
        [disp, period] = speed.split('c');
        if (period.startsWith('/')) {
            period = period.slice(1);
        }
    } else if (speed.includes('/')) {
        [disp, period] = speed.split('/');
    } else if (speed.startsWith('p')) {
        return {dx: 0, dy: 0, period: parseInt(speed.slice(1))};
    } else {
        throw new Error('Invalid speed!');
    }
    let p = parseInt(period);
    let x: number;
    let y: number;
    let num = parseInt(disp);
    if (!Number.isNaN(num)) {
        x = num;
        if (period.endsWith('d')) {
            y = num;
        } else {
            y = 0;
        }
    } else if (disp.startsWith('(')) {
        let parts = disp.slice(1, -1).split(',');
        x = parseInt(parts[0]);
        y = parseInt(parts[1]);
        if (Number.isNaN(x) || Number.isNaN(y) || parts.length !== 2) {
            throw new Error('Invalid speed!');
        }
    } else if (disp === '') {
        x = 1;
        if (period.endsWith('d')) {
            y = 1;
        } else {
            y = 0;
        }
    } else {
        throw new Error('Invalid speed!');
    }
    return {dx: x, dy: y, period: p};
}

/** The reverse of `parseSpeed`, unparses into a normalized 5S-style format. */
export function speedToString({dx, dy, period}: {dx: number, dy: number, period: number}): string {
    if (dy === 0) {
        if (dx === 0) {
            return `p${period}`;
        } else if (dx === 1) {
            return `c/${period}o`;
        } else {
            return `${dx}c/${period}o`;
        }
    } else if (dx === dy) {
        if (dx === 1) {
            return `c/${period}d`;
        } else {
            return `${dx}c/${period}d`;
        }
    } else {
        return `(${dx}, ${dy})c/${period}`;
    }
}


/** Gets the black/white reversal of a rule, if available. */
export function getBlackWhiteReversal(rule: string): string {
    let p = createPattern(rule);
    if (p instanceof MAPPattern || p instanceof MAPGenPattern || p instanceof MAPB0Pattern || p instanceof MAPGenB0Pattern) {
        let trs: Uint8Array;
        if ('trs' in p) {
            trs = p.trs.map(x => 1 - x).reverse();
        } else {
            trs = p.evenTrs.reverse();
        }
        if (p.ruleSymmetry === 'D8') {
            let bStr: string;
            let sStr: string;
            if (rule.endsWith('H')) {
                let [bTrs, sTrs] = arrayToTransitions(trs, HEX_TRANSITIONS);
                bStr = unparseTransitions(bTrs, VALID_HEX_TRANSITIONS, true);
                sStr = unparseTransitions(sTrs, VALID_HEX_TRANSITIONS, true);
            } else {
                let [bTrs, sTrs] = arrayToTransitions(trs, TRANSITIONS);
                bStr = unparseTransitions(bTrs, VALID_TRANSITIONS, true);
                sStr = unparseTransitions(sTrs, VALID_TRANSITIONS, true);
            }
            if (p instanceof MAPGenPattern || p instanceof MAPGenB0Pattern) {
                return `${sStr}/${bStr}/${p.states}`;
            } else {
                return `B${bStr}/S${sStr}`;
            }
        } else {
            return 'MAP' + unparseMAP(trs);
        }
    } else if (p instanceof HROTPattern || p instanceof HROTB0Pattern) {
        let b: Uint8Array;
        let s: Uint8Array;
        if (p instanceof HROTPattern) {
            b = p.s.map(x => 1 - x).reverse();
            s = p.b.map(x => 1 - x).reverse();
        } else {
            b = p.evenS.toReversed();
            s = p.evenB.toReversed();
        }
        let out = `R${p.range},C${p.states},S${unparseHROTRanges(s)},B${unparseHROTRanges(b)}`;
        if (p.nh) {
            out += ',NW';
            if (p.nh.every(x => x > -9 && x < 8)) {
                out += Array.from(p.nh).map(x => (x < 0 ? x + 16 : x).toString(16)).join('');
            } else {
                out += Array.from(p.nh).map(x => (x < 0 ? x + 256 : x).toString(16).padStart(2, '0')).join('');
            }
        }
        return out;
    } else if (p instanceof DataHistoryPattern || p instanceof CoordHistoryPattern) {
        return getBlackWhiteReversal(p.ruleStr.slice(0, -7)) + 'History';
    } else if (p instanceof DataSuperPattern || p instanceof CoordSuperPattern) {
        return getBlackWhiteReversal(p.ruleStr.slice(0, -5)) + 'Super';
    } else if (p instanceof InvestigatorPattern) {
        return getBlackWhiteReversal(p.ruleStr.slice(0, -12)) + 'Investigator';
    } else if (p instanceof FiniteDataPattern || p instanceof FiniteCoordPattern || p instanceof TorusDataPattern || p instanceof TorusCoordPattern) {
        let index = p.ruleStr.lastIndexOf(':');
        return getBlackWhiteReversal(p.ruleStr.slice(0, index)) + p.ruleStr.slice(index);
    } else if (p instanceof TreePattern || p instanceof RuleLoaderBgollyPattern) {
        throw new RuleError(`Black/white reversal is not supported for RuleLoader`);
    } else if (p instanceof AlternatingPattern) {
        return p.ruleStr.split('|').map(getBlackWhiteReversal).join('|');
    } else {
        throw new Error(`Unknown pattern: '${p.constructor.name}'`);
    }
}
