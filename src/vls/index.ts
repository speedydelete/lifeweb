
import * as t from '@babel/types';
import {parseExpression} from '@babel/parser';

import {Grid, runScript} from './compiler.js';
import {DataPattern, IdentityPattern, MAPPattern, MAPGenPattern, parseSpeed, createPattern} from '../core/index.js';


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

    catalyst <start> <gens> [period] [phase-shift]
        find a stable (or periodic with the given period) catalyst
        that completes the given partial and recovers
        in or less than the given generations value
        the start is a LifeSuper RLE:
            state 0 (black) - dead
            state 1 (green) - alive
            state 2 (blue) - catalyst goes here
            state 3 (white) - can die but must be alive at the end
            state 4 (red) - must stay dead the whole time
            state 5 (yellow) - must stay alive the whole time
            state 6 (gray) - alias for state 0
            state 8 (purple) - forced catalyst stator
        the catalyst can only start interacting at generation (period + 1)

    script <file>
        take in a script and run it

Options:

    -h, --help: show this help message

    -d, --debug <level>: set the debug level

    -g: compile with debugging symbols
    --gdb: compile with debugging symbols and run gdb
    --profile: compile with profiling symbols

    -l, --lls <file>: instead of searching, run LLS on the given file
        must be a directory containing a file called "lls" or "lss.py"

    --benchmark <iterations>: run benchmarking

    --interval <seconds>: set the progress reporting interval

    --partial-type <'none'|'cell'|'start'>:
        type of max partials to report (default 'cell')
        none: report no max partials
        cell: report by number of set cells
        start: report by number of correct cells at start of search order
    --partial-interval <seconds>: set the minimum partial reporting interval

    --file <file>: also write to that file

    --rulespace <rulespace>: set the rulespace, options:
        int, ot

    -m, --method <method>:
        Set the method used for searching

        Cell-by-cell method:
        Syntax is "cell <search-order>"
        the search order is defined as a comma-separated list of metrics
        later metrics are tiebreakers for earlier metrics
        metrics are normal mathematical expressions
        use variables "x", "y", and "t" for x, y, and time respectively
        also you can use aliases like (reverse-)(gfind-)(f2b|b2f|s2s)a
        the default value is gfind-f2b for spaceships and 't, y, x' otherwise

    -i, --initial-value <value>:
        set the initial tested value for cells, default 1

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

    --maxpop <cells>: set the maximum population during the search
`;

type OptionValue = true | 'string' | 'number' | Set<string> | readonly ('string' | 'number' | Set<string>)[] | [true, 'string' | 'number' | Set<string>];

const OPTIONS = {
    'help': true,
    'debug': 'number',
    'g': true,
    'gdb': true,
    'lls': 'string',
    'profile': true,
    'benchmark': 'string',
    'interval': 'number',
    'partial-type': new Set(['none', 'cell', 'start'] as const),
    'partial-interval': 'number',
    'file': 'string',
    'rulespace': new Set(['int', 'ot'] as const),
    'method': 'string',
    'initial-value': new Set(['0', '1', 'same-0', 'same-1', 'different-0', 'different-1']),
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
    'g': 'g',
    'l': 'lls',
    'm': 'method',
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


if (posArgs.length < 2) {
    error(`Expected at least 2 positional arguments (got ${posArgs.length})`);
}

const MODES = ['periodic', 'parent', 'file', 'catalyst', 'custom-osc', 'script'];

let rule = posArgs[0];
let base = createPattern(rule) as DataPattern;
if (!(base instanceof MAPPattern || base instanceof MAPGenPattern)) {
    error(`Rule must be a non-B0 INT or INT Generations rule`);
}
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
    if (!(maxBase instanceof MAPPattern || maxBase instanceof MAPGenPattern)) {
        error(`Rule must be a non-B0 INT rule`);
    }
}


const UNKNOWN = 2;


let grid: Grid;

let defaultSearchOrder = 't, y, x';
let searchOrderAliases: {[key: string]: string} = {};

let timeWrap: false | [number, number] = false;

if (mode === 'periodic') {

    if (posArgs.length !== 3) {
        error(`Expected 3 positional arguments for periodic mode (got ${posArgs.length})`);
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
        defaultSearchOrder = 'gfind-f2b';
        searchOrderAliases['f2b'] = `t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['b2f'] = `t, (x*${dx} + y*${dy})`;
        searchOrderAliases['s2s'] = `t, (x*${dy} + y*${dx})`;
        searchOrderAliases['reverse-f2b'] = `-t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['reverse-b2f'] = `-t, (x*${dx} + y*${dy})`;
        searchOrderAliases['reverse-s2s'] = `-t, (x*${dy} + y*${dx})`;
        searchOrderAliases['gfind-f2b'] = `-(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['gfind-b2f'] = `(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['gfind-s2s'] = `(x*${dy} + y*${dx}), -t`;
        searchOrderAliases['reverse-gfind-f2b'] = `-(x*${dx} + y*${dy}), t`;
        searchOrderAliases['reverse-gfind-b2f'] = `(x*${dx} + y*${dy}), t`;
        searchOrderAliases['reverse-gfind-s2s'] = `(x*${dy} + y*${dx}), t`;
    }

    // grid = new Grid(height, width, period + 1);
    // for (let y = 0; y < height - dy; y++) {
    //     for (let x = 0; x < width - dx; x++) {
    //         let value = grid.getVar();
    //         grid.set(0, x, y, UNKNOWN, value);
    //         grid.set(period, x + dx, y + dy, UNKNOWN, value);
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

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for parent mode (got ${posArgs.length})`);
    }
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

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for file mode (got ${posArgs.length})`);
    }
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
                let variable = 0;
                if (typeof value === 'string') {
                    if (value === '*') {
                        // do nothing
                    } else if (value in vars) {
                        variable = vars[value];
                    } else {
                        let newVar = grid.getVar();
                        vars[value] = newVar;
                        variable = newVar;
                    }
                    value = UNKNOWN;
                }
                grid.set(t, x, y, value, variable);
            }
        }
    }

} else if (mode === 'catalyst') {

    if (posArgs.length === 0 || posArgs.length > 4) {
        error(`Expected 1 to 4 positional arguments for catalyst mode (got ${posArgs.length})`);
    }
    let startP = IdentityPattern.loadRLE(posArgs[0]);
    startP.data = startP.data.map(x => x === 6 ? 0 : x);
    let gens = parseInt(posArgs[1]);
    if (Number.isNaN(gens)) {
        error(`Invalid generations value (expected integer): '${posArgs[1]}'`);
    }
    let period = 1;
    if (posArgs[2] !== undefined) {
        period = parseInt(posArgs[2]);
        if (Number.isNaN(period)) {
            error(`Invalid period value (expected integer): '${posArgs[1]}'`);
        }
    }
    let phaseShift = 0;
    if (posArgs[3] !== undefined) {
        phaseShift = parseInt(posArgs[3]);
        if (Number.isNaN(phaseShift)) {
            error(`Invalid phase shift value (expected integer): '${posArgs[1]}'`);
        }
    }

    let genPs: DataPattern[] = [];
    let genPBase = base.copy();
    genPBase.setData(startP.height, startP.width, startP.data.map(x => x % 2 === 1 ? 1 : 0));
    for (let i = 0; i < period; i++) {
        genPBase.runGeneration();
        genPs.push(genPBase.copy());
    }

    grid = new Grid(startP.height, startP.width, gens + 1);

    for (let t = 2; t < grid.gens - 1; t++) {
        grid.fill(t, UNKNOWN);
    }

    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let start = startP.get(x, y);
            let genValues = genPs.map(p => p.get(x, y));
            if (start === 0 || start === 1) {
                grid.set(0, x, y, start);
                for (let i = 0; i < genValues.length; i++) {
                    grid.set(i + 1, x, y, genValues[i]);
                }
            } else if (start === 2 || start === 8) {
                let variables: number[] = [];
                for (let t = 0; t < period; t++) {
                    let variable = grid.getVar();
                    variables.push(variable);
                    grid.set(t, x, y, UNKNOWN, variable);
                }
                if (start === 2) {
                    grid.set(period, x, y, UNKNOWN, variables[0]);
                    grid.set(gens, x, y, UNKNOWN, variables[(gens + phaseShift) % period]);
                } else {
                    for (let t = period; t < grid.gens; t++) {
                        grid.set(t, x, y, UNKNOWN, variables[t % period]);
                    }
                }
            } else if (start === 3) {
                grid.set(0, x, y, 1);
                for (let i = 0; i < genValues.length; i++) {
                    grid.set(i + 1, x, y, genValues[i]);
                }
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

} else if (mode === 'custom-osc') {

    if (posArgs.length < 2) {
        error(`Expected at least 2 positional arguments for custom-osc mode (got ${posArgs.length})`);
    }
    let gens = Number(posArgs[0]);
    let p = IdentityPattern.loadRLE(posArgs[1]);
    if (Number.isNaN(gens)) {
        error(`Invalid generations value: '${gens}'`);
    }

    grid = new Grid(p.height, p.width, gens);
    timeWrap = [0, 0];

    let meanings: {[key: number]: [string, string[]]} = {};
    let match: RegExpMatchArray | null;
    for (let specifier of posArgs.slice(2)) {
        let originalSpecifier = specifier;
        specifier = specifier.replaceAll(/\s+/g, '');
        if (!(match = specifier.match(/^(\d+):(.*)$/))) {
            error(`Invalid meaning specifier: '${originalSpecifier}'`);
        }
        let state = Number(match[1]);
        if (state < 7) {
            error(`Cannot set meaning of state ${state} (specifier: '${originalSpecifier}')`);
        }
        meanings[state] = [originalSpecifier, match[2].split(',')];
    }

    for (let t = 1; t < grid.gens; t++) {
        grid.fill(t, UNKNOWN);
    }

    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let value = p.get(x, y);
            if (value === 0 || value === 1) {
                grid.set(0, x, y, value);
            } else if (value === 2 || value === 6) {
            } else if (value === 3 || value === 4) {
                let cellValue = value % 2;
                for (let t = 0; t < gens; t++) {
                    grid.set(t, x, y, cellValue);
                }
            } else {
                if (value in meanings) {
                    let period = gens;
                    let out: (number | [number, number])[] = [];
                    for (let t = 0; t < gens; t++) {
                        out.push(UNKNOWN);
                    }
                    for (let part of meanings[value][1]) {
                        if (match = part.match(/^p(\d+)$/)) {
                            period = Number(match[1]);
                            let vars: number[] = [];
                            for (let i = 0; i < period; i++) {
                                vars.push(grid.getVar());
                            }
                            out = [];
                            for (let t = 0; t < gens; t++) {
                                out.push([UNKNOWN, vars[t % period]]);
                            }
                        } else if (match = part.match(/^(\d+)=([01*])$/)) {
                            let t = Number(match[1]);
                            let state = match[2] === '*' ? UNKNOWN : Number(match[2]);
                            let prev = JSON.stringify(out[t]);
                            for (let i = 0; i < out.length; i++) {
                                if (JSON.stringify(out[i]) === prev) {
                                    out[i] = state;
                                }
                            }
                        } else {
                            error(`Invalid meaning part: '${part}' (specifier: '${meanings[value][0]}')`);
                        }
                    }
                    for (let t = 0; t < gens; t++) {
                        let value = out[t];
                        if (typeof value === 'number') {
                            grid.set(t, x, y, value);
                        } else {
                            grid.set(t, x, y, ...value);
                        }
                    }
                } else {
                    error(`State ${value} is not defined (at x = ${x}, y = ${y})`);
                }
            }
        }
    }

} else if (mode === 'script') {

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for script mode (got ${posArgs.length})`);
    }
    let fs = await import('node:fs/promises');
    grid = runScript((await fs.readFile(posArgs[0])).toString());

} else {

    error(`Invalid mode: '${mode}'`);

}


function runMetric(cell: [number, number, number], node: t.Expression | t.PrivateName): number | boolean {
    if (node.type === 'Identifier') {
        if (node.name === 't') {
            return cell[0];
        } else if (node.name === 'x') {
            return cell[1];
        } else if (node.name === 'y') {
            return cell[2];
        } else {
            error(`Invalid variable: '${node.name}'`);
        }
    } else if (node.type === 'NumericLiteral') {
        return node.value;
    } else if (node.type === 'BooleanLiteral') {
        return node.value;
    } else if (node.type === 'UnaryExpression') {
        let value = runMetric(cell, node.argument);
        if (node.operator === '-') {
            return -value;
        } else if (node.operator === '+') {
            return +value;
        } else {
            error(`Invalid unary operator: '${node.operator}'`);
        }
    } else if (node.type === 'BinaryExpression') {
        let left = runMetric(cell, node.left);
        let right = runMetric(cell, node.right);
        if (node.operator === '==') {
            return left === right;
        } else if (node.operator === '!=') {
            return left !== right;
        } else if (node.operator === '<') {
            return left < right;
        } else if (node.operator === '<=') {
            return left <= right;
        } else if (node.operator === '>') {
            return left > right;
        } else if (node.operator === '>=') {
            return left >= right;
        } else if (node.operator === '<<') {
            return Number(left) << Number(right);
        } else if (node.operator === '>>') {
            return Number(left) >> Number(right);
        } else if (node.operator === '>>>') {
            return Number(left) >>> Number(right);
        } else if (node.operator === '+') {
            return Number(left) + Number(right);
        } else if (node.operator === '-') {
            return Number(left) - Number(right);
        } else if (node.operator === '*') {
            return Number(left) * Number(right);
        } else if (node.operator === '/') {
            return Number(left) / Number(right);
        } else if (node.operator === '%') {
            return Number(left) % Number(right);
        } else if (node.operator === '**') {
            return Number(left) ** Number(right);
        } else if (node.operator === '|') {
            return Number(left) | Number(right);
        } else if (node.operator === '^') {
            return Number(left) ^ Number(right);
        } else if (node.operator === '&') {
            return Number(left) & Number(right);
        } else {
            error(`Invalid binary operator: '${node.operator}'`);
        }
    } else if (node.type === 'LogicalExpression') {
        if (node.operator === '&&') {
            return runMetric(cell, node.left) && runMetric(cell, node.right);
        } else if (node.operator === '||') {
            return runMetric(cell, node.left) || runMetric(cell, node.right);
        } else {
            error(`Invalid binary operator: '${node.operator}'`);
        }
    } else if (node.type === 'ConditionalExpression') {
        return runMetric(cell, node.test) ? runMetric(cell, node.consequent) : runMetric(cell, node.alternate);
    } else if (node.type === 'CallExpression') {
        if (node.callee.type !== 'Identifier') {
            error(`Cannot call non-constant function`);
        }
        let args: (number | boolean)[] = [];
        for (let arg of node.arguments) {
            if (arg.type === 'SpreadElement' || arg.type === 'ArgumentPlaceholder') {
                error(`Invalid node: '${arg.type}'`);
            } else {
                args.push(runMetric(cell, arg));
            }
        }
        if (node.callee.name === 'abs') {
            if (node.arguments.length !== 1) {
                error(`abs() function takes 1 argument`);
            }
            return Math.abs(Number(args[0]));
        } else {
            error(`Invalid function: '${node.callee.name}'`);
        }
    } else {
        error(`Invalid node: '${node.type}'`);
    }
}

function searchOrderSort(a: [number, number, number], b: [number, number, number], order: t.Expression[]): number {
    for (let metric of order) {
        let score = Number(runMetric(a, metric)) - Number(runMetric(b, metric));
        if (score !== 0) {
            return score;
        }
    }
    return 0;
}

function getSearchOrder(grid: Grid, order: string, returnOnlyHighest: boolean): [number, number, number][] {
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
    let parsedOrder: t.Expression[] = [];
    for (let metric of order.split(',')) {
        metric = metric.trim();
        if (metric === '') {
            continue;
        }
        try {
            parsedOrder.push(parseExpression(metric));
        } catch (e) {
            error(`Syntax error while parsing metric '${metric}': ${e instanceof Error ? e.message : e}`);
        }
    }
    let out = cells.sort((a, b) => searchOrderSort(a, b, parsedOrder));
    if (!returnOnlyHighest) {
        return out;
    }
    let prevValue = out[0];
    let out2: [number, number, number][] = [prevValue];
    for (let value of out.slice(1)) {
        if (searchOrderSort(prevValue, value, parsedOrder) !== 0) {
            break;
        }
        out2.push(value);
        prevValue = value;
    }
    return out2;
}

let method: 'cell' | 'path';
let searchOrder: string | undefined = undefined;
let initialPath: [number, number, number][] = [];
let methodArg = options['method'];
if (methodArg === undefined) {
    method = 'cell';
    searchOrder = defaultSearchOrder;
    while (searchOrder in searchOrderAliases) {
        searchOrder = searchOrderAliases[searchOrder];
    }
} else {
    let data: string;
    let index = methodArg.indexOf(' ');
    if (index === -1) {
        method = methodArg as typeof method;
        data = '';
    } else {
        method = methodArg.slice(0, index) as typeof method;
        data = methodArg.slice(index + 1);
    }
    if (method === 'cell') {
        searchOrder = data === '' ? defaultSearchOrder : data;
        while (searchOrder in searchOrderAliases) {
            searchOrder = searchOrderAliases[searchOrder];
        }
    } else if (method === 'path') {
        if (defaultSearchOrder === 'gfind-f2b') {
            defaultSearchOrder = 'f2b';
        }
        if (data.match(/^(\d+,* *,*)*\d+$/)) {
            for (let cell of data.split(',')) {
                cell = cell.trim();
                let coords = cell.split(' ').map(Number);
                if (coords.length !== 3 || coords.some(x => Number.isNaN(x))) {
                    error(`Invalid cell: '${cell}'`);
                }
                initialPath.push(coords as [number, number, number]);
            }
        } else {
            searchOrder = data === '' ? defaultSearchOrder : data;
            while (searchOrder in searchOrderAliases) {
                searchOrder = searchOrderAliases[searchOrder];
            }
            initialPath = getSearchOrder(grid, searchOrder, true);
        }
    } else {
        error(`Invalid value for method option (expected 'cell' or 'path', got '${method}'): '${methodArg}'`);
    }
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
        let p = IdentityPattern.loadRLE(parts[1]);
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


type Edge = 'none' | 'even' | 'odd' | 'wrap';

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

function gridToString(grid: Grid, top: Edge, bottom: Edge, left: Edge, right: Edge, useVars: boolean): string {4
    let data = useVars ? grid.vars : grid.data;
    let emptyRow: number[] = [];
    let realWidth = grid.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1);
    for (let x = 0; x < realWidth; x++) {
        emptyRow.push(0);
    }
    let out: number[][][] = [];
    for (let t = 0; t < grid.gens; t++) {
        let layer: number[][] = [];
        for (let y = 0; y < grid.height; y++) {
            let row: number[] = [];
            if (left === 'none') {
                row.push(0, 0);
            } else if (left === 'even') {
                row.push(data[t][y][0]);
            } else if (left === 'odd') {
                row.push(data[t][y][1]);
            } else {
                row.push(data[t][y][grid.width - 1]);
            }
            for (let x = 0; x < grid.width; x++) {
                row.push(data[t][y][x]);
            }
            if (right === 'none') {
                row.push(0, 0);
            } else if (right === 'even') {
                row.push(data[t][y][grid.width - 1]);
            } else if (right === 'odd') {
                row.push(data[t][y][grid.width - 2]);
            } else {
                row.push(data[t][y][0]);
            }
            layer.push(row);
        }
        let toInsertBefore: number[][] = [];
        if (top === 'none') {
            toInsertBefore = [emptyRow, emptyRow];
        } else if (top === 'wrap') {
            toInsertBefore = [layer[layer.length - 1]];
        } else {
            let row = (top === 'even' ? layer[0] : layer[1]).slice();
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
            layer.push(emptyRow, emptyRow);
        } else if (bottom === 'wrap') {
            layer.push(layer[0]);
        } else {
            let row = (bottom === 'even' ? layer[grid.height - 1] : layer[grid.height - 2]).slice();
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
            layer.push(row);
        }
        layer.unshift(...toInsertBefore);
        out.push(layer);
    }
    return `{${out.map(grid => `{${grid.map(row => `{${row.join(', ')}}`).join(', ')}}`).join(', ')}}`;
}

let out: string[] = [];
for (let line of code.split('\n')) {
    if (line.startsWith('typedef') && line.endsWith('index_t;')) {
        let maxValue = (grid.height + (top === 'none' ? 2 : 1) + (bottom === 'none' ? 2 : 1)) * (grid.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1)) * grid.gens;
        if (maxValue > 65535) {
            out.push(`typedef uint32_t index_t;`);
        } else if (maxValue > 255) {
            out.push(`typedef uint16_t index_t;`);
        } else {
            out.push(`typedef uint8_t index_t;`);
        }
        continue;
    } else if (line.startsWith('typedef') && line.endsWith('var_t;')) {
        let maxValue = grid.numVars + 1;
        if (maxValue > 65535) {
            out.push(`typedef uint32_t var_t;`);
        } else if (maxValue > 255) {
            out.push(`typedef uint16_t var_t;`);
        } else {
            out.push(`typedef uint8_t var_t;`);
        }
        continue;
    } else if (line.startsWith('static const cell_value_t initial_grid[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, top, bottom, left, right, false) + ';';
    } else if (line.startsWith('static const var_t initial_vars[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, top, bottom, left, right, true) + ';';
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
        if (method === 'cell') {
            if (searchOrder === undefined) {
                throw new Error('This error should not occur (no search order but cell method is used), please report this error');
            }
            line = line.slice(0, line.indexOf('{'));
            line += '{' + getSearchOrder(grid, searchOrder, false).map(x => `{${x[0]}, ${x[1] + (top === 'none' ? 2 : 1)}, ${x[2] + (left === 'none' ? 2 : 1)}}`).join(', ') + '};';
        } else {
            continue;
        }
    } else if (line.startsWith('const index_t initial_path[INITIAL_PATH_LENGTH][3] = ')) {
        if (method === 'path') {
            line = line.slice(0, line.indexOf('{'));
            line += '{' + initialPath.map(x => `{${x[0]}, ${x[1] + (top === 'none' ? 2 : 1)}, ${x[2] + (left === 'none' ? 2 : 1)}}`).join(', ') + '};';
        } else {
            continue;
        }
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
    let value: string | number | boolean;
    let comment = false;
    if (name === 'HEIGHT') {
        value = grid.height + (top === 'none' ? 2 : 1) + (bottom === 'none' ? 2 : 1);
    } else if (name === 'WIDTH') {
        value = grid.width + (left === 'none' ? 2 : 1) + (right === 'none' ? 2 : 1);
    } else if (name === 'GENS') {
        value = grid.gens;
    } else if (name === 'VARIABLES') {
        value = grid.numVars > 0;
    } else if (name === 'VAR_COUNT') {
        value = grid.numVars + 1;
    } else if (name === 'TOTAL_UNKNOWN_CELLS') {
        value = 0;
        for (let [key, count] of Object.entries(cellCounts)) {
            if (key === '0' || key === '1') {
                continue;
            }
            value += count;
        }
    } else if (name === 'TIME_WRAP') {
        value = Boolean(timeWrap);
    } else if (name === 'TIME_WRAP_DX') {
        value = timeWrap ? timeWrap[0] : 67;
    } else if (name === 'TIME_WRAP_DY') {
        value = timeWrap ? timeWrap[1] : 67;
    } else if (name === 'MULTI_RULE') {
        value = multiRule;
    } else if (name === 'STATES') {
        value = base.rule.states;
    } else if (name === 'BINDS') {
        value = `BINDS_${(options['rulespace'] ?? 'int').toUpperCase()}`;
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
    } else if (name === 'METHOD') {
        value = `METHOD_${method.toUpperCase()}`;
    } else if (name === 'SEARCH_T') {
        value = method === 'path' ? initialPath[0][0] : 67;
    } else if (name === 'INITIAL_PATH_LENGTH') {
        value = initialPath.length;
    } else if (name === 'SKIP_STATOR_VARIANTS') {
        value = mode === 'catalyst';
    } else if (name === 'INITIAL_VALUE') {
        value = 'IV_' + (options['initial-value'] ?? '1').toUpperCase().replaceAll('-', '_');
    } else if (name === 'LLS') {
        let path = await import('node:path');
        let fs = await import('node:fs/promises');
        let file = options['lls'];
        if (file === undefined) {
            comment = true;
            value = '"path/to/lls"';
        } else {
            if (!(await fs.stat(file)).isDirectory()) {
                error(`Value for lls option must be a path to a directory`);
            }
            let found = false;

            for (let filename of await fs.readdir(file)) {
                let isLSS = false;
                if (filename === 'lls') {
                    try {
                        await fs.access(path.join(file, filename), fs.constants.X_OK);
                    } catch {
                        continue;
                    }
                } else if (filename === 'lss.py') {
                    isLSS = true;
                } else {
                    continue;
                }
                filename = path.join(file, filename);
                if ((await fs.stat(filename)).isDirectory()) {
                    continue;
                }
                if (isLSS) {
                    file = path.join(file, 'venv/bin/python3') + ' ' + filename;
                } else {
                    file = filename;
                }
                found = true;
                break;
            }
            if (!found) {
                error(`Cannot find LLS/LSS`);
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
        value = !options['no-show-solutions'];
    } else if (name === 'MAX_SOLUTIONS') {
        if (options['max-solutions'] === undefined) {
            comment = true;
            value = 67;
        } else {
            value = options['max-solutions'];
        }
    } else if (name === 'REPORTING_INTERVAL') {
        value = options['interval'] ?? 1;
    } else if (name === 'MAX_PARTIAL_TYPE') {
        value = `MAX_PARTIAL_TYPE_${(options['partial-type'] ?? 'cell').toUpperCase()}`;
    } else if (name === 'MAX_PARTIAL_REPORTING_INTERVAL') {
        value = options['partial-interval'] ?? 1;
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
        let command = `gcc --std=c2x -Wall -Wextra -Werror -Wpedantic -Wno-unused-function -Wno-unknown-pragmas ${options['profile'] ? '-pg -O3' : (options['g'] || options['gdb'] ? '-g -O0' : '-O3')} -march=native -mtune=native -fno-stack-protector -fomit-frame-pointer -flto -o '${execPath}' '${getPath('src/vls/index.c')}'`;
        execSync(command, {stdio: 'inherit'});
        if (options['g'] && !options['gdb']) {
            return;
        }
        execSync(`${options['file'] ? `stdbuf -oL ` : ''}${options['gdb'] ? 'gdb ' : ''}${execPath}${options['file'] ? ` | tee ${options['file']}` : ''}`, {stdio: 'inherit'});
    } catch (error) {
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
