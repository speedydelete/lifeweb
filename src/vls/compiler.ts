
import * as t from '@babel/types';
import {parse} from '@babel/parser';

import {createPattern} from '../core/index.js';


let base = createPattern('B3/S23');

export class Grid {

    height: number;
    width: number;
    gens: number;
    size: number;
    data: number[][][];
    vars: number[][][];
    numVars: number = 0;

    constructor(height: number, width: number, gens: number) {
        this.height = height;
        this.width = width;
        this.gens = gens;
        this.size = height * width;
        this.data = [];
        this.vars = [];
        for (let t = 0; t < gens; t++) {
            let grid: number[][] = [];
            let varsGrid: number[][] = [];
            for (let y = 0; y < height; y++) {
                let row: number[] = [];
                for (let x = 0; x < width; x++) {
                    row.push(0);
                }
                grid.push(row);
                varsGrid.push(row.slice());
            }
            this.data.push(grid);
            this.vars.push(varsGrid);
        }
    }

    get(t: number, x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return 0;
        }
        return this.data[t][y][x];
    }

    set(t: number, x: number, y: number, value: number, variable: number = 0): void {
        this.data[t][y][x] = value;
        this.vars[t][y][x] = variable;
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
                        mapping[value] = this.getVar();
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

    restrict(t: number, rle: string, xOffset: number, yOffset: number) {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (p.get(x, y) === 0) {
                    this.set(t, x, y, 0);
                }
            }
        }
    }

    setFrom(t: number, rle: string, xOffset: number, yOffset: number) {
        let p = base.loadRLE(rle);
        p.offsetBy(xOffset, yOffset);
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.set(t, x, y, p.get(x, y));
            }
        }
    }

}



class State {
    
    parent?: State;
    vars: Map<string, unknown> = new Map();

    constructor(parent?: State) {
        this.parent = parent;
    }

    has(name: string): boolean {
        return this.vars.has(name);
    }

    get(name: string, node: t.Node): unknown {
        if (!this.has(name)) {
            
        }
        return this
    }

    push(): State {
        return new State(this);
    }

    pop(): State {
        if (this.parent) {
            return this.parent;
        } else {
            throw new Error('Cannot pop root state');
        }
    }

}


function runExpression(state: State, node: t.Expression): void {

}

export function runScript(script: string): Grid {
    throw new Error('no');
}
