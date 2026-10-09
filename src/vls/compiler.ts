
import * as t from '@babel/types';

import {IS_BROWSER, Matcher, EOF, literal, ParserError, BaseParser, IdentityPattern} from '../core/index.js';


export function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls -h for help`);
    process.exit(1);
}


export class Coord {

    t: number;
    x: number;
    y: number;

    constructor(t: number, x: number, y: number) {
        this.t = t;
        this.x = x;
        this.y = y;
    }

    eq(other: Coord): boolean {
        return this.t === other.t && this.x === other.x && this.y === other.y;
    }

}

export function coord(t: number, x: number, y: number): Coord {
    return new Coord(t, x, y);
}


export const UNKNOWN = 0;
export const OFF = 1;
export const ON = 2;

export type State = typeof UNKNOWN | typeof OFF | typeof ON;

export function isKnown(state: State): state is typeof OFF | typeof ON {
    return state === ON || state === OFF;
}


export type Variable = number;


export class Cell {

    state: State;
    variable: Variable | undefined;
    searchable: boolean;
    noClause: boolean;

    constructor(state: State, variable: Variable | undefined = undefined, searchable: boolean = true, noClause: boolean = false) {
        this.state = state;
        this.variable = variable;
        this.searchable = searchable;
        this.noClause = noClause;
    }
    
    eq(other: Cell): boolean {
        return this.state === other.state
            && this.variable === other.variable
            && this.searchable === other.searchable
            && this.noClause === other.noClause
        ;
    }

}

export function cell(state: State, variable?: Variable, searchable?: boolean, noClause?: boolean): Cell {
    return new Cell(state, variable, searchable, noClause);
}


export class Grid {

    width: number;
    height: number;
    gens: number;
    size: number;
    data: Cell[][][];
    numVars: number = 0;

    constructor(width: number, height: number, gens: number, data?: Cell[][][]) {
        this.width = width;
        this.height = height;
        this.gens = gens;
        this.size = height * width;
        if (data) {
            this.data = data;
        } else {
            this.data = [];
            for (let t = 0; t < gens; t++) {
                let layer: Cell[][] = [];
                for (let y = 0; y < height; y++) {
                    let row: Cell[] = [];
                    for (let x = 0; x < width; x++) {
                        row.push(cell(UNKNOWN));
                    }
                    layer.push(row);
                }
                this.data.push(layer);
            }
        }
    }

    isInBounds(t: number, x: number, y: number): boolean;
    isInBounds(x: number, y: number): boolean;
    isInBounds(coord: Coord): boolean;
    isInBounds(_t: number | Coord, _x?: number, _y?: number): boolean {
        let t: number;
        let x: number;
        let y: number;
        if (typeof _t === 'object') {
            t = _t.t;
            x = _t.x;
            y = _t.y;
        } else if (_y === undefined) {
            t = 0;
            x = _t;
            y = _x as number;
        } else {
            t = _t;
            x = _x as number;
            y = _y as number;
        }
        return t >= 0 && t < this.gens && x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    get(t: number, x: number, y: number): Cell;
    get(coord: Coord): Cell;
    get(_t: number | Coord, _x?: number, _y?: number): Cell {
        let t: number;
        let x: number;
        let y: number;
        if (typeof _t === 'object') {
            t = _t.t;
            x = _t.x;
            y = _t.y;
        } else {
            t = _t;
            x = _x as number;
            y = _y as number;
        }
        if (!this.isInBounds(t, x, y)) {
            throw new Error(`Out of bounds get: t = ${t}, x = ${x}, y = ${y}`);
        }
        return this.data[t][y][x];
    }

    getAllowOOB(t: number, x: number, y: number): Cell;
    getAllowOOB(coord: Coord): Cell;
    getAllowOOB(_t: number | Coord, _x?: number, _y?: number): Cell {
        let t: number;
        let x: number;
        let y: number;
        if (typeof _t === 'object') {
            t = _t.t;
            x = _t.x;
            y = _t.y;
        } else {
            t = _t;
            x = _x as number;
            y = _y as number;
        }
        if (!this.isInBounds(t, x, y)) {
            return cell(OFF);
        }
        return this.data[t][y][x];
    }

    set(t: number, x: number, y: number, value: Cell): this;
    set(t: number, x: number, y: number, value: State, variable?: Variable | undefined, searchable?: boolean, noClause?: boolean): this;
    set(pos: Coord, value: Cell): this;
    set(pos: Coord, value: State, variable?: Variable | undefined, searchable?: boolean, noClause?: boolean): this;
    set(_t: number | Coord, _x: number | Cell | State, _y?: number | Variable, _value?: Cell | State | boolean, _variable?: Variable | boolean | undefined, _searchable?: boolean, _noClause?: boolean): this {
        let value: Cell;
        let t: number;
        let x: number;
        let y: number;
        if (typeof _t === 'object') {
            t = _t.t;
            x = _t.x;
            y = _t.y;
            if (typeof _x === 'object') {
                value = _x;
            } else {
                value = cell(_x as State, _y as Variable | undefined, _value as boolean | undefined, _variable as boolean | undefined);
            }
        } else {
            t = _t;
            x = _x as number;
            y = _y as number;
            if (typeof _value === 'object') {
                value = _value;
            } else {
                value = cell(_value as State, _variable as number | undefined, _searchable, _noClause);
            }
        }
        if (!this.isInBounds(t, x, y)) {
            throw new Error(`Out of bounds set: t = ${t}, x = ${x}, y = ${y}`);
        }
        this.data[t][y][x] = value;
        return this;
    }

    fill(t: number, value: Cell): this;
    fill(t: number, value: State, variable?: Variable | undefined, searchable?: boolean, noClause?: boolean): this
    fill(t: number, value: Cell | State, variable?: Variable | undefined, searchable?: boolean, noClause?: boolean): this {
        if (typeof value === 'number') {
            value = cell(value, variable, searchable, noClause);
        }
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, y, value);
            }
        }
        return this;
    }

    getNewVar(): number {
        // start numbering at 1
        // because the C program uses 0 as "no variable"
        this.numVars++;
        return this.numVars;
    }

    entries(): IterableIterator<[Coord, Cell]> {
        let t = 0;
        let x = 0;
        let y = 0;
        return {
            [Symbol.iterator]() {
                return this;
            },
            // arrow function so it uses the `this` context of the Grid
            next: () => {
                if (t >= this.gens) {
                    return {done: true, value: undefined};
                }
                let pos = coord(t, x, y);
                return {done: false, value: [pos, this.get(pos)]};
            }
        };
    }

    coords(): IterableIterator<Coord> {
        let t = 0;
        let x = 0;
        let y = 0;
        return {
            [Symbol.iterator]() {
                return this;
            },
            // arrow function so it uses the `this` context of the Grid
            next: () => {
                if (t >= this.gens) {
                    return {done: true, value: undefined};
                }
                let out = {done: false, value: coord(t, x, y)};
                x++;
                if (x >= this.width) {
                    x = 0;
                    y++;
                    if (y >= this.height) {
                        y = 0;
                        t++;
                    }
                }
                return out;
            }
        };
    }

    cells(): IterableIterator<Cell> {
        let t = 0;
        let x = 0;
        let y = 0;
        return {
            [Symbol.iterator]() {
                return this;
            },
            // arrow function so it uses the `this` context of the Grid
            next: () => {
                if (t >= this.gens) {
                    return {done: true, value: undefined};
                }
                let out = {done: false, value: this.get(coord(t, x, y))};
                x++;
                if (x >= this.width) {
                    x = 0;
                    y++;
                    if (y >= this.height) {
                        y = 0;
                        t++;
                    }
                }
                return out;
            }
        };
    }

    reassignVar(old: Variable, new_: Variable): this {
        for (let cell of this.cells()) {
            if (cell.variable === old) {
                cell.variable = new_;
            }
        }
        return this;
    }

    setVar(variable: Variable, state: State): this {
        for (let cell of this.cells()) {
            if (cell.variable === variable) {
                cell.state = state;
                cell.variable = undefined;
            }
        }
        return this;
    }

    copy(): Grid {
        let out = new Grid(this.width, this.height, this.gens, structuredClone(this.data));
        out.numVars = this.numVars;
        return out;
    }

    expand({start = 0, end = 0, up = 0, down = 0, left = 0, right = 0}: {start?: number, end?: number, up?: number, down?: number, left?: number, right?: number}): this {
        let newWidth = this.width + left + right;
        let newHeight = this.height + up + down;
        let newGens = this.gens + start + end;
        // first make empty placeholders
        let emptyRow: Cell[] = [];
        for (let i = 0; i < newWidth; i++) {
            emptyRow.push(cell(UNKNOWN));
        }
        let emptyLayer: Cell[][] = [];
        for (let i = 0; i < newHeight; i++) {
            emptyLayer.push(structuredClone(emptyRow));
        }
        // then paste them in
        for (let layer of this.data) {
            for (let row of layer) {
                for (let i = 0; i < left; i++) {
                    row.unshift(cell(UNKNOWN));
                }
                for (let i = 0; i < right; i++) {
                    row.push(cell(UNKNOWN));
                }
            }
            for (let i = 0; i < up; i++) {
                layer.unshift(structuredClone(emptyRow));
            }
            for (let i = 0; i < down; i++) {
                layer.push(structuredClone(emptyRow));
            }
        }
        for (let i = 0; i < start; i++) {
            this.data.unshift(structuredClone(emptyLayer));
        }
        for (let i = 0; i < end; i++) {
            this.data.push(structuredClone(emptyLayer));
        }
        this.width = newWidth;
        this.height = newHeight;
        this.gens = newGens;
        return this;
    }

    shrink({start = 0, end = 0, up = 0, down = 0, left = 0, right = 0}: {start?: number, end?: number, up?: number, down?: number, left?: number, right?: number}): this {
        let newWidth = this.width - left - right;
        let newHeight = this.height - up - down;
        let newGens = this.gens - start - end;
        for (let layer of this.data) {
            for (let row of layer) {
                for (let i = 0; i < left; i++) {
                    row.shift();
                }
                for (let i = 0; i < right; i++) {
                    row.pop();
                }
            }
            for (let i = 0; i < up; i++) {
                layer.shift();
            }
            for (let i = 0; i < down; i++) {
                layer.pop();
            }
        }
        for (let i = 0; i < start; i++) {
            this.data.shift();
        }
        for (let i = 0; i < end; i++) {
            this.data.pop();
        }
        this.height = newHeight;
        this.width = newWidth;
        this.gens = newGens;
        return this;
    }

    combineCells(x: Cell, y: Cell, coords?: [Coord, Coord]): this {
        let simple: undefined | 'x = y' | 'y = x' = undefined;
        if (isKnown(x.state)) {
            if (isKnown(y.state)) {
                if (x.state !== y.state) {
                    if (coords) {
                        error(`Contradiction detected while binding together cells at t = ${coords[0].t}, x = ${coords[0].x}, y = ${coords[0].y} and t = ${coords[1].t}, x = ${coords[1].x}, y = ${coords[1].y}`);
                    } else {
                        error(`Contradiction detected while binding together cells`);
                    }
                }
                simple = 'x = y';
            } else {
                simple = 'y = x';
            }
        } else {
            if (isKnown(y.state)) {
                simple = 'x = y';
            }
        }
        if (simple !== undefined) {
            if (simple === 'y = x') {
                let temp = x;
                x = y;
                y = temp;
            }
            x.state = y.state;
            x.searchable = y.searchable;
            if (x.variable !== undefined) {
                if (y.variable !== undefined) {
                    this.reassignVar(x.variable, y.variable);
                } else {
                    y.variable = x.variable;
                }
            } else {
                if (y.variable !== undefined) {
                    x.variable = y.variable;
                } else {
                    // do nothing
                }
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
        return this;
    }

    bindCells(x: Coord, y: Coord): this {
        if (x.eq(y)) {
            return this;
        }
        return this.combineCells(this.get(x), this.get(y), [x, y]);
    }

    transpose(): this {
        this.data = this.data.map(grid => grid[0].map((_, i) => grid.map(row => row[i])));
        return this;
    }

    flipHorizontal(): this {
        this.data = this.data.map(grid => grid.map(row => row.reverse()));
        return this;
    }

    flipVertical(): this {
        this.data = this.data.map(grid => grid.reverse());
        return this;
    }

    rotateLeft(): this {
        return this.transpose().flipVertical();
    }

    rotateRight(): this {
        return this.transpose().flipHorizontal();
    }

    rotate180(): this {
        return this.flipHorizontal().flipVertical();
    }

    flipDiagonal(): this {
        return this.transpose();
    }

    flipAntiDiagonal(): this {
        return this.transpose().rotate180();
    }

    transposeTime(t: number): this {
        this.data[t] = this.data[t].map((_, i) => this.data[t].map(row => row[i]));
        return this;
    }

    flipTimeHorizontal(t: number): this {
        this.data[t] = this.data[t].map(row => row.reverse());
        return this;
    }

    flipTimeVertical(t: number): this {
        this.data[t] = this.data[t].reverse();
        return this;
    }

    rotateTimeLeft(t: number): this {
        return this.transposeTime(t).flipTimeVertical(t);
    }

    rotateTimeRight(t: number): this {
        return this.transposeTime(t).flipTimeHorizontal(t);
    }

    rotateTime180(t: number): this {
        return this.flipTimeHorizontal(t).flipTimeVertical(t);
    }

    flipTimeDiagonal(t: number): this {
        return this.transposeTime(t);
    }

    flipTimeAntiDiagonal(t: number): this {
        return this.transposeTime(t).rotateTime180(t);
    }

    applyWrap(dx: number, dy: number): this {
        this.expand({end: 1});
        for (let endY = 0; endY < this.height; endY++) {
            for (let endX = 0; endX < this.width; endX++) {
                let startX = endX - dx;
                let startY = endY - dy;
                if (!this.isInBounds(0, startX, startY)) {
                    // this cell doesn't exist at the start so it must be 0
                    this.set(this.gens - 1, endX, endY, cell(OFF));
                } else {
                    this.bindCells(coord(0, startX, startY), coord(this.gens - 1, endX, endY));
                }
            }
        }
        for (let startY = 0; startY < this.height; startY++) {
            for (let startX = 0; startX < this.width; startX++) {
                let endX = startX + dx;
                let endY = startY + dy;
                if (endX < 0 || endX >= this.width || endY < 0 || endY >= this.height) {
                    // this cell doesn't exist at the end so it must be 0
                    this.set(0, startX, startY, OFF);
                }
            }
        }
        return this;
    }

    applySymmetry(symmetry: string): this {
        if (!(symmetry in SYMMETRIES)) {
            error(`Invalid symmetry: ${symmetry}`);
        }
        let value = SYMMETRIES[symmetry];
        while (typeof value === 'string') {
            symmetry = value;
            value = SYMMETRIES[symmetry];
        }
        value(this);
        return this;
    }

    removeUnusedVars(): this {
        this.numVars = 0;
        let mapping = new Map<number, number>();
        for (let cell of this.cells()) {
            if (cell.variable !== undefined) {
                let value = mapping.get(cell.variable);
                if (value === undefined) {
                    value = this.getNewVar();
                    mapping.set(cell.variable, value);
                }
                cell.variable = value;
            }
        }
        return this;
    }

    normalize(): this {
        this.removeUnusedVars();
        return this;
    }

}


export const SYMMETRIES: {[key: string]: string | ((grid: Grid) => void)} = {

    'C1'(grid: Grid): void {
        // do nothing
    },

    'C2'(grid: Grid): void {
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, grid.width - pos.x - 1, grid.height - pos.y - 1));
        }
    },

    'C4'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply C4 symmetry to non-square grid`);
        }
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, grid.height - pos.y - 1, grid.width - pos.x - 1));
        }
    },

    'D2|'(grid: Grid): void {
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, grid.width - pos.x - 1, pos.y));
        }
    },

    'D2-'(grid: Grid): void {
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, pos.x, grid.height - pos.y - 1));
        }
    },

    'D2\\'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply D2\\ symmetry to non-square grid`);
        }
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, pos.y, pos.x));
        }
    },

    'D2/'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply D2/ symmetry to non-square grid`);
        }
        for (let pos of grid.coords()) {
            grid.bindCells(pos, coord(pos.t, grid.width - pos.x - 1, grid.height - pos.y - 1));
        }
    },

    'D4+'(grid: Grid): void {
        grid.applySymmetry('D2|');
        grid.applySymmetry('D2-');
    },

    'D4x'(grid: Grid): void {
        grid.applySymmetry('D2\\');
        grid.applySymmetry('D2/');
    },

    'D8'(grid: Grid): void {
        grid.applySymmetry('D2|');
        grid.applySymmetry('C4');
    },

};


export function mergeGrids(grids: Grid[]): Grid {
    if (grids.length === 1) {
        return grids[0];
    }
    // combine multiple independent grids using don't cares
    // first determine the size of the grid
    let width = 0;
    let height = 0;
    let gens = 0;
    for (let i = 0; i < grids.length; i++) {
        let grid = grids[i];
        width = Math.max(width, grid.width);
        height = Math.max(height, grid.height);
        gens += grid.gens;
        if (i !== grids.length - 1) {
            gens++;
        }
    }
    let out = new Grid(width, height, gens);
    let locT = 0;
    for (let i = 0; i < grids.length; i++) {
        let grid = grids[i];
        let vars: {[key: number]: number} = {};
        for (let t = 0; t < grid.gens; t++) {
            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
                    let cell = structuredClone(grid.get(t, x, y));
                    if (t === 0) {
                        cell.noClause = true;
                    }
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
            out.fill(locT, cell(UNKNOWN, undefined, undefined, true));
            locT++;
        }
    }
    out.normalize();
    return out;
}


const EXPRESSION_VARIABLES: {[key: string]: number | boolean | ((grid: Grid, pos: Coord) => number | boolean)} = {

    't'(grid: Grid, pos: Coord) {
        return pos.t;
    },

    'x'(grid: Grid, pos: Coord) {
        return pos.x;
    },

    'y'(grid: Grid, pos: Coord) {
        return pos.y;
    },

    'height'(grid: Grid, pos: Coord) {
        return grid.height;
    },

    'width'(grid: Grid, pos: Coord) {
        return grid.width;
    },

    'gens'(grid: Grid, pos: Coord) {
        return grid.gens;
    },

    'infinity': Infinity,
    'pi': Math.PI,
    'e': Math.E,

};

const EXPRESSION_FUNCTIONS: {[key: string]: (grid: Grid, cell: Coord, ...args: (number | boolean)[]) => number | boolean} = {};

function functionify(func: (...args: any[]) => any): (...args: any[]) => any {
    return function(_: any, _2: any, ...args: any[]): any {
        return func(...args);
    }
}

for (let key of Reflect.ownKeys(Math)) {
    if (typeof key === 'symbol') {
        continue;
    }
    EXPRESSION_FUNCTIONS[key] = functionify((Math as any)[key]);
}

export function runExpression(grid: Grid, cell: Coord, node: t.Expression | t.PrivateName): number | boolean {
    if (node.type === 'Identifier') {
        if (!(node.name in EXPRESSION_VARIABLES)) {
            error(`Nonexistent variable: '${node.name}'`);
        }
        let out = EXPRESSION_VARIABLES[node.name];
        if (typeof out === 'function') {
            return out(grid, cell);
        } else {
            return out;
        }
    } else if (node.type === 'NumericLiteral') {
        return node.value;
    } else if (node.type === 'BooleanLiteral') {
        return node.value;
    } else if (node.type === 'UnaryExpression') {
        let value = runExpression(grid, cell, node.argument);
        if (node.operator === '-') {
            return -value;
        } else if (node.operator === '+') {
            return +value;
        } else {
            error(`Invalid unary operator: '${node.operator}'`);
        }
    } else if (node.type === 'BinaryExpression') {
        let left = runExpression(grid, cell, node.left);
        let right = runExpression(grid, cell, node.right);
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
            return runExpression(grid, cell, node.left) && runExpression(grid, cell, node.right);
        } else if (node.operator === '||') {
            return runExpression(grid, cell, node.left) || runExpression(grid, cell, node.right);
        } else {
            error(`Invalid binary operator: '${node.operator}'`);
        }
    } else if (node.type === 'ConditionalExpression') {
        return runExpression(grid, cell, node.test) ? runExpression(grid, cell, node.consequent) : runExpression(grid, cell, node.alternate);
    } else if (node.type === 'CallExpression') {
        if (node.callee.type !== 'Identifier') {
            error(`Cannot call non-constant function`);
        }
        if (!(node.callee.name in EXPRESSION_FUNCTIONS)) {
            error(`Nonexistent function: '${node.callee.name}'`);
        }
        let args: (number | boolean)[] = [];
        for (let arg of node.arguments) {
            if (arg.type === 'SpreadElement' || arg.type === 'ArgumentPlaceholder') {
                error(`Invalid node: '${arg.type}'`);
            } else {
                args.push(runExpression(grid, cell, arg));
            }
        }
        return EXPRESSION_FUNCTIONS[node.callee.name](grid, cell, ...args);
    } else {
        error(`Invalid node: '${node.type}'`);
    }
}


export class VLSFileError extends ParserError {

    name: string = 'VLSFileError';
    [Symbol.toStringTag]: string = 'VLSFileError';

}


type StateSpecifier = {all?: boolean} & (
    | {type: 'nop'}
    | {type: 'cell', cell: Cell}
    | {type: 'periodic', cell: Cell, period: number}
);

function stateSpecifiersAreEqual(x: StateSpecifier, y: StateSpecifier): boolean {
    if (Boolean(x.all) !== Boolean(y.all)) {
        return false;
    }
    if (x.type !== y.type) {
        return false;
    }
    if (x.type === 'nop' && y.type === 'nop') {
        return true;
    } else if (x.type === 'cell' && y.type === 'cell') {
        return x.cell.eq(y.cell);
    } else if (x.type === 'periodic' && y.type === 'periodic') {
        return x.cell.eq(y.cell) && x.period === y.period;
    } else {
        throw new Error(`This error should not occur, please report it (invalid state specifier type(s): '${(x as any).type}' and '${(y as any).type})`);
    }
}


type Value = 
    | {type: 'null'}
    | {type: 'boolean', value: boolean}
    | {type: 'number', value: number}
    | {type: 'state-specifier', value: StateSpecifier}
;

function isTruthy(value: Value): boolean {
    if (value.type === 'null') {
        return false;
    } else if (value.type === 'boolean') {
        return value.value;
    } else if (value.type === 'number') {
        return value.value !== 0;
    } else if (value.type === 'state-specifier') {
        return true;
    } else {
        throw new Error(`This error should not occur, please report it (invalid value type: '${(value as any).type}')`);
    }
}

function valueToBoolean(value: Value): Value {
    return {type: 'boolean', value: isTruthy(value)};
}

function valuesAreEqual(x: Value, y: Value): boolean {
    if (x.type !== y.type) {
        return false;
    }
    if (x.type === 'null' && y.type === 'null') {
        return true;
    } else if (x.type === 'boolean' && y.type === 'boolean') {
        return x.value === y.value;
    } else if (x.type === 'number' && y.type === 'number') {
        return x.value === y.value;
    } else if (x.type === 'state-specifier' && y.type === 'state-specifier') {
        return stateSpecifiersAreEqual(x.value, y.value);
    } else {
        throw new Error(`This error should not occur, please report it (invalid value type(s): '${(x as any).type}' and '${(y as any).type})`);
    }
}


class Scope {

    parser: VLSFileParser;
    parent: Scope | undefined;
    vars: {[key: string]: Value};
    states: {[key: number]: StateSpecifier};

    constructor(parser: VLSFileParser, parent: Scope | undefined) {
        this.parser = parser;
        this.parent = parent;
        this.vars = {};
        this.states = {};
    }

    getVar(name: string, offset: number = 0): Value {
        if (name in this.vars) {
            return this.vars[name];
        }
        if (this.parent) {
            return this.parent.getVar(name, offset);
        } else {
            this.parser.error(`Variable ${name} is not defined`, offset);
        }
    }

    // absGetVar(name: string, pos: number): Value {
    //     if (name in this.vars) {
    //         return this.vars[name];
    //     }
    //     if (this.parent) {
    //         return this.parent.absGetVar(name, pos);
    //     } else {
    //         this.parser.absError(`Variable ${name} is not defined`, pos);
    //     }
    // }

    setVar(name: string, value: Value): void {
        this.vars[name] = value;
    }

    hasVar(name: string): boolean {
        if (name in this.vars) {
            return true;
        } else if (this.parent) {
            return this.parent.hasVar(name);
        } else {
            return false;
        }
    }

    getState(state: number, offset: number = 0): StateSpecifier {
        if (state in this.states) {
            return this.states[state];
        }
        if (this.parent) {
            return this.parent.getState(state, offset);
        } else {
            this.parser.error(`State ${state} is not defined`, offset);
        }
    }

    // absGetState(state: number, pos: number): StateSpecifier {
    //     if (state in this.states) {
    //         return this.states[state];
    //     }
    //     if (this.parent) {
    //         return this.parent.absGetState(state, pos);
    //     } else {
    //         this.parser.absError(`State ${state} is not defined`, pos);
    //     }
    // }

    setState(state: number, value: StateSpecifier): void {
        this.states[state] = value;
    }

    hasState(state: number): boolean {
        if (state in this.states) {
            return true;
        } else if (this.parent) {
            return this.parent.hasState(state);
        } else {
            return false;
        }
    }

    deleteState(state: number, offset: number = 0): void {
        if (state in this.states) {
            delete this.states[state];
        } else {
            this.parser.error(`State ${state} is not defined or is defined in a higher scope`, offset);
        }
    }

    absDeleteState(state: number, pos: number): void {
        if (state in this.states) {
            delete this.states[state];
        } else {
            this.parser.absError(`State ${state} is not defined or is defined in a higher scope`, pos);
        }
    }

}


const IDENTIFIER_CHARS = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-`;
const IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RESERVED_WORDS = new Set([
    // literals
    'true', 'false', 'nop', 'off', 'on', 'unknown', 'var',
    // operators
    'states', 'unsearchable', 'period', 'all',
    // constructs
    'state', 'states', 'to',
    // statements
    'pattern', 'gen', 'gens', 'wrap', 'expand', 'delete',
]);

const NUMBER_REGEX = /^-?(0|[1-9]\d*(.[0-9]+)?(e[+-]?[1-9]\d+(.[0-9]+)?)?|0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F])$/;
const NUMBER_AND_STUFF_REGEX = /^-?([1-9]\d+(.[0-9]+)?(e[+-]?[1-9]\d+(.[0-9]+)?)?|0[bB][01]+|0[oO][0-7]+|0[xX][0-9a-fA-F])/;

const UNARY_OPERATORS = Object.assign(Object.create(null) as {}, {
    'state': 13,
    'unsearchable': 13,
    'period': 13,
    'all': 13,
    '+': 11,
    '-': 11,
    '!': 11,
} satisfies {[key: string]: number});

type UnaryOperator = keyof typeof UNARY_OPERATORS;

const BINARY_OPERATORS = Object.assign(Object.create(null) as {}, {
    '**': 12,
    '*': 10,
    '/': 10,
    '%': 10,
    '+': 9,
    '-': 9,
    '<<': 8,
    '>>': 8,
    '>>>': 8,
    '??': 7,
    '<': 6,
    '<=': 6,
    '>': 6,
    '>=': 6,
    '==': 5,
    '!=': 5,
    '&': 4,
    '^': 3,
    '|': 2,
    '&&': 1,
    '||': 0,
} satisfies {[key: string]: number});

type BinaryOperator = keyof typeof BINARY_OPERATORS;

const LONG_OPERATORS = new Set<string>();
for (let op of Object.keys(UNARY_OPERATORS).concat(Object.keys(BINARY_OPERATORS))) {
    if (op.length === 1) {
        continue;
    } else if (op.match(IDENTIFIER_REGEX)) {
        continue;
    } else {
        LONG_OPERATORS.add(op);
    }
}


const T_LINE_END: Matcher = [new Set(['\n', ';', EOF]), 'line end'];

const T_IDENTIFIER: Matcher = [IDENTIFIER_REGEX, 'identifier'];
const T_NATURAL_NUMBER: Matcher = [/^\d+$/, 'natural number'];
const T_INTEGER: Matcher = [/^-?\d+$/, 'integer'];
const T_NUMBER: Matcher = [NUMBER_REGEX, 'number'];
const T_RLE: Matcher = [/^x\s*=\s*\d+\s*,\s*y\s*=\s*\d+.*!$/s, 'RLE'];


class VLSFileParser extends BaseParser {

    static ParserError = VLSFileError;

    grids: Grid[];
    _grid: Grid | undefined;

    scope: Scope;

    constructor(file: string | undefined, code: string) {
        super(file, code);
        this.grids = [];
        this._grid = undefined;
        this.scope = new Scope(this, undefined);
        this.scope.setState(0, {type: 'cell', cell: cell(OFF)});
        this.scope.setState(1, {type: 'cell', cell: cell(ON)});
        this.scope.setState(2, {type: 'cell', cell: cell(UNKNOWN)});
        this.scope.setState(3, {type: 'periodic', cell: cell(UNKNOWN), period: 1});
        this.scope.setState(4, {type: 'cell', cell: cell(OFF)});
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
                pos--;
                this.addToken(data, startPos);
            } else if (IDENTIFIER_CHARS.includes(char)) {
                let match = code.slice(pos).match(NUMBER_AND_STUFF_REGEX);
                current += char;
            } else {
                if (current.length > 0) {
                    this.addToken(current.trimEnd(), startPos);
                }
                current = '';
                if (pos < code.length - 2 && LONG_OPERATORS.has(char + code[pos + 1] + code[pos + 2])) {
                    this.addToken(char + code[pos + 1] + code[pos + 2], pos);
                    startPos = pos + 3;
                    pos += 2;
                } else if (pos < code.length - 1 && LONG_OPERATORS.has(char + code[pos + 1])) {
                    this.addToken(char + code[pos + 1], pos);
                    startPos = pos + 2;
                    pos += 1;
                } else {
                    this.addToken(char, pos);
                    startPos = pos + 1;   
                }
            }
        }
        current = current.trimEnd();
        if (current !== '') {
            this.addToken(current, startPos);
        }
    }

    get grid(): Grid {
        if (!this._grid) {
            this.error(`Pattern statement used before any patterns are defined`);
        }
        return this._grid;
    }

    identifier(): string {
        let out = this.eat(T_IDENTIFIER)[0];
        if (RESERVED_WORDS.has(out)) {
            this.error(`Invalid identifier (reserved word)`, -1);
        }
        return out;
    }

    nullLiteral(): Value {
        this.eat(literal('null'));
        return {type: 'null'};
    }

    booleanLiteral(): Value {
        let value = this.advance();
        if (value === 'true') {
            return {type: 'boolean', value: true};
        } else if (value === 'false') {
            return {type: 'boolean', value: false};  
        } else {
            this.goBack();
            this.error(`Expected boolean literal`);
        }
    }

    numberLiteral(): Value {
        return {type: 'number', value: Number(this.eat(T_NUMBER)[0])};
    }

    stateSpecifierLiteral(): Value {
        let value = this.advance();
        let out: StateSpecifier;
        if (value === 'off') {
            out = {type: 'cell', cell: cell(OFF)};
        } else if (value === 'on') {
            out = {type: 'cell', cell: cell(ON)};
        } else if (value === 'unknown') {
            out = {type: 'cell', cell: cell(UNKNOWN)};
        } else if (value === 'var') {
            out = {type: 'cell', cell: cell(UNKNOWN, this.grid.getNewVar())};
        } else {
            this.goBack();
            this.error(`Invalid state specifier literal`, -1);
        }
        return {type: 'state-specifier', value: out};
    }

    literal(): Value {
        let name = this.try(this.identifier);
        if (name !== undefined) {
            return this.scope.getVar(name, -1);
        }
        return this.tryStack([
            this.nullLiteral,
            this.booleanLiteral,
            this.numberLiteral,
            this.stateSpecifierLiteral,
        ], `Invalid literal`);
    }

    primaryExpression(): Value {
        if (this.match('(')) {
            this.advance();
            let out = this.expression();
            this.eat(literal(')'));
            return out;
        }
        return this.literal();
    }

    evalUnary(op: UnaryOperator, value: Value): Value {
        if (op === '+' || op === '-' || op === 'state' || op === 'period') {
            if (value.type !== 'number') {
                this.error(`Expected value of type 'number' for unary '${op}' operator, got type '${value.type}'`);
            }
            if (op === '+') {
                return {type: 'number', value: +value.value};
            } else if (op === '-') {
                return {type: 'number', value: -value.value};
            } else if (op === 'state') {
                return {type: 'number', value: value.value};
            } else if (op === 'period') {
                return {type: 'number', value: -value.value};
            } else if (op === '-') {
                return {type: 'number', value: -value.value};
            } else {
                throw new Error(`This error should not occur, please report it (invalid unary operator: '${op}')`);
            }
        } else if (op === 'unsearchable' || op === 'all') {
            if (value.type !== 'state-specifier') {
                this.error(`Expected value of type 'state-specifier' for unary '${op}' operator, got type '${value.type}'`);
            }
            let out = structuredClone(value.value);
            if (out.type === 'nop') {
                this.error(`Cannot run unary '${op}' operator on nop state specifier`);
            }
            if (op === 'unsearchable') {
                out.cell.searchable = false;
            } else if (op === 'all') {
                out.all = true;
            } else {
                throw new Error(`This error should not occur, please report it (invalid unary operator: '${op}')`);
            }
            return {type: 'state-specifier', value: out};
        } else if (op === '!') {
            return {type: 'boolean', value: !isTruthy(value)};
        }
        throw new Error(`This error should not occur, please report it (invalid unary operator: '${op}')`);
    }

    evalBinary(op: BinaryOperator, left: Value, right: Value): Value {
        if (op === '==') {
            return {type: 'boolean', value: valuesAreEqual(left, right)};
        } else if (op === '!=') {
            return {type: 'boolean', value: !valuesAreEqual(left, right)};
        } else if (op === '&&') {
            return {type: 'boolean', value: isTruthy(left) && isTruthy(right)};
        } else if (op === '||') {
            return {type: 'boolean', value: isTruthy(left) || isTruthy(right)};
        } else if (op === '??') {
            return left.type === 'null' ? right : left;
        } else {
            if (left.type !== 'number') {
                this.error(`Expected value of type 'number' for '${op}' operator, got type '${left.type}'`);
            }
            if (right.type !== 'number') {
                this.error(`Expected value of type 'number' for '${op}' operator, got type '${right.type}'`);
            }
            let x = left.value;
            let y = right.value;
            let out: number;
            if (op === '+') {
                out = x + y;
            } else if (op === '-') {
                out = x - y;
            } else if (op === '*') {
                out = x * y;
            } else if (op === '/') {
                out = x / y;
            } else if (op === '%') {
                out = x % y;
            } else if (op === '**') {
                out = x ** y;
            } else if (op === '&') {
                out = Number(BigInt(x) & BigInt(y));
            } else if (op === '|') {
                out = Number(BigInt(x) | BigInt(y));
            } else if (op === '^') {
                out = Number(BigInt(x) ^ BigInt(y));
            } else if (op === '<<') {
                out = Number(BigInt(x) << BigInt(y));
            } else if (op === '>>') {
                out = Number(BigInt(x) >> BigInt(y));
            } else if (op === '>>>') {
                out = x >>> y;
            } else if (op === '<') {
                return {type: 'boolean', value: x < y};
            } else if (op === '<=') {
                return {type: 'boolean', value: x <= y};
            } else if (op === '>') {
                return {type: 'boolean', value: x > y};
            } else if (op === '>=') {
                return {type: 'boolean', value: x >= y};
            } else {
                throw new Error(`This error should not occur, please report it (invalid binary operator: '${op}')`);
            }
            return {type: 'number', value: out};
        }
    }

    _expression(minPrecedence: number): Value {
        let left: Value;
        let lookahead = this.peek();
        if (lookahead !== EOF && lookahead in UNARY_OPERATORS) {
            let op = lookahead as UnaryOperator;
            let precedence = UNARY_OPERATORS[op];
            if (precedence < minPrecedence) {
                this.error(`Unexpected unary operator ${op}`);
            }
            this.advance();
            let value = this._expression(precedence);
            left = this.evalUnary(op, value);
        } else {
            left = this.primaryExpression();
        }
        while (true) {
            lookahead = this.peek();
            if (lookahead === EOF || !(lookahead in BINARY_OPERATORS)) {
                break;
            }
            let op = lookahead as BinaryOperator;
            let precedence = BINARY_OPERATORS[op];
            if (precedence < minPrecedence) {
                break;
            }
            this.advance();
            let right = this._expression(precedence + 1);
            left = this.evalBinary(op, left, right);
        }
        return left;
    }
    
    expression(): Value {
        return this._expression(0);
    }

    numberExpression(): number {
        let value = this.expression();
        if (value.type !== 'number') {
            this.error(`Expected value of type 'number', got type '${value.type}'`);
        }
        return value.value;
    }
    
    expressionStatement(): void {
        this.expression();
        this.eat(T_LINE_END);
    }

    generation(): number {
        let out = this.numberExpression();
        if (out >= this.grid.gens) {
            this.error(`Generation out of bounds: '${out}'`, -1);
        } else if (out < 0) {
            if (out < -this.grid.gens) {
                this.error(`Generation out of bounds: '${out}'`, -1);
            }
            out = (out + this.grid.gens) % this.grid.gens;
        }
        return out;
    }

    generationOrRange(): number[] {
        let value = this.generation();
        if (this.match('to')) {
            this.advance();
            let end = this.generation();
            let out: number[] = [];
            for (let i = value; i <= end; i++) {
                out.push(i);
            }
            return out;
        } else {
            return [value];
        }
    }

    stateOrRange(): number[] {
        if (this.match('state')) {
            this.advance();
            return [this.numberExpression()];
        } else if (this.match('states')) {
            let start = this.numberExpression();
            this.eat(literal('to'));
            let end = this.numberExpression();
            let out: number[] = [];
            for (let i = start; i < end; i++) {
                out.push(i);
            }
            return out;
        } else {
            this.error(`Expected state or range`);
        }
    }

    patternStatement(): void {
        this.eat(literal('pattern'));
        let width = 0;
        let height = 0;
        if (this.match(/^\d+x\d+$/)) {
            let value = this.advance().split('x');
            width = Number(value[0]);
            height = Number(value[1]);
        }
        let gens = this.numberExpression();
        if (gens === 0) {
            this.error(`Generations value cannot be 0`, -2);
        }
        this.eat(literal('gens'));
        let newGrid = new Grid(width, height, gens);
        if (this._grid) {
            this.grids.push(this._grid);
            newGrid.numVars = this._grid.numVars;
        }
        this._grid = newGrid;
    }

    stateSetStatement(): void {
        let states = this.stateOrRange();
        this.eat(['=', 'equals sign']);
        let start = this.pos;
        for (let state of states) {
            this.pos = start;
            let value = this.expression();
            if (value.type !== 'state-specifier') {
                this.error(`Expected value of type 'state-specifier' for state set statement`);
            }
            this.scope.setState(state, value.value);
        }
        this.eat(T_LINE_END);
    }

    setCells(ts: number[], x: number, y: number, value: StateSpecifier, baseT: number): void {
        if (value.type === 'nop') {
            // do nothing
        } else if (value.type === 'cell') {
            for (let t of ts) {
                this.grid.set(t, x, y, structuredClone(value.cell));
            }
        } else if (value.type === 'periodic') {
            let cells: Cell[] = [];
            for (let i = 0; i < value.period; i++) {
                let cell = structuredClone(value.cell);
                cell.variable = this.grid.getNewVar();
                cells.push(cell);
            }
            for (let t of ts) {
                let cell = structuredClone(cells[(t + baseT) % cells.length]);
                this.grid.set(t, x, y, cell);
            }
        } else {
            throw new Error(`This error should not occur, please report it (invalid state specifier type: '${(value as any).type}')`);
        }
    }

    rleStatement(): void {
        let gens: number[] | 'all';
        if (this.match('gen') || this.match('gens')) {
            this.advance();
            gens = [];
            while (true) {
                for (let value of this.generationOrRange()) {
                    gens.push(value);
                }
                if (this.match(',')) {
                    this.advance();
                } else {
                    break;
                }
            }
        } else {
            this.eat(literal('all'), literal('gens'));
            gens = 'all';
        }
        let xOffset = 0;
        let yOffset = 0;
        if (this.match('offset')) {
            this.advance();
            xOffset = this.numberExpression();
            this.eat(literal(','));
            yOffset = this.numberExpression();
        }
        this.eat([':', 'colon'], T_LINE_END);
        let rle = this.eat(T_RLE)[0];
        let index = rle.indexOf('\n');
        if (index === -1) {
            this.error(`RLE header without data`, -1);
        }
        let header = rle.slice(0, index);
        let p = IdentityPattern.loadRLE(rle.slice(index + 1));
        // expand the grid to fit
        let match = header.match(/^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/);
        if (!match) {
            throw new Error(`This error should not occur, please report it (bad RLE header)`);
        }
        let width = Math.max(Number(match[1]), p.width);
        let height = Math.max(Number(match[2]), p.height);
        p.expand(0, height - p.height, 0, width - p.width);
        if (xOffset < 0) {
            this.grid.expand({left: -xOffset});
            xOffset = 0;
        }
        if (yOffset < 0) {
            this.grid.expand({up: -xOffset});
            yOffset = 0;
        }
        let maxX = width + xOffset;
        let maxY = height + yOffset;
        if (maxX > this.grid.width) {
            this.grid.expand({right: maxX - this.grid.width});
        }
        if (maxY > this.grid.height) {
            this.grid.expand({down: maxY - this.grid.height});
        }
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let state = p.get(x, y);
                let x2 = x + xOffset;
                let y2 = y + yOffset;
                let data = this.scope.getState(state);
                if (gens === 'all' || data.all) {
                    this.setCells(Array.from({length: this.grid.gens}, (_, i) => i), x2, y2, data, 0);
                } else {
                    for (let gen of gens) {
                        this.setCells(gens, x2, y2, data, 0);
                    }
                }
            }
        }
        this.eat(T_LINE_END);
    }

    wrapStatement(): void {
        this.eat(literal('wrap'));
        let [dx, dy] = this.eat(T_INTEGER, T_INTEGER);
        this.grid.applyWrap(Number(dx), Number(dy));
        this.eat(T_LINE_END);
    }

    expandStatement(): void {
        this.eat(literal('expand'));
        while (!this.match(T_LINE_END)) {
            let data = this.eat([new Set(['start', 'end', 'up', 'down', 'left', 'right']), 'direction'], T_NATURAL_NUMBER);
            this.grid.expand({[data[0] as any]: Number(data[1])});
        }
    }

    deleteStatement(): void {
        this.eat(literal('delete'));
        let to = this.pos - 1;
        let states = this.stateOrRange();
        for (let state of states) {
            this.scope.deleteState(state, this.pos - to);
        }
    }

    statement(): void {
        if (this.match('pattern')) {
            this.patternStatement();
        } else if (this.match('state') || this.match('states')) {
            this.stateSetStatement();
        } else if (this.match('gen') || this.match('gens')) {
            this.rleStatement();
        } else if (this.match('wrap')) {
            this.wrapStatement();
        } else if (this.match('expand')) {
            this.expandStatement();
        } else if (this.match('delete')) {
            this.deleteStatement();
        } else {
            this.error(`Expected statement`);
        }
    }

    async program(): Promise<Grid> {
        while (this.match(T_LINE_END) && !this.match(EOF)) {
            this.advance();
        }
        while (!this.match(EOF)) {
            this.statement();
            while (this.match(T_LINE_END) && !this.match(EOF)) {
                this.advance();
            }
        }
        if (this._grid) {
            this.grids.push(this._grid);
        }
        if (this.grids.length === 0) {
            this.error(`No patterns provided`);
        }
        return mergeGrids(this.grids);
    }

}


export async function runFile(filename: string): Promise<Grid> {
    let fs = await import('node:fs/promises');
    let code = (await fs.readFile(filename)).toString();
    try {
        let parser = new VLSFileParser(filename, code);
        return await parser.program();
    } catch (e) {
        if (IS_BROWSER) {
            throw e;
        } else {
            if (e instanceof VLSFileError) {
                console.error(`Use ./vls -h for help`);
                process.exit(1);
            } else {
                throw e;
            }
        }
    }
}
