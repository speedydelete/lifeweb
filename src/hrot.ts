
import {CoordPattern, RuleError, RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH} from './pattern.js';


function parseRange(data: string): number[] {
    let start = parseInt(data);
    let end = start;
    let index = data.indexOf('-');
    if (index !== -1) {
        end = parseInt(data.slice(index + 1));
    } else {
        index = data.indexOf('..');
        if (index !== -1) {
            end = parseInt(data.slice(index + 1));
        }
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
                b.push(...parseRange(section.slice(1)));
            } else {
                s.push(...parseRange(section));
            }
        } else if (bFound) {
            if (section[0] === 'N') {
                n = section.slice(1);
                break;
            } else {
                b.push(...parseRange(section));
            }
        } else if (section[0] === 'R') {
            r = parseInt(section.slice(1));
        } else if (section[0] === 'C') {
            c = parseInt(section.slice(1));
        } else if (section[0] === 'S') {
            sFound = true;
            s.push(...parseRange(section.slice(1)));
        } else if (section[0] === 'M') {
            m = parseInt(section.slice(1)) === 0 ? false : true;
        } else if (section[0] === 'W') {
            w = parseInt(section.slice(1));
        } else {
            throw new RuleError(`Invalid HROT section: '${section}'`);
        }
    }
    return {r, c, m, s, b, n, w};
}


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

export function parseHROTRule(rule: string): string | {range: number, b: Uint8Array, s: Uint8Array, nh: Int8Array | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry} {
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
    let n2: number[][] | null;
    if (n === 'M') {
        n2 = null;
    } else if (n in NEIGHBORHOODS) {
        let func = NEIGHBORHOODS[n];
        n2 = [];
        for (let y = -r; y <= r; y++) {
            let row: number[] = [];
            for (let x = -r; x <= r; x++) {
                row.push(func(x, y, r) ? 1 : 0);
            }
            n2.push(row);
        }
    } else if (n.startsWith('@')) {
        n2 = [];
    } else if (n.startsWith('W')) {
        let digits = n.slice(1);
        if (!Array.from(digits).every(x => '0123456789abcdefABCDEF'.includes(x)) || !(digits.length === size**2 || digits.length === size**2 * 2)) {
            throw new RuleError(`Weighted neighborhood requires ${size**2} or ${size**2 * 2} hex digits for range ${r}`);
        }
        n2 = [];
        let isBig = n.length === size**2 * 2;
        let i = 0;
        for (let y = 0; y < size; y++) {
            let row: number[] = [];
            for (let x = 0; x < size; x++) {
                let value = parseInt(digits[i]);
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
            n2.push(row);
        }
    } else {
        throw new RuleError(`Invalid HROT neighborhood: '${n}'`);
    }
    if (m) {
        if (n2 === null) {
            s = s.map(x => x + 1);
        } else {
            n2[r + 1][r + 1] = 1;
        }
    }
    let length = (n2 ? n2.flat().reduce((x, y) => x + y) : (2*r + 1)**2 - 1) + 1;
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
    return {range: r, b: outB, s: outS, nh: n2 ? new Int8Array(n2.flat()) : null, states: c, ruleStr, ruleSymmetry: n2 === null ? 'D8' : 'C1'};
}

export const HEX_CHARS = '0123456789abcdef';

export function parseCatagolueHROTRule(rule: string): string | {range: number, b: Uint8Array, s: Uint8Array, nh: Int8Array | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry} {
    let states = 2;
    if (rule.startsWith('x')) {
        rule = rule.slice(1);
    }
    if (rule.startsWith('g')) {
        states = parseInt(rule.slice(1));
        rule = rule.slice(rule.indexOf('r'));
    }
    let r = parseInt(rule.slice(1));
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


export class HROTPattern extends CoordPattern {

    b: Uint8Array;
    s: Uint8Array;
    nh: Int8Array | null;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(coords: Map<number, number>, range: number, b: Uint8Array, s: Uint8Array, nh: Int8Array | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(coords, range);
        this.b = b;
        this.s = s;
        this.nh = nh;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        let range = this.range;
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
                        let newValue = (value + 1) % this.states;
                        if (newValue !== 0) {
                            out.set(key, newValue);
                        }
                    }
                } else {
                    let newValue = (value + 1) % this.states;
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
        let out = new HROTPattern(new Map(this.coords), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
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
        let p = new HROTPattern(out, this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): HROTPattern {
        return new HROTPattern(new Map(), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): HROTPattern {
        return new HROTPattern(this._loadApgcode(code), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

}


export class HROTB0Pattern extends CoordPattern {

    evenB: Uint8Array;
    evenS: Uint8Array;
    oddB: Uint8Array;
    oddS: Uint8Array;
    nh: Int8Array | null;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 2 = 2;

    constructor(coords: Map<number, number>, range: number, evenB: Uint8Array, evenS: Uint8Array, oddB: Uint8Array, oddS: Uint8Array, nh: Int8Array | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(coords, range);
        this.evenB = evenB;
        this.evenS = evenS;
        this.oddB = oddB;
        this.oddS = oddS;
        this.nh = nh;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        let range = this.range;
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
                        if (this.generation === 1) {
                            if (x - BIAS === 0 && y - BIAS === 0) {
                                alert(count);
                            }
                            // @ts-ignore
                            document.getElementById('out').textContent += (x - BIAS) + ' ' + (y - BIAS) + '\n';
                        }
                        out.set(key, 1);
                    }
                } else if (value === 1) {
                    if (s[count]) {
                        out.set(key, 1);
                    } else {
                        let newValue = (value + 1) % this.states;
                        if (newValue !== 0) {
                            out.set(key, newValue);
                        }
                    }
                } else {
                    let newValue = (value + 1) % this.states;
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
        let out = new HROTB0Pattern(new Map(this.coords), this.range, this.evenB, this.evenS, this.oddB, this.oddS, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
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
        let p = new HROTB0Pattern(out, this.range, this.evenB, this.evenS, this.oddB, this.oddS, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): HROTB0Pattern {
        return new HROTB0Pattern(new Map(), this.range, this.evenB, this.evenS, this.oddB, this.oddS, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): HROTB0Pattern {
        return new HROTB0Pattern(this._loadApgcode(code), this.range, this.evenB, this.evenS, this.oddB, this.oddS, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

}