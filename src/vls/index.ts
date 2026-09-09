
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

    --interval <seconds>: set the progress reporting interval

    --partial-type <'none'|'cell'|'start'>:
        type of max partials to report (default 'cell')
        none: report no max partials
        cell: report by number of set cells
        start: report by number of correct cells at start of search order
    --partial-interval <seconds>: set the minimum partial reporting interval

    --file <file>: also write output to that file

    --rulespace <rulespace>: set the rulespace, options:
        int, ot

    -l, --lls <file>: instead of searching, run LLS on the given file
        must be a directory containing a file called "lls" or "lss.py"

    -m, --method <method>:
        Set the method used for searching

        Cell-by-cell method:
        Syntax is "cell <search-order>"
        the search order is defined as a comma-separated list of metrics
        later metrics are tiebreakers for earlier metrics
        metrics are normal mathematical expressions
        use variables "x", "y", and "t" for x, y, and time respectively
        also you can use aliases like (r?g?-)(f2b|b2f|s2s)
        the default value is g-f2b for spaceships and 't, y, x' otherwise

    -i, --initial-value <value>:
        set the initial tested value for cells, default 1

    -n, --max-solutions: set the maximum solution count, default infinity
    --no-show-solutions: Disable showing solutions at all.

    --top <type>
    --bottom <type>
    --left <type>
    --right <type>
        set edge behavior, can either be 'none', 'even', 'odd', or 'wrap'

    -s <symmetry>, --symmetry <symmetry>
        apply a symmetry to the pattern
        this is different from the edge behaviors above!

    --maxpop <cells>: set the maximum population during the search
`;

type OptionValue = true | 'string' | 'number' | Set<string>;

const OPTIONS = {
    'help': true,
    'debug': 'number',
    'gdb': true,
    'lls': 'string',
    'benchmark': 'string',
    'profile': true,
    'interval': 'number',
    'partial-type': new Set(['none', 'cell', 'start'] as const),
    'partial-interval': 'number',
    'file': 'string',
    'rulespace': new Set(['int', 'ot'] as const),
    'method': 'string',
    'initial-value': new Set(['0', '1', 'same-0', 'same-1', 'different-0', 'different-1']),
    'max-solutions': 'number',
    'no-show-solutions': true,
    'top': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'bottom': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'left': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'right': new Set(['none', 'even', 'odd', 'wrap'] as const),
    'symmetry': 'string',
    'maxpop': 'number',
} as const satisfies {[key: string]: OptionValue};

type Options = typeof OPTIONS;
type Option = keyof Options;

const OPTION_ALIASES: {[key: string]: Option} = {
    'h': 'help',
    'd': 'debug',
    'l': 'lls',
    'm': 'method',
    'i': 'initial-value',
    'n': 'max-solutions',
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
;

type ValueOfOption<T extends OptionValue> =
    T extends true ? true :
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

if (mode === 'periodic') {

    if (posArgs.length !== 3) {
        error(`Expected 3 positional arguments for periodic mode (got ${posArgs.length})`);
    }
    let {dx, dy, period} = parseSpeed(posArgs[0]);
    let width = parseInt(posArgs[1]);
    let height = parseInt(posArgs[2]);
    if (Number.isNaN(width)) {
        error(`Invalid width: '${posArgs[1]}'`);
    }
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
    for (let y = 0; y < height - dy; y++) {
        for (let x = 0; x < width - dx; x++) {
            grid.set(0, x, y, UNKNOWN);
        }
    }
    for (let t = 1; t < grid.gens; t++) {
        grid.fill(t, UNKNOWN);
    }
    grid.wrap = [dx, dy];

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


function searchOrderSort(a: [number, number, number], b: [number, number, number], order: t.Expression[]): number {
    for (let metric of order) {
        let score = Number(runExpression(a, metric)) - Number(runExpression(b, metric));
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

let out: string[] = [];
for (let line of code.split('\n')) {
    if (line.startsWith('typedef') && line.endsWith('index_t;')) {
        let maxValue = (grid.width + 4) * (grid.height + 4) * grid.gens;
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
        line = line.slice(0, line.indexOf('{')) + gridToString(grid, 'state') + ';';
    } else if (line.startsWith('static const var_t initial_vars[GENS][HEIGHT][WIDTH] = ')) {
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
    } else if (line.startsWith('index_t search_order[TOTAL_UNKNOWN_CELLS][3] = ')) {
        if (method === 'cell') {
            if (searchOrder === undefined) {
                throw new Error('This error should not occur (no search order but cell method is used), please report this error');
            }
            line = line.slice(0, line.indexOf('{'));
            line += '{' + getSearchOrder(grid, searchOrder, false).map(x => `{${x[0]}, ${x[1] + 2}, ${x[2] + 2}}`).join(', ') + '};';
        } else {
            continue;
        }
    } else if (line.startsWith('const index_t initial_path[INITIAL_PATH_LENGTH][3] = ')) {
        if (method === 'path') {
            line = line.slice(0, line.indexOf('{'));
            line += '{' + initialPath.map(x => `{${x[0]}, ${x[1] + 2}, ${x[2] + 2}}`).join(', ') + '};';
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
    if (name === 'WIDTH') {
        value = grid.width + 4;
    } else if (name === 'HEIGHT') {
        value = grid.height + 4;
    } else if (name === 'GENS') {
        value = grid.gens;
    } else if (name === 'VARIABLES') {
        value = grid.numVars > 0;
    } else if (name === 'VAR_COUNT') {
        value = grid.numVars + 1;
    } else if (name === 'TOTAL_UNKNOWN_CELLS') {
        value = stateCounts[UNKNOWN];
    } else if (name === 'HAS_DONT_CARES') {
        value = stateCounts[DONT_CARE] > 0;
    } else if (name === 'TIME_WRAP') {
        value = Boolean(grid.wrap);
    } else if (name === 'TIME_WRAP_DX') {
        value = grid.wrap ? grid.wrap[0] : 67;
    } else if (name === 'TIME_WRAP_DY') {
        value = grid.wrap ? grid.wrap[1] : 67;
    } else if (name === 'MULTI_RULE') {
        value = multiRule;
    } else if (name === 'IS_OT') {
        value = false;
        // if (multiRule) {
        //     value = false;
        // } else {
        //     let rule = base.rule.str;
        //     let match = rule.match(/^B(\d+)\/S(\d+)$/);
        //     if (!match) {
        //         value = false;
        //     } else {
        //         let found = false;
        //         for (let value of [match[1], match[2]]) {
        //             let prevChar = value[0];
        //             for (let char of value.slice(1)) {
        //                 if (char !== String(Number(prevChar) + 1)) {
        //                     found = true;
        //                     break;
        //                 }
        //                 prevChar = char;
        //             }
        //             if (found) {
        //                 break;
        //             }
        //         }
        //         if (!found) {
        //             value = true;
        //         } else {
        //             value = false;
        //         }
        //     }
        // }
    // } else if (name === 'STATES') {
    //     value = base.rule.states;
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
        value = `""`;
    } else if (name === 'WRAP_WIDTH') {
        value = grid.width;
    } else if (name === 'WRAP_HEIGHT') {
        value = grid.height;
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
        let file = options['lls'];
        if (file === undefined) {
            comment = true;
            value = '"path/to/lls"';
        } else {
            let path = await import('node:path');
            let fs = await import('node:fs/promises');
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


const FLAGS = `--std=c2x -Wall -Wextra -Werror -Wpedantic -Wno-gnu-binary-literal -Wno-unused-function -Wno-unknown-pragmas -g -O3 -march=native -mtune=native -flto -fno-stack-protector -fomit-frame-pointer`;

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
