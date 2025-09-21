
import {Pattern, Runner, RuleError} from './pattern.js';
import {runMAP} from './map.js';
import {runMAPGen} from './mapgen.js';


const TRANSITIONS: {[key: number]: {[key: string]: number[]}} = {
    0: {
        c: [0]
    },
    1: {
        c: [64, 256, 1, 4],
        e: [8, 32, 2, 128],
    },
    2: {
        c: [65, 260, 5, 320],
        e: [136, 160, 10, 34],
        k: [12, 33, 264, 258, 66, 132, 96, 129],
        a: [72, 288, 9, 3, 6, 192, 36, 384],
        i: [40, 130],
        n: [68, 257],
    },
    3: {
        c: [69, 261, 321, 324],
        e: [138, 162, 42, 168],
        k: [140, 161, 266, 98],
        a: [200, 416, 11, 38],
        i: [448, 7, 73, 292],
        n: [193, 388, 67, 13, 37, 328, 262, 352],
        y: [97, 268, 133, 322],
        q: [196, 385, 259, 265, 100, 76, 70, 289],
        j: [35, 14, 224, 164, 137, 290, 392, 74],
        r: [41, 44, 104, 134, 131, 386, 296, 194],
    },
    4: {
        c: [325],
        e: [170],
        k: [141, 165, 330, 270, 99, 396, 354, 225],
        a: [480, 456, 39, 201, 420, 75, 15, 294],
        i: [195, 390, 45,360],
        n: [452, 449, 263, 329, 356, 77, 71, 293],
        y: [353, 332, 101, 197, 389, 323, 269, 326],
        q: [204, 417, 267, 102],
        j: [163, 142, 226, 172, 169, 298, 394, 106],
        r: [43, 46, 232, 166, 139, 418, 424, 202],
        t: [105, 300, 135, 450],
        w: [228, 393, 291, 78],
        z: [108, 297, 387, 198],
    },
    5: {
        c: [426, 234, 174, 171],
        e: [357, 333, 453, 327],
        k: [355, 334, 229, 397],
        a: [295, 79, 484, 457],
        i: [47, 488, 422, 203],
        n: [302, 107, 428, 482, 458, 167, 233, 143],
        y: [398, 227, 362, 173],
        q: [299, 110, 236, 230, 395, 419, 425, 206],
        j: [460, 481, 271, 331, 358, 205, 103, 421],
        r: [454, 451, 391, 361, 364, 109, 199, 301],
    },
    6: {
        c: [430, 235, 490, 175],
        e: [359, 335, 485, 461],
        k: [483, 462, 231, 237, 429, 363, 399, 366],
        a: [423, 207, 486, 492, 489, 303, 459, 111],
        i: [455, 365],
        n: [427, 238],
    },
    7: {
        c: [431, 239, 494, 491],
        e: [487, 463, 493, 367],
    },
    8: {
        c: [495],
    }
};

function parseTransition(num: number, minus: boolean, trs: string): number[] {
    let allTrs = TRANSITIONS[num];
    let out: number[] = [];
    if (trs.length === 0) {
        for (let char in allTrs) {
            out.push(...allTrs[char]);
        }
    } else if (minus) {
        let outTrs = Object.assign({}, allTrs);
        for (let char of trs) {
            if (!(char in outTrs)) {
                throw new RuleError(`Invalid isotropic transition: ${num}${char}`);
            }
            delete outTrs[char];
        }
        for (let char in outTrs) {
            out.push(...outTrs[char]);
        }
    } else {
        for (let char of trs) {
            if (!(char in allTrs)) {
                throw new RuleError(`Invalid isotropic transition: ${num}${char}!`);
            }
            out.push(...allTrs[char]);
        }
    }
    return out;
}

function parseTransitions(part: string): number[] {
    let out = [];
    let num = parseInt(part[0]);
    let minus = false;
    let trs = '';
    for (let char of part.slice(1)) {
        if ('012345678'.includes(char)) {
            out.push(...parseTransition(num, minus, trs));
            num = parseInt(char);
            minus = false;
            trs = '';
        } else if (char === '-') {
            minus = true;
        } else {
            trs += char;
        }
    }
    out.push(...parseTransition(num, minus, trs));
    return out;
}


function parseVonNeumannTransitions(part: string): number[] {
    let trs: [number, string][] = [];
    for (let char of part) {
        if (char === '0') {
            trs.push([0, 'c'], [1, 'c'], [2, 'c'], [2, 'n'], [3, 'c'], [4, 'c']);
        } else if (char === '1') {
            trs.push([1, 'e'], [2, 'k'], [3, 'i'], [3, 'n'], [3, 'y'], [3, 'q'], [4, 'n'], [4, 'y'], [5, 'e']);
        } else if (char === '2') {
            trs.push([2, 'e'], [2, 'i'], [3, 'k'], [3, 'a'], [3, 'j'], [3, 'r'], [4, 'k'], [4, 'a'], [4, 'i'], [4, 'q'], [4, 't'], [4, 'w'], [4, 'z'], [5, 'k'], [5, 'a'], [5, 'i'], [5, 'r'], [6, 'e'], [6, 'i']);
        } else if (char === '3') {
            trs.push([3, 'e'], [4, 'j'], [4, 'r'], [5, 'i'], [5, 'n'], [5, 'y'], [5, 'q'], [6, 'k'], [6, 'a'], [7, 'e']);
        } else if (char === '4') {
            trs.push([4, 'e'], [5, 'c'], [6, 'c'], [6, 'n'], [7, 'c'], [8, 'c']);
        } else {
            throw new RuleError(`Invalid von Neumman neighborhood transition: '${char}'`);
        }
    }
    let out: number[] = [];
    for (let [num, char] of trs) {
        out.push(...TRANSITIONS[num][char]);
    }
    return out;
}


const HEX_TRANSITIONS: {[key: number]: {[key: string]: number[]}} = {
    0: {
        o: [0, 4, 128, 132],
    },
    1: {
        o: [1, 5, 129, 133, 2, 6, 130, 134, 8, 12, 136, 140, 32, 36, 160, 164, 128, 132, 128, 132, 256, 260, 384, 388],
    },
    2: {
        o: [3, 7, 131, 135, 10, 14, 138, 142, 40, 44, 168, 172, 160, 164, 160, 164, 384, 388, 384, 388, 257, 261, 385, 389],
        m: [9, 13, 137, 141, 34, 38, 162, 166, 136, 140, 136, 140, 288, 292, 416, 420, 129, 133, 129, 133, 258, 262, 386, 390],
        p: [33, 37, 161, 165, 130, 134, 130, 134, 264, 268, 392, 396],
    },
    3: {
        o: [11, 15, 139, 143, 42, 46, 170, 174, 168, 172, 168, 172, 416, 420, 416, 420, 385, 389, 385, 389, 259, 263, 387, 391],
        m: [161, 165, 161, 165, 386, 390, 386, 390, 265, 269, 393, 397, 35, 39, 163, 167, 138, 142, 138, 142, 296, 300, 424, 428, 41, 45, 169, 173, 162, 166, 162, 166, 392, 396, 392, 396, 289, 293, 417, 421, 131, 135, 131, 135, 266, 270, 394, 398],
        p: [137, 141, 137, 141, 290, 294, 418, 422],
    },
    4: {
        o: [43, 47, 171, 175, 170, 174, 170, 174, 424, 428, 424, 428, 417, 421, 417, 421, 387, 391, 387, 391, 267, 271, 395, 399],
        m: [169, 173, 169, 173, 418, 422, 418, 422, 393, 397, 393, 397, 291, 295, 419, 423, 139, 143, 139, 143, 298, 302, 426, 430],
        p: [163, 167, 163, 167, 394, 398, 394, 398, 297, 301, 425, 429],
    },
    5: {
        o: [171, 175, 171, 175, 426, 430, 426, 430, 425, 429, 425, 429, 419, 423, 419, 423, 395, 399, 395, 399, 299, 303, 427, 431],
    },
    6: {
        o: [427, 431, 427, 431],
    },
};

function parseHexTransition(num: number, minus: boolean, trs: string): number[] {
    let allTrs = HEX_TRANSITIONS[num];
    let out: number[] = [];
    if (trs.length === 0) {
        for (let char in allTrs) {
            out.push(...allTrs[char]);
        }
    } else if (minus) {
        let outTrs = Object.assign({}, allTrs);
        for (let char of trs) {
            if (!(char in outTrs)) {
                throw new RuleError(`Invalid isotropic transition: ${num}${char}`);
            }
            delete outTrs[char];
        }
        for (let char in outTrs) {
            out.push(...outTrs[char]);
        }
    } else {
        for (let char of trs) {
            if (!(char in allTrs)) {
                throw new RuleError(`Invalid isotropic transition: ${num}${char}!`);
            }
            out.push(...allTrs[char]);
        }
    }
    return out;
}

function parseHexTransitions(part: string): number[] {
    let out = [];
    let num = parseInt(part[0]);
    let minus = false;
    let trs = '';
    for (let char of part.slice(1)) {
        if ('012345678'.includes(char)) {
            out.push(...parseHexTransition(num, minus, trs));
            num = parseInt(char);
            minus = false;
            trs = '';
        } else if (char === '-') {
            minus = true;
        } else {
            trs += char;
        }
    }
    out.push(...parseHexTransition(num, minus, trs));
    return out;
}


export function parseMAPRule(rule: string): string | {func: Runner, extra: Uint8Array, states: number, isotropic: boolean} {
    let raw = rule;
    let func: Runner = runMAP;
    let trs = new Uint8Array(512);
    let neighborhood: 'M' | 'V' | 'H' | 'L' = 'M';
    let states = 2;
    let isotropic = true;
    let match: RegExpMatchArray | null;
    if (match = rule.match(/^[gG]([0-9]+)/)) {
        states = parseInt(match[1]);
        rule = rule.slice(match[0].length);
        func = runMAPGen;
    }
    if (match = rule.match(/\/[GgCc]?(\d+)$/)) {
        states = parseInt(match[1]);
        rule = rule.slice(0, match[0].length);
        func = runMAPGen;
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
        if (neighborhood === 'M') {
            trs.setFromBase64(rule.slice(3));
        } else if (neighborhood === 'V') {
            let trs2 = new Uint8Array(4);
            trs2.setFromBase64(rule.slice(3));
        }
    } else if (rule.startsWith('W')) {
        return `R1,C${states},${rule}`;
    } else {
        let sections = rule.split('/');
        if (sections.length !== 2) {
            return raw;
        }
        let [b, s] = sections;
        let isGenB = !(b.startsWith('B') || b.startsWith('b'));
        let isGenS = !(s.startsWith('S') || s.startsWith('s'));
        if (isGenB !== isGenS) {
            return raw;
        }
        if (isGenB) {
            [b, s] = [s, b];
        }
        let bTrs: number[];
        let sTrs: number[];
        if (neighborhood === 'M') {
            bTrs = parseTransitions(b);
            sTrs = parseTransitions(s);
        } else if (neighborhood === 'V') {
            bTrs = parseVonNeumannTransitions(b);
            sTrs = parseVonNeumannTransitions(s);
        } else if (neighborhood === 'H') {
            bTrs = parseHexTransitions(b);
            sTrs = parseHexTransitions(s);
        } else {
            return `R1,C${states},B${b},S${s},NL`;
        }
        for (let tr of bTrs) {
            trs[tr] = 1;
        }
        for (let tr of sTrs) {
            trs[tr | (1 << 4)] = 1;
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
            let oldFunc = func;
            func = function(p: Pattern) {
                oldFunc(p, p.generation % 2 === 0 ? even : odd);
            }
        }
    }
    return {func, extra: trs, states, isotropic};
}
