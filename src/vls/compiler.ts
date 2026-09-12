
import * as fs from 'node:fs/promises';

import * as t from '@babel/types';

import {Matcher, EOF, ParserError, BaseParser, IdentityPattern} from '../core/index.js';


export function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls --help for help`);
    process.exit(1);
}


export const UNKNOWN = 0;
export const OFF = 1;
export const ON = 2;
export const DONT_CARE = 3;

export type State = typeof UNKNOWN | typeof OFF | typeof ON | typeof DONT_CARE;

function isKnown(state: State): state is typeof OFF | typeof ON {
    return state === ON || state === OFF;
}

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

    width: number;
    height: number;
    gens: number;
    size: number;
    data: Cell[][][];
    numVars: number = 0;
    wrap: false | [number, number] = false;

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
    }

    get(t: number, x: number, y: number): Cell {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            throw new Error(`Out of bounds get: t = ${t}, x = ${x}, y = ${y}`);
        }
        return this.data[t][y][x];
    }

    getAllowOOB(t: number, x: number, y: number): Cell {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return cell(OFF);
        }
        return this.data[t][y][x];
    }

    set(t: number, x: number, y: number, value: Cell): this;
    set(t: number, x: number, y: number, value: State, variable?: Variable | undefined, settable?: Settability): this;
    set(t: number, x: number, y: number, value: Cell | State, variable?: Variable | undefined, settable?: Settability): this {
        if (typeof value === 'number') {
            value = cell(value, variable, settable);
        }
        if (t < 0 || t > this.gens || x < 0 || x > this.width || y < 0 || y > this.height) {
            throw new Error(`Out of bounds set: t = ${t}, x = ${x}, y = ${y}`);
        }
        this.data[t][y][x] = value;
        return this;
    }

    fill(t: number, cell: Cell): this;
    fill(t: number, value: State, variable?: Variable | undefined, settable?: Settability): this
    fill(t: number, value: Cell | State, variable?: Variable | undefined, settable?: Settability): this {
        if (typeof value === 'number') {
            value = cell(value, variable, settable);
        }
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.data[t][y][x] = structuredClone(value);
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

    reassignVar(old: Variable, new_: Variable): this {
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
        return this;
    }

    setVar(variable: Variable, state: State): this {
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.data[t][y][x];
                    if (cell.variable === variable) {
                        cell.state = state;
                        cell.variable = 0;
                    }
                }
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
            this.data.push(structuredClone(emptyGrid));
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
        for (let grid of this.data) {
            for (let row of grid) {
                for (let i = 0; i < left; i++) {
                    row.shift();
                }
                for (let i = 0; i < right; i++) {
                    row.pop();
                }
            }
            for (let i = 0; i < up; i++) {
                grid.shift();
            }
            for (let i = 0; i < down; i++) {
                grid.pop();
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

    combineCells(x: Cell, y: Cell, coords?: [[t: number, x: number, y: number], [t: number, x: number, y: number]]): this {
        let simple: undefined | 'x = y' | 'y = x' = undefined;
        if (isKnown(x.state)) {
            if (isKnown(y.state)) {
                if (x.state !== y.state) {
                    error(`Contradiction detected while binding together cells ${coords !== undefined ? ` at t = ${coords[0][0]}, x = ${coords[0][1]}, y = ${coords[0][2]} and t = ${coords[1][0]}, x = ${coords[1][1]}, y = ${coords[1][2]}` : ''}`);
                }
                simple = 'x = y';
            } else if (y.state === DONT_CARE) {
                simple = 'x = y';
            } else {
                simple = 'y = x';
            }
        } else if (x.state === DONT_CARE) {
            if (isKnown(y.state)) {
                simple = 'x = y';
            } else if (y.state === DONT_CARE) {
                simple = 'x = y';
            } else {
                // don't care propagates
                simple = 'y = x';
            }
        } else {
            if (isKnown(y.state)) {
                simple = 'x = y';
            } else if (y.state === DONT_CARE) {
                // don't care propagates
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
            x.settable = y.settable;
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

    bindCells(cell1: [t: number, x: number, y: number], cell2: [t: number, x: number, y: number]): this {
        let x = this.data[cell1[0]][cell1[2]][cell1[1]];
        let y = this.data[cell2[0]][cell2[2]][cell2[1]];
        return this.combineCells(x, y, [cell1, cell2]);
    }

    combineWith(otherGrid: Grid): this {
        // if (this.width !== other.width || this.height !== other.height || this.gens !== other.gens) {
        //     throw new Error(`This error should not occur, please report it (bounding box mismatch while attempting to combine grids)`);
        // }
        for (let t = 0; t < this.gens; t++) {
            for (let yi = 0; yi < this.height; yi++) {
                for (let xi = 0; xi < this.width; xi++) {
                    let cell = this.data[t][yi][xi];
                    let other = otherGrid.data[t]?.[yi]?.[xi];
                    if (other === undefined) {
                        continue;
                    }
                    this.combineCells(cell, other);
                }
            }
        }
        return this;
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

    shrinkToFit(): this {
        let start = 0;
        while (this.data[start].every(row => row.every(cell => cell.state === OFF))) {
            start++;
        }
        let end = 0;
        while (this.data[this.data.length - end - 1].every(row => row.every(cell => cell.state === OFF))) {
            end++;
        }
        let up = 0;
        while (this.data.every(grid => grid[up].every(cell => cell.state === OFF))) {
            up++;
        }
        let down = 0;
        while (this.data.every(grid => grid[grid.length - down - 1].every(cell => cell.state === OFF))) {
            down++;
        }
        let left = 0;
        while (this.data.every(grid => grid.every(row => row[left].state === OFF))) {
            left++;
        }
        let right = 0;
        while (this.data.every(grid => grid.every(row => row[this.width - right - 1].state === OFF))) {
            right++;
        }
        this.shrink({start, end, up, down, left, right});
        return this;
    }

    removeKnownVars(): this {
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let cell = this.data[t][y][x];
                    if (cell.variable !== undefined && cell.state !== UNKNOWN) {
                        this.setVar(cell.variable, cell.state);
                    }
                }
            }
        }
        return this;
    }

    removeSingleUseVars(): this {
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
        return this;
    }

    removeUnusedVars(): this {
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
        return this;
    }

    normalize(): this {
        this.shrinkToFit();
        this.removeKnownVars();
        this.removeSingleUseVars();
        this.removeUnusedVars();
        return this;
    }

    resolveWrap(): this {
        if (!this.wrap) {
            return this;
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
                    this.bindCells([0, x, y], [this.gens - 1, x2, y2]);
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
        return this;
    }

    setTopEdge(type: EdgeType, expand: boolean = true): this {
        if (type === 'none') {
            return this;
        }
        if (expand) {
            this.expand({up: 2});
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, 0, cell(DONT_CARE));
            }
        }
        let bindToY: number;
        if (type === 'even') {
            bindToY = 2;
        } else if (type === 'odd') {
            bindToY = 3;
        } else {
            bindToY = this.height - 1;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.bindCells([t, x, 1], [t, x, bindToY]);
            }
        }
        return this;
    }

    setBottomEdge(type: EdgeType, expand: boolean = true): this {
        if (type === 'none') {
            return this;
        }
        if (expand) {
            this.expand({down: 2});
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, this.height - 1, cell(DONT_CARE));
            }
        }
        let bindToY: number;
        if (type === 'even') {
            bindToY = this.height - 3;
        } else if (type === 'odd') {
            bindToY = this.height - 4;
        } else {
            bindToY = 0;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let x = 0; x < this.width; x++) {
                this.bindCells([t, x, this.height - 2], [t, x, bindToY]);
            }
        }
        return this;
    }

    setLeftEdge(type: EdgeType, expand: boolean = true): this {
        if (type === 'none') {
            return this;
        }
        if (expand) {
            this.expand({left: 2});
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.set(t, 0, y, cell(DONT_CARE));
            }
        }
        let bindToX: number;
        if (type === 'even') {
            bindToX = 2;
        } else if (type === 'odd') {
            bindToX = 3;
        } else {
            bindToX = this.width - 1;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.bindCells([t, 1, y], [t, bindToX, y]);
            }
        }
        return this;
    }

    setRightEdge(type: EdgeType, expand: boolean = true): this {
        if (type === 'none') {
            return this;
        }
        if (expand) {
            this.expand({right: 2});
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.set(t, this.width - 1, y, cell(DONT_CARE));
            }
        }
        let bindToX: number;
        if (type === 'even') {
            bindToX = this.width - 3;
        } else if (type === 'odd') {
            bindToX = this.width - 4;
        } else {
            bindToX = 0;
        }
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                this.bindCells([t, this.width - 2, y], [t, bindToX, y]);
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

}



export const SYMMETRIES: {[key: string]: string | ((grid: Grid) => void)} = {

    C1(grid: Grid): void {
        // do nothing
    },

    // D2h(grid: Grid): void {
    //     for (let t = 0; t < grid.gens; t++) {
    //         for (let y = 0; y < grid.height; y++) {
    //             for (let x = 0; x < Math.ceil(grid.width / 2); x++) {
    //                 grid.bindCells([t, x, y], [t, grid.width - x - 1, y]);
    //             }
    //         }
    //     }
    // },
    // 'D2|': 'D2h',

    // D2v(grid: Grid): void {
    //     for (let t = 0; t < grid.gens; t++) {
    //         for (let y = 0; y < Math.ceil(grid.height / 2); y++) {
    //             for (let x = 0; x < Math.ceil(grid.width / 2); x++) {
    //                 grid.bindCells([t, x, y], [t, x, grid.height - y - 1]);
    //             }
    //         }
    //     }
    // },
    // 'D2-': 'D2v',

    D2h(grid: Grid): void {
        let type: EdgeType = grid.width % 2 === 0 ? 'even' : 'odd';
        let right = grid.copy().flipHorizontal().shrink({right: Math.floor(grid.width / 2)});
        grid = grid.shrink({right: Math.floor(grid.width / 2) - 2});
        grid.combineWith(right);
        grid.setRightEdge(type, false);
    },
    'D2|': 'D2h',

    D2v(grid: Grid): void {
        let type: EdgeType = grid.height % 2 === 0 ? 'even' : 'odd';
        let bottom = grid.copy().flipVertical().shrink({down: Math.floor(grid.height / 2)});
        grid = grid.shrink({down: Math.floor(grid.height / 2) - 2});
        grid.combineWith(bottom);
        grid.setBottomEdge(type, false);
    },
    'D2-': 'D2v',

    // D2b(grid: Grid): void {

    // },
    // 'D2\\': 'D2b',

    // D2s(grid: Grid): void {

    // },
    // 'D2/': 'D2s',

    D4p(grid: Grid): void {
        grid.applySymmetry('D2h');
        grid.applySymmetry('D2v');
        // let type1: EdgeType = grid.width % 2 === 0 ? 'even' : 'odd';
        // let type2: EdgeType = grid.height % 2 === 0 ? 'even' : 'odd';
        // let right = grid.copy().flipHorizontal().shrink({right: Math.floor(grid.width / 2)});
        // grid = grid.shrink({right: Math.floor(grid.width / 2) - 2});
        // grid.combineWith(right);
        // let bottom = grid.copy().flipHorizontal().shrink({down: Math.floor(grid.height / 2)});
        // grid = grid.shrink({down: Math.floor(grid.height / 2) - 2});
        // grid.combineWith(bottom);
        // grid.setRightEdge(type1);
        // grid.setBottomEdge(type2);
    },
    'D4+': 'D4p',

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
        grid.resolveWrap();
        let vars: {[key: number]: number} = {};
        for (let t = 0; t < grid.gens; t++) {
            for (let y = 0; y < grid.height; y++) {
                for (let x = 0; x < grid.width; x++) {
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

type StateSpecifier = 
    | {type: 'cell', cell: Cell}
    | {type: 'periodic', cell: Cell, period: number}
;

interface FullStateSpecifier {
    all?: StateSpecifier;
    absolute: [number[], StateSpecifier][];
    relative: [number[], StateSpecifier][];
}

class VLSFileParser extends BaseParser {

    static ParserError = VLSFileError;

    states: {[key: number]: FullStateSpecifier};
    grids: Grid[];
    grid: Grid;

    constructor(file: string | undefined, code: string) {
        super(file, code);
        this.states = {
            0: {absolute: [], relative: [[[0], {type: 'cell', cell: cell(OFF)}]]},
            1: {absolute: [], relative: [[[0], {type: 'cell', cell: cell(ON)}]]},
            2: {absolute: [], relative: [[[0], {type: 'cell', cell: cell(UNKNOWN)}]]},
            3: {absolute: [], relative: [[[0], {type: 'cell', cell: cell(DONT_CARE)}]]},
            4: {all: {type: 'periodic', period: 1, cell: cell(UNKNOWN)}, absolute: [], relative: []},
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

    static readonly T_STATE_SPECIFIER: Matcher = [new Set(['unchecked', 'unset', '0', '1', '*', '`', 'var', /^p\d+$/]), 'state meaning'];

    stateSpecifier(): StateSpecifier {
        let data: string[] = [this.eat(VLSFileParser.T_STATE_SPECIFIER)[0]];
        while (this.match(VLSFileParser.T_STATE_SPECIFIER)) {
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
            return {type: 'periodic', cell: cell(state, variable, settable), period};
        } else {
            return {type: 'cell', cell: cell(state, variable, settable)};
        }
    }

    boundStateSpecifier(out: FullStateSpecifier): void {
        if (this.match('all')) {
            this.advance();
            this.eat([':', 'colon']);
            out.all = this.stateSpecifier();
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
            let value = this.stateSpecifier();
            let times: number[] = [];
            for (let i = start; i < end; i++) {
                times.push(i);
            }
            if (absolute) {
                out.absolute.push([times, structuredClone(value)]);
            } else {
                out.relative.push([times, structuredClone(value)]);
            }
        } else {
            out.all = this.stateSpecifier();
        }
    }

    fullStateSpecifier(): FullStateSpecifier {
        let out: FullStateSpecifier = {absolute: [], relative: []};
        while (!this.match(T_LINE_END)) {
            this.boundStateSpecifier(out);
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
        this.states[state] = this.fullStateSpecifier();
        this.eat(T_LINE_END);
    }

    setCells(ts: number[], x: number, y: number, value: StateSpecifier, baseT: number): void {
        if (value.type === 'cell') {
            for (let t of ts) {
                this.grid.set(t, x, y, structuredClone(value.cell));
            }
        } else {
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
        }
    }

    rleStatement(): void {
        let gen: number | 'all';
        if (this.match('gen')) {
            this.advance();
            gen = Number(this.eat(T_NATURAL_NUMBER)[0]);
        } else {
            this.eat(['all', `'all'`], ['gens', `'gens'`]);
            gen = 'all';
        }
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
        let header = rle.slice(0, index);
        let p = IdentityPattern.loadRLE(rle.slice(index + 1));
        // expand the grid to fit
        let match = header.match(/^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/);
        if (!match) {
            throw new Error(`This error should not occur, please report it (bad RLE header)`);
        }
        let width = Math.max(Number(match[1]), p.width);
        let height = Math.max(Number(match[2]), p.height);
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
                let data = this.states[state];
                if (gen === 'all') {
                    if (data.all) {
                        this.setCells(Array.from({length: this.grid.gens}, (_, i) => i), x2, y2, data.all, 0);
                    } else {
                        let found = false;
                        if (!data.relative) {
                        }
                        for (let value of data.relative) {
                            if (value[0].includes(0)) {
                                this.setCells(Array.from({length: this.grid.gens}, (_, i) => i), x2, y2, value[1], 0);
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            throw new Error(`Invalid state for 'all gens': ${state} (does not have 'all' or '0' bound)`);
                        }
                    }
                } else {
                    if (data.all) {
                        this.setCells(Array.from({length: this.grid.gens}, (_, i) => i), x2, y2, data.all, 0);
                    }
                    if (data.absolute) {
                        for (let [ts, value] of Object.values(data.absolute)) {
                            this.setCells(ts, x2, y2, value, 0);
                        }
                    }
                    if (data.relative) {
                        for (let [ts, value] of Object.values(data.relative)) {
                            this.setCells(ts.map(x => x + gen), x2, y2, value, gen);
                        }
                    }
                }
            }
        }
        this.eat(T_LINE_END);
    }

    wrapStatement(): void {
        this.eat(['wrap', `'wrap'`]);
        let [dx, dy] = this.eat(T_INTEGER, T_INTEGER);
        this.grid.wrap = [Number(dx), Number(dy)];
        this.eat(T_LINE_END);
    }

    expandStatement(): void {
        this.eat(['expand', `'expand'`]);
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
        } else if (this.match('gen') || this.match('all', 'gens')) {
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
            ['pattern', `'pattern'`],
            T_NATURAL_NUMBER,
            ['gens', `'gens'`],
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
