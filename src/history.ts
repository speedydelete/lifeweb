
import {RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';


export class DataHistoryPattern extends DataPattern {

    pattern: Pattern;
    states: 7 = 7;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry; 

    constructor(height: number, width: number, data: Uint8Array, pattern: Pattern) {
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
        p.setData(alive, oldHeight, oldWidth);
        p.runGeneration();
        let height = p.height;
        let width = p.width;
        let size = height * width;
        let out = p.getData();
        let expandUp = p.yOffset < this.yOffset ? 1 : 0;
        let expandLeft = p.xOffset < this.xOffset ? 1 : 0;
        let expandRight = width > (expandLeft ? oldWidth + 1 : oldWidth) ? 1 : 0;
        let oX = expandLeft + expandRight;
        let oStart = (expandUp ? width + oX : 0) + expandLeft;
        let i = 0;
        let loc = oStart;
        for (let y = 0; y < oldHeight; y++) {
            for (let x = 0; x < oldWidth; x++) {
                let oldValue = data[i];
                let newValue = out[loc];
                if ((oldValue === 0 || oldValue === 2) && newValue === 0) {
                    out[loc] = oldValue;
                } else if (oldValue === 1) {
                    if (newValue === 1) {
                        out[loc] = 1;
                    } else {
                        out[loc] = 2;
                    }
                } else if (oldValue === 3 || oldValue === 5) {
                    if (newValue === 0) {
                        out[loc] = 4;
                    } else {
                        out[loc] = oldValue;
                    }
                } else if (oldValue === 4) {
                    if (newValue === 0) {
                        out[loc] = 4;
                    } else {
                        out[loc] = 3;
                    }
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


export class CoordHistoryPattern extends CoordPattern {

    pattern: CoordPattern;
    states: 7 = 7;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;

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
                if ((oldValue === 0 || oldValue === 2) && newValue === 0) {
                    out.set(key, oldValue);
                } else if (oldValue === 1) {
                    if (newValue === 1) {
                        out.set(key, 1);
                    } else {
                        out.set(key, 2);
                    }
                } else if (oldValue === 3 || oldValue === 5) {
                    if (newValue === 0) {
                        out.set(key, 4);
                    } else {
                        out.set(key, oldValue);
                    }
                } else if (oldValue === 4) {
                    if (newValue === 0) {
                        out.set(key, 4);
                    } else {
                        out.set(key, 3);
                    }
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
