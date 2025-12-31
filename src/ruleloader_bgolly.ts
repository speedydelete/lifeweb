
import {parentPort} from 'node:worker_threads';
import {join} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';
import {RuleSymmetry, RLE_CHARS, DataPattern} from './pattern.js';


const SYMMETRIES: {[key: string]: RuleSymmetry} = {
    rotate2: 'C2',
    rotate2reflect: 'D4+',
    rotate4: 'C4',
    rotate4reflect: 'D8',
    rotate8: 'C4',
    rotate8reflect: 'D8',
    permute: 'D8',
};


let nextRuleName = 0;
let rules = new Map<string, {name: string, states: number, symmetry: RuleSymmetry}>();

let dir = join(import.meta.dirname, '..');


function getAtRuleStatesAndSymmetries(rule: string): {states: number, symmetry: RuleSymmetry} {
    if (parentPort) {
        throw new Error(rule);
    }
    let states: number | null = null;
    let symmetry: RuleSymmetry | null = null;
    for (let line of rule.split('\n')) {
        let char: string | null = null;
        if (line.includes(':')) {
            char = ':';
        } else if (line.includes('=')) {
            char = '=';
        } else {
            continue;
        }
        let [arg, value] = line.split(char);
        arg = arg.trim();
        value = value.trim();
        if (states === null && (arg === 'n_states' || arg === 'num_states' || arg === 'states')) {
            states = parseInt(value);
        } else if (symmetry === null && arg === 'symmetries' && value in SYMMETRIES) {
            symmetry = SYMMETRIES[value];
        }
    }
    if (states === null) {
        states = 256;
    }
    if (symmetry === null) {
        symmetry = 'C1';
    }
    return {states, symmetry};
}


export class RuleLoaderBgollyPattern extends DataPattern {

    ruleStr: string;
    states: number;
    ruleSymmetry: RuleSymmetry;
    rulePeriod: 1 = 1;

    constructor(height: number, width: number, data: Uint8Array, rule: string, override?: string) {
        super(height, width, data);
        if (override) {
            this.ruleStr = '__ruleloader_bgolly_' + override;
            let value = rules.get(override);
            if (value) {
                this.states = value.states;
                this.ruleSymmetry = value.symmetry;
            } else {
                let {states, symmetry} = getAtRuleStatesAndSymmetries(fs.readFileSync(join(dir, override)).toString());
                this.states = states;
                this.ruleSymmetry = symmetry;
                rules.set(override, {name: override, states, symmetry});      
            }
        } else {
            let value = rules.get(rule);
            if (value) {
                this.ruleStr = '__ruleloader_bgolly_' + value.name;
                this.states = value.states;
                this.ruleSymmetry = value.symmetry;
            } else {
                let name = String(nextRuleName++);
                let {states, symmetry} = getAtRuleStatesAndSymmetries(rule);
                this.ruleStr = '__ruleloader_bgolly_' + name;
                fs.writeFileSync(join(dir, this.ruleStr + '.rule'), rule);
                this.states = states;
                this.ruleSymmetry = symmetry;
                rules.set(rule, {name, states, symmetry});
            }
        }
    }

    run(n: number): this {
        fs.writeFileSync(join(dir, 'in.rle'), this.toRLE());
        execSync(`(cd ${dir}; ./bgolly -a RuleLoader -s ./ -o out.rle -q -q -m ${n} in.rle)`, {stdio: 'inherit'});
        let rle = fs.readFileSync(join(dir, 'out.rle')).toString().split('\n').slice(1).join('\n').slice(0, -1);
        let raw: number[][] = [];
        let num = '';
        let prefix = '';
        let currentLine: number[] = [];
        for (let i = 0; i < rle.length; i++) {
            let char = rle[i];
            if (char === 'b' || char === 'o') {
                let value = char === 'o' ? 1 : 0;
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('0123456789'.includes(char)) {
                num += char;
            } else if (char === '\u0024') {
                raw.push(currentLine);
                currentLine = [];
                if (num !== '') {
                    let count = parseInt(num);
                    for (let i = 1; i < count; i++) {
                        raw.push([]);
                    }
                    num = '';
                }
            } else if (char === '.') {
                if (num === '') {
                    currentLine.push(0);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(0);
                    }
                    num = '';
                }
            } else if ('ABCDEFGHIJKLMNOPQRSTUVWX'.includes(char)) {
                if (prefix) {
                    char = prefix + char;
                }
                let value = RLE_CHARS.indexOf(char);
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('pqrstuvwxy'.includes(char)) {
                prefix = char;
            }
        }
        raw.push(currentLine);
        let height = raw.length;
        let width = Math.max(...raw.map(x => x.length));
        let data = new Uint8Array(height * width);
        for (let y = 0; y < raw.length; y++) {
            let i = y * width;
            let line = raw[y];
            for (let x = 0; x < line.length; x++) {
                data[i] = line[x];
                i++;
            }
        }
        this.height = height;
        this.width = width;
        this.size = height * width;
        this.data = data;
        return this;
    }

    runGeneration(): void {
        this.run(1);
    }

    copy(): RuleLoaderBgollyPattern {
        return new RuleLoaderBgollyPattern(this.height, this.width, this.data, this.ruleStr);
    }

    clearedCopy(): RuleLoaderBgollyPattern {
        return new RuleLoaderBgollyPattern(0, 0, new Uint8Array(0), this.ruleStr);
    }

    copyPart(x: number, y: number, height: number, width: number): RuleLoaderBgollyPattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new RuleLoaderBgollyPattern(height, width, data, this.ruleStr);
    }

    loadApgcode(code: string): RuleLoaderBgollyPattern {
        let [height, width, data] = this._loadApgcode(code);
        return new RuleLoaderBgollyPattern(height, width, data, this.ruleStr);
    }

}
