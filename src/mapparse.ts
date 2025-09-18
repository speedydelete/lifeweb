
import {Runner} from './pattern.js';
import {runMAP} from './map.js';
import {runMAPGen} from './mapgen.js';


export const TRANSITIONS: {[key: number]: {[key: string]: [number, number, number, number, number, number, number, number, number]}} = {
    0: {
        c: [0, 0, 0, 0, 2, 0, 0, 0, 0],
    },
    1: {
        c: [1, 0, 0, 0, 2, 0, 0, 0, 0],
        e: [0, 1, 0, 0, 2, 0, 0, 0, 0],
    },
    2: {
        c: [1, 0, 1, 0, 2, 0, 0, 0, 0],
        e: [0, 1, 0, 1, 2, 0, 0, 0, 0],
        k: [0, 1, 0, 0, 2, 0, 0, 0, 1],
        a: [1, 1, 0, 0, 2, 0, 0, 0, 0],
        i: [0, 1, 0, 0, 2, 0, 0, 1, 0],
        n: [1, 0, 0, 0, 2, 0, 0, 0, 1],
    },
    3: {
        c: [1, 0, 1, 0, 2, 0, 0, 0, 1],
        e: [0, 1, 0, 1, 2, 1, 0, 0, 0],
        k: [0, 1, 0, 1, 2, 0, 0, 0, 1],
        a: [1, 1, 0, 1, 2, 0, 0, 0, 0],
        i: [1, 0, 0, 1, 2, 0, 1, 0, 0],
        n: [1, 0, 1, 1, 2, 0, 0, 0, 0],
        y: [1, 0, 1, 0, 2, 0, 0, 1, 0],
        q: [1, 0, 0, 1, 2, 0, 0, 0, 1],
        j: [0, 0, 1, 0, 2, 1, 0, 1, 0],
        r: [0, 1, 1, 0, 2, 0, 0, 1, 0],
    },
    4: {
        c: [1, 0, 1, 0, 2, 0, 1, 0, 1],
        e: [0, 1, 0, 1, 2, 1, 0, 1, 0],
        k: [0, 1, 1, 1, 2, 0, 0, 0, 1],
        a: [1, 0, 0, 1, 2, 0, 1, 1, 0],
        i: [1, 0, 1, 1, 2, 1, 0, 0, 0],
        n: [1, 0, 0, 1, 2, 0, 1, 0, 1],
        y: [1, 0, 1, 0, 2, 0, 1, 1, 0],
        q: [1, 1, 0, 1, 2, 0, 0, 0, 1],
        j: [0, 0, 1, 1, 2, 1, 0, 1, 0],
        r: [0, 1, 1, 0, 2, 1, 0, 1, 0],
        t: [1, 1, 1, 0, 2, 0, 0, 1, 0],
        w: [1, 0, 0, 1, 2, 0, 0, 1, 1],
        z: [1, 1, 0, 0, 2, 0, 0, 1, 1],
    },
    5: {
        c: [0, 1, 0, 1, 2, 1, 1, 1, 0],
        e: [1, 0, 1, 0, 2, 0, 1, 1, 1],
        k: [1, 0, 1, 0, 2, 1, 1, 1, 0],
        a: [0, 0, 1, 0, 2, 1, 1, 1, 1],
        i: [0, 1, 1, 0, 2, 1, 0, 1, 1],
        n: [0, 1, 0, 0, 2, 1, 1, 1, 1],
        y: [0, 1, 0, 1, 2, 1, 1, 0, 1],
        q: [0, 1, 1, 0, 2, 1, 1, 1, 0],
        j: [1, 1, 0, 1, 2, 0, 1, 0, 1],
        r: [1, 0, 0, 1, 2, 1, 1, 0, 1],
    },
    6: {
        c: [0, 1, 0, 1, 2, 1, 1, 1, 1],
        e: [1, 0, 1, 0, 2, 1, 1, 1, 1],
        k: [1, 0, 1, 1, 2, 1, 1, 1, 0],
        a: [0, 0, 1, 1, 2, 1, 1, 1, 1],
        i: [1, 0, 1, 1, 2, 1, 1, 0, 1],
        n: [0, 1, 1, 1, 2, 1, 1, 1, 0],
    },
    7: {
        c: [0, 1, 1, 1, 2, 1, 1, 1, 1],
        e: [1, 0, 1, 1, 2, 1, 1, 1, 1],
    },
    8: {
        c: [1, 1, 1, 1, 2, 1, 1, 1, 1],
    }
}

function gridToNumber(a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) {
    return (a << 8) | (b << 7) | (c << 6) | (d << 5) | (e << 4) | (f << 3) | (g << 2) | (h << 1) | i;
}

let fullTransitions: {[key: number]: {[key: string]: number[]}} = {};
for (let [number, letters] of Object.entries(TRANSITIONS)) {
    let outLetters: {[key: string]: number[]} = {};
    for (let [letter, t] of Object.entries(letters)) {
        // @ts-ignore
        t = t.slice();
        t[4] = 0;
        let allTransitions = new Set<number>();
        for (let j = 0; j < 10; j++) {
            t = [t[6], t[3], t[0], t[7], t[4], t[1], t[8], t[5], t[2]];
            allTransitions.add(gridToNumber(...t));
            allTransitions.add(gridToNumber(t[2], t[1], t[0], t[5], t[4], t[3], t[8], t[7], t[6]));
            allTransitions.add(gridToNumber(t[6], t[7], t[8], t[3], t[4], t[5], t[0], t[1], t[2]));
        }
        outLetters[letter] = Array.from(allTransitions);
    }
    fullTransitions[parseInt(number)] = outLetters;
}


function parseTransition(num: number, minus: boolean, trs: string): [number, string][] {
    let out: [number, string][] = [];
    if (trs.length === 0) {
        for (let char in TRANSITIONS[num]) {
            out.push([num, char]);
        }
    } else if (minus) {
        let outTrs = Object.keys(TRANSITIONS[num]).join('');
        for (let char of trs) {
            if (!outTrs.includes(char)) {
                throw new Error(`Invalid transition ${num}${char}!`);
            }
            outTrs = outTrs.replace(char, '');
        }
        for (let char of outTrs) {
            out.push([num, char]);
        }
    } else {
        for (let char of trs) {
            if (!(char in TRANSITIONS[num])) {
                throw new Error(`Invalid transition: ${num}${char}!`);
            }
            out.push([num, char]);
        }
    }
    return out;
}

function _parseTransitions(part: string): [number, string][] {
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
    if (end === 'V' || end === 'H' || end === 'L') {
        neighborhood = end;
    }
    if (rule.startsWith('MAP')) {
        if (neighborhood === 'M') {
            // @ts-ignore
            trs.setFromBase64(rule.slice(3));
        } else if (neighborhood === 'V') {
            let trs2 = new Uint8Array(4);
            // @ts-ignore
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
        for (let [num, char] of _parseTransitions(b)) {
            for (let tr of fullTransitions[num][char]) {
                trs[tr] = 1;
            }
        }
        for (let [num, char] of _parseTransitions(s)) {
            for (let tr of fullTransitions[num][char]) {
                trs[tr | (1 << 4)] = 1;
            }
        }
    }
    return {func, extra: trs, states, isotropic};
}
