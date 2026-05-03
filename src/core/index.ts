
/* The main file, exporting everything and also implementing many utility functions. */

import {RuleError, lcm} from './util.js';
import {SYMMETRY_MEET, COORD_BIAS as BIAS, COORD_WIDTH as WIDTH, Rule, Pattern, DataPattern, CoordPattern, RuleSymmetry} from './pattern.js';
import {TRANSITIONS, VALID_TRANSITIONS, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, unparseTransitions, arrayToTransitions, unparseMAP, MAPPattern, MAPB0Pattern, MAPGenPattern, MAPGenB0Pattern, createMAPPattern} from './map.js';
import {unparseHROTRanges, HROTPattern, HROTB0Pattern, createHROTPattern} from './hrot.js';
import {DataHistoryPattern, CoordHistoryPattern, DataSuperPattern, CoordSuperPattern, InvestigatorPattern} from './super.js';
import {FiniteDataPattern, FiniteCoordPattern, TorusDataPattern, TorusCoordPattern} from './bounded.js';
import {AlternatingPattern} from './alternating.js';
import {parseAtRule, TreePattern} from './ruleloader.js';

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
export * from './sep.js';
export * from './catagolue.js';
export * from './conduits.js';


/** Creates a pattern from a rulestring.
 * @param namedRules An object mapping aliases to rules.
 */
export function createPattern(rule: string, namedRules?: {[key: string]: string}, height: number = 0, width: number = 0, data: Uint8Array = new Uint8Array(0), prevName?: string): Pattern {
    rule = rule.trim();
    if (rule.toLowerCase() === 'Life' && !(namedRules && 'life' in namedRules)) {
        return createPattern('B3/S23', namedRules, height, width, data, prevName);
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
            let out = parseAtRule(rule);
            let coords = new Map<number, number>();
            let i = 0;
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let value = data[i++];
                    if (value) {
                        coords.set((x + BIAS) * WIDTH + (y + BIAS), value);
                    }
                }
            }
            let range = out.tree.range;
            let neighborhood: [number, number][] = [];
            i = 0;
            for (let y = -range; y <= range; y++) {
                for (let x = -range; x <= range; x++) {
                    if (out.tree.neighborhood[i++] !== 0) {
                        neighborhood.push([x, y]);
                    }
                }
            }
            return new TreePattern(coords, {
                str: prevName ?? rule,
                states: out.tree.states,
                symmetry: 'C1',
                period: 1,
                range,
                neighborhood,
            }, out.tree.neighborhood, out.tree.data, out);
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
            let p = createPattern(rule.slice(0, -7), namedRules, height, width, data, undefined);
            if (p.rule.states !== 2) {
                throw new RuleError('History is only supported for 2-state rules');
            }
            let ruleData: Rule = Object.assign({}, p.rule, {str: p.rule.str + 'History', states: 7});
            if (p instanceof DataPattern) {
                return new DataHistoryPattern(height, width, data, ruleData, p);
            } else if (p instanceof CoordPattern) {
                return new CoordHistoryPattern(p.coords, ruleData, p);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
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
            let p = createPattern(rule.slice(0, -5), namedRules, height, width, data, undefined);
            if (p.rule.states !== 2) {
                throw new RuleError('Super is only supported for 2-state rules');
            }
            let ruleData: Rule = Object.assign({}, p.rule, {str: p.rule.str + 'Super', states: 26})
            if (p instanceof DataPattern) {
                return new DataSuperPattern(height, width, data, ruleData, p);
            } else if (p instanceof CoordPattern) {
                return new CoordSuperPattern(p.coords, ruleData, p);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
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
            let p = createPattern(rule.slice(0, -12) === 'State' ? 'B3/S23' : rule.slice(0, -12), namedRules, height, width, data, undefined);
            if (p.rule.states !== 2) {
                throw new RuleError('Investigator is only supported for 2-state rules');
            }
            if (p instanceof DataPattern) {
                return new InvestigatorPattern(height, width, data, Object.assign({}, p.rule, {str: p.rule.str + 'Investigator', states: 21}), p);
            } else if (p instanceof CoordPattern) {
                throw new RuleError(`Investigator is not supported for CoordPatterns`);
            } else {
                throw new RuleError(`Unknown Pattern subclass: ${p}`);
            }
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
                if (p instanceof CoordPattern) {
                    return new FiniteCoordPattern(p.coords, ruleData, p, x, y);
                } else {
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
                    return new FiniteDataPattern(height, width, data, ruleData, p);
                }
            } else if (type === 'T') {
                // if (p instanceof CoordPattern) {
                //     return new TorusCoordPattern(p.coords, ruleData, p, x, y);
                // } else {
                    return new TorusDataPattern(y, x, height, width, p.getData(), ruleData, p);
                // }
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
    throw new RuleError(errors.join(', '));
}

/** Parses a RLE. 
 * @param namedRules An object mapping aliases to rules.
*/
export function parse(rle: string, namedRules?: {[key: string]: string}): Pattern {
    let rule = 'B3/S23';
    let xOffset: number | null = null;
    let yOffset: number | null = null;
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
            if (line[0] !== 'x') {
                data += line;
            } else {
                let match = line.match(/x\s*=\s*\d+\s*,?\s*y\s*=\s*\d+\s*,?\s*(?:rule\s*=\s*(.*))?/);
                if (!match) {
                    throw new Error(`Invaid header line: '${line}'`);
                }
                if (match[1]) {
                    rule = match[1];
                }
            }
        }
    }
    let out = createPattern(rule, namedRules).loadRLE(data);
    if (xOffset !== null) {
        out.xOffset = xOffset;
    }
    if (yOffset !== null) {
        out.yOffset = yOffset;
    }
    out.generation = generation;
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
    if (p instanceof MAPPattern || p instanceof MAPGenPattern || p instanceof MAPB0Pattern || p instanceof MAPGenB0Pattern) {
        let trs: Uint8Array;
        if ('trs' in p) {
            trs = p.trs.map(x => 1 - x).reverse();
        } else {
            trs = p.evenTrs.reverse();
        }
        if (p.rule.symmetry === 'D8') {
            let bStr: string;
            let sStr: string;
            if (rule.endsWith('H')) {
                let [bTrs, sTrs] = arrayToTransitions(trs, HEX_TRANSITIONS);
                bStr = unparseTransitions(bTrs, VALID_HEX_TRANSITIONS, true);
                sStr = unparseTransitions(sTrs, VALID_HEX_TRANSITIONS, true);
            } else {
                let [bTrs, sTrs] = arrayToTransitions(trs, TRANSITIONS);
                bStr = unparseTransitions(bTrs, VALID_TRANSITIONS, true);
                sStr = unparseTransitions(sTrs, VALID_TRANSITIONS, true);
            }
            if (p instanceof MAPGenPattern || p instanceof MAPGenB0Pattern) {
                return `${sStr}/${bStr}/${p.rule.states}`;
            } else {
                return `B${bStr}/S${sStr}`;
            }
        } else {
            return 'MAP' + unparseMAP(trs);
        }
    } else if (p instanceof HROTPattern || p instanceof HROTB0Pattern) {
        let b: Uint8Array;
        let s: Uint8Array;
        if (p instanceof HROTPattern) {
            b = p.s.map(x => 1 - x).reverse();
            s = p.b.map(x => 1 - x).reverse();
        } else {
            b = p.evenS.toReversed();
            s = p.evenB.toReversed();
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
    } else if (p instanceof DataHistoryPattern || p instanceof CoordHistoryPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -7)) + 'History';
    } else if (p instanceof DataSuperPattern || p instanceof CoordSuperPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -5)) + 'Super';
    } else if (p instanceof InvestigatorPattern) {
        return getBlackWhiteReversal(p.rule.str.slice(0, -12)) + 'Investigator';
    } else if (p instanceof FiniteDataPattern || p instanceof FiniteCoordPattern || p instanceof TorusDataPattern || p instanceof TorusCoordPattern) {
        let index = p.rule.str.lastIndexOf(':');
        return getBlackWhiteReversal(p.rule.str.slice(0, index)) + p.rule.str.slice(index);
    } else if (p instanceof TreePattern) {
        throw new RuleError(`Black/white reversal is not supported for RuleLoader`);
    } else if (p instanceof AlternatingPattern) {
        return p.rule.str.split('|').map(getBlackWhiteReversal).join('|');
    } else {
        throw new Error(`Unknown pattern: '${p.constructor.name}'`);
    }
}
