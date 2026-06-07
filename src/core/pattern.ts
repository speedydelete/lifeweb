
/* Contains abstract base classes for patterns. */

import type {InspectOptions} from 'node:util';


/** A symmetry for a rule. */
export type RuleSymmetry = 'C1' | 'C2' | 'C4' | 'D2-' | 'D2|' | 'D2/' | 'D2\\' | 'D4+' | 'D4x' | 'D8';

const RLE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RLE_PREFIXES = 'pqrstuvwxyz';
/** The characters used by extended RLE's. */
export const RLE_CHARS = ['.'];
RLE_CHARS.push(...RLE_LETTERS);
for (let prefix of RLE_PREFIXES) {
    for (let letter of RLE_LETTERS) {
        RLE_CHARS.push(prefix + letter);
        if (RLE_CHARS.length === 256) {
            break;
        }
    }
}

/** The characters usable by apgcodes. */
export const APGCODE_CHARS ='0123456789abcdefghijklmnopqrstuvwxyz';


/** The join operation for rule symmetries. */
export const SYMMETRY_JOIN: {[K in RuleSymmetry]: {[L in RuleSymmetry]: RuleSymmetry}} = {
    'C1': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2-': 'D2-',
        'D2|': 'D2|',
        'D2/': 'D2/',
        'D2\\': 'D2\\',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'C2': {
        'C1': 'C2',
        'C2': 'C2',
        'C4': 'C4',
        'D2-': 'D4+',
        'D2|': 'D4+',
        'D2/': 'D4x',
        'D2\\': 'D4x',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'C4': {
        'C1': 'C4',
        'C2': 'C4',
        'C4': 'C4',
        'D2-': 'D8',
        'D2|': 'D8',
        'D2/': 'D8',
        'D2\\' :'D8',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2-': {
        'C1': 'D2-',
        'C2': 'D4+',
        'C4': 'D8',
        'D2-': 'D2-',
        'D2|': 'D4+',
        'D2/': 'D8',
        'D2\\': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2|': {
        'C1': 'D2|',
        'C2': 'D4+',
        'C4': 'D8',
        'D2-': 'D4+',
        'D2|': 'D2|',
        'D2/': 'D8',
        'D2\\': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2/': {
        'C1': 'D2/',
        'C2': 'D4x',
        'C4': 'D8',
        'D2-': 'D8',
        'D2|': 'D8',
        'D2/': 'D2/',
        'D2\\': 'D4x',
        'D4+': 'D8',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'D2\\': {
        'C1': 'D2\\',
        'C2': 'D4x',
        'C4': 'D8',
        'D2-': 'D8',
        'D2|': 'D8',
        'D2/': 'D4x',
        'D2\\': 'D2\\',
        'D4+': 'D8',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'D4+': {
        'C1': 'D4+',
        'C2': 'D4+',
        'C4': 'D8',
        'D2-': 'D4+',
        'D2|': 'D4+',
        'D2/': 'D8',
        'D2\\': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D4x': {
        'C1': 'D4x',
        'C2': 'D4x',
        'C4': 'D8',
        'D2-': 'D8',
        'D2|': 'D8',
        'D2/': 'D4x',
        'D2\\': 'D4x',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D8': {
        'C1': 'D8',
        'C2': 'D8',
        'C4': 'D8',
        'D2-': 'D8',
        'D2|': 'D8',
        'D2/': 'D8',
        'D2\\': 'D8',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
};

/** The meet operation for rule symmetries. */
export const SYMMETRY_MEET: {[K in RuleSymmetry]: {[L in RuleSymmetry]: RuleSymmetry}} = {
    'C1': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C4',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'C1',
        'D4x': 'C1',
        'D8': 'C1',
    },
    'C2': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C2',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'C2',
        'D4x': 'C2',
        'D8': 'C2',
    },
    'C4': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'C1',
        'D4x': 'C1',
        'D8': 'C4',
    },
    'D2-': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2-': 'D2-',
        'D2|': 'C1',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'D2-',
        'D4x': 'C1',
        'D8': 'D2-',
    },
    'D2|': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2-': 'C1',
        'D2|': 'D2|',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'D2|',
        'D4x': 'C1',
        'D8': 'D2|',
    },
    'D2/': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'D2/',
        'D2\\': 'C1',
        'D4+': 'C1',
        'D4x': 'D2/',
        'D8': 'D2/',
    },
    'D2\\': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'C1',
        'D2\\': 'D2\\',
        'D4+': 'C1',
        'D4x': 'D2\\',
        'D8': 'D2\\',
    },
    'D4+': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C2',
        'D2-': 'D2-',
        'D2|': 'D2|',
        'D2/': 'C1',
        'D2\\': 'C1',
        'D4+': 'D4+',
        'D4x': 'C2',
        'D8': 'D4+',
    },
    'D4x': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C2',
        'D2-': 'C1',
        'D2|': 'C1',
        'D2/': 'D2/',
        'D2\\': 'D2\\',
        'D4+': 'C2',
        'D4x': 'D4x',
        'D8': 'D4x',
    },
    'D8': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2-': 'D2-',
        'D2|': 'D2|',
        'D2/': 'D2/',
        'D2\\': 'D2\\',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
};

/** Takes in the 6 base rule symmetries and outputs the combination.
 * @param C2 C2 symmetry
 * @param C4 C4 symmetry
 * @param D2h D2- symmetry
 * @param D2v D2| symmetry
 * @param D2s D2/ symmetry
 * @param D2b D2\ symmetry
 */
export function getRuleSymmetryFromBases(C2: boolean, C4: boolean, D2h: boolean, D2v: boolean, D2s: boolean, D2b: boolean): RuleSymmetry {
    if (C4) {
        if (D2h || D2v || D2s || D2h) {
            return 'D8';
        } else {
            return 'C4';
        }
    } else if (C2) {
        if (D2h || D2v) {
            if (D2s || D2b) {
                return 'D8';
            } else {
                return 'D4+';
            }
        } else if (D2s || D2b) {
            return 'D4x';
        } else {
            return 'C2';
        }
    } else if (D2h || D2v || D2s || D2b) {
        if (D2s || D2b) {
            if (D2h || D2v) {
                return 'D8';
            } else if (D2s && D2b) {
                return 'D4x';
            } else if (D2s) {
                return 'D2/';
            } else {
                return 'D2\\';
            }
        } else if (D2h && D2v) {
            return 'D4+';
        } else if (D2h) {
            return 'D2-';
        } else {
            return 'D2|';
        }
    } else {
        return 'C1';
    }
}


// insertion modes
export const INSERT_CLEAR = 0b0000;
export const INSERT_COPY = 0b0101;
export const INSERT_AND = 0b0001;
export const INSERT_OR = 0b0111;
export const INSERT_XOR = 0b0110;
export const INSERT_NAND = 0b1110;
export const INSERT_XNOR = 0b1001;
export const INSERT_CHANGE_LIVE = 0b0011;
export const INSERT_COPY_TO_DEAD = 0b1100;


/** Returned by Pattern.getRect(). */
export interface Rect {
    height: number;
    width: number;
    xOffset: number;
    yOffset: number;
}

/** Represents the properties of a rule. */
export interface Rule {
    /** The normalized rulestring. */
    str: string;
    /** The number of states the rule has. */
    states: number;
    /** The neighborhood as a list of [x, y] coordinates. */
    neighborhood: [number, number][];
    /** The symmetry that the rule follows. */
    symmetry: RuleSymmetry;
    /** The period of the rule. This is 1 for most rules, 2 for B0 rules, and the number of alternations for alternating-time rules. */
    period: number;
    /** The maximum number of cells away (in any direction, even diagonally) that can be affected by a cell change in a single generation. */
    range: number;
}

/** Represents a pattern in a cellular automata. */
export abstract class Pattern {
    
    toString(): string {
        let [x, y] = this.getFullOffset();
        return `${this.constructor.name} at (${x} ${y}), generation = ${this.generation}:\n${this.toRLE()}`;
    }

    /** The height of the pattern. */
    abstract height: number;
    /** The width of the pattern. */
    abstract width: number;
    /** Keeps track of how far it is offset in the X direction. */
    abstract xOffset: number;
    /** Keeps track of how far it is offset in the Y direction. */
    abstract yOffset: number;
    /** The generation it is on, this value is used by AlternatingPattern and B0 rules. */
    abstract generation: number;
    /** An object representing the rule. */
    abstract rule: Rule;

    /** Runs a single generation. */
    abstract runGeneration(): unknown;
    
    /** Runs the pattern for that many generations, or 1 if unspecified. */
    run(gens: number = 1): this {
        for (let i = 0; i < gens; i++) {
            this.runGeneration();
        }
        return this;
    }
    
    /** The number of non-state-0 cells. This may be implemented as a getter, so don't change it unless you're sure. */
    abstract population: number;
    /** Gets the bounding box of the pattern, like g.getrect(). */
    abstract getRect(): Rect;
    /** Gets the "actual" x and y offsets (only different from `[xOffset, yOffset]` if the implementation supports negative coordinates). */
    abstract getFullOffset(): [number, number];
    /** Checks if the pattern consists of dead cells. */
    abstract isEmpty(): boolean;

    /** Copies the pattern, including the rule and the data. */
    abstract copy(): Pattern;
    /** Copies the pattern, including the rule, but not including the data. */
    abstract clearedCopy(): Pattern;

    /** Ensures the pattern can hold at least a x by y value. */
    abstract ensure(x: number, y: number): this;
    /** Offsets the pattern data by x and y. */
    abstract offsetBy(x: number, y: number): this;

    /** Gets the value at the provided coordinates. */
    abstract get(x: number, y: number): number;
    /** Sets the value at the provided coordinates. */
    abstract set(x: number, y: number, value: number): this;
    /** Clears the data of the pattern. */
    abstract clear(): this;
    /** Clears part of the pattern. */
    abstract clearPart(x: number, y: number, height: number, width: number): this;

    /** Inserts a different pattern, the mode is a 4-bit number representing the logical operation (bit 0 = old state, bit 1 = new state, 00 -> 8, 01 -> 4, 10 -> 2, 11 -> 1), default value 7 (which means OR insertion). */
    abstract insert(p: Pattern, x: number, y: number, mode?: number): this;
    /** Extracts part of the pattern into a new one. */
    abstract copyPart(x: number, y: number, height: number, width: number): Pattern;
    /** Gets the pattern data as an array. */
    abstract getData(): Uint8Array;
    /** Sets the pattern data using a height, width, and array. */
    abstract setData(height: number, width: number, data: Uint8Array): this;
    /** Gets the pattern data as a Map. */

    /** Checks if 2 patterns are exactly equal. */
    abstract isEqual(other: Pattern): boolean;
    /** Checks if 2 patterns are equal, but with optional translation. (You should generally call `shrinkToFit` before calling this.) Also returns how much it is translated. */
    abstract isEqualWithTranslate(other: Pattern): false | [number, number];
    /** Hashes the pattern into a 32-bit number. */
    abstract hash32(): number;
    /** Hashes the pattern into a 64-bit number. */
    abstract hash64(): bigint;

    /** Shrinks the pattern so there are cells touching every edge`. */
    abstract shrinkToFit(): this;
    /** Expands the pattern by the given amounts. */
    abstract expand(up: number, down: number, left: number, right: number): this;

    /** Flips the pattern along the line y = 0. */
    abstract flipHorizontal(): this;
    /** Flips the pattern along the line x = 0. */
    abstract flipVertical(): this;
    /** Swaps the x and y coordinates of every live cell. */
    abstract transpose(): this;
    /** Rotates the entire pattern right by 90 degrees. */
    abstract rotateRight(): this;
    /** Rotates the entire pattern left by 90 degrees. */
    abstract rotateLeft(): this;
    /** Flips the pattern by 180 degrees. */
    abstract rotate180(): this;
    /** Flips the pattern along the line y = -x, alias for `transpose`. */
    abstract flipDiagonal(): this;
    /** Flips the pattern along the line y = x. */
    abstract flipAntiDiagonal(): this;
    /** Inflates a pattern by the specified amount. */
    abstract inflate(times: number): this;

    _toApgcode(data: Uint8Array): string {
        let height = this.height;
        let width = this.width;
        let out = '';
        for (let stripNum = 0; stripNum < Math.ceil(height / 5); stripNum++) {
            let zeros = 0;
            let start = stripNum * width * 5;
            for (let x = 0; x < width; x++) {
                let char = APGCODE_CHARS[data[start + x] | (data[start + width + x] << 1) | (data[start + 2 * width + x] << 2) | (data[start + 3 * width + x] << 3) | (data[start + 4 * width + x] << 4)];
                if (char === '0') {
                    zeros++;
                } else {
                    if (zeros > 0) {
                        if (zeros === 1) {
                            out += '0'; 
                        } else if (zeros === 2) {
                            out += 'w';
                        } else if (zeros === 3) {
                            out += 'x';
                        } else {
                            while (zeros > 39) {
                                zeros -= 39;
                                out += 'yz';
                            }
                            if (zeros > 0) {
                                if (zeros === 1) {
                                    out += '0';
                                } else if (zeros === 2) {
                                    out += 'w';
                                } else if (zeros === 3) {
                                    out += 'x';
                                } else {
                                    out += 'y' + APGCODE_CHARS[zeros - 4];
                                }
                            }
                        }
                        zeros = 0;
                    }
                    out += char;
                }
            }
            out += 'z';
        }
        return out.slice(0, -1);
    }

    // this is abstract because there can be more optimal implementations based on caching height/width/data
    /** Gets the apgcode of the pattern. */
    abstract toApgcode(prefix?: string): string;

    toCanonicalApgcode(period: number = 1, prefix?: string): string {
        // this can probably be optimized
        let p = this.copy();
        p.shrinkToFit();
        let codes: string[] = [];
        for (let j = 0; j < period; j++) {
            if (j > 0) {
                p.runGeneration();
                p.shrinkToFit();
            }
            codes.push(p.toApgcode());
            if (this.rule.symmetry !== 'C1') {
                let q = p.copy();
                if (this.rule.symmetry === 'D8') {
                    codes.push(q.rotateLeft().toApgcode());
                    for (let i = 0; i < 2; i++) {
                        for (let j = 0; j < 4; j++) {
                            codes.push(q.rotateLeft().toApgcode());
                        }
                        q.flipHorizontal();
                    }
                } else if (this.rule.symmetry === 'C2') {
                    codes.push(q.rotate180().toApgcode());
                } else if (this.rule.symmetry === 'C4') {
                    for (let i = 0; i < 4; i++) {
                        codes.push(q.rotateLeft().toApgcode());
                    }
                } else if (this.rule.symmetry === 'D2-') {
                    codes.push(q.flipHorizontal().toApgcode());
                } else if (this.rule.symmetry === 'D2|') {
                    codes.push(q.flipVertical().toApgcode());
                } else if (this.rule.symmetry === 'D2/') {
                    codes.push(q.flipDiagonal().toApgcode());
                } else if (this.rule.symmetry === 'D2\\') {
                    codes.push(q.transpose().toApgcode());
                } else if (this.rule.symmetry === 'D4+') {
                    codes.push(q.flipHorizontal().toApgcode());
                    codes.push(q.flipVertical().toApgcode());
                    codes.push(q.flipHorizontal().toApgcode());
                } else {
                    codes.push(q.flipDiagonal().toApgcode());
                    codes.push(q.transpose().toApgcode());
                    codes.push(q.flipDiagonal().toApgcode());
                }
            }
        }
        let out = codes[0];
        for (let code of codes.slice(1)) {
            if (code.length < out.length || (code.length === out.length && code < out)) {
                out = code;
            }
        }
        if (prefix === undefined) {
            prefix = '';
        } else {
            prefix += '_';
        }
        return prefix + out;
    }

    toRLE(header: boolean = true): string {
        // we do this where we compute the run counts while processing, instead of at the end
        let height = this.height;
        let width = this.width;
        let out = header ? `x = ${width}, y = ${height}, rule = ${this.rule.str}\n` : '';
        let data = this.getData();
        let i = 0;
        let line = '';
        let dollarCount = 0;
        let isStart = true;
        for (let y = 0; y < height; y++) {
            // shortcut for empty row
            if (data.slice(i, i + width).every(x => x === 0)) {
                dollarCount++;
                i += width;
                continue;
            }
            // add dollar signs if neccessary
            if (!isStart) {
                let prevLineLength = line.length;
                if (dollarCount > 0) {
                    line += dollarCount + 1;
                    dollarCount = 0;
                }
                line += '$';
                // cut the line if it's too big
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            } else if (dollarCount > 0) {
                let prevLineLength = line.length;
                line += dollarCount + '$';
                dollarCount = 0;
                // cut the line if it's too big
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
            isStart = false;
            // running count of the number of that character
            let prevChar = '';
            let count = 1;
            for (let x = 0; x < width; x++) {
                let char: string;
                if (this.rule.states > 2) {
                    char = RLE_CHARS[data[i]];
                } else if (data[i]) {
                    char = 'o';
                } else {
                    char = 'b';
                }
                if (char === prevChar) {
                    count++;
                } else {
                    let prevLineLength = line.length;
                    if (count > 1) {
                        line += count;
                    }
                    line += prevChar;
                    // cut the line if it's too big
                    if (line.length > 69) {
                        out += line.slice(0, prevLineLength) + '\n';
                        line = line.slice(prevLineLength);
                    }
                    prevChar = char;
                    count = 1;
                }
                i++;
            }
            // add the last character, but only if it's not 0
            if (prevChar !== 'b' && prevChar !== '.') {
                let prevLineLength = line.length;
                if (count > 1) {
                    line += count;
                }
                line += prevChar;
                // cut the line if it's too big
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
        }
        out += line + '!';
        return out;
    }

    _loadApgcode(code: string): [number, number, Uint8Array] {
        // shortcut for 2-state rules
        if (this.rule.states === 2) {
            // split it, we can't just use .split('z') because yz is a thing
            let strips: string[] = [];
            let prev = '';
            let current = '';
            for (let char of code) {
                if (char === 'z' && prev !== 'y') {
                    strips.push(current);
                    current = '';
                    prev = char;
                    continue;
                }
                current += char;
                prev = char;
            }
            strips.push(current);
            let data: number[][] = [];
            let width = 0;
            for (let strip of strips) {
                let stripData: number[] = [];
                for (let i = 0; i < strip.length; i++) {
                    let char = strip[i];
                    let index = APGCODE_CHARS.indexOf(char);
                    if (index >= 32) {
                        if (char === 'w') {
                            stripData.push(0, 0);
                        } else if (char === 'x') {
                            stripData.push(0, 0, 0);
                        } else {
                            let count = APGCODE_CHARS.indexOf(strip[i + 1]) + 4;
                            for (let i = 0; i < count; i++) {
                                stripData.push(0);
                            }
                            i++;
                        }
                    } else {
                        stripData.push(index);
                    }
                }
                if (stripData.length > width) {
                    width = stripData.length;
                }
                data.push(stripData);
            }
            // put the data into an array
            let height = data.length * 5;
            let out = new Uint8Array(height * width);
            for (let y = 0; y < data.length; y++) {
                let loc = width * y * 5;
                for (let value of data[y]) {
                    out[loc] = value & 1;
                    out[loc + width] = (value >> 1) & 1;
                    out[loc + 2 * width] = (value >> 2) & 1;
                    out[loc + 3 * width] = (value >> 3) & 1;
                    out[loc + 4 * width] = (value >> 4) & 1;
                    loc++;
                }
            }
            return [height, width, out];
        }
        // since it's multistate we split it into layers, treating each layer like a single-state apgcode, then unpack them
        let data: number[][][] = [];
        let width = 0;
        let height = 0;
        for (let layer of code.split('_')) {
            let layerData: number[][] = [];
            for (let strip of layer.split('z')) {
                let stripData: number[] = [];
                for (let i = 0; i < strip.length; i++) {
                    let char = strip[i];
                    let index = APGCODE_CHARS.indexOf(char);
                    if (index >= 32) {
                        if (char === 'w') {
                            stripData.push(0, 0);
                        } else if (char === 'x') {
                            stripData.push(0, 0, 0);
                        } else {
                            let count = APGCODE_CHARS.indexOf(strip[i + 1]) + 4;
                            for (let i = 0; i < count; i++) {
                                stripData.push(0);
                            }
                            i++;
                        }
                    } else {
                        stripData.push(index);
                    }
                }
                if (stripData.length > width) {
                    width = stripData.length;
                }
                layerData.push(stripData);
            }
            let planeHeight = layerData.length * 5;
            if (planeHeight > height) {
                height = planeHeight;
            }
            data.push(layerData);
        }
        // put the data into an array
        let out = new Uint8Array(height * width);
        for (let y = 0; y < data[0].length; y++) {
            let loc = width * y * 5;
            for (let part of data[0][y]) {
                out[loc] = part & 1;
                out[loc + width] = (part >> 1) & 1;
                out[loc + 2 * width] = (part >> 2) & 1;
                out[loc + 3 * width] = (part >> 3) & 1;
                out[loc + 4 * width] = (part >> 4) & 1;
                loc++;
            }
        }
        if (data.length === 2) {
            for (let y = 0; y < data[1].length; y++) {
                let loc = width * y * 5;
                for (let part of data[1][y]) {
                    if (part & 1) {
                        out[loc] = 2;
                    }
                    if ((part >> 1) & 1) {
                        out[loc + width] = 2;
                    }
                    if ((part >> 2) & 1) {
                        out[loc + 2 * width] = 2;
                    }
                    if ((part >> 3) & 1) {
                        out[loc + 3 * width] = 2;
                    }
                    if ((part >> 4) & 1) {
                        out[loc + 4 * width] = 2;
                    }
                    loc++;
                }
            }
        } else if (data.length > 2) {
            // cursed magic, maybe broken idk
            for (let i = 2; i < data.length; i++) {
                for (let y = 0; y < data[i].length; y++) {
                    let loc = width * y * 5;
                    for (let part of data[i][y]) {
                        out[loc] |= (part & 1) << (i - 2);
                        out[loc + width] |= ((part >> 1) & 1) << (i - 2);
                        out[loc + 2 * width] |= ((part >> 2) & 1) << (i - 2);
                        out[loc + 3 * width] |= ((part >> 3) & 1) << (i - 2);
                        out[loc + 4 * width] |= ((part >> 4) & 1) << (i - 2);
                        loc++;
                    }
                }
            }
            let states = Math.max(...out);
            for (let y = 0; y < data[1].length; y++) {
                let loc = width * y * 5;
                for (let part of data[1][y]) {
                    if (part & 1) {
                        out[loc] = states - out[loc] + 2;
                    }
                    if ((part >> 1) & 1) {
                        out[loc + width] = states - out[loc + width] + 2;
                    }
                    if ((part >> 2) & 1) {
                        out[loc + 2 * width] = states - out[loc + 2 * width] + 2;
                    }
                    if ((part >> 3) & 1) {
                        out[loc + 3 * width] = states - out[loc + 3 * width] + 2;
                    }
                    if ((part >> 4) & 1) {
                        out[loc + 4 * width] = states - out[loc + 4 * width] + 2;
                    }
                    loc++;
                }
            }
        }
        return [height, width, out];
    }

    _loadRLE(rle: string): [number, number, Uint8Array] {
        let out: number[][] = [];
        let currentLine: number[] = [];
        let num = '';
        let prefix = '';
        for (let i = 0; i < rle.length; i++) {
            let char = rle[i];
            if (char === 'b' || char === 'o') {
                let value = char === 'o' ? 1 : 0;
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = Number(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('0123456789'.includes(char)) {
                num += char;
            // it's \u0024 because of a bug in @babel/standalone that makes the literal string '$' parse invalid
            } else if (char === '\u0024') {
                out.push(currentLine);
                currentLine = [];
                if (num !== '') {
                    let count = Number(num);
                    for (let i = 1; i < count; i++) {
                        out.push([]);
                    }
                    num = '';
                }
            } else if (char === '.') {
                if (num === '') {
                    currentLine.push(0);
                } else {
                    let count = Number(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(0);
                    }
                    num = '';
                }
            } else if ('ABCDEFGHIJKLMNOPQRSTUVWX'.includes(char)) {
                if (prefix) {
                    char = prefix + char;
                }
                let value = RLE_CHARS.indexOf(char);
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = Number(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('pqrstuvwxy'.includes(char)) {
                prefix = char;
            }
        }
        out.push(currentLine);
        let height = out.length;
        let width = Math.max(...out.map(x => x.length));
        let data = new Uint8Array(height * width);
        for (let y = 0; y < out.length; y++) {
            let i = y * width;
            let line = out[y];
            for (let x = 0; x < line.length; x++) {
                data[i] = line[x];
                i++;
            }
        }
        return [height, width, data];
    }

    /** Loads an apgcode and returns a new pattern running the same rule. */
    abstract loadApgcode(code: string): Pattern;
    /** Loads a RLE and returns a new pattern running the same rule. */
    abstract loadRLE(data: string): Pattern;

    // this makes it pretty-print in node console.log
    [Symbol.for('nodejs.util.inspect.custom')](depth: number, options: InspectOptions, inspect: (typeof import('node:util'))['inspect']): string {
        let [x, y] = this.getFullOffset();
        return `${this.constructor.name} ${inspect({
            height: this.height,
            width: this.width,
            xOffset: x,
            yOffset: y,
            generation: this.generation,
            rule: this.rule,
        }, options)} ${this.toRLE()}`;
    }

}


/** Implements Pattern while storing the internal data as a Uint8Array. Should only be used for range-1 rules. */
export abstract class DataPattern extends Pattern {

    /** Stores the pattern data in row-major order. */
    data: Uint8Array;
    height: number;
    width: number;
    size: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    rule: Rule;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule) {
        super();
        this.height = height;
        this.width = width;
        this.size = height * width;
        this.data = data;
        this.rule = rule;
    }

    abstract runGeneration(): any;

    get population(): number {
        // this used to be waaay slower because .reduce() was used instead
        let out = 0;
        for (let i = 0; i < this.size; i++) {
            if (this.data[i]) {
                out++;
            }
        }
        return out;
    }

    getRect(): Rect {
        return {height: this.height, width: this.width, xOffset: this.xOffset, yOffset: this.yOffset};
    }

    getFullOffset(): [number, number] {
        return [this.xOffset, this.yOffset];
    }

    isEmpty(): boolean {
        for (let i = 0; i < this.data.length; i++) {
            if (this.data[i]) {
                return false;
            }
        }
        return true;
    }

    abstract copy(): DataPattern;
    abstract clearedCopy(): DataPattern;

    ensure(x: number, y: number): this {
        if (x < 0 || y < 0 || x > this.width || y > this.height) {
            let height = this.height;
            let width = this.width;
            let expandUp = Math.max(-y, 0);
            let expandDown = Math.max(y - this.height, 0);
            let expandLeft = Math.max(-x, 0);
            let expandRight = Math.max(x - this.width, 0);
            let oX = expandLeft + expandRight;
            let newWidth = width + oX;
            let newHeight = height + expandUp + expandDown;
            let newSize = newWidth * newHeight;
            let out = new Uint8Array(newSize);
            let loc = newWidth * expandUp + expandLeft;
            let i = 0;
            for (let y = 0; y < height; y++) {
                out.set(this.data.slice(i, i + width), loc);
                loc += newWidth;
                i += width;
            }
            this.width = newWidth;
            this.height = newHeight;
            this.size = newSize;
            this.xOffset -= expandLeft;
            this.yOffset -= expandUp;
            this.data = out;
        }
        return this;
    }

    offsetBy(x: number, y: number): this {
        let newHeight = this.height + y;
        let newWidth = this.width + x;
        let newSize = newHeight * newWidth;
        let out = new Uint8Array(newSize);
        let i = 0;
        let loc = y * newWidth + x;
        for (let row = 0; row < this.height; row++) {
            out.set(this.data.slice(i, i + this.width), loc);
            loc += newWidth;
            i += this.width;
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= x;
        this.yOffset -= y;
        return this;
    }

    get(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }
        return this.data[y * this.width + x];
    }

    set(x: number, y: number, value: number): this {
        this.data[y * this.width + x] = value;
        return this;
    }

    clear(): this {
        this.height = 0;
        this.width = 0;
        this.size = 0;
        this.data = new Uint8Array(0);
        return this;
    }

    clearPart(x: number, y: number, height: number, width: number): this {
        let i = y * this.width + x;
        for (let row = 0; row < height; row++) {
            this.data.fill(0, i, i + width);
            i += this.width;
        }
        return this;
    }

    insert(p: Pattern, x: number, y: number, mode: number = INSERT_OR): this {
        for (let y2 = 0; y2 < p.height; y2++) {
            let i = (y + y2) * this.width + x;
            for (let x2 = 0; x2 < p.width; x2++) {
                let oldState = this.data[i];
                let newState = p.get(x2, y2);
                this.data[i] = (mode & (1 << (3 - (((oldState ? 1 : 0) << 1) | (newState ? 1 : 0))))) ? (newState === 0 ? oldState : newState) : 0;
                i++;
            }
        }
        return this;
    }

    getData(): Uint8Array {
        return this.data;
    }

    setData(height: number, width: number, data: Uint8Array): this {
        this.data = data;
        this.height = height;
        this.width = width;
        this.size = height * width;
        return this;
    }

    abstract copyPart(x: number, y: number, height: number, width: number): DataPattern;

    isEqual(other: Pattern): boolean {
        let otherData = other.getData();
        return this.height === other.height && this.width === other.width && this.xOffset === other.xOffset && this.yOffset === other.yOffset && this.data.every((x, i) => x === otherData[i]);
    }

    isEqualWithTranslate(other: Pattern): false | [number, number] {
        let otherData = other.getData();
        if (this.height === other.height && this.width === other.width && this.data.every((x, i) => x === otherData[i])) {
            let [xOffset, yOffset] = other.getFullOffset();
            return [this.xOffset - xOffset, this.yOffset - yOffset];
        } else {
            return false;
        }
    }

    // these come from https://en.wikipedia.org/wiki/Fowler%E2%80%93Noll%E2%80%93Vo_hash_function#FNV-1a_hash

    hash32(): number {
        let out = 0x811c9dc5;
        if (this.rule.states === 2) {
            for (let i = 0; i < this.data.length; i += 8) {
                out ^= this.data[i] | (this.data[i + 1] << 1) | (this.data[i + 2] << 2) | (this.data[i + 3] << 3) | (this.data[i + 4] << 4) | (this.data[i + 5] << 5) | (this.data[i + 6] << 5) | (this.data[i + 7] << 5);
                out *= 0x01000193;
            }
        } else {
            for (let i = 0; i < this.data.length; i++) {
                out ^= this.data[i];
                out *= 0x01000193;
            }
        }
        return out;
    }

    hash64(): bigint {
        let out = 0xcbf29ce484222325n;
        if (this.rule.states === 2) {
            for (let i = 0; i < this.data.length; i += 8) {
                out ^= BigInt(this.data[i] | (this.data[i + 1] << 1) | (this.data[i + 2] << 2) | (this.data[i + 3] << 3) | (this.data[i + 4] << 4) | (this.data[i + 5] << 5) | (this.data[i + 6] << 5) | (this.data[i + 7] << 5));
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        } else {
            for (let i = 0; i < this.data.length; i++) {
                out ^= BigInt(this.data[i]);
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        }
        
        return out;
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
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                out[loc++] = this.data[i++];
            }
            i += leftShrink + rightShrink;
        }
        this.height = height;
        this.width = width;
        this.size = height * width;
        this.xOffset += leftShrink;
        this.yOffset += topShrink;
        this.data = out;
        return this;
    }

    expand(up: number, down: number, left: number, right: number): this {
        let width = this.width;
        let height = this.height;
        let oX = left + right;
        let newWidth = width + oX;
        let newHeight = height + up + down;
        let newSize = newWidth * newHeight;
        let out = new Uint8Array(newSize);
        let loc = newWidth * up + left;
        let i = 0;
        for (let y = 0; y < height; y++) {
            out.set(this.data.slice(i, i + width), loc);
            loc += newWidth;
            i += width;
        }
        this.width = newWidth;
        this.height = newHeight;
        this.size = newSize;
        this.xOffset -= left;
        this.yOffset -= up;
        this.data = out;
        return this;
    }

    flipHorizontal(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(this.size);
        let i = 0;
        let loc = width - 1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                out[loc--] = this.data[i++];
            }
            loc += width * 2;
        }
        this.data = out;
        return this;
    }

    flipVertical(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(this.size);
        let i = 0;
        let loc = this.size - width;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                out[loc++] = this.data[i++];
            }
            loc -= width * 2;
        }
        this.data = out;
        return this;
    }

    transpose(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(this.size);
        let i = 0;
        for (let y = 0; y < height; y++) {
            let loc = y;
            for (let x = 0; x < width; x++) {
                out[loc] = this.data[i++];
                loc += height;
            }
        }
        this.data = out;
        this.height = width;
        this.width = height;
        return this;
    }

    rotateRight(): this {
        return this.transpose().flipHorizontal();
    }

    rotateLeft(): this {
        return this.transpose().flipVertical();
    }

    rotate180() {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(height * width);
        let i = 0;
        let loc = this.size - 1;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                out[loc--] = this.data[i++];
            }
        }
        this.data = out;
        return this;
    }

    flipDiagonal(): this {
        return this.transpose();
    }

    flipAntiDiagonal(): this {
        return this.transpose().rotate180();
    }

    inflate(times: number): this {
        let height = this.height * times;
        let width = this.width * times;
        let out = new Uint8Array(height * width);
        let i = 0;
        for (let y = 0; y < height; y += times) {
            for (let x = 0; x < width; x += times) {
                let value = this.data[i++];
                for (let y2 = 0; y2 <= times; y2++) {
                    for (let x2 = 0; x2 <= times; x2++) {
                        out[(y + y2) * width + (x + x2)] = value;
                    }
                }
            }
        }
        this.data = out;
        return this;
    }

    toApgcode(prefix?: string): string {
        if (prefix === undefined) {
            prefix = '';
        } else {
            prefix += '_';
        }
        if (this.rule.states < 3) {
            return prefix + this._toApgcode(this.data);
        } else {
            let out = prefix + this._toApgcode(this.data.map(x => x === 1 ? 1 : 0));
            out += '_' + this._toApgcode(this.data.map(x => x > 1 ? 1 : 0));
            let layers = Math.ceil(Math.log2(this.rule.states - 2));
            if (layers > 0) {
                let data = this.data.map(x => x < 2 ? 0 : (this.rule.states - x) * 4 - 2);
                for (let i = 0; i < layers; i++) {
                    out += '_' + this._toApgcode(data.map(x => x & (1 << i)));
                }
            }
            return out;
        }
    }

    abstract loadApgcode(code: string): DataPattern;
    abstract loadRLE(code: string): DataPattern;

}
