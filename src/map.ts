
import {Pattern, RuleError, RuleSymmetry, symmetryFromBases} from './pattern.js';


/*
trs index must be abcdefghi where:
a d g
b e h
c f i
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
            minus = false;
            chars = '';
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


export function findSymmetry(trs: Uint8Array): RuleSymmetry {
    let C2 = true;
    let C4 = true;
    let D2v = true;
    let D2h = true;
    let D2x = true;
    for (let i = 0; i < 512; i++) {
        let j = ((i << 6) & 448) | (i & 56) | (i >> 6);
        j = ((j & 73) << 2) | (j & 146) | ((j & 292) >> 2);
        if (trs[i] !== trs[j]) {
            C2 = false;
            C4 = false;
            break;
        }
    }
    if (C2) {
        for (let i = 0; i < 512; i++) {
            if (trs[i] !== trs[((i >> 2) & 66) | ((i >> 4) & 8) | ((i >> 6) & 1) | ((i << 2) & 132) | ((i << 6) & 256) | ((i << 4) & 32) | (i & 16)]) {
                C4 = false;
                break;
            }
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[((i & 73) << 2) | (i & 146) | ((i & 292) >> 2)]) {
            D2v = false;
            break;
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[((i << 6) & 448) | (i & 56) | (i >> 6)]) {
            D2h = false;
            break;
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            D2x = false;
            break;
        }
    }
    return symmetryFromBases(C2, C4, D2h, D2v, D2x);
}


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
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
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
            j = lastRow + 1;
            tr1 = (data[0] << 4) | (data[width] << 3) | (data[1] << 1) | data[width + 1];
            tr2 = (data[secondLastRow] << 5) | (data[lastRow] << 4) | (data[secondLastRow + 1] << 2) | (data[lastRow + 1] << 1);
            if (trs[tr1]) {
                out[loc1] = 1;
            }
            if (trs[tr2]) {
                out[loc2] = 1;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i] << 1) | data[i + width];
                if (trs[tr1]) {
                    out[loc1] = 1;
                }
                tr2 = ((tr2 << 3) & 511) | (data[j - width] << 2) | (data[j] << 1);
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
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
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
                i++;
                loc++;
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

    copy(): MAPPattern {
        let out = new MAPPattern(this.height, this.width, this.data, this.trs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPPattern {
        return new MAPPattern(0, 0, new Uint8Array(0), this.trs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, width: number, height: number): MAPPattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

}


export class MAPB0Pattern extends Pattern {

    evenTrs: Uint8Array;
    oddTrs: Uint8Array;
    ruleStr: string;
    states: 2 = 2;
    ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array, evenTrs: Uint8Array, oddTrs: Uint8Array, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.evenTrs = evenTrs;
        this.oddTrs = oddTrs;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): this {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let data = this.data;
        let trs = this.generation % 2 === 0 ? this.evenTrs : this.oddTrs;
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
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
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
            j = lastRow + 1;
            tr1 = (data[0] << 4) | (data[width] << 3) | (data[1] << 1) | data[width + 1];
            tr2 = (data[secondLastRow] << 5) | (data[lastRow] << 4) | (data[secondLastRow + 1] << 2) | (data[lastRow + 1] << 1);
            if (trs[tr1]) {
                out[loc1] = 1;
            }
            if (trs[tr2]) {
                out[loc2] = 1;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i] << 1) | data[i + width];
                if (trs[tr1]) {
                    out[loc1] = 1;
                }
                tr2 = ((tr2 << 3) & 511) | (data[j - width] << 2) | (data[j] << 1);
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
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
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
                i++;
                loc++;
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

    copy(): MAPB0Pattern {
        let out = new MAPB0Pattern(this.height, this.width, this.data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPB0Pattern {
        return new MAPB0Pattern(0, 0, new Uint8Array(0), this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, width: number, height: number): MAPB0Pattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPB0Pattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

}


export class MAPGenPattern extends Pattern {

    trs: Uint8Array;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array, trs: Uint8Array, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.trs = trs;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): this {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let states = this.states;
        let data = this.data;
        let alive = this.data.map(x => x === 1 ? 1 : 0);
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
        let tr1 = (alive[0] << 3) | alive[1];
        let tr2 = (alive[lastRow] << 5) | (alive[lastRow + 1] << 2);
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
            tr1 = ((tr1 << 3) & 511) | alive[i];
            tr2 = ((tr2 << 3) & 511) | (alive[j] << 2);
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
        tr1 = (alive[0] << 1) | alive[width];
        tr2 = (alive[width - 1] << 7) | (alive[width2 - 1] << 6);
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
            tr1 = ((tr1 << 1) & 7) | alive[i];
            tr2 = ((tr2 << 1) & 511) | (alive[i + width - 1] << 6);
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
        let b1cnw = (trs[1] && alive[0]) ? 1 : 0;
        let b1cne = (trs[64] && alive[width - 1]) ? 1 : 0;
        let b1csw = (trs[4] && alive[lastRow]) ? 1 : 0;
        let b1cse = (trs[256] && alive[size - 1]) ? 1 : 0;
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
                if (data[0] < 2) {
                    if (trs[tr]) {
                        out[loc] = 1;
                    } else if (data[0]) {
                        out[loc] = 2;
                    }
                } else {
                    out[loc] = (data[0] + 1) % states;
                }
                loc += oX + 1;
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
                    if (data[i - 1] < 2) {
                        if (trs[tr]) {
                            out[loc] = 1;
                        } else if (data[i - 1]) {
                            out[loc] = 2;
                        }
                    } else {
                        out[loc] = (data[i - 1] + 1) % states;
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
            j = lastRow + 1;
            tr1 = (alive[0] << 4) | (alive[width] << 3) | (alive[1] << 1) | alive[width + 1];
            tr2 = (alive[secondLastRow] << 5) | (alive[lastRow] << 4) | (alive[secondLastRow + 1] << 2) | (alive[lastRow + 1] << 1);
            if (data[0] < 2) {
                if (trs[tr1]) {
                    out[loc1] = 1;
                } else if (data[0]) {
                    out[loc1] = 2;
                }
            } else {
                out[loc1] = (data[0] + 1) % states;
            }
            if (data[lastRow] < 2) {
                if (trs[tr2]) {
                    out[loc2] = 1;
                } else if (data[lastRow]) {
                    out[loc2] = 2;
                }
            } else {
                out[loc2] = (data[lastRow] + 1) % states;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (alive[i] << 1) | alive[i + width];
                if (data[i - 1] < 2) {
                    if (trs[tr1]) {
                        out[loc1] = 1;
                    } else if (data[i - 1]) {
                        out[loc1] = 2;
                    }
                } else {
                    out[loc1] = (data[i - 1] + 1) % states;
                }
                tr2 = ((tr2 << 3) & 511) | (alive[j - width] << 2) | (alive[j] << 1);
                if (data[j - 1] < 2) {
                    if (trs[tr2]) {
                        out[loc2] = 1;
                    } else if (data[j - 1]) {
                        out[loc2] = 2;
                    }
                } else {
                    out[loc2] = (data[j - 1] + 1) % states;
                }
            }
            i--;
            loc1++;
            loc2++;
            if (data[i] < 2) {
                if (trs[(tr1 << 3) & 511]) {
                    out[loc1] = 1;
                } else if (data[i]) {
                    out[loc1] = 2;
                }
            } else {
                out[loc1] = (data[i] + 1) % states;
            }
            if (data[j] < 2) {
                if (trs[(tr2 << 3) & 511]) {
                    out[loc2] = 1;
                } else if (data[j]) {
                    out[loc2] = 2;
                }
            } else {
                out[loc2] = (data[j] + 1) % states;
            }
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
                let tr = (alive[i - width - 1] << 5) | (alive[i - 1] << 4) | (alive[i + width - 1] << 3) | (alive[i - width] << 2) | (alive[i] << 1) | alive[i + width];
                if (data[i - 1] < 2) {
                    if (trs[tr]) {
                        out[loc] = 1;
                    } else if (data[i - 1]) {
                        out[loc] = 2;
                    }
                } else {
                    out[loc] = (data[i - 1] + 1) % states;
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    tr = ((tr << 3) & 511) | (alive[i - width] << 2) | (alive[i] << 1) | alive[i + width];
                    if (data[i - 1] < 2) {
                        if (trs[tr]) {
                            out[loc] = 1;
                        } else if (data[i - 1]) {
                            out[loc] = 2;
                        }
                    } else {
                        out[loc] = (data[i - 1] + 1) % states;
                    }
                    i++;
                    loc++;
                }
                if (data[i - 1] < 2) {
                    if (trs[(tr << 3) & 511]) {
                        out[loc] = 1;
                    } else if (data[i - 1]) {
                        out[loc] = 2;
                    }
                } else {
                    out[loc] = (data[i - 1] + 1) % states;
                }
                i++;
                loc++;
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

    copy(): MAPPattern {
        let out = new MAPPattern(this.height, this.width, this.data, this.trs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPPattern {
        return new MAPPattern(0, 0, new Uint8Array(0), this.trs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, width: number, height: number): MAPPattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

}


export class MAPB0GenPattern extends Pattern {

    evenTrs: Uint8Array;
    oddTrs: Uint8Array;
    ruleStr: string;
    states: number;
    ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array, evenTrs: Uint8Array, oddTrs: Uint8Array, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.evenTrs = evenTrs;
        this.oddTrs = oddTrs;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): this {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let states = this.states;
        let data = this.data;
        let alive = new Uint8Array(size);
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i] === 1) {
                alive[i] = 1;
            }
        }
        let trs = this.generation % 2 === 0 ? this.evenTrs : this.oddTrs;
        let width2 = width << 1;
        let lastRow = size - width;
        let secondLastRow = size - width2;
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let i = 1;
        let j = lastRow + 1;
        let tr1 = (alive[0] << 3) | alive[1];
        let tr2 = (alive[lastRow] << 5) | (alive[lastRow + 1] << 2);
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
            tr1 = ((tr1 << 3) & 511) | alive[i];
            tr2 = ((tr2 << 3) & 511) | (alive[j] << 2);
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
        tr1 = (alive[0] << 1) | alive[width];
        tr2 = (alive[width - 1] << 7) | (alive[width2 - 1] << 6);
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
            tr1 = ((tr1 << 1) & 7) | alive[i];
            tr2 = ((tr2 << 1) & 511) | (alive[i + width - 1] << 6);
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
        let b1cnw = (trs[1] && alive[0]) ? 1 : 0;
        let b1cne = (trs[64] && alive[width - 1]) ? 1 : 0;
        let b1csw = (trs[4] && alive[lastRow]) ? 1 : 0;
        let b1cse = (trs[256] && alive[size - 1]) ? 1 : 0;
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
        let loc1 = oStart;
        let loc2 = lastRow + oLast;
        j = lastRow + 1;
        tr1 = (alive[0] << 4) | (alive[width] << 3) | (alive[1] << 1) | alive[width + 1];
        tr2 = (alive[secondLastRow] << 5) | (alive[lastRow] << 4) | (alive[secondLastRow + 1] << 2) | (alive[lastRow + 1] << 1);
        if (data[0] < 2) {
            if (trs[tr1]) {
                out[loc1] = 1;
            } else if (data[0]) {
                out[loc1] = 2;
            }
        } else {
            out[loc1] = (data[0] + 1) % states;
        }
        if (data[lastRow] < 2) {
            if (trs[tr2]) {
                out[loc2] = 1;
            } else if (data[lastRow]) {
                out[loc2] = 2;
            }
        } else {
            out[loc2] = (data[lastRow] + 1) % states;
        }
        for (i = 2; i < width; i++) {
            j++;
            loc1++;
            loc2++;
            tr1 = ((tr1 << 3) & 511) | (alive[i] << 1) | alive[i + width];
            if (data[i - 1] < 2) {
                if (trs[tr1]) {
                    out[loc1] = 1;
                } else if (data[i - 1]) {
                    out[loc1] = 2;
                }
            } else {
                out[loc1] = (data[i - 1] + 1) % states;
            }
            tr2 = ((tr2 << 3) & 511) | (alive[j - width] << 2) | (alive[j] << 1);
            if (data[j - 1] < 2) {
                if (trs[tr2]) {
                    out[loc2] = 1;
                } else if (data[j - 1]) {
                    out[loc2] = 2;
                }
            } else {
                out[loc2] = (data[j - 1] + 1) % states;
            }
        }
        i--;
        loc1++;
        loc2++;
        if (data[i] < 2) {
            if (trs[(tr1 << 3) & 511]) {
                out[loc1] = 1;
            } else if (data[i]) {
                out[loc1] = 2;
            }
        } else {
            out[loc1] = (data[i] + 1) % states;
        }
        if (data[j] < 2) {
            if (trs[(tr2 << 3) & 511]) {
                out[loc2] = 1;
            } else if (data[j]) {
                out[loc2] = 2;
            }
        } else {
            out[loc2] = (data[j] + 1) % states;
        }
        i = width + 1;
        loc = oStart + width;
        for (let y = 1; y < height - 1; y++) {
            loc += oX;
            let tr = (alive[i - width - 1] << 5) | (alive[i - 1] << 4) | (alive[i + width - 1] << 3) | (alive[i - width] << 2) | (alive[i] << 1) | alive[i + width];
            if (data[i - 1] < 2) {
                if (trs[tr]) {
                    out[loc] = 1;
                } else if (data[i - 1]) {
                    out[loc] = 2;
                }
            } else {
                out[loc] = (data[i - 1] + 1) % states;
            }
            i++;
            loc++;
            for (let x = 1; x < width - 1; x++) {
                tr = ((tr << 3) & 511) | (alive[i - width] << 2) | (alive[i] << 1) | alive[i + width];
                if (data[i - 1] < 2) {
                    if (trs[tr]) {
                        out[loc] = 1;
                    } else if (data[i - 1]) {
                        out[loc] = 2;
                    }
                } else {
                    out[loc] = (data[i - 1] + 1) % states;
                }
                i++;
                loc++;
            }
            if (data[i - 1] < 2) {
                if (trs[(tr << 3) & 511]) {
                    out[loc] = 1;
                } else if (data[i - 1]) {
                    out[loc] = 2;
                }
            } else {
                out[loc] = (data[i - 1] + 1) % states;
            }
            i++;
            loc++;
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

    copy(): MAPB0Pattern {
        let out = new MAPB0Pattern(this.height, this.width, this.data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPB0Pattern {
        return new MAPB0Pattern(0, 0, new Uint8Array(0), this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, width: number, height: number): MAPB0Pattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPB0Pattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

}
