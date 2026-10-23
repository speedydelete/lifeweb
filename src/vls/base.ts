
import * as t from '@babel/types';


export function error(msg: string): never {
    console.error(`Error: ${msg}\nUse ./vls -h for help`);
    process.exit(1);
}


export const IFV_SAT = 0;
export const IFV_UNSAT = 1;
export const IFV_VARIABLE = 2;
export type ImplicFuncValue = typeof IFV_SAT | typeof IFV_UNSAT | typeof IFV_VARIABLE;

export class ImplicFunc extends Array<ImplicFuncValue> {

    constructor() {
        super(1024);
        for (let i = 0; i < 1024; i++) {
            this[i] = IFV_SAT;
        }
    }

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

    copy(): Cell {
        return new Cell(this.state, this.variable, this.searchable, this.noClause);
    }

}

export function cell(state: State, variable?: Variable, searchable?: boolean, noClause?: boolean): Cell {
    return new Cell(state, variable, searchable, noClause);
}


export class Config {

    reportingInterval: number = 1;

    showSolutions: boolean = true;
    maxSolutions: number | undefined = undefined;
    filterEmptySolutions: boolean = true;
    filterDuplicateSolutions: boolean = true;
    filterSubperiodSolutions: boolean = true;
    cellPeriodFilter: number[] | undefined = undefined;

    maxPartials: 'none' | 'cells' | 'depth' = 'cells';
    maxPartialReportingInterval: number = 1;

    copy(): Config {
        let out = new Config();
        out.reportingInterval = this.reportingInterval;
        out.showSolutions = this.showSolutions;
        out.maxSolutions = this.maxSolutions;
        out.filterEmptySolutions = this.filterEmptySolutions;
        out.filterDuplicateSolutions = this.filterDuplicateSolutions;
        out.filterSubperiodSolutions = this.filterSubperiodSolutions;
        out.cellPeriodFilter = structuredClone(this.cellPeriodFilter);
        out.maxPartials = this.maxPartials;
        return out;
    }

}


export class Grid {

    width: number;
    height: number;
    gens: number;
    size: number;
    data: Cell[][][];
    numVars: number = 0;

    minRule: string = 'B3/S23';
    maxRule: string = 'B3/S23';

    initialValue: typeof OFF | typeof ON = OFF;

    periodic?: {dx: number, dy: number, period: number} | undefined = undefined;
    checkEarlyExhaustion?: boolean;

    ruleFormatString: string = '%s';

    hasCustomBackground: boolean = false;
    topPadding: number = 0;
    bottomPadding: number = 0;
    leftPadding: number = 0;
    rightPadding: number = 0;
    startPadding: number = 0;
    endPadding: number = 0;

    config: Config = new Config();

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
        this.data[t][y][x] = structuredClone(value);
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
                this.set(t, x, y, structuredClone(value));
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
        out.minRule = this.minRule;
        out.maxRule = this.maxRule;
        out.initialValue = this.initialValue;
        out.periodic = structuredClone(this.periodic);
        out.checkEarlyExhaustion = this.checkEarlyExhaustion;
        out.ruleFormatString = this.ruleFormatString;
        out.hasCustomBackground = this.hasCustomBackground;
        out.topPadding = this.topPadding;
        out.bottomPadding = this.bottomPadding;
        out.leftPadding = this.leftPadding;
        out.rightPadding = this.rightPadding;
        out.startPadding = this.startPadding;
        out.endPadding = this.endPadding;
        out.config = this.config.copy();
        return out;
    }

    expand({top = 0, bottom = 0, left = 0, right = 0, start = 0, end = 0}: {top?: number, bottom?: number, left?: number, right?: number, start?: number, end?: number}, value: Cell = cell(UNKNOWN), isPadding: boolean = false): this {
        let newWidth = this.width + left + right;
        let newHeight = this.height + top + bottom;
        let newGens = this.gens + start + end;
        // first make empty placeholders
        let emptyRow: Cell[] = [];
        for (let i = 0; i < newWidth; i++) {
            emptyRow.push(structuredClone(value));
        }
        let emptyLayer: Cell[][] = [];
        for (let i = 0; i < newHeight; i++) {
            emptyLayer.push(structuredClone(emptyRow));
        }
        // then paste them in
        for (let layer of this.data) {
            for (let row of layer) {
                for (let i = 0; i < left; i++) {
                    row.unshift(structuredClone(value));
                }
                for (let i = 0; i < right; i++) {
                    row.push(structuredClone(value));
                }
            }
            for (let i = 0; i < top; i++) {
                layer.unshift(structuredClone(emptyRow));
            }
            for (let i = 0; i < bottom; i++) {
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
        if (isPadding) {
            this.topPadding += top;
            this.bottomPadding += bottom;
            this.leftPadding += left;
            this.rightPadding += right;
            this.startPadding += start;
            this.endPadding += end;
        }
        return this;
    }

    shrink({top = 0, bottom = 0, left = 0, right = 0, start = 0, end = 0}: {top?: number, bottom?: number, left?: number, right?: number, start?: number, end?: number}): this {
        let newWidth = this.width - left - right;
        let newHeight = this.height - top - bottom;
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
            for (let i = 0; i < top; i++) {
                layer.shift();
            }
            for (let i = 0; i < bottom; i++) {
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
            x.noClause = y.noClause;
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
        } else {
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
                    let variable = this.getNewVar();
                    x.variable = variable;
                    y.variable = variable;
                }
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
        this.expand({end: 1}, undefined, true);
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
            grid.bindCells(pos, coord(pos.t, grid.height - pos.y - 1, pos.x));
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
            grid.bindCells(pos, coord(pos.t, grid.width - pos.y - 1, grid.height - pos.x - 1));
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

    'g|'(grid: Grid): void {
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g| symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, grid.width - pos.x - 1, pos.y));
        }
    },

    'g-'(grid: Grid): void {
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g- symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, pos.x, grid.height - pos.y - 1));
        }
    },

    'g\\'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply g\\ symmetry to non-square grid`);
        }
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g\\ symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, pos.y, pos.x));
        }
    },

    'g/'(grid: Grid): void {4
        if (grid.width !== grid.height) {
            error(`Cannot apply g/ symmetry to non-square grid`);
        }
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g/ symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, grid.width - pos.y - 1, grid.height - pos.x - 1));
        }
    },

    'g90l'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply g90l symmetry to non-square grid`);
        }
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply 90l symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, grid.height - pos.y - 1, pos.x));
        }
    },

    'g90': 'g90l',

    'g90r'(grid: Grid): void {
        if (grid.width !== grid.height) {
            error(`Cannot apply g90r symmetry to non-square grid`);
        }
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g90r symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, pos.y, grid.width - pos.x - 1));
        }
    },

    'g180'(grid: Grid): void {
        if (grid.gens % 2 !== 1) {
            error(`Cannot apply g180 symmetry to grid with odd period`);
        }
        for (let pos of grid.coords()) {
            if (pos.t === grid.gens - 1) {
                continue;
            }
            let newT = Math.round((pos.t + (grid.gens - 1) / 2) % (grid.gens - 1));
            grid.bindCells(pos, coord(newT, grid.width - pos.x - 1, grid.height - pos.y - 1));
        }
    },

    'agar'(grid: Grid): void {
        grid.hasCustomBackground = true;
        grid.ruleFormatString += `:T${grid.width},${grid.height}`;
        grid.expand({top: 1, bottom: 1, left: 1, right: 1}, cell(UNKNOWN, undefined, undefined, true), true);
        for (let pos of grid.coords()) {
            if (pos.x === 0 || pos.x === grid.width - 1 || pos.y === 0 || pos.y === grid.height - 1) {
                let bindX: number;
                if (pos.x === 0) {
                    bindX = grid.width - 2;
                } else if (pos.x === grid.width - 1) {
                    bindX = 1;
                } else {
                    bindX = pos.x;
                }
                let bindY: number;
                if (pos.y === 0) {
                    bindY = grid.height - 2;
                } else if (pos.y === grid.height - 1) {
                    bindY = 1;
                } else {
                    bindY = pos.y;
                }
                grid.bindCells(pos, coord(pos.t, bindX, bindY));
            }
        }
    }

};


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
