
import {RuleError, Runner} from './pattern.js';
import {run1d, run1dGenerations, parse1dRule} from './1d.js';
import {runHROT, runHROTGenerations} from './hrot.js';


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
    for (let i = start; i < end; i++) {
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
                s.push(...parseRange(section.slice(1)));
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
    X(x, y, r) {
        return (x === y || x === -y) && !(x === 0 && y === 0) ? 1 : 0;
    },
    '*'(x, y, r) {
        return (x === 0 || y === 0 || x === y || x === -y) && !(x === 0 && y === 0) ? 1 : 0;
    },
    '#'(x, y, r) {
        return (x === r - 1 || y === r - 1 || x === r + 1 || y === r + 1) ? 1 : 0;
    },
    G(x, y, r) {
        return x === 0 && y === 0 ? 0 : Math.abs(x * y);
    }
};

export function parseHROTRule(rule: string): string | {func: Runner, extra: Uint8Array, states: number, isotropic: boolean} {
    let {r, c, m, s, b, n, w} = parseSections(rule);
    if (w !== null) {
        let extra = parse1dRule(r, w);
        let func = c === 2 ? run1d : run1dGenerations;
        return {func, extra, states: c, isotropic: true}
    }
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
                if (isBig) {
                    row.push(parseInt(digits[i]), 4);
                } else {
                    row.push(parseInt(digits[i]), 16);
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
    let func = c === 2 ? runHROT : runHROTGenerations;
    let out: number[] = [r, c];
    if (Array.isArray(n)) {
        out.push(1, ...n);
    } else {
        out.push(0);
    }
    for (let x of [s, b]) {
        out.push(Math.floor(x.length / 256), x.length % 256);
        if (x.some(y => y > 255)) {
            out.push(1);
            for (let y of x) {
                out.push(Math.floor(y / 256), y % 256);
            }
        } else {
            out.push(0, ...x);
        }
    }
    return {func, extra: new Uint8Array(out), states: c, isotropic: true};
}
