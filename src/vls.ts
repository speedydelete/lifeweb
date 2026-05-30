
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {MAPPattern, parseSpeed, createPattern} from './core/index.js';


function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls --help for help`);
    process.exit(1);
}

const HELP = `
Usage: ./search <rule> <mode> <options>

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

Options:

    -h, --help: show this help message

    -d, --debug <level>: set the debug level
    -g, --gdb: run gdb instead and compile with debugging symbols

    -o, --search-order <order>:
        Set the order in which cells are checked
        defined as a comma-separated list of metrics
        later metrics are tiebreakers for earlier metrics
        metrics can be any valid expression that it understands
        it knows about +, -, *, /, ^ (exponentiation)
        also it supports unary + and - and parentheses
        also you can use aliases like f2b, b2f, s2s, etc
        the default value is f2b for spaceships and 't, y, x' otherwise

    -i, --initial-value <value>:
        set the initial value of unknown cells, default 0

    --maxpop <cells>: Set the maximum population during the search.
`;

const OPTIONS = {
    'help': true,
    'debug': 'number',
    'gdb': true,
    'search-order': 'string',
    'initial-value': 'number',
    'maxpop': 'number',
} as const satisfies {[key: string]: true | 'string' | 'number'};

type Options = typeof OPTIONS;
type Option = keyof Options;

const OPTION_ALIASES: {[key: string]: Option} = {
    'h': 'help',
    'd': 'debug',
    'g': 'gdb',
    'o': 'search-order',
    'i': 'initial-value',
};


let argv = process.argv;

let posArgs: string[] = [];
let options: Partial<{[K in Option]: Options[K] extends true ? true : (Options[K] extends 'string' ? string : (Options[K] extends 'number' ? number : never))}> = {}

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
        if (value === true) {
            (options[option] as true) = true;
        } else if (value === 'string') {
            if (i === argv.length - 1) {
                error(`Expected argument for option '${originalArg}'`);
            }
            let arg = argv[++i];
            (options[option] as string) = arg;
        } else {
            if (i === argv.length - 1) {
                error(`Expected argument for option '${originalArg}'`);
            }
            let arg = argv[++i];
            let num = parseFloat(arg);
            if (Number.isNaN(num)) {
                error(`Expected numeric argument for option '${originalArg}'`);
            }
            (options[option] as number) = num;
        }
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

let rule = posArgs[0];
let base = createPattern(rule);
if (!(base instanceof MAPPattern)) {
    error(`Rule must be a non-B0 INT or MAP rule`);
}

let mode = posArgs[1];

posArgs = posArgs.slice(2);


const UNKNOWN = 2;

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

    get(t: number, x: number, y: number): number {
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

}


let grid: Grid;

let defaultSearchOrder = 't, y, x';
let searchOrderAliases: {[key: string]: string} = {};

if (mode === 'periodic') {

    if (posArgs.length !== 3) {
        error(`Expected 4 positional arguments for periodic mode`);
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
                mainAxis = '-x';
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
    grid = new Grid(height + dy, width + dx, period + 1);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let value = grid.getVar();
            grid.set(0, x, y, value);
            grid.set(period, x + dx, y + dy, value);
        }
    }
    for (let t = 1; t < period; t++) {
        grid.fill(t, UNKNOWN);
    }

} else if (mode === 'parent') {

    let p = base.loadRLE(posArgs[0]);
    let height = parseInt(posArgs[1]);
    let width = parseInt(posArgs[2]);
    if (Number.isNaN(height)) {
        error(`Invalid height: '${posArgs[1]}'`);
    }
    if (Number.isNaN(width)) {
        error(`Invalid width: '${posArgs[2]}'`);
    }
    let xOffset = parseInt(posArgs[3]);
    if (Number.isNaN(xOffset)) {
        xOffset = 0;
    }
    let yOffset = parseInt(posArgs[4]);
    if (Number.isNaN(yOffset)) {
        yOffset = 0;
    }
    grid = new Grid(height, width, 2);
    grid.fill(0, UNKNOWN);
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            grid.set(1, x + xOffset, y + yOffset, p.get(x, y));
        }
    }

} else if (mode === 'file') {

    let file = (await fs.readFile(posArgs[0])).toString();
    let data: (string | number)[][][] = [];
    let currentSection: (string | number)[][] = [];
    for (let line of file.split('\n')) {
        line = line.replaceAll(/\s+/g, '');
        let parts = line.split(',').filter(x => x.length > 0).map(x => x.match(/^\d+$/) ? Number(x) : x);
        if (parts.length === 0) {
            data.push(currentSection);
            currentSection = [];
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

} else {

    error(`Invalid mode: '${mode}'`);

}


const NUMBER_REGEX = /([0-9.e]+|0x[0-9a-fA-F.]+|0b[01.e]+|0o[0-7.e]+|-?NaN|-?Infinity)/;

type ParsedMetric = (string | number)[];

const OPERATORS: {[key: string]: [number, 'left' | 'right']} = {
    'u+': [3, 'right'],
    'u-': [3, 'right'],
    '^': [2, 'right'],
    '*': [1, 'left'],
    '/': [1, 'left'],
    '+': [0, 'left'],
    '-': [0, 'left'],
};

function parseMetric(metric: string): ParsedMetric {
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
                    error(`Invalid search order metric (mismatched parentheses): '${metric}'`)
                }
                out.push(op);
                if (ops[ops.length - 1] !== '(') {
                    error(`Invalid search order metric (please report what you did to cause this error, idk what could cause it): '${metric}'`);
                }
                ops.pop();
            }
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
                error(`No argument for unary operator in search order metric`);
            }
            stack.push(-value);
        } else {
            let b = stack.pop();
            let a = stack.pop();
            if (a === undefined || b === undefined) {
                error(`No argument for unary operator in search order metric`);
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

let code = (await fs.readFile(`${import.meta.dirname}/../src/vls.c`)).toString();

// prevent stuff from breaking
if (grid.numVars === 0) {
    grid.getVar();
}

let out: string[] = [];
for (let line of code.split('\n')) {
    if (line.startsWith('typedef') && line.endsWith('cell_t;')) {
        let maxValue = grid.numVars === 0 ? 3 : 2 + grid.numVars * 4;
        if (maxValue > 65535) {
            out.push(`typedef uint32_t cell_t;`);
        } else if (maxValue > 255) {
            out.push(`typedef uint16_t cell_t;`);
        } else {
            out.push(`typedef uint8_t cell_t;`);
        }
        continue;
    } else if (line.startsWith('static cell_t initial_grid[GENS][HEIGHT][WIDTH] = ')) {
        line = line.slice(0, line.indexOf('{'));
        let emptyRow = '{' + Array.from({length: grid.width + 4}).map(() => '0').join(', ') + '}';
        let grids: string[] = [];
        for (let t = 0; t < grid.gens; t++) {
            let rows: string[] = [emptyRow, emptyRow];
            for (let y = 0; y < grid.height; y++) {
                let cells: string[] = ['0', '0'];
                for (let x = 0; x < grid.width; x++) {
                    cells.push(String(grid.get(t, x, y)));
                }
                cells.push('0', '0');
                rows.push('{' + cells.join(', ') + '}');
            }
            rows.push(emptyRow, emptyRow);
            grids.push('{' + rows.join(', ') + '}');
        }
        line += '{' + grids.join(', ') + '};';
    } else if (line.startsWith('static int search_order[][3] = ')) {
        line = line.slice(0, line.indexOf('{'));
        let order = options['search-order'] ?? defaultSearchOrder;
        if (order in searchOrderAliases) {
            order = searchOrderAliases[order];
        }
        line += '{' + getSearchOrder(grid, order).map(x => `{${x[0]}, ${x[1] + 2}, ${x[2] + 2}}`).join(', ') + '};';
    } else if (line.startsWith(`static const uint8_t trs[512] = `)) {
        line = line.slice(0, line.indexOf('{')) + '{' + base.trs.join(', ') + '};';
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
        value = grid.height + 4;
    } else if (name === 'WIDTH') {
        value = grid.width + 4;
    } else if (name === 'GENS') {
        value = grid.gens;
    } else if (name === 'VAR_COUNT') {
        value = grid.numVars;
    } else if (name === 'MAX_VAR_USES') {
        value = Math.max(1, ...Object.entries(cellCounts).filter(x => Number(x[0]) > 3).map(x => x[1]));
    } else if (name === 'TOTAL_UNKNOWN_CELLS') {
        value = 0;
        for (let [key, count] of Object.entries(cellCounts)) {
            if (key === '0' || key === '1') {
                continue;
            }
            value += count;
        }
    } else if (name === 'RULE') {
        value = '"' + rule + '"';
    } else if (name === 'INITIAL_VALUE') {
        value = options['initial-value'] ?? 0;
    } else if (name === 'MAXPOP') {
        let maxpop = options['maxpop'];
        if (maxpop === undefined) {
            comment = true;
            value = 67;
        } else {
            value = maxpop;
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

let sourcePath = path.relative(process.cwd(), `${import.meta.dirname}/../src/vls_to_compile.c`);
let execPath = path.relative(process.cwd(), `${import.meta.dirname}/../vls_compiled`);
if (!(execPath.startsWith('.') || execPath.startsWith('..') || execPath.startsWith('/'))) {
    execPath = './' + execPath;
}
await fs.writeFile(sourcePath, out.join('\n'));
try {
    let command = `gcc --std=c2x -Wall -Werror -Wpedantic -Wno-unused-function ${options['gdb'] ? '-g -Og' : '-O3'} -o '${execPath}' '${sourcePath}'`;
    console.log(command);
    execSync(command, {stdio: 'inherit'});
    execSync(`${options['gdb'] ? 'gdb ' : ''}${execPath}`, {stdio: 'inherit'});
} catch (error) {
    process.exit(1);
}
