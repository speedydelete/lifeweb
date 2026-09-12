
import * as path from 'node:path';

import * as t from '@babel/types';
import {parseExpression} from '@babel/parser';

import {DataPattern, IdentityPattern, MAPPattern, parseSpeed, createPattern} from '../core/index.js';
import {error, UNKNOWN, OFF, ON, DONT_CARE, State, Variable, SEARCHABLE, Cell, Grid, runExpression, runFile} from './compiler.js';


const HELP = `
Usage: ./search <rule> <mode> <options>
Or, for multi-rule searching: ./search <minrule> <maxrule> <mode> <options>

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

Options:

    -h, --help: show this help message

    -d, --debug <level>: set the debug level

    --gdb: run gdb

    --benchmark <iterations>: run benchmarking

    --profile: enables profile based optimization,
        recompiles and reruns after 5 seconds

    -f, --file <file>: also write output to that file

    --rulespace <rulespace>: set the rulespace for multi-rule searching,
        options: int, ot, map, hex-int, hex-ot, hex-map, vn-int, vn-ot, vn-map

    -o, --order <order>: set the search order

        The search order is defined as a comma-separated list of metrics, later
        metrics are tiebreakers for earlier metrics. Metrics are normal
        mathematical expressions, use variables 'x', 'y', and 't' for x, y, and
        time respectively.

        Also, you can use aliases like (r?g?-)(f2b|b2f|s2s), g means find every
        generation of the row before moving on, and r means reverse the order of
        the search in time.

        The default search order is f2b for spaceships and 't, y, x' otherwise.

    -i, --initial-value <value>:
        set the initial tested value for cells, default 1

    --no-ot-optimization: disable optimization for OT rules
    --no-cache-trs: disable implication transition caching
    --check-times: keep track of when each cell's implications was last checked,
        can make it faster can make it slower

    -s <symmetry>, --symmetry <symmetry>: apply a symmetry to the pattern
        currently supported symmetries are D2|, D2-, and D4+, but more are
        coming soon!

    --maxpop <cells>: set the maximum population during the search

    -c, --custom <file>: use additional search constraints given in
        the provided C file, see lifeweb/src/vls/custom/ for examples

    --check-early-exhaustion: check early exhaustion (a row/column is all 0),
        this is enabled automatically in periodic mode, but not in other modes
    --no-check-early-exhaustion: force not checking early exhaustion, can be
        used in periodic mode to turn it off

    --interval <seconds>: set the progress reporting interval, default 1

    --partial-type <'none'|'cell'|'start'>:
        type of max partials to report (default 'cell')
        none: report no max partials
        cell: report by number of set cells
        start: report by number of correct cells at start of search order
    --partial-interval <seconds>:
        set the minimum partial reporting interval, default 1

    -n, --max-solutions: set the maximum solution count, default infinity
    --no-show-solutions: disable showing solutions at all
    --allow-empty: allow the empty pattern as a solution
    --allow-duplicates: allow duplicate solutions to be reported
    --allow-subperiod: allow subperiod solutions to be reported
    --cell-period-filter <periods>:
        filter out cells of those periods when checking for duplicates
        the argument is a comma- or space-separated list of integers
`;

type OptionValue = 'boolean' | 'string' | 'number' | Set<string>;

const OPTIONS = {
    'help': 'boolean',
    'debug': 'number',
    'gdb': 'boolean',
    'benchmark': 'string',
    'profile': 'boolean',
    'file': 'string',
    'rulespace': new Set(['int', 'ot', 'map', 'hex-int', 'hex-ot', 'hex-map', 'vn-int', 'vn-ot', 'vn-map'] as const),
    'order': 'string',
    'initial-value': new Set(['0', '1', 'same-0', 'same-1', 'different-0', 'different-1']),
    'no-ot-optimization': 'boolean',
    'no-cache-trs': 'boolean',
    'check-times': 'boolean',
    'symmetry': 'string',
    'maxpop': 'number',
    'custom': 'string',
    'check-early-exhaustion': 'boolean',
    'no-check-early-exhaustion': 'boolean',
    'interval': 'number',
    'partial-type': new Set(['none', 'cell', 'start'] as const),
    'partial-interval': 'number',
    'max-solutions': 'number',
    'no-show-solutions': 'boolean',
    'allow-empty': 'boolean',
    'allow-duplicates': 'boolean',
    'allow-subperiod': 'boolean',
    'cell-period-filter': 'string',
} as const satisfies {[key: string]: OptionValue};

type Options = typeof OPTIONS;
type Option = keyof Options;

const OPTION_ALIASES: {[key: string]: Option} = {
    'h': 'help',
    'd': 'debug',
    'f': 'file',
    's': 'symmetry',
    'c': 'custom',
    'o': 'order',
    'i': 'initial-value',
    'n': 'max-solutions',
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
;

type ValueOfOption<T extends OptionValue> =
    T extends 'boolean' ? true :
    T extends 'string' ? string :
    T extends 'number' ? number :
    T extends Set<infer T> ? T :
    T extends [true, infer T extends 'string' | 'number' | Set<string>] ? ValueOfOption<T>[] :
    T extends readonly ('string' | 'number' | Set<string>)[] ? ValueOfArrayOption<T> :
    never
;

export type OptionData = {[K in Option]?: ValueOfOption<Options[K]>};


export async function transformCode(argv: string[], code: string): Promise<[OptionData, string]> {


let posArgs: string[] = [];
let options: OptionData = {};

function getOption(originalArg: string, value: OptionValue, i: number): [OptionData[Option], number] {
    if (value === 'boolean') {
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
    } else {
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
                for (let item of data[0]) {
                    (options[option] as any[]).push(item);
                }
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

let checkEarlyExhaustion = false;

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
        searchOrderAliases['f2b'] = `t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['b2f'] = `t, (x*${dx} + y*${dy})`;
        searchOrderAliases['s2s'] = `t, (x*${dy} + y*${dx})`;
        searchOrderAliases['r-f2b'] = `-t, -(x*${dx} + y*${dy})`;
        searchOrderAliases['r-b2f'] = `-t, (x*${dx} + y*${dy})`;
        searchOrderAliases['r-s2s'] = `-t, (x*${dy} + y*${dx})`;
        searchOrderAliases['g-f2b'] = `-(x*${dx} + y*${dy}), t`;
        searchOrderAliases['g-b2f'] = `(x*${dx} + y*${dy}), t`;
        searchOrderAliases['g-s2s'] = `(x*${dy} + y*${dx}), t`;
        searchOrderAliases['gr-f2b'] = `-(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['gr-b2f'] = `(x*${dx} + y*${dy}), -t`;
        searchOrderAliases['gr-s2s'] = `(x*${dy} + y*${dx}), -t`;
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
    for (let t = 1; t < grid.gens; t++) {
        grid.fill(t, UNKNOWN);
    }
    grid.wrap = [dx, dy];

    if (dx === 0 || dy === 0) {
        checkEarlyExhaustion = true;
    }

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
                let state: State;
                let variable: Variable | undefined = undefined;
                if (value === '0') {
                    state = OFF;
                } else if (value === '1') {
                    state = ON;
                } else if (value === '*') {
                    state = UNKNOWN;
                } else if (value === `'`) {
                    state = DONT_CARE;
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
                grid.set(t, x, y, state, variable);
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
                grid.set(0, x, y, start ? ON : OFF);
                for (let i = 0; i < genValues.length; i++) {
                    grid.set(i + 1, x, y, genValues[i] ? ON : OFF);
                }
            } else if (start === 2 || start === 8) {
                let variables: number[] = [];
                for (let t = 0; t < period; t++) {
                    let variable = grid.getNewVar();
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
                grid.set(0, x, y, ON);
                for (let i = 0; i < genValues.length; i++) {
                    grid.set(i + 1, x, y, genValues[i] ? ON : OFF);
                }
                grid.set(gens, x, y, ON);
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

    let toSet: [number, number][] = [];
    for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
            if (!(
                    grid.get(gens, x, y).variable !== undefined
                 || grid.get(gens, x - 1, y - 1).state !== OFF
                 || grid.get(gens, x - 1, y).state !== OFF
                 || grid.get(gens, x - 1, y + 1).state !== OFF
                 || grid.get(gens, x, y - 1).state !== OFF
                 || grid.get(gens, x, y).state !== OFF
                 || grid.get(gens, x, y + 1).state !== OFF
                 || grid.get(gens, x + 1, y - 1).state !== OFF
                 || grid.get(gens, x + 1, y).state !== OFF
                 || grid.get(gens, x + 1, y + 1).state !== OFF
                )
            ) {
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



function searchOrderSort(a: [number, number, number], b: [number, number, number], order: t.Expression[]): number {
    for (let metric of order) {
        let score = Number(runExpression(a, metric)) - Number(runExpression(b, metric));
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
                let cell = grid.get(t, x, y);
                if (cell.state == UNKNOWN && cell.settable == SEARCHABLE) {
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
    let sorted = cells.sort((a, b) => searchOrderSort(a, b, parsedOrder));
    let prevValue = sorted[0];
    let out: [number, number, number][] = [prevValue];
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

defines['WIDTH'] = grid.width + 4;
defines['HEIGHT'] = grid.height + 4;
defines['GENS'] = grid.gens;

defines['VARIABLES'] = grid.numVars > 0;
// add 1 because the C program treats 0 as 'no variable'
// but it still 'counts' for VAR_COUNT purposes
defines['VAR_COUNT'] = grid.numVars + 1;

defines['TOTAL_UNKNOWN_CELLS'] = stateCounts[UNKNOWN];

defines['HAS_DONT_CARES'] = stateCounts[DONT_CARE] > 0;

defines['TIME_WRAP'] = Boolean(grid.wrap);
defines['TIME_WRAP_DX'] = grid.wrap ? grid.wrap[0] : undefined;
defines['TIME_WRAP_DY'] = grid.wrap ? grid.wrap[1] : undefined;

defines['MULTI_RULE'] = multiRule;
if (options['no-ot-optimization'] || multiRule) {
    defines['IS_OT'] = false;
} else {
    defines['IS_OT'] = Boolean(base.rule.str.match(/^B(\d+)\/S(\d+)$/));
}
defines['RULESPACE'] = `RULESPACE_${(options['rulespace'] ?? 'int').toUpperCase().replaceAll('-', '_')}`;
defines['SPECIAL_AFTER_RULE'] = `""`;

defines['INITIAL_VALUE'] = 'IV_' + (options['initial-value'] ?? '1').toUpperCase().replaceAll('-', '_');

defines['CACHE_IMPLICATION_TRS'] = !options['no-cache-trs'];

defines['KEEP_LAST_CHECKED_TIME'] = Boolean(options['check-times']);

defines['MAXPOP'] = options['maxpop'];

defines['CUSTOM'] = options['custom'] !== undefined ? `"${path.resolve(options['custom'])}"` : undefined;

defines['CHECK_EARLY_EXHAUSTION'] = Boolean(options['no-check-early-exhaustion'] ? false : (options['check-early-exhaustion'] || checkEarlyExhaustion));

defines['SHOW_SOLUTIONS'] = !options['no-show-solutions'];
defines['MAX_SOLUTIONS'] = options['max-solutions'];
defines['CHECK_EMPTY'] = !options['allow-empty'];;
defines['FILTER_DUPLICATES'] = !options['allow-duplicates'];
defines['FILTER_SUBPERIOD'] = !options['allow-subperiod'];
if (options['cell-period-filter']) {
    defines['CELL_PERIOD_FILTER'] = `{${options['cell-period-filter'].split(/[, ]+/).map(Number).join(', ')}}`;
} else {
    defines['CELL_PERIOD_FILTER'] = undefined;
}

defines['REPORTING_INTERVAL'] = options['interval'] ?? 1;
defines['MAX_PARTIAL_TYPE'] = `MAX_PARTIAL_TYPE_${(options['partial-type'] ?? 'cell').toUpperCase()}`;
defines['MAX_PARTIAL_REPORTING_INTERVAL'] = options['partial-interval'] ?? 1;

defines['BENCHMARK'] = options['benchmark'];

defines['DEBUG'] = options['debug'] ?? 0;


function gridToString(grid: Grid, field: keyof Cell): string {
    let off: number;
    if (field === 'state') {
        off = OFF;
    } else if (field === 'variable') {
        off = 0;
    } else {
        off = SEARCHABLE;
    }
    let emptyRow: number[] = [];
    for (let x = 0; x < grid.width + 4; x++) {
        emptyRow.push(off);
    }
    let out: number[][][] = [];
    for (let t = 0; t < grid.gens; t++) {
        let layer: number[][] = [structuredClone(emptyRow), structuredClone(emptyRow)];
        for (let y = 0; y < grid.height; y++) {
            let row: number[] = [off, off];
            for (let x = 0; x < grid.width; x++) {
                row.push(grid.get(t, x, y)[field] ?? 0);
            }
            row.push(off, off);
            layer.push(row);
        }
        layer.push(structuredClone(emptyRow), structuredClone(emptyRow));
        out.push(layer);
    }
    // if (useVars) {
    //     console.log(data);
    //     console.log(`{${out.map(grid => `{${grid.map(row => `{${row.join(', ')}}`).join(', ')}}`).join(', ')}}`);
    // }
    return `{${out.map(grid => `{${grid.map(row => `{${row.join(', ')}}`).join(', ')}}`).join(', ')}}`;
}

function getMinUintType(maxValue: number): string {
    // add 1 so you can loop on them
    maxValue += 1;
    if (maxValue > 2**32 - 1) {
        return 'uint64_t';
    } else if (maxValue > 65536) {
        return 'uint32_t';
    } else if (maxValue > 256) {
        return 'uint16_t';
    } else {
        return 'uint8_t';
    }
}

const CONSTANT_DEFINES = new Set([
    'UNKNOWN', 'OFF', 'ON', 'DONT_CARE',
    'PADDING',
    'SEARCHABLE', 'NOT_SEARCHABLE', 'NOT_SETTABLE',
    'TRS_RULE_DEPENDENT',
    'RULESPACE_INT', 'RULESPACE_OT', 'RULESPACE_MAP', 'RULESPACE_HEX_INT', 'RULESPACE_HEX_OT', 'RULESPACE_HEX_MAP', 'RULESPACE_VN_INT', 'RULESPACE_VN_OT', 'RULESPACE_VN_MAP',
    'IV_0', 'IV_1', 'IV_SAME_0', 'IV_SAME_1', 'IV_DIFFERENT_0', 'IV_DIFFERENT_1',
    'MAX_PARTIAL_TYPE_NONE', 'MAX_PARTIAL_TYPE_CELL', 'MAX_PARTIAL_TYPE_START',
]);

let out: string[] = [];
let foundDefines = new Set<string>();
for (let line of code.split('\n')) {
    if (line.startsWith('typedef') && line.endsWith('Index;')) {
        line = `typedef ${getMinUintType((grid.width + 4) * (grid.height + 4) * grid.gens)} Index;`;
    } else if (line.startsWith('typedef') && line.endsWith('Variable;')) {
        line = `typedef ${getMinUintType(grid.numVars + 1)} Variable;`;
    } else if (line.startsWith('static const CellValue initial_grid[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, 'state') + ';';
    } else if (line.startsWith('static const Variable initial_vars[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, 'variable') + ';';
    } else if (line.startsWith('static const uint8_t initial_settable[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, 'settable') + ';';
    } else if (line.startsWith(`uint8_t trs[512] = `)) {
        let trs = base.trs.slice();
        if (multiRule) {
            for (let i = 0; i < 512; i++) {
                if (trs[i] !== maxBase.trs[i]) {
                    // TRS_RULE_DEPENDANT
                    trs[i] = 4;
                }
            }
        }
        line = line.slice(0, line.indexOf('{'))+ '{' + trs.join(', ') + '};';
    } else if (line.startsWith('Index search_order[TOTAL_UNKNOWN_CELLS][3] = ')) {
        line = line.slice(0, line.indexOf('{'));
        line += '{' + searchOrderData.map(x => `{${x[0]}, ${x[1] + 2}, ${x[2] + 2}}`).join(', ') + '};';
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
    if (!(name in defines)) {
        if (CONSTANT_DEFINES.has(name)) {
            out.push(line);
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
        out.push('// ' + data.join(' '));
    } else {
        out.push(`#define ${name} ${value}`);
    }
}

for (let name of Object.keys(defines)) {
    if (!foundDefines.has(name)) {
        throw new Error(`This error should not occur, please report it (#define not found: '${name}')`);
    }
}

return [options, out.join('\n')];


}


const FLAGS = `--std=c2x -Wall -Wextra -Werror -Wpedantic -Wno-gnu-binary-literal -Wno-unused-function -Wno-unknown-pragmas -Wno-gnu-zero-variadic-macro-arguments -g -O3 -march=native -mtune=native -flto -fno-stack-protector -fno-omit-frame-pointer`;

const PROFILE_SECONDS = 5;

export async function main() {
    let path = await import('node:path');
    function getPath(file: string): string {
        return path.relative(process.cwd(), path.join(import.meta.dirname, '..', '..', file));
    }
    let fs = await import('node:fs/promises');
    let {execSync, spawnSync} = (await import('node:child_process'));
    let execPath = getPath('vls_compiled');
    if (!(execPath.startsWith('.') || execPath.startsWith('..') || execPath.startsWith('/'))) {
        execPath = './' + execPath;
    }
    let source = (await fs.readFile(getPath('src/vls/params.h'))).toString();
    let [options, code] = await transformCode(process.argv, source);
    await fs.writeFile(getPath('src/vls/params2.h'), code);
    try {
        execSync(`clang ${FLAGS} ${options['profile'] ? '-fprofile-instr-generate -DFOR_PROFILE ' : ''} -o '${execPath}' '${getPath('src/vls/index.c')}'`, {stdio: 'inherit'});
        if (options['profile']) {
            console.log(`Running for up to ${PROFILE_SECONDS} seconds to gather profiling data`);
            spawnSync(`${execPath}`, {timeout: PROFILE_SECONDS * 1000, killSignal: 'SIGTERM'});
            console.log(`Profiling data gathered, recompiling`);
            execSync(`llvm-profdata merge -output=vls.profdata default.profraw`);
            execSync(`clang ${FLAGS} -fprofile-instr-use=vls.profdata -o '${execPath}' '${getPath('src/vls/index.c')}'`, {stdio: 'inherit'});
        }
        execSync(`${options['file'] ? `stdbuf -oL ` : ''}${options['gdb'] ? 'gdb ' : ''}${execPath}${options['file'] ? ` | tee ${options['file']}` : ''}`, {stdio: 'inherit'});
    } catch (error) {
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
