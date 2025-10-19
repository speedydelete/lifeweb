
import {Pattern, RuleError, RuleSymmetry, PatternData} from './pattern.js';


/*
trs index must be abcdefghi where:
a d g
b e h
c f i
*/


export class MAPPattern extends Pattern {

    trs: Uint8Array;
    ruleStr: string;
    states: 2 = 2;
    ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array, trs: Uint8Array, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.trs = trs;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    copy(): MAPPattern {
        let out = new MAPPattern(this.height, this.width, this.data, this.trs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    runGeneration(): this {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let data = this.data;
        let trs = this.trs;
        let width2 = width << 1;
        let lastRow = size - width;
        let secondLastRow = size - width2;
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let i = 1;
        let j = lastRow + 1;
        let tr1 = (data[0] << 3) | data[1];
        let tr2 = (data[lastRow] << 5) | (data[lastRow + 1] << 2);
        if (trs[tr1]) {
            expandUp = 1;
            upExpands[0] = 1;
        }
        if (trs[tr2]) {
            expandDown = 1;
            downExpands[0] = 1;
        }
        for (let loc = 1; loc < width - 1; loc++) {
            i++;
            j++;
            tr1 = ((tr1 << 3) & 511) | data[i];
            tr2 = ((tr2 << 3) & 511) | (data[j] << 2);
            if (trs[tr1]) {
                expandUp = 1;
                upExpands[loc] = 1;
            }
            if (trs[tr2]) {
                expandDown = 1;
                downExpands[loc] = 1;
            }
        }
        if (trs[(tr1 << 3) & 511]) {
            expandUp = 1;
            upExpands[width - 1] = 1;
        }
        if (trs[(tr2 << 3) & 511]) {
            expandDown = 1;
            downExpands[width - 1] = 1;
        }
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (data[0] << 1) | data[width];
        tr2 = (data[width - 1] << 7) | (data[width2 - 1] << 6);
        if (trs[tr1]) {
            expandLeft = 1;
            leftExpands[0] = 1;
        }
        if (trs[tr2]) {
            expandRight = 1;
            rightExpands[0] = 1;
        }
        let loc = 0;
        for (i = width2; i < size; i += width) {
            loc++;
            tr1 = ((tr1 << 1) & 7) | data[i];
            tr2 = ((tr2 << 1) & 511) | (data[i + width - 1] << 6);
            if (trs[tr1]) {
                expandLeft = 1;
                leftExpands[loc] = 1;
            }
            if (trs[tr2]) {
                expandRight = 1;
                rightExpands[loc] = 1;
            }
        }
        i -= width;
        if (trs[(tr1 << 1) & 7]) {
            expandLeft = 1;
            leftExpands[height - 1] = 1;
        }
        if (trs[(tr2 << 1) & 511]) {
            expandRight = 1;
            rightExpands[height - 1] = 1;
        }
        let b1cnw = (trs[1] && data[0]) ? 1 : 0;
        let b1cne = (trs[64] && data[width - 1]) ? 1 : 0;
        let b1csw = (trs[4] && data[lastRow]) ? 1 : 0;
        let b1cse = (trs[256] && data[size - 1]) ? 1 : 0;
        if (b1cnw || b1cne) {
            expandUp = 1;
        }
        if (b1csw || b1cse) {
            expandDown = 1;
        }
        if (b1cnw || b1csw) {
            expandLeft = 1;
        }
        if (b1cne || b1cse) {
            expandRight = 1;
        }
        let oX = expandLeft + expandRight;
        let oStart = (expandUp ? width + oX : 0) + expandLeft;
        let oSize = oStart + oX * height;
        let oLast = oSize - oX;
        let newWidth = width + oX;
        let newHeight = height + expandUp + expandDown;
        let newSize = newWidth * newHeight;
        let out = new Uint8Array(newSize);
        out[0] = b1cnw;
        out[newWidth - 1] = b1cne;
        out[newSize - newWidth] = b1csw;
        out[newSize - 1] = b1cse;
        if (expandUp) {
            out.set(upExpands, expandLeft);
        }
        if (expandDown) {
            out.set(downExpands, size + oSize);
        }
        if (expandLeft) {
            let loc = oStart - width - oX - 1;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = leftExpands[i];
            }
        }
        if (expandRight) {
            let loc = oStart - oX;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = rightExpands[i];
            }
        }
        if (width <= 1) {
            if (width === 1) {
                let tr = (data[0] << 4) | (data[1] << 3);
                let loc = oStart;
                if (trs[tr]) {
                    out[loc] = 1;
                }
                loc += oX + 1;
                for (i = 1; i < height - 1; i++) {
                    tr = ((tr << 1) & 63) | (data[i + 1] << 3);
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    loc += oX + 1;
                }
                if (trs[(tr << 1) & 63]) {
                    out[loc + oX + 1] = 1;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oLast;
            j = lastRow;
            tr1 = (data[0] << 4) | (data[width] << 3) | (data[1] << 1) | data[width + 1];
            tr2 = (data[secondLastRow] << 5) | (data[lastRow] << 4) | (data[secondLastRow + 1] << 2) | (data[lastRow + 1] << 1);
            if (trs[tr1]) {
                out[loc1] = 1;
            }
            if (trs[tr2]) {
                out[loc2] = 1;
            }
            for (i = 1; i < width - 1; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i + 1] << 1) | data[i + width + 1];
                if (trs[tr1]) {
                    out[loc1] = 1;
                }
                tr2 = ((tr2 << 3) & 511) | (data[j - width + 1] << 2) | (data[j + 1] << 1);
                if (trs[tr2]) {
                    out[loc2] = 1;
                }
            }
            if (trs[(tr1 << 3) & 511]) {
                out[loc1 + 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                out[loc2 + 1] = 1;
            }
            i = width;
            loc = oStart + width - 1;
            for (let y = 1; y < height - 1; y++) {
                i++;
                loc += oX + 1;
                let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                if (trs[tr]) {
                    out[loc] = 1;
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    i++;
                    loc++;
                }
                if (trs[(tr << 3) & 511]) {
                    out[loc] = 1;
                }
            }
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
        return this;
    }

}



/*
let f = i => (i & 273) | ((i & 32) << 2) | ((i & 4) << 4) | ((i & 128) >> 2) | ((i & 2) << 2) | ((i & 64) >> 4) | ((i & 8) >> 2);
x = Object.entries(x).map(y => [y[0], Object.entries(y[1])]);
'{\n' + x.map(y => '    ' + y[0] + ': {\n' + y[1].map(z => '        ' + z[0] + ': [' + z[1].map(a => f(a)).join(', ') + '],\n').join('') + '    },\n').join('') + '}'
*/

export const TRANSITIONS: {[key: string]: number[]} = {
    '0c': [0],
    '1c': [4, 256, 1, 64],
    '1e': [2, 128, 8, 32],
    '2c': [5, 320, 65, 260],
    '2e': [34, 160, 10, 136],
    '2k': [66, 129, 258, 264, 12, 96, 132, 33],
    '2a': [6, 384, 3, 9, 72, 36, 192, 288],
    '2i': [130, 40],
    '2n': [68, 257],
    '3c': [69, 321, 261, 324],
    '3e': [42, 168, 138, 162],
    '3k': [98, 161, 266, 140],
    '3a': [38, 416, 11, 200],
    '3i': [292, 73, 7, 448],
    '3n': [37, 352, 13, 67, 193, 262, 328, 388],
    '3y': [133, 322, 97, 268],
    '3q': [100, 289, 265, 259, 196, 70, 76, 385],
    '3j': [137, 74, 164, 224, 35, 392, 290, 14],
    '3r': [131, 194, 134, 104, 41, 296, 386, 44],
    '4c': [325],
    '4e': [170],
    '4k': [99, 225, 270, 330, 141, 354, 396, 165],
    '4a': [420, 294, 201, 39, 480, 15, 75, 456],
    '4i': [45, 360, 195, 390],
    '4n': [356, 293, 329, 263, 452, 71, 77, 449],
    '4y': [389, 326, 197, 101, 353, 269, 323, 332],
    '4q': [102, 417, 267, 204],
    '4j': [169, 106, 172, 226, 163, 394, 298, 142],
    '4r': [139, 202, 166, 232, 43, 424, 418, 46],
    '4t': [135, 450, 105, 300],
    '4w': [228, 291, 393, 78],
    '4z': [198, 387, 297, 108],
    '5c': [426, 174, 234, 171],
    '5e': [453, 327, 357, 333],
    '5k': [397, 334, 229, 355],
    '5a': [457, 79, 484, 295],
    '5i': [203, 422, 488, 47],
    '5n': [458, 143, 482, 428, 302, 233, 167, 107],
    '5y': [362, 173, 398, 227],
    '5q': [395, 206, 230, 236, 299, 425, 419, 110],
    '5j': [358, 421, 331, 271, 460, 103, 205, 481],
    '5r': [364, 301, 361, 391, 454, 199, 109, 451],
    '6c': [490, 175, 430, 235],
    '6e': [461, 335, 485, 359],
    '6k': [429, 366, 237, 231, 483, 399, 363, 462],
    '6a': [489, 111, 492, 486, 423, 459, 303, 207],
    '6i': [365, 455],
    '6n': [427, 238],
    '7c': [491, 239, 494, 431],
    '7e': [493, 367, 487, 463],
    '8c': [495],
};

export const VALID_TRANSITIONS: string[] = [
    'c',
    'ce',
    'aceikn',
    'aceijknqry',
    'aceijknqrtwyz',
    'aceijknqry',
    'aceikn',
    'ce',
    'c'
];

export const HEX_TRANSITIONS: {[key: string]: number[]} = {
    '0o': [0, 64, 32, 96],
    '1o': [1, 65, 33, 97, 8, 72, 40, 104, 2, 66, 34, 98, 128, 192, 160, 224, 32, 96, 32, 96, 256, 320, 288, 352],
    '2o': [9, 73, 41, 105, 10, 74, 42, 106, 130, 194, 162, 226, 160, 224, 160, 224, 288, 352, 288, 352, 257, 321, 289, 353],
    '2m': [3, 67, 35, 99, 136, 200, 168, 232, 34, 98, 34, 98, 384, 448, 416, 480, 33, 97, 33, 97, 264, 328, 296, 360],
    '2p': [129, 193, 161, 225, 40, 104, 40, 104, 258, 322, 290, 354],
    '3o': [11, 75, 43, 107, 138, 202, 170, 234, 162, 226, 162, 226, 416, 480, 416, 480, 289, 353, 289, 353, 265, 329, 297, 361],
    '3m': [161, 225, 161, 225, 296, 360, 296, 360, 259, 323, 291, 355, 137, 201, 169, 233, 42, 106, 42, 106, 386, 450, 418, 482, 131, 195, 163, 227, 168, 232, 168, 232, 290, 354, 290, 354, 385, 449, 417, 481, 41, 105, 41, 105, 266, 330, 298, 362],
    '3p': [35, 99, 35, 99, 392, 456, 424, 488],
    '4o': [139, 203, 171, 235, 170, 234, 170, 234, 418, 482, 418, 482, 417, 481, 417, 481, 297, 361, 297, 361, 267, 331, 299, 363],
    '4m': [163, 227, 163, 227, 424, 488, 424, 488, 291, 355, 291, 355, 393, 457, 425, 489, 43, 107, 43, 107, 394, 458, 426, 490],
    '4p': [169, 233, 169, 233, 298, 362, 298, 362, 387, 451, 419, 483],
    '5o': [171, 235, 171, 235, 426, 490, 426, 490, 419, 483, 419, 483, 425, 489, 425, 489, 299, 363, 299, 363, 395, 459, 427, 491],
    '6o': [427, 491, 427, 491],
};

export const VALID_HEX_TRANSITIONS: string[] = [
    'o',
    'o',
    'omp',
    'omp',
    'omp',
    'o',
    'o',
];

const DIGITS = '0123456789';
const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function parseTransitions(data: string, validTrs: string[], type: string): string[] {
    if (data.length === 0) {
        return [];
    }
    let out = new Set<string>();
    if (!DIGITS.includes(data[0])) {
        throw new RuleError(`Expected digit, got '${data[0]}'`);
    }
    let num = parseInt(data[0]);
    if (num >= validTrs.length) {
        throw new RuleError(`No ${type} transitions with ${num} neighbors`);
    }
    let chars = '';
    let minus = false;
    for (let char of data.slice(1)) {
        if (DIGITS.includes(char)) {
            if (chars.length === 0) {
                for (let char of validTrs[num]) {
                    out.add(num + char);
                }
            } else {
                for (let char of chars) {
                    if (minus) {
                        out.delete(num + char);
                    } else {
                        out.add(num + char);
                    }
                }
            }
            num = parseInt(char);
            if (num >= validTrs.length) {
                throw new RuleError(`No ${type} transitions with ${num} neighbors`);
            }
        } else if (char === '-') {
            if (chars.length > 0) {
                throw new RuleError(`Expected letter, got '-'`);
            }
            minus = true;
            for (let char of validTrs[num]) {
                out.add(num + char);
            }
        } else if (LETTERS.includes(char)) {
            if (!validTrs[num].includes(char)) {
                throw new RuleError(`Invalid ${type} transition: '${num}${char}'`);
            }
            chars += char;
        } else {
            throw new RuleError(`Invalid character in isotropic rulestring: '${char}'`);
        }
    }
    if (chars.length === 0) {
        for (let char of validTrs[num]) {
            out.add(num + char);
        }
    } else {
        for (let char of chars) {
            if (minus) {
                out.delete(num + char);
            } else {
                out.add(num + char);
            }
        }
    }
    return Array.from(out);
}

export function unparseTransitions(trs: string[], validTrs: string[], preferMinus: boolean): string {
    let sorted: string[] = [];
    for (let i = 0; i < validTrs.length; i++) {
        sorted.push('');
    }
    for (let tr of trs) {
        sorted[parseInt(tr[0])] += tr[1];
    }
    let out = '';
    for (let i = 0; i < validTrs.length; i++) {
        if (sorted[i] === '') {
            continue;
        } else if (sorted[i].length === validTrs[i].length) {
            out += i;
        } else {
            out += i;
            let chars = Array.from(sorted[i]).sort().join('');
            let minus = '-';
            for (let char of validTrs[i]) {
                if (!chars.includes(char)) {
                    minus += char;
                }
            }
            if (chars.length > minus.length || (chars.length === minus.length && preferMinus)) {
                out += minus;
            } else {
                out += chars;
            }
        }
    }
    return out;
}

export function transitionsToArray(b: string[], s: string[], trs: {[key: string]: number[]}): Uint8Array<ArrayBuffer> {
    let out = new Uint8Array(512);
    for (let tr of b) {
        for (let i of trs[tr]) {
            out[i] = 1;
        }
    }
    for (let tr of s) {
        for (let i of trs[tr]) {
            out[i | (1 << 4)] = 1;
        }
    }
    return out;
}

export function arrayToTransitions(array: Uint8Array, trs: {[key: string]: number[]}): [string[], string[]] {
    let b: string[] = [];
    let s: string[] = [];
    for (let tr in trs) {
        if (array[trs[tr][0]]) {
            b.push(tr);
        }
        if (array[trs[tr][0] | (1 << 4)]) {
            s.push(tr);
        }
    }
    return [b, s];
}

export function parseIsotropic(b: string, s: string, trs: {[key: string]: number[]},  validTrs: string[], type: string, preferMinus: boolean): {b: string, s: string, data: Uint8Array<ArrayBuffer>} {
    let bTrs = parseTransitions(b, validTrs, type);
    let sTrs = parseTransitions(s, validTrs, type);
    return {
        b: unparseTransitions(bTrs, validTrs, preferMinus),
        s: unparseTransitions(sTrs, validTrs, preferMinus),
        data: transitionsToArray(bTrs, sTrs, trs),
    };
}


const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function parseMAP(data: string): Uint8Array<ArrayBuffer> {
    let out = new Uint8Array(512);
    let j = 0;
    for (let i = 0; i < data.length; i += 4) {
        let a = BASE64.indexOf(data[i]);
        let b = BASE64.indexOf(data[i + 1]);
        let c = BASE64.indexOf(data[i + 2]);
        let d = BASE64.indexOf(data[i + 3]);
        if (c === -1) {
            out[j++] = (a << 2) | (b >> 4);
            return out;
        }
        if (d === -1) {
            out[j++] = (a << 2) | (b >> 4);
            if (j === out.length) {
                return out;
            }
            out[j++] = ((b & 15) << 4) | (c >> 2);
            return out;
        }
        out[j++] = (a << 2) | (b >> 4);
        if (j === out.length) {
            return out;
        }
        out[j++] = ((b & 15) << 4) | (c >> 2);
        if (j === out.length) {
            return out;
        }
        out[j++] = ((c & 3) << 6) | d;
        if (j === out.length) {
            return out;
        }
    }
    return out;
}


const VON_NEUMANN: string[][] = [
    ['0c', '1c', '2c', '2n', '3c', '4c'],
    ['1e', '2k', '3i', '3n', '3y', '3q', '4n', '4y', '5e'],
    ['2e', '2i', '3k', '3a', '3j', '3r', '4k', '4a', '4i', '4q', '4t', '4w', '4z', '5k', '5a', '5i', '5r', '6e', '6i'],
    ['3e', '4j', '4r', '5i', '5n', '5y', '5q', '6k', '6a', '7e'],
    ['4e', '5c', '6c', '6n', '7c', '8c'],
];

export function parseMAPRule(rule: string, data: PatternData): string | MAPPattern {
    let raw = rule;
    let ruleStr: string;
    let trs = new Uint8Array(512);
    let neighborhood: 'M' | 'V' | 'H' | 'L' = 'M';
    let states = 2;
    let isotropic = false;
    let match: RegExpMatchArray | null;
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
