
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


export abstract class Pattern {

    data: Uint8Array;
    height: number;
    width: number;
    size: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    abstract ruleStr: string;
    abstract states: number;
    abstract ruleSymmetry: RuleSymmetry;

    constructor(height: number, width: number, data: Uint8Array) {
        this.height = height;
        this.width = width;
        this.size = this.height * this.width;
        this.data = data;
    }

    abstract copy(): Pattern;

    abstract runGeneration(): this;

    run(n: number): this {
        for (let i = 0; i < n; i++) {
            this.runGeneration();
        }
        return this;
    }

    get population(): number {
        return this.data.reduce((x, y) => x + y);
    }

    isEmpty(): boolean {
        return this.height === 0 || this.width === 0;
    }

    getRect(): [number, number, number, number] {
        return [this.xOffset, this.yOffset, this.width, this.height];
    }

    hash(): BigUint64Array {
        let out = new BigUint64Array(1);
        out[0] = 0xcbf29ce484222325n;
        if (this.states === 2) {
            for (let i = 0; i < this.data.length; i += 8) {
                out[0] ^= BigInt(this.data[i] | (this.data[i + 1] << 1) | (this.data[i + 2] << 2) | (this.data[i + 3] << 3) | (this.data[i + 4] << 4) | (this.data[i + 5] << 5) | (this.data[i + 6] << 5) | (this.data[i + 7] << 5));
                out[0] *= 0x00000100000001b3n;
            }
        } else {
            for (let i = 0; i < this.data.length; i++) {
                out[0] ^= BigInt(this.data[i]);
                out[0] *= 0x00000100000001b3n;
            }
        }
        return out;
    }

    resizeToFit(): this {
        let topShrink = 0;
        let bottomShrink = 0;
        for (let i = 0; i < this.size; i += this.width) {
            if (topShrink === i && this.data.slice(i, i + this.width).every(x => x === 0)) {
                topShrink++;
            }
            if (bottomShrink === i && this.data.slice(this.size - i, this.size - i - this.width).every(x => x === 0)) {
                bottomShrink++;
            }
            if (topShrink !== i && bottomShrink !== i) {
                break;
            }
        }
        let leftShrink = 0;
        let rightShrink = 0;
        for (let i = 0; i < this.width; i++) {
            if (topShrink === i && this.data.slice(i, i + this.width).every(x => x === 0)) {
                topShrink++;
            }
            if (bottomShrink === i && this.data.slice(this.size - i, this.size - i - this.width).every(x => x === 0)) {
                bottomShrink++;
            }
            if (topShrink !== i && bottomShrink !== i) {
                break;
            }
        }
        if (topShrink === 0 && bottomShrink === 0 && leftShrink === 0 && rightShrink === 0) {
            return this;
        }
        let height = this.height - topShrink - bottomShrink;
        let width = this.width - leftShrink - rightShrink;
        let size = height * width;
        let out = new Uint8Array(size);
        let i = topShrink * width;
        let loc = 0;
        for (let row = 0; row < height; row++) {
            for (let col = 0; col < width; col++) {
                out[loc++] = this.data[i++];
            }
            i += leftShrink + rightShrink;
        }
        this.height = height;
        this.width = width;
        this.size = height * width;
        this.xOffset += topShrink;
        this.yOffset += leftShrink;
        this.data = out;
        return this;
    }

    get(x: number, y: number): number {
        x -= this.xOffset;
        y -= this.yOffset;
        if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
            return 0;
        }
        return this.data[y * this.width + x];
    }

    set(x: number, y: number, value: number): this {
        x -= this.xOffset;
        y -= this.yOffset;
        if (x < 0 || y < 0 || x > this.width || y > this.height) {
            let height = this.height;
            let width = this.width;
            let expandUp = -y;
            let expandDown = y - this.height;
            if (expandDown < 0) {
                expandDown = 0;
            }
            let expandLeft = -x;
            let expandRight = y - this.width;
            if (expandRight < 0) {
                expandRight = 0;
            }
            let oX = expandLeft + expandRight;
            let newWidth = width + oX;
            let newHeight = height + expandUp + expandDown;
            let newSize = newWidth * newHeight;
            let out = new Uint8Array(newSize);
            let loc = newWidth * expandUp + expandLeft + width + 1;
            let i = width + 1;
            for (let y = 0; y < newHeight; y++) {
                loc += oX;
                for (let x = 0; x < newWidth - 1; x++) {
                    out[loc++] = this.data[i++];
                }
            }
            this.width = newWidth;
            this.height = newHeight;
            this.size = newSize;
            this.xOffset -= expandUp;
            this.yOffset -= expandLeft;
            x += expandUp;
            y += expandLeft;
            this.data = out;
        }
        this.data[y * this.width + x] = value;
        return this;
    }

    flipHorizontal(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(height * width);
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
        let out = new Uint8Array(height * width);
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

    rotateRight(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(this.height * this.width);
        let i = 0;
        for (let y = 0; y < height; y++) {
            let loc = height - y - 1;
            for (let x = 0; x < width; x++) {
                out[loc] = this.data[i++];
                loc += width;
            }
        }
        this.data = out;
        this.height = width;
        this.width = height;
        return this;
    }

    rotateLeft(): this {
        let height = this.height;
        let width = this.width;
        let out = new Uint8Array(this.height * this.width);
        let i = 0;
        for (let y = 0; y < height; y++) {
            let loc = this.size - width + y;
            for (let x = 0; x < width; x++) {
                out[loc] = this.data[i++];
                loc -= width;
            }
        }
        this.data = out;
        this.height = width;
        this.width = height;
        return this;
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

    flipDiagonal() {
        this.rotateRight().flipHorizontal();
    }

    flipAntiDiagonal() {
        this.rotateRight().flipVertical();
    }



    _toApgcode(data: Uint8Array) {
        let height = this.height - 2;
        let width = this.width;
        data = data.slice(width);
        let out = '';
        for (let stripNum = 0; stripNum < Math.ceil(height / 5); stripNum++) {
            let zeros = 0;
            let start = stripNum * width * 5;
            for (let x = 1; x < width - 1; x++) {
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

    toRLE(): string {
        let out = `x = ${this.width}, y = ${this.height}, rule = ${this.ruleStr}\n`;
        let prevChar = '';
        let num = 0;
        let i = 0;
        let line = '';
        let $count = 0;
        for (let y = 0; y < this.height; y++) {
            if (this.data.slice(i, i + this.width).every(x => x === 0)) {
                $count++;
                i += this.width;
                continue;
            } else if ($count > 0) {
                let prevLineLength = line.length;
                if ($count > 1) {
                    line += $count;
                }
                line += '$';
                $count = 0;
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength + 1);
                }
            }
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
            if (y !== this.height - 1) {
                let prevLineLength = line.length;
                line += '$';
                if (line.length > 69) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength);
                }
            }
        }
        out += line + '!\n';
        return out;
    }

    static _fromApgcode(code: string): [number, number, Uint8Array] {
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
        } else {
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

}
