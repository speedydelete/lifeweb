
/* Implements the 2**512 2-state range-1 Moore-neighborhood cellular automata and their Generations variants.
We index the trs variables like this to make it faster:
852
741
630
The rest of this file assumes you are familiar with the INT notation (https://conwaylife.com/wiki/Isotropic_non-totalistic_rule). */

import {RuleError} from './util.js';
import {DataPattern, RuleSymmetry, getRuleSymmetryFromBases, Rule} from './pattern.js';


/** Represents the transition data for an isotropic rule format. */
export interface INTSpec {
    /** The name of the format (for error messages). */
    name: string;
    /** A mapping between INT transitions (like 2c) and MAP transitions (like 320). */
    trs: {[key: string]: number[]};
    /** The list of valid transitions for each number, like ['c', 'ce', 'aceikn', ...]. */
    validTrs: string[];
    /** Whether to prefer a minus sign when it would be the same speed, so whether to do B2om/SH or B2-p/SH */
    preferMinus: boolean;
}


export const INT: INTSpec = {
    name: 'INT',
    trs: {
        '0c': [0],
        '1c': [4, 256, 1, 64],
        '1e': [2, 128, 8, 32],
        '2a': [6, 384, 3, 9, 72, 36, 192, 288],
        '2c': [5, 320, 65, 260],
        '2e': [34, 160, 10, 136],
        '2i': [130, 40],
        '2k': [66, 129, 258, 264, 12, 96, 132, 33],
        '2n': [68, 257],
        '3a': [38, 416, 11, 200],
        '3c': [69, 321, 261, 324],
        '3e': [42, 168, 138, 162],
        '3i': [292, 73, 7, 448],
        '3j': [137, 74, 164, 224, 35, 392, 290, 14],
        '3k': [98, 161, 266, 140],
        '3n': [37, 352, 13, 67, 193, 262, 328, 388],
        '3q': [100, 289, 265, 259, 196, 70, 76, 385],
        '3r': [131, 194, 134, 104, 41, 296, 386, 44],
        '3y': [133, 322, 97, 268],
        '4a': [420, 294, 201, 39, 480, 15, 75, 456],
        '4c': [325],
        '4e': [170],
        '4i': [45, 360, 195, 390],
        '4j': [169, 106, 172, 226, 163, 394, 298, 142],
        '4k': [99, 225, 270, 330, 141, 354, 396, 165],
        '4n': [356, 293, 329, 263, 452, 71, 77, 449],
        '4q': [102, 417, 267, 204],
        '4r': [139, 202, 166, 232, 43, 424, 418, 46],
        '4t': [135, 450, 105, 300],
        '4w': [228, 291, 393, 78],
        '4y': [389, 326, 197, 101, 353, 269, 323, 332],
        '4z': [198, 387, 297, 108],
        '5a': [457, 79, 484, 295],
        '5c': [426, 174, 234, 171],
        '5e': [453, 327, 357, 333],
        '5i': [203, 422, 488, 47],
        '5j': [358, 421, 331, 271, 460, 103, 205, 481],
        '5k': [397, 334, 229, 355],
        '5n': [458, 143, 482, 428, 302, 233, 167, 107],
        '5q': [395, 206, 230, 236, 299, 425, 419, 110],
        '5r': [364, 301, 361, 391, 454, 199, 109, 451],
        '5y': [362, 173, 398, 227],
        '6a': [489, 111, 492, 486, 423, 459, 303, 207],
        '6c': [490, 175, 430, 235],
        '6e': [461, 335, 485, 359],
        '6i': [365, 455],
        '6k': [429, 366, 237, 231, 483, 399, 363, 462],
        '6n': [427, 238],
        '7c': [491, 239, 494, 431],
        '7e': [493, 367, 487, 463],
        '8c': [495],
    },
    validTrs: [
        'c',
        'ce',
        'aceikn',
        'aceijknqry',
        'aceijknqrtwyz',
        'aceijknqry',
        'aceikn',
        'ce',
        'c'
    ],
    preferMinus: false,
};

export const HEX_INT: INTSpec = {
    name: 'hex INT',
    trs: {
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
    },
    validTrs: [
        'o',
        'o',
        'omp',
        'omp',
        'omp',
        'o',
        'o',
    ],
    preferMinus: true,
};

export const VON_NEUMANN_INT: INTSpec = {
    name: 'von Neumann',
    trs: {
        '0c': [
            0, // 0c
            4, 256, 1, 64, // 1c
            5, 320, 65, 260, // 2c
            68, 257, // 2n
            69, 321, 261, 324, // 3c
            325, // 4c
        ],
        '1c': [
            2, 128, 8, 32, // 1e
            6, 384, 3, 9, 72, 36, 192, 288, // 2a
            66, 129, 258, 264, 12, 96, 132, 33, // 2k
            292, 73, 7, 448, // 3i
            37, 352, 13, 67, 193, 262, 328, 388, // 3n
            100, 289, 265, 259, 196, 70, 76, 385, // 3q
            133, 322, 97, 268, // 3y
            356, 293, 329, 263, 452, 71, 77, 449, // 4n
            389, 326, 197, 101, 353, 269, 323, 332, // 4y
            453, 327, 357, 333, // 5e
        ],
        '2e': [
            34, 160, 10, 136, // 2e
            38, 416, 11, 200, // 3e
            137, 74, 164, 224, 35, 392, 290, 14, // 3j
            98, 161, 266, 140, // 3k
            420, 294, 201, 39, 480, 15, 75, 456, // 4a
            99, 225, 270, 330, 141, 354, 396, 165, // 4k
            102, 417, 267, 204, // 4q
            228, 291, 393, 78, // 4w
            457, 79, 484, 295, // 5a
            397, 334, 229, 355, // 5k
            358, 421, 331, 271, 460, 103, 205, 481, // 5j
            461, 335, 485, 359, // 6e
        ],
        '2i': [
            130, 40, // 2i
            131, 194, 134, 104, 41, 296, 386, 44, // 3r
            45, 360, 195, 390, // 4i
            135, 450, 105, 300, // 4t
            198, 387, 297, 108, // 4z
            364, 301, 361, 391, 454, 199, 109, 451, // 5r
            365, 455, // 6i
        ],
        '3c': [
            42, 168, 138, 162, // 3e
            169, 106, 172, 226, 163, 394, 298, 142, // 4j
            139, 202, 166, 232, 43, 424, 418, 46, // 4r
            203, 422, 488, 47, // 5i
            458, 143, 482, 428, 302, 233, 167, 107, // 5n
            395, 206, 230, 236, 299, 425, 419, 110, // 5q
            362, 173, 398, 227, // 4y
            489, 111, 492, 486, 423, 459, 303, 207, // 6a
            429, 366, 237, 231, 483, 399, 363, 462, // 6k
            493, 367, 487, 463, // 7e
        ],
        '4e': [
            170, // 4e
            426, 174, 234, 171, // 5c
            490, 175, 430, 235, // 6c
            427, 238, // 6n
            491, 239, 494, 431, // 7c
            495, // 8c
        ],
    },
    validTrs: [
        'e',
        'e',
        'ei',
        'e',
        'e',
    ],
    preferMinus: false,
};

export const INT_SPECS = {
    'M': INT,
    'H': HEX_INT,
    'V': VON_NEUMANN_INT,
};


const DIGITS = '0123456789';

/** Parses part of an isotropic rule such as '2ce3-a4akt'. */
export function parseTransitions(data: string, spec: INTSpec): string[] {
    if (data.length === 0) {
        return [];
    }
    // split it by digits into parts, such as ['2ce', '3-a', '4akt']
    let parts: string[] = [];
    let currentPart = '';
    for (let i = 0; i < data.length; i++) {
        let char = data[i];
        if (DIGITS.includes(char)) {
            if (currentPart.length > 0) {
                parts.push(currentPart);
            }
            currentPart = char;
        } else {
            currentPart += char;
        }
    }
    if (currentPart.length > 0) {
        parts.push(currentPart);
    }
    // go through each part and figure out what transitions it represents
    let out = new Set<string>();
    for (let part of parts) {
        let digit = parseInt(part[0]);
        let letters = spec.validTrs[digit];
        if (!letters) {
            throw new RuleError(`No ${spec.name} transitions with ${part[0]} neighbors`);
        }
        if (part.length === 1) {
            for (let letter of spec.validTrs[digit]) {
                out.add(digit + letter);
            }
            continue;
        }
        let minus = false;
        if (part[1] === '-') {
            part = part.slice(1);
            minus = true;
            for (let letter of spec.validTrs[digit]) {
                out.add(digit + letter);
            }
        }
        for (let letter of part.slice(1)) {
            if (letter === '-') {
                minus = true;
                continue;
            } else if (letter === '+') {
                minus = false;
                continue;
            }
            if (!letters.includes(letter)) {
                throw new RuleError(`Invalid ${spec.name} transition: '${digit}${letter}'`);
            }
            let tr = digit + letter;
            if (minus) {
                out.delete(tr);
            } else {
                out.add(tr);
            }
        }
    }
    return Array.from(out);
}

/** The revese of `parseTransitions`, takes a list of transitions and outputs the shortened version. */
export function unparseTransitions(trs: string[], spec: INTSpec): string {
    let sorted: string[] = [];
    for (let i = 0; i < spec.validTrs.length; i++) {
        sorted.push('');
    }
    for (let tr of trs) {
        sorted[Number(tr[0])] += tr[1];
    }
    let out = '';
    for (let i = 0; i < spec.validTrs.length; i++) {
        if (sorted[i] === '') {
            continue;
        } else if (sorted[i].length === spec.validTrs[i].length) {
            out += i;
        } else {
            out += i;
            let chars = Array.from(sorted[i]).sort().join('');
            let minus = '-';
            for (let char of spec.validTrs[i]) {
                if (!chars.includes(char)) {
                    minus += char;
                }
            }
            if (chars.length > minus.length || (chars.length === minus.length && spec.preferMinus)) {
                out += minus;
            } else {
                out += chars;
            }
        }
    }
    return out;
}

/** Takes in lists of B/S transitions and outputs the 512-bit Uint8Array for it. */
export function transitionsToArray(b: string[], s: string[], spec: INTSpec): Uint8Array<ArrayBuffer> {
    let out = new Uint8Array(512);
    for (let tr of b) {
        for (let i of spec.trs[tr]) {
            out[i] = 1;
        }
    }
    for (let tr of s) {
        for (let i of spec.trs[tr]) {
            out[i | (1 << 4)] = 1;
        }
    }
    return out;
}

/** The reverse of `transitionsToArray`, takes in a 512-bit Uint8Array and outputs the B/S transition lists. */
export function arrayToTransitions(array: Uint8Array, spec: INTSpec): false | [string[], string[]] {
    let b: string[] = [];
    let s: string[] = [];
    for (let [tr, value] of Object.entries(spec.trs)) {
        let bCount = 0;
        let sCount = 0;
        for (let i of value) {
            if (array[i]) {
                bCount++;
            }
            if (array[i | (1 << 4)]) {
                sCount++;
            }
        }
        if (bCount === value.length) {
            b.push(tr);
        } else if (bCount !== 0) {
            return false;
        }
        if (sCount === value.length) {
            b.push(tr);
        } else if (sCount !== 0) {
            return false;
        }
    }
    return [b, s];
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
        }
        if (trs[i] !== trs[((i << 6) & 448) | (i & 56) | (i >> 6)]) {
            D2v = false;
        }
        if (trs[i] !== trs[(i & 84) | ((i << 8) & 256) | ((i >> 8) & 1) | ((i >> 4) & 10) | ((i << 4) & 160)]) {
            D2s = false;
        }
        if (trs[i] !== trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            D2b = false;
        }
    }
    return getRuleSymmetryFromBases(C2, C4, D2h, D2v, D2s, D2b);
}

export function findTransitionsNeighborhood(trs: Uint8Array): [number, number][] {
    let out: [number, number][] = [];
    let bit = 0;
    for (let y = -1; y <= 1; y++) {
        for (let x = -1; x <= 1; x++) {
            let found = false;
            for (let i = 0; i < 512; i++) {
                if (trs[i] !== trs[i ^ (1 << bit)]) {
                    found = true;
                    break;
                }
            }
            if (found) {
                out.push([x, y]);
            }
            bit++;
        }
    }
    return out;
}


const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Parses a MAP rule such as MAPABCDEF. */
export function parseMAP(data: string): [Uint8Array<ArrayBuffer>, number] {
    let original = data;
    if (data.startsWith('MAP')) {
        data = data.slice(3);
    } else if (data.startsWith('xmap')) {
        data = data.slice(4);
    } else {
        throw new RuleError(`Invalid MAP string: '${original}'`);
    }
    data = data.replaceAll('=', '');
    let type: 'normal' | 'vn' | 'hex';
    let states = 2;
    if (data.length !== 86 && data.length !== 6 && data.length !== 20) {
        let index = data.lastIndexOf('/');
        if (index === -1) {
            throw new RuleError(`Invalid MAP string (bad length and no /): '${original}'`);
        }
        let value = data.slice(index + 1);
        if (!value.match(/^\d+$/)) {
            throw new RuleError(`Invalid MAP string (bad length and invalid state count): '${original}'`);
        }
        states = parseInt(value);
        data = data.slice(0, index);
    }
    if (data.length === 86) {
        type = 'normal';
    } else if (data.length === 6) {
        type = 'vn';
    } else if (data.length === 22) {
        type = 'hex';
    } else {
        throw new RuleError(`Invalid MAP string (bad length: ${data.length}): '${original}'`);
    }
    let parsed: number[] = [];
    for (let i = 0; i < data.length; i += 4) {
        let a = BASE64.indexOf(data[i]);
        let b = BASE64.indexOf(data[i + 1]);
        let c = BASE64.indexOf(data[i + 2]);
        let d = BASE64.indexOf(data[i + 3]);
        parsed.push((a << 2) | (b >> 4));
        if (c === -1) {
            break;
        }
        if (d === -1) {
            parsed.push(((b & 15) << 4) | (c >> 2));
            break;
        }
        parsed.push(((b & 15) << 4) | (c >> 2));
        parsed.push(((c & 3) << 6) | d);
    }
    let trs = new Uint8Array(512);
    if (type === 'normal') {
        for (let i = 0; i < 512; i++) {
            if (parsed[Math.floor(i / 8)] & (1 << (7 - (i % 8)))) {
                trs[i] = 1;
            }
        }
    } else if (type === 'vn') {
        for (let i = 0; i < 512; i++) {
            let j = ((i & 0b010000000) >> 3) | ((i & 0b000111000) >> 2) | ((i & 0b00000010) >> 1);
            if (parsed[Math.floor(j / 8) & (1 << (7 - (j % 8)))]) {
                trs[i] = 1;
            }
        }
    } else {
        for (let i = 0; i < 512; i++) {
            let j = (i & 0b011_111_110) >> 1;
            if (parsed[Math.floor(j / 8) & (1 << (7 - (j % 8)))]) {
                trs[i] = 1;
            }
        }
    }
    // flip diagonally
    // abc    adg
    // def -> beh
    // ghi    cfi
    // because of how lifeweb orders its trs variables
    // as opposed to how the MAP notation is defined
    let realOut = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        if (trs[i]) {
            realOut[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)] = 1;
        }
    }
    return [realOut, states];
}

/** The reverse of `parseMAP`, takes in a Uint8Array and outputs the corresponding MAP rule. */
export function unparseMAP(trs: Uint8Array, states: number): string {
    // unflip it diagonally (which is the same as flipping it diagonally)
    let newTrs = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        if (trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            newTrs[i] = 1;
        }
    }
    trs = newTrs;
    let nh = findTransitionsNeighborhood(trs).map(x => String(x[0]) + ',' + String(x[1]));
    let typeTrs: Uint8Array;
    if (nh.every(x => x.includes('0'))) {
        // von neumann
        typeTrs = new Uint8Array(32);
        for (let i = 0; i < 32; i++) {
            typeTrs[i] = trs[((i & 0b10000) << 3) | ((i & 0b1110) << 2) | ((i & 0b1) << 1)];
        }
    } else if (!nh.includes('-1,1') && !nh.includes('1,-1')) {
        // hexagonal
        typeTrs = new Uint8Array(128);
        for (let i = 0; i < 128; i++) {
            typeTrs[i] = trs[((i & 0b1100000) << 2) | ((i & 0b11100) << 1) | ((i & 0b11) << 0)];
        }
    } else {
        // normal
        typeTrs = trs;
    }
    let unparsed = new Uint8Array(typeTrs.length / 8);
    for (let i = 0; i < typeTrs.length; i++) {
        if (typeTrs[i]) {
            unparsed[Math.floor(i / 8)] |= (1 << (7 - i % 8));
        }
    }
    let out = 'MAP' + btoa(String.fromCharCode(...unparsed)).replaceAll('=', '');
    if (states !== 2) {
        out += '/' + states;
    }
    return out;
}

/** Parses all notations for MAP rules. */
export function parseMAPRuleFull(rule: string): {trs: Uint8Array, states: number} {
    let trs = new Uint8Array(512);
    let states = 2;
    let nhLetter: keyof typeof INT_SPECS = 'M';
    let match: RegExpMatchArray | null;
    if (rule.startsWith('MAP') || rule.startsWith('xmap')) {
        // MAP
        [trs, states] = parseMAP(rule);
    } else if (rule.startsWith('W')) {
        // wolfram rules
        // remove state count
        if (match = rule.match(/\/[gGcC]?([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)$/)) {
            states = Number(match[1]);
            rule = rule.slice(0, -match[0].length);
        }
        let num = Number(rule.slice(1));
        if (Number.isNaN(num)) {
            throw new RuleError(`Invalid W rule: '${rule.slice(1)}'`);
        }
        for (let i = 0; i < 512; i++) {
            trs[i | (1 << 4)] = 1;
        }
        for (let i = 0; i < 8; i++) {
            if (num & (1 << i)) {
                trs[((i & 0b100) << 6) | ((i & 0b10) << 4) | ((i & 0b1) << 2)] = 1;
            }
        }
    } else {
        // remove state count
        if (match = rule.match(/^[gG]([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)/)) {
            states = Number(match[1]);
            rule = rule.slice(match[0].length);
        }
        // split it into parts, like 'B3/S23' becomes ['B3', 'S23']
        let parts: string[] = [];
        let currentPart = '';
        for (let i = 0; i < rule.length; i++) {
            let char = rule[i];
            if (char === '/' || char === '_') {
                parts.push(currentPart);
                currentPart = '';
            } else if ('BSADGCbsdg'.includes(char) && currentPart.length > 0) {
                parts.push(currentPart);
                currentPart = char;
            } else {
                currentPart += char;
            }
        }
        parts.push(currentPart);
        // find the neighborhood specifier like 'H' or 'V'
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            if (part.length === 0) {
                continue;
            }
            let end = part[part.length - 1].toUpperCase();
            if (end in INT_SPECS) {
                nhLetter = end as typeof nhLetter;
                parts[i] = part.slice(0, -1);
            }
        }
        let spec = INT_SPECS[nhLetter];
        let bFound = false;
        let sFound = false;
        for (let i = 0; i < parts.length; i++) {
            let part = parts[i];
            let start = part[0]?.toUpperCase();
            let letter: 'B' | 'S' | 'A' | 'D';
            let parsedTrs: string[];
            if (start === 'B' || start === 'S' || start === 'A' || start === 'D') {
                if (start === 'A' && !bFound) {
                    for (let i = 0; i < 512; i++) {
                        if (!(i & (1 << 4))) {
                            trs[i] = 1;
                        }
                    }
                }
                if (start === 'D' && !sFound) {
                    for (let i = 0; i < 512; i++) {
                        if (i & (1 << 4)) {
                            trs[i] = 1;
                        }
                    }
                }
                if (start === 'B' || start === 'A') {
                    bFound = true;
                }
                if (start === 'S' || start === 'D') {
                    sFound = true;
                }
                letter = start;
                parsedTrs = parseTransitions(part.slice(1), spec);
            } else if (start === 'G' || start === 'C') {
                states = Number(part.slice(1));
                if (Number.isNaN(states)) {
                    throw new RuleError(`Invalid state count: '${part.slice(1)}'`);
                }
                continue;
            } else {
                // if there's no letter, take it to be a S/B/C generations rule
                if (parts.length > 2 && i === parts.length - 1) {
                    states = Number(part);
                    if (Number.isNaN(states)) {
                        throw new RuleError(`Invalid state count: '${part}'`);
                    }
                    continue;
                } else {
                    letter = i === 0 ? 'S' : 'B';
                    parsedTrs = parseTransitions(part, spec);
                }
            }
            let setTo = letter === 'B' || letter === 'S' ? 1 : 0;
            let or = letter === 'S' || letter === 'D' ? 1 << 4 : 0;
            for (let tr of parsedTrs) {
                for (let i of spec.trs[tr]) {
                    trs[i | or] = setTo;
                }
            }
        }
    }
    return {trs, states};
}

/** Unparses a MAP rule into a more human-readable notation if possible, or regular MAP form if not. */
export function unparseMAPRuleFull(trs: Uint8Array, states: number): string {
    // check for wolfram rule
    let wNum = 0;
    let found = false;
    for (let i = 0; i < 512; i++) {
        if (i & (1 << 4)) {
            if (!trs[i]) {
                found = true;
                break;
            }
        } else {
            // check for non-W birth condition
            if (trs[i] && (i & 0b011_011_011) !== 0) {
                found = true;
                break;
            }
            let bit = ((i & 0b100_000_000) >> 6) | ((i & 0b100_000) >> 4) | ((i & 0b100) >> 2);
            wNum |= (1 << bit);
        }
    }
    if (!found) {
        let out = `W${wNum}`;
        if (states > 2) {
            out += `/${states}`;
        }
        return out;
    }
    // check for INT family rule
    // maybe add von neumann unparsing here too?
    for (let nhLetter of ['M', 'H'] as const) {
        let spec = INT_SPECS[nhLetter];
        let value = arrayToTransitions(trs, spec);
        if (!value) {
            continue;
        }
        let b = unparseTransitions(value[0], spec);
        let s = unparseTransitions(value[1], spec);
        let out: string;
        if (states === 2) {
            out = `B${b}/S${s}`;
        } else {
            out = `${s}/${b}/${states}`;
        }
        if (nhLetter !== 'M') {
            out += nhLetter;
        }
        return out;
    }
    return unparseMAP(trs, states);
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

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, trs: Uint8Array) {
        super(height, width, data, rule);
        this.trs = trs;
    }

    runGeneration(): void {
        // i will explain how this function works, but not the ones in MAPB0Pattern, MAPGenPattern, and MAPGenB0Pattern
        // we first compute how it should expand, if at all
        // then we run the interior of the pattern
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
        // we first compute how it should expand in the top and bottom
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let i = 1;
        let j = lastRow + 1;
        let tr1 = (data[0] << 3) | data[1];
        let tr2 = (data[lastRow] << 5) | (data[lastRow + 1] << 2);
        // this part is only for B1c, B1e and B2a rules
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
            // this is why we index the trs variables weirdly, so we can do this!
            tr1 = ((tr1 << 3) & 511) | data[i];
            // we shift it by 2 because we are computing the bottom, we need to move it to the top of the transition because we are seeing if it should expand downwards
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
        // this part is only for B1c, B1e and B2a rules
        if (width > 1) {
            if (trs[(tr1 << 3) & 511]) {
                expandUp = 1;
                upExpands[width - 1] = 1;
            }
            if (trs[(tr2 << 3) & 511]) {
                expandDown = 1;
                downExpands[width - 1] = 1;
            }
        }
        // we then compute how it should expand to the left and right
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        tr1 = (data[0] << 1) | data[width];
        tr2 = (data[width - 1] << 7) | (data[width2 - 1] << 6);
        // this part is only for B1c, B1e and B2a rules
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
            // in this case, we are computing to the left, so the 3 bits to consider are all on the right
            tr1 = ((tr1 << 1) & 7) | data[i];
            // in this case, we are computing to the right, so the 3 bits to consider are all on the right, so we shift by 6 bits
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
        // this part is only for B1c, B1e, or B2a rules
        if (height > 1) {
            if (trs[(tr1 << 1) & 7]) {
                expandLeft = 1;
                leftExpands[height - 1] = 1;
            }
            if (trs[(tr2 << 1) & 511]) {
                expandRight = 1;
                rightExpands[height - 1] = 1;
            }
        }
        // special B1c checks
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
        // putting the expansion data into the output
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
        // we need to do a special case for when width === 1, the basic method breaks in that case
        if (width <= 1) {
            if (width === 1) {
                let tr = (data[0] << 4) | (data[1] << 3);
                let loc = oStart;
                // top
                if (trs[tr]) {
                    out[loc] = 1;
                }
                loc += oX + 1;
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
                    // middle
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    loc += oX + 1;
                }
                // bottom
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
            // top-left
            if (trs[tr1]) {
                out[loc1] = 1;
            }
            // bottom-left
            if (trs[tr2]) {
                out[loc2] = 1;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i] << 1) | data[i + width];
                // top row
                if (trs[tr1]) {
                    out[loc1] = 1;
                }
                // bottom row
                tr2 = ((tr2 << 3) & 511) | (data[j - width] << 2) | (data[j] << 1);
                if (trs[tr2]) {
                    out[loc2] = 1;
                }
            }
            // top-right
            if (trs[(tr1 << 3) & 511]) {
                out[loc1 + 1] = 1;
            }
            // bottom-right
            if (trs[(tr2 << 3) & 511]) {
                out[loc2 + 1] = 1;
            }
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
                let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                // left column
                if (trs[tr]) {
                    out[loc] = 1;
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                    // middle
                    if (trs[tr]) {
                        out[loc] = 1;
                    }
                    i++;
                    loc++;
                }
                // right column
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

    copy(): this {
        let out = new MAPPattern(this.height, this.width, this.data.slice(), this.rule, this.trs);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new MAPPattern(0, 0, new Uint8Array(0), this.rule, this.trs) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPPattern(height, width, data, this.rule, this.trs) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPPattern(height, width, data, this.rule, this.trs) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new MAPPattern(height, width, data, this.rule, this.trs) as this;
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

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, evenTrs: Uint8Array, oddTrs: Uint8Array) {
        super(height, width, data, rule);
        this.evenTrs = evenTrs;
        this.oddTrs = oddTrs;
    }

    runGeneration(): void {
        // an explanation of how this function works is in the comments in MAPPattern.runGeneration
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

    copy(): this {
        let out = new MAPB0Pattern(this.height, this.width, this.data.slice(), this.rule, this.evenTrs, this.oddTrs);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new MAPB0Pattern(0, 0, new Uint8Array(0), this.rule, this.evenTrs, this.oddTrs) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPB0Pattern(height, width, data, this.rule, this.evenTrs, this.oddTrs) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPB0Pattern(height, width, data, this.rule, this.evenTrs, this.oddTrs) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new MAPB0Pattern(height, width, data, this.rule, this.evenTrs, this.oddTrs) as this;
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

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, trs: Uint8Array) {
        super(height, width, data, rule);
        this.trs = trs;
    }

    runGeneration(): void {
        // an explanation of how this function works is in the comments in MAPPattern.runGeneration
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let states = this.rule.states;
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

    copy(): this {
        let out = new MAPGenPattern(this.height, this.width, this.data.slice(), this.rule, this.trs);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new MAPGenPattern(0, 0, new Uint8Array(0), this.rule, this.trs) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new MAPGenPattern(height, width, data, this.rule, this.trs) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new MAPGenPattern(height, width, data, this.rule, this.trs) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new MAPGenPattern(height, width, data, this.rule, this.trs) as this;
    }

}


/** Creates patterns for MAP rules given a rulestring and optional pattern data. */
export function createMAPPattern(rule: string, height: number = 0, width: number = 0, data: Uint8Array = new Uint8Array(0)): string | MAPPattern | MAPB0Pattern | MAPGenPattern {
    let {trs, states} = parseMAPRuleFull(rule);
    if (states > 256) {
        throw new RuleError(`Cannot have more than 256 states`);
    }
    // deal with B0 and S8 rules
    if (trs[0] && trs[511]) {
        let newTrs = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            newTrs[i] = 1 - trs[511 - i];
        }
        trs = newTrs;
    }
    let symmetry = findTransitionsSymmetry(trs);
    let neighborhood = findTransitionsNeighborhood(trs);
    let range = neighborhood.length === 1 && neighborhood[0][0] === 0 && neighborhood[0][1] === 0 ? 0 : 1;
    let ruleStr = unparseMAPRuleFull(trs, states);
    let ruleData: Rule = {
        str: ruleStr,
        states,
        symmetry,
        period: 2,
        range,
        neighborhood,
    };
    if (trs[0]) {
        let evenTrs = new Uint8Array(512);
        let oddTrs = new Uint8Array(512);
        for (let i = 0; i < 512; i++) {
            evenTrs[i] = 1 - trs[i];
            oddTrs[i] = trs[511 - i];
        }
        if (states > 2) {
            throw new RuleError(`Generations B0 is not supported`);
        } else {
            return new MAPB0Pattern(height, width, data, ruleData, evenTrs, oddTrs);
        }
    } else {
        if (states > 2) {
            return new MAPGenPattern(height, width, data, ruleData, trs);
        } else {
            return new MAPPattern(height, width, data, ruleData, trs);
        }
    }
}
