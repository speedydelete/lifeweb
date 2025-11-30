
import {CoordPattern, RuleError, RuleSymmetry} from './pattern.js';


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
        throw new RuleError(`Invalid HROT range: ${start}`);
    }
    let out: number[] = [];
    for (let i = start; i <= end; i++) {
        out.push(i);
    }
    return out;
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
                b.push(...parseRange(section.slice(1)));
            } else {
                s.push(...parseRange(section));
            }
        } else if (bFound) {
            if (section[0] === 'N') {
                n = section.slice(1);
                break;
            } else {
                b.push(...parseRange(section.slice(1)));
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

export function parseHROTRule(rule: string): string | {range: number, b: Uint8Array, s: Uint8Array, nh: number[] | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry} {
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
        if (!Array.from(digits).every(x => '0123456789abcdefABCDEF'.includes(x)) || !(n.length === size**2 || n.length === size**2 * 2)) {
            throw new RuleError(`Weighted neighborhood requires ${size**2} or ${size**2 * 2} hex digits for range ${r}`);
        }
        n2 = [];
        let isBig = n.length === size**2 * 2;
        let i = 0;
        for (let y = 0; y <= size; y++) {
            let row: number[] = [];
            for (let x = 0; x <= size; x++) {
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
    let ruleStr = `R${r},C${c},S${s.join(',')},B${b.join(',')}`;
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
    let outB = new Uint8Array(b.length === 0 ? 0 : Math.max(...b) + 1);
    for (let value of b) {
        outB[value] = 1;
    }
    let outS = new Uint8Array(s.length === 0 ? 0 : Math.max(...s) + 1);
    for (let value of s) {
        outS[value] = 1;
    }
    return {range: r, b: outB, s: outS, nh: n2 ? n2.flat() : n2, states: c, ruleStr, ruleSymmetry: n2 === null ? 'D8' : 'C1'};
}

export const HEX_CHARS = '0123456789abcdef';

export function parseCatagolueHROTRule(rule: string): string | {range: number, b: Uint8Array, s: Uint8Array, nh: number[] | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry} {
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

    range: number;
    b: Uint8Array;
    s: Uint8Array;
    nh: number[] | null;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;

    constructor(coords: [number, number, number][], range: number, b: Uint8Array, s: Uint8Array, nh: number[] | null, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(coords);
        this.range = range;
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
        minX -= range;
        maxX += range;
        minY -= range;
        maxY += range;
        let out: [number, number, number][] = [];
        for (let y = minY; y < maxY + 1; y++) {
            for (let x = minX; x < maxX + 1; x++) {
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
                if (value === 0) {
                    if (this.b[count]) {
                        console.log(x, y);
                        out.push([x, y, 1]);
                    }
                } else if (value === 1) {
                    if (this.s[count]) {
                        out.push([x, y, 1]);
                    } else {
                        let newValue = (value + 1) % this.states;
                        if (newValue !== 0) {
                            out.push([x, y, newValue]);
                        }
                    }
                } else {
                    let newValue = (value + 1) % this.states;
                    if (newValue !== 0) {
                        out.push([x, y, newValue]);
                    }
                }
            }
        }
        this.generation++;
        this.coords = out;
    }

    copy(): HROTPattern {
        return new HROTPattern(this.coords.slice(), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): HROTPattern {
        return new HROTPattern(this.coords.filter(point => point[0] >= x && point[0] < x + width && point[1] > y && point[1] < y + height), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

    clearedCopy(): HROTPattern {
        return new HROTPattern([], this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): HROTPattern {
        return new HROTPattern(this._loadApgcode(code), this.range, this.b, this.s, this.nh, this.states, this.ruleStr, this.ruleSymmetry);
    }

}
