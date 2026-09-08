
import {createPattern} from '../core/index.js';


export const UNKNOWN = 0;
export const OFF = 1;
export const ON = 2;
export const DONT_CARE = 3;

export const SETTABLE = 0;
export const NO_SEARCHING = 1;
export const NO_SETTING = 2;


let base = createPattern('B3/S23');

export class Grid {

    height: number;
    width: number;
    gens: number;
    size: number;
    data: number[][][];
    vars: number[][][];
    setting: number[][][];
    numVars: number = 0;

    constructor(height: number, width: number, gens: number) {
        this.height = height;
        this.width = width;
        this.gens = gens;
        this.size = height * width;
        this.data = [];
        this.vars = [];
        this.setting = [];
        for (let t = 0; t < gens; t++) {
            let grid: number[][] = [];
            let varsGrid: number[][] = [];
            let settingGrid: number[][] = [];
            for (let y = 0; y < height; y++) {
                let row: number[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(0);
                }
                grid.push(structuredClone(row));
                varsGrid.push(structuredClone(row));
                settingGrid.push(structuredClone(row));
            }
            this.data.push(grid);
            this.vars.push(varsGrid);
            this.setting.push(settingGrid);
        }
    }

    get(t: number, x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.data[t][y][x];
    }

    getVar(t: number, x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.vars[t][y][x];
    }

    set(t: number, x: number, y: number, value: number, variable: number = 0, setting: number = SETTABLE): void {
        this.data[t][y][x] = value;
        this.vars[t][y][x] = variable;
        this.setting[t][y][x] = setting;
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

    getNewVar(): number {
        this.numVars++;
        return this.numVars;
    }

    removeUnusedVars(): void {
        this.numVars = 0;
        let mapping: {[key: number]: number} = {0: 0};
        for (let t = 0; t < this.gens; t++) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    let value = this.vars[t][y][x];
                    if (value === 0) {
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
                    this.vars[t][y][x] = mapping[this.vars[t][y][x]];
                }
            }
        }
    }

    // replaceSingleUseVars(): void {
    //     let uses: {[key: number]: [number, number, number][]} = [];
    //     for (let t = 0; t < this.gens; t++) {
    //         for (let y = 0; y < this.height; y++) {
    //             for (let x = 0; x < this.width; x++) {
    //                 let value = this.vars[t][y][x];
    //                 if (value === 0) {
    //                     continue;
    //                 } else if (value in uses) {
    //                     uses[value].push([t, x, y]);
    //                 } else {
    //                     uses[value] = [[t, x, y]];
    //                 }
    //             }
    //         }
    //     }
    //     for (let variable in uses) {
    //         if (uses[variable].length === 1) {
    //             let [t, x, y] = uses[variable][0];
    //             this.set(t, x, y, UNKNOWN);
    //         }
    //     }
    //     this.removeUnusedVars();
    // }

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

    restrict(t: number, rle: string, xOffset: number, yOffset: number): void {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (p.get(x, y) === 0) {
                    this.set(t, x, y, OFF);
                }
            }
        }
    }

    setFrom(t: number, rle: string, xOffset: number, yOffset: number): void {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, y, p.get(x, y) ? ON : OFF);
            }
        }
    }

    _expand(data: number[][][], top: number, bottom: number, left: number, right: number, before: number, after: number, emptyRow: number[], emptyGrid: number[][]) {
        for (let t = 0; t < this.gens; t++) {
            for (let grid of data) {
                for (let row of grid) {
                    for (let i = 0; i < left; i++) {
                        row.unshift(0);
                    }
                    for (let i = 0; i < right; i++) {
                        row.unshift(0);
                    }
                }
                for (let i = 0; i < top; i++) {
                    grid.unshift(structuredClone(emptyRow));
                }
                for (let i = 0; i < bottom; i++) {
                    grid.push(structuredClone(emptyRow));
                }
            }
        }
        for (let i = 0; i < before; i++) {
            data.unshift(structuredClone(emptyGrid));
        }
        for (let i = 0; i < after; i++) {
            data.push(structuredClone(emptyGrid));
        }
    }

    expand(top: number, bottom: number, left: number, right: number, before: number, after: number): void {
        let newHeight = this.height + top + bottom;
        let newWidth = this.width + left + right;
        let newGens = this.gens + before + after;
        let emptyRow: number[] = [];
        for (let i = 0; i < newWidth; i++) {
            emptyRow.push(0);
        }
        let emptyGrid: number[][] = [];
        for (let i = 0; i < newHeight; i++) {
            emptyGrid.push(structuredClone(emptyRow));
        }
        this._expand(this.data, top, bottom, left, right, before, after, emptyRow, emptyGrid);
        this._expand(this.vars, top, bottom, left, right, before, after, emptyRow, emptyGrid);
        this._expand(this.setting, top, bottom, left, right, before, after, emptyRow, emptyGrid);
        this.height = newHeight;
        this.width = newWidth;
        this.gens = newGens;
    }

}


export function runFile(file: string): Grid {
    throw new Error('not yet');
}
