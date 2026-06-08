
/* Implements higher-range outer-totalistic rules (https://conwaylife.com/wiki/Larger_than_Life). */

import {RuleError} from './util.js';
import {RuleSymmetry, getRuleSymmetryFromBases, Rule, DataPattern} from './pattern.js';
import {unparseMAP} from './map.js';


/** Parses a HROT range, such as "3-4" or "1". */
export function parseHROTRange(data: string): number[] {
    if (data.length === 0) {
        return [];
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
function parseSections(rule: string): {range: number, states: number, middle: boolean, s: number[], b: number[], nh: string, wolfram?: number} {
    let range = 1;
    let states = 2;
    let middle = false;
    let s: number[] = [];
    let b: number[] = [];
    let nh: string = 'M';
    let wolfram: number | undefined = undefined;
    let bFound = false;
    let sFound = false;
    for (let section of rule.split(',')) {
        if (sFound) {
            // if we've seen S, B must come next
            if (section[0] === 'B') {
                bFound = true;
                sFound = false;
                b.push(...parseHROTRange(section.slice(1)));
            } else {
                s.push(...parseHROTRange(section));
            }
        } else if (bFound) {
            // if we've seen B we can only see N next
            if (section[0] === 'N') {
                nh = section.slice(1);
                break;
            } else {
                b.push(...parseHROTRange(section));
            }
        } else if (section[0] === 'R') {
            range = Number(section.slice(1));
        } else if (section[0] === 'C') {
            states = Number(section.slice(1));
            if (states === 0) {
                states = 2;
            }
        } else if (section[0] === 'S') {
            sFound = true;
            s.push(...parseHROTRange(section.slice(1)));
        } else if (section[0] === 'M') {
            middle = Number(section.slice(1)) === 0 ? false : true;
        } else if (section[0] === 'W') {
            wolfram = Number(section.slice(1));
        } else {
            throw new RuleError(`Invalid HROT section: '${section}'`);
        }
    }
    return {range, states, middle, s, b, nh, wolfram};
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
    },
};

/** Gets the rule symmetry of a custom HROT neighborhood. */
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
export function parseHROTRule(rule: string): string | {rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | undefined} {
    let {range, states, middle, s, b, nh, wolfram} = parseSections(rule);
    if (states < 2) {
        states = 2;
    }
    // deal with Rx,Cy,Wz format
    if (wolfram !== undefined) {
        if (range === 1) {
            return `W${wolfram}/${states}`;
        } else {
            throw new RuleError(`Higher-range 1D rules are not supported yet`);
        }
    }
    let size = 2 * range + 1;
    let nhArray: number[][] | undefined;
    if (nh === 'M') {
        nhArray = undefined;
    } else if (nh in NEIGHBORHOODS) {
        let func = NEIGHBORHOODS[nh];
        nhArray = [];
        for (let y = -range; y <= range; y++) {
            let row: number[] = [];
            for (let x = -range; x <= range; x++) {
                row.push(func(x, y, range) ? 1 : 0);
            }
            nhArray.push(row);
        }
    } else if (nh.startsWith('@')) {
        // CoordCA neighborhood parser
        let bits: number[] = [];
        for (let char of nh.slice(1)) {
            let value = parseInt(char, 16);
            if (Number.isNaN(value)) {
                throw new RuleError(`Invalid custom neighborhood: '${nh}'`);
            }
            bits.push((value & (1 << 3)) ? 1 : 0);
            bits.push((value & (1 << 2)) ? 1 : 0);
            bits.push((value & (1 << 1)) ? 1 : 0);
            bits.push((value & 1) ? 1 : 0);
        }
        if ((range * 2 + 1)**2 - 1 !== bits.length) {
            throw new RuleError(`Invalid custom neighborhood: '${nh}'`);
        }
        nhArray = [];
        let i = 0;
        for (let y = -range; y <= range; y++) {
            let row: number[] = [];
            for (let x = -range; x <= range; x++) {
                if (x === 0 && y === 0) {
                    row.push(0);
                    continue;
                }
                row.push(bits[i++]);
            }
            nhArray.push(row);
        }
    } else if (nh.startsWith('W')) {
        // weighted neighborhood parser
        let digits = nh.slice(1).replaceAll('/', '');
        if (!Array.from(digits).every(x => '0123456789abcdefABCDEF'.includes(x))) {
            throw new RuleError(`Invalid characters in weighted neighborhood`);
        }
        if (!(digits.length === size**2 || digits.length === size**2 * 2)) {
            throw new RuleError(`Weighted neighborhood requires ${size**2} or ${size**2 * 2} hex digits for range ${range}, got ${digits.length} digits`);
        }
        nhArray = [];
        let isBig = digits.length === size**2 * 2;
        let i = 0;
        for (let y = 0; y < size; y++) {
            let row: number[] = [];
            for (let x = 0; x < size; x++) {
                if (isBig) {
                    let value = Number(digits[i] + digits[i + 1]);
                    if (value > 127) {
                        row.push(value - 256);
                    } else {
                        row.push(value);
                    }
                    i += 2;
                } else {
                    let value = Number(digits[i]);
                    if (value > 7) {
                        row.push(value - 16);
                    } else {
                        row.push(value);
                    }
                    i++;
                }
            }
            nhArray.push(row);
        }
    } else {
        throw new RuleError(`Invalid HROT neighborhood: '${nh}'`);
    }
    // deal with ,M1,
    if (middle) {
        if (nhArray === undefined) {
            s = s.map(x => x - 1);
        } else {
            nhArray[range + 1][range + 1] = 1;
        }
    }
    if (nh && nh.length === 0) {
        throw new RuleError(`Invalid HROT neighborhood: '${nh}'`);
    }
    // turn range-1 rules into MAP rules
    if (range === 1) {
        if (nhArray) {
            let trs = new Uint8Array(512);
            for (let i = 0; i < 512; i++) {
                let value = nhArray[2][2] * (i & 1) + nhArray[1][2] * ((i >> 1) & 1) + nhArray[0][2] * ((i >> 2) & 1) + nhArray[2][1] * ((i >> 3) & 1) + nhArray[0][1] * ((i >> 5) & 1) + nhArray[2][0] * ((i >> 6) & 1) + nhArray[1][0] * ((i >> 7) & 1) + nhArray[0][0] * ((i >> 8) & 1);
                if (i & (1 << 4)) {
                    if (s.includes(value)) {
                        trs[i] = 1;
                    }
                } else if (b.includes(value)) {
                    trs[i] = 1;
                }
            }
            return unparseMAP(trs, states);
        } else {
            if (states === 2) {
                return `B${b.join('')}/S${s.join('')}`;
            } else {
                return `${s.join('')}/${b.join('')}/${states}`;
            }

        }
    }
    // generate Uint8Arrays and unparse the rulestring
    let length = (nhArray ? nhArray.flat().reduce((x, y) => x + y) : (2 * range + 1)**2 - 1) + 1;
    let outB = new Uint8Array(length);
    for (let value of b) {
        outB[value] = 1;
    }
    let outS = new Uint8Array(length);
    for (let value of s) {
        outS[value] = 1;
    }
    let ruleStr = `R${range},C${states},S${unparseHROTRanges(outS)},B${unparseHROTRanges(outB)}`;
    if (nh !== 'M') {
        ruleStr += ',N';
        if (nh === 'plus') {
            ruleStr += '+';
        } else if (nh === 'star') {
            ruleStr += '*';
        } else if (nh === 'hash') {
            ruleStr += '#';
        } else {
            ruleStr += nh;
        }
    }
    // figure out the actual neighborhood
    let neighborhood: [number, number][] = [];
    for (let y = -range; y <= range; y++) {
        for (let x = -range; x <= range; x++) {
            if (!nhArray || nhArray[y + range][x + range] !== 0) {
                neighborhood.push([x, y]);
            }
        }
    }
    return {
        rule: {
            str: ruleStr,
            states,
            neighborhood,
            symmetry: nhArray ? getCustomNeighborhoodSymmetry(range, nhArray) : 'D8',
            period: outB[0] ? 2 : 1,
            range,
        },
        b: outB,
        s: outS,
        nh: nhArray ? new Int8Array(nhArray.flat()) : undefined,
    };
}

const HEX_CHARS = '0123456789abcdef';

/** Parses a Catagolue-format HROT rulestring into a bunch of data. */
export function parseCatagolueHROTRule(rule: string): string | {rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | undefined} {
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
export class HROTPattern extends DataPattern {

    b: Uint8Array;
    s: Uint8Array;
    nh: Int8Array | undefined;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, b: Uint8Array, s: Uint8Array, nh: Int8Array | undefined) {
        super(height, width, data, rule);
        this.b = b;
        this.s = s;
        this.nh = nh;
    }

    runGeneration(): void {
        let range = this.rule.range;
        let height = this.height;
        let width = this.width;
        let newHeight = height + range * 2;
        let newWidth = width + range * 2;
        let newSize = newHeight * newWidth;
        let out = new Uint8Array(newSize);
        for (let y = -range; y < height + range; y++) {
            for (let x = -range; x < width + range; x++) {
                let count = 0;
                if (this.nh) {
                    let i = 0;
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            let weight = this.nh[i++];
                            if (weight > 0) {
                                let value = this.get(x + x2, y + y2);
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
                            let value = this.get(x + x2, y + y2);
                            if (value === 1) {
                                count++;
                            }
                        }
                    }
                }
                let value = this.get(x, y);
                let loc = (y + range) * newWidth + (x + range);
                if (value === 0) {
                    if (this.b[count]) {
                        out[loc] = 1;
                    }
                } else if (value === 1) {
                    if (this.s[count]) {
                        out[loc] = 1;
                    } else {
                        out[loc] = (value + 1) % this.rule.states;
                    }
                } else {
                    out[loc] = (value + 1) % this.rule.states;
                }
            }
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= range;
        this.yOffset -= range;
        this.generation++;
        this.shrinkToFit();
    }

    copy(): this {
        let out = new HROTPattern(this.height, this.width, this.data, this.rule, this.b, this.s, this.nh);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new HROTPattern(0, 0, new Uint8Array(0), this.rule, this.b, this.s, this.nh) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new HROTPattern(height, width, data, this.rule, this.b, this.s, this.nh) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new HROTPattern(height, width, data, this.rule, this.b, this.s, this.nh) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new HROTPattern(height, width, data, this.rule, this.b, this.s, this.nh) as this;
    }

}


/** Implements higher-range outer-totalistic rules with B0. */
export class HROTB0Pattern extends DataPattern {

    evenB: Uint8Array;
    evenS: Uint8Array;
    oddB: Uint8Array;
    oddS: Uint8Array;
    nh: Int8Array | undefined;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, evenB: Uint8Array, evenS: Uint8Array, oddB: Uint8Array, oddS: Uint8Array, nh: Int8Array | undefined) {
        super(height, width, data, rule);
        this.evenB = evenB;
        this.evenS = evenS;
        this.oddB = oddB;
        this.oddS = oddS;
        this.nh = nh;
    }

    runGeneration(): void {
        let range = this.rule.range;
        let height = this.height;
        let width = this.width;
        let newHeight = height + range * 2;
        let newWidth = width + range * 2;
        let newSize = newHeight * newWidth;
        let out = new Uint8Array(newSize);
        let b = this.generation % 2 === 0 ? this.evenB : this.oddB;
        let s = this.generation % 2 === 0 ? this.evenS : this.oddS;
        for (let y = -range; y < height + range; y++) {
            for (let x = -range; x < width + range; x++) {
                let count = 0;
                if (this.nh) {
                    let i = 0;
                    for (let y2 = -range; y2 <= range; y2++) {
                        for (let x2 = -range; x2 <= range; x2++) {
                            let weight = this.nh[i++];
                            if (weight > 0) {
                                let value = this.get(x + x2, y + y2);
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
                            let value = this.get(x + x2, y + y2);
                            if (value === 1) {
                                count++;
                            }
                        }
                    }
                }
                let value = this.get(x, y);
                let loc = (y + range) * newWidth + (x + range);
                if (value === 0) {
                    if (b[count]) {
                        out[loc] = 1;
                    }
                } else if (value === 1) {
                    if (s[count]) {
                        out[loc] = 1;
                    } else {
                        out[loc] = (value + 1) % this.rule.states;
                    }
                } else {
                    out[loc] = (value + 1) % this.rule.states;
                }
            }
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= range;
        this.yOffset -= range;
        this
        this.generation++;
    }

    copy(): this {
        let out = new HROTB0Pattern(this.height, this.width, this.data, this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new HROTB0Pattern(0, 0, new Uint8Array(0), this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh)  as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new HROTB0Pattern(height, width, data, this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new HROTB0Pattern(height, width, data, this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new HROTB0Pattern(height, width, data, this.rule, this.evenB, this.evenS, this.oddB, this.oddS, this.nh) as this;
    }

}


/** Parses a HROT rule. */
export function createHROTPattern(rule: string, height: number = 0, width: number = 0, data: Uint8Array = new Uint8Array(0)): string | HROTPattern | HROTB0Pattern {
    let out = rule.startsWith('R') ? parseHROTRule(rule) : parseCatagolueHROTRule(rule);
    if (typeof out === 'string') {
        return out;
    }
    let {rule: ruleData, b, s, nh} = out;
    if (b[0]) {
        if (s[s.length - 1]) {
            let temp = s;
            s = b.reverse().map(x => 1 - x);
            b = temp.reverse().map(x => 1 - x);
        } else {
            let evenB = b.map(x => 1 - x);
            let evenS = s.map(x => 1 - x);
            let oddB = s.reverse();
            let oddS = b.reverse();
            return new HROTB0Pattern(height, width, data, ruleData, evenB, evenS, oddB, oddS, nh);
        }
    }
    return new HROTPattern(height, width, data, ruleData, b, s, nh);
}
