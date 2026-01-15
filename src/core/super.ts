
/** Implements the Golly Super algorithm (https://conwaylife.com/wiki/OCA:LifeSuper) plus [R]Investigator (https://conwaylife.com/wiki/User:Entity_Valkyrie_2/StateInvestigator). */

import {RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';


/** A DataPattern-based implementation of [R]History (https://conwaylife.com/wiki/OCA:LifeHistory).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class DataHistoryPattern extends DataPattern {

    pattern: DataPattern;
    states: 7 = 7;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, pattern: DataPattern) {
        super(height, width, data);
        this.pattern = pattern;
        this.ruleStr = pattern.ruleStr + 'History';
        this.ruleSymmetry = pattern.ruleSymmetry;
    }

    runGeneration(): void {
        let p = this.pattern;
        let oldHeight = this.height;
        let oldWidth = this.width;
        let data = this.data;
        let alive = data.map(x => x % 2 === 1 ? 1 : 0);
        p.setData(oldHeight, oldWidth, alive);
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
                    if (y > 0) {
                        if (alive[i - oldWidth]) {
                            out[loc - width] = 2;
                        }
                        if (x > 0 && alive[i - oldWidth - 1]) {
                            out[loc - width - 1] = 2;
                        }
                        if (x < oldWidth - 1 && alive[i - oldWidth + 1]) {
                            out[loc - width + 1] = 2;
                        }
                    }
                    if (y < oldHeight - 1) {
                        if (alive[i + oldWidth]) {
                            out[loc + width] = 2;
                        }
                        if (x > 0 && alive[i + oldWidth - 1]) {
                            out[loc + width - 1] = 2;
                        }
                        if (x < oldWidth - 1 && alive[i + oldWidth + 1]) {
                            out[loc + width + 1] = 2;
                        }
                    }
                    if (x > 0 && alive[i - 1]) {
                        out[loc - 1] = 2;
                    }
                    if (x < oldWidth - 1 && alive[i + 1]) {
                        out[loc + 1] = 2;
                    }
                }
                i++;
                loc++;
            }
            loc += oX;
        }
        this.height = height;
        this.width = width;
        this.size = size;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): DataHistoryPattern {
        let out = new DataHistoryPattern(this.height, this.width, this.data, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): DataHistoryPattern {
        return new DataHistoryPattern(0, 0, new Uint8Array(0), this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): DataHistoryPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new DataHistoryPattern(height, width, data, this.pattern);
    }

    loadApgcode(code: string): DataHistoryPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new DataHistoryPattern(height, width, data, this.pattern);
    }

}


/** A CoordPattern-based implementation of [R]History (https://conwaylife.com/wiki/OCA:LifeHistory).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class CoordHistoryPattern extends CoordPattern {

    pattern: CoordPattern;
    states: 7 = 7;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(coords: Map<number, number>, range: number, pattern: CoordPattern) {
        super(coords, range);
        this.pattern = pattern;
        this.ruleStr = pattern.ruleStr + 'History';
        this.ruleSymmetry = pattern.ruleSymmetry;
    }

    runGeneration(): void {
        let p = this.pattern;
        let coords = this.coords;
        p.setCoords(coords);
        p.runGeneration();
        let out = p.coords;
        let {minX, maxX, minY, maxY} = this.getMinMaxCoords();
        minX = minX - this.range + BIAS;
        maxX = maxX + this.range + BIAS;
        minY = minY - this.range + BIAS;
        maxY = maxY + this.range + BIAS;
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let key = x * WIDTH + y;
                let oldValue = coords.get(key) ?? 0;
                let newValue = out.get(key) ?? 0;
                if (oldValue === 0 || oldValue === 2) {
                    if (newValue === 0) {
                        out.set(key, oldValue);
                    }
                } else if (oldValue === 1) {
                    out.set(key, newValue ? 1 : 2);
                } else if (oldValue === 3 || oldValue === 5) {
                    out.set(key, newValue ? oldValue : 4);
                } else if (oldValue === 4) {
                    out.set(key, newValue ? 3 : 4);
                } else if (oldValue === 6) {
                    out.set(key, 6);
                    if (p.nh) {
                        for (let i = 0; i < p.nh.length; i += 2) {
                            let key2 = key + p.nh[i] * WIDTH + p.nh[i + 1];
                            if (coords.get(key2)) {
                                out.set(key2, 2);
                            }
                        }
                    } else {
                        for (let y = -this.range; y <= this.range; y++) {
                            for (let x = -this.range; x <= this.range; x++) {
                                let key2 = key + y * WIDTH + x;
                                if (coords.get(key2)) {
                                    out.set(key2, 2);
                                }
                            }
                        }
                    }
                    if ((coords.get(key - WIDTH - 1) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH - 1, 2);
                    }
                    if ((coords.get(key - WIDTH) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH, 2);
                    }
                    if ((coords.get(key - WIDTH + 1) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH + 1, 2);
                    }
                    if ((coords.get(key - 1) ?? 0) % 2 === 1) {
                        out.set(key - 1, 2);
                    }
                    if ((coords.get(key + 1) ?? 0) % 2 === 1) {
                        out.set(key + 1, 2);
                    }
                    if ((coords.get(key + WIDTH - 1) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH - 1, 2);
                    }
                    if ((coords.get(key + WIDTH) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH, 2);
                    }
                    if ((coords.get(key + WIDTH + 1) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH + 1, 2);
                    }
                }
            }
        }
        this.coords = coords;
        this.generation++;
    }

    copy(): CoordHistoryPattern {
        let out = new CoordHistoryPattern(new Map(this.coords), this.range, this.pattern);
        out.generation = this.generation;
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): CoordHistoryPattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        let p = new CoordHistoryPattern(out, this.range, this.pattern);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): CoordHistoryPattern {
        return new CoordHistoryPattern(new Map(), this.range, this.pattern);
    }

    loadApgcode(code: string): CoordHistoryPattern {
        return new CoordHistoryPattern(this._loadApgcode(code), this.range, this.pattern);
    }

}


/** A DataPattern-based implementation of [R]Super (https://conwaylife.com/wiki/OCA:LifeSuper).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class DataSuperPattern extends DataPattern {

    pattern: DataPattern;
    states: 26 = 26;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, pattern: DataPattern) {
        super(height, width, data);
        this.pattern = pattern;
        this.ruleStr = pattern.ruleStr + 'Super';
        this.ruleSymmetry = pattern.ruleSymmetry;
    }

    runGeneration(): void {
        let p = this.pattern;
        let oldHeight = this.height;
        let oldWidth = this.width;
        let data = this.data;
        let alive = data.map(x => x % 2 === 1 ? 1 : 0);
        p.setData(oldHeight, oldWidth, alive);
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
        for (let y = 0; y < oldHeight; y++) {
            for (let x = 0; x < oldWidth; x++) {
                let oldValue = data[i];
                let newValue = out[loc];
                if (oldValue === 0 || oldValue === 2 || oldValue === 10 || oldValue === 12) {
                    if (newValue === 1) {
                        let cells: number[] = [];
                        if (x > 0) {
                            cells.push(data[i - 1]);
                        }
                        if (x < oldWidth - 1) {
                            cells.push(data[i + 1]);
                        }
                        if (y > 0) {
                            cells.push(data[i - oldWidth]);
                            if (x > 0) {
                                cells.push(data[i - oldWidth - 1]);
                            }
                            if (x < oldWidth - 1) {
                                cells.push(data[i - oldWidth - 1]);
                            }
                        }
                        if (y < oldHeight - 1) {
                            cells.push(data[i + oldWidth]);
                            if (x > 0) {
                                cells.push(data[i + oldWidth - 1]);
                            }
                            if (x < oldWidth - 1) {
                                cells.push(data[i + oldWidth - 1]);
                            }
                        }
                        if (cells.some(x => x === 1)) {
                            out[loc] = 1;
                        } else {
                            cells = cells.filter(x => x % 2 === 1);
                            if (cells.slice(1).every(x => x === cells[0])) {
                                if (cells[0] === 3 || cells[0] === 5) {
                                    out[loc] = 1;
                                } else if (cells[0] === 7 || cells[0] === 13) {
                                    out[loc] = 13;
                                } else {
                                    out[loc] = cells[0];
                                }
                            } else {
                                out[loc] = 13;
                            }
                        }
                    } else {
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
                    if (y > 0) {
                        if (alive[i - oldWidth]) {
                            out[loc - width] = 2;
                        }
                        if (x > 0 && alive[i - oldWidth - 1]) {
                            out[loc - width - 1] = 2;
                        }
                        if (x < oldWidth - 1 && alive[i - oldWidth + 1]) {
                            out[loc - width + 1] = 2;
                        }
                    }
                    if (y < oldHeight - 1) {
                        if (alive[i + oldWidth]) {
                            out[loc + width] = 2;
                        }
                        if (x > 0 && alive[i + oldWidth - 1]) {
                            out[loc + width - 1] = 2;
                        }
                        if (x < oldWidth - 1 && alive[i + oldWidth + 1]) {
                            out[loc + width + 1] = 2;
                        }
                    }
                    if (x > 0 && alive[i - 1]) {
                        out[loc - 1] = 2;
                    }
                    if (x < oldWidth - 1 && alive[i + 1]) {
                        out[loc + 1] = 2;
                    }
                } else if (oldValue === 7 || oldValue === 8) {
                    out[loc] = newValue ? 7 : 8;
                } else if (oldValue === 9 || oldValue === 10) {
                    out[loc] = newValue ? 9 : 10;
                } else if (oldValue === 11 || oldValue === 12) {
                    out[loc] = newValue ? 11 : 12;
                } else if (oldValue % 2 === 1) {
                    out[loc] = newValue ? oldValue : 0;
                } else if (oldValue === 14) {
                    out[loc] = 0;
                } else {
                    let cells: number[] = [];
                    if (x > 0) {
                        cells.push(data[i - 1]);
                    }
                    if (x < oldWidth - 1) {
                        cells.push(data[i + 1]);
                    }
                    if (y > 0) {
                        cells.push(data[i - oldWidth]);
                        if (x > 0) {
                            cells.push(data[i - oldWidth - 1]);
                        }
                        if (x < oldWidth - 1) {
                            cells.push(data[i - oldWidth - 1]);
                        }
                    }
                    if (y < oldHeight - 1) {
                        cells.push(data[i + oldWidth]);
                        if (x > 0) {
                            cells.push(data[i + oldWidth - 1]);
                        }
                        if (x < oldWidth - 1) {
                            cells.push(data[i + oldWidth - 1]);
                        }
                    }
                    if (oldValue === 16) {
                        out[loc] = cells.some(x => x === 14 || x % 2 === 1) ? 16 : 14;
                    } else if (oldValue === 18) {
                        out[loc] = cells.includes(22) ? 22 : 18;
                    } else if (oldValue === 20) {
                        out[loc] = cells.includes(18) ? 18 : 20;
                    } else if (oldValue === 22) {
                        out[loc] = cells.includes(20) ? 20 : 22;
                    } else if (oldValue === 24) {
                        out[loc] = cells.some(x => x % 2 === 1) ? 18 : 24;
                    }
                }
                i++;
                loc++;
            }
            loc += oX;
        }
        this.height = height;
        this.width = width;
        this.size = size;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): DataSuperPattern {
        let out = new DataSuperPattern(this.height, this.width, this.data, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): DataSuperPattern {
        return new DataSuperPattern(0, 0, new Uint8Array(0), this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): DataSuperPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new DataSuperPattern(height, width, data, this.pattern);
    }

    loadApgcode(code: string): DataSuperPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new DataSuperPattern(height, width, data, this.pattern);
    }

}


/** A CoordPattern-based implementation of [R]Super (https://conwaylife.com/wiki/OCA:LifeSuper).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class CoordSuperPattern extends CoordPattern {

    pattern: CoordPattern;
    states: 7 = 7;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(coords: Map<number, number>, range: number, pattern: CoordPattern) {
        super(coords, range);
        this.pattern = pattern;
        this.ruleStr = pattern.ruleStr + 'Super';
        this.ruleSymmetry = pattern.ruleSymmetry;
    }

    runGeneration(): void {
        let p = this.pattern;
        let coords = this.coords;
        p.setCoords(coords);
        p.runGeneration();
        let out = p.coords;
        let {minX, maxX, minY, maxY} = this.getMinMaxCoords();
        minX = minX - this.range + BIAS;
        maxX = maxX + this.range + BIAS;
        minY = minY - this.range + BIAS;
        maxY = maxY + this.range + BIAS;
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let key = x * WIDTH + y;
                let oldValue = coords.get(key) ?? 0;
                let newValue = out.get(key) ?? 0;
                if (oldValue === 0 || oldValue === 2 || oldValue === 10 || oldValue === 12) {
                    if (newValue === 1) {
                        let cells: number[] = [];
                        let found = false;
                        if (p.nh) {
                            for (let i = 0; i < p.nh.length; i += 2) {
                                let value = coords.get(key + p.nh[i] * WIDTH + p.nh[i + 1]);
                                if (value === 1) {
                                    found = true;
                                    break;
                                } else if (value) {
                                    cells.push(value);
                                }
                            }
                        } else {
                            for (let y = -this.range; y <= this.range; y++) {
                                for (let x = -this.range; x <= this.range; x++) {
                                    let value = coords.get(key + y * WIDTH + x);
                                    if (value === 1) {
                                        found = true;
                                        break;
                                    } else if (value) {
                                        cells.push(value);
                                    }
                                }
                            }
                        }
                        if (found) {
                            out.set(key, 1);
                        } else {
                            cells = cells.filter(x => x % 2 === 1);
                            if (cells.slice(1).every(x => x === cells[0])) {
                                if (cells[0] === 3 || cells[0] === 5) {
                                    out.set(key, 1);
                                } else if (cells[0] === 7 || cells[0] === 13) {
                                    out.set(key, 13);
                                } else {
                                    out.set(key, cells[0]);
                                }
                            } else {
                                out.set(key, 13);
                            }
                        }
                    } else {
                        out.set(key, oldValue);
                    }
                } else if (oldValue === 1) {
                    out.set(key, newValue ? 1 : 2);
                } else if (oldValue === 3 || oldValue === 5) {
                    out.set(key, newValue ? oldValue : 4);
                } else if (oldValue === 4) {
                    out.set(key, newValue ? 3 : 4);
                } else if (oldValue === 6) {
                    out.set(key, 6);
                    if (p.nh) {
                        for (let i = 0; i < p.nh.length; i += 2) {
                            let key2 = key + p.nh[i] * WIDTH + p.nh[i + 1];
                            if (coords.get(key2)) {
                                out.set(key2, 2);
                            }
                        }
                    } else {
                        for (let y = -this.range; y <= this.range; y++) {
                            for (let x = -this.range; x <= this.range; x++) {
                                let key2 = key + y * WIDTH + x;
                                if (coords.get(key2)) {
                                    out.set(key2, 2);
                                }
                            }
                        }
                    }
                    if ((coords.get(key - WIDTH - 1) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH - 1, 2);
                    }
                    if ((coords.get(key - WIDTH) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH, 2);
                    }
                    if ((coords.get(key - WIDTH + 1) ?? 0) % 2 === 1) {
                        out.set(key - WIDTH + 1, 2);
                    }
                    if ((coords.get(key - 1) ?? 0) % 2 === 1) {
                        out.set(key - 1, 2);
                    }
                    if ((coords.get(key + 1) ?? 0) % 2 === 1) {
                        out.set(key + 1, 2);
                    }
                    if ((coords.get(key + WIDTH - 1) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH - 1, 2);
                    }
                    if ((coords.get(key + WIDTH) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH, 2);
                    }
                    if ((coords.get(key + WIDTH + 1) ?? 0) % 2 === 1) {
                        out.set(key + WIDTH + 1, 2);
                    }
                } else if (oldValue === 7 || oldValue === 8) {
                    out.set(key, newValue ? 7 : 8);
                } else if (oldValue === 9 || oldValue === 10) {
                    out.set(key, newValue ? 9 : 10);
                } else if (oldValue === 11 || oldValue === 12) {
                    out.set(key, newValue ? 11 : 12);
                } else if (oldValue % 2 === 1) {
                    out.set(key, newValue ? oldValue : 0);
                } else if (oldValue === 14) {
                    out.set(key, 0);
                } else {
                    let cells: number[] = [];
                    if (p.nh) {
                        for (let i = 0; i < p.nh.length; i += 2) {
                            let value = coords.get(key + p.nh[i] * WIDTH + p.nh[i + 1]);
                            if (value) {
                                cells.push(value);
                            }
                        }
                    } else {
                        for (let y = -this.range; y <= this.range; y++) {
                            for (let x = -this.range; x <= this.range; x++) {
                                let value = coords.get(key + y * WIDTH + x);
                                if (value) {
                                    cells.push(value);
                                }
                            }
                        }
                    }
                    if (oldValue === 16) {
                        out.set(key, cells.some(x => x === 14 || x % 2 === 1) ? 16 : 14);
                    } else if (oldValue === 18) {
                        out.set(key, cells.includes(22) ? 22 : 18);
                    } else if (oldValue === 20) {
                        out.set(key, cells.includes(18) ? 18 : 20);
                    } else if (oldValue === 22) {
                        out.set(key, cells.includes(20) ? 20 : 22);
                    } else if (oldValue === 24) {
                        out.set(key, cells.some(x => x % 2 === 1) ? 18 : 24);
                    }
                }
            }
        }
        this.coords = coords;
        this.generation++;
    }

    copy(): CoordHistoryPattern {
        let out = new CoordHistoryPattern(new Map(this.coords), this.range, this.pattern);
        out.generation = this.generation;
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): CoordHistoryPattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        let p = new CoordHistoryPattern(out, this.range, this.pattern);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): CoordHistoryPattern {
        return new CoordHistoryPattern(new Map(), this.range, this.pattern);
    }

    loadApgcode(code: string): CoordHistoryPattern {
        return new CoordHistoryPattern(this._loadApgcode(code), this.range, this.pattern);
    }

}


/** Implements [R]Investigator (https://conwaylife.com/wiki/User:Entity_Valkyrie_2/StateInvestigator).
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class InvestigatorPattern extends DataPattern {

    pattern: DataPattern;
    states: 21 = 21;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, pattern: DataPattern) {
        super(height, width, data);
        this.pattern = pattern;
        this.ruleStr = pattern.ruleStr + 'Investigator';
        this.ruleSymmetry = pattern.ruleSymmetry;
    }

    runGeneration(): void {
        let p = this.pattern;
        let oldHeight = this.height;
        let oldWidth = this.width;
        let data = this.data;
        let alive = data.map(x => (x < 2 ? x : (x < 14 ? (x % 2 === 0 ? 1 : 0) : (x === 18 || x === 20 ? 0 : 1))));
        p.setData(oldHeight, oldWidth, alive);
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

    copy(): InvestigatorPattern {
        let out = new InvestigatorPattern(this.height, this.width, this.data, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): InvestigatorPattern {
        return new InvestigatorPattern(0, 0, new Uint8Array(0), this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): InvestigatorPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new InvestigatorPattern(height, width, data, this.pattern);
    }

    loadApgcode(code: string): InvestigatorPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new InvestigatorPattern(height, width, data, this.pattern);
    }

}
