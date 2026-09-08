
import * as fs from 'node:fs/promises';

import * as t from '@babel/types';

import {Matcher, EOF, T_EOF, ParserError, BaseParser, IdentityPattern} from '../core/index.js';


export function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls --help for help`);
    process.exit(1);
}


export const UNKNOWN = 0;
export const OFF = 1;
export const ON = 2;
export const DONT_CARE = 3;

export type State = typeof UNKNOWN | typeof OFF | typeof ON | typeof DONT_CARE;

export type Variable = number;

export const SEARCHABLE = 0;
export const NOT_SEARCHABLE = 1;
export const NOT_SETTABLE = 2;

export type Settability = typeof SEARCHABLE | typeof NOT_SEARCHABLE | typeof NOT_SETTABLE;

export interface Cell {
    state: State;
    variable: Variable | undefined;
    settable: Settability;
}

export function cell(state: State, variable: Variable | undefined = undefined, settable: Settability = SEARCHABLE): Cell {
    return {state, variable, settable};
}


type EdgeType = 'none' | 'even' | 'odd' | 'wrap';


export class Grid {

    height: number;
    width: number;
    gens: number;
    size: number;
    data: Cell[][][];
    numVars: number = 0;
    wrap: false | [number, number] = false;

    constructor(height: number, width: number, gens: number) {
        this.height = height;
        this.width = width;
        this.gens = gens;
        this.size = height * width;
        this.data = [];
        for (let t = 0; t < gens; t++) {
            let grid: Cell[][] = [];
            for (let y = 0; y < height; y++) {
                let row: Cell[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(cell(UNKNOWN));
                }
                grid.push(row);
            }
            this.data.push(grid);
        }
    }

    get(t: number, x: number, y: number): Cell {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return cell(UNKNOWN);
        }
        return this.data[t][y][x];
    }

    set(t: number, x: number, y: number, value: Cell): void;
    set(t: number, x: number, y: number, value: State, variable?: Variable | undefined, settable?: Settability): void;
    set(t: number, x: number, y: number, value: Cell | State, variable?: Variable | undefined, settable?: Settability): void {
        if (typeof value === 'number') {
            value = cell(value, variable, settable);
        }
        if (t < 0 || t > this.gens || x < 0 || x > this.width || y < 0 || y > this.height) {
            throw new Error(`Out of bounds set: t = ${t}, x = ${x}, y = ${y}`);
        }
        this.data[t][y][x] = value;
    }

    fill(t: number, cell: Cell): void;
    fill(t: number, value: State, variable?: Variable | undefined, settable?: Settability): void
    fill(t: number, value: Cell | State, variable?: Variable | undefined, settable?: Settability): void {
        if (typeof value === 'number') {
            value = cell(value, variable, settable);
        }
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.data[t][y][x] = structuredClone(value);
            }
        }
    }

    getNewVar(): number {
        // start numbering at 1
        // because the C program uses 0 as "no variable"
        this.numVars++;
        return this.numVars;
    }

    removeUnusedVars(): void {
        this.numVars = 0;
        let mapping: {[key: number]: number} = {0: 0};
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let value = this.data[t][y][x].variable;
                    if (value === undefined) {
                        continue;
                    }
                    if (!(value in mapping)) {
                        mapping[value] = this.getNewVar();
                    }
                }
            }
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.data[t][y][x];
                    if (cell.variable !== undefined) {
                        cell.variable = mapping[cell.variable];
                    }
                }
            }
        }
    }

    removeSingleUseVars(): void {
        let uses: {[key: number]: [number, number, number] | 'multi'} = [];
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let value = this.data[t][y][x].variable;
                    if (value === undefined) {
                        continue;
                    } else if (value in uses) {
                        uses[value] = 'multi';
                    } else {
                        uses[value] = [t, x, y];
                    }
                }
            }
        }
        for (let value of Object.values(uses)) {
            if (Array.isArray(value)) {
                let [t, x, y] = value;
                this.data[t][y][x].variable = undefined;
            }
        }
    }
    
    removeKnownVars(): void {
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.data[t][y][x];
                    if (cell.variable !== undefined && cell.state !== UNKNOWN) {
                        cell.variable = undefined;
                    }
                }
            }
        }
    }

    normalize(): void {
        this.removeKnownVars();
        this.removeSingleUseVars();
        this.removeUnusedVars();
    }

    expand({start = 0, end = 0, up = 0, down = 0, left = 0, right = 0}: {start?: number, end?: number, up?: number, down?: number, left?: number, right?: number}): void {
        let newHeight = this.height + up + down;
        let newWidth = this.width + left + right;
        let newGens = this.gens + start + end;
        // first make empty placeholders
        let emptyRow: Cell[] = [];
        for (let i = 0; i < newWidth; i++) {
            emptyRow.push(cell(UNKNOWN));
        }
        let emptyGrid: Cell[][] = [];
        for (let i = 0; i < newHeight; i++) {
            emptyGrid.push(structuredClone(emptyRow));
        }
        // then paste them in
        for (let grid of this.data) {
            for (let row of grid) {
                for (let i = 0; i < left; i++) {
                    row.unshift(cell(UNKNOWN));
                }
                for (let i = 0; i < right; i++) {
                    row.push(cell(UNKNOWN));
                }
            }
            for (let i = 0; i < up; i++) {
                grid.unshift(structuredClone(emptyRow));
            }
            for (let i = 0; i < down; i++) {
                grid.push(structuredClone(emptyRow));
            }
        }
        for (let i = 0; i < start; i++) {
            this.data.unshift(structuredClone(emptyGrid));
        }
        for (let i = 0; i < end; i++) {
            this.data.unshift(structuredClone(emptyGrid));
        }
        this.height = newHeight;
        this.width = newWidth;
        this.gens = newGens;
    }

    reassignVar(old: Variable, new_: Variable): void {
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.data[t][y][x];
                    if (cell.variable === old) {
                        cell.variable = new_;
                    }
                }
            }
        }
    }

    // at least 1 of the cells must be UNKNOWN
    bindCells(x: Cell, y: Cell): void {
        if (x.state !== UNKNOWN) {
            if (y.state !== UNKNOWN) {
                throw new Error(`This error should not occur, please report it (neither cell is unknown while binding)`);
            } else {
                y.state = x.state;
                y.variable = x.variable;
                y.settable = x.settable;
                return;
            }
        } else {
            if (y.state !== UNKNOWN && y.state !== DONT_CARE) {
                x.state = y.state;
                x.variable = y.variable;
                x.settable = y.settable;
                return;
            }
        }
        if (x.variable !== undefined) {
            if (y.variable !== undefined) {
                this.reassignVar(x.variable, y.variable);
            } else {
                y.variable = x.variable;
            }
        } else {
            if (x.variable !== undefined) {
                x.variable = y.variable;
            } else {
                let variable = this.getNewVar();
                x.variable = variable;
                y.variable = variable;
            }
        }
    }

    resolveWrap(): void {
        if (!this.wrap) {
            return;
        }
        let [dx, dy] = this.wrap;
        // we expand to the right and bottom to handle the implicit bounding box expansion
        this.expand({end: 1, right: 1, down: 1});
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let x2 = x + dx;
                let y2 = y + dy;
                if (x2 < 0 || x2 > this.width || y2 < 0 || y2 > this.height) {
                    // the cell doesn't exist at the end, so it can't be set
                    this.set(0, x, y, OFF);
                } else {
                    this.bindCells(this.data[0][y][x], this.data[this.gens - 1][y2][x2]);
                }
            }
        }
        // and we also have to set the cells that must be 0 in the last generation
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let x2 = x - dx;
                let y2 = y - dy;
                if (x2 < 0 || x2 > this.width || y2 < 0 || y2 > this.height) {
                    this.set(this.gens - 1, x, y, OFF);
                }
            }
        }
        this.wrap = false;
    }

    setTopEdge(type: EdgeType): void {
        if (type === 'none') {
            return;
        }
        this.expand({up: 1});
        let bindToY: number;
        if (type === 'even') {
            bindToY = 1;
        } else if (type === 'odd') {
            bindToY = 2;
        } else {
            bindToY = this.height - 1;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.bindCells(this.data[t][0][x], this.data[t][bindToY][x]);
            }
        }
    }

    setBottomEdge(type: EdgeType): void {
        if (type === 'none') {
            return;
        }
        this.expand({down: 1});
        let bindToY: number;
        if (type === 'even') {
            bindToY = this.height - 1;
        } else if (type === 'odd') {
            bindToY = this.height - 2;
        } else {
            bindToY = 0;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.bindCells(this.data[t][this.height - 1][x], this.data[t][bindToY][x]);
            }
        }
    }

    setLeftEdge(type: EdgeType): void {
        if (type === 'none') {
            return;
        }
        this.expand({left: 1});
        let bindToX: number;
        if (type === 'even') {
            bindToX = 1;
        } else if (type === 'odd') {
            bindToX = 2;
        } else {
            bindToX = this.width - 1;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.bindCells(this.data[t][y][0], this.data[t][y][bindToX]);
            }
        }
    }

    setRightEdge(type: EdgeType): void {
        if (type === 'none') {
            return;
        }
        this.expand({right: 1});
        let bindToX: number;
        if (type === 'even') {
            bindToX = this.width - 1;
        } else if (type === 'odd') {
            bindToX = this.width - 2;
        } else {
            bindToX = 0;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.bindCells(this.data[t][y][this.width - 1], this.data[t][y][bindToX]);
            }
        }
    }

    applySymmetry(symmetry: string): void {

    }

}


export function mergeGrids(grids: Grid[]): Grid {
    if (grids.length === 1) {
        return grids[0];
    }
    // combine multiple independent grids using don't cares
    // first determine the size of the grid
    let height = 0;
    let width = 0;
    let gens = 0;
    for (let i = 0; i < grids.length; i++) {
        let grid = grids[i];
        height = Math.max(height, grid.height);
        width = Math.max(width, grid.width);
        gens += grid.gens;
        if (i !== grids.length - 1) {
            gens++;
        }
    }
    let out = new Grid(height, width, gens);
    let locT = 0;
    for (let i = 0; i < grids.length; i++) {
        let grid = grids[i];
        grid.resolveWrap();
        let vars: {[key: number]: number} = {};
        for (let t = 0; t < grid.gens; t++) {
            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.height; x++) {
                    let cell = structuredClone(grid.get(t, x, y));
                    if (cell.variable !== undefined) {
                        if (cell.variable in vars) {
                            cell.variable = vars[cell.variable];
                        } else {
                            let value = out.getNewVar();
                            vars[cell.variable] = value;
                            cell.variable = value;
                        }
                    }
                    out.set(locT, x, y, cell);
                }
            }
            locT++;
        }
        if (i !== grids.length - 1) {
            out.fill(locT, cell(DONT_CARE));
            locT++;
        }
    }
    out.normalize();
    return out;
}


export function runExpression(cell: [number, number, number], node: t.Expression | t.PrivateName): number | boolean {
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
        let value = runExpression(cell, node.argument);
        if (node.operator === '-') {
            return -value;
        } else if (node.operator === '+') {
            return +value;
        } else {
            error(`Invalid unary operator: '${node.operator}'`);
        }
    } else if (node.type === 'BinaryExpression') {
        let left = runExpression(cell, node.left);
        let right = runExpression(cell, node.right);
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
            return runExpression(cell, node.left) && runExpression(cell, node.right);
        } else if (node.operator === '||') {
            return runExpression(cell, node.left) || runExpression(cell, node.right);
        } else {
            error(`Invalid binary operator: '${node.operator}'`);
        }
    } else if (node.type === 'ConditionalExpression') {
        return runExpression(cell, node.test) ? runExpression(cell, node.consequent) : runExpression(cell, node.alternate);
    } else if (node.type === 'CallExpression') {
        if (node.callee.type !== 'Identifier') {
            error(`Cannot call non-constant function`);
        }
        let args: (number | boolean)[] = [];
        for (let arg of node.arguments) {
            if (arg.type === 'SpreadElement' || arg.type === 'ArgumentPlaceholder') {
                error(`Invalid node: '${arg.type}'`);
            } else {
                args.push(runExpression(cell, arg));
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


export class VLSFileError extends ParserError {

    name: string = 'VLSFileError';
    [Symbol.toStringTag]: string = 'VLSFileError';

}

const WORD_CHARS = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-`;

const T_LINE_END: Matcher = [new Set(['\n', ';', EOF]), 'line end'];

const T_NATURAL_NUMBER: Matcher = [/^\d+$/, 'natural number'];
const T_INTEGER: Matcher = [/^-?\d+$/, 'integer'];
const T_STATE: Matcher = [/^\d+$/, 'state'];
const T_RLE: Matcher = [/^x\s*=\s*\d+\s*,\s*y\s*=\s*\d+.*!$/s, 'RLE'];

type StateMeaning = 
    | {type: 'cell', value: Cell}
    | {type: 'period', value: Cell[]}
;

interface FullStateMeaning {
    all?: StateMeaning;
    absolute?: {[key: number]: StateMeaning};
    relative?: {[key: number]: StateMeaning};
}

class VLSFileParser extends BaseParser {

    static ParserError = VLSFileError;

    states: {[key: number]: FullStateMeaning};
    grids: Grid[];
    grid: Grid;

    constructor(file: string | undefined, code: string) {
        super(file, code);
        this.states = {
            0: {relative: {0: {type: 'cell', value: cell(OFF)}}},
            1: {relative: {0: {type: 'cell', value: cell(ON)}}},
            2: {relative: {0: {type: 'cell', value: cell(UNKNOWN)}}},
            3: {relative: {0: {type: 'cell', value: cell(DONT_CARE)}}},
        };
        this.grids = [];
        this.grid = new Grid(0, 0, 0);
    }

    tokenize(code: string): void {
        let current = '';
        let startPos = 0;
        for (let pos = 0; pos < code.length; pos++) {
            let char = code[pos];
            if (char === ' ') {
                if (current.length === 0) {
                    startPos++;
                } else {
                    this.addToken(current, startPos);
                    current = '';
                }
                continue;
            } else if (char === '#') {
                // skip comments
                while (pos < code.length && code[pos] !== '\n') {
                    pos++;
                }
                continue;
            } else if (char === 'x' && code.slice(pos).match(/^x\s*=\s*\d+\s*,\s*y\s*=\s*\d+/)) {
                // RLEs are parsed as a single token
                let data = char;
                let startPos = pos;
                pos++;
                while (char !== '!' && pos < code.length) {
                    char = code[pos];
                    data += char;
                    pos++;
                }
                this.addToken(data, startPos);
            } else if (WORD_CHARS.includes(char)) {
                current += char;
            } else {
                if (current.length > 0) {
                    this.addToken(current.trimEnd(), startPos);
                }
                this.addToken(char, pos);
                current = '';
                startPos = pos + 1;
            }
        }
        current = current.trimEnd();
        if (current !== '') {
            this.addToken(current, startPos);
        }
    }

    static readonly T_STATE_MEANING: Matcher = [new Set(['unchecked', 'unset', '0', '1', '*', '`', 'var', /^p\d+$/]), 'state meaning'];

    stateMeaning(): StateMeaning {
        let data: string[] = [this.eat(VLSFileParser.T_STATE_MEANING)[0]];
        while (this.match(VLSFileParser.T_STATE_MEANING)) {
            data.unshift(this.advance());
        }
        let state: State | undefined = undefined;
        let variable: Variable | undefined = undefined;
        let settable: Settability = SEARCHABLE;
        let period: number | undefined = undefined;
        for (let value of data) {
            if (value === 'unchecked') {
                state ??= UNKNOWN;
                settable = NOT_SEARCHABLE;
            } else if (value === 'unset') {
                state ??= UNKNOWN;
                settable = NOT_SETTABLE;
            } else if (value === '0') {
                state = OFF;
                period = undefined;
            } else if (value === '1') {
                state = ON;
                period = undefined;
            } else if (value === '*') {
                state = UNKNOWN;
                period = undefined;
            } else if (value === '`') {
                state = DONT_CARE;
                period = undefined;
            } else if (value === 'var') {
                state = UNKNOWN;
                variable = this.grid.getNewVar();
                period = undefined;
            } else if (value.match(/^p\d+$/)) {
                state ??= UNKNOWN;
                period = Number(value.slice(1));
            } else {
                throw new Error(`This error should not occur, please report it (invalid state meaning)`);
            }
        }
        if (state === undefined) {
            throw new Error(`This error should not occur, please report it (empty state meaning)`);
        }
        if (period !== undefined) {
            let cells: Cell[] = [];
            for (let i = 0; i < period; i++) {
                cells.push(cell(state, this.grid.getNewVar(), settable));
            }
            return {type: 'period', value: cells};
        } else {
            return {type: 'cell', value: cell(state, variable, settable)};
        }
    }

    boundStateMeaning(out: FullStateMeaning): void {
        if (this.match('all')) {
            this.advance();
            this.eat([':', 'colon']);
            out.all = this.stateMeaning();
        } else if (this.match(T_INTEGER, ':') || this.match(T_INTEGER, '-', T_INTEGER, ':') || this.match('$', T_NATURAL_NUMBER, ':') || this.match('$', T_NATURAL_NUMBER, '-', T_NATURAL_NUMBER, ':')) {
            let absolute = false;
            if (this.match('$')) {
                this.advance();
                absolute = true;
            }
            let tNumber = absolute ? T_NATURAL_NUMBER : T_INTEGER;
            let start = Number(this.eat(tNumber)[0]);
            let end = start;
            if (this.match('-')) {
                this.advance();
            }
            if (this.match(tNumber)) {
                end = Number(this.eat(tNumber)[0]);
            }
            this.eat([':', 'colon']);
            let value = this.stateMeaning();
            for (let i = start; i < end; i++) {
                if (absolute) {
                    if (!out.absolute) {
                        out.absolute = {};
                    }
                    out.absolute[i] = structuredClone(value);
                } else {
                    if (!out.relative) {
                        out.relative = {};
                    }
                    out.relative[i] = structuredClone(value);
                }
            }
        } else {
            if (!out.relative) {
                out.relative = {};
            }
            out.relative[0] = this.stateMeaning();
        }
    }

    fullStateMeaning(): FullStateMeaning {
        let out: FullStateMeaning = {};
        while (!this.match(T_LINE_END)) {
            this.boundStateMeaning(out);
            if (this.match(T_LINE_END)) {
                break;
            } else {
                this.eat([',', 'comma']);
            }
        }
        return out;
    }

    stateSetStatement(): void {
        let state = Number(this.eat(T_NATURAL_NUMBER)[0]);
        this.eat(['=', 'equals sign']);
        this.states[state] = this.fullStateMeaning();
        this.eat(T_LINE_END);
    }

    setCell(t: number, x: number, y: number, value: StateMeaning): void {
        if (value.type === 'cell') {
            this.grid.set(t, x, y, structuredClone(value.value));
        // } else if (value.type === 'period') {
        //     for (let t2 = 0; t2 < this.gens; t2++) {

        //     }
        } else {
            throw new Error(`This error should not occur, please report it (invalid parsed state meaning)`);
        }
    }

    rleStatement(): void {
        this.eat(['gen', `the literal string 'gen'`]);
        let gen = Number(this.eat(T_NATURAL_NUMBER)[0]);
        let xOffset = 0;
        let yOffset = 0;
        if (this.match('offset')) {
            this.advance();
            let [x, y] = this.eat(T_INTEGER, T_INTEGER);
            xOffset = Number(x);
            yOffset = Number(y);
        }
        this.eat([':', 'colon'], T_LINE_END);
        let rle = this.eat(T_RLE)[0];
        let index = rle.indexOf('\n');
        if (index === -1) {
            this.error(`RLE header without data`, -1);
        }
        rle = rle.slice(index + 1);
        let p = IdentityPattern.loadRLE(rle);
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let state = p.get(x, y);
                let x2 = x + xOffset;
                let y2 = y + yOffset;
                let data = this.states[state];
                if (data.all) {
                    for (let t = 0; t < this.grid.gens; t++) {
                        this.setCell(t, x2, y2, data.all);
                    }
                }
                if (data.absolute) {
                    for (let [t, value] of Object.values(data)) {
                        this.setCell(t, x2, y2, value);
                    }
                }
                if (data.relative) {
                    for (let [t, value] of Object.values(data)) {
                        this.setCell(gen + t, x2, y2, value);
                    }
                }
            }
        }
        this.eat(T_LINE_END);
    }

    wrapStatement(): void {
        this.eat(['wrap', `the literal string 'wrap'`]);
        let [dx, dy] = this.eat(T_INTEGER, T_INTEGER);
        this.grid.wrap = [Number(dx), Number(dy)];
        this.eat(T_LINE_END);
    }

    expandStatement(): void {
        this.eat(['expand', `the literal string 'expand'`]);
        while (!this.match(T_LINE_END)) {
            let data = this.eat([new Set(['start', 'end', 'up', 'down', 'left', 'right']), 'direction'], T_NATURAL_NUMBER);
            this.grid.expand({[data[0] as any]: Number(data[1])});
        }
    }

    statement(): void {
        if (this.match(T_LINE_END)) {
            this.advance();
        } else if (this.match(T_STATE, '=')) {
            this.stateSetStatement();
        } else if (this.match('gen')) {
            this.rleStatement();
        } else if (this.match('wrap')) {
            this.wrapStatement();
        } else if (this.match('expand')) {
            this.expandStatement();
        } else {
            this.error(`Expected statement`);
        }
    }

    pattern(): void {
        while (this.match(T_LINE_END)) {
            this.advance();
        }
        let gens = Number(this.eat(
            ['pattern', `the literal string 'pattern'`],
            T_NATURAL_NUMBER,
            ['gens', `the literal string 'gens'`],
            T_LINE_END,
        )[1]);
        if (gens === 0) {
            this.error(`Generations value cannot be 0`, -3);
        }
        this.grid = new Grid(0, 0, gens);
        while (!(this.match(EOF) || this.match(T_NATURAL_NUMBER, 'gens', T_LINE_END))) {
            this.statement();
        }
        this.grids.push(this.grid);
    }

    async program(): Promise<Grid> {
        while (!this.match(EOF)) {
            this.pattern();
        }
        if (this.grids.length === 0) {
            this.error('No patterns provided!');
        }
        return mergeGrids(this.grids);
    }

}


export async function runFile(filename: string): Promise<Grid> {
    let code = (await fs.readFile(filename)).toString();
    try {
        let parser = new VLSFileParser(filename, code);
        return await parser.program();
    } catch (e) {
        if (e instanceof VLSFileError) {
            console.error(`Use ./vls --help for help`);
            process.exit(1);
        } else {
            throw e;
        }
    }
}
