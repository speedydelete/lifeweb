
import * as t from '@babel/types';
import {parseExpression} from '@babel/parser';

import {DataPattern, IdentityPattern, MAPPattern, parseSpeed, createPattern, parse} from '../core/index.js';
import {error, Coord, coord, UNKNOWN, OFF, ON, State, Variable, Grid, runExpression, runFile} from './compiler.js';


const HELP = `
Usage: ./vls <rule> <mode> <options>
Or, for multi-rule searching: ./vls <minrule> <maxrule> <mode> <options>

Run a search for something in a cellular automaton.
If you don't know what this means, see https://conwaylife.com/.

Modes:

    periodic <speed> <height> <width>
        search for a periodic object of a speed
        speed can be like "p2", "c/2o", or "(2, 1)c/6".

    parent <pattern>
        find parents of the given pattern

    file <path>
        take in a VLS input file and try to find solutions

    lls-file <path>
        take in a LLS input file and try to find solutions

    script <path>
        run the file at the path as a ES module, must default export a Grid

    catalyst <rle-or-path-to-rle> <gens> <survive-gens> [period]
        find a stable (or periodic with the given period) catalyst
        that completes the given partial and recovers in or less than the given
        generations value, staying stable for survive-gens generations
        the RLE is a LifeHistory RLE:
            state 0 (black) - dead
            state 1 (green) - alive
            state 2 (blue) - catalyst goes here
            state 3 (white) - alive, can die, but must be alive at the end
            state 4 (red) - must stay dead the whole time
            state 5 (yellow) - must stay alive the whole time
            state 6 (gray) - alias for state 0
        the catalyst can only start interacting at generation (period + 1)

Options:

    -h, -help: show this help message

    -d, -debug=<level>: set the debug level

    -gdb: run gdb
    -no-optimize: disable optimization flags
    -asan, -address-sanitizer: enable address sanitizer

    -benchmark=<iterations>: run benchmarking

    // -profile=<seconds>: enables profile based optimization, recompiles and
    //     reruns after that many seconds

    -f, -file=<file>: also write output to that file

    -rulespace=<rulespace>: set the rulespace for multi-rule searching,
        options: int, ot, map, hex-int, hex-ot, hex-map, vn-int, vn-ot, vn-map

    -o, -order=<order>: set the search order

        The search order is defined as a comma-separated list of metrics, later
        metrics are tiebreakers for earlier metrics. Metrics are normal
        mathematical expressions, use variables 'x', 'y', and 't' for x, y, and
        time respectively.

        Also, you can use aliases like (r?g?-)(f2b|b2f|s2s), g means find every
        generation of the row before moving on, and r means reverse the order of
        the search in time.

        The default search order is f2b for spaceships and 't, y, x' otherwise.

    -i, -initial-value=<value>:
        set the initial tested value for cells, default 1

    -no-ot-optimization: disable optimization for OT rules
    -no-cache-trs: disable implication transition caching
    -check-times: keep track of when each cell's implications was last checked,
        can make it faster can make it slower
    -clang: use clang instead of gcc

    -s, -symmetry=<symmetry>: apply a symmetry to the pattern, currently
        supported symmetries are D2|, D2-, and D4+, but more are coming soon!

    -maxpop=<cells>: set the maximum population during the search

    -c, -custom=<file>: use additional search constraints given in the
        provided C file, see lifeweb/src/vls/custom/ for examples

    -check-early-exhaustion=<boolean>: check early exhaustion (a row/column is
        all 0), this is enabled automatically in periodic mode when it is an
        oscillator or orthogonal spaceship, but not in other cases
    -no-check-early-exhaustion: force not checking early exhaustion, can be
        used in periodic mode to turn it off if it's broken

    -interval=<seconds>: set the progress reporting interval, default 1, also
        sets the max partial reporting interval if -partial-interval is not set

    -partials=<'none'|'cell'|'depth'>:
        type of max partials to report (default 'cell')
        none: report no max partials
        cell: report by number of set cells
        depth: report by search depth
    -partial-interval=<seconds>:
        set the minimum max partial reporting interval, default 1

    -n, -max-solutions=<count>: set the maximum solution count, by default
        it finds all solutions
    -no-show-solutions: disable showing solutions at all
    -allow-empty: allow the empty pattern as a solution
    -allow-duplicates: allow duplicate solutions to be reported
    -periodic=<'none'|speed>: set the searcher's knowledge of the periodicity
        of the pattern, this is used for duplicate solution filtering and
        checking early exhaustion, periodic mode enables this automatically
    -no-check-early-exhaustion: disable checking early exhaustion, only valid
        in periodic mode or if the -periodic option is provided 
    -allow-subperiod=<boolean>: allow subperiod solutions to be reported,
        default false in periodic mode, true in all other modes
    -cell-period-filter=<periods>:
        filter out cells of those periods when checking for duplicates
        the argument is a comma- or space-separated list of integers
`;

type OptionValue =
    | {type: 'flag'}
    | {type: 'boolean'}
    | {type: 'string'}
    | {type: 'number'}
    | {type: 'list', values: string[]}
;

const FLAG = {type: 'flag'} as const;
const BOOLEAN = {type: 'boolean'} as const;
const STRING = {type: 'string'} as const;
const NUMBER = {type: 'number'} as const;

function list<T extends string[]>(values: T): {type: 'list', values: T} {
    return {type: 'list', values};
}

const OPTIONS = {
    'help': FLAG,
    'h': 'help',
    'debug': NUMBER,
    'd': 'debug',
    'gdb': FLAG,
    'no-optimize': FLAG,
    'address-sanitizer': FLAG,
    'asan': 'address-sanitizer',
    'benchmark': NUMBER,
    // 'profile': NUMBER,
    'file': STRING,
    'f': 'file',
    'rulespace': list(['int', 'ot', 'map', 'hex-int', 'hex-ot', 'hex-map', 'vn-int', 'vn-ot', 'vn-map'] as const),
    'order': STRING,
    'o': 'order',
    'initial-value': list(['0', '1', 'same-0', 'same-1', 'different-0', 'different-1'] as const),
    'i': 'initial-value',
    'no-ot-optimization': FLAG,
    'no-cache-trs': FLAG,
    'check-times': FLAG,
    'clang': FLAG,
    'symmetry': STRING,
    's': 'symmetry',
    'maxpop': NUMBER,
    'custom': STRING,
    'c': 'custom',
    'interval': NUMBER,
    'partials': list(['none', 'cell', 'depth'] as const),
    'partial-interval': NUMBER,
    'max-solutions': NUMBER,
    'n': 'max-solutions',
    'no-show-solutions': FLAG,
    'allow-empty': FLAG,
    'allow-duplicates': FLAG,
    'periodic': STRING,
    'no-check-early-exhaustion': FLAG,
    'allow-subperiod': BOOLEAN,
    'cell-period-filter': STRING,
} satisfies {[key: string]: OptionValue | string};

type ValueOfOption<T extends OptionValue> =
    T extends {type: 'flag'} ? boolean :
    T extends {type: 'boolean'} ? boolean :
    T extends {type: 'string'} ? string :
    T extends {type: 'number'} ? number :
    T extends {type: 'list', values: (infer U)[]} ? U :
    never
;

type Options = typeof OPTIONS;
type Option = {[K in keyof Options]: Options[K] extends string ? never : K}[keyof Options];
type OptionData = {[K in Option]?: ValueOfOption<Options[K]>};


export interface ParseArgsData {
    posArgs: string[];
    options: OptionData;
    params2File: string;
    problemFile: string;
}

export async function parseArgs(argv: string[], paramsFile: string): Promise<ParseArgsData> {


let posArgs: string[] = [];
let options: OptionData = {};

for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (arg.match(/^-[-a-zA-Z]/)) {
        let value: string | undefined;
        if (arg.includes('=')) {
            let index = arg.indexOf('=');
            value = arg.slice(index + 1);
            arg = arg.slice(0, index);
        } else {
            value = undefined;
        }
        let originalArg = arg;
        arg = arg.toLowerCase();
        while (arg.startsWith('-')) {
            arg = arg.slice(1);
        }
        if (!(arg in OPTIONS)) {
            error(`Unrecognized option: '${arg}'`);
        }
        if (typeof (OPTIONS as any)[arg] === 'string') {
            arg = (OPTIONS as any)[arg];
        }
        let argData = (OPTIONS as any)[arg] as OptionValue;
        if (typeof argData === 'string') {
            error(`This error should not occur, please report it (double aliased argument)`);
        }
        if (argData.type === 'flag') {
            if (value !== undefined) {
                error(`Cannot provide value for argument ${originalArg}, is a flag argument`);
            }
            (options as any)[arg] = true;
        } else if (value === undefined) {
            error(`No value provided for argument ${originalArg} (to provide it, do '${originalArg}=<value>', not '${originalArg} value')`);
        } else if (argData.type === 'boolean') {
            if (value !== 'true' && value !== 'false') {
                error(`Invalid value for argument ${originalArg}, expected 'true' or 'false'`);
            }
            (options as any)[arg] = value === 'true';
        } else if (argData.type === 'string') {
            (options as any)[arg] = value;
        } else if (argData.type === 'number') {
            let num = Number(value);
            if (Number.isNaN(num)) {
                error(`Invalid numeric value for ${originalArg}: '${value}'`);
            }
            (options as any)[arg] = num;
        } else if (argData.type === 'list') {
            if (!argData.values.includes(value)) {
                let expected = '';
                for (let i = 0; i < argData.values.length; i++) {
                    let value = argData.values[i];
                    if (i === 0) {
                        expected += `${value}`;
                    } else if (i !== expected.length - 1) {
                        expected += `, ${value}`;
                    } else {
                        expected += `, or ${value}`;
                    }
                }
                error(`Invalid value for ${originalArg}: '${value}' (expected ${expected})`);
            }
            (options as any)[arg] = value;
        } else {
            error(`This error should not occur, please report it (invalid argument type)`);
        }
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

const MODES = ['periodic', 'parent', 'file', 'lls-file', 'catalyst'];

let rule = posArgs[0];
let base = createPattern(rule) as DataPattern;
if (!(base instanceof MAPPattern)) {
    error(`Rule must be a non-B0 INT rule`);
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
    if (!(maxBase instanceof MAPPattern)) {
        error(`Rule must be a non-B0 INT rule`);
    }
}


let grid: Grid;

let defaultSearchOrder = 't, y, x';
let searchOrderAliases: {[key: string]: string} = {};

let periodic: false | {dx: number, dy: number, period: number} | undefined;
if (options['periodic']) {
    if (options['periodic'] === 'none') {
        periodic = false;
    } else {
        periodic = parseSpeed(options['periodic']);
    }
} else {
    periodic = undefined;
}

if (mode === 'periodic') {

    if (posArgs.length !== 3) {
        error(`Expected 3 positional arguments for periodic mode (got ${posArgs.length})`);
    }
    let data = parseSpeed(posArgs[0]);
    let dx = -data.dy;
    let dy = -data.dx;
    let period = data.period;
    let width = parseInt(posArgs[1]);
    if (Number.isNaN(width)) {
        error(`Invalid width: '${posArgs[1]}'`);
    }
    let height = parseInt(posArgs[2]);
    if (Number.isNaN(height)) {
        error(`Invalid height: '${posArgs[2]}'`);
    }

    if (dx !== 0 || dy !== 0) {
        defaultSearchOrder = 'f2b';
        searchOrderAliases['f2b'] = `-(x*${dx} + y*${dy}), t`;
        searchOrderAliases['b2f'] = `(x*${dx} + y*${dy}), t`;
        searchOrderAliases['s2s'] = `(x*${dy} + y*${dx}), t`;
        searchOrderAliases['r-f2b'] = `-(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['r-b2f'] = `(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['r-s2s'] = `(x*${dy} + y*${dx}), -t`;
        searchOrderAliases['b-f2b'] = `t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['b-b2f'] = `t, (x*${dx} + y*${dy})`;
        searchOrderAliases['b-s2s'] = `t, (x*${dy} + y*${dx})`;
        searchOrderAliases['br-f2b'] = `-t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['br-b2f'] = `-t, (x*${dx} + y*${dy})`;
        searchOrderAliases['br-s2s'] = `-t, (x*${dy} + y*${dx})`;

    }

    // grid = new Grid(width, height, period + 1);
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

    grid = new Grid(width, height, period);
    for (let y = Math.max(0, -dy); y < height - Math.max(0, dy); y++) {
        for (let x = Math.max(0, -dx); x < width - Math.max(0, dx); x++) {
            grid.set(0, x, y, UNKNOWN);
        }
    }

    // let value1 = (await import('util')).inspect(grid.data.map(layer => layer.map(row => row.map(cell => cell.next))), {depth: Infinity});

    for (let t = 1; t < grid.gens; t++) {
        grid.fill(t, UNKNOWN);
    }
    grid.applyWrap(dx, dy);

    // return [{} as OptionData, value1 + '\n\n' + (await import('util')).inspect(grid.data.map(layer => layer.map(row => row.map(cell => cell.next))), {depth: Infinity})];

    periodic ??= {dx, dy, period};

} else if (mode === 'parent') {

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for parent mode (got ${posArgs.length})`);
    }
    let p = base.loadRLE(posArgs[0]).shrinkToFit();
    let width = p.width + 2;
    let height = p.height + 2;
    let xOffset = 1;
    let yOffset = 1;
    grid = new Grid(width, height, 2);
    grid.fill(0, UNKNOWN);
    grid.fill(1, OFF);
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            grid.set(1, x + xOffset, y + yOffset, p.get(x, y) ? ON : OFF);
        }
    }

} else if (mode === 'file') {

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for file mode (got ${posArgs.length})`);
    }
    grid = await runFile(posArgs[0]);

} else if (mode === 'lls-file') {

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for lls-file mode (got ${posArgs.length})`);
    }
    let fs = await import('node:fs/promises');
    let file = (await fs.readFile(posArgs[0])).toString();
    let data: string[][][] = [];
    let currentSection: string[][] = [];
    for (let line of file.split('\n')) {
        line = line.replaceAll(/\s+/g, ',');
        let parts = line.split(',').filter(x => x.length > 0);
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
    let width = data[0][0].length;
    if (!data.every(x => x.every(y => y.length === width))) {
        error(`Widths of all phases must match`);
    }
    let height = data[0].length;
    if (!data.every(x => x.length === height)) {
        error(`Heights of all phases must match`);
    }
    grid = new Grid(width, height, data.length);
    let vars: {[key: string]: number} = {};
    for (let t = 0; t < data.length; t++) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = data[t][y][x];
                let noClause = false;
                if (value.endsWith(`'`)) {
                    noClause = true;
                }
                let state: State;
                let variable: Variable | undefined = undefined;
                if (value === '0') {
                    state = OFF;
                } else if (value === '1') {
                    state = ON;
                } else if (value === '*') {
                    state = UNKNOWN;
                } else {
                    state = UNKNOWN;
                    if (value in vars) {
                        variable = vars[value];
                    } else {
                        let newVar = grid.getNewVar();
                        vars[value] = newVar;
                        variable = newVar;
                    }
                }
                grid.set(t, x, y, state, variable, undefined, noClause);
            }
        }
    }

} else if (mode === 'script') {

    if (posArgs.length !== 1) {
        error(`Expected 1 positional argument for script mode (got ${posArgs.length})`);
    }
    let value: unknown = (await import(posArgs[0])).default;
    if (!(value instanceof Grid)) {
        error(`Script does not default export a Grid`);
    }
    grid = value;

} else if (mode === 'catalyst') {

    if (posArgs.length < 3 || posArgs.length > 4) {
        error(`Expected 3 to 4 positional arguments for catalyst mode (got ${posArgs.length})`);
    }
    let startP: IdentityPattern;
    if (posArgs[0].endsWith('!')) {
        startP = IdentityPattern.loadRLE(posArgs[0]);
    } else {
        let {readFile} = await import('node:fs/promises');
        let p = parse((await readFile(posArgs[0])).toString());
        startP = new IdentityPattern(p.height, p.width, p.getData());
    }
    startP.data = startP.data.map(x => x === 6 ? 0 : x);
    let gens = parseInt(posArgs[1]);
    if (Number.isNaN(gens)) {
        error(`Invalid generations value (expected integer): '${posArgs[1]}'`);
    }
    let surviveGens = parseInt(posArgs[2]);
    if (Number.isNaN(surviveGens)) {
        error(`Invalid generations value (expected integer): '${posArgs[2]}'`);
    }
    gens += surviveGens;
    let period = 1;
    if (posArgs[3] !== undefined) {
        period = parseInt(posArgs[3]);
        if (Number.isNaN(period)) {
            error(`Invalid period value (expected integer): '${posArgs[3]}'`);
        }
    }

    grid = new Grid(startP.height, startP.width, gens + 1);

    for (let t = 2; t < grid.gens - 1; t++) {
        grid.fill(t, UNKNOWN);
    }

    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let start = startP.get(x, y);
            if (start === 0 || start === 1) {
                grid.set(0, x, y, start ? ON : OFF);
            } else if (start === 2) {
                let variables: number[] = [];
                for (let t = 0; t < period; t++) {
                    let variable = grid.getNewVar();
                    variables.push(variable);
                    grid.set(t, x, y, UNKNOWN, variable);
                }
                grid.set(period, x, y, UNKNOWN, variables[0]);
                for (let t = gens - surviveGens; t <= gens; t++) {
                    grid.set(t, x, y, UNKNOWN, variables[t % period]);
                }
            } else if (start === 3) {
                grid.set(0, x, y, ON);
                grid.set(1, x, y, ON);
                for (let i = 2; i < gens - surviveGens; i++) {
                    grid.set(i, x, y, UNKNOWN);
                }
                for (let t = gens - surviveGens; t <= gens; t++) {
                    grid.set(t, x, y, ON);
                }
            } else if (start === 4) {
                for (let t = 0; t < gens; t++) {
                    grid.set(t, x, y, OFF);
                }
            } else if (start === 5) {
                for (let t = 0; t < gens; t++) {
                    grid.set(t, x, y, ON);
                }
            }
        }
    }

    // fix catalyst edges
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let center = grid.get(1, x, y);
            if (center.state != UNKNOWN || center.variable !== undefined) {
                continue;
            }
            let found = false;
            for (let y2 = -1; y2 <= 1; y2++) {
                for (let x2 = -1; x2 <= 1; x2++) {
                    if (y2 === 0 && x2 === 0) {
                        continue;
                    }
                    let cell = grid.getAllowOOB(0, x + x2, y + y2);
                    if (!(cell.state === OFF || (cell.state === UNKNOWN && cell.variable !== undefined))) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                grid.set(1, x, y, OFF);
            }
        }
    }

} else {

    error(`Invalid mode: '${mode}'`);

}


if (options['symmetry']) {
    grid.applySymmetry(options['symmetry']);
}


grid.normalize();


let stateCounts: number[] = [];
for (let i = 0; i < 4; i++) {
    stateCounts.push(0);
}
for (let t = 0; t < grid.gens; t++) {
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            let state = grid.get(t, x, y).state;
            stateCounts[state]++;
        }
    }
}


function searchOrderSort(a: Coord, b: Coord, order: t.Expression[]): number {
    for (let metric of order) {
        let score = Number(runExpression(grid, a, metric)) - Number(runExpression(grid, b, metric));
        if (score !== 0) {
            return score;
        }
    }
    return 0;
}

function getSearchOrder(grid: Grid, order: string): Coord[] {
    let cells: Coord[] = [];
    for (let t = 0; t < grid.gens; t++) {
        for (let y = 0; y < grid.height; y++) {
            for (let x = 0; x < grid.width; x++) {
                let cell = grid.get(t, x, y);
                if (cell.state == UNKNOWN && cell.searchable) {
                    cells.push(coord(t, x, y));
                }
            }
        }
    }
    let parsedOrder: t.Expression[] = [];
    let metrics: string[] = [];
    let currentMetric = '';
    let parenLevel = 0;
    for (let char of order) {
        if (char === ',' && parenLevel === 0) {
            metrics.push(currentMetric);
            currentMetric = '';
        } else {
            if (char === '(' || char === '[' || char === '{') {
                parenLevel++;
            }
            if (char === ')' || char === ']' || char === '}') {
                parenLevel--;
            }
            currentMetric += char;
        }
    }
    metrics.push(currentMetric);
    for (let metric of metrics) {
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
    let sorted = cells.sort((a, b) => searchOrderSort(a, b, parsedOrder));
    let prevValue = sorted[0];
    let out: Coord[] = [prevValue];
    for (let value of sorted.slice(1)) {
        out.push(value);
        prevValue = value;
    }
    return out;
}

let searchOrder = options['order'] ?? defaultSearchOrder;
while (searchOrder in searchOrderAliases) {
    searchOrder = searchOrderAliases[searchOrder];
}

let searchOrderData = getSearchOrder(grid, searchOrder);


let defines: {[key: string]: undefined | string | number | boolean} = Object.create(null);

defines['DEBUG'] = options.debug;
defines['CUSTOM'] = options.custom ? JSON.stringify(options.custom) : undefined;

defines['SLOWER_SANITY_CHECKS'] = true;

const CONSTANT_DEFINES = new Set(['_POSIX_C_SOURCE']);

let params2Lines: string[] = [];
let foundDefines = new Set<string>();
for (let line of paramsFile.split('\n')) {
    let indent = '';
    while (line.startsWith(' ')) {
        indent += line[0];
        line = line.slice(1);
    }
    if (!(line.startsWith('#define ') || line.startsWith('// #define '))) {
        params2Lines.push(indent + line);
        continue;
    }
    let data = line.split(' ');
    if (data[0] === '//') {
        data = data.slice(1);
    }
    let name = data[1];
    if (!(name in defines)) {
        if (CONSTANT_DEFINES.has(name)) {
            params2Lines.push(indent + line);
            continue;
        } else {
            throw new Error(`This error should not occur, please report it (unrecognized #define: '${name}')`);
        }
    }
    if (CONSTANT_DEFINES.has(name)) {
        throw new Error(`This error should not occur, please report it (constant #define redefined: '${name}')`);
    }
    foundDefines.add(name);
    let value = defines[name];
    if (value === undefined) {
        params2Lines.push(indent + '// ' + data.join(' '));
    } else {
        params2Lines.push(indent + `#define ${name} ${value}`);
    }
}

for (let name of Object.keys(defines)) {
    if (!foundDefines.has(name)) {
        throw new Error(`This error should not occur, please report it (#define not found: '${name}')`);
    }
}


let gridStr = '';
let variableMap = new Map<number, number>();
let nextVar = 2;
for (let layer of grid.data) {
    gridStr += '\n';
    for (let row of layer) {
        for (let cell of row) {
            let value: number;
            if (cell.state == OFF) {
                value = -1;
            } else if (cell.state == ON) {
                value = 1;
            } else if (cell.state == UNKNOWN) {
                if (cell.variable) {
                    let mapped = variableMap.get(cell.variable);
                    if (mapped !== undefined) {
                        value = mapped;
                    } else {
                        value = nextVar;
                        nextVar++;
                        variableMap.set(cell.variable, value);
                    }
                } else {
                    value = nextVar;
                    nextVar++;
                }
            } else {
                throw new Error(`This error should not occur, please report it (invalid cell state)`);
            }
            gridStr += String(value) + ' ';
        }
        gridStr += '\n';
    }
}
gridStr = gridStr.trim();

let problemFile = `
width = ${grid.width}
height = ${grid.height}
gens = ${grid.gens}
var_count = ${grid.numVars}

grid:

${gridStr}

transitions:
${base.trs.join(' ')}

search_order (length = ${searchOrderData.length}):
${searchOrderData.map(c => `${c.t} ${c.x} ${c.y}`).join('\n')}

${options['initial-value'] !== undefined ? `initial_value = ${options['initial-value']}` : ''}

${(() => {
    if (!options['periodic']) {
        return '';
    }
    let data = parseSpeed(options['periodic']);
    return `${data.dx} ${data.dy} ${data.period}`;
})()}

`;

while (problemFile.includes('\n\n\n')) {
    problemFile = problemFile.replaceAll('\n\n\n', '\n\n');
}


return {
    posArgs,
    options,
    params2File: params2Lines.join('\n'),
    problemFile,
};

}


export async function main() {
    let path = await import('node:path');
    function getPath(file: string): string {
        return path.relative(process.cwd(), path.join(import.meta.dirname, '..', '..', file));
    }
    let fs = await import('node:fs/promises');
    let {existsSync} = await import('node:fs');
    let {execSync} = (await import('node:child_process'));
    let execPath = getPath('vls_compiled');
    if (!(execPath.startsWith('.') || execPath.startsWith('..') || execPath.startsWith('/'))) {
        execPath = './' + execPath;
    }
    let paramsFile = (await fs.readFile(getPath('src/vls/params.h'))).toString();
    let data = await parseArgs(process.argv, paramsFile);
    let options = data.options;
    let params2Path = getPath('src/vls/params2.h');
    let oldParams2: string;
    if (!existsSync(params2Path)) {
        oldParams2 = '';
    } else {
        oldParams2 = (await fs.readFile(getPath('src/vls/params2.h'))).toString();
    }
    let recompile = false;
    if (existsSync(execPath)) {
        let compiledCodeChangeTime = Number(execSync(`stat -c '%Y' ${execPath}`).toString());
        let codeChangeTimes = execSync(`stat -c '%Y' ${import.meta.dirname}/*`).toString();
        for (let time of codeChangeTimes.split('\n')) {
            // subtract 2 to account for rounding errors and off-by-one errors
            if (Number(time) > compiledCodeChangeTime - 2) {
                recompile = true;
                break;
            }
        }
    } else {
        recompile = true;
    }
    if (data.params2File !== oldParams2) {
        recompile = true;
        await fs.writeFile(getPath('src/vls/params2.h'), data.params2File);
    }
    let problemPath = getPath('vls_problem.txt');
    await fs.writeFile(problemPath, data.problemFile);
    let commandsToRun: string[] = [];
    if (recompile) {
        let command = options['clang'] ? `clang -std=c23` : `gcc -std=c2x`;
        command += ` -fdiagnostics-color=always`;
        // strict mode
        command += ` -Wall -Werror -Wpedantic -Wextra -Wno-unused-function -Wno-unknown-pragmas -Wno-gnu-zero-variadic-macro-arguments -Wno-gnu-binary-literal`;
        // features
        command += ` -g`;
        if (!options['no-optimize']) {
            command += ` -O3 -march=native -mtune=native -flto -fno-stack-protector -fomit-frame-pointer`;
        }
        if (options['address-sanitizer']) {
            command += ` -fsanitize=address`;
        }
        command += ` -o '${execPath}' '${getPath('src/vls/index.c')}'`;
        commandsToRun.push(command);
    }
    let execCommand = `${execPath} '${problemPath}'`;
    if (options['gdb']) {
        commandsToRun.push(`gdb ${execCommand}`);
    } else {
        if (options['file']) {
            commandsToRun.push(`stdbuf -oL ${execCommand} | tee '${options['file']}'`);
        } else {
            commandsToRun.push(execCommand);
        }
    }
    try {
        for (let command of commandsToRun) {
            execSync(command, {stdio: 'inherit'});
        }
    } catch (error) {
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
