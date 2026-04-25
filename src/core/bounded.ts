
/* Implements rules where patterns run on finite grids (https://conwaylife.com/wiki/Bounded_grids). */

import {RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';


/** A DataPattern-based implementation of rules running on finite planes.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class FiniteDataPattern extends DataPattern {

    pattern: Pattern;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(height: number, width: number, data: Uint8Array, p: Pattern) {
        super(height, width, data);
        this.pattern = p;
        this.xOffset = -Math.floor(this.width / 2);
        this.yOffset = -Math.floor(this.height / 2);
        this.states = p.states;
        this.rule.str = p.rule.str + ':P' + width + ',' + height;
        this.rule.symmetry = p.rule.symmetry;
        this.rulePeriod = p.rulePeriod;
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setData(this.height, this.width, this.data);
        p.xOffset = 0;
        p.yOffset = 0;
        p.runGeneration();
        p.shrinkToFit();
        let shrink = false;
        if (p.xOffset < 0) {
            p.clearPart(0, 0, p.height, -p.xOffset);
            p.shrinkToFit();
        }
        if (p.yOffset < 0) {
            p.clearPart(0, 0, p.width, -p.yOffset);
            p.shrinkToFit();
        }
        let data = p.getData();
        this.data = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            this.data.set(data.slice(y * p.width, y * p.width + this.width), y * this.width);
        }
        this.generation++;
    }

    copy(): FiniteDataPattern {
        let out = new FiniteDataPattern(this.height, this.width, this.data, this.pattern);
        out.generation = this.generation;
        return out;
    }

    clearedCopy(): FiniteDataPattern {
        return new FiniteDataPattern(this.height, this.width, new Uint8Array(this.size), this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): FiniteDataPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new FiniteDataPattern(this.height, this.width, data, this.pattern);
    }

    loadApgcode(code: string): FiniteDataPattern {
        let [height, width, data] = this._loadApgcode(code);
        let out = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            out.set(data.slice(y * width, y * width + this.width), y * this.width);
        }
        return new FiniteDataPattern(this.height, this.width, out, this.pattern);
    }

    loadRLE(rle: string): FiniteDataPattern {
        let [height, width, data] = this._loadRLE(rle);
        let out = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            out.set(data.slice(y * width, y * width + this.width), y * this.width);
        }
        return new FiniteDataPattern(this.height, this.width, out, this.pattern);
    }

}


/** A CoordPattern-based implementation of rules running on finite planes.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class FiniteCoordPattern extends CoordPattern {

    pattern: Pattern;
    /** The height of the bounding box. */
    bbHeight: number;
    /** The width of the bounding box. */
    bbWidth: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(coords: Map<number, number>, range: number, p: Pattern, bbWidth: number, bbHeight: number) {
        super(coords, range);
        this.pattern = p;
        this.bbHeight = bbHeight;
        this.bbWidth = bbWidth;
        this.states = p.states;
        this.rule.str = p.rule.str + ':P' + bbWidth + ',' + bbHeight;
        this.rule.symmetry = p.rule.symmetry;
        this.rulePeriod = p.rulePeriod;
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setCoords(this.coords);
        p.runGeneration();
        this.coords = p.getCoords();
        for (let key of this.coords.keys()) {
            let x = Math.floor(key / WIDTH) - BIAS;
            let y = (key & (WIDTH - 1)) - BIAS;
            if (x < 0 || y < 0 || x > this.bbWidth || y > this.bbHeight) {
                this.coords.delete(key);
            }
        }
        this.generation++;
    }

    copy(): FiniteCoordPattern {
        let out = new FiniteCoordPattern(this.coords, this.range, this.pattern, this.bbHeight, this.bbWidth);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): FiniteCoordPattern {
        return new FiniteCoordPattern(this.coords, this.range, this.pattern, this.bbHeight, this.bbWidth);
    }

    copyPart(x: number, y: number, height: number, width: number): FiniteCoordPattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        return new FiniteCoordPattern(this.coords, this.range, this.pattern, this.bbHeight, this.bbWidth);
    }

    loadApgcode(code: string): FiniteCoordPattern {
        return new FiniteCoordPattern(this._loadApgcode(code), this.range, this.pattern, this.bbHeight, this.bbWidth);
    }

    loadRLE(code: string): FiniteCoordPattern {
        return new FiniteCoordPattern(this._loadRLE(code), this.range, this.pattern, this.bbHeight, this.bbWidth);
    }

}


/** A DataPattern-based implementation of rules running on toruses, broken.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class TorusDataPattern extends DataPattern {

    pattern: Pattern;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(height: number, width: number, dataHeight: number, dataWidth: number, data: Uint8Array, p: Pattern) {
        super(dataHeight, dataWidth, data);
        if (dataHeight !== height || dataWidth !== width) {
            if (dataHeight > height || dataWidth > width) {
                throw new Error('Pattern too big for torus!');
            }
            this.ensure(height, width);
            this.xOffset = 0;
            this.yOffset = 0;
        }
        this.pattern = p;
        this.states = p.states;
        this.rule.str = p.rule.str + ':T' + width + ',' + height;
    }

    runGeneration(): void {
        let p = this.pattern;
        let height = this.height;
        let width = this.width;
        let data = new Uint8Array((height + 2) * (width + 2));
        data[0] = this.data[this.size - 1];
        data.set(this.data.slice(this.size - width), 1);
        data[width + 1] = this.data[this.size - width];
        for (let y = 0; y < height; y++) {
            data[width + 2 + y * (width + 2)] = this.data[(y + 1) * width - 1];
            data.set(this.data.slice(y * width, (y + 1) * width), width + 3 + y * (width + 2));
            data[width + 1 + (y + 1) * (width + 2)] = this.data[y * width];
        }
        data[data.length - width - 2] = this.data[width - 1];
        data.set(this.data.slice(0, width), data.length - width - 1);
        data[data.length - 1] = this.data[0];
        p.setData(height + 2, width + 2, data);
        p.runGeneration();
        let pData = p.getData();
        this.data = new Uint8Array(height * width);
        let i = p.width + 1;
        if (p.xOffset < 0) {
            i -= p.xOffset;
        }
        if (p.yOffset < 0) {
            i -= p.width * p.yOffset;
        }
        let loc = 0;
        for (let y = 0; y < height; y++) {
            this.data.set(pData.slice(i, i + width), loc);
            i += p.width;
            loc += width;
        }
        p.xOffset = 0;
        p.yOffset = 0;
        this.generation++;
    }

    shrinkToFit(): this {
        return this;
    }

    copy(): TorusDataPattern {
        let out = new TorusDataPattern(this.height, this.width, this.height, this.width, this.data, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): TorusDataPattern {
        return new TorusDataPattern(0, 0, 0, 0, new Uint8Array(0), this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): TorusDataPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new TorusDataPattern(height, width, height, width, data, this.pattern);
    }

    loadApgcode(code: string): TorusDataPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new TorusDataPattern(this.height, this.width, height, width, data, this.pattern);
    }

    loadRLE(rle: string): TorusDataPattern {
        let [height, width, data] = this._loadRLE(rle);
        return new TorusDataPattern(this.height, this.width, height, width, data, this.pattern);
    }

}


/** A CoordPattern-based implementation of rules running on toruses, broken.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class TorusCoordPattern extends CoordPattern {

    pattern: Pattern;
    /** The height of the torus. */
    torusHeight: number;
    /** The width of the torus. */
    torusWidth: number;
    /** The minimum X value of live cells. */
    minX: number;
    /** The minimum Y value of live cells. */
    minY: number;
    /** The maximum X value of live cells. */
    maxX: number;
    /** The maximum Y value of live cells. */
    maxY: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(coords: Map<number, number>, range: number, p: Pattern, torusWidth: number, torusHeight: number) {
        super(coords, range);
        this.pattern = p;
        if (torusHeight === 0) {
            torusHeight = Infinity;
        }
        if (torusWidth === 0) {
            torusWidth = Infinity;
        }
        this.torusHeight = torusHeight;
        this.torusWidth = torusWidth;
        this.minX = -Math.ceil(torusWidth / 2);
        this.maxX = Math.floor(torusWidth / 2);
        this.minY = -Math.ceil(torusHeight / 2);
        this.maxY = Math.floor(torusHeight / 2);
        this.states = p.states;
        this.rule.str = p.rule.str + ':P' + torusWidth + ',' + torusHeight;
        this.rule.symmetry = p.rule.symmetry;
        this.rulePeriod = p.rulePeriod;
    }

    runGeneration(): void {
        let range = this.range;
        let torusHeight = this.torusHeight;
        let torusWidth = this.torusWidth;
        let p = this.pattern;
        let coords = this.coords;
        for (let [key, value] of coords.entries()) {
            let x = Math.floor(key / WIDTH) - BIAS;
            let y = (key & (WIDTH - 1)) - BIAS;
            if (y < this.minY + range) {
                coords.set(key + torusHeight * WIDTH, value);
                if (x < this.minX + range) {
                    coords.set(key + torusHeight * WIDTH + torusWidth, value);
                }
                if (x > this.maxX - range) {
                    coords.set(key + torusHeight * WIDTH - torusWidth, value);
                }
            }
            if (x < this.minX + range) {
                coords.set(key + torusWidth, value);
            }
            if (x > this.maxX - range) {
                coords.set(key - torusWidth, value);
            }
            if (y > this.maxY - range) {
                coords.set(key - torusHeight * WIDTH, value);
                if (x < this.minX + range) {
                    coords.set(key + torusHeight * WIDTH + torusWidth, value);
                }
                if (x > this.maxX - range) {
                    coords.set(key + torusHeight * WIDTH - torusWidth, value);
                }
            }
        }
        p.setCoords(coords);
        p.runGeneration();
        this.coords = p.getCoords();
        for (let key of this.coords.keys()) {
            let x = Math.floor(key / WIDTH) - BIAS;
            let y = (key & (WIDTH - 1)) - BIAS;
            if (x < this.minX || y < this.minY || x > this.minX + torusWidth || y > this.minY + torusHeight) {
                this.coords.delete(key);
            }
        }
        this.generation++;
    }

    copy(): TorusCoordPattern {
        let out = new TorusCoordPattern(this.coords, this.range, this.pattern, this.torusHeight, this.torusWidth);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): TorusCoordPattern {
        return new TorusCoordPattern(this.coords, this.range, this.pattern, this.torusHeight, this.torusWidth);
    }

    copyPart(x: number, y: number, height: number, width: number): TorusCoordPattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        return new TorusCoordPattern(this.coords, this.range, this.pattern, this.torusHeight, this.torusWidth);
    }

    loadApgcode(code: string): TorusCoordPattern {
        return new TorusCoordPattern(this._loadApgcode(code), this.range, this.pattern, this.torusHeight, this.torusWidth);
    }

    loadRLE(rle: string): TorusCoordPattern {
        return new TorusCoordPattern(this._loadRLE(rle), this.range, this.pattern, this.torusHeight, this.torusWidth);
    }


}
