
/* Implements higher-range outer-totalistic rules (https://conwaylife.com/wiki/Larger_than_Life). */

import {RuleError} from './util.js';
import {CoordPattern, RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, getRuleSymmetryFromBases, Rule} from './pattern.js';
import {unparseMAP} from './map.js';


/** Parses a HROT range, such as "3-4" or "1". */
export function parseHROTRange(data: string): number[] {
    if (data.length === 0) {
        return [];
    }
    if (!data.match(/^\d+((-|\.\.)\d+)?$/)) {
        throw new RuleError(`Invalid HROT range: ${data}`);
    }
    let start: number;
    let end: number | undefined = undefined;
    let index = data.indexOf('-');
    if (index !== -1) {
        start = Number(data.slice(0, index));
        end = Number(data.slice(index + 1));
    } else {
        index = data.indexOf('..');
        if (index !== -1) {
            start = Number(data.slice(0, index));
            end = Number(data.slice(index + 2));
        } else {
            start = Number(data);
        }
    }
    if (end === undefined) {
        end = start;
    }
    if (Number.isNaN(start) || Number.isNaN(end)) {
        throw new RuleError(`Invalid HROT range: ${data}`);
    }
    let out: number[] = [];
    for (let i = start; i <= end; i++) {
        out.push(i);
    }
    return out;
}

/** Takes in a B/S Uint8Array and outputs HROT ranges. */
export function unparseHROTRanges(data: Uint8Array): string {
    let out = '';
    let start: number | null = null;
    for (let i = 0; i < data.length; i++) {
        if (data[i]) {
            if (start === null) {
                start = i;
            }
        } else {
            if (start !== null) {
                if (start === i - 1) {
                    out += start + ',';
                } else {
                    out += start + '-' + (i - 1) + ',';
                }
                start = null;
            }
        }
    }
    if (start !== null) {
        if (start === data.length - 1) {
            out += start + ',';
        } else {
            out += start + '-' + (data.length - 1) + ',';
        }
    }
    return out.slice(0, -1);
}

/** Parses a HROT rule into sections. */
function parseSections(rule: string): {r: number, c: number, m: boolean, s: number[], b: number[], n: string, w: number | null} {
    let r = 1;
    let c = 2;
    let m = false;
    let s: number[] = [];
    let b: number[] = [];
    let n: string = 'M';
    let w: number | null = null;
    let bFound = false;
    let sFound = false;
    for (let section of rule.split(',')) {
        if (sFound) {
            if (section[0] === 'B') {
                bFound = true;
                sFound = false;
                b.push(...parseHROTRange(section.slice(1)));
            } else {
                s.push(...parseHROTRange(section));
            }
        } else if (bFound) {
            if (section[0] === 'N') {
                n = section.slice(1);
                break;
            } else {
                b.push(...parseHROTRange(section));
            }
        } else if (section[0] === 'R') {
            r = Number(section.slice(1));
        } else if (section[0] === 'C') {
            c = Number(section.slice(1));
            if (c === 0) {
                c = 2;
            }
        } else if (section[0] === 'S') {
            sFound = true;
            s.push(...parseHROTRange(section.slice(1)));
        } else if (section[0] === 'M') {
            m = Number(section.slice(1)) === 0 ? false : true;
        } else if (section[0] === 'W') {
            w = Number(section.slice(1));
        } else {
            throw new RuleError(`Invalid HROT section: '${section}'`);
        }
    }
    return {r, c, m, s, b, n, w};
}


/** A list of checking functions for the supported HROT neighborhoods. */
const NEIGHBORHOODS: {[key: string]: (x: number, y: number, r: number) => number} = {
    N(x, y, r) {
        return (Math.abs(x) + Math.abs(y) <= r) && !(x === 0 && y === 0) ? 1 : 0;
    },
    C(x, y, r) {
        return x**2 + y**2 < (r + 0.5)**2 ? 1 : 0;
    },
    2(x, y, r) {
        return NEIGHBORHOODS.C(x, y, r - 1) || x === 0 || y === 0 ? 1 : 0;
    },
    B(x, y, r) {
        return x + y % 2 === 0 ? 0 : 1;
    },
    D(x, y, r) {
        return x + y % 2 === 0 ? 1 : 0;
    },
    '+'(x, y, r) {
        return (x === 0 || y === 0) && !(x === 0 && y === 0) ? 1 : 0;
    },
    plus(x, y, r) {
        return (x === 0 || y === 0) && !(x === 0 && y === 0) ? 1 : 0;
    },
    X(x, y, r) {
        return (x === y || x === -y) && !(x === 0 && y === 0) ? 1 : 0;
    },
    '*'(x, y, r) {
        return (x === 0 || y === 0 || x === y || x === -y) && !(x === 0 && y === 0) ? 1 : 0;
    },
    star(x, y, r) {
        return (x === 0 || y === 0 || x === y || x === -y) && !(x === 0 && y === 0) ? 1 : 0;
    },
    '#'(x, y, r) {
        return (x === r - 1 || y === r - 1 || x === r + 1 || y === r + 1) ? 1 : 0;
    },
    hash(x, y, r) {
        return (x === r - 1 || y === r - 1 || x === r + 1 || y === r + 1) ? 1 : 0;
    },
    G(x, y, r) {
        return x === 0 && y === 0 ? 0 : Math.abs(x * y);
    }
};

function getCustomNeighborhoodSymmetry(range: number, nhArray: number[][]): RuleSymmetry {
    let nh: {[key: string]: number} = {};
    for (let y = -range; y <= range; y++) {
        let row = nhArray[y + range];
        for (let x = -range; x <= range; x++) {
            nh[y + ',' + x] = row[x + range];
        }
    }
    let C2 = true;
    let C4 = true;
    let D2h = true;
    let D2v = true;
    let D2s = true;
    let D2b = true;
    for (let y = -range; y <= range; y++) {
        for (let x = -range; x <= range; x++) {
            let value = nh[y + ',' + x];
            if (C2) {
                if (value !== nh[(-y) + ',' + (-x)]) {
                    C2 = false;
                } else if (C4 && (value !== nh[(-x) + ',' + y] || value !== nh[x + ',' + (-y)])) {
                    C4 = false;
                }
            }
            if (D2h && value !== nh[y + ',' + (-x)]) {
                D2h = false;
            }
            if (D2v && value !== nh[(-y) + ',' + x]) {
                D2v = false;
            }
            if (D2s && value !== nh[(-x) + ',' + (-y)]) {
                D2s = false;
            }
            if (D2b && value !== nh[(-x) + ',' + (-y)]) {
                D2b = false;
            }
        }
    }
    return getRuleSymmetryFromBases(C2, C4, D2h, D2v, D2s, D2b);
}

/** Parses a HROT rulestring into a lot of data. */
export function parseHROTRule(rule: string): string | {rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | null} {
    let {r, c, m, s, b, n, w} = parseSections(rule);
    if (c < 2) {
        c = 2;
    }
    // if (w !== null) {
    //     let extra = parse1dRule(r, w);
    //     let func = c === 2 ? run1d : run1dGen;
    //     let ruleStr = (r === 1 && c === 2) ? 'W' + w : `R${r},C${c},W${w}`;
    //     return {func, extra, states: c, isotropic: true, ruleStr};
    // }
    let size = 2 * r + 1;
    let nh: number[][] | null;
    if (n === 'M') {
        nh = null;
    } else if (n in NEIGHBORHOODS) {
        let func = NEIGHBORHOODS[n];
        nh = [];
        for (let y = -r; y <= r; y++) {
            let row: number[] = [];
            for (let x = -r; x <= r; x++) {
                row.push(func(x, y, r) ? 1 : 0);
            }
            nh.push(row);
        }
    } else if (n.startsWith('@')) {
        nh = [];
    } else if (n.startsWith('W')) {
        let digits = n.slice(1);
        if (!Array.from(digits).every(x => '0123456789abcdefABCDEF'.includes(x)) || !(digits.length === size**2 || digits.length === size**2 * 2)) {
            throw new RuleError(`Weighted neighborhood requires ${size**2} or ${size**2 * 2} hex digits for range ${r}`);
        }
        nh = [];
        let isBig = n.length === size**2 * 2;
        let i = 0;
        for (let y = 0; y < size; y++) {
            let row: number[] = [];
            for (let x = 0; x < size; x++) {
                let value = Number(digits[i]);
                if (isBig) {
                    if (value > 127) {
                        row.push(value - 256);
                    } else {
                        row.push(value);
                    }
                } else {
                    if (value > 7) {
                        row.push(value - 16);
                    } else {
                        row.push(value);
                    }
                }
                i += isBig ? 2 : 1;
            }
            nh.push(row);
        }
    } else {
        throw new RuleError(`Invalid HROT neighborhood: '${n}'`);
    }
    if (m) {
        if (nh === null) {
            s = s.map(x => x + 1);
        } else {
            nh[r + 1][r + 1] = 1;
        }
    }
    if (nh && nh.length === 0) {
        throw new RuleError(`Invalid HROT neighborhood: '${n}'`);
    }
    if (r === 1) {
        if (nh) {
            let trs = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                let value = nh[2][2] * (i & 1) + nh[2][1] * ((i >> 1) & 1) + nh[2][0] * ((i >> 2) & 1) + nh[1][2] * ((i >> 3) & 1) + nh[1][0] * ((i >> 5) & 1) + nh[2][0] * ((i >> 6) & 1) + nh[1][0] * ((i >> 7) & 1) + nh[0][0] * ((i >> 8) & 1);
                if (i & (1 << 4)) {
                    if (value in s) {
                        trs[i] = 1;
                    }
                } else if (value in b) {
                    trs[i] = 1;
                }
            }
            return 'MAP' + unparseMAP(trs);
        } else {
            if (c === 2) {
                return `B${b.join('')}/S${s.join('')}`;
            } else {
                return `${s.join('')}/${b.join('')}/${c}`;
            }

        }
    }
    let length = (nh ? nh.flat().reduce((x, y) => x + y) : (2*r + 1)**2 - 1) + 1;
    let outB = new Uint8Array(length);
    for (let value of b) {
        outB[value] = 1;
    }
    let outS = new Uint8Array(length);
    for (let value of s) {
        outS[value] = 1;
    }
    let ruleStr = `R${r},C${c},S${unparseHROTRanges(outS)},B${unparseHROTRanges(outB)}`;
    if (n !== 'M') {
        ruleStr += ',N';
        if (n === 'plus') {
            ruleStr += '+';
        } else if (n === 'star') {
            ruleStr += '*';
        } else if (n === 'hash') {
            ruleStr += '#';
        } else {
            ruleStr += n;
        }
    }
    let neighborhood: [number, number][] = [];
    for (let y = -r; y <= r; y++) {
        for (let x = -r; x <= r; x++) {
            if (!nh || nh[y][x] !== 0) {
                neighborhood.push([x, y]);
            }
        }
    }
    return {
        rule: {
            str: ruleStr,
            states: c,
            symmetry: nh ? getCustomNeighborhoodSymmetry(r, nh) : 'D8',
            period: b[0] ? 2 : 1,
            range: r,
            neighborhood,
        },
        b: outB,
        s: outS,
        nh: nh ? new Int8Array(nh.flat()) : null,
    };
}

const HEX_CHARS = '0123456789abcdef';

/** Parses a Catagolue-format HROT rulestring into a bunch of data. */
export function parseCatagolueHROTRule(rule: string): string | {rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | null} {
    let states = 2;
    if (rule.startsWith('x')) {
        rule = rule.slice(1);
    }
    if (rule.startsWith('g')) {
        states = Number(rule.slice(1));
        rule = rule.slice(rule.indexOf('r'));
    }
    let r = Number(rule.slice(1));
    let out = `R${r},C${states},B`;
    rule = rule.slice(rule.indexOf('b') + 1);
    let n: string | null = null;
    let index = rule.indexOf('n');
    if (index !== -1) {
        n = rule.slice(index + 1);
        if (n.length > 1 && n.endsWith('x')) {
            n = n.slice(0, -1);
        }
        rule = rule.slice(0, index);
    }
    if (!rule.includes('s')) {
        throw new RuleError(`Expected 's' in Catagolue HROT rule`);
    }
    let [b, s] = rule.split('s');
    let isS = false;
    for (let x of [b, s]) {
        let isFirst = true;
        if (x.endsWith('z')) {
            out += '0';
            isFirst = false;
            x = x.slice(0, -1);
        }
        let j = 1;
        for (let i = ((2*r + 1)**2 - 1) / 4; i > 0; i--) {
            let num = HEX_CHARS.indexOf(x[i]);
            for (let mask = 1; mask <= 8; i *= 2) {
                if (num & mask) {
                    if (isFirst) {
                        isFirst = false;
                    } else {
                        out += ',';
                    }
                    out += j;
                }
                j++;
            }
        }
        if (!isS) {
            isS = true;
            out += ',S';
        }
    }
    return parseHROTRule(rule);
}


/** Implements higher-range outer-totalistic rules. */
export class HROTPattern extends CoordPattern {

    b: Uint8Array;
    s: Uint8Array;
    nh: Int8Array | null;

    constructor(coords: Map<number, number>, rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | null) {
        super(coords, rule);
        this.b = b;
        this.s = s;
        this.nh = nh;
    }

    runGeneration(): void {
        let range = this.rule.range;
        let {minX, maxX, minY, maxY} = this.getMinMaxCoords();
        minX = minX - range + BIAS;
        maxX = maxX + range + BIAS;
        minY = minY - range + BIAS;
        maxY = maxY + range + BIAS;
        let out = new Map<number, number>();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let count = 0;
                if (this.nh) {
                    let i = 0;
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            let weight = this.nh[i++];
                            if (weight > 0) {
                                let key = (x + x2) * WIDTH + (y + y2);
                                let value = this.coords.get(key);
                                if (value === 1) {
                                    count += weight;
                                }
                            }
                        }
                    }
                } else {
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            if (x2 === 0 && y2 === 0) {
                                continue;
                            }
                            let key = (x + x2) * WIDTH + (y + y2);
                            let value = this.coords.get(key);
                            if (value === 1) {
                                count++;
                            }
                        }
                    }
                }
                let key = x * WIDTH + y;
                let value = this.coords.get(key);
                if (value === undefined) {
                    if (this.b[count]) {
                        out.set(key, 1);
                    }
                } else if (value === 1) {
                    if (this.s[count]) {
                        out.set(key, 1);
                    } else {
                        let newValue = (value + 1) % this.rule.states;
                        if (newValue !== 0) {
                            out.set(key, newValue);
                        }
                    }
                } else {
                    let newValue = (value + 1) % this.rule.states;
                    if (newValue !== 0) {
                        out.set(key, newValue);
                    }
                }
            }
        }
        this.generation++;
        this.coords = out;
    }

    copy(): HROTPattern {
        let out = new HROTPattern(new Map(this.coords), this.rule, this.b, this.s, this.nh);
        out.generation = this.generation;
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): HROTPattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        let p = new HROTPattern(out, this.rule, this.b, this.s, this.nh);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): HROTPattern {
        return new HROTPattern(new Map(), this.rule, this.b, this.s, this.nh);
    }

    loadApgcode(code: string): HROTPattern {
        return new HROTPattern(this._loadApgcode(code), this.rule, this.b, this.s, this.nh);
    }

    loadRLE(rle: string): HROTPattern {
        return new HROTPattern(this._loadRLE(rle), this.rule, this.b, this.s, this.nh);
    }

}


/** Implements higher-range outer-totalistic rules with B0. */
export class HROTB0Pattern extends CoordPattern {

    evenB: Uint8Array;
    evenS: Uint8Array;
    oddB: Uint8Array;
    oddS: Uint8Array;
    nh: Int8Array | null;

    constructor(coords: Map<number, number>, rule: Rule, evenB: Uint8Array, evenS: Uint8Array, oddB: Uint8Array, oddS: Uint8Array, nh: Int8Array | null) {
        super(coords, rule);
        this.evenB = evenB;
        this.evenS = evenS;
        this.oddB = oddB;
        this.oddS = oddS;
        this.nh = nh;
    }

    runGeneration(): void {
        let range = this.rule.range;
        let {minX, maxX, minY, maxY} = this.getMinMaxCoords();
        minX = minX - range + BIAS;
        maxX = maxX + range + BIAS;
        minY = minY - range + BIAS;
        maxY = maxY + range + BIAS;
        let b = this.generation % 2 === 0 ? this.evenB : this.oddB;
        let s = this.generation % 2 === 0 ? this.evenS : this.oddS;
        let out = new Map<number, number>();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let count = 0;
                if (this.nh) {
                    let i = 0;
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            let weight = this.nh[i++];
                            if (weight > 0) {
                                let key = (x + x2) * WIDTH + (y + y2);
                                let value = this.coords.get(key);
                                if (value === 1) {
                                    count += weight;
                                }
                            }
                        }
                    }
                } else {
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            if (x2 === 0 && y2 === 0) {
                                continue;
                            }
                            let key = (x + x2) * WIDTH + (y + y2);
                            let value = this.coords.get(key);
                            if (value === 1) {
                                count++;
                            }
                        }
                    }
                }
                let key = x * WIDTH + y;
                let value = this.coords.get(key);
                if (value === undefined) {
                    if (b[count]) {
                        out.set(key, 1);
                    }
                } else if (value === 1) {
                    if (s[count]) {
                        out.set(key, 1);
                    } else {
                        let newValue = (value + 1) % this.rule.states;
                        if (newValue !== 0) {
                            out.set(key, newValue);
                        }
                    }
                } else {
                    let newValue = (value + 1) % this.rule.states;
                    if (newValue !== 0) {
                        out.set(key, newValue);
                    }
                }
            }
        }
        this.generation++;
        this.coords = out;
    }

    copy(): HROTB0Pattern {
        let out = new HROTB0Pattern(new Map(this.coords), this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
        out.generation = this.generation;
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): HROTB0Pattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        let p = new HROTB0Pattern(out, this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): HROTB0Pattern {
        return new HROTB0Pattern(new Map(), this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
    }

    loadApgcode(code: string): HROTB0Pattern {
        return new HROTB0Pattern(this._loadApgcode(code), this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
    }

    loadRLE(rle: string): HROTB0Pattern {
        return new HROTB0Pattern(this._loadRLE(rle), this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
    }

}


/** Parses a HROT rule. */
export function createHROTPattern(rule: string, height: number, width: number, data: Uint8Array): string | HROTPattern | HROTB0Pattern {
    let out = rule.startsWith('R') ? parseHROTRule(rule) : parseCatagolueHROTRule(rule);
    if (typeof out === 'string') {
        return out;
    }
    let {rule: ruleData, b, s, nh} = out;
    let coords = new Map<number, number>();
    let i = 0;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let value = data[i++];
            if (value) {
                coords.set((x + BIAS) * WIDTH + (y + BIAS), value);
            }
        }
    }
    if (b[0]) {
        if (s[ruleData.range**2]) {
            let temp = s;
            s = b.reverse().map(x => 1 - x);
            b = temp.reverse().map(x => 1 - x);
        } else {
            let evenB = b.map(x => 1 - x);
            let evenS = s.map(x => 1 - x);
            let oddB = s.reverse();
            let oddS = b.reverse();
            return new HROTB0Pattern(coords, ruleData, evenB, evenS, oddB, oddS, nh);
        }
    }
    return new HROTPattern(coords, ruleData, b, s, nh);
}
