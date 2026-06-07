
/* Implements rules where patterns run on finite grids (https://conwaylife.com/wiki/Bounded_grids). */

import {LifewebError} from './util.js';
import {Rule, Pattern, DataPattern} from './pattern.js';


/** An implementation of rules running on finite planes.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class FinitePattern extends DataPattern {

    pattern: Pattern;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, p: Pattern) {
        super(height, width, data, rule);
        this.pattern = p;
        this.xOffset = -Math.floor(this.width / 2);
        this.yOffset = -Math.floor(this.height / 2);
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setData(this.height, this.width, this.data);
        p.xOffset = 0;
        p.yOffset = 0;
        p.runGeneration();
        p.shrinkToFit();
        if (p.xOffset < 0) {
            p.clearPart(0, 0, p.height, -p.xOffset);
            p.shrinkToFit();
        }
        if (p.yOffset < 0) {
            p.clearPart(0, 0, -p.yOffset, p.width);
            p.shrinkToFit();
        }
        let data = p.getData();
        let widthAdd = Math.min(p.width, this.width);
        this.data = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            let i = (y - p.yOffset) * p.width;
            if (i < 0 || i > data.length) {
                continue;
            }
            this.data.set(data.slice(i, i + widthAdd), y * this.width + p.xOffset);
        }
        this.generation++;
    }

    shrinkToFit(): this {
        return this;
    }

    copy(): FinitePattern {
        let out = new FinitePattern(this.height, this.width, this.data, this.rule, this.pattern);
        out.generation = this.generation;
        return out;
    }

    clearedCopy(): FinitePattern {
        return new FinitePattern(this.height, this.width, new Uint8Array(this.size), this.rule, this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): FinitePattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new FinitePattern(this.height, this.width, data, this.rule, this.pattern);
    }

    loadApgcode(code: string): FinitePattern {
        let [height, width, data] = this._loadApgcode(code);
        let out = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            out.set(data.slice(y * width, y * width + this.width), y * this.width);
        }
        return new FinitePattern(this.height, this.width, out, this.rule, this.pattern);
    }

    loadRLE(rle: string): FinitePattern {
        let [height, width, data] = this._loadRLE(rle);
        let out = new Uint8Array(this.size);
        for (let y = 0; y < this.height; y++) {
            out.set(data.slice(y * width, y * width + this.width), y * this.width);
        }
        return new FinitePattern(this.height, this.width, out, this.rule, this.pattern);
    }

}


/** An implementation of rules running on toruses.
 * @param pattern The pattern that implements the rule, can be shared by multiple instances.
 */
export class TorusPattern extends DataPattern {

    pattern: Pattern;

    constructor(height: number, width: number, dataHeight: number, dataWidth: number, data: Uint8Array, rule: Rule, p: Pattern) {
        super(dataHeight, dataWidth, data, rule);
        if (dataHeight !== height || dataWidth !== width) {
            if (dataHeight > height || dataWidth > width) {
                throw new LifewebError(`Pattern too big for torus! (${dataWidth}x${dataHeight} does not fit into ${width}x${height})`);
            }
            this.ensure(width, height);
            this.xOffset = 0;
            this.yOffset = 0;
        }
        this.pattern = p;
    }

    runGeneration(): void {
        let p = this.pattern;
        let height = this.height;
        let width = this.width;
        // we build a temporary array with the sides copied around, run that temporary array, then remove the copied-around sides
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

    copy(): TorusPattern {
        let out = new TorusPattern(this.height, this.width, this.height, this.width, this.data, this.rule, this.pattern);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): TorusPattern {
        return new TorusPattern(0, 0, 0, 0, new Uint8Array(0), this.rule, this.pattern);
    }

    copyPart(x: number, y: number, height: number, width: number): TorusPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new TorusPattern(height, width, height, width, data, this.rule, this.pattern);
    }

    loadApgcode(code: string): TorusPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new TorusPattern(this.height, this.width, height, width, data, this.rule, this.pattern);
    }

    loadRLE(rle: string): TorusPattern {
        let [height, width, data] = this._loadRLE(rle);
        return new TorusPattern(this.height, this.width, height, width, data, this.rule, this.pattern);
    }

}
