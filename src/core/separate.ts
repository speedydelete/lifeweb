
/*

implements xp2's algorithm for object seperation for INT rules:
1. give each group of connected cells (cells with overlapping neighborhoods) a number
2. run it for some number of generations, combining objects that birth cells
3. after each generation, resolve knots
4. after a sufficient number of generations, the objects should be seperated

true B0 is not supported, but emulated B0 is

a knot is a dead cell surrounded by 2+ groups of live cells and the cell won't come alive in the next generation

when we hit a knot, we need to figure out if the surronding cells are suppressing its birth

we go through every group and remove it
if a birth is caused we know there is a suppressed birth
we also keep track of the groups that, when removed, don't cause a birth (the "removables")

now, if there is no suppressed birth, we just skip it

so, then it depends on the number of removables:
- if there are 0 removables, all the islands are neccessary, so we merge everything
- if there's 1 removable, we merge the rest of the groups
- if there's multiple, it's ambiguous, current behavior is to merge everything 

*/

import {Pattern, DataPattern} from '../core/index.js';


export class Separator<T extends Pattern = Pattern> extends DataPattern {

    /** Pattern running the internal rule. */
    p: T;
    /** For `resolveKnots`, a copy of the pattern with height and width = range * 2 + 3 (for birth padding). */
    testingP: T;
    /** Contains the group numbers of live cells. */
    groups: Uint32Array;
    /** All groups that have been previously reassigned. */
    reassignedGroups: {[key: number]: number} = {};
    /** The next available group number. */
    nextGroup: number = 1;

    constructor(p: T | Separator<T>) {
        let height = p.height;
        let width = p.width;
        let data = p.getData().slice();
        super(height, width, data, p.rule);
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
        this.generation = p.generation;
        if (p instanceof Separator) {
            this.p = p.p.copy();
            this.testingP = p.testingP.copy();
            this.groups = p.groups.slice();
            this.reassignedGroups = structuredClone(p.reassignedGroups);
            this.nextGroup = p.nextGroup;
            return;
        }
        this.p = p;
        this.testingP = p.clearedCopy();
        // now it's time to assign the initial group numbers
        this.groups = new Uint32Array(this.size);
        let nh = this.rule.neighborhood;
        // this is used inside the loop
        let groupsInNH = new Set<number>();
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.get(x, y) === 0) {
                    continue;
                }
                // first we get a list of groups that are in the cell's neighborhood
                groupsInNH.clear();
                for (let [x2, y2] of nh) {
                    // skip the current cell or any cells that haven't been assigned group numbers yet
                    if (y2 > 0 || (y2 === 0 && x2 >= 0)) {
                        continue;
                    }
                    let group = this.getGroup(x + x2, y + y2);
                    if (group !== 0) {
                        groupsInNH.add(group);
                    }
                }
                let group: number;
                if (groupsInNH.size > 0) {
                    let arrayGroups = Array.from(groupsInNH);
                    group = arrayGroups[0];
                    for (let i = 1; i < arrayGroups.length; i++) {
                        this.reassign(arrayGroups[i], group);
                    }
                } else {
                    group = this.getNewGroup();
                }
                this.setGroup(x, y, group);
            }
        }
    }

    /** Gets the group number at the given coordinates. */
    getGroup(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }
        return this.groups[y * this.width + x];
    }

    /** Sets the group number at the given coordinates. */
    setGroup(x: number, y: number, value: number): this {
        this.groups[y * this.width + x] = value;
        return this;
    }

    /** Get a new group number. */
    getNewGroup(): number {
        return this.nextGroup++;
    }

    /** Reassigns group `a` to group `b`, replacing all members of `a` and adding it to `reassignedGroups`.
     * @returns Whether the assignment succeeded.
     */
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

    expand(up: number, down: number, left: number, right: number): this {
        if (up === 0 && down === 0 && left === 0 && right === 0) {
            return this;
        }
        let width = this.width;
        let height = this.height;
        let oX = left + right;
        let newWidth = width + oX;
        let newHeight = height + up + down;
        let newSize = newWidth * newHeight;
        let out = new Uint8Array(newSize);
        let outGroups = new Uint32Array(newSize);
        let loc = newWidth * up + left;
        let i = 0;
        for (let y = 0; y < height; y++) {
            out.set(this.data.slice(i, i + width), loc);
            outGroups.set(this.groups.slice(i, i + width), loc);
            loc += newWidth;
            i += width;
        }
        this.width = newWidth;
        this.height = newHeight;
        this.size = newSize;
        this.data = out;
        this.groups = outGroups;
        this.xOffset -= left;
        this.yOffset -= up;
        return this;
    }

    /** Runs a single generation of the colorizing separation rule, does not resolve knots.
     * @returns Whether any groups were reassigned.
     */
    runGeneration(): boolean {
        let p = this.p;
        // first, run a single generation of the internal rule
        p.setData(this.height, this.width, this.data);
        p.xOffset = 0;
        p.yOffset = 0;
        p.generation = this.generation;
        p.runGeneration();
        let height = p.height;
        let width = p.width;
        let newData = p.getData();
        // we expand the separator to adjust the groups to remove complicated and annoying offset math
        let expandUp = Math.max(-p.yOffset, 0);
        let expandDown = Math.max(height - this.height - expandUp, 0);
        let expandLeft = Math.max(-p.xOffset, 0);
        let expandRight = Math.max(width - this.width - expandLeft, 0);
        // console.log(`x = ${this.xOffset}, y = ${this.yOffset}`);
        // console.log(expandUp, expandDown, expandLeft, expandRight);
        this.expand(expandUp, expandDown, expandLeft, expandRight);
        // cache reassignments
        // honestly, i don't know why i'm doing this
        // i remember it fixing a bug in the `resolveKnots` function in src/core/intsep.ts
        // but i don't remember why
        let reassignments: [number, number][] = [];
        // now we only have to figure out the groups for cells that were born and do merges as needed!
        let newGroups = new Uint32Array(this.size);
        // this is used inside the loop
        let groupsInNH = new Set<number>();
        let i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // we don't need to do anything if the current value is 0
                if (newData[i] === 0) {
                    i++;
                    continue;
                // if it survived, it keeps the original group
                } else if (this.data[i] !== 0) {
                    newGroups[i] = this.groups[i];
                    i++;
                    continue;
                }
                // iterate through the neighborhood and figure out what groups caused the cell to be born
                groupsInNH.clear();
                for (let [x2, y2] of this.rule.neighborhood) {
                    let group = this.getGroup(x + x2, y + y2);
                    if (group !== 0) {
                        groupsInNH.add(group);
                    }
                }
                // then, merge those groups, and set the new group!
                let arrayGroups = Array.from(groupsInNH);
                let group = arrayGroups[0];
                for (let j = 1; j < arrayGroups.length; j++) {
                    reassignments.push([arrayGroups[j], group]);
                }
                newGroups[i] = group;
                i++;
            }
        }
        this.data = newData;
        this.groups = newGroups;
        // finally, apply the reassignments
        let out = false;
        for (let [a, b] of reassignments) {
            if (this.reassign(a, b)) {
                out = true;
            }
        }
        this.generation++;
        return out;
    }
    
    /** Resolves knots (that is, merges disconnected strict objects).
     * @returns Whether any groups were reassigned.
     */
    resolveKnots(): boolean {
        let p = this.testingP;
        let range = this.rule.range;
        let bbSize = range * 2 + 1;
        // first we get the list of cells that are going to be born in the next generation
        let nextGenP = this.p;
        nextGenP.setData(this.height, this.width, this.data);
        nextGenP.xOffset = 0;
        nextGenP.yOffset = 0;
        nextGenP.generation = this.generation;
        nextGenP.runGeneration();
        // cache reassignments
        // honestly, i don't know why i'm doing this
        // i remember it fixing a bug in the `resolveKnots` function in src/core/intsep.ts
        // but i don't remember why
        let reassignments: [number, number][] = [];
        // we go through each dead cell and run the knot procedure on it
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // we skip the cell if it's alive or going to be alive in the next generation
                if (this.get(x, y) || nextGenP.get(x + nextGenP.xOffset, y + nextGenP.yOffset) > 0) {
                    continue;
                }
                // get all groups in the cell's neighborhood
                let groups: number[] = [];
                let groupCells: {[key: number]: [number, number, number][]} = {};
                for (let [x2, y2] of this.rule.neighborhood) {
                    let group = this.getGroup(x + x2, y + y2);
                    if (group !== 0) {
                        let array = [x2, y2, this.get(x + x2, y + y2)] as [number, number, number];
                        if (groups.includes(group)) {
                            groupCells[group].push(array);
                        } else {
                            groups.push(group);
                            groupCells[group] = [array];
                        }
                    }
                }
                // if there's 0 or 1 groups in the neighborhood, it can't be a knot
                if (groups.length < 2) {
                    continue;
                }
                // we now check if a birth is actually being suppressed
                let isSuppressed = false;
                // and check what groups can be removed without the knot becoming alive
                let removables: number[] = [];
                for (let group of groups) {
                    // when manipulating `p`, we need to add `range` to all coordinates
                    // because they can be negative
                    let data = new Uint8Array(bbSize ** 2);
                    for (let [key, value] of Object.entries(groupCells)) {
                        if (key === String(group)) {
                            continue;
                        }
                        for (let [x, y, state] of value) {
                            if (x < -range || y < -range || x > range || y > range) {
                                continue;
                            }
                            data[(y + range) * bbSize + (x + range)] = state;
                        }
                    }
                    p.setData(bbSize, bbSize, data);
                    // if ((x === 2 && y === 3) || (x === 5 && y === 6)) {
                    //     console.log(group);
                    //     console.log(p.toRLE());
                    // }
                    p.runGeneration();
                    // if ((x === 2 && y === 3) || (x === 5 && y === 6)) {
                    //     console.log(p.toRLE());
                    //     console.log('value:', p.xOffset, p.yOffset, p.get(0 + range + p.xOffset, 0 + range + p.yOffset));
                    // }
                    if (p.get(0 + range - p.xOffset, 0 + range - p.yOffset)) {
                        isSuppressed = true;
                    } else {
                        removables.push(group);
                    }
                }
                if (!isSuppressed) {
                    continue;
                }
                // console.log(x, y, 'resolving', groups, removables);
                if (removables.length === 0) {
                    // if there's no removables, merge everything
                    for (let i = 1; i < groups.length; i++) {
                        // console.log(`merging ${groups[i]} into ${groups[0]}`);
                        reassignments.push([groups[i], groups[0]]);
                    }
                } else if (removables.length === 1) {
                    // if there's 1 removable, merge the rest
                    let mergeTo = groups[0] === removables[0] ? groups[1] : groups[0];
                    for (let group of groups) {
                        if (group === mergeTo) {
                            continue;
                        }
                        // console.log(`merging ${group} into ${mergeTo}`);
                        reassignments.push([group, mergeTo]);
                    }
                } else {
                    // if there's multiple removables, it's ambiguous
                    // so we merge everything
                    for (let i = 1; i < groups.length; i++) {
                        // console.log(`merging ${groups[i]} into ${groups[0]}`);
                        reassignments.push([groups[i], groups[0]]);
                    }
                }
            }
        }
        let out = false;
        for (let [a, b] of reassignments) {
            if (this.reassign(a, b)) {
                out = true;
            }
        }
        return out;
    }

    /** Gets all the groups as individual objects. */
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
            let p = this.p.clearedCopy();
            p.setData(height, width, data);
            p.xOffset = minX + this.xOffset;
            p.yOffset = minY + this.yOffset;
            p.generation = this.generation;
            out.push(p);
        }
        return out;
    }

    copy(): this {
        return new Separator(this) as this;
    }

    clearedCopy(): this {
        let out = this.copy();
        out.height = 0;
        out.width = 0;
        out.data = new Uint8Array(0);
        out.groups = new Uint32Array(0);
        return new Separator(out) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        this.p.setData(this.height, this.width, this.data);
        return new Separator(this.p.copyPart(x, y, height, width)) as this;
    }

    shrinkToFit(): this {
        let height = this.height;
        let width = this.width;
        let size = this.size;
        let data = this.data;
        if (data.every(x => x === 0)) {
            this.height = 0;
            this.width = 0;
            this.size = 0;
            this.data = new Uint8Array(0);
            return this;
        }
        let topShrink = 0;
        let bottomShrink = 0;
        let j = 0;
        for (let i = 0; i < size; i += width) {
            if (topShrink !== j && bottomShrink !== j) {
                break;
            }
            if (topShrink === j && data.slice(i, i + width).every(x => x === 0)) {
                topShrink++;
            }
            if (bottomShrink === j && data.slice(size - i - width, size - i).every(x => x === 0)) {
                bottomShrink++;
            }
            j++;
        }
        let leftShrink = 0;
        let rightShrink = 0;
        for (let i = 0; i < width; i++) {
            if (leftShrink === i) {
                let found = true;
                for (let j = i; j < size; j += width) {
                    if (data[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    leftShrink++;
                }
            }
            if (rightShrink === i) {
                let found = true;
                for (let j = width - i - 1; j < size; j += width) {
                    if (data[j]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    rightShrink++;
                }
            }
            if (leftShrink !== i + 1 && rightShrink !== i + 1) {
                break;
            }
        }
        if (topShrink === 0 && bottomShrink === 0 && leftShrink === 0 && rightShrink === 0) {
            return this;
        }
        let i = topShrink * width + leftShrink;
        let loc = 0;
        height -= topShrink + bottomShrink;
        width -= leftShrink + rightShrink;
        size = height * width;
        let out = new Uint8Array(size);
        let outGroups = new Uint32Array(size);
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                out[loc] = this.data[i];
                outGroups[loc] = this.groups[i];
                i++;
                loc++;
            }
            i += leftShrink + rightShrink;
        }
        this.height = height;
        this.width = width;
        this.size = height * width;
        this.data = out;
        this.groups = outGroups;
        this.xOffset += leftShrink;
        this.yOffset += topShrink;
        return this;
    }

    loadApgcode(code: string): this {
        return new Separator(this.p.loadApgcode(code)) as this;
    }

    loadRLE(rle: string): this {
        return new Separator(this.p.loadRLE(rle)) as this;
    }

}
