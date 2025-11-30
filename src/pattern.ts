
export class RuleError extends Error {
    name: 'RuleError' = 'RuleError';
}

export type RuleSymmetry = 'C1' | 'C2' | 'C4' | 'D2v' | 'D2h' | 'D2x' | 'D4+' | 'D4x' | 'D8';

const RLE_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const RLE_PREFIXES = 'pqrstuvwxyz';
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

export const APGCODE_CHARS ='0123456789abcdefghijklmnopqrstuvwxyz';


export const SYMMETRY_COMBINE: {[K in RuleSymmetry]: {[L in RuleSymmetry]: RuleSymmetry}} = {
    'C1': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2h': 'D2h',
        'D2v': 'D2v',
        'D2x': 'D2x',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'C2': {
        'C1': 'C2',
        'C2': 'C2',
        'C4': 'C4',
        'D2h': 'D4+',
        'D2v': 'D4+',
        'D2x': 'D4x',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'C4': {
        'C1': 'C4',
        'C2': 'C4',
        'C4': 'C4',
        'D2h': 'D8',
        'D2v': 'D8',
        'D2x': 'D8',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2h': {
        'C1': 'D2h',
        'C2': 'D4+',
        'C4': 'D8',
        'D2h': 'D2h',
        'D2v': 'D4+',
        'D2x': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2v': {
        'C1': 'D2v',
        'C2': 'D4+',
        'C4': 'D8',
        'D2h': 'D4+',
        'D2v': 'D2v',
        'D2x': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D2x': {
        'C1': 'D2x',
        'C2': 'D4x',
        'C4': 'D8',
        'D2h': 'D8',
        'D2v': 'D8',
        'D2x': 'D2x',
        'D4+': 'D8',
        'D4x': 'D4x',
        'D8': 'D8',
    },
    'D4+': {
        'C1': 'D4+',
        'C2': 'D4+',
        'C4': 'D8',
        'D2h': 'D4+',
        'D2v': 'D4+',
        'D2x': 'D8',
        'D4+': 'D4+',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D4x': {
        'C1': 'D4x',
        'C2': 'D4x',
        'C4': 'D8',
        'D2h': 'D8',
        'D2v': 'D8',
        'D2x': 'D4x',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
    'D8': {
        'C1': 'D8',
        'C2': 'D8',
        'C4': 'D8',
        'D2h': 'D8',
        'D2v': 'D8',
        'D2x': 'D8',
        'D4+': 'D8',
        'D4x': 'D8',
        'D8': 'D8',
    },
};

export const SYMMETRY_LEAST: {[K in RuleSymmetry]: {[L in RuleSymmetry]: RuleSymmetry}} = {
    'C1': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C4',
        'D2h': 'C1',
        'D2v': 'C1',
        'D2x': 'C1',
        'D4+': 'C1',
        'D4x': 'C1',
        'D8': 'C1',
    },
    'C2': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2h': 'C1',
        'D2v': 'C1',
        'D2x': 'C1',
        'D4+': 'C2',
        'D4x': 'C2',
        'D8': 'C2',
    },
    'C4': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2h': 'C1',
        'D2v': 'C1',
        'D2x': 'C1',
        'D4+': 'C1',
        'D4x': 'C1',
        'D8': 'C4',
    },
    'D2h': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2h': 'D2h',
        'D2v': 'C1',
        'D2x': 'C1',
        'D4+': 'D2h',
        'D4x': 'C1',
        'D8': 'D2h',
    },
    'D2v': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2h': 'C1',
        'D2v': 'D2v',
        'D2x': 'C1',
        'D4+': 'D2v',
        'D4x': 'C1',
        'D8': 'D2v',
    },
    'D2x': {
        'C1': 'C1',
        'C2': 'C1',
        'C4': 'C1',
        'D2h': 'C1',
        'D2v': 'C1',
        'D2x': 'D2x',
        'D4+': 'C1',
        'D4x': 'D2x',
        'D8': 'D2x',
    },
    'D4+': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C2',
        'D2h': 'D2h',
        'D2v': 'D2v',
        'D2x': 'C1',
        'D4+': 'D4+',
        'D4x': 'C2',
        'D8': 'D4+',
    },
    'D4x': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C2',
        'D2h': 'C1',
        'D2v': 'C1',
        'D2x': 'D2x',
        'D4+': 'C2',
        'D4x': 'D4x',
        'D8': 'D4x',
    },
    'D8': {
        'C1': 'C1',
        'C2': 'C2',
        'C4': 'C4',
        'D2h': 'D2h',
        'D2v': 'D2v',
        'D2x': 'D2x',
        'D4+': 'D4+',
        'D4x': 'D4x',
        'D8': 'D8',
    },
};

export function symmetryFromBases(C2: boolean, C4: boolean, D2h: boolean, D2v: boolean, D2x: boolean): RuleSymmetry {
    if (C4) {
        if (D2h || D2v || D2x) {
            return 'D8';
        } else {
            return 'C4';
        }
    } else if (C2) {
        if (D2h || D2v) {
            if (D2x) {
                return 'D8';
            } else {
                return 'D4+';
            }
        } else if (D2x) {
            return 'D4x';
        } else {
            return 'C2';
        }
    } else if (D2h || D2v || D2x) {
        if (D2x) {
            if (D2h || D2v) {
                return 'D8';
            } else {
                return 'D2x';
            }
        } else if (D2h && D2v) {
            return 'D4+';
        } else if (D2h) {
            return 'D2h';
        } else {
            return 'D2v';
        }
    } else {
        return 'C1';
    }
}


export interface Rect {
    height: number;
    width: number;
    xOffset: number;
    yOffset: number;
}

export interface Pattern {
    height: number;
    width: number;
    xOffset: number;
    yOffset: number;
    generation: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    runGeneration(): any;
    run(generations?: number): this;
    population: number;
    getRect(): Rect;
    isEmpty(): boolean;
    copy(): Pattern;
    clearedCopy(): Pattern;
    ensure(x: number, y: number): this;
    get(x: number, y: number): number;
    set(x: number, y: number, value: number): this;
    clear(): this;
    clear(x: number, y: number): this;
    clearPart(x: number, y: number, height: number, width: number): this;
    insert(p: Pattern, x?: number, y?: number): this;
    insertOr(p: Pattern, x?: number, y?: number): this;
    copyPart(x: number, y: number, height: number, width: number): Pattern;
    getData(): Uint8Array;
    setData(data: Uint8Array, height: number, width: number): this;
    getCoords(): [number, number, number][];
    setCoords(coords: [number, number, number][]): this;
    isEqual(other: Pattern): boolean;
    isEqualWithTranslate(other: Pattern): boolean;
    hash32(): number;
    hash64(): bigint;
    shrinkToFit(): this;
    expand(up: number, down: number, left: number, right: number): this;
    flipHorizontal(): this;
    flipVertical(): this;
    transpose(): this;
    rotateRight(): this;
    rotateLeft(): this;
    rotate180(): this;
    flipDiagonal(): this;
    toApgcode(prefix?: string): string;
    toCanonicalApgcode(period?: number, prefix?: string): string;
    toRLE(): string;
    loadApgcode(code: string): Pattern;
}


export abstract class DataPattern implements Pattern {

    data: Uint8Array;
    height: number;
    width: number;
    size: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    abstract states: number;
    abstract ruleStr: string;
    abstract ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array) {
        this.height = height;
        this.width = width;
        this.size = this.height * this.width;
        this.data = data;
    }

    abstract runGeneration(): any;

    run(n: number): this {
        for (let i = 0; i < n; i++) {
            this.runGeneration();
        }
        return this;
    }

    get population(): number {
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

    isEmpty(): boolean {
        return this.height === 0 || this.width === 0;
    }

    abstract copy(): DataPattern;
    abstract clearedCopy(): DataPattern;

    ensure(x: number, y: number): this {
        if (x < 0 || y < 0 || x > this.width || y > this.height) {
            let height = this.height;
            let width = this.width;
            let expandUp = -y;
            if (expandUp < 0) {
                expandUp = 0;
            }
            let expandDown = y - this.height;
            if (expandDown < 0) {
                expandDown = 0;
            }
            let expandLeft = -x;
            if (expandLeft < 0) {
                expandLeft = 0;
            }
            let expandRight = x - this.width;
            if (expandRight < 0) {
                expandRight = 0;
            }
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
            x += expandUp;
            y += expandLeft;
            this.data = out;
        }
        return this;
    }

    get(x: number, y: number): number {
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }
        return this.data[y * this.width + x];
    }

    set(x: number, y: number, value: number = 1): this {
        this.data[(y - this.yOffset) * this.width + (x - this.xOffset)] = value;
        return this;
    }

    clear(): this;
    clear(x: number, y: number): this;
    clear(x?: number, y?: number): this {
        if (!x) {
            this.height = 0;
            this.width = 0;
            this.size = 0;
            this.data = new Uint8Array(0);
        } else {
            // @ts-ignore
            this.data[(y - this.yOffset) * this.width + (x - this.xOffset)] = 0;
        }
        return this;
    }

    clearPart(x: number, y: number, height: number, width: number): this {
        let i = y * this.height + x;
        for (let row = y; row < y + height; row++) {
            this.data.fill(0, i, i + width);
            i += this.width;
        }
        return this;
    }

    insert(p: Pattern, x: number = 0, y: number = 0): this {
        let index = 0;
        let pData = p.getData();
        for (let i = 0; i < p.height; i++) {
            this.data.set(pData.slice(index, index + p.width), (y + i) * this.width + x);
            index += p.width;
        }
        return this;
    }

    insertOr(p: Pattern, x: number = 0, y: number = 0): this {
        for (let y2 = 0; y2 < p.height; y2++) {
            for (let x2 = 0; x2 < p.width; x2++) {
                let value = p.get(x, y);
                if (value) {
                    this.data[(y + y2) * this.width + x + x2] = value;
                }
            }
        }
        return this;
    }

    getData(): Uint8Array {
        return this.data;
    }

    setData(data: Uint8Array, height: number, width: number): this {
        this.data = data;
        this.height = height;
        this.width = width;
        this.size = height * width;
        return this;
    }

    getCoords(): [number, number, number][] {
        let out: [number, number, number][] = [];
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let value = this.data[y * this.width + x];
                if (value) {
                    out.push([x, y, value]);
                }
            }
        }
        return out;
    }

    setCoords(coords: [number, number, number][]): this {
        if (coords.length === 0) {
            this.height = 0;
            this.width = 0;
            this.size = 0;
            this.data = new Uint8Array();
            return this;
        }
        let minX = coords[0][0];
        let maxX = coords[0][0];
        let minY = coords[0][1];
        let maxY = coords[0][1];
        for (let point of coords.slice(1)) {
            if (point[0] < minX) {
                minX = point[0];
            }
            if (point[0] > maxX) {
                maxX = point[0];
            }
            if (point[0] < minY) {
                minY = point[0];
            }
            if (point[0] > maxY) {
                maxY = point[0];
            }
        }
        this.height = maxX - minX;
        this.width = maxY - minY;
        this.size = this.height * this.width;
        this.data = new Uint8Array(this.size);
        for (let [x, y, value] of coords) {
            this.data[y * this.width + x] = value;
        }
        return this;
    }

    abstract copyPart(x: number, y: number, height: number, width: number): DataPattern;

    isEqual(other: Pattern): boolean {
        let otherData = other.getData();
        return this.height === other.height && this.width === other.width && this.xOffset === other.xOffset && this.yOffset === other.yOffset && this.data.every((x, i) => x === otherData[i]);
    }

    isEqualWithTranslate(other: Pattern): boolean {
        let otherData = other.getData();
        return this.height === other.height && this.width === other.width && this.data.every((x, i) => x === otherData[i]);
    }

    hash32(): number {
        let out = 0x811c9dc5;
        if (this.states === 2) {
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
        if (this.states === 2) {
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
        return this.rotateRight().flipHorizontal();
    }

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
                                zeros -= 40;
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

    toApgcode(prefix?: string): string {
        if (prefix === undefined) {
            prefix = '';
        } else {
            prefix += '_';
        }
        if (this.states < 3) {
            return prefix + this._toApgcode(this.data);
        } else {
            let out = prefix + this._toApgcode(this.data.map(x => x === 1 ? 1 : 0));
            out += '_' + this._toApgcode(this.data.map(x => x > 1 ? 1 : 0));
            let layers = Math.ceil(Math.log2(this.states - 2));
            if (layers > 0) {
                let data = this.data.map(x => x < 2 ? 0 : (this.states - x) * 4 - 2);
                for (let i = 0; i < layers; i++) {
                    out += '_' + this._toApgcode(data.map(x => x & (1 << i)));
                }
            }
            return out;
        }
    }

    toCanonicalApgcode(period: number = 1, prefix?: string): string {
        let p = this.copy();
        p.shrinkToFit();
        let codes: string[] = [];
        for (let j = 0; j < period; j++) {
            if (j > 0) {
                p.runGeneration();
                p.shrinkToFit();
            }
            let prev = codes.length;
            codes.push(p.toApgcode());
            if (this.ruleSymmetry !== 'C1') {
                let q = p.copy();
                if (this.ruleSymmetry === 'D8') {
                    codes.push(q.rotateLeft().toApgcode());
                    for (let i = 0; i < 2; i++) {
                        for (let i = 0; i < 4; i++) {
                            codes.push(q.rotateLeft().toApgcode());
                        }
                        q.flipHorizontal();
                    }
                } else if (this.ruleSymmetry === 'C2') {
                    codes.push(q.rotate180().toApgcode());
                } else if (this.ruleSymmetry === 'C4') {
                    for (let i = 0; i < 4; i++) {
                        codes.push(q.rotateLeft().toApgcode());
                    }
                } else if (this.ruleSymmetry === 'D2h') {
                    codes.push(q.flipHorizontal().toApgcode());
                } else if (this.ruleSymmetry === 'D2v') {
                    codes.push(q.flipVertical().toApgcode());
                } else if (this.ruleSymmetry === 'D2x') {
                    codes.push(q.flipDiagonal().toApgcode());
                } else if (this.ruleSymmetry === 'D4+') {
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

    toRLE(): string {
        let out = `x = ${this.width}, y = ${this.height}, rule = ${this.ruleStr}\n`;
        let prevChar = '';
        let num = 0;
        let i = 0;
        let line = '';
        let $count = 0;
        let isStart = true;
        for (let y = 0; y < this.height; y++) {
            if (this.data.slice(i, i + this.width).every(x => x === 0)) {
                $count++;
                i += this.width;
                continue;
            }
            if (!isStart) {
                let prevLineLength = line.length;
                if ($count > 0) {
                    line += $count + 1;
                    $count = 0;
                }
                line += '$';
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            } else if ($count > 0) {
                let prevLineLength = line.length;
                line += $count + '$';
                $count = 0;
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
            isStart = false;
            for (let x = 0; x < this.width; x++) {
                let char: string;
                if (this.states > 2) {
                    char = RLE_CHARS[this.data[i]];
                } else if (this.data[i]) {
                    char = 'o';
                } else {
                    char = 'b';
                }
                if (char === prevChar) {
                    num++;
                } else {
                    let prevLineLength = line.length;
                    if (num > 1) {
                        line += num;
                    }
                    line += prevChar;
                    if (line.length > 69) {
                        out += line.slice(0, prevLineLength) + '\n';
                        line = line.slice(prevLineLength);
                    }
                    prevChar = char;
                    num = 1;
                }
                i++;
            }
            if (prevChar !== 'b' && prevChar !== '.') {
                let prevLineLength = line.length;
                if (num > 1) {
                    line += num;
                }
                line += prevChar;
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
            prevChar = '';
            num = 1;
        }
        out += line + '!';
        return out;
    }

    _loadApgcode(code: string): [number, number, Uint8Array] {
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
                            let letter = strip[i + 1];
                            let count = APGCODE_CHARS.indexOf(letter) + 4;
                            for (let i = 0; i < count; i++) {
                                stripData.push(0);
                            }
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

    abstract loadApgcode(code: string): DataPattern;

}


export abstract class CoordPattern implements Pattern {

    coords: [number, number, number][];
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    abstract states: number;
    abstract ruleStr: string;
    abstract ruleSymmetry: RuleSymmetry;

    constructor(coords: [number, number, number][]) {
        this.coords = coords;
    }

    get height(): number {
        return this.getRect().height;
    }

    get width(): number {
        return this.getRect().width;
    }

    getMinMaxCoords(): {minX: number, maxX: number, minY: number, maxY: number} {
        if (this.coords.length === 0) {
            return {minX: 0, maxX: 0, minY: 0, maxY: 0};
        }
        let minX = this.coords[0][0];
        let maxX = this.coords[0][0];
        let minY = this.coords[0][1];
        let maxY = this.coords[0][1];
        for (let point of this.coords.slice(1)) {
            if (point[0] < minX) {
                minX = point[0];
            }
            if (point[0] > maxX) {
                maxX = point[0];
            }
            if (point[0] < minY) {
                minY = point[0];
            }
            if (point[0] > maxY) {
                maxY = point[0];
            }
        }
        return {minX, minY, maxX, maxY};
    }

    getRect(): Rect {
        if (this.coords.length === 0) {
            return {height: 0, width: 0, xOffset: 0, yOffset: 0};
        }
        let {minX, minY, maxX, maxY} = this.getMinMaxCoords();
        return {height: maxY - minY + 1, width: maxX - minX + 1, xOffset: 0, yOffset: 0};
    }

    abstract runGeneration(): any;

    run(n: number): this {
        for (let i = 0; i < n; i++) {
            this.runGeneration();
        }
        return this;
    }

    get population(): number {
        return this.coords.length;
    }

    isEmpty(): boolean {
        return this.coords.length === 0;
    }

    abstract copy(): CoordPattern;
    abstract clearedCopy(): CoordPattern;

    ensure(x: number, y: number): this {
        return this;
    }

    get(x: number, y: number): number {
        for (let point of this.coords) {
            if (point[0] === x && point[1] === y) {
                return point[2];
            }
        }
        return 0;
    }

    set(x: number, y: number, value: number): this {
        if (value === 0) {
            for (let i = 0; i < this.coords.length; i++) {
                if (this.coords[i][0] === x && this.coords[i][1] === y) {
                    this.coords.splice(i, 1);
                    return this;
                }
            }
        } else {
            for (let point of this.coords) {
                if (point[0] === x && point[1] === y) {
                    point[2] = value;
                    return this;
                }
            }
            this.coords.push([x, y, value]);
        }
        return this;
    }

    clear(): this {
        this.coords = [];
        return this;
    }

    clearPart(x: number, y: number, height: number, width: number): this {
        this.coords = this.coords.filter(point => point[0] < x || point[0] >= x + width || point[1] < y || point[1] >= y + height);
        return this;
    }

    insert(p: Pattern, x: number = 0, y: number = 0): this {
        this.clearPart(x, y, p.height, p.width);
        this.insertOr(p, x, y);
        return this;
    }

    insertOr(p: Pattern, x: number = 0, y: number = 0): this {
        for (let [x2, y2, value] of p.getCoords()) {
            x2 += x;
            y2 += y;
            let found = false;
            for (let point of this.coords) {
                if (point[0] === x2 && point[1] === y2) {
                    point[2] = value;
                    found = true;
                    break;
                }
            }
            if (!found) {
                this.coords.push([x2, y2, value]);
            }
        }
        return this;
    }

    abstract copyPart(x: number, y: number, height: number, width: number): CoordPattern;

    getData(): Uint8Array {
        let {minX, minY, maxX, maxY} = this.getMinMaxCoords();
        let height = maxY - minY + 1;
        let width = maxX - minX + 1;
        let out = new Uint8Array(height * width);
        for (let [x, y, value] of this.coords) {
            out[(y - minY) * width + (x - minX)] = value;
        }
        return out;
    }

    setData(data: Uint8Array, height: number, width: number): this {
        this.coords = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = data[y * width + x];
                if (value) {
                    this.coords.push([x, y, value]);
                }
            }
        }
        return this;
    }

    getCoords(): [number, number, number][] {
        return this.coords;
    }

    setCoords(coords: [number, number, number][]): this {
        this.coords = coords;
        return this;
    }

    isEqual(other: Pattern): boolean {
        let otherData = other.getData();
        return this.height === other.height && this.width === other.width && other.xOffset === this.xOffset && other.yOffset === this.yOffset && this.getData().every((x, i) => x === otherData[i]);
    }

    isEqualWithTranslate(other: Pattern): boolean {
        let otherData = other.getData();
        return this.height === other.height && this.width === other.width && this.getData().every((x, i) => x === otherData[i]);
    }

    hash32(): number {
        let data = this.getData();
        let out = 0x811c9dc5;
        if (this.states === 2) {
            for (let i = 0; i < data.length; i += 8) {
                out ^= data[i] | (data[i + 1] << 1) | (data[i + 2] << 2) | (data[i + 3] << 3) | (data[i + 4] << 4) | (data[i + 5] << 5) | (data[i + 6] << 5) | (data[i + 7] << 5);
                out *= 0x01000193;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                out ^= data[i];
                out *= 0x01000193;
            }
        }
        return out;
    }

    hash64(): bigint {
        let data = this.getData();
        let out = 0xcbf29ce484222325n;
        if (this.states === 2) {
            for (let i = 0; i < data.length; i += 8) {
                out ^= BigInt(data[i] | (data[i + 1] << 1) | (data[i + 2] << 2) | (data[i + 3] << 3) | (data[i + 4] << 4) | (data[i + 5] << 5) | (data[i + 6] << 5) | (data[i + 7] << 5));
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                out ^= BigInt(data[i]);
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        }
        return out;
    }

    shrinkToFit(): this {
        return this;
    }

    expand(up: number, down: number, left: number, right: number): this {
        return this;
    }

    flipHorizontal(): this {
        let maxY = this.coords[0][1];
        for (let point of this.coords.slice(1)) {
            if (point[1] > maxY) {
                maxY = point[1];
            }
        }
        this.coords = this.coords.map(x => [x[0], maxY - x[1], x[2]]);
        return this;
    }

    flipVertical(): this {
        let maxX = this.coords[0][0];
        for (let point of this.coords.slice(1)) {
            if (point[1] > maxX) {
                maxX = point[1];
            }
        }
        this.coords = this.coords.map(x => [x[0], maxX - x[1], x[2]]);
        return this;
    }

    transpose(): this {
        this.coords = this.coords.map(x => [x[1], x[0], x[2]]);
        return this;
    }

    rotateRight(): this {
        return this.transpose().flipHorizontal();
    }

    rotateLeft(): this {
        return this.transpose().flipVertical();
    }

    rotate180() {
        return this.flipHorizontal().flipVertical();
    }

    flipDiagonal(): this {
        return this.rotateRight().flipHorizontal();
    }

    _toApgcode(data: Uint8Array, height: number, width: number): string {
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
                                zeros -= 40;
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

    toApgcode(prefix?: string): string {
        if (prefix === undefined) {
            prefix = '';
        } else {
            prefix += '_';
        }
        let data = this.getData();
        let {height, width} = this.getRect();
        if (this.states < 3) {
            return prefix + this._toApgcode(data, height, width);
        } else {
            let out = prefix + this._toApgcode(data.map(x => x === 1 ? 1 : 0), height, width);
            out += '_' + this._toApgcode(data.map(x => x > 1 ? 1 : 0), height, width);
            let layers = Math.ceil(Math.log2(this.states - 2));
            if (layers > 0) {
                let data2 = data.map(x => x < 2 ? 0 : (this.states - x) * 4 - 2);
                for (let i = 0; i < layers; i++) {
                    out += '_' + this._toApgcode(data2.map(x => x & (1 << i)), height, width);
                }
            }
            return out;
        }
    }

    toCanonicalApgcode(period: number = 1, prefix?: string): string {
        let p = this.copy();
        p.shrinkToFit();
        let codes: string[] = [];
        for (let j = 0; j < period; j++) {
            if (j > 0) {
                p.runGeneration();
                p.shrinkToFit();
            }
            let prev = codes.length;
            codes.push(p.toApgcode());
            if (this.ruleSymmetry !== 'C1') {
                let q = p.copy();
                if (this.ruleSymmetry === 'D8') {
                    codes.push(q.rotateLeft().toApgcode());
                    for (let i = 0; i < 2; i++) {
                        for (let i = 0; i < 4; i++) {
                            codes.push(q.rotateLeft().toApgcode());
                        }
                        q.flipHorizontal();
                    }
                } else if (this.ruleSymmetry === 'C2') {
                    codes.push(q.rotate180().toApgcode());
                } else if (this.ruleSymmetry === 'C4') {
                    for (let i = 0; i < 4; i++) {
                        codes.push(q.rotateLeft().toApgcode());
                    }
                } else if (this.ruleSymmetry === 'D2h') {
                    codes.push(q.flipHorizontal().toApgcode());
                } else if (this.ruleSymmetry === 'D2v') {
                    codes.push(q.flipVertical().toApgcode());
                } else if (this.ruleSymmetry === 'D2x') {
                    codes.push(q.flipDiagonal().toApgcode());
                } else if (this.ruleSymmetry === 'D4+') {
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

    toRLE(): string {
        let data = this.getData();
        let {height, width} = this.getRect();
        let out = `x = ${width}, y = ${height}, rule = ${this.ruleStr}\n`;
        let prevChar = '';
        let num = 0;
        let i = 0;
        let line = '';
        let $count = 0;
        let isStart = true;
        for (let y = 0; y < height; y++) {
            if (data.slice(i, i + width).every(x => x === 0)) {
                $count++;
                i += width;
                continue;
            }
            if (!isStart) {
                let prevLineLength = line.length;
                if ($count > 0) {
                    line += $count + 1;
                    $count = 0;
                }
                line += '$';
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            } else if ($count > 0) {
                let prevLineLength = line.length;
                line += $count + '$';
                $count = 0;
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
            isStart = false;
            for (let x = 0; x < this.width; x++) {
                let char: string;
                if (this.states > 2) {
                    char = RLE_CHARS[data[i]];
                } else if (data[i]) {
                    char = 'o';
                } else {
                    char = 'b';
                }
                if (char === prevChar) {
                    num++;
                } else {
                    let prevLineLength = line.length;
                    if (num > 1) {
                        line += num;
                    }
                    line += prevChar;
                    if (line.length > 69) {
                        out += line.slice(0, prevLineLength) + '\n';
                        line = line.slice(prevLineLength);
                    }
                    prevChar = char;
                    num = 1;
                }
                i++;
            }
            if (prevChar !== 'b' && prevChar !== '.') {
                let prevLineLength = line.length;
                if (num > 1) {
                    line += num;
                }
                line += prevChar;
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
            prevChar = '';
            num = 1;
        }
        out += line + '!';
        return out;
    }

    _loadApgcode(code: string): [number, number, number][] {
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
                            let letter = strip[i + 1];
                            let count = APGCODE_CHARS.indexOf(letter) + 4;
                            for (let i = 0; i < count; i++) {
                                stripData.push(0);
                            }
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
        let coords: [number, number, number][] = [];
        let i = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let value = out[i++];
                if (value) {
                    coords.push([x, y, value]);
                }
            }
        }
        return coords;
    }

    abstract loadApgcode(code: string): CoordPattern;

}
