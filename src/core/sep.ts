
/*

Implements xp2_882030kgz010602's algorithm for object seperation for INT rules:
1. Give each group of kingwise-connected cells a number
2. Run it for some number of generations, combining objects that birth cells
3. After each generation, resolve knots
4. After a sufficient number of generations, the objects should be seperated

A knot is a dead cell surrounded by 2+ groups of live cells that won't come alive in the next generation
Knots cause the merger of objects if a birth would happen if the groups were seperated. If it is ambiguous, the current behavior is to just merge them.

intsep.ts contains a special implementation for non-B01c INT rules, to speed it up.

*/

import {RuleSymmetry, DataPattern} from './pattern.js';


/** Implements object seperation for range-1 rules. */
export class R1Separator<T extends DataPattern = DataPattern> extends DataPattern {

    p: T;
    /** The group number of each live cell. */
    groups: Uint32Array;
    /** The list of reassigned group numbers */
    reassignedGroups: {[key: number]: number} = {};

    constructor(p: T) {
        let height = p.height;
        let width = p.width;
        let data = p.data.slice();
        super(height, width, data, p.rule);
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
        this.generation = p.generation;
        this.p = p;
        // we need to assign the initial group numbers
        // we do this for every contiguous group of cells, as described above
        let groups = new Uint32Array(this.size);
        this.groups = groups;
        let nextGroup = 1;
        // top-left cell
        if (data[0]) {
            groups[0] = nextGroup++;
        }
        let i = 1;
        for (; i < width; i++) {
            // top row
            if (data[i]) {
                if (groups[i - 1]) {
                    groups[i] = groups[i - 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
        }
        for (let y = 1; y < height; y++) {
            // left column
            if (data[i]) {
                if (groups[i - width]) {
                    groups[i] = groups[i - width];
                } else if (groups[i - width + 1]) {
                    groups[i] = groups[i - width + 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
            i++;
            for (let x = 1; x < width - 1; x++) {
                // middle
                if (data[i]) {
                    let g0 = groups[i - width - 1];
                    let g1 = groups[i - width];
                    let g2 = groups[i - width + 1];
                    let g3 = groups[i - 1];
                    if (g0) {
                        groups[i] = g0;
                        if (g2 && g2 !== g0) {
                            this.reassign(g2, g0);
                        }
                    } else if (g1) {
                        groups[i] = g1;
                        if (g3 && g3 !== g1) {
                            this.reassign(g3, g1);
                        }
                    } else if (g2) {
                        groups[i] = g2;
                        if (g3 && g3 !== g2) {
                            this.reassign(g3, g2);
                        }
                    } else if (g3) {
                        groups[i] = g3;
                    } else {
                        groups[i] = nextGroup++;
                    }
                }
                i++;
            }
            // right column
            if (data[i]) {
                if (groups[i - width - 1]) {
                    groups[i] = groups[i - width - 1];
                } else if (groups[i - width]) {
                    groups[i] = groups[i - width];
                } else if (groups[i - 1]) {
                    groups[i] = groups[i - 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
            i++;
        }
    }

    /** Reassigns a group to another one, replacing all members and adding it to `reassignedGroups`. */
    reassign(a: number, b: number): boolean {
        if (a === b) {
            return false;
        }
        while (a in this.reassignedGroups) {
            a = this.reassignedGroups[a];
        }
        while (b in this.reassignedGroups) {
            b = this.reassignedGroups[b];
        }
        if (a === b) {
            return false;
        }
        this.reassignedGroups[a] = b;
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i] === a) {
                this.groups[i] = b;
            }
        }
        return true;
    }

    runGeneration(): boolean {
        // this does not implement knot resolution, just the birth rule
        // very similar to `MAPPattern.runGeneration`, but has additional birth checks
        // there are probably some bugs in this function
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let oldData = this.data;
        let groups = this.groups;
        let p = this.p;
        p.height = height;
        p.width = width;
        p.data = oldData;
        p.expand(1, 1, 1, 1);
        p.runGeneration();
        let data = p.data;
        this.data = data;
        let out = new Uint32Array(p.size);
        let reassignments: [number, number][] = [];
        // corners
        if (data[0]) {
            out[0] = groups[0];
        }
        if (data[width + 1]) {
            out[width + 1] = groups[width - 1];
        }
        if (data[p.size - width - 2]) {
            out[p.size - width - 2] = groups[size - width];
        }
        if (data[p.size - 1]) {
            out[p.size - 1] = groups[size - 1];
        }
        // top and bottom rows
        let x2 = size - width;
        let x3 = p.size - width - 1;
        for (let x = 1; x < width + 1; x++) {
            if (data[x]) {
                if (groups[x - 1]) {
                    out[x] = groups[x - 1];
                } else {
                    out[x] = groups[x - 2] || groups[x];
                    if (groups[x - 2] && groups[x]) {
                        reassignments.push([groups[x], groups[x - 2]]);
                    }
                }
            }
            if (data[x2]) {
                if (groups[x3]) {
                    out[x2] = groups[x3];
                } else {
                    out[x2] = groups[x3 - 1] || groups[x3 + 1];
                    if (groups[x3 - 1] && groups[x3 + 1]) {
                        reassignments.push([groups[x3 + 1], groups[x3 - 1]]);
                    }
                }
            }
            x2++;
            x3++;
        }
        let i = width + 3;
        let j = 0;
        for (let y = 1; y < height + 1; y++) {
            // left column
            if (data[i]) {
                if (groups[j]) {
                    out[i] = groups[j];
                } else {
                    out[i] = groups[j - width] || groups[j + width];
                    if (groups[j - width] && groups[j + width]) {
                        reassignments.push([groups[j + width], groups[j - width]]);
                    }
                }
            }
            i++;
            for (let x = 1; x < width + 1; x++) {
                // middle
                if (data[i]) {
                    if (groups[j]) {
                        data[i] = groups[j];
                    } else {
                        let cells = [groups[j - width - 1], groups[j - width], groups[j - width + 1], groups[j - 1], groups[j + 1], groups[j + width - 1], groups[j + width], groups[j + width + 1]].filter(x => x);
                        data[i] = cells[0];
                        let done: number[] = [];
                        for (let group of cells) {
                            if (group !== cells[0] && !done.includes(group)) {
                                done.push(group);
                                reassignments.push([group, cells[0]]);
                            }
                        }
                    }
                }
                i++;
                j++;
            }
            j--;
            // right column
            if (data[i]) {
                if (groups[j]) {
                    out[i] = groups[j];
                } else {
                    out[i] = groups[j - width] || groups[j + width];
                    if (groups[j - width] && groups[j + width]) {
                        reassignments.push([groups[j + width], groups[j - width]]);
                    }
                }
            }
            i++;
            j++;
        }
        this.height += 2;
        this.width += 2;
        this.size = this.height * this.width;
        this.data = data;
        this.groups = out;
        this.xOffset--;
        this.yOffset--;
        this.generation++;
        let out2 = false;
        for (let [a, b] of reassignments) {
            if (this.reassign(a, b)) {
                out2 = true;
            }
        }
        return out2;
    }

    checkKnot(reassignments: [number, number][], cells: number[], x: number, y: number): void {
        let islands: number[] = [];
        for (let cell of cells) {
            if (cell) {
                if (!islands.includes(cell)) {
                    islands.push(cell);
                }
            }
        }
        if (islands.length < 2) {
            return;
        }
        let p = this.p;
        let height = this.height;
        let width = this.width;
        p.data.fill(0);
        if (y === 0) {
            p.data[3] = this.data[(y) * width + (x - 1)];
            p.data[5] = this.data[(y) * width + (x + 1)];
            p.data[6] = this.data[(y + 1) * width + (x - 1)];
            p.data[7] = this.data[(y + 1) * width + (x)];
            p.data[8] = this.data[(y + 1) * width + (x + 1)];
        } else if (y === height - 1) {
            p.data[0] = this.data[(y - 1) * width + (x - 1)];
            p.data[1] = this.data[(y - 1) * width + (x)];
            p.data[2] = this.data[(y - 1) * width + (x + 1)];
            p.data[3] = this.data[(y) * width + (x - 1)];
            p.data[5] = this.data[(y) * width + (x + 1)];
        } else if (x === 0) {
            p.data[1] = this.data[(y - 1) * width + (x)];
            p.data[2] = this.data[(y - 1) * width + (x + 1)];
            p.data[5] = this.data[(y) * width + (x + 1)];
            p.data[7] = this.data[(y + 1) * width + (x)];
            p.data[8] = this.data[(y + 1) * width + (x + 1)];
        } else if (x === width - 1) {
            p.data[0] = this.data[(y - 1) * width + (x - 1)];
            p.data[1] = this.data[(y - 1) * width + (x)];
            p.data[3] = this.data[(y) * width + (x - 1)];
            p.data[6] = this.data[(y + 1) * width + (x - 1)];
            p.data[7] = this.data[(y + 1) * width + (x)];
        } else {
            p.data[0] = this.data[(y - 1) * width + (x - 1)];
            p.data[1] = this.data[(y - 1) * width + (x)];
            p.data[2] = this.data[(y - 1) * width + (x + 1)];
            p.data[3] = this.data[(y) * width + (x - 1)];
            p.data[5] = this.data[(y) * width + (x + 1)];
            p.data[6] = this.data[(y + 1) * width + (x - 1)];
            p.data[7] = this.data[(y + 1) * width + (x)];
            p.data[8] = this.data[(y + 1) * width + (x + 1)];
        }
        let willNotCauseBirth: number[] = [];
        let canRemove: number[] = [];
        for (let i = 0; i < islands.length; i++) {
            let q = p.copy();
            for (let j = 0; j < 9; j++) {
                if (cells[j] && cells[j] !== islands[i]) {
                    q.data[j] = 0;
                }
            }
            q.runGeneration();
            if (q.data[4 + q.xOffset + (q.width * q.yOffset)]) {
                willNotCauseBirth.push(i);
            }
            q = p.copy();
            for (let j = 0; j < 9; j++) {
                if (cells[j] && cells[j] === islands[i]) {
                    q.data[j] = 0;
                }
            }
            q.runGeneration();
            if (q.data[4 + q.xOffset + (q.width * q.yOffset)]) {
                canRemove.push(i);
            }
        }
        if (willNotCauseBirth.length !== islands.length) {
            if (canRemove.length === 0) {
                // all islands are needed
                for (let x of islands.slice(1)) {
                    reassignments.push([x, islands[0]]);
                }
            } else if (canRemove.length === 1) {
                if (islands.length === 3) {
                    // we remove the island that isn't suppressing the birth
                    if (canRemove[0] === 0) {
                        reassignments.push([islands[2], islands[1]]);
                    } else if (canRemove[0] === 1) {
                        reassignments.push([islands[2], islands[0]]);
                    } else {
                        reassignments.push([islands[1], islands[0]]);
                    }
                } else {
                    // there has to be 4 islands, we can remove one of them, so we merge the rest
                    let assignTo = 0;
                    for (let i = 0; i < islands.length; i++) {
                        let island = islands[i];
                        if (island && i !== canRemove[0]) {
                            if (!assignTo) {
                                assignTo = island;
                            } else {
                                reassignments.push([island, assignTo]);
                            }
                        }
                    }
                }
            } else {
                if (islands.length === 3 || canRemove.length === 3) {
                    // ambiguous separation, we can remove 2 of the islands, but some islands will cause a birth on their own
                    // if there are 3 islands, it's always catching it, if there are 4 islands, canRemove.length === 3 catches it
                    for (let x of islands.slice(1)) {
                        reassignments.push([x, islands[0]]);
                    }
                } else {
                    // there has to be 4 islands and canRemove.length is 4, so B2c is being suppressed
                    // we check for B2n, if there is B2n it's ambiguous
                    let B2n = false;
                    let q = p.copy();
                    q.data[0] = 0;
                    q.data[8] = 0;
                    q.runGeneration();
                    if (q.data[4 + q.xOffset + (q.yOffset * q.width)]) {
                        B2n = true;
                    } else {
                        q = p.copy();
                        q.data[2] = 0;
                        q.data[6] = 0;
                        q.runGeneration();
                        if (q.data[4 + q.xOffset + (q.yOffset * q.width)]) {
                            B2n = true;
                        }
                    }
                    if (B2n) {
                        for (let x of islands.slice(1)) {
                            reassignments.push([x, islands[0]]);
                        }
                    }
                    // if there's no B2n 
                }
            }
        }
    }

    /** Merges disconnected strict objects. */
    resolveKnots(): boolean {
        let height = this.height;
        let width = this.width;
        let data = this.data;
        let groups = this.groups;
        this.p.height = 3;
        this.p.width = 3;
        this.p.data = new Uint8Array(9);
        let reassignments: [number, number][] = [];
        let x2 = this.size - width + 1;
        for (let x = 1; x < width - 1; x++) {
            // top row
            if (!data[x]) {
                this.checkKnot(reassignments, [0, 0, 0, groups[x - 1], groups[x + 1], groups[x + width - 1], groups[x + width], groups[x]], x, 0);
            }
            // bottom row
            if (!data[x2]) {
                this.checkKnot(reassignments, [groups[x - width - 1], groups[x - width], groups[x - width + 1], groups[x - 1], groups[x + 1], 0, 0, 0], x, height - 1);
            }
            x2++;
        }
        let i = width + 1;
        for (let y = 1; y < height - 1; y++) {
            // left column
            if (!data[i]) {
                this.checkKnot(reassignments, [0, groups[i - width], groups[i - width + 1], 0, groups[i + 1], 0, groups[i + width], groups[i + width + 1]], 0, y);
            }
            i++;
            for (let x = 1; x < width - 1; x++) {
                // middle
                if (!data[i]) {
                    this.checkKnot(reassignments, [groups[i - width - 1], groups[i - width], groups[i - width + 1], groups[i - 1], groups[i + 1], groups[i + width - 1], groups[i + width], groups[i + width + 1]], x, y);
                }
                i++;
            }
            // right column
            if (!data[i]) {
                this.checkKnot(reassignments, [groups[i - width - 1], groups[i - width], 0, groups[i - 1], 0, groups[i + width - 1], groups[i + width], 0], width - 1, y);
            }
            i++;
        }
        let out = false;
        for (let [a, b] of reassignments) {
            if (this.reassign(a, b)) {
                out = true;
            }
        }
        return out;
    }

    /** Gets all the groups as individual objects. Does not set the generation property, so if you want that, you should set it yourself. */
    getObjects(): T[] {
        let groups = this.groups;
        let data: {[key: number]: [number, number][]} = {};
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let value = groups[i++];
                if (value) {
                    if (data[value]) {
                        data[value].push([x, y]);
                    } else {
                        data[value] = [[x, y]];
                    }
                }
            }
        }
        let out: T[] = [];
        for (let cells of Object.values(data)) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (let [x, y] of cells) {
                if (x < minX) {
                    minX = x;
                }
                if (x > maxX) {
                    maxX = x;
                }
                if (y < minY) {
                    minY = y;
                }
                if (y > maxY) {
                    maxY = y;
                }
            }
            let height = maxY - minY + 1;
            let width = maxX - minX + 1;
            let data = new Uint8Array(height * width);
            for (let [x, y] of cells) {
                data[(y - minY) * width + x - minX] = 1;
            }
            let p = this.p.clearedCopy() as T;
            p.height = height;
            p.width = width;
            p.data = data;
            p.xOffset = minX + this.xOffset;
            p.yOffset = minY + this.yOffset;
            out.push(p);
        }
        return out;
    }

    copy(): R1Separator {
        this.p.height = this.height;
        this.p.width = this.width;
        this.p.data = this.data;
        return new R1Separator(this.p);
    }

    clearedCopy(): R1Separator {
        this.p.height = 0;
        this.p.width = 0;
        this.p.data = new Uint8Array(0);
        return new R1Separator(this.p);
    }

    copyPart(x: number, y: number, height: number, width: number): R1Separator {
        this.p.height = this.height;
        this.p.width = this.width;
        this.p.data = this.data;
        return new R1Separator(this.p.copyPart(x, y, height, width));
    }

    loadApgcode(code: string): R1Separator<T> {
        return new R1Separator(this.p.loadApgcode(code) as T);
    }

    loadRLE(rle: string): R1Separator<T> {
        return new R1Separator(this.p.loadRLE(rle) as T);
    }

}
