
/** Implements the Golly Super algorithm (https://conwaylife.com/wiki/OCA:LifeSuper) plus [R]Investigator (https://conwaylife.com/wiki/User:Entity_Valkyrie_2/StateInvestigator). */

import {Rule, Pattern, DataPattern} from './pattern.js';


/** An implementation of [R]History (https://conwaylife.com/wiki/OCA:LifeHistory).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class HistoryPattern extends DataPattern {

    pattern: Pattern;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, pattern: Pattern) {
        super(height, width, data, rule);
        this.pattern = pattern;
    }

    runGeneration(): void {
        let p = this.pattern;
        let oldHeight = this.height;
        let oldWidth = this.width;
        let data = this.data;
        let alive = data.map(x => x % 2 === 1 ? 1 : 0);
        p.setData(oldHeight, oldWidth, alive);
        p.xOffset = this.xOffset;
        p.yOffset = this.yOffset;
        p.generation = this.generation;
        p.runGeneration();
        let height = p.height;
        let width = p.width;
        let size = height * width;
        let out = p.getData();
        let expandUp = p.yOffset < this.yOffset ? 1 : 0;
        let expandLeft = p.xOffset < this.xOffset ? 1 : 0;
        let expandRight = width > (expandLeft ? oldWidth + 1 : oldWidth) ? 1 : 0;
        let oX = expandLeft + expandRight;
        let oStart = (expandUp ? width : 0) + expandLeft;
        let i = 0;
        let loc = oStart;
        let state6: {i: number, loc: number, x: number, y: number}[] = [];
        for (let y = 0; y < oldHeight; y++) {
            for (let x = 0; x < oldWidth; x++) {
                let oldValue = data[i];
                let newValue = out[loc];
                if (oldValue === 0 || oldValue === 2) {
                    if (newValue === 0) {
                        out[loc] = oldValue;
                    }
                } else if (oldValue === 1) {
                    out[loc] = newValue ? 1 : 2;
                } else if (oldValue === 3 || oldValue === 5) {
                    out[loc] = newValue ? oldValue : 4;
                } else if (oldValue === 4) {
                    out[loc] = newValue ? 3 : 4;
                } else if (oldValue === 6) {
                    out[loc] = 6;
                    state6.push({i, loc, x, y});
                }
                i++;
                loc++;
            }
            loc += oX;
        }
        for (let {i, loc, x, y} of state6) {
            if (y > 0) {
                if (alive[i - oldWidth]) {
                    out[loc - width] = data[i - oldWidth] === 1 ? 2 : 4;
                }
                if (x > 0 && alive[i - oldWidth - 1]) {
                    out[loc - width - 1] = data[i - oldWidth - 1] === 1 ? 2 : 4;
                }
                if (x < oldWidth - 1 && alive[i - oldWidth + 1]) {
                    out[loc - width + 1] = data[i - oldWidth + 1] === 1 ? 2 : 4;
                }
            }
            if (y < oldHeight - 1) {
                if (alive[i + oldWidth]) {
                    out[loc + width] = data[i + oldWidth] === 1 ? 2 : 4;
                }
                if (x > 0 && alive[i + oldWidth - 1]) {
                    out[loc + width - 1] = data[i + oldWidth - 1] === 1 ? 2 : 4;
                }
                if (x < oldWidth - 1 && alive[i + oldWidth + 1]) {
                    out[loc + width + 1] = data[i + oldWidth + 1] === 1 ? 2 : 4;
                }
            }
            if (x > 0 && alive[i - 1]) {
                out[loc - 1] = data[i - 1] === 1 ? 2 : 4;
            }
            if (x < oldWidth - 1 && alive[i + 1]) {
                out[loc + 1] = data[i + 1] === 1 ? 2 : 4;
            }
        }
        this.height = height;
        this.width = width;
        this.size = size;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): this {
        let out = new HistoryPattern(this.height, this.width, this.data, this.rule, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new HistoryPattern(0, 0, new Uint8Array(0), this.rule, this.pattern) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new HistoryPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new HistoryPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new HistoryPattern(height, width, data, this.rule, this.pattern) as this;
    }

}


/** A DataPattern-based implementation of [R]Super (https://conwaylife.com/wiki/OCA:LifeSuper).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class SuperPattern extends DataPattern {

    pattern: Pattern;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, pattern: Pattern) {
        super(height, width, data, rule);
        this.pattern = pattern;
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setData(this.height, this.width, this.data.map(x => x % 2 === 1 ? 1 : 0));
        p.xOffset = this.xOffset;
        p.yOffset = this.yOffset;
        p.generation = this.generation;
        p.runGeneration();
        let height = p.height;
        let width = p.width;
        let size = height * width;
        let out = p.getData();
        let expandUp = p.yOffset < this.yOffset ? 1 : 0;
        let expandDown = height > this.height + expandUp ? 1 : 0;
        let expandLeft = p.xOffset < this.xOffset ? 1 : 0;
        let expandRight = width > this.width + expandLeft ? 1 : 0;
        this.expand(expandUp, expandDown, expandLeft, expandRight);
        let data = this.data;
        let i = 0;
        let state6: {i: number, x: number, y: number}[] = [];
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let oldValue = data[i];
                let newValue = out[i];
                if (oldValue === 0 || oldValue === 2 || oldValue === 10 || oldValue === 12) {
                    if (newValue === 1) {
                        let cells: number[] = [];
                        if (x > 0) {
                            cells.push(data[i - 1]);
                        }
                        if (x < width - 1) {
                            cells.push(data[i + 1]);
                        }
                        if (y > 0) {
                            cells.push(data[i - width]);
                            if (x > 0) {
                                cells.push(data[i - width - 1]);
                            }
                            if (x < width - 1) {
                                cells.push(data[i - width - 1]);
                            }
                        }
                        if (y < height - 1) {
                            cells.push(data[i + width]);
                            if (x > 0) {
                                cells.push(data[i + width - 1]);
                            }
                            if (x < width - 1) {
                                cells.push(data[i + width - 1]);
                            }
                        }
                        if (cells.some(x => x === 1)) {
                            out[i] = 1;
                        } else {
                            cells = cells.filter(x => x % 2 === 1);
                            if (cells.slice(1).every(x => x === cells[0])) {
                                if (cells[0] === 3 || cells[0] === 5) {
                                    out[i] = 1;
                                } else if (cells[0] === 7 || cells[0] === 13) {
                                    out[i] = 13;
                                } else {
                                    out[i] = cells[0];
                                }
                            } else {
                                out[i] = 13;
                            }
                        }
                    } else {
                        out[i] = oldValue;
                    }
                } else if (oldValue === 1) {
                    out[i] = newValue ? 1 : 2;
                } else if (oldValue === 3 || oldValue === 5) {
                    out[i] = newValue ? oldValue : 4;
                } else if (oldValue === 4) {
                    out[i] = newValue ? 3 : 4;
                } else if (oldValue === 6) {
                    out[i] = 6;
                    state6.push({i, x, y});
                } else if (oldValue === 7 || oldValue === 8) {
                    out[i] = newValue ? 7 : 8;
                } else if (oldValue === 9 || oldValue === 10) {
                    out[i] = newValue ? 9 : 10;
                } else if (oldValue === 11 || oldValue === 12) {
                    out[i] = newValue ? 11 : 12;
                } else if (oldValue % 2 === 1) {
                    out[i] = newValue ? oldValue : 0;
                } else if (oldValue === 14) {
                    out[i] = 0;
                } else {
                    let cells: number[] = [];
                    if (x > 0) {
                        cells.push(data[i - 1]);
                    }
                    if (x < width - 1) {
                        cells.push(data[i + 1]);
                    }
                    if (y > 0) {
                        cells.push(data[i - width]);
                        if (x > 0) {
                            cells.push(data[i - width - 1]);
                        }
                        if (x < width - 1) {
                            cells.push(data[i - width - 1]);
                        }
                    }
                    if (y < height - 1) {
                        cells.push(data[i + width]);
                        if (x > 0) {
                            cells.push(data[i + width - 1]);
                        }
                        if (x < width - 1) {
                            cells.push(data[i + width - 1]);
                        }
                    }
                    if (oldValue === 16) {
                        out[i] = cells.some(x => x === 14 || x % 2 === 1) ? 14 : 16;
                    } else if (oldValue === 18) {
                        out[i] = cells.includes(22) ? 22 : 18;
                    } else if (oldValue === 20) {
                        out[i] = cells.includes(18) ? 18 : 20;
                    } else if (oldValue === 22) {
                        out[i] = cells.includes(20) ? 20 : 22;
                    } else if (oldValue === 24) {
                        out[i] = cells.some(x => x % 2 === 1) ? 18 : 24;
                    }
                }
                i++;
            }
        }
        for (let {i, x, y} of state6) {
            let toSet: [number, number][] = [];
            if (y > 0) {
                if (data[i - width] % 2 === 1) {
                    toSet.push([i - width, data[i - width]]);
                }
                if (x > 0 && data[i - width - 1] % 2 === 1) {
                    toSet.push([i - width - 1, data[i - width - 1]]);
                }
                if (x < width - 1 && data[i - width + 1] % 2 === 1) {
                    toSet.push([i - width + 1, data[i - width + 1]]);
                }
            }
            if (y < height - 1) {
                if (data[i + width] % 2 === 1) {
                    toSet.push([i + width, data[i + width]]);
                }
                if (x > 0 && data[i + width - 1] % 2 === 1) {
                    toSet.push([i + width - 1, data[i + width - 1]]);
                }
                if (x < width - 1 && data[i + width + 1] % 2 === 1) {
                    toSet.push([i + width + 1, i + width + 1]);
                }
            }
            if (x > 0 && data[i - 1] % 2 === 1) {
                toSet.push([i - 1, data[i - 1]]);
            }
            if (x < width - 1 && data[i + 1] % 2 === 1) {
                toSet.push([i + 1, data[i + 1]]);
            }
            for (let [loc, value] of toSet) {
                if (value === 1) {
                    out[loc] = 2;
                } else if (value === 3 || value === 5) {
                    out[loc] = 4;
                } else if (value === 7) {
                    out[loc] = 8;
                } else if (value === 9) {
                    out[loc] = 10;
                } else if (value === 11) {
                    out[loc] = 12;
                } else {
                    out[loc] = 0;
                }
            }
        }
        this.height = height;
        this.width = width;
        this.size = size;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): this {
        let out = new SuperPattern(this.height, this.width, this.data, this.rule, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new SuperPattern(0, 0, new Uint8Array(0), this.rule, this.pattern) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new SuperPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new SuperPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new SuperPattern(height, width, data, this.rule, this.pattern) as this;
    }

}


/** Implements [R]Investigator (https://conwaylife.com/wiki/User:Entity_Valkyrie_2/StateInvestigator).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class InvestigatorPattern extends DataPattern {

    pattern: Pattern;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, pattern: Pattern) {
        super(height, width, data, rule);
        this.pattern = pattern;
    }

    runGeneration(): void {
        let p = this.pattern;
        let oldHeight = this.height;
        let oldWidth = this.width;
        let data = this.data;
        let alive = data.map(x => (x < 2 ? x : (x < 14 ? (x % 2 === 0 ? 1 : 0) : (x === 18 || x === 20 ? 0 : 1))));
        p.setData(oldHeight, oldWidth, alive);
        p.xOffset = this.xOffset;
        p.yOffset = this.yOffset;
        p.generation = this.generation;
        p.runGeneration();
        let height = p.height;
        let width = p.width;
        let size = height * width;
        let out = p.getData();
        let expandUp = p.yOffset < this.yOffset ? 1 : 0;
        let expandLeft = p.xOffset < this.xOffset ? 1 : 0;
        let expandRight = width > (expandLeft ? oldWidth + 1 : oldWidth) ? 1 : 0;
        let oX = expandLeft + expandRight;
        let oStart = (expandUp ? width : 0) + expandLeft;
        let i = 0;
        let loc = oStart;
        let outSurvive: Uint8Array | null = null;
        if (data.some(x => x === 17 || x === 18 || x === 19 || x === 20)) {
            let survive = new Uint8Array(size);
            for (let y = 0; y < oldHeight; y++) {
                for (let x = 0; x < oldWidth; x++) {
                    let value = data[i++];
                    if (value === 1) {
                        survive[i] = 1;
                    } else if (value < 14) {
                        if (value % 2 === 0) {
                            survive[i] = 1;
                        }
                    } else if (value !== 17 && value !== 18) {
                        survive[i] = 1;
                    }
                }
                loc += oX;
            }
            i = 0;
            loc = oStart;
            p.setData(oldHeight, oldWidth, survive);
            p.runGeneration();
            outSurvive = p.getData();
        } else {
            for (let y = 0; y < oldHeight; y++) {
                for (let x = 0; x < oldWidth; x++) {
                    let oldValue = data[i];
                    let newValue = out[loc];
                    if (oldValue < 2) {
                        if (outSurvive && oldValue === 1) {
                            out[loc] = outSurvive[loc];
                        } else {
                            out[loc] = newValue;
                        }
                        i++;
                        loc++;
                        continue;
                    } else if (oldValue === 6) {
                        out[loc] = 7;
                    } else if (oldValue === 7) {
                        out[loc] = 6;
                    } else if (oldValue === 10) {
                        out[loc] = 11;
                    } else if (oldValue === 11) {
                        out[loc] = 10;
                    } else if (oldValue === 12) {
                        out[loc] = 13;
                    } else if (oldValue === 13) {
                        out[loc] = 12;
                    } else if (oldValue === 19) {
                        out[loc] = 20;
                    } else if (oldValue === 20) {
                        out[loc] = 19;
                    } else {
                        out[loc] = oldValue;
                    }
                    if (oldValue === 2 || oldValue === 3) {
                        if (y > 0) {
                            if (data[i - oldWidth] === 1) {
                                out[loc - width] = 0;
                            }
                            if (x > 0 && data[i - oldWidth - 1] === 1) {
                                out[loc - width - 1] = 0;
                            }
                            if (x < oldWidth - 1 && data[i - oldWidth + 1] === 1) {
                                out[loc - width + 1] = 0;
                            }
                        }
                        if (y < oldHeight - 1) {
                            if (data[i + oldWidth] === 1) {
                                out[loc + width] = 0;
                            }
                            if (x > 0 && data[i + oldWidth - 1] === 1) {
                                out[loc + width - 1] = 0;
                            }
                            if (x < oldWidth - 1 && data[i + oldWidth + 1] === 1) {
                                out[loc + width + 1] = 0;
                            }
                        }
                        if (x > 0 && data[i - 1] === 1) {
                            out[loc - 1] = 0;
                        }
                        if (x < oldWidth - 1 && data[i + 1] === 1) {
                            out[loc + 1] = 0;
                        }
                    } else if (oldValue < 8 || oldValue === 10 || oldValue === 11) {
                        i++;
                        loc++;
                        continue;
                    } else if (oldValue < 14) {
                        if (y > 0) {
                            if (data[i - oldWidth] === 0) {
                                out[loc - width] = 1;
                            }
                            if (x > 0 && data[i - oldWidth - 1] === 0) {
                                out[loc - width - 1] = 1;
                            }
                            if (x < oldWidth - 1 && data[i - oldWidth + 1] === 0) {
                                out[loc - width + 1] = 1;
                            }
                        }
                        if (y < oldHeight - 1) {
                            if (data[i + oldWidth] === 0) {
                                out[loc + width] = 1;
                            }
                            if (x > 0 && data[i + oldWidth - 1] === 0) {
                                out[loc + width - 1] = 1;
                            }
                            if (x < oldWidth - 1 && data[i + oldWidth + 1] === 0) {
                                out[loc + width + 1] = 1;
                            }
                        }
                        if (x > 0 && data[i - 1] === 0) {
                            out[loc - 1] = 1;
                        }
                        if (x < oldWidth - 1 && data[i + 1] === 0) {
                            out[loc + 1] = 1;
                        }
                    } else if (oldValue === 14) {
                        if (y > 0) {
                            if (data[i - oldWidth] < 2) {
                                out[loc - width] = 1 - data[i - oldWidth];
                            }
                            if (x > 0 && data[i - oldWidth - 1] < 2) {
                                out[loc - width - 1] = 1 - data[i - oldWidth - 1];
                            }
                            if (x < oldWidth - 1 && data[i - oldWidth + 1] < 2) {
                                out[loc - width + 1] = 1 - data[i - oldWidth + 1];
                            }
                        }
                        if (y < oldHeight - 1) {
                            if (data[i + oldWidth] < 2) {
                                out[loc + width] = 1 - data[i + oldWidth];
                            }
                            if (x > 0 && data[i + oldWidth - 1] < 2) {
                                out[loc + width - 1] = 1 - data[i + oldWidth - 1];
                            }
                            if (x < oldWidth - 1 && data[i + oldWidth + 1] < 2) {
                                out[loc + width + 1] = 1 - data[i + oldWidth + 1];
                            }
                        }
                        if (x > 0 && data[i - 1] < 2) {
                            out[loc - 1] = 1 - data[i - 1];
                        }
                        if (x < oldWidth - 1 && data[i + 1] < 2) {
                            out[loc + 1] = 1 - data[i + 1];
                        }
                    } else if (oldValue === 15 || oldValue === 16) {
                        for (let y2 = y - 1; y2 <= y + 1; y2++) {
                            if (y2 < 0 || y2 >= oldHeight) {
                                continue;
                            }
                            for (let x2 = x - 1; x2 <= x + 1; x2++) {
                                if (x2 < 0 || x2 >= oldWidth || (x2 === x && y2 === y)) {
                                    continue;
                                }
                                let value = data[y2 * oldWidth + x2];
                                if (value > 1) {
                                    continue;
                                } else if (value === 1) {
                                    if (oldValue === 16) {
                                        out[oStart + y2 * (oldWidth + oX) + x2] = 0;
                                    }
                                } else if (out[oStart + y2 * (oldWidth + oX) + x2] === 1) {
                                    let found = false;
                                    for (let y3 = y2 - 1; y3 <= y2 + 1; y3++) {
                                        if (y3 < 0 || y3 >= oldHeight) {
                                            continue;
                                        }
                                        for (let x3 = x2 - 1; x3 <= x2 + 1; x3++) {
                                            if (x3 < 0 || x3 >= oldWidth || (x3 === x2 && y3 === y2)) {
                                                continue;
                                            }
                                            if (data[y3 * oldWidth + x3] === 1) {
                                                found = true;
                                                break;
                                            }
                                        }
                                        if (found) {
                                            break;
                                        }
                                    }
                                    if (!found) {
                                        out[oStart + y2 * (oldWidth + oX) + x2] = 0;
                                    }
                                }
                            }
                        }
                    }
                    i++;
                    loc++;
                }
                loc += oX;
            }
        }
        this.height = height;
        this.width = width;
        this.size = size;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): this {
        let out = new InvestigatorPattern(this.height, this.width, this.data, this.rule, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out as this;
    }

    clearedCopy(): this {
        return new InvestigatorPattern(0, 0, new Uint8Array(0), this.rule, this.pattern) as this;
    }

    copyPart(x: number, y: number, height: number, width: number): this {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new InvestigatorPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadApgcode(code: string): this {
        let [height, width, data] = this._loadApgcode(code);
        return new InvestigatorPattern(height, width, data, this.rule, this.pattern) as this;
    }

    loadRLE(rle: string): this {
        let [height, width, data] = this._loadRLE(rle);
        return new InvestigatorPattern(height, width, data, this.rule, this.pattern) as this;
    }

}
