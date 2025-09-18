
const RLE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
const RLE_PREFIXES = ['', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x'];
export const RLE_CHARS = ['.'];
for (let prefix of RLE_PREFIXES) {
    for (let letter of RLE_LETTERS) {
        RLE_CHARS.push(prefix + letter);
        if (RLE_CHARS.length === 256) {
            break;
        }
    }
}

export const APGCODE_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];


export type Runner = (p: Pattern, extra?: Uint8Array) => void;

export class Pattern {

    data: Uint8Array;
    height: number;
    width: number;
    size: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    runGeneration: Runner;
    ruleStr: string;
    states: number;
    isotropic: boolean;
    extra?: Uint8Array;

    constructor(height: number, width: number, data: Uint8Array, runGeneration: Runner, ruleStr: string, states: number, isotropic: boolean, extra?: Uint8Array) {
        this.height = height;
        this.width = width;
        this.data = data;
        this.size = this.height * this.width;
        this.runGeneration = runGeneration;
        this.ruleStr = ruleStr;
        this.states = states;
        this.isotropic = isotropic;
        this.extra = extra;
    }

    run(generations: number = 1) {
        for (let i = 0; i < generations; i++) {
            this.runGeneration(this, this.extra);
        }
    }

    getPopulation(): number {
        return this.data.reduce((x, y) => x + y);
    }

    isEmpty(): boolean {
        return this.height === 0 || this.width === 0;
    }

    getRect(): [number, number, number, number] {
        return [this.xOffset, this.yOffset, this.width, this.height];
    }

    copy(): Pattern {
        let out = new Pattern(this.height, this.width, this.data.slice(), this.runGeneration, this.ruleStr, this.states, this.isotropic, this.extra);
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        out.generation = this.generation;
        return out;
    }

    resizeToFit(): void {
        let height = this.height;
        let width = this.width;
        let size = this.size;
        let removedTop = 0;
        let i = 0;
        for (let y = 0; y < height; y++) {
            let found = false;
            for (let x = 0; x < width; x++) {
                if (this.data[i]) {
                    found = true;
                    break;
                }
                i++;
            }
            if (found) {
                break;
            } else {
                removedTop++;
            }
        }
        let removedBottom = 0;
        i = size - 1;
        for (let y = 0; y < height; y++) {
            let found = false;
            for (let x = 0; x < width; x++) {
                if (this.data[i]) {
                    found = true;
                    break;
                }
                i--;
            }
            if (found) {
                break;
            } else {
                removedBottom++;
            }
        }
        let removedLeft = 0;
        for (let x = 0; x < width; x++) {
            let i = x;
            let found = false;
            for (let y = 0; y < height; y++) {
                if (this.data[i]) {
                    found = true;
                    break;
                }
                i += width;
            }
            if (found) {
                break;
            } else {
                removedLeft++;
            }
        }
        let removedRight = 0;
        for (let x = 0; x < width; x++) {
            let i = width - x;
            let found = false;
            for (let y = 0; y < height; y++) {
                if (this.data[i]) {
                    found = true;
                    break;
                }
                i += width;
            }
            if (found) {
                break;
            } else {
                removedRight++;
            }
        }
        if (removedTop === 0 && removedBottom === 0 && removedLeft === 0 && removedRight === 0) {
            return;
        }
        height -= removedTop + removedBottom;
        width -= removedLeft + removedRight;
        this.size = this.height * this.width;
        let data = new Uint8Array(this.size);
        i = 0;
        let j = removedTop * this.width + removedLeft;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                data[i] = this.data[j];
                i++;
                j++;
            }
            j += removedRight + removedLeft;
        }
        this.height = height;
        this.width = width;
        this.xOffset += removedTop;
        this.yOffset += removedLeft;
    }

    toRLE(): string {
        let out = `x = ${this.height}, y = ${this.width}, rule = ${this.ruleStr}\n`;
        let prevChar = '';
        let num = 0;
        let i = 0;
        let line = '';
        let $count = 0;
        for (let y = 0; y < this.height; y++) {
            if (this.data.slice(i, i + this.width).every(x => x === 0)) {
                $count++;
                continue;
            }
            for (let x = 0; x < this.width; x++) {
                let char: string;
                if (this.states > 1) {
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
                    line += num + prevChar;
                    if (line.length > 70) {
                        out += line.slice(0, prevLineLength) + '\n';
                        line = line.slice(prevLineLength + 1);
                    }
                    prevChar = char;
                    num = 1;
                }
                i++;
            }
            if (y !== this.height - 1) {
                let prevLineLength = line.length;
                if ($count !== 0) {
                    line += $count;
                    $count = 0;
                }
                line += '$';
                if (line.length > 70) {
                    out += line.slice(0, prevLineLength) + '\n';
                    line = line.slice(prevLineLength + 1);
                }
            }
        }
        out += line + '\n';
        return out;
    }

    _toApgcode(data: Uint8Array): string {
        let out = '';
        for (let stripNum = 0; stripNum < Math.ceil(this.height / 5); stripNum++) {
            let zeros = 0;
            for (let x = 0; x < this.width; x++) {
                let char = APGCODE_CHARS[(data[stripNum * this.width + x] << 4) | (this.data[(stripNum + 1) * this.width + x] << 3) | (this.data[(stripNum + 2) * this.width + x] << 2) | (this.data[(stripNum + 3) * this.width + x] << 1) | (this.data[(stripNum + 4) * this.width + x] << 3)];
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
                    }
                }
            }
        }
        return out;
    }

    toApgcode(prefix: string): string {
        if (this.states < 3) {
            return prefix + '_' + this._toApgcode(this.data);
        } else {
            // i don't understand the wiki, there is probably a bug
            let out = prefix + '_' + this._toApgcode(this.data.map(x => x === 1 ? 1 : 0));
            let layers = Math.ceil(Math.log2(this.states - 2));
            let data = this.data.map(x => x < 2 ? 0 : (this.states - x) * 4 - 2);
            for (let i = 0; i < layers; i++) {
                out += '_' + this._toApgcode(data.map(x => x & (1 << i)));
            }
            return out;
        }
    }

}
