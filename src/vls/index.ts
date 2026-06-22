
import {MAPPattern, SuperPattern, parseSpeed, createPattern} from '../core/index.js';


function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls --help for help`);
    process.exit(1);
}

const HELP = `
Usage: ./search <rule> <mode> <options>
Or, for multi-rule searching: ./search <minrule> <maxrule> <mode> <options>

Run a search for something in a cellular automaton.
If you don't know what this means, see https://conwaylife.com/.

Modes:

    periodic <speed> <height> <width>
        search for a periodic object of a speed
        speed can be like "p2", "c/2o", or "(2, 1)c/6".

    parent <pattern> <height> <width> [x-offset] [y-offset]
        find height x width parents of the given pattern

    file <path>
        take in a LLS input file and try to find solutions

    catalyst <start> <gens>
        find a stable catalyst that completes the given partial
        and recovers in or less than the given generations value
        or if end is provided, find one that creates end
        start and end are LifeHistory RLEs
        for the start:
            state 0 (black) - dead
            state 1 (green) - alive
            state 2 (blue) - catalyst goes here
            state 3 (white) - can die but must be alive at the end
            state 4 (red) - must stay dead the whole time
            state 5 (yellow) - must stay alive the whole time
            state 6 (gray) - unused
        if end is not provided it will report all solutions
        that lead to the state 3 and 5 cells being restored
        the catalyst can only start interacting at generation 2

Options:

    -h, --help: show this help message

    -d, --debug <level>: set the debug level

    --interval <seconds>: set the progress reporting interval

    -g, --gdb: run gdb instead and compile with debugging symbols
    --profile: compile with profiling symbols

    --benchmark <iterations>: run benchmarking

    -l, --lls <file>: instead of searching, run LLS on the given file
        must be an executable or a directory containing
        an executable called "lls" or "lss"

    -o, --search-order <order>:
        Set the order in which cells are checked
        defined as a comma-separated list of metrics
        later metrics are tiebreakers for earlier metrics
        metrics can be any valid expression that it understands
        it knows about +, -, *, /, and ^ (exponentiation)
        also it supports unary + and - and parentheses
        also you can use | for unary absolute value like |(x - 2)
        also you can use aliases like f2b, b2f, s2s, etc
        the default value is f2b for spaceships and 't, y, x' otherwise

    -i, --initial-value <value>:
        set the initial value of unknown cells, default 0

    -n, --max-solutions: set the maximum solution count, default infinity
    --no-show-solutions: Disable showing solutions at all.

    -p, --pattern [[<gen>=]<rle>...]:
        set generation n to the given RLE (variadic)
        if no generation given, sets generation 0
        (and if periodic mode, also set the last generation with translation)

    -f, --filter [<gen>=<rle>...]:
        filter generation n by the given RLE (variadic)
        input is a LifeHistory RLE:
            state 3 (white) - must be on
            state 4 (red) - must be off
            all other states - can be anything

    -r, --restrict [[<gen>=]<rle>...]:
        restricts generation n to the given RLE mask (variadic)
        if no generation given, restricts generation 0
        (and if periodic mode, also restrict the last generation
        (with translation))

    --top <type>
    --bottom <type>
    --left <type>
    --right <type>
        set edge behavior, can either be 'none', 'even', 'odd', or 'wrap'

    -s <symmetry>, --symmetry <symmetry>
        set a symmetry to be applied to the pattern
        alias for some combination of --top, --bottom, --left, and --right
        valid values:

            D2_-1, D2_-2, D2_|1, D2_|2, D4_+1, D4_-2, D4_|2, D4_+4:
                D4_-2 is top/bottom even, left/right odd
                D4_|2 is top/bottom odd, left/right even
                also halves the width/height if it is reflected over that axis

            wick_-1, wick_-2, wick_|1, wick_|2:
            wave_-1, wave_-2, wave_|1, wave_|2:
                like D2, but applied to both sides, so it will look for wicks
                wave is just an alias for wick

            agar:
                wraps around all 4 sides, so it will look for agars

    --maxpop <cells>: Set the maximum population during the search.
`;

type OptionValue = true | 'string' | 'number' | Set<string> | readonly ('string' | 'number' | Set<string>)[] | [true, 'string' | 'number' | Set<string>];

const OPTIONS = {
    'help': true,
    'debug': 'number',
    'interval': 'number',
    'gdb': true,
    'profile': true,
    'benchmark': 'string',
    'lls': 'string',
    'search-order': 'string',
    'initial-value': 'number',
    'max-solutions': 'number',
    'no-show-solutions': true,
    'pattern': [true, 'string'],
    'filter': [true, 'string'],
    'restrict': [true, 'string'],
    'top': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'bottom': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'left': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'right': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'symmetry': new Set([
        'D2_-1', 'D2_-2', 'D2_|1', 'D2_|2', 'D4_+1', 'D4_-2', 'D4_|2', 'D4_+4',
        'wick_-1', 'wick_-2', 'wick_|1', 'wick_|2', 'wave_-1', 'wave_-2', 'wave_|1', 'wave_|2',
        'agar',
    ] as const),
    'maxpop': 'number',
} as const satisfies {[key: string]: OptionValue};

type Options = typeof OPTIONS;
type Option = keyof Options;

const OPTION_ALIASES: {[key: string]: Option} = {
    'h': 'help',
    'd': 'debug',
    'g': 'gdb',
    'l': 'lls',
    'o': 'search-order',
    'i': 'initial-value',
    'n': 'max-solutions',
    'p': 'pattern',
    'f': 'filter',
    'r': 'restrict',
    's': 'symmetry',
};

type ValueOfArrayOption<T extends readonly ('string' | 'number' | Set<string>)[]> =
    T extends [infer U] ? (
        U extends 'string' ? [string] :
        U extends 'number' ? [number] :
        U extends Set<infer T> ? [T] :
        never
    ) :
    T extends readonly [infer First extends 'string' | 'number' | Set<string>, ...(infer Rest extends readonly ('string' | 'number' | Set<string>)[])] ? [ValueOfOption<First>, ...ValueOfArrayOption<Rest>] :
    never

type ValueOfOption<T extends OptionValue> =
    T extends true ? true :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends Set<infer T> ? T :
    T extends [true, infer T extends 'string' | 'number' | Set<string>] ? ValueOfOption<T>[] :
    T extends readonly ('string' | 'number' | Set<string>)[] ? ValueOfArrayOption<T> :
    never;

export type OptionData = {[K in Option]?: ValueOfOption<Options[K]>};


export async function transformCode(argv: string[], code: string): Promise<[OptionData, string]> {


let posArgs: string[] = [];
let options: OptionData = {};

function getOption(originalArg: string, value: OptionValue, i: number): [OptionData[Option], number] {
    if (value === true) {
        return [true, i];
    } else if (value === 'string') {
        if (i === argv.length - 1) {
            error(`Expected argument for option '${originalArg}'`);
        }
        let arg = argv[++i];
        return [arg, i];
    } else if (value === 'number') {
        if (i === argv.length - 1) {
            error(`Expected argument for option '${originalArg}'`);
        }
        let arg = argv[++i];
        let num = parseFloat(arg);
        if (Number.isNaN(num)) {
            error(`Expected numeric argument for option '${originalArg}'`);
        }
        return [num, i];
    } else if (value instanceof Set) {
        if (i === argv.length - 1) {
            error(`Expected argument for option '${originalArg}'`);
        }
        let arg = argv[++i];
        let valid = Array.from(value) as string[];
        if (!valid.includes(arg)) {
            let expected = '';
            for (let i = 0; i < valid.length - 1; i++) {
                expected += valid[i] + ', ';
            }
            expected += 'or ' + valid[valid.length - 1];
            error(`Invalid option for argument '${originalArg}': '${arg}', expected ${expected}`);
        }
        return [arg, i];
    } else if (value[0] === true) {
        let out: (string | number)[] = [];
        while (i < argv.length - 1) {
            if (argv[i + 1].startsWith('-')) {
                break;
            }
            let data = getOption(originalArg, value[1], i);
            if (typeof data[0] !== 'string' && typeof data[0] !== 'number') {
                throw new Error(`Invalid argument specification detected for argument '${originalArg}'`);
            }
            out.push(data[0]);
            i = data[1];
        }
        return [out as OptionData[Option], i];
    } else {
        let out: (string | number)[] = [];
        for (let j = 0; j < value.length; j++) {
            let data = getOption(originalArg, value[j], i);
            if (typeof data[0] !== 'string' && typeof data[0] !== 'number') {
                throw new Error(`Invalid argument specification detected for argument '${originalArg}'`);
            }
            out.push(data[0]);
            i = data[1];
        }
        return [out as OptionData[Option], i];
    }
}

for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (arg.match(/^-[-a-zA-Z]/)) {
        arg = arg.toLowerCase();
        let originalArg = arg;
        while (arg.startsWith('-')) {
            arg = arg.slice(1);
        }
        if (arg in OPTION_ALIASES) {
            arg = OPTION_ALIASES[arg];
        }
        if (!(arg in OPTIONS)) {
            error(`Unrecognized option: '${arg}'`);
        }
        let option = arg as Option;
        let value = OPTIONS[option];
        let data = getOption(originalArg, value, i);
        if (Array.isArray(value) && Array.isArray(options[option])) {
            if (Array.isArray(data[0])) {
                (options[option] as any[]).push(...data[0]);
            } else {
                (options[option] as any[]).push(data[0]);
            }
        } else {
            (options[option] as any) = data[0];
        }
        i = data[1];
    } else {
        posArgs.push(arg);
    }
}

if (options['help']) {
    console.log(HELP);
    process.exit(0);
}


if (posArgs.length === 0) {
    error(`Expected at least 2 positional arguments`);
}

const MODES = ['periodic', 'parent', 'file', 'catalyst'];

let rule = posArgs[0];
let base = createPattern(rule);
if (!(base instanceof MAPPattern)) {
    error(`Rule must be a non-B0 INT rule`);
}
let superBase = createPattern(rule + 'Super') as SuperPattern;
let mode = posArgs[1];
posArgs = posArgs.slice(2);
let multiRule = false;
let maxRule = rule;
let maxBase = base;
if (!MODES.includes(mode)) {
    multiRule = true;
    maxRule = mode;
    mode = posArgs[0];
    posArgs = posArgs.slice(1);
    maxBase = createPattern(maxRule) as MAPPattern;
    if (!(maxBase instanceof MAPPattern)) {
        error(`Rule must be a non-B0 INT rule`);
    }
}


const UNKNOWN = 2;

type Edge = 'none' | 'even' | 'odd' | 'wrap';


class Grid {

    height: number;
    width: number;
    gens: number;
    size: number;
    data: number[][][];
    numVars: number = 0;

    constructor(height: number, width: number, gens: number) {
        this.height = height;
        this.width = width;
        this.gens = gens;
        this.size = height * width;
        this.data = [];
        for (let t = 0; t < gens; t++) {
            let grid: number[][] = [];
            for (let y = 0; y < height; y++) {
                let row: number[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(0);
                }
                grid.push(row);
            }
            this.data.push(grid);
        }
    }

    toString(top: Edge, bottom: Edge, left: Edge, right: Edge): string {
        let emptyRow: number[] = [];
        let realWidth = this.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1);
        for (let x = 0; x < realWidth; x++) {
            emptyRow.push(0);
        }
        let out: number[][][] = [];
        for (let t = 0; t < this.gens; t++) {
            let grid: number[][] = [];
            for (let y = 0; y < this.height; y++) {
                let row: number[] = [];
                if (left === 'none') {
                    row.push(0, 0);
                } else if (left === 'even') {
                    row.push(this.data[t][y][0]);
                } else if (left === 'odd') {
                    row.push(this.data[t][y][1]);
                } else {
                    row.push(this.data[t][y][this.width - 1]);
                }
                for (let x = 0; x < this.width; x++) {
                    row.push(this.data[t][y][x]);
                }
                if (right === 'none') {
                    row.push(0, 0);
                } else if (right === 'even') {
                    row.push(this.data[t][y][this.width - 1]);
                } else if (right === 'odd') {
                    row.push(this.data[t][y][this.width - 2]);
                } else {
                    row.push(this.data[t][y][0]);
                }
                grid.push(row);
            }
            let toInsertBefore: number[][] = [];
            if (top === 'none') {
                toInsertBefore = [emptyRow, emptyRow];
            } else if (top === 'wrap') {
                toInsertBefore = [grid[grid.length - 1]];
            } else {
                let row = (top === 'even' ? grid[0] : grid[1]).slice();
                if (left === 'even') {
                    row[0] = row[1];
                } else if (left === 'odd') {
                    row[0] = row[2];
                }
                if (right === 'even') {
                    row[realWidth - 1] = row[realWidth - 2];
                } else if (right === 'odd') {
                    row[realWidth - 1] = row[realWidth - 3];
                }
                toInsertBefore = [row];
            }
            if (bottom === 'none') {
                grid.push(emptyRow, emptyRow);
            } else if (bottom === 'wrap') {
                grid.push(grid[0]);
            } else {
                let row = (bottom === 'even' ? grid[this.height - 1] : grid[this.height - 2]).slice();
                if (left === 'even') {
                    row[0] = row[1];
                } else if (left === 'odd') {
                    row[0] = row[2];
                }
                if (right === 'even') {
                    row[realWidth - 1] = row[realWidth - 2];
                } else if (right === 'odd') {
                    row[realWidth - 1] = row[realWidth - 3];
                }
                grid.push(row);
            }
            grid.unshift(...toInsertBefore);
            out.push(grid);
        }
        return `{${out.map(grid => `{${grid.map(row => `{${row.join(', ')}}`).join(', ')}}`).join(', ')}}`;
    }

    get(t: number, x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.data[t][y][x];
    }

    set(t: number, x: number, y: number, value: number): void {
        this.data[t][y][x] = value;
    }

    fill(value: number): void;
    fill(t: number, value: number): void;
    fill(t: number, x: number, value: number): void;
    fill(t: number, x: number, y: number, value: number): void;
    fill(inputT: number | undefined, inputX?: number, inputY?: number, value?: number): void {
        if (value === undefined) {
            if (inputX === undefined) {
                if (inputT === undefined) {
                    throw new TypeError(`Grid.prototype.fill called with 0 arguments`);
                }
                value = inputT;
                inputT = undefined;
            } else if (inputY === undefined) {
                value = inputX;
                inputX = undefined;
            } else {
                value = inputY;
                inputY = undefined;
            }
        }
        for (let t = 0; t < this.gens; t++) {
            if (inputT !== undefined && t !== inputT) {
                continue;
            }
            for (let y = 0; y < this.height; y++) {
                if (inputY !== undefined && y !== inputY) {
                    continue;
                }
                for (let x = 0; x < this.width; x++) {
                    if (inputX !== undefined && x !== inputX) {
                        continue;
                    }
                    this.data[t][y][x] = value;
                }
            }
        }
    }

    getVar(): number {
        this.numVars++;
        return 2 + this.numVars * 4;
    }

    removeUnusedVars(): void {
        this.numVars = 0;
        let mapping: {[key: number]: number} = {};
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let value = this.data[t][y][x];
                    if (value > 3) {
                        if (value in mapping) {
                            value = mapping[value];
                        } else {
                            let mapped = this.getVar();
                            mapping[value] = mapped;
                            value = mapped;
                        }
                        this.data[t][y][x] = value;
                    }
                }
            }
        }
    }

    shrinkHeight(height: number, mode: 'before' | 'after'): void {
        this.height = height;
        for (let t = 0; t < this.gens; t++) {
            this.data[t] = mode === 'before' ? this.data[t].slice(0, height) : this.data[t].slice(height);
        }
        this.removeUnusedVars();
    }

    shrinkWidth(width: number, mode: 'before' | 'after'): void {
        this.width = width;
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.data[t][y] = mode === 'before' ? this.data[t][y].slice(0, width) : this.data[t][y].slice(width);
            }
        }
        this.removeUnusedVars();
    }

    restrict(t: number, rle: string, xOffset: number, yOffset: number) {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (p.get(x, y) === 0) {
                    this.set(t, x, y, 0);
                }
            }
        }
    }

    setFrom(t: number, rle: string, xOffset: number, yOffset: number) {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, y, p.get(x, y));
            }
        }
    }

}


let grid: Grid;

let defaultSearchOrder = 't, y, x';
let searchOrderAliases: {[key: string]: string} = {};

let timeWrap: false | [number, number] = false;

if (mode === 'periodic') {

    if (posArgs.length !== 3) {
        error(`Expected 3 positional arguments for periodic mode`);
    }
    let {dx, dy, period} = parseSpeed(posArgs[0]);
    let height = parseInt(posArgs[1]);
    let width = parseInt(posArgs[2]);
    if (Number.isNaN(height)) {
        error(`Invalid height: '${posArgs[1]}'`);
    }
    if (Number.isNaN(width)) {
        error(`Invalid width: '${posArgs[2]}'`);
    }

    if (dx !== 0 || dy !== 0) {
        defaultSearchOrder = 'f2b';
        let mainAxis: string;
        let sideAxis: string;
        if (dx < 0) {
            if (dy < 0) {
                mainAxis = 'x+y';
                sideAxis = 'x-y';
            } else if (dy === 0) {
                mainAxis = 'x';
                sideAxis = 'y';
            } else {
                mainAxis = 'y-x';
                sideAxis = 'x+y';
            }
        } else if (dx === 0) {
            if (dy < 0) {
                mainAxis = 'y';
                sideAxis = 'x';
            } else {
                mainAxis = '-y';
                sideAxis = 'x';
            }
        } else {
            if (dy < 0) {
                mainAxis = 'x-y';
                sideAxis = 'x+y';
            } else if (dy === 0) {
                mainAxis = `-x`;
                sideAxis = 'y';
            } else {
                mainAxis = '-x-y';
                sideAxis = 'x-y';
            }
        }
        searchOrderAliases['f2b'] = `t, ${mainAxis}, ${sideAxis}`;
        searchOrderAliases['b2f'] = `t, -${mainAxis}, ${sideAxis}`;
        searchOrderAliases['s2s'] = `t, ${sideAxis}, ${mainAxis}`;
    }

    // grid = new Grid(height, width, period + 1);
    // for (let y = 0; y < height - dy; y++) {
    //     for (let x = 0; x < width - dx; x++) {
    //         let value = grid.getVar();
    //         grid.set(0, x, y, value);
    //         grid.set(period, x + dx, y + dy, value);
    //     }
    // }
    // for (let t = 1; t < period; t++) {
    //     grid.fill(t, UNKNOWN);
    // }

    grid = new Grid(height, width, period);
    for (let y = 0; y < height - dy; y++) {
        for (let x = 0; x < width - dx; x++) {
            grid.set(0, x, y, UNKNOWN);
        }
    }
    for (let t = 1; t < grid.gens; t++) {
        grid.fill(t, UNKNOWN);
    }
    timeWrap = [dx, dy];

    if (options['pattern']) {
        for (let value of options['pattern']) {
            if (!value.includes('=')) {
                grid.setFrom(grid.gens - 1, value, dx, dy);
            }
        }
    }
    if (options['restrict']) {
        for (let value of options['restrict']) {
            if (!value.includes('=')) {
                grid.restrict(grid.gens - 1, value, dx, dy);
            }
        }
    }

} else if (mode === 'parent') {

    let p = base.loadRLE(posArgs[0]).shrinkToFit();
    let height = p.height + 2;
    let width = p.width + 2;
    let xOffset = 1;
    let yOffset = 1;
    // let height = parseInt(posArgs[1]);
    // let width = parseInt(posArgs[2]);
    // if (Number.isNaN(height)) {
    //     error(`Invalid height: '${posArgs[1]}'`);
    // }
    // if (Number.isNaN(width)) {
    //     error(`Invalid width: '${posArgs[2]}'`);
    // }
    // let xOffset = parseInt(posArgs[3]);
    // if (Number.isNaN(xOffset)) {
    //     xOffset = 0;
    // }
    // let yOffset = parseInt(posArgs[4]);
    // if (Number.isNaN(yOffset)) {
    //     yOffset = 0;
    // }
    grid = new Grid(height, width, 2);
    grid.fill(0, UNKNOWN);
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            grid.set(1, x + xOffset, y + yOffset, p.get(x, y));
        }
    }

} else if (mode === 'file') {

    let fs = await import('node:fs/promises');
    let file = (await fs.readFile(posArgs[0])).toString();
    let data: (string | number)[][][] = [];
    let currentSection: (string | number)[][] = [];
    for (let line of file.split('\n')) {
        line = line.replaceAll(/\s+/g, '');
        let parts = line.split(',').filter(x => x.length > 0).map(x => x.match(/^\d+$/) ? Number(x) : x);
        if (parts.length === 0) {
            if (currentSection.length > 0) {
                data.push(currentSection);
                currentSection = [];
            }
        } else {
            currentSection.push(parts);
        }
    }
    if (currentSection.length > 0) {
        data.push(currentSection);
    }
    let height = data[0].length;
    if (!data.every(x => x.length === height)) {
        error(`Heights of all phases must match`);
    }
    let width = data[0][0].length;
    if (!data.every(x => x.every(y => y.length === width))) {
        error(`Widths of all phases must match`);
    }
    grid = new Grid(height, width, data.length);
    let vars: {[key: string]: number} = {};
    for (let t = 0; t < data.length; t++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = data[t][y][x];
                if (typeof value === 'string') {
                    if (value === '*') {
                        value = 2;
                    } else if (value in vars) {
                        value = vars[value];
                    } else {
                        let newVar = grid.getVar();
                        vars[value] = newVar;
                        value = newVar;
                    }
                }
                grid.set(t, x, y, value);
            }
        }
    }

} else if (mode === 'catalyst') {

    let startP = superBase.loadRLE(posArgs[0]);
    let gens = parseInt(posArgs[1]);
    if (Number.isNaN(gens)) {
        error(`Invalid generations value: '${posArgs[1]}'`);
    }
    let gen1P = base.copy();
    gen1P.setData(startP.height, startP.width, startP.data.map(x => x % 2 === 1 ? 1 : 0));
    gen1P.runGeneration();

    grid = new Grid(startP.height, startP.width, gens + 1);

    for (let t = 2; t < grid.gens - 1; t++) {
        grid.fill(t, UNKNOWN);
    }

    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let start = startP.get(x, y);
            let gen1 = gen1P.get(x, y);
            if (start === 0 || start === 1) {
                grid.set(0, x, y, start);
                grid.set(1, x, y, gen1);
            } else if (start === 2) {
                let variable = grid.getVar();
                grid.set(0, x, y, variable);
                grid.set(1, x, y, variable);
                grid.set(gens, x, y, variable);
            } else if (start === 3) {
                grid.set(0, x, y, 1);
                grid.set(1, x, y, gen1);
                grid.set(gens, x, y, 1);
            } else if (start === 4) {
                for (let t = 0; t < gens; t++) {
                    grid.set(t, x, y, 0);
                }
            } else if (start === 5) {
                for (let t = 0; t < gens; t++) {
                    grid.set(t, x, y, 1);
                }
            }
        }
    }

    let toSet: [number, number][] = [];
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            if (!(grid.get(gens, x - 1, y - 1) || grid.get(gens, x - 1, y) || grid.get(gens, x - 1, y + 1) || grid.get(gens, x, y - 1) || grid.get(gens, x, y) || grid.get(gens, x, y + 1) || grid.get(gens, x + 1, y - 1) || grid.get(gens, x + 1, y) || grid.get(gens, x + 1, y + 1))) {
                toSet.push([x, y]);
            }
        }
    }
    for (let [x, y] of toSet) {
        grid.set(gens, x, y, UNKNOWN);
    }

} else {

    error(`Invalid mode: '${mode}'`);

}


const NUMBER_REGEX = /^([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)/;

type ParsedMetric = (string | number)[];

const OPERATORS: {[key: string]: [number, 'left' | 'right']} = {
    'u+': [3, 'right'],
    'u-': [3, 'right'],
    '|': [3, 'right'],
    '^': [2, 'right'],
    '*': [1, 'left'],
    '/': [1, 'left'],
    '+': [0, 'left'],
    '-': [0, 'left'],
};

function parseMetric(metric: string): ParsedMetric {
    metric = metric.replaceAll(/\s+/g, '');
    let tokens: (string | number)[] = [];
    let match: RegExpMatchArray | null;
    for (let i = 0; i < metric.length; i++) {
        if (match = metric.slice(i).match(NUMBER_REGEX)) {
            tokens.push(Number(match[0]));
            i += match[0].length - 1;
        } else {
            tokens.push(metric[i]);
        }
    }
    let out: ParsedMetric = [];
    let ops: string[] = [];
    let expectUnary = true;
    for (let token of tokens) {
        if (typeof token === 'number' || token === 't' || token === 'x' || token === 'y') {
            out.push(token);
            expectUnary = false;
        } else if (token in OPERATORS) {
            if (expectUnary && (token === '+' || token === '-')) {
                token = 'u' + token;
            }
            let [precedence, associativity] = OPERATORS[token];
            while (ops.length > 0) {
                let op = ops[ops.length - 1];
                if (op === '(') {
                    break;
                }
                if (!(OPERATORS[op][0] > precedence || (OPERATORS[op][0] === precedence && associativity === 'left'))) {
                    break;
                }
                ops.pop();
                out.push(op);
            }
            ops.push(token);
            expectUnary = true;
        } else if (token === '(') {
            ops.push(token);
            expectUnary = true;
        } else if (token === ')') {
            while (ops[ops.length - 1] !== '(') {
                let op = ops.pop();
                if (op === undefined) {
                    error(`Invalid search order metric (mismatched parentheses): '${metric}'`);
                }
                out.push(op);
            }
            if (ops[ops.length - 1] !== '(') {
                error(`Invalid search order metric (please report what you did to cause this error, idk what could cause it): '${metric}'`);
            }
            ops.pop();
            expectUnary = false;
        } else {
            error(`Invalid search order metric (invalid character: '${token}'): '${metric}'`);
        }
    }
    while (ops.length > 0) {
        let op = ops.pop();
        if (op === undefined) {
            break;
        }
        if (op === '(') {
            error(`Invalid search order metric (mismatched parentheses): '${metric}'`)
        }
        out.push(op);
    }
    return out;
}

function runMetric([t, x, y]: [number, number, number], metric: ParsedMetric): number {
    let stack: number[] = [];
    for (let value of metric) {
        if (typeof value === 'number') {
            stack.push(value);
        } else if (value === 't') {
            stack.push(t);
        } else if (value === 'x') {
            stack.push(x);
        } else if (value === 'y') {
            stack.push(y);
        } else if (value === 'u+') {
            continue;
        } else if (value === 'u-') {
            let value = stack.pop();
            if (value === undefined) {
                error(`No argument for unary operator '-' in search order metric`);
            }
            stack.push(-value);
        } else if (value === '|') {
            let value = stack.pop();
            if (value === undefined) {
                error(`No argument for unary operator '|' in search order metric`);
            }
            stack.push(Math.abs(value));
        } else {
            let b = stack.pop();
            let a = stack.pop();
            if (a === undefined || b === undefined) {
                error(`Less than 2 arguments for binary operator '${value}' in search order metric`);
            }
            let out: number;
            if (value === '+') {
                out = a + b;
            } else if (value === '-') {
                out = a - b;
            } else if (value === '*') {
                out = a * b;
            } else if (value === '/') {
                out = a / b;
            } else {
                throw new Error(`This error should not occur, please report it (invalid value in runMetric: '${value}')`);
            }
            stack.push(out);
        }
    }
    let out = stack.pop();
    if (out === undefined) {
        error(`Nothing to return in search order metric`);
    }
    return out;
}

function searchOrderSort(a: [number, number, number], b: [number, number, number], order: ParsedMetric[]): number {
    for (let metric of order) {
        let score = runMetric(a, metric) - runMetric(b, metric);
        if (score !== 0) {
            return score;
        }
    }
    return 0;
}

function getSearchOrder(grid: Grid, order: string): [number, number, number][] {
    let cells: [number, number, number][] = [];
    for (let t = 0; t < grid.gens; t++) {
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                if (grid.get(t, x, y) > 1) {
                    cells.push([t, x, y]);
                }
            }
        }
    }
    let parsedOrder = order.split(',').map(x => x.replaceAll(/\s+/g, '')).filter(x => x.length > 0).map(parseMetric);
    return cells.sort((a, b) => searchOrderSort(a, b, parsedOrder));
}


if (options['pattern']) {
    for (let value of options['pattern']) {
        let gen = 0;
        if (value.includes('=')) {
            let parts = value.split('=');
            gen = Number(parts[0]);
            if (parts.length !== 2 || Number.isNaN(gen)) {
                error(`Invalid value for pattern option: '${value}'`);
            }
            value = value[1];
        }
        grid.setFrom(gen, value, 0, 0);
    }
}

if (options['filter']) {
    for (let value of options['filter']) {
        let parts = value.split('=');
        let gen = Number(parts[0]);
        if (parts.length !== 2 || Number.isNaN(gen)) {
            error(`Invalid value for restrict option: '${value}'`);
        }
        if (gen < 0 || gen >= grid.gens || !Number.isInteger(gen)) {
            error(`Invalid generation for filtering: '${gen}'`);
        }
        let p = superBase.loadRLE(parts[1]);
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let value = p.get(x, y);
                if (value === 3) {
                    grid.set(gen, x, y, 1);
                } else if (value === 4) {
                    grid.set(gen, x, y, 0);
                }
            }
        }
    }
}

if (options['restrict']) {
    for (let value of options['restrict']) {
        let gen = 0;
        if (value.includes('=')) {
            let parts = value.split('=');
            gen = Number(parts[0]);
            if (parts.length !== 2 || Number.isNaN(gen)) {
                error(`Invalid value for restrict option: '${value}'`);
            }
            if (gen < 0 || gen >= grid.gens || !Number.isInteger(gen)) {
                error(`Invalid generation for restricting: '${gen}'`);
            }
            value = value[1];
        }
        grid.restrict(gen, value, 0, 0);
    }
}


const SYMEMTRIES: {[K in Exclude<typeof options['symmetry'], undefined>]: [top: Edge, bottom: Edge, left: Edge, right: Edge]} = {
    'D2_-1': ['none', 'odd', 'none', 'none'],
    'D2_-2': ['none', 'even', 'none', 'none'],
    'D2_|1': ['none', 'none', 'none', 'odd'],
    'D2_|2': ['none', 'none', 'none', 'even'],
    'D4_+1': ['none', 'odd', 'none', 'odd'],
    'D4_-2': ['none', 'even', 'none', 'odd'],
    'D4_|2': ['none', 'odd', 'none', 'even'],
    'D4_+4': ['none', 'even', 'even', 'none'],
    'wick_-1': ['odd', 'odd', 'none', 'none'],
    'wick_-2': ['even', 'even', 'none', 'none'],
    'wick_|1': ['none', 'none', 'odd', 'odd'],
    'wick_|2': ['none', 'none', 'even', 'even'],
    'wave_-1': ['odd', 'odd', 'none', 'none'],
    'wave_-2': ['even', 'even', 'none', 'none'],
    'wave_|1': ['none', 'none', 'odd', 'odd'],
    'wave_|2': ['none', 'none', 'even', 'even'],
    'agar': ['wrap', 'wrap', 'wrap', 'wrap'],
};

if (options['symmetry']) {
    let [top, bottom, left, right] = SYMEMTRIES[options['symmetry']];
    options['top'] ??= top;
    options['bottom'] ??= bottom;
    options['left'] ??= left;
    options['right'] ??= right;
    if (top !== 'none' && bottom === 'none') {
        grid.shrinkHeight(Math.ceil(grid.height / 2), 'before');
    } else if (bottom !== 'none' && top === 'none') {
        grid.shrinkHeight(Math.ceil(grid.height / 2), 'after');
    }
    if (left !== 'none' && right === 'none') {
        grid.shrinkWidth(Math.ceil(grid.width / 2), 'before');
    } else if (right !== 'none' && left === 'none') {
        grid.shrinkWidth(Math.ceil(grid.width / 2), 'after');
    }
}

let top: Edge = options['top'] ?? 'none';
let bottom: Edge = options['bottom'] ?? 'none';
let left: Edge = options['left'] ?? 'none';
let right: Edge = options['right'] ?? 'none';


grid.removeUnusedVars();

// prevent stuff from breaking
if (grid.numVars === 0) {
    grid.getVar();
}

let cellCounts: {[key: number]: number} = {};
for (let t = 0; t < grid.gens; t++) {
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let cell = grid.get(t, x, y);
            if (cell in cellCounts) {
                cellCounts[cell]++;
            } else {
                cellCounts[cell] = 1;
            }
        }
    }
}


let out: string[] = [];
for (let line of code.split('\n')) {
    if (line.startsWith('typedef') && line.endsWith('cell_value_t;')) {
        let maxValue = grid.numVars === 0 ? 3 : 2 + grid.numVars * 4;
        if (maxValue > 65535) {
            out.push(`typedef uint32_t cell_value_t;`);
        } else if (maxValue > 255) {
            out.push(`typedef uint16_t cell_value_t;`);
        } else {
            out.push(`typedef uint8_t cell_value_t;`);
        }
        continue;
    } else if (line.startsWith('typedef') && line.endsWith('index_t;')) {
        let maxValue = (grid.height + (top === 'none' ? 2 : 1) + (bottom === 'none' ? 2 : 1)) * (grid.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1)) * grid.gens;
        if (maxValue > 65535) {
            out.push(`typedef uint32_t index_t;`);
        } else if (maxValue > 255) {
            out.push(`typedef uint16_t index_t;`);
        } else {
            out.push(`typedef uint8_t index_t;`);
        }
        continue;
    } else if (line.startsWith('static const cell_value_t initial_grid[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + grid.toString(top, bottom, left, right) + ';';
    } else if (line.startsWith(`uint8_t trs[512] = `)) {
        let trs = base.trs.slice();
        if (multiRule) {
            for (let i = 0; i < 512; i++) {
                if (trs[i] !== maxBase.trs[i]) {
                    trs[i] = 3;
                }
            }
        }
        line = line.slice(0, line.indexOf('{'))+ '{' + trs.join(', ') + '};';
    } else if (line.startsWith('index_t search_order[TOTAL_UNKNOWN_CELLS][3] = ')) {
        line = line.slice(0, line.indexOf('{'));
        let order = options['search-order'] ?? defaultSearchOrder;
        if (order in searchOrderAliases) {
            order = searchOrderAliases[order];
        }
        line += '{' + getSearchOrder(grid, order).map(x => `{${x[0]}, ${x[1] + (top === 'none' ? 2 : 1)}, ${x[2] + (left === 'none' ? 2 : 1)}}`).join(', ') + '};';
    }
    if (!(line.startsWith('#define ') || line.startsWith('// #define '))) {
        out.push(line);
        continue;
    }
    let data = line.split(' ');
    if (data[0] === '//') {
        data = data.slice(1);
    }
    let name = data[1];
    let value: string | number;
    let comment = false;
    if (name === 'HEIGHT') {
        value = grid.height + (top === 'none' ? 2 : 1) + (bottom === 'none' ? 2 : 1);
    } else if (name === 'WIDTH') {
        value = grid.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1);
    } else if (name === 'GENS') {
        value = grid.gens;
    } else if (name === 'VAR_COUNT') {
        value = grid.numVars;
    } else if (name === 'TOTAL_UNKNOWN_CELLS') {
        value = 0;
        for (let [key, count] of Object.entries(cellCounts)) {
            if (key === '0' || key === '1') {
                continue;
            }
            value += count;
        }
    } else if (name === 'TIME_WRAP') {
        value = timeWrap ? 'true' : 'false';
    } else if (name === 'TIME_WRAP_DX') {
        value = timeWrap ? timeWrap[0] : 67;
    } else if (name === 'TIME_WRAP_DY') {
        value = timeWrap ? timeWrap[1] : 67;
    } else if (name === 'MULTI_RULE') {
        value = String(multiRule);
    } else if (name === 'RULE') {
        value = `"${rule}"`;
    // } else if (name === 'MAX_RULE_CHANGES') {
    //     value = 0;
    //     for (let i = 0; i < 512; i++) {
    //         if (base.trs[i] !== maxBase.trs[i]) {
    //             value++;
    //         }
    //     }
    } else if (name === 'SPECIAL_AFTER_RULE') {
        if (top === 'wrap' && bottom === 'wrap' && left === 'wrap' && right === 'wrap') {
            value = `":T${grid.width},${grid.height}"`;
        } else {
            value = `""`;
        }
    } else if (name === 'WRAP_HEIGHT') {
        value = grid.height;
    } else if (name === 'WRAP_WIDTH') {
        value = grid.width;
    } else if (name === 'TOP') {
        value = top === 'wrap' ? 'WRAP_HEIGHT' : top.toUpperCase();
    } else if (name === 'BOTTOM') {
        value = bottom === 'wrap' ? 'WRAP_HEIGHT' : bottom.toUpperCase();
    } else if (name === 'LEFT') {
        value = left === 'wrap' ? 'WRAP_WIDTH' : left.toUpperCase();
    } else if (name === 'RIGHT') {
        value = right === 'wrap' ? 'WRAP_WIDTH' : right.toUpperCase();
    } else if (name === 'INITIAL_VALUE') {
        value = options['initial-value'] ?? 0;
    } else if (name === 'LLS') {
        let path = await import('node:path');
        let fs = await import('node:fs/promises');
        let file = options['lls'];
        if (file === undefined) {
            comment = true;
            value = '"path/to/lls"';
        } else {
            if ((await fs.stat(file)).isDirectory()) {
                for (let filename of await fs.readdir(file)) {
                    if (filename !== 'lls' && filename !== 'lss') {
                        continue;
                    }
                    filename = path.join(file, filename);
                    if ((await fs.stat(filename)).isDirectory()) {
                        continue;
                    }
                    try {
                        await fs.access(filename, fs.constants.X_OK);
                    } catch {
                        continue;
                    }
                    file = filename;
                    break;
                }
            }
            value = JSON.stringify(file);
        }
    } else if (name === 'MAXPOP') {
        if (options['maxpop'] === undefined) {
            comment = true;
            value = 67;
        } else {
            value = options['maxpop'];
        }
    } else if (name === 'SHOW_SOLUTIONS') {
        value = options['no-show-solutions'] ? 'false' : 'true';
    } else if (name === 'MAX_SOLUTIONS') {
        if (options['max-solutions'] === undefined) {
            comment = true;
            value = 67;
        } else {
            value = options['max-solutions'];
        }
    } else if (name === 'FILTER_EVERY_PHASE') {
        value = mode === 'periodic' ? 'true' : 'false';
    } else if (name === 'REPORTING_INTERVAL') {
        value = options['interval'] ?? 1;
    } else if (name === 'BENCHMARK') {
        if (options['benchmark'] == undefined) {
            comment = true;
            value = 67;
        } else {
            value = options['benchmark'];
        }
    } else if (name === 'DEBUG') {
        value = options['debug'] ?? 0;
    } else {
        out.push(line);
        continue;
    }
    let str = `#define ${name} ${value}`;
    if (comment) {
        str = '// ' + str;
    }
    out.push(str);
}

return [options, out.join('\n')];


}


export async function main() {
    let path = await import('node:path');
    function getPath(file: string): string {
        return path.relative(process.cwd(), path.join(import.meta.dirname, '..', '..', file));
    }
    let fs = await import('node:fs/promises');
    let execSync = (await import('node:child_process')).execSync;
    let execPath = getPath('vls_compiled');
    if (!(execPath.startsWith('.') || execPath.startsWith('..') || execPath.startsWith('/'))) {
        execPath = './' + execPath;
    }
    let source = (await fs.readFile(getPath('src/vls/params.h'))).toString();
    let [options, code] = await transformCode(process.argv, source);
    await fs.writeFile(getPath('src/vls/params2.h'), code);
    try {
        let command = `gcc --std=c2x -Wall -Wextra -Werror -Wpedantic -Wno-unused-function ${options['profile'] ? '-pg -O3' : (options['gdb'] ? '-g -Og' : '-O3')} -o '${execPath}' '${getPath('src/vls/index.c')}'`;
        console.log(command);
        execSync(command, {stdio: 'inherit'});
        execSync(`${options['gdb'] ? 'gdb ' : ''}${execPath}`, {stdio: 'inherit'});
    } catch (error) {
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
