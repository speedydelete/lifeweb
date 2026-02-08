
/* Implements alternating-time rules (https://conwaylife.com/wiki/Alternating_rule). */

import {gcd, RuleSymmetry, Pattern, DataPattern} from './pattern.js';


/** Implements alternating-time rules. */
export class AlternatingPattern extends DataPattern {

    /** A list of internal patterns that are copied into and out of when generations are run. Can be shared by multiple instances. */
    patterns: Pattern[];
    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: number;

    constructor(height: number, width: number, data: Uint8Array, patterns: Pattern[], states: number, ruleStr: string, ruleSymmetry: RuleSymmetry) {
        super(height, width, data);
        this.patterns = patterns;
        this.states = states;
        this.ruleStr = ruleStr;
        this.ruleSymmetry = ruleSymmetry;
        let rulePeriod = patterns.length;
        for (let p of patterns.slice(1)) {
            if (p.rulePeriod > 1) {
                rulePeriod = (rulePeriod * p.rulePeriod) / gcd(rulePeriod, p.rulePeriod);
            }
        }
        this.rulePeriod = rulePeriod;
    }

    runGeneration(): void {
        let p = this.patterns[this.generation % this.patterns.length];
        p.setData(this.height, this.width, this.data);
        p.generation = this.generation;
        p.xOffset = this.xOffset;
        p.yOffset = this.yOffset;
        p.runGeneration();
        this.setData(p.height, p.width, p.getData());
        this.generation = p.generation;
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
    }

    copy(): AlternatingPattern {
        let out = new AlternatingPattern(this.height, this.width, this.data, this.patterns, this.states, this.ruleStr, this.ruleSymmetry);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }
    
    clearedCopy(): AlternatingPattern {
        return new AlternatingPattern(0, 0, new Uint8Array(0), this.patterns, this.states, this.ruleStr, this.ruleSymmetry);
    }

    copyPart(x: number, y: number, height: number, width: number): AlternatingPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new AlternatingPattern(height, width, data, this.patterns, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadApgcode(code: string): AlternatingPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new AlternatingPattern(height, width, data, this.patterns, this.states, this.ruleStr, this.ruleSymmetry);
    }

    loadRLE(rle: string): AlternatingPattern {
        let [height, width, data] = this._loadRLE(rle);
        return new AlternatingPattern(height, width, data, this.patterns, this.states, this.ruleStr, this.ruleSymmetry);
    }

}
