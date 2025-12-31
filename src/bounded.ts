
import {RuleSymmetry, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Pattern, DataPattern, CoordPattern} from './pattern.js';


export class FiniteDataPattern extends DataPattern {

    pattern: Pattern;
    bbHeight: number;
    bbWidth: number;
    minX: number;
    minY: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(height: number, width: number, data: Uint8Array, p: Pattern, bbHeight: number, bbWidth: number) {
        super(height, width, data);
        this.pattern = p;
        this.bbHeight = bbHeight;
        this.bbWidth = bbWidth;
        this.minX = -Math.floor(bbWidth / 2);
        this.minY = -Math.floor(bbHeight / 2);
        this.xOffset = -Math.floor(this.width / 2);
        this.yOffset = -Math.floor(this.height / 2);
        console.log(this.xOffset, this.yOffset);
        this.states = p.states;
        this.ruleStr = p.ruleStr + ':P' + bbWidth + ',' + bbHeight;
        this.ruleSymmetry = p.ruleSymmetry;
        this.rulePeriod = p.rulePeriod;
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setData(this.data, this.height, this.width);
        p.runGeneration();
        p.shrinkToFit();
        this.height = p.height;
        this.width = p.width;
        this.size = this.height * this.width;
        this.data = p.getData();
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
        let shrink = false;
        if (this.xOffset < this.minX) {
            this.clearPart(0, 0, this.height, this.minX - this.xOffset);
            shrink = true;
        }
        if (this.yOffset < this.minY) {
            this.clearPart(0, 0, this.minY - this.yOffset, this.width);
            shrink = true;
        }
        if (shrink) {
            this.shrinkToFit();
        }
        let height = this.yOffset + this.height;
        shrink = false;
        if (height > this.bbHeight) {
            this.clearPart(0, this.bbHeight, height - this.bbHeight, this.width);
            shrink = true;
        }
        let width = this.yOffset + this.width;
        if (width > this.bbWidth) {
            this.clearPart(this.bbWidth, 0, this.height, width - this.bbWidth);
            shrink = true;
        }
        if (shrink) {
            this.shrinkToFit();
        }
        this.generation++;
    }

    copy(): FiniteDataPattern {
        let out = new FiniteDataPattern(this.height, this.width, this.data, this.pattern, this.bbHeight, this.bbWidth);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): FiniteDataPattern {
        return new FiniteDataPattern(0, 0, new Uint8Array(0), this.pattern, this.bbHeight, this.bbWidth);
    }

    copyPart(x: number, y: number, height: number, width: number): FiniteDataPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new FiniteDataPattern(height, width, data, this.pattern, this.bbHeight, this.bbWidth);
    }

    loadApgcode(code: string): FiniteDataPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new FiniteDataPattern(height, width, data, this.pattern, this.bbHeight, this.bbWidth);
    }

}


export class FiniteCoordPattern extends CoordPattern {

    pattern: Pattern;
    bbHeight: number;
    bbWidth: number;
    minX: number;
    minY: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(coords: Map<number, number>, range: number, pattern: Pattern, bbHeight: number, bbWidth: number) {
        super(coords, range);
        this.pattern = pattern;
        this.bbHeight = bbHeight;
        this.bbWidth = bbWidth;
        this.minX = -Math.ceil(bbWidth / 2);
        this.minY = -Math.ceil(bbHeight / 2);
        this.states = pattern.states;
        this.ruleStr = pattern.ruleStr + ':P' + bbWidth + ',' + bbHeight;
        this.ruleSymmetry = pattern.ruleSymmetry;
        this.rulePeriod = pattern.rulePeriod;
    }

    runGeneration(): void {
        let p = this.pattern;
        p.setCoords(this.coords);
        p.runGeneration();
        this.coords = p.getCoords();
        for (let key of this.coords.keys()) {
            let x = Math.floor(key / WIDTH) - BIAS;
            let y = (key & (WIDTH - 1)) - BIAS;
            if (x < this.minX || y < this.minY || x > this.minX + this.bbWidth || y > this.minY + this.bbHeight) {
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

}


export class TorusDataPattern extends DataPattern {

    pattern: Pattern;
    torusHeight: number;
    torusWidth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(height: number, width: number, data: Uint8Array, pattern: Pattern, torusHeight: number, torusWidth: number) {
        super(height, width, data);
        this.pattern = pattern;
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
        this.states = pattern.states;
        this.ruleStr = pattern.ruleStr + ':T' + torusWidth + ',' + torusHeight;
        this.ruleSymmetry = pattern.ruleSymmetry;
        this.rulePeriod = pattern.rulePeriod;
    }

    runGeneration(): void {
        let p = this.pattern;
        let topTouch = this.yOffset <= this.minY;
        let bottomTouch = this.yOffset + this.height >= this.maxY;
        let leftTouch = this.xOffset <= this.minX;
        let rightTouch = this.xOffset + this.width >= this.maxX;
        if (!topTouch && !bottomTouch && !leftTouch && !rightTouch) {
            p.setData(this.data, this.height, this.width);
            p.runGeneration();
            this.height = p.height;
            this.width = p.width;
            this.size = p.height * p.width;
            this.data = p.getData();
            this.xOffset = p.xOffset;
            this.yOffset = p.yOffset;
            this.generation++;
            return;
        }
        let data = new Uint8Array((this.torusHeight + 2) * (this.torusWidth + 2));
        p.setData(data, this.torusHeight + 2, this.torusWidth + 2);
        p.xOffset = 0;
        p.yOffset = 0;
        p.runGeneration();
        p.shrinkToFit();
        let shrink = false;
        if (p.xOffset < 0) {
            p.clearPart(0, 0, 1, p.width);
            shrink = true;
        }
        if (p.yOffset < 0) {
            p.clearPart(0, 0, p.height, 1);
            shrink = true;
        }
        if (shrink) {
            p.shrinkToFit();
        }
        shrink = false;
        if (p.height > this.torusHeight + 2) {
            p.clearPart(0, p.height - 1, 1, p.width);
            shrink = true;
        }
        if (p.width > this.torusWidth + 2) {
            p.clearPart(p.width - 1, 0, p.height, 1);
            shrink = true;
        }
        if (shrink) {
            p.shrinkToFit();
        }
        p.clearPart(0, 0, 1, p.width);
        p.clearPart(0, 0, p.height, 1);
        p.clearPart(0, p.height - 1, 1, p.width);
        p.clearPart(p.width - 1, 0, p.height, 1);
        p.shrinkToFit();
        this.height = p.height;
        this.width = p.width;
        this.data = p.getData();
        this.xOffset = this.minX;
        this.yOffset = this.minY;
        this.shrinkToFit();
        this.generation++;
    }

    copy(): TorusDataPattern {
        let out = new TorusDataPattern(this.height, this.width, this.data, this.pattern, this.torusHeight, this.torusWidth);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): TorusDataPattern {
        return new TorusDataPattern(0, 0, new Uint8Array(0), this.pattern, this.torusHeight, this.torusWidth);
    }

    copyPart(x: number, y: number, height: number, width: number): TorusDataPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new TorusDataPattern(height, width, data, this.pattern, this.torusHeight, this.torusWidth);
    }

    loadApgcode(code: string): TorusDataPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new TorusDataPattern(height, width, data, this.pattern, this.torusHeight, this.torusWidth);
    }

}


export class TorusCoordPattern extends CoordPattern {

    pattern: Pattern;
    torusHeight: number;
    torusWidth: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(coords: Map<number, number>, range: number, pattern: Pattern, torusHeight: number, torusWidth: number) {
        super(coords, range);
        this.pattern = pattern;
        this.torusHeight = torusHeight;
        this.torusWidth = torusWidth;
        this.minX = -Math.ceil(torusWidth / 2);
        this.maxX = Math.floor(torusWidth / 2);
        this.minY = -Math.ceil(torusHeight / 2);
        this.maxY = Math.floor(torusHeight / 2);
        this.states = pattern.states;
        this.ruleStr = pattern.ruleStr + ':P' + torusWidth + ',' + torusHeight;
        this.ruleSymmetry = pattern.ruleSymmetry;
        this.rulePeriod = pattern.rulePeriod;
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

}
