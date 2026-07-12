
/* The main file, exporting everything and also implementing many utility functions. */

import {LifewebError, RuleError, lcm} from './util.js';
import {RuleSymmetry, SYMMETRY_MEET, Rule, Pattern, IdentityPattern} from './pattern.js';
import {unparseMAPRuleFull, MAPPattern, MAPB0Pattern, MAPGenPattern, createMAPPattern} from './map.js';
import {unparseHROTRanges, HROTPattern, HROTB0Pattern, createHROTPattern} from './hrot.js';
import {HistoryPattern, SuperPattern, InvestigatorPattern} from './super.js';
import {FinitePattern, TorusPattern} from './bounded.js';
import {AlternatingPattern} from './alternating.js';
import {TreePattern, createTreePattern} from './ruleloader.js';
import {getKnots, INTSeparator} from './intsep.js';
import {Separator} from './separate.js';

export * from './util.js';
export * from './pattern.js';
export * from './map.js';
export * from './hrot.js';
export * from './super.js';
export * from './ruleloader.js';
export * from './alternating.js';
export * from './bounded.js';
export * from './minmax.js';
export * from './identify.js';
export * from './intsep.js';
export * from './separate.js';
export * from './catagolue.js';
export * from './conduits.js';

import './mapsep.js';


/** Creates a pattern from a rulestring.
 * @param namedRules An object mapping aliases to rules.
 */
export function createPattern(rule: string, namedRules?: {[key: string]: string}, height: number = 0, width: number = 0, data: Uint8Array = new Uint8Array(0), prevName?: string): Pattern {
    rule = rule.trim();
    if (rule.toLowerCase() === 'life') {
        return createPattern('B3/S23', namedRules, height, width, data, prevName);
    } else if (rule.toLowerCase() === 'identity') {
        return new IdentityPattern(height, width, data);
    }
    let errors: string[] = [];
    try {
        let out = createMAPPattern(rule, height, width, data);
        if (typeof out === 'object') {
            return out;
        } else {
            rule = out;
        }
    } catch (error) {
        if (error instanceof RuleError) {
            errors.push(error.message);
        } else {
            throw error;
        }
    }
    if (rule.startsWith('R') || rule.startsWith('r')) {
        try {
            let out = createHROTPattern(rule, height, width, data);
            if (typeof out === 'string') {
                return createPattern(out, namedRules, height, width, data, prevName);
            } else {
                return out;
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.startsWith('@')) {
        try {
            return createTreePattern(rule, height, width, data, prevName);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('History')) {
        try {
            let p = createPattern(rule.slice(0, -'History'.length), namedRules, height, width, data, undefined);
            // if (p.rule.states !== 2) {
            //     throw new RuleError('History is only supported for 2-state rules');
            // }
            let ruleData: Rule = Object.assign({}, p.rule, {str: p.rule.str + 'History', states: 7});
            return new HistoryPattern(height, width, data, ruleData, p);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('Super')) {
        try {
            let p = createPattern(rule.slice(0, -'Super'.length), namedRules, height, width, data, undefined);
            // if (p.rule.states !== 2) {
            //     throw new RuleError('Super is only supported for 2-state rules');
            // }
            let ruleData: Rule = Object.assign({}, p.rule, {str: p.rule.str + 'Super', states: 26})
            return new SuperPattern(height, width, data, ruleData, p);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('Investigator')) {
        try {
            rule = rule.slice(0, -'Investigator'.length);
            let p = createPattern(rule === 'State' ? 'B3/S23' : rule, namedRules, height, width, data, undefined);
            // if (p.rule.states !== 2) {
            //     throw new RuleError('Investigator is only supported for 2-state rules');
            // }
            let ruleData: Rule = Object.assign({}, p.rule, {str: p.rule.str + 'Investigator', states: 21});
            return new InvestigatorPattern(height, width, data, ruleData, p);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('INTSeparator')) {
        try {
            let p = createPattern(rule.slice(0, -'INTSeparator'.length), namedRules, height, width, data, undefined);
            if (!(p instanceof MAPPattern && p.rule.symmetry === 'D8' && !p.trs[1])) {
                throw new RuleError(`INTSeparator is only supported for non-B01c INT rules!`);
            }
            p.rule.str += 'INTSeparator';
            return new INTSeparator(p, getKnots(p.trs));
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.endsWith('Separator')) {
        try {
            let p = createPattern(rule.slice(0, -'Separator'.length), namedRules, height, width, data, undefined);
            p.rule.str += 'Separator';
            return new Separator(p);
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.includes(':')) {
        try {
            let parts = rule.split(':');
            if (parts.length > 2) {
                throw new RuleError('Only 1 bounded grid specifier allowed');
            }
            let p = createPattern(parts[0], namedRules, height, width, data, prevName);
            let spec = parts[1];
            let type = spec[0];
            let [x, y] = spec.slice(1).split(',').map(x => Number(x));
            if (Number.isNaN(x) || Number.isNaN(y)) {
                throw new RuleError(`Invalid bounded grid specifier: '${parts[1]}'`);
            }
            let ruleData: Rule = Object.assign({}, p.rule, {str: `${p.rule.str}:${type}${x},${y}`});
            if (type === 'P') {
                if (x !== width || y !== height) {
                    let newData = new Uint8Array(x * y);
                    let i = 0;
                    for (let y2 = 0; y2 < height; y2++) {
                        let loc = y2 * x;
                        for (let x2 = 0; x2 < width; x2++) {
                            newData[loc++] = data[i++];
                        }
                    }
                    data = newData;
                    height = y;
                    width = x;
                }
                return new FinitePattern(height, width, data, ruleData, p);
            } else if (type === 'T') {
                return new TorusPattern(y, x, height, width, p.getData(), ruleData, p);
            } else {
                throw new RuleError(`Invalid bounded grid specifier: '${parts[1]}'`);
            }
        } catch (error) {
            if (error instanceof RuleError) {
                errors.push(error.message);
            } else {
                throw error;
            }
        }
    }
    if (rule.includes('|')) {
        let patterns = rule.split('|').map(x => createPattern(x, namedRules, height, width, data, undefined));
        let str = patterns.map(x => x.rule.str).join('|');
        let states = 1;
        let symmetry: RuleSymmetry = 'D8';
        let period = patterns.length;
        let range = 0;
        let neighborhood: [number, number][] = [];
        for (let p of patterns) {
            states = Math.max(states, p.rule.states);
            symmetry = SYMMETRY_MEET[symmetry][p.rule.symmetry];
            period = lcm(period, p.rule.period);
            range = Math.max(range, p.rule.range);
            for (let [x, y] of p.rule.neighborhood) {
                if (!neighborhood.some(value => x === value[0] && y === value[1])) {
                    neighborhood.push([x, y]);
                }
            }
        }
        return new AlternatingPattern(height, width, data, {str, states, symmetry, period, range, neighborhood}, patterns);
    }
    let lower = rule.toLowerCase();
    if (namedRules && lower in namedRules) {
        return createPattern(namedRules[lower], namedRules, height, width, data, rule);
    }
    if (errors.length === 0) {
        throw new RuleError(`Cannot parse rule`);
    } else if (errors.length === 1) {
        throw new RuleError(errors[0]);
    } else {
        throw new RuleError(errors[0] + ', ' + errors.slice(1).map(x => x[0].toLowerCase() + x.slice(1)).join(', '))
    }
}

/** Parses a RLE.
 * @param namedRules An object mapping aliases to rules.
*/
export function parse(rle: string, namedRules?: {[key: string]: string}, preserveSizes: boolean = false): Pattern {
    let rule = 'B3/S23';
    let height: number | undefined = undefined;
    let width: number | undefined = undefined;
    let xOffset: number | undefined = undefined;
    let yOffset: number | undefined = undefined;
    let generation = 0;
    let data = '';
    let headerFound = false;
    for (let line of rle.trim().split('\n')) {
        line = line.trim();
        if (line.length === 0) {
            continue;
        } else if (headerFound) {
            data += line;
        } else if (line.startsWith('#')) {
            let char = line[1];
            if (char === 'C' || char === 'c') {
                if (line.startsWith('#CXRLE')) {
                    line = line.slice(3);
                    let index = line.indexOf('Pos=');
                    if (index !== -1) {
                        let data = line.slice(index + 4);
                        let [x, y] = data.split(',');
                        xOffset = Number(x);
                        yOffset = Number(y);
                    }
                    index = line.indexOf('Gen=');
                    if (index !== -1) {
                        generation = Number(line.slice(index + 4));
                    }
                }
            } else if (char === 'P' || char === 'p') {
                let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                xOffset = Number(x);
                yOffset = Number(y);
            } else if (char === 'r') {
                rule = line.slice(2);
            }
        } else {
            headerFound = true;
            line = line.trim();
            let match = line.match(/x\s*=\s*(\d+)\s*,?\s*y\s*=\s*(\d+)\s*,?\s*(?:rule\s*=\s*(.*))?/);
            if (!match) {
                throw new LifewebError(`Invalid header line: '${line}'`);
            }
            if (typeof match[1] === 'string') {
                width = parseInt(match[1]);
            }
            if (typeof match[2] === 'string') {
                height = parseInt(match[2]);
            }
            if (typeof match[3] === 'string') {
                rule = match[3];
            }
        }
    }
    let out = createPattern(rule, namedRules).loadRLE(data);
    if (xOffset !== undefined) {
        out.xOffset = xOffset;
    }
    if (yOffset !== undefined) {
        out.yOffset = yOffset;
    }
    out.generation = generation;
    if (preserveSizes && height !== undefined && width !== undefined) {
        out.ensure(width, height);
    }
    return out;
}

/** Parses a RLE, but also supports legacy formats like Life 1.05.
 * @param namedRules An object mapping aliases to rules.
*/
export function parseWithCompatibility(rle: string, namedRules?: {[key: string]: string}): Pattern {
    let lines = rle.trim().split('\n');
    let raw: number[][] = [];
    let rule = 'B3/S23';
    let xOffset: number | null = null;
    let yOffset: number | null = null;
    let generation = 0;
    if (lines[0].startsWith('#L') && (lines[0] === '#Life 1.05' || lines[0] === '#Life 1.06')) {
        if (lines[0] === '#Life 1.05') {
            for (let line of lines.slice(1)) {
                if (line.startsWith('#')) {
                    let char = line[1];
                    if (char === 'P' || char === 'p') {
                        let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                        xOffset = Number(x);
                        yOffset = Number(y);
                    } else if (char === 'R' || char === 'r') {
                        rule = line.slice(2);
                    } else {
                        raw.push(Array.from(line).map(x => x === '*' ? 1 : 0));
                    }
                }
            }
        } else {
            xOffset = 0;
            yOffset = 0;
            for (let line of lines.slice(1)) {
                let [xStr, yStr] = line.split(' ');
                let x = Number(xStr) + xOffset;
                let y = Number(yStr) + yOffset;
                while (y < 0) {
                    yOffset--;
                    y++;
                    raw.unshift([]);
                }
                while (y > raw.length) {
                    raw.push([]);
                }
                while (x < 0) {
                    xOffset--;
                    x++;
                    raw.forEach(x => x.unshift(0));
                }
                let row = raw[y];
                while (row.length < x - 1) {
                    row.push(0);
                }
                row.push(1);
            }
        }
    } else if (lines[0].startsWith('!')) {
        for (let line of lines) {
            if (line.startsWith('!')) {
                continue;
            } else {
                raw.push(Array.from(line).map(x => x === 'O' ? 1 : 0));
            }
        }
    } else {
        return parse(rle, namedRules);
    }
    while (raw.length > 0 && raw[raw.length - 1].length === 0) {
        raw.pop();
    }
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
    let out = createPattern(rule, namedRules, height, width, data, undefined);
    if (xOffset !== null) {
        out.xOffset = xOffset;
    }
    if (yOffset !== null) {
        out.yOffset = yOffset;
    }
    out.generation = generation;
    return out;
}


/** Gets the black/white reversal of a rule, if available. */
export function getBlackWhiteReversal(rule: string): string {
    let p = createPattern(rule);
    if (p instanceof MAPPattern || p instanceof MAPGenPattern || p instanceof MAPB0Pattern) {
        let trs: Uint8Array;
        if ('trs' in p) {
            trs = p.trs.map(x => 1 - x).reverse();
        } else {
            trs = p.evenTrs.reverse();
        }
        return unparseMAPRuleFull(trs, p.rule.states);
    } else if (p instanceof HROTPattern || p instanceof HROTB0Pattern) {
        let b: Uint8Array;
        let s: Uint8Array;
        if (p instanceof HROTPattern) {
            b = p.s.map(x => 1 - x).reverse();
            s = p.b.map(x => 1 - x).reverse();
        } else {
            b = p.evenS.slice().reverse();
            s = p.evenB.slice().reverse();
        }
        let out = `R${p.rule.range},C${p.rule.states},S${unparseHROTRanges(s)},B${unparseHROTRanges(b)}`;
        if (p.nh) {
            out += ',NW';
            if (p.nh.every(x => x > -9 && x < 8)) {
                out += Array.from(p.nh).map(x => (x < 0 ? x + 16 : x).toString(16)).join('');
            } else {
                out += Array.from(p.nh).map(x => (x < 0 ? x + 256 : x).toString(16).padStart(2, '0')).join('');
            }
        }
        return out;
    } else if (p instanceof HistoryPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -'History'.length)) + 'History';
    } else if (p instanceof SuperPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -'Super'.length)) + 'Super';
    } else if (p instanceof InvestigatorPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -'Investigator'.length)) + 'Investigator';
    } else if (p instanceof FinitePattern || p instanceof TorusPattern) {
        let index = p.rule.str.lastIndexOf(':');
        return getBlackWhiteReversal(p.rule.str.slice(0, index)) + p.rule.str.slice(index);
    } else if (p instanceof TreePattern) {
        throw new LifewebError(`Black/white reversal is not supported for RuleLoader`);
    } else if (p instanceof AlternatingPattern) {
        return p.rule.str.split('|').map(getBlackWhiteReversal).join('|');
    } else {
        throw new LifewebError(`Unknown pattern: '${p}'`);
    }
}


// let base = createPattern('B3/S23');
// let displayP = createPattern('B3/S23Super');
// for (let rle of ['6b2o$2bobo2bo$bob2obo$bo4b2o$2ob2o$3b2ob2o$2o4bo$bob2obo$o2bobo$2o!', '2o$2o2$4o$o2bo!']) {
//     console.log('\n');
//     let p = base.loadRLE(rle);
//     let sep = new Separator(p);
//     displayP.setData(sep.height, sep.width, new Uint8Array(sep.groups));
//     console.log('before:\n' + displayP.toRLE() + '\n');
//     sep.resolveKnots();
//     displayP.setData(sep.height, sep.width, new Uint8Array(sep.groups));
//     console.log('\nafter:\n' + displayP.toRLE());
// }
// console.log('\n');

// let p = createPattern(`
// @RULE Test
// @TABLE
// n_states: 2
// neighborhood: Moore
// symmetries: permute
// 0, 1,1,1,0,0,0,0,0, 1
// 1, 1,1,0,0,0,0,0,0, 1
// 1, 1,1,1,0,0,0,0,0, 1
// `).loadRLE('bo$2bo$3o!');
// p.rule.str = 'Test';
// console.log(p.toRLE());
// p.runGeneration();
// console.log(p.toRLE());
