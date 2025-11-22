
import {RuleSymmetry, DataPattern} from './pattern.js';


type Leaf = number[];
type Tree1 = Leaf[];
type Tree2 = Tree1[];
type Tree3 = Tree2[];
type Tree4 = Tree3[];
type Tree5 = Tree4[];
type Tree6 = Tree5[];
type Tree7 = Tree6[];
export type R1Tree = Tree7[];

export type Tree = number[] | Tree[];


export class R1TreePattern extends DataPattern {

    tree: R1Tree;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array, tree: R1Tree, states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.tree = tree;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
    }

    runGeneration(): void {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let data = this.data;
        let tree = this.tree;
        let width2 = width << 1;
        let lastRow = size - width;
        let secondLastRow = size - width2;
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let i = 1;
        let j = lastRow + 1;
        let value: number;
        if (width > 1) {
            value = tree[0][0][0][0][0][0][0][data[0]][data[1]];
            if (value) {
                expandUp = 1;
                upExpands[0] = value;
            }
            value = tree[0][data[lastRow]][data[lastRow + 1]][0][0][0][0][0][0];
            if (value) {
                expandDown = 1;
                downExpands[0] = value;
            }
        }
        for (let loc = 1; loc < width - 1; loc++) {
            i++;
            j++;
            value = tree[0][0][0][0][0][0][data[i - 2]][data[i - 1]][data[i]];
            if (value) {
                expandUp = 1;
                upExpands[loc] = value;
            }
            value = tree[data[j - 2]][data[j - 1]][data[j]][0][0][0][0][0][0];
            if (value) {
                expandDown = 1;
                downExpands[loc] = value;
            }
        }
        if (width > 1) {
            value = tree[0][0][0][0][0][0][data[i - 1]][data[i]][0];
            if (value) {
                expandUp = 1;
                upExpands[width - 1] = value;
            }
            value = tree[data[j - 1]][data[j]][0][0][0][0][0][0][0];
            if (value) {
                expandDown = 1;
                downExpands[width - 1] = value;
            }
        }
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        if (height > 1) {
            value = tree[0][0][0][0][0][data[0]][0][0][data[width]];
            if (value) {
                expandLeft = 1;
                leftExpands[0] = value;
            }
            value = tree[0][0][0][data[width - 1]][0][0][data[width2 - 1]][0][0];
            if (value) {
                expandRight = 1;
                rightExpands[0] = value;
            }
        }
        let loc = 0;
        for (i = width2; i < size; i += width) {
            loc++;
            value = tree[0][0][data[i - 2]][0][0][data[i - 1]][0][0][data[i]];
            if (value) {
                expandLeft = 1;
                leftExpands[loc] = value;
            }
            value = tree[data[i + width - 3]][0][0][data[i + width - 2]][0][0][data[i + width - 1]][0][0];
            if (value) {
                expandRight = 1;
                rightExpands[loc] = value;
            }
        }
        if (height > 1) {
            value = tree[0][0][data[i - 1]][0][0][data[i]][0][0][0];
            if (value) {
                expandLeft = 1;
                leftExpands[height - 1] = value;
            }
            value = tree[data[i + width - 2]][0][0][data[i + width - 1]][0][0][0][0][0];
            if (value) {
                expandRight = 1;
                rightExpands[height - 1] = value;
            }
        }
        let b1cnw = tree[0][0][0][0][0][0][0][0][data[0]];
        let b1cne = tree[0][0][0][0][0][0][data[width - 1]][0][0];
        let b1csw = tree[0][0][data[lastRow]][0][0][0][0][0][0];
        let b1cse = tree[data[size - 1]][0][0][0][0][0][0][0][0];
        if (b1cnw || b1cne) {
            expandUp = 1;
        }
        if (b1csw || b1cse) {
            expandDown = 1;
        }
        if (b1cnw || b1csw) {
            expandLeft = 1;
        }
        if (b1cne || b1cse) {
            expandRight = 1;
        }
        let oX = expandLeft + expandRight;
        let oStart = (expandUp ? width + oX : 0) + expandLeft;
        let oSize = oStart + oX * height;
        let newWidth = width + oX;
        let newHeight = height + expandUp + expandDown;
        let newSize = newWidth * newHeight;
        let out = new Uint8Array(newSize);
        out[0] = b1cnw;
        out[newWidth - 1] = b1cne;
        out[newSize - newWidth] = b1csw;
        out[newSize - 1] = b1cse;
        if (expandUp) {
            out.set(upExpands, expandLeft);
        }
        if (expandDown) {
            out.set(downExpands, size + oSize);
        }
        if (expandLeft) {
            let loc = oStart - width - oX - 1;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = leftExpands[i];
            }
        }
        if (expandRight) {
            let loc = oStart - oX;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = rightExpands[i];
            }
        }
        if (width <= 1) {
            if (width === 1) {
                let tr = (data[0] << 4) | (data[1] << 3);
                let loc = oStart;
                value = tree[0][0][0][0][data[0]][0][0][data[1]][0];
                if (value) {
                    out[loc] = value;
                }
                loc += oX + 1;
                for (i = 2; i < height; i++) {
                    value = tree[0][data[i - 2]][0][0][data[i - 1]][0][0][data[i]][0];
                    if (value) {
                        out[loc] = value;
                    }
                    loc += oX + 1;
                }
                value = tree[0][data[i - 1]][0][0][data[i]][0][0][0][0];
                if (value) {
                    out[loc] = value;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
            j = lastRow + 1;
            value = tree[0][0][0][0][data[0]][data[1]][0][data[width]][data[width + 1]];
            if (value) {
                out[loc1] = value;
            }
            value = tree[0][data[secondLastRow]][data[secondLastRow + 1]][0][data[lastRow]][data[lastRow + 1]][0][0][0];
            if (value) {
                out[loc2] = value;
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                value = tree[data[i - 2]][data[i - 1]][data[i]][data[i + width - 2]][data[i + width - 1]][data[i + width]][0][0][0];
                if (value) {
                    out[loc1] = value;
                }
                value = tree[0][0][0][data[j - width - 2]][data[j - width - 1]][data[j - width]][data[j - 2]][data[j - 1]][data[j]];
                if (value) {
                    out[loc2] = value;
                }
            }
            value = tree[data[i - 1]][data[i]][0][data[i + width - 1]][data[i + width]][0][0][0][0];
            if (value) {
                out[loc1 + 1] = value;
            }
            value = tree[0][0][0][data[j - width - 1]][data[j - width]][0][data[j - 1]][data[j]][0];
            if (value) {
                out[loc2 + 1] = value;
            }
            i = width + 1;
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
                value = tree[0][data[i - width - 1]][data[i - width]][0][data[i - 1]][data[i]][0][data[i + width - 1]][data[i + width]];
                if (value) {
                    out[loc] = value;
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    value = tree[data[i - width - 2]][data[i - width - 1]][data[i - width]][data[i - 2]][data[i - 1]][data[i]][data[i + width - 2]][data[i + width - 1]][data[i + width]];
                    if (value) {
                        out[loc] = value;
                    }
                    i++;
                    loc++;
                }
                value = tree[data[i - width - 1]][data[i - width]][0][data[i - 1]][data[i]][0][data[i + width - 1]][data[i + width]][0];
                if (value) {
                    out[loc] = value;
                }
                i++;
                loc++;
            }
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): R1TreePattern {
        let out = new R1TreePattern(this.height, this.width, this.data.slice(), this.tree, this.states, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): R1TreePattern {
        return new R1TreePattern(0, 0, new Uint8Array(0), this.tree, this.states, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): R1TreePattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new R1TreePattern(height, width, data, this.tree, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): R1TreePattern {
        let [height, width, data] = this._loadApgcode(code);
        return new R1TreePattern(height, width, data, this.tree, this.states, this.ruleStr, this.ruleSymmetry);
    }

}


export interface RuleTree {
    states: number;
    neighborhood: string | [number, number][];
    symmetry: RuleSymmetry;
}

export interface AtRule {
    name: string;
    desc: string;
    states: number;
    neighborhood: [number, number][];
    symmetry: RuleSymmetry;
    names?: {[key: number]: string};
    colors?: {[key: number]: string};
    icons?: string;
}

export function parseAtRule(data: string): AtRule {

}
