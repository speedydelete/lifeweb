
import {Pattern, RuleSymmetry, SYMMETRY_LEAST} from './pattern.js';


export class AlternatingPattern extends Pattern {

    states: number;
    ruleStr: string;
    ruleSymmetry: RuleSymmetry;
    patterns: Pattern[];

    constructor(height: number, width: number, data: Uint8Array, patterns: Pattern[]) {
        super(height, width, data);
        this.states = Math.max(...patterns.map(x => x.states));
        this.ruleStr = patterns.map(x => x.ruleStr).join('|');
        let symmetry = patterns[0].ruleSymmetry;
        for (let q of patterns.slice(1)) {
            symmetry = SYMMETRY_LEAST[symmetry][q.ruleSymmetry];
            if (symmetry === 'C1') {
                break;
            }
        }
        this.ruleSymmetry = symmetry;
        this.patterns = patterns;
    }

    runGeneration(): this {
        let p = this.patterns[this.generation % this.patterns.length];
        p.height = this.height;
        p.width = this.width;
        p.size = this.size;
        p.data = this.data;
        p.runGeneration();
        this.height = p.height;
        this.width = p.width;
        this.size = p.size;
        this.data = p.data;
        return this;
    }

    copy(): AlternatingPattern {
        return new AlternatingPattern(this.height, this.width, this.data, this.patterns);
    }
    
    clearedCopy(): AlternatingPattern {
        return new AlternatingPattern(0, 0, new Uint8Array(0), this.patterns);
    }

    copyPart(x: number, y: number, width: number, height: number): AlternatingPattern {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            loc += width;
        }
        return new AlternatingPattern(height, width, data, this.patterns);
    }

    loadApgcode(code: string): AlternatingPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new AlternatingPattern(height, width, data, this.patterns);
    }

}
