
/* Implements the 2**512 2-state range-1 Moore-neighborhood cellular automata and their Generations variants. 
We index the trs variables like this to make it faster:
852
741
630
The rest of this file assumes you are familiar with the INT notation (https://conwaylife.com/wiki/Isotropic_non-totalistic_rule). */

import {DataPattern, RuleError, RuleSymmetry, SYMMETRY_MEET, getRuleSymmetryFromBases} from './pattern.js';


/** Each INT transition's mapping to a 9-bit number. */
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

/** The valid INT transitions. */
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

/** Each hexagonal INT transition's mapping to a 512-bit number */
export const HEX_TRANSITIONS: {[key: string]: number[]} = {
    '0o': [0, 4, 64, 68],
    '1o': [32, 36, 96, 100, 2, 6, 66, 70, 1, 5, 65, 69, 8, 12, 72, 76, 128, 132, 192, 196, 256, 260, 320, 324],
    '2o': [34, 38, 98, 102, 3, 7, 67, 71, 9, 13, 73, 77, 136, 140, 200, 204, 384, 388, 448, 452, 288, 292, 352, 356],
    '2m': [33, 37, 97, 101, 10, 14, 74, 78, 129, 133, 193, 197, 264, 268, 328, 332, 160, 164, 224, 228, 258, 262, 322, 326],
    '2p': [40, 44, 104, 108, 130, 134, 194, 198, 257, 261, 321, 325],
    '3o': [35, 39, 99, 103, 11, 15, 75, 79, 137, 141, 201, 205, 392, 396, 456, 460, 416, 420, 480, 484, 290, 294, 354, 358],
    '3m': [42, 46, 106, 110, 41, 45, 105, 109, 162, 166, 226, 230, 131, 135, 195, 199, 168, 172, 232, 236, 138, 142, 202, 206, 289, 293, 353, 357, 259, 263, 323, 327, 296, 300, 360, 364, 265, 269, 329, 333, 386, 390, 450, 454, 385, 389, 449, 453],
    '3p': [161, 165, 225, 229, 266, 270, 330, 334],
    '4o': [393, 397, 457, 461, 424, 428, 488, 492, 418, 422, 482, 486, 291, 295, 355, 359, 43, 47, 107, 111, 139, 143, 203, 207],
    '4m': [394, 398, 458, 462, 417, 421, 481, 485, 298, 302, 362, 366, 163, 167, 227, 231, 267, 271, 331, 335, 169, 173, 233, 237],
    '4p': [387, 391, 451, 455, 297, 301, 361, 365, 170, 174, 234, 238],
    '5o': [395, 399, 459, 463, 425, 429, 489, 493, 426, 430, 490, 494, 419, 423, 483, 487, 299, 303, 363, 367, 171, 175, 235, 239],
    '6o': [427, 431, 491, 495],
};

/** The valid hexagonal INT transitions. */
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

/** Parses an isotropic rule.
 * @param validTrs Generally either `VALID_TRANSITIONS` or VALID_HEX_TRANSITIONS`.
 */
export function parseTransitions(data: string, validTrs: string[]): string[] {
    if (data.length === 0) {
        return [];
    }
    let out = new Set<string>();
    if (!DIGITS.includes(data[0])) {
        throw new RuleError(`Expected digit, got '${data[0]}'`);
    }
    let num = parseInt(data[0]);
    if (num >= validTrs.length) {
        throw new RuleError(`No transitions with ${num} neighbors`);
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
                throw new RuleError(`No transitions with ${num} neighbors`);
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
                throw new RuleError(`Invalid transition: '${num}${char}'`);
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

/** The revese of `parseTransitions`, takes a list of transitions and outputs the shortened version.
 * @param trs Something like `['2c', '2e', '3a', '4q']`.
 * @param validTrs Generally either `VALID_TRANSITIONS` or VALID_HEX_TRANSITIONS`.
 * @param preferMinus Whether to do, for example, 2om or 2-p, generally true for hexagonal rules and false for normal INT.
 */
export function unparseTransitions(trs: string[], validTrs: string[], preferMinus?: boolean): string {
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

/** Takes in lists of B/S transitions and outputs the 512-bit Uint8Array for it
 * @param trs Generally either `TRANSITIONS` or `HEX_TRANSITIONS`.
 */
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

/** The reverse of `transitionsToArray`, takes in a 512-bit Uint8Array and outputs the B/S transition lists.
 * @param trs Generally either `TRANSITIONS` or `HEX_TRANSITIONS`.
*/
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

/** Parses an isotropic rulestring (pre-split into B and S components)
 * @param trs Generally either `TRANSITIONS` or `HEX_TRANSITIONS`.
 * @param validTrs Generally either `VALID_TRANSITIONS` or VALID_HEX_TRANSITIONS`.
 * @param preferMinus Whether to do, for example, 2om or 2-p, generally true for hexagonal rules and false for normal INT.
 */
export function parseIsotropic(b: string, s: string, trs: {[key: string]: number[]},  validTrs: string[], preferMinus?: boolean): {b: string, s: string, data: Uint8Array<ArrayBuffer>} {
    let bTrs = parseTransitions(b, validTrs);
    let sTrs = parseTransitions(s, validTrs);
    return {
        b: unparseTransitions(bTrs, validTrs, preferMinus),
        s: unparseTransitions(sTrs, validTrs, preferMinus),
        data: transitionsToArray(bTrs, sTrs, trs),
    };
}

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function parseMAP(data: string): Uint8Array<ArrayBuffer> {
    let out = new Uint8Array(64);
    let j = 0;
    for (let i = 0; i < data.length; i += 4) {
        let a = BASE64.indexOf(data[i]);
        let b = BASE64.indexOf(data[i + 1]);
        let c = BASE64.indexOf(data[i + 2]);
        let d = BASE64.indexOf(data[i + 3]);
        if (c === -1) {
            out[j++] = (a << 2) | (b >> 4);
            break;
        }
        if (d === -1) {
            out[j++] = (a << 2) | (b >> 4);
            if (j === out.length) {
                break;
            }
            out[j++] = ((b & 15) << 4) | (c >> 2);
            break;
        }
        out[j++] = (a << 2) | (b >> 4);
        if (j === out.length) {
            break;
        }
        out[j++] = ((b & 15) << 4) | (c >> 2);
        if (j === out.length) {
            break;
        }
        out[j++] = ((c & 3) << 6) | d;
        if (j === out.length) {
            break;
        }
    }
    let actualOut = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        if (out[Math.floor(i / 8)] & (1 << (7 - (i % 8)))) {
            actualOut[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)] = 1;
        }
    }
    return actualOut;
}

export function unparseMAP(trs: Uint8Array): string {
    let out = new Uint8Array(64);
    for (let i = 0; i < 512; i++) {
        if (trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            out[Math.floor(i / 8)] |= (1 << (8 - i % 8));
        }
    }
    return 'MAP' + btoa(String.fromCharCode(...out));
}


export function findTransitionsSymmetry(trs: Uint8Array): RuleSymmetry {
    let C2 = true;
    let C4 = true;
    let D2h = true;
    let D2v = true;
    let D2s = true;
    let D2b = true;
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
            D2h = false;
            break;
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[((i << 6) & 448) | (i & 56) | (i >> 6)]) {
            D2v = false;
            break;
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            D2s = false;
            break;
        }
    }
    for (let i = 0; i < 512; i++) {
        if (trs[i] !== trs[(i & 341) | ((i >> 2) & 136) | ((i << 2) & 34)]) {
            D2b = false;
            break;
        }
    }
    return getRuleSymmetryFromBases(C2, C4, D2h, D2v, D2s, D2b);
}


/** Bad, very incomplete, QuickLife implementation. */

function create16Trs(trs: Uint8Array): Uint8Array {
    let out = new Uint8Array(65536);
    for (let i = 0; i < 65536; i++) {
        out[i] |= trs[((i >> 5) & 7) | ((i >> 6) & 56) | ((i >> 7) & 448)] << 7;
        out[i] |= trs[((i >> 4) & 7) | ((i >> 5) & 56) | ((i >> 6) & 448)] << 6;
        out[i] |= trs[((i >> 1) & 7) | ((i >> 2) & 56) | ((i >> 3) & 448)] << 2;
        out[i] |= trs[(i & 7) | ((i >> 1) & 56) | ((i >> 2) & 448)] << 1;
    }
    return out;
}

interface Chunk {
    a: number;
    b: number;
    c: number;
    d: number;
    pop: number;
}

interface Tile {
    super: false;
    nw: Chunk | null;
    ne: Chunk | null;
    sw: Chunk | null;
    se: Chunk | null;
}

interface SuperTile {
    super: true;
    nw: Tile | SuperTile;
    ne: Tile | SuperTile;
    sw: Tile | SuperTile;
    se: Tile | SuperTile;
}

const POPCOUNT_TABLE = new Uint8Array(256);
for (let i = 0; i < 256; i++) {
    POPCOUNT_TABLE[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1) + ((i >> 4) & 1) + ((i >> 5) & 1) + ((i >> 6) & 1) + ((i >> 7) & 1);
}

function runChunk(c: Chunk, trs: Uint8Array): void {
    let a = trs[c.a & 0xffff] | (trs[(c.a >>> 8) & 0xffff] << 8) | (trs[c.a >>> 16] << 16);
    let b = trs[c.b & 0xffff] | (trs[(c.b >>> 8) & 0xffff] << 8) | (trs[c.b >>> 16] << 16);
    let m = trs[((c.a & 0x3333) << 2) | ((c.b & 0xcccc) >>> 2)];
    m |= trs[(((c.a >>> 8) & 0x3333) << 2) | (((c.b >>> 8) & 0xcccc) >>> 2)] << 8;
    m |= trs[(((c.a >>> 8) & 0x3333) << 2) | (((c.b >>> 8) & 0xcccc) >>> 2)] << 16;
    c.c = a | ((m & 0x4444) >>> 2);
    c.d = b | ((m & 0x2222) << 2);
}

function runTile(t: Tile, trs: Uint8Array): void {
    if (t.nw) {
        runChunk(t.nw, trs);
    }
    if (t.ne) {
        runChunk(t.ne, trs);
    }
    if (t.sw) {
        runChunk(t.sw, trs);
    }
    if (t.se) {
        runChunk(t.se, trs);
    }
    if (t.nw) {
        if (t.ne) {
            let v1 = trs[((t.nw.a & 255) << 8) | ((t.ne.a >>> 24) & 255)];
            let v2 = trs[((t.nw.b & 255) << 8) | ((t.ne.b >>> 24) & 255)];
            t.nw.c |= v1 >>> 4;
            t.nw.d |= v2 >>> 4;
            t.ne.c |= v1 << 28;
            t.ne.d |= v2 << 28;
        } else {
            let v1 = trs[(t.nw.a & 255) << 8];
            let v2 = trs[(t.nw.b & 255) << 8];
            t.nw.c |= v1 >>> 4;
            t.nw.d |= v2 >>> 4;
            if ((v1 & 15) || (v2 & 15)) {
                t.ne = {
                    a: 0,
                    b: 0,
                    c: (v1 & 15) << 28,
                    d: (v2 & 15) << 28,
                    pop: POPCOUNT_TABLE[((v1 & 15) << 4) | (v2 & 15)],
                };
            }
        }
    } else if (t.ne) {
        let v1 = trs[t.ne.a >>> 24];
        let v2 = trs[t.ne.b >>> 24];
        t.ne.c |= v1 << 24;
        t.ne.d |= v2 << 24;
        if ((v1 & 15) || (v2 & 15)) {
            t.nw = {
                a: 0,
                b: 0,
                c: v1 >> 4,
                d: v2 >> 4,
                pop: POPCOUNT_TABLE[((v1 & 15) << 4) | (v2 & 15)],
            };
        }
    }
    if (t.sw) {
        if (t.se) {
            let v1 = trs[((t.sw.a & 255) << 8) | ((t.se.a >>> 24) & 255)];
            let v2 = trs[((t.sw.b & 255) << 8) | ((t.se.b >>> 24) & 255)];
            t.sw.c |= v1 >>> 4;
            t.sw.d |= v2 >>> 4;
            t.se.c |= v1 << 28;
            t.se.d |= v2 << 28;
        } else {
            let v1 = trs[(t.sw.a & 255) << 8];
            let v2 = trs[(t.sw.b & 255) << 8];
            t.sw.c |= v1 >>> 4;
            t.sw.d |= v2 >>> 4;
            if ((v1 & 15) || (v2 & 15)) {
                t.se = {
                    a: 0,
                    b: 0,
                    c: (v1 & 15) << 28,
                    d: (v2 & 15) << 28,
                    pop: POPCOUNT_TABLE[((v1 & 15) << 4) | (v2 & 15)],
                };
            }
        }
    } else if (t.se) {
        let v1 = trs[t.se.a >>> 24];
        let v2 = trs[t.se.b >>> 24];
        t.se.c |= v1 << 24;
        t.se.d |= v2 << 24;
        if ((v1 & 15) || (v2 & 15)) {
            t.sw = {
                a: 0,
                b: 0,
                c: v1 >> 4,
                d: v2 >> 4,
                pop: POPCOUNT_TABLE[((v1 & 15) << 4) | (v2 & 15)],
            };
        }
    }
}


/** Implements the 2**511 2-state range-1 Moore-neighborhood cellular automata without B0, which includes Conway's Game of Life and most other studied rules. */
export class MAPPattern extends DataPattern {

    /** A 512-bit Uint8Array storing the transition to do for each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    trs: Uint8Array;
    states: 2 = 2;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, trs: Uint8Array, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.trs = trs;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        // I will explain how this function works, but not the ones in MAPB0Pattern, MAPGenPattern, and MAPGenB0Pattern.
        // We first compute how it should expand, if at all.
        // Then we run the interior of the pattern.
        let width = this.width;
        let height = this.height;
        /** The width multiplied by the height. */
        let size = this.size;
        /** The pattern data (before running the generation). */
        let data = this.data;
        /** The 512-bit string that encodes the rule. */
        let trs = this.trs;
        /** The width multiplied by 2. */
        let width2 = width << 1;
        /** The index in `data` of the last row of the original data. */
        let lastRow = size - width;
        /** The index in `data` of the second-to-last row of the original data. */
        let secondLastRow = size - width2;
        // We first compute how it should expand in the top and bottom
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let i = 1;
        let j = lastRow + 1;
        let tr1 = (data[0] << 3) | data[1];
        let tr2 = (data[lastRow] << 5) | (data[lastRow + 1] << 2);
        // This part is only for B1e and B2a rules.
        if (width > 1) {
            if (trs[tr1]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 504]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2 & 504]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
        }
        for (let loc = 1; loc < width - 1; loc++) {
            i++;
            j++;
            // This is why we index the trs variables weirdly, so we can do this!
            tr1 = ((tr1 << 3) & 511) | data[i];
            // We shift it by 2 because we are computing the bottom, we need to move it to the top of the transition because we are seeing if it should expand downwards.
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
        // This part is only for B1e and B2a rules.
        if (width > 1) {
            if (trs[(tr1 << 3) & 511]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 3) & 63]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 63]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        }
        // We then compute how it should expand to the left and right.
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (data[0] << 1) | data[width];
        tr2 = (data[width - 1] << 7) | (data[width2 - 1] << 6);
        // This part is only for B1e and B2a rules.
        if (height > 1) {
            if (trs[tr1]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 438]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2 & 438]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
        }
        let loc = 0;
        for (i = width2; i < size; i += width) {
            loc++;
            // In this case, we are computing to the left, so the 3 bits to consider are all on the right.
            tr1 = ((tr1 << 1) & 7) | data[i];
            // In this case, we are computing to the right, so the 3 bits to consider are all on the right, so we shift by 6 bits.
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
        // This part is only for B1c, B1e, or B2a rules.
        if (height > 1) {
            if (trs[(tr1 << 1) & 7]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 511]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 1) & 219]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 219]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        }
        // Special B1c checks.
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
        /** The offset for each row, how many new elements are between each row. */
        let oX = expandLeft + expandRight;
        /** The offset between the start of `data` and the start of `out`. */
        let oStart = (expandUp ? width + oX : 0) + expandLeft;
        /** The offset between the end of `data` and the end of `out`. */
        let oSize = oStart + oX * height;
        /** The width of each row of `out`. */
        let newWidth = width + oX;
        /** The height of `out`. */
        let newHeight = height + expandUp + expandDown;
        /** The length of `out`. */
        let newSize = newWidth * newHeight;
        /** The output pattern data, after running the generation. */
        let out = new Uint8Array(newSize);
        // Putting the expansion data into the output
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
        // We need to do a special case for when width === 1, the basic method breaks in that case.
        if (width <= 1) {
            if (width === 1) {
                let tr = (data[0] << 4) | (data[1] << 3);
                let loc = oStart;
                // The top cell.
                if (trs[tr]) {
                    out[loc] = 1;
                }
                loc += oX + 1;
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
                    // Each middle cell.
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    loc += oX + 1;
                }
                // The bottom cell.
                if (trs[(tr << 1) & 63]) {
                    out[loc] = 1;
                }
            }
        } else {
            // We first need to compute the top and bottom rows.
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
            j = lastRow + 1;
            tr1 = (data[0] << 4) | (data[width] << 3) | (data[1] << 1) | data[width + 1];
            tr2 = (data[secondLastRow] << 5) | (data[lastRow] << 4) | (data[secondLastRow + 1] << 2) | (data[lastRow + 1] << 1);
            // The top-left cell.
            if (trs[tr1]) {
                out[loc1] = 1;
            }
            // The bottom-left cell.
            if (trs[tr2]) {
                out[loc2] = 1;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i] << 1) | data[i + width];
                // The middle cells of the top row.
                if (trs[tr1]) {
                    out[loc1] = 1;
                }
                // The middle cells of the bottom row.
                tr2 = ((tr2 << 3) & 511) | (data[j - width] << 2) | (data[j] << 1);
                if (trs[tr2]) {
                    out[loc2] = 1;
                }
            }
            // The top-right cell.
            if (trs[(tr1 << 3) & 511]) {
                out[loc1 + 1] = 1;
            }
            // The bottom-right cell.
            if (trs[(tr2 << 3) & 511]) {
                out[loc2 + 1] = 1;
            }
            // We then finally compute all the middle rows!
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
                let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                // The leftmost cell of the row.
                if (trs[tr]) {
                    out[loc] = 1;
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                    // The middle cells.
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    i++;
                    loc++;
                }
                // The rightmost cell of the row.
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
    }

    copy(): MAPPattern {
        let out = new MAPPattern(this.height, this.width, this.data.slice(), this.trs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPPattern {
        return new MAPPattern(0, 0, new Uint8Array(0), this.trs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): MAPPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPPattern(height, width, data, this.trs, this.ruleStr, this.ruleSymmetry);
    }

}


/** Implements the 2**511 2-state range-1 Moore-neighborhood cellular automata with B0. Because we cannot simulate an infinite grid of cells, these are emulated via the process described at (https://golly.sourceforge.io/Help/Algorithms/QuickLife.html). */
export class MAPB0Pattern extends DataPattern {

    /** A 512-bit Uint8Array storing the transition to do on even generations for each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    evenTrs: Uint8Array;
    /** A 512-bit Uint8Array storing the transition to do on odd generations each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    oddTrs: Uint8Array;
    states: 2 = 2;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 2 = 2;

    constructor(height: number, width: number, data: Uint8Array, evenTrs: Uint8Array, oddTrs: Uint8Array, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.evenTrs = evenTrs;
        this.oddTrs = oddTrs;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        // An explanation of how this function works is in the comments in MAPPattern.runGeneration
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
        if (width > 1) {
            if (trs[tr1]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 504]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2 & 504]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
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
        if (width > 1) {
            if (trs[(tr1 << 3) & 511]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 3) & 63]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 63]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        }
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (data[0] << 1) | data[width];
        tr2 = (data[width - 1] << 7) | (data[width2 - 1] << 6);
        if (height > 1) {
            if (trs[tr1]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 438]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2 & 438]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
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
        if (height > 1) {
            if (trs[(tr1 << 1) & 7]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 511]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 1) & 219]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 219]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
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
                    out[loc] = 1;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
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
    }

    copy(): MAPB0Pattern {
        let out = new MAPB0Pattern(this.height, this.width, this.data.slice(), this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPB0Pattern {
        return new MAPB0Pattern(0, 0, new Uint8Array(0), this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): MAPB0Pattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPB0Pattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.ruleStr, this.ruleSymmetry);
    }

}


/** Implements the Generations (https://conwaylife.com/wiki/Generations) variant of the rules implemented by  `MAPPattern`. */
export class MAPGenPattern extends DataPattern {

    /** A 512-bit Uint8Array storing the transition to do for each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    trs: Uint8Array;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, trs: Uint8Array, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.trs = trs;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        // An explanation of how this function works is in the comments in MAPPattern.runGeneration
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
        if (width > 1) {
            if (trs[tr1]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 504]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2 & 504]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
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
        if (width > 1) {
            if (trs[(tr1 << 3) & 511]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 3) & 63]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 63]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        }
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (alive[0] << 1) | alive[width];
        tr2 = (alive[width - 1] << 7) | (alive[width2 - 1] << 6);
        if (height > 1) {
            if (trs[tr1]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 438]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2 & 438]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
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
        if (height > 1) {
            if (trs[(tr1 << 1) & 7]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 511]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 1) & 219]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 219]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
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
                    out[loc] = 1;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
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
    }

    copy(): MAPGenPattern {
        let out = new MAPGenPattern(this.height, this.width, this.data.slice(), this.trs, this.states, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPGenPattern {
        return new MAPGenPattern(0, 0, new Uint8Array(0), this.trs, this.states, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): MAPGenPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPGenPattern(height, width, data, this.trs, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPGenPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPGenPattern(height, width, data, this.trs, this.states, this.ruleStr, this.ruleSymmetry);
    }

}


/** Implements the Generations (https://conwaylife.com/wiki/Generations) variant of the rules implemented by  `MAPB0Pattern`. */
export class MAPGenB0Pattern extends DataPattern {

    /** A 512-bit Uint8Array storing the transition to do on even generations for each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    evenTrs: Uint8Array;
    /** A 512-bit Uint8Array storing the transition to do on odd generations each 3x3 combination of cells.
     * Indexed like this:
     * 852
     * 741
     * 630
     */
    oddTrs: Uint8Array;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 2 = 2;

    constructor(height: number, width: number, data: Uint8Array, evenTrs: Uint8Array, oddTrs: Uint8Array, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.evenTrs = evenTrs;
        this.oddTrs = oddTrs;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        // An explanation of how this function works is in the comments in MAPPattern.runGeneration.
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let states = this.states;
        let data = this.data;
        let alive = this.data.map(x => x === 1 ? 1 : 0);
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
        if (width > 1) {
            if (trs[tr1]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 504]) {
                expandUp = 1;
                upExpands[0] = 1;
            }
            if (trs[tr2 & 504]) {
                expandDown = 1;
                downExpands[0] = 1;
            }
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
        if (width > 1) {
            if (trs[(tr1 << 3) & 511]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 3) & 63]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 63]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        }
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (alive[0] << 1) | alive[width];
        tr2 = (alive[width - 1] << 7) | (alive[width2 - 1] << 6);
        if (height > 1) {
            if (trs[tr1]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
        } else {
            if (trs[tr1 & 438]) {
                expandLeft = 1;
                leftExpands[0] = 1;
            }
            if (trs[tr2 & 438]) {
                expandRight = 1;
                rightExpands[0] = 1;
            }
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
        if (height > 1) {
            if (trs[(tr1 << 1) & 7]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 511]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        } else {
            if (trs[(tr1 << 1) & 219]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 219]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
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
                    out[loc] = 1;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
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
    }

    copy(): MAPGenB0Pattern {
        let out = new MAPGenB0Pattern(this.height, this.width, this.data.slice(), this.evenTrs, this.oddTrs, this.states, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): MAPGenB0Pattern {
        return new MAPGenB0Pattern(0, 0, new Uint8Array(0), this.evenTrs, this.oddTrs, this.states, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): MAPGenB0Pattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPGenB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): MAPGenB0Pattern {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPGenB0Pattern(height, width, data, this.evenTrs, this.oddTrs, this.states, this.ruleStr, this.ruleSymmetry);
    }

}


/** The mapping of von Neumann neighorhood rules to INT transitions. */
export const VON_NEUMANN: string[][] = [
    ['0c', '1c', '2c', '2n', '3c', '4c'],
    ['1e', '2k', '3i', '3n', '3y', '3q', '4n', '4y', '5e'],
    ['2e', '2i', '3k', '3a', '3j', '3r', '4k', '4a', '4i', '4q', '4t', '4w', '4z', '5k', '5a', '5i', '5r', '6e', '6i'],
    ['3e', '4j', '4r', '5i', '5n', '5y', '5q', '6k', '6a', '7e'],
    ['4e', '5c', '6c', '6n', '7c', '8c'],
];

/** Parses the rulestring format for MAP rules and their subsets. */
export function createMAPPattern(rule: string, height: number, width: number, data: Uint8Array): string | MAPPattern | MAPB0Pattern | MAPGenPattern | MAPGenB0Pattern {
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
            out = parseIsotropic(b, s, TRANSITIONS, VALID_TRANSITIONS);
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
            let symmetry = SYMMETRY_MEET[findTransitionsSymmetry(evenTrs)][findTransitionsSymmetry(oddTrs)];
            if (states > 2) {
                return new MAPGenB0Pattern(height, width, data, evenTrs, oddTrs, states, ruleStr, symmetry);
            } else {
                return new MAPB0Pattern(height, width, data, evenTrs, oddTrs, ruleStr, symmetry);
            }
        }
    }
    let symmetry = findTransitionsSymmetry(trs);
    if (states > 2) {
        return new MAPGenPattern(height, width, data, trs, states, ruleStr, symmetry);
    } else {
        return new MAPPattern(height, width, data, trs, ruleStr, symmetry);
    }
}
