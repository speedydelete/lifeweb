
import {Pattern, RuleError, RuleSymmetry, RLE_CHARS} from './pattern.js';
import {HEX_TRANSITIONS, MAPPattern, parseIsotropic, parseMAP, TRANSITIONS, VALID_HEX_TRANSITIONS, VALID_TRANSITIONS} from './map.js';

export {Pattern, RuleError, RuleSymmetry} from './pattern.js';
export * as pattern from './pattern.js';
export * as map from './map.js';


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

function parseMAPRule(rule: string, data: PatternData): string | MAPPattern {
    let raw = rule;
    let ruleStr: string;
    let trs = new Uint8Array(512);
    let neighborhood: 'M' | 'V' | 'H' | 'L' = 'M';
    let states = 2;
    let isotropic = false;
    let match: RegExpMatchArray | null;
    let isGenFormat = false;
    if (match = rule.match(/^[gG]([0-9]+)/)) {
        states = parseInt(match[1]);
        rule = rule.slice(match[0].length);
    }
    if (match = rule.match(/\/[GgCc]?(\d+)$/)) {
        states = parseInt(match[1]);
        rule = rule.slice(0, match[0].length);
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
        return `R1,C${states},${rule}`;
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
            let even = new Uint8Array(512);
            let odd = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                even[i] = trs[i] ? 0 : 1;
                odd[i] = trs[511 - i];
            }
        }
    }
    let symmetry: RuleSymmetry;
    if (isotropic) {
        symmetry = 'D8';
    } else {
        let C2 = true;
        let C4 = true;
        let D2v = true;
        let D2h = true;
        let D2x = true;
        for (let i = 0; i < 512; i++) {
            let j = ((i << 6) & 448) | (i & 56) | (i >> 6);
            j = ((j & 73) << 1) | (j & 146) | ((j & 292) >> 1);
            if (trs[i] !== trs[j]) {
                C2 = false;
                break;
            }
        }
        if (C2) {
            for (let i = 0; i < 512; i++) {
                if (trs[i] !== trs[((i >> 2) & 66) | ((i >> 4) & 8) | ((i >> 6) & 1) | ((i << 2) & 36) | ((i << 6) & 256) | ((i << 4) & 32) | (i & 16)]) {
                    C4 = false;
                    break;
                }
            }
        }
        for (let i = 0; i < 512; i++) {
            if (trs[i] !== trs[((i & 73) << 1) | (i & 146) | ((i & 292) >> 1)]) {
                D2v = false;
                break;
            }
        }
        for (let i = 0; i < 512; i++) {
            if (trs[i] !== trs[((i & 73) << 1) | (i & 146) | ((i & 292) >> 1)]) {
                D2h = false;
                break;
            }
        }
        for (let i = 0; i < 512; i++) {
            if (trs[i] !== trs[(i & 273) | ((i & 32) << 2) | ((i & 6) << 4) | ((i & 136) >> 2) | ((i & 64) >> 4)]) {
                D2x = false;
                break;
            }
        }
        if (C4) {
            if (D2h || D2v || D2h) {
                symmetry = 'D8';
            } else {
                symmetry = 'C4';
            }
        } else if (C2) {
            if (D2h || D2v) {
                if (D2x) {
                    symmetry = 'D8';
                } else {
                    symmetry = 'D4+';
                }
            } else if (D2x) {
                symmetry = 'D4x';
            } else {
                symmetry = 'C2';
            }
        } else if (D2h || D2v || D2x) {
            if (D2x) {
                if (D2h || D2v) {
                    symmetry = 'D8';
                } else {
                    symmetry = 'D2x';
                }
            } else if (D2h && D2v) {
                symmetry = 'D4+';
            } else if (D2h) {
                symmetry = 'D2h';
            } else {
                symmetry = 'D2v';
            }
        } else {
            symmetry = 'C1';
        }
    }
    return new MAPPattern(data.height, data.width, data.data, trs, ruleStr, symmetry);
}


function _createPattern(data: PatternData, rule: string): Pattern {
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
    //             return out;
    //         } else {
    //             rule = out;
    //         }
    //     } catch (error) {
    //         if (error instanceof RuleError) {
    //             errors.push(error);
    //         } else {
    //             throw error;
    //         }
    //     }
    // }
    throw new RuleError(errors.join(', '));
}


export function parse(rle: string): Pattern {
    let lines = rle.split('\n');
    let raw: number[][] = [];
    let rule = 'B3/S23';
    let height = -1;
    let width = -1;
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
            } else if (line && !headerFound) {
                headerFound = true;
                line = line.trim();
                for (let pair of line.split(',')) {
                    if (!pair.includes('=')) {
                        continue;
                    }
                    let [key, value] = pair.split('=');
                    key = key.trim();
                    if (key === 'x') {
                        width = parseInt(value);
                    } else if (key === 'y') {
                        height = parseInt(value);
                    } else if (key === 'rule') {
                        rule = value;
                    }
                }
            } else {
                data += line;
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
            } else if (char === '$') {
                raw.push(currentLine);
                currentLine = [];
                if (num !== '') {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
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
    let actualHeight = raw.length;
    let actualWidth = Math.max(...raw.map(x => x.length));
    if (height < actualHeight) {
        height = actualHeight;
    }
    if (width < actualWidth) {
        width = actualWidth;
    }
    let data = new Uint8Array(height * width);
    for (let y = 0; y < raw.length; y++) {
        let i = y * width;
        let line = raw[y];
        for (let x = 0; x < line.length; x++) {
            data[i] = line[x];
            i++;
        }
    }
    let out = _createPattern({height, width, data}, rule);
    out.xOffset = xOffset;
    out.yOffset = yOffset;
    out.generation = generation;
    return out;
}
