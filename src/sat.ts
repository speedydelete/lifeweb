
/** Implements a LLS-like SAT-solver-based search program. */

import {Pattern, TRANSITIONS, VALID_TRANSITIONS, parseTransitions, PatternSymmetry, ALTERNATE_SYMMETRIES, isNode, createPattern, parseSpeed} from './core/index.js';


let nextVar = 1;

/** Performs the AND operation on CNFs. */
function and(...data: (number | number[][])[]): number[][] {
    let out: number[][] = [];
    for (let x of data) {
        if (typeof x === 'number') {
            let found = false;
            for (let y of out) {
                if (y.length === 1) {
                    if (y[0] === x) {
                        found = true;
                        break;
                    }
                }
            }
            if (!found) {
                out.push([x]);
            }
        } else {
            for (let y of x) {
                if (!out.some(z => y.length === z.length && z.every((value, i) => value === y[i]))) {
                    out.push(y);
                }
            }
        }
    }
    return out;
}

/** Performs the OR operation on CNFs. */
function or(...data: (number | number[][])[]): number[][] {
    if (data.every(x => typeof x === 'number')) {
        return [data];
    }
    let out: number[][] = [];
    let tops: number[] = [];
    for (let cnf of data) {
        if (typeof cnf === 'number') {
            cnf = [[cnf]];
        }
        let t = nextVar++;
        tops.push(t);
        for (let clause of cnf) {
            out.push([-t, ...clause]);
        }
        let vars: number[] = [];
        for (let clause of cnf) {
            let v = nextVar++;
            vars.push(v);
            out.push([-v, ...clause]);
            for (let lit of clause) {
                out.push([v, -lit]);
            }
        }
        out.push([t, ...vars.map(v => -v)]);
    }
    if (tops.length > 1) {
        let top = nextVar++;
        out.push([-top, ...tops]);
        for (let v of tops) {
            out.push([top, -v]);
        }
    }
    return out;
}

/** Performs the NOT operation on a CNF. */
function not(x: number | number[][]): number[][] {
    if (typeof x === 'number') {
        return [[-x]];
    }
    let out: number[][] = [];
    let ys: number[] = [];
    let top = nextVar++;
    for (let clause of x) {
        let y = nextVar++;
        ys.push(y);
        for (let value of clause) {
            out.push([y, value]);
        }
        out.push([-y, ...clause.map(z => -z)]);
    }
    out.push([-top, ...ys]);
    for (let y of ys) {
        out.push([top, -y]);
    }
    return out;
}

/** Performs the NAND operation on CNFs. */
function nand(...data: (number | number[][])[]): number[][] {
    return not(and(...data));
}

/** Performs the NOR operation on CNFs. */
function nor(...data: (number | number[][])[]): number[][] {
    return not(or(...data));
}

/** Performs the XOR operation on CNFs. */
function xor(...data: (number | number[][])[]): number[][] {
    return and(nand(...data), or(...data));
}

/** Performs the XNOR operation on CNFs. */
function xnor(...data: (number | number[][])[]): number[][] {
    return or(nor(...data), and(...data));
}

let foundToBeTrue = new Set<number>();

/** Simplifies a given CNF, removing duplicates and tautologies, and checking for trivial contradictions. */
function simplifyCNF(cnf: number[][]): number[][] {
    let out: number[][] = [];
    let done = new Set<string>();
    let seen = new Set<number>();
    for (let x of cnf) {
        if (x.length === 0) {
            throw new Error('Proved unsatisfiable during preprocessing! (Length-0 clause exists)');
        }
        seen.clear();
        let found = false;
        for (let y of x) {
            if (seen.has(-y)) {
                found = true;
                break;
            }
            seen.add(y);
        }
        if (!found) {
            x = Array.from(seen).sort((a, b) => a - b).filter(y => !foundToBeTrue.has(y));
            if (x.some(y => foundToBeTrue.has(-y))) {
                continue;
            }
            let key = x.join(' ');
            if (done.has(key)) {
                continue;
            } else if (x.length === 1 && done.has(String(-x[0]))) {
                throw new Error('Proved unsatisfiable during preprocessing! (Length-1 clause and its negation exist)');
            } else {
                done.add(key);
            }
            out.push(x);
        }
    }
    return out;
}


let remapping: {[key: string]: number} = {};
let foundVars: {[key: string]: number} = {};

/** Resolves a variable name, checking if it is found already. */
function resolve(value: number | string): number | string {
    return typeof value === 'string' && value in foundVars ? foundVars[value] : value;
}

/** Gets the CNF variable number for a variable name. */
function getVar(value: string): number {
    if (value in remapping) {
        return remapping[value];
    } else {
        let out = nextVar++;
        remapping[value] = out;
        return out;
    }
}

/** Set the known value of a variable name. */
function findVar(name: string, value: number): void {
    foundVars[name] = value;
    let num = getVar(name);
    foundToBeTrue.add(value ? num : -num);
}

/** Turn a single cell transition into a CNF. */
function cellToCNF(cells: (number | string)[], result: number | string, trs: (number | string)[]): number[][] {
    cells = cells.map(resolve);
    if (cells.every(x => typeof x === 'number')) {
        let tr = resolve(trs[(cells[0] << 8) | (cells[1] << 7) | (cells[2] << 6) | (cells[3] << 5) | (cells[4] << 4) | (cells[5] << 3) | (cells[6] << 2) | (cells[7] << 1) | cells[8]]);
        if (typeof result === 'number') {
            if (typeof tr === 'number') {
                if (tr !== result) {
                    throw new Error('Proved unsatisfiable during preprocessing! (Transition does not match result)');
                }
            } else {
                findVar(tr, result);
            }
            return [];
        } else {
            if (typeof tr === 'number') {
                findVar(result, tr);
                return [];
            } else {
                return xnor(getVar(result), getVar(tr));
            }
        }
    }
    let out: number[][][] = [];
    for (let i = 0; i < 512; i++) {
        let tr = trs[i];
        let vars: (number | number[][])[] = [];
        let found = false;
        for (let j = 0; j < 9; j++) {
            let cell = resolve(cells[j]);
            let value = (i & (1 << (8 - j))) > 0 ? 1 : 0;
            if (typeof cell === 'number') {
                if (cell !== value) {
                    found = true;
                    break;
                }
            } else {
                let num = getVar(cell);
                vars.push(value ? num : -num);
            }
        }
        let cnf = and(...vars);
        if (found) {
            continue;
        }
        if (typeof tr === 'number') {
            if (typeof result === 'number') {
                if (tr === result) {
                    out.push(cnf);
                }
            } else {
                let num = getVar(result);
                out.push(and(cnf, tr ? num : -num));
            }
        } else {
            if (typeof result === 'number') {
                let num = getVar(tr);
                out.push(and(cnf, result ? num : -num));
            } else {
                out.push(and(cnf, xnor(getVar(tr), getVar(result))));
            }
        }
    }
    return or(...out);
}

/** Get a CNF for parsed data. */
function getCNF(data: (number | string)[][][], trs: (number | string)[]): number[][] {
    let height = data[0].length;
    let width = data[0][0].length;
    let out: number[][][] = [];
    for (let i = 0; i < data.length - 1; i++) {
        let gen = data[i];
        let next = data[i + 1];
        if (height === 0 || width === 0) {
            continue;
        }
        if (height === 1) {
            if (width === 1) {
                out.push(cellToCNF([0, 0, 0, 0, gen[0][0], 0, 0, 0, 0], next[0][0], trs));
            } else {
                // Left cell.
                out.push(cellToCNF([0, 0, 0, 0, gen[0][0], 0, 0, gen[0][1], 0], next[0][0], trs));
                // Middle cells.
                for (let x = 1; x < width - 1; x++) {
                    out.push(cellToCNF([0, gen[0][x - 1], 0, 0, gen[0][x], 0, 0, gen[0][x + 1], 0], next[0][x], trs));
                }
                // Right cell.
                out.push(cellToCNF([0, gen[0][width - 2], 0, 0, gen[0][width - 1], 0, 0, 0, 0], next[0][width - 1], trs));
            }
        } else {
            if (width === 1) {
                // Top cell.
                out.push(cellToCNF([0, 0, 0, 0, gen[0][0], gen[1][0], 0, 0, 0], next[0][0], trs));
                // Middle cells.
                for (let y = 1; y < height - 1; y++) {
                    out.push(cellToCNF([0, 0, 0, gen[y - 1][0], gen[y][0], gen[y + 1][0], 0, 0, 0], next[y][0], trs));
                }
                // Bottom cell.
                out.push(cellToCNF([0, 0, 0, gen[height - 2][0], gen[height - 1][0], 0, 0, 0, 0], next[height - 1][0], trs));
            } else {
                // Top-left cell.
                out.push(cellToCNF([0, 0, 0, 0, gen[0][0], gen[1][0], 0, gen[0][1], gen[1][1]], next[0][0], trs));
                // Top cells.
                for (let x = 1; x < width - 1; x++) {
                    out.push(cellToCNF([0, gen[0][x - 1], gen[1][x - 1], 0, gen[0][x], gen[1][x], 0, gen[0][x + 1], gen[1][x + 1]], next[0][x], trs));
                }
                // Top-right cell.
                out.push(cellToCNF([0, gen[0][width - 2], gen[1][width - 2], 0, gen[0][width - 1], gen[1][width - 1], 0, 0, 0], next[0][width - 1], trs));
                // Left cells.
                for (let y = 1; y < height - 1; y++) {
                    out.push(cellToCNF([0, 0, 0, gen[y - 1][0], gen[y][0], gen[y + 1][0], gen[y - 1][1], gen[y][1], gen[y + 1][1]], next[y][0], trs));
                }
                // Bottom-left cell.
                out.push(cellToCNF([0, 0, 0, gen[height - 2][0], gen[height - 1][0], 0, gen[height - 2][1], gen[height - 1][1], 0], next[height - 1][0], trs));
                // Bottom cells.
                for (let x = 1; x < width - 1; x++) {
                    out.push(cellToCNF([gen[width - 2][x - 1], gen[width - 1][x - 1], 0, gen[width - 2][x], gen[width - 1][x], 0, gen[width - 2][x + 1], gen[width - 1][x + 1], 0], next[width - 1][x], trs));
                }
                // Bottom-right cell.
                out.push(cellToCNF([gen[height - 2][width - 2], gen[height - 1][width - 2], 0, gen[height - 2][width - 1], gen[height - 1][width - 1], 0, 0, 0, 0], next[height - 1][width - 1], trs));
                // Middle cells.
                for (let y = 1; y < height - 1; y++) {
                    for (let x = 1; x < width - 1; x++) {
                        out.push(cellToCNF([gen[y - 1][x - 1], gen[y][x - 1], gen[y + 1][x - 1], gen[y - 1][x], gen[y][x], gen[y + 1][x], gen[y - 1][x + 1], gen[y][x + 1], gen[y + 1][x + 1]], next[y][x], trs));
                    }
                }
            }
        }
    }
    return and(...out);
}


function _parseRule(rule: string): [string[], string[]] {
    let [b, s] = rule.split('/');
    if (!(b.startsWith('B') && s.startsWith('S'))) {
        throw new Error(`Invalid isotropic rule: '${rule}'`);
    }
    return [parseTransitions(b, VALID_TRANSITIONS), parseTransitions(s, VALID_TRANSITIONS)];
}

function parseRule(min: string, max: string): (number | string)[] {
    let [minB, minS] = _parseRule(min);
    let [maxB, maxS] = _parseRule(max);
    let out = new Array<number | string>(512);
    for (let [key, trs] of Object.entries(TRANSITIONS)) {
        let value: number | string;
        if (maxB.includes(key)) {
            if (minB.includes(key)) {
                value = 1;
            } else {
                value = 'B' + key;
            }
        } else {
            value = 0;
        }
        for (let tr of trs) {
            out[tr] = value;
        }
        if (maxS.includes(key)) {
            if (minS.includes(key)) {
                value = 1;
            } else {
                value = 'S' + key;
            }
        } else {
            value = 0;
        }
        for (let tr of trs) {
            out[tr | (1 << 4)] = value;
        }
    }
    return out;
}


function parseFile(data: string): (number | string)[][][] {
    let anyCount = 0;
    let out: (number | string)[][][] = [];
    for (let gen of data.split('\n\n')) {
        let grid: (number | string)[][] = [];
        for (let line of gen.split('\n')) {
            grid.push(line.split(/, /).map(x => {
                x = x.trim();
                if (x === '0') {
                    return 0;
                } else if (x === '1') {
                    return 1;
                } else if (x === '*' || x === '?') {
                    return '*' + (anyCount++);
                } else {
                    return x;
                }
            }));
        }
        out.push(grid);
    }
    return out;
}

export interface ShipPreset {
    type: 'ship';
    dx: number;
    dy: number;
    period: number;
    width: number;
    height: number;
    symmetry?: PatternSymmetry;
}

export type Preset = ShipPreset;

function getShipPreset(data: ShipPreset): string {
    return '';
}

function getPreset(preset: Preset): string {
    if (preset.type === 'ship') {
        return getShipPreset(preset);
    } else {
        throw new Error('Invalid preset!');
    }
}


export interface SolverArgs {
    rule: string | [string, string];
    file?: string;
    preset?: Preset;
}

let execSync: (typeof import('node:child_process'))['execSync'] | undefined = undefined;
let fs: typeof import('node:fs') | undefined = undefined;
let kissat: {
    kissat_init(): any;
    kissat_add(s: any, lit: number): void;
    kissat_solve(s: any): number;
    kissat_value(s: any, lit: number): number;
    kissat_release(s: any): void;

} | undefined = undefined;
if (isNode) {
    execSync = (await import('node:child_process')).execSync;
    fs = await import('node:fs');
} else {
    let code = await (await fetch('kissat.wasm')).arrayBuffer();
    kissat = (await WebAssembly.instantiate(code, {})).instance.exports as any;
}

let basePath = `${import.meta.dirname}/..`;

export function runSolver(args: SolverArgs, print: (data: string) => void = console.log): false | Pattern {
    if (!args.file) {
        if (!args.preset) {
            throw new Error('Either a file or a preset must be provided!');
        }
        args.file = getPreset(args.preset);
    }
    let trs = typeof args.rule === 'string' ? [args.rule, args.rule] : args.rule;
    let cnf = getCNF(parseFile(args.file), trs);
    print('Preprocessing complete, starting solver');
    let values: number[] | false;
    if (fs && execSync) {
        fs.writeFileSync(`${basePath}/data.cnf`, `p cnf ${nextVar - 1} ${cnf.length}\n${cnf.map(x => x.join(' ') + ' 0').join('\n')}`);
        let data = execSync(`${basePath}/kissat/kissat -s ${basePath}/data.cnf`).toString();
        for (let line of data.split('\n')) {

        }
    } else if (kissat) {
        let s = kissat.kissat_init();
        for (let line of cnf) {
            for (let value of line) {
                kissat.kissat_add(s, value);
            }
            kissat.kissat_add(s, 0);
        }
        let value = kissat.kissat_solve(s);
        if (value === 20) {
            values = false;
        } else {
            values = [];
            for (let i = 1; i < nextVar; i++) {
                values.push(kissat.kissat_value(s, i));
            }
        }
        kissat.kissat_release(s);
    } else {
        throw new Error('No solver (there is probably a bug)');
    }
    print('Unsatisfiable');
    return false;
}

const ARGUMENTS: {[key: string]: {desc: string, required?: boolean, aliases: string[]} & ({count: number} | {minCount: number, maxCount?: number})} = {
    '-h': {
        desc: 'Shows a help message',
        count: 0,
        aliases: ['--help'],
    },
    '-r': {
        desc: 'The rule to run the search in (required). If 2 arguments are provided, they will be treated as minimum and maximum rules.',
        required: true,
        minCount: 1,
        maxCount: 2,
        aliases: ['--rule'],
    },
    '-f': {
        desc: 'The file path to use. Incompatible with -l.',
        count: 1,
        aliases: ['--file'],
    },
    '-l': {
        desc: 'A literal data file. Incompatible with -f.',
        count: 1,
        aliases: ['--literal'],
    },
    '-s': {
        desc: 'Search for a spaceship by generating a preset. Arguments must be speed (such as c/2o), height, and width. An additional symmetry argument can also be provided.',
        minCount: 3,
        maxCount: 4,
        aliases: ['--ship', '--spaceship'],
    },
};

const ALIASES = Object.fromEntries(Object.entries(ARGUMENTS).flatMap(([key, value]) => value.aliases.map(x => [x, key])));

function parseArgs(argv: string[], print: (data: string) => void = console.log): SolverArgs | undefined {
    let args: {[key: string]: string[]} = {};
    let currentArg = '';
    let current: string[] = [];
    for (let arg of argv) {
        if (arg.startsWith('-')) {
            if (currentArg !== '') {
                args[currentArg] = current;
                current = [];
            }
            if (!(arg in ARGUMENTS || arg in ALIASES)) {
                throw new Error(`Invalid argument: ${arg}`);
            }
            if (arg in ALIASES) {
                arg = ALIASES[arg];
            }
            currentArg = arg;
        } else if (currentArg === '') {
            throw new Error('No positional arguments are allowed');
        } else {
            current.push(arg);
        }
    }
    if (currentArg !== '') {
        args[currentArg] = current;
        current = [];
    }
    for (let key in args) {
        if (!(key in ARGUMENTS)) {
            throw new Error(`Invalid argument: '${key}'`);
        }
        let data = ARGUMENTS[key];
        if ('count' in data) {
            if (data.count !== args[key].length) {
                throw new Error(`${key} argument requires ${data.count} values`);
            }
        } else {
            if (data.minCount > args[key].length) {
                if (data.maxCount) {
                    throw new Error(`${key} argument requires between ${data.minCount} and ${data.maxCount} values`);
                } else {
                    throw new Error(`${key} argument requires at least ${data.minCount} values`);
                }
            } else if (data.maxCount && args[key].length > data.maxCount) {
                throw new Error(`${key} argument requires between ${data.minCount} and ${data.maxCount} values`);
            }
        }
    }
    for (let [key, value] of Object.entries(ARGUMENTS)) {
        if (value.required) {
            if (!(key in args)) {
                throw new Error(`${key} argument is required`);
            }
        }
    }
    if ('-h' in args) {
        let msg = `\nSAT-solver-based cellular automata search program similar to LLS.\n\nArguments:`;
        for (let [key, value] of Object.entries(ARGUMENTS)) {
            msg += `\n\n    ${key}, ${value.aliases.join(', ')}: ${value.desc}`;
        }
        msg += '\n';
        print(msg);
    }
    let out: SolverArgs = {rule: args['-r'].length === 2 ? args['-r'] as [string, string] : args['-r'][0]};
    if ('-f' in args) {
        if ('-l' in args) {
            throw new Error('-f and -l arguments cannot both be provided!');
        }
        if (!fs) {
            throw new Error('-f argument is not allowed in browsers');
        }
        out.file = fs.readFileSync(args['-f'][0]).toString();
    }
    if ('-s' in args) {
        let {dx, dy, period} = parseSpeed(args['-s'][0]);
        out.preset = {
            type: 'ship',
            dx,
            dy,
            period,
            height: parseInt(args['-s'][1]),
            width: parseInt(args['-s'][2]),
            symmetry: args['-s'][3] as PatternSymmetry | undefined,
        };
    }
    return out;
}

if (isNode && import.meta.main) {
    let out = parseArgs(process.argv.slice(1));
    if (out) {
        runSolver(out);
    }
}


/*

Ac = circular acceleration
F_c = F_net = centripetal force
T = period

Ac = v^2 / R
F_c = m * v^2 / R
v = 2 * pi * R / T

0.005 kg, 1.5 s, 0.14 m

b. 0.59 m/s
c. 
d. 

*/
