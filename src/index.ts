
import {stringMD5} from './md5.js';
import {Pattern, RuleError, RLE_CHARS, SYMMETRY_LEAST} from './pattern.js';
import {HEX_TRANSITIONS, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPB0GenPattern, parseIsotropic, parseMAP, TRANSITIONS, VALID_HEX_TRANSITIONS, VALID_TRANSITIONS, findSymmetry} from './map.js';
import {AlternatingPattern} from './alternating.js';
import {getKnots} from './intsep.js';
import {censusINT, getHashsoup, randomHashsoup, incHashsoup} from './search.js';

export * from './pattern.js';
export * from './map.js';
export * from './alternating.js';
export * from './identify.js';
export * from './intsep.js';
export * from './search.js';


export interface PatternData {
    height: number;
    width: number;
    data: Uint8Array;
}

const VON_NEUMANN: string[][] = [
    ['0c', '1c', '2c', '2n', '3c', '4c'],
    ['1e', '2k', '3i', '3n', '3y', '3q', '4n', '4y', '5e'],
    ['2e', '2i', '3k', '3a', '3j', '3r', '4k', '4a', '4i', '4q', '4t', '4w', '4z', '5k', '5a', '5i', '5r', '6e', '6i'],
    ['3e', '4j', '4r', '5i', '5n', '5y', '5q', '6k', '6a', '7e'],
    ['4e', '5c', '6c', '6n', '7c', '8c'],
];

function parseMAPRule(rule: string, data: PatternData): string | MAPPattern | MAPB0Pattern | MAPGenPattern | MAPB0GenPattern {
    let raw = rule;
    let ruleStr: string;
    let trs = new Uint8Array(512);
    let neighborhood: 'M' | 'V' | 'H' | 'L' = 'M';
    let states = 2;
    let match: RegExpMatchArray | null;
    if (match = rule.match(/^[gG]([0-9]+)/)) {
        states = parseInt(match[1]);
        rule = rule.slice(match[0].length);
    }
    if (match = rule.match(/\/[GgCc]?(\d+)$/)) {
        states = parseInt(match[1]);
        rule = rule.slice(0, -match[0].length);
    }
    let end = rule[rule.length - 1];
    if (end === 'V' || end === 'H') {
        neighborhood = end;
    } else if (end === 'v') {
        neighborhood = 'V';
    } else if (end === 'h') {
        neighborhood = 'H';
    }
    if (rule.startsWith('MAP')) {
        trs = parseMAP(rule.slice(3));
        ruleStr = raw;
    } else if (rule.startsWith('W')) {
        let num = parseInt(rule.slice(1));
        for (let i = 0; i < 512; i++) {
            trs[i | (1 << 4)] = 1;
        }
        for (let i = 0; i < 8; i++) {
            if (num & (1 << i)) {
                trs[((i & 4) << 6) | ((i & 2) << 4) | ((i % 1) << 2)] = 1;
            }
        }
        ruleStr = 'W' + num;
    } else {
        let b = '';
        let s = '';
        let sections = rule.split('/');
        for (let i = 0; i < sections.length; i++) {
            let section = sections[i];
            if (section[0] === 'B' || section[0] === 'b') {
                b = section.slice(1);
            } else if (section[0] === 'S' || section[0] === 's') {
                s = section.slice(1);
            } else {
                if (i === 0) {
                    s = section;
                } else if (i === 1) {
                    b = section;
                } else {
                    throw new RuleError(`Expected 'B', 'b', 'S', or 's'`);
                }
            }
        }
        if (neighborhood === 'V') {
            let newB = '';
            for (let char of b) {
                let value = parseInt(char);
                if (!(value >= 0 && value < VON_NEUMANN.length)) {
                    throw new RuleError(`Invalid character in von Neumann rule: '${char}'`);
                }
                newB += VON_NEUMANN[value].join('');
            }
            b = newB;
            let newS = '';
            for (let char of s) {
                let value = parseInt(char);
                if (!(value >= 0 && value < VON_NEUMANN.length)) {
                    throw new RuleError(`Invalid character in von Neumann rule: '${char}'`);
                }
                newS += VON_NEUMANN[value].join('');
            }
            s = newS;
            neighborhood = 'M';
        }
        let out: {b: string, s: string, data: Uint8Array<ArrayBuffer>};
        if (neighborhood === 'M') {
            out = parseIsotropic(b, s, TRANSITIONS, VALID_TRANSITIONS, 'INT', false);
        } else if (neighborhood === 'H') {
            out = parseIsotropic(b, s, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, 'hex', true);
        } else {
            return `R1,C${states},B${b},S${s},NL`;
        }
        b = out.b;
        s = out.s;
        trs = out.data;
        if (states > 2) {
            ruleStr = `${s}/${b}/${states}`;
        } else {
            ruleStr = `B${b}/S${s}`;
        }
    }
    if (trs[0]) {
        if (trs[511]) {
            let out = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                out[i] = trs[511 - i] ? 0 : 1;
            }
            trs = out;
        } else {
            let evenTrs = new Uint8Array(512);
            let oddTrs = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                evenTrs[i] = trs[i] ? 0 : 1;
                oddTrs[i] = trs[511 - i];
            }
            if (states > 2) {
                return new MAPB0GenPattern(data.height, data.width, data.data, evenTrs, oddTrs, states, ruleStr, SYMMETRY_LEAST[findSymmetry(evenTrs)][findSymmetry(oddTrs)]);
            } else {
                return new MAPB0Pattern(data.height, data.width, data.data, evenTrs, oddTrs, ruleStr, SYMMETRY_LEAST[findSymmetry(evenTrs)][findSymmetry(oddTrs)]);
            }
        }
    }
    if (states > 2) {
        return new MAPGenPattern(data.height, data.width, data.data, trs, states, ruleStr, findSymmetry(trs));
    } else {
        return new MAPPattern(data.height, data.width, data.data, trs, ruleStr, findSymmetry(trs));
    }
}


export function createPattern(rule: string, data: PatternData = {height: 0, width: 0, data: new Uint8Array(0)}, namedRules?: {[key: string]: string}): Pattern {
    rule = rule.trim();
    let errors: string[] = [];
    try {
        let out = parseMAPRule(rule, data);
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
    // if (rule.startsWith('R')) {
    //     try {
    //         let out = parseHROTRule(rule);
    //         if (typeof out === 'object') {
    //             if (out.states > 2) {
                    
    //             } else {
    //                 return new HROTPattern(data.height, data.width, data.data, out.range, out.states, out.b, out.s, out.nh, out.ruleStr);
    //             }
    //         } else {
    //             rule = out;
    //         }
    //     } catch (error) {
    //         if (error instanceof RuleError) {
    //             errors.push(error.message);
    //         } else {
    //             throw error;
    //         }
    //     }
    // }
    if (rule.includes('|')) {
        let patterns = rule.split('|').map(x => createPattern(x, undefined, namedRules));
        return new AlternatingPattern(data.height, data.width, data.data, patterns);
    }
    let lower = rule.toLowerCase();
    if (namedRules && lower in namedRules) {
        return createPattern(namedRules[lower]);
    }
    throw new RuleError(errors.join(', '));
}


export function parse(rle: string): Pattern {
    let lines = rle.split('\n');
    let raw: number[][] = [];
    let rule = 'B3/S23';
    let xOffset = 0;
    let yOffset = 0;
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
        let data = '';
        let headerFound = false;
        for (let line of lines) {
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
        let num = '';
        let prefix = '';
        let currentLine: number[] = [];
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
    let out = createPattern(rule, {height, width, data});
    out.xOffset = xOffset;
    out.yOffset = yOffset;
    out.generation = generation;
    return out;
}


const HEX_CHARS = '0123456789abcdef';

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
            return `b${parts[0].slice(1)}s${parts[1].slice(1)}`;
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


export interface SoupSearchOptions {
    rule: string;
    symmetry: string;
    soups: number;
    seed?: string;
    print?: (data: string) => void;
}

export interface Haul {
    version: string;
    md5: string;
    seed: string;
    rule: string;
    symmetry: string;
    soups: number;
    objects: number;
    census: {[key: string]: number};
    samples: {[key: string]: number[]};
}

export async function soupSearch(options: SoupSearchOptions): Promise<Haul> {
    let print = options.print;
    let seed = options.seed ?? randomHashsoup();
    if (print) {
        print('Using seed ' + seed);
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
        let {height, width, data} = await getHashsoup(seed, options.symmetry);
        let soup = new MAPPattern(height, width, data, pattern.trs, '', 'D8');
        let out = censusINT(soup, knots);
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
        }
        seed = incHashsoup(seed);
        if (print) {
            let now = performance.now();
            if (now - prev > 10000) {
                print(`${rule}/${options.symmetry}: ${i} soups completed (${((i - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(i / ((now - start) / 1000)).toFixed(3)} overall).`);
                prev = now;
                prevI = i;
            }
        }
    }
    if (print) {
        let now = performance.now();
        print(`${rule}/${options.symmetry}: ${options.soups} soups completed (${((options.soups - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(options.soups / ((now - start) / 1000)).toFixed(3)} overall).`);
    }
    return {
        version: 'apgweb-beta-v0.1',
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

// let data = await soupSearch({rule: 'B3/S23', symmetry: 'C1', soups: 10, print: console.log});
// console.log(`
// @VERSION ${data.version}
// @MD5 ${data.md5}
// @ROOT ${data.seed}
// @RULE ${data.rule}
// @SYMMETRY ${data.symmetry}_web_test
// @NUM_SOUPS ${data.soups}
// @NUM_OBJECTS ${data.objects}

// @CENSUS TABLE
// ${Object.entries(data.census).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join('\n')}

// @SAMPLE_SOUPIDS
// ${Object.entries(data.samples).sort((a, b) => data.census[b[0]] - data.census[a[0]]).map(x => x[0] + ' ' + x[1].join(' ')).join('\n')}`);
