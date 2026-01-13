
import {join} from 'node:path';
import {readFileSync} from 'node:fs';
import {stringMD5} from './md5.js';
import {RuleError, RLE_CHARS, SYMMETRY_LEAST, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';
import {HEX_TRANSITIONS, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPB0GenPattern, parseIsotropic, parseMAP, TRANSITIONS, VALID_HEX_TRANSITIONS, VALID_TRANSITIONS, findTrsSymmetry} from './map.js';
import {parseHROTRule, parseCatagolueHROTRule, HROTPattern, HROTB0Pattern} from './hrot.js';
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
    let end = rule[rule.length - 1];
    if (end === 'V' || end === 'H') {
        neighborhood = end;
        rule = rule.slice(0, -1);
    } else if (end === 'v') {
        neighborhood = 'V';
        rule = rule.slice(0, -1);
    } else if (end === 'h') {
        neighborhood = 'H';
        rule = rule.slice(0, -1);
    }
    if (match = rule.match(/^[gG]([0-9]+)/)) {
        states = parseInt(match[1]);
        rule = rule.slice(match[0].length);
    }
    if (match = rule.match(/\/[GgCc]?(\d+)$/)) {
        states = parseInt(match[1]);
        rule = rule.slice(0, -match[0].length);
    }
    end = rule[rule.length - 1];
    if (end === 'V' || end === 'H') {
        neighborhood = end;
        rule = rule.slice(0, -1);
    } else if (end === 'v') {
        neighborhood = 'V';
        rule = rule.slice(0, -1);
    } else if (end === 'h') {
        neighborhood = 'H';
        rule = rule.slice(0, -1);
    }
    if (rule.startsWith('MAP')) {
        trs = parseMAP(rule.slice(3));
        ruleStr = raw;
    } else if (rule.startsWith('W')) {
        if (!rule.match(/^W\d+$/)) {
            throw new RuleError('Invalid W rule');
        }
        let num = parseInt(rule.slice(1));
        if (Number.isNaN(num)) {
            throw new RuleError('Invalid W rule');
        }
        for (let i = 0; i < 512; i++) {
            trs[i | (1 << 4)] = 1;
        }
        for (let i = 0; i < 8; i++) {
            if (num & (1 << i)) {
                trs[((i & 4) << 6) | ((i & 2) << 4) | ((i & 1) << 2)] = 1;
            }
        }
        ruleStr = 'W' + num;
    } else {
        let b = '';
        let s = '';
        let sections: string[];
        let bs = false;
        if (rule.includes('/')) {
            sections = rule.split('/');
            if (sections.length > 2) {
                throw new RuleError('More than 1 slash provided');
            }
        } else if (rule.includes('_')) {
            sections = rule.split('_');
            if (sections.length > 2) {
                throw new RuleError('More than 1 underscore provided');
            }
        } else if (rule.includes('S') || rule.includes('s')) {
            let index = rule.indexOf('s');
            if (index === -1) {
                index = rule.indexOf('S');
            }
            sections = [rule.slice(0, index), rule.slice(index)];
            bs = true;
        } else {
            sections = [rule];
        }
        for (let i = 0; i < sections.length; i++) {
            let section = sections[i];
            if (section[0] === 'B' || section[0] === 'b') {
                bs = true;
                b = section.slice(1);
            } else if (section[0] === 'S' || section[0] === 's') {
                bs = true;
                s = section.slice(1);
            } else {
                if (!bs) {
                    if (i === 0) {
                        s = section;
                    } else if (i === 1) {
                        b = section;
                    } else {
                        throw new RuleError(`Expected 'B', 'b', 'S', or 's'`);
                    }
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
            out = parseIsotropic(b, s, TRANSITIONS, VALID_TRANSITIONS, false);
        } else if (neighborhood === 'H') {
            out = parseIsotropic(b, s, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, true);
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
        if (neighborhood === 'H') {
            ruleStr += 'H';
        }
    }
    if (trs[0]) {
        if (trs[511]) {
            let out = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                out[i] = 1 - trs[511 - i];
            }
            trs = out;
        } else {
            let evenTrs = new Uint8Array(512);
            let oddTrs = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                evenTrs[i] = 1 - trs[i];
                oddTrs[i] = trs[511 - i];
            }
            if (states > 2) {
                return new MAPB0GenPattern(data.height, data.width, data.data, evenTrs, oddTrs, states, ruleStr, SYMMETRY_LEAST[findTrsSymmetry(evenTrs)][findTrsSymmetry(oddTrs)]);
            } else {
                return new MAPB0Pattern(data.height, data.width, data.data, evenTrs, oddTrs, ruleStr, SYMMETRY_LEAST[findTrsSymmetry(evenTrs)][findTrsSymmetry(oddTrs)]);
            }
        }
    }
    if (states > 2) {
        return new MAPGenPattern(data.height, data.width, data.data, trs, states, ruleStr, findTrsSymmetry(trs));
    } else {
        return new MAPPattern(data.height, data.width, data.data, trs, ruleStr, findTrsSymmetry(trs));
    }
}


export function createPattern(rule: string, data: PatternData = {height: 0, width: 0, data: new Uint8Array(0)}, namedRules?: {[key: string]: string}, prevName?: string, useBgolly?: boolean): Pattern {
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
    if (rule.startsWith('R') || rule.startsWith('r')) {
        try {
            let out = rule.startsWith('R') ? parseHROTRule(rule) : parseCatagolueHROTRule(rule);
            if (typeof out === 'object') {
                let {range, b, s, nh, states, ruleStr, ruleSymmetry} = out;
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
                if (b[0]) {
                    if (s[range**2]) {
                        let temp = s;
                        s = b.reverse().map(x => 1 - x);
                        b = temp.reverse().map(x => 1 - x);
                    } else {
                        let evenB = b.map(x => 1 - x);
                        let evenS = s.map(x => 1 - x);
                        let oddB = s.reverse();
                        let oddS = b.reverse();
                        return new HROTB0Pattern(coords, range, evenB, evenS, oddB, oddS, nh, states, ruleStr, ruleSymmetry);
                    }
                }
                return new HROTPattern(coords, range, b, s, nh, states, ruleStr, ruleSymmetry);
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
            symmetry = SYMMETRY_LEAST[symmetry][q.ruleSymmetry];
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
    md5: string;
    seed: string;
    rule: string;
    symmetry: string;
    soups: number;
    objects: number;
    census: {[key: string]: number};
    samples: {[key: string]: number[]};
}

function redraw(): Promise<number> | undefined {
    if (typeof requestAnimationFrame === 'function') {
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(resolve);
            });
        });
    }
}

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


export function parseSpeed(speed: string): {dx: number, dy: number, period: number} {
    speed = speed.toLowerCase();
    if (!speed.includes('c')) {
        throw new Error('Invalid speed!');
    }
    let [disp, period] = speed.split('c');
    if (period.startsWith('/')) {
        period = period.slice(1);
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

export function speedToString({dx, dy, period}: {dx: number, dy: number, period: number}): string {
    if (dy === 0) {
        if (dx === 1) {
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
