
import {stringMD5} from './md5.js';
import {Pattern, RuleError} from './pattern.js';
import {MAPPattern, MAPGenPattern, MAPB0Pattern, MAPB0GenPattern, TRANSITIONS, VALID_TRANSITIONS, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, arrayToTransitions, unparseTransitions, unparseMAP} from './map.js';
import {AlternatingPattern} from './alternating.js';


export interface Identified {
    apgcode: string;
    stabilizedAt: number;
    period: number;
    disp?: [number, number];
    linear?: boolean;
    power?: number;
    pops: number[];
    hashes: number[];
    phases: Pattern[];
}

export type PartialIdentified = Omit<Identified, 'rle' | 'apgcode' | 'desc' | 'min' | 'max'>;


export function findType(p: Pattern, limit: number, acceptStabilized: boolean = true): PartialIdentified {
    p.shrinkToFit();
    let phases: Pattern[] = [p.copy()];
    let pops: number[] = [p.population];
    let hashes: number[] = [p.hash32()];
    for (let i = 0; i < limit; i++) {
        p.runGeneration().shrinkToFit();
        let pop = p.population;
        let hash = p.hash32();
        if (pop === 0) {
            return {period: 1, stabilizedAt: i, disp: [0, 0], pops: [0], hashes: [hash], phases: [p.copy()]};
        }
        for (let j = 0; j <= (acceptStabilized ? i : 0); j++) {
            if (hash === hashes[j] && pop === pops[j]) {
                let q = phases[j];
                if (p.height !== q.height || p.width !== q.width || !p.data.every((x, i) => x === q.data[i])) {
                    continue;
                }
                return {
                    period: i - j + 1,
                    stabilizedAt: j,
                    disp: [p.xOffset - q.xOffset, p.yOffset - q.yOffset],
                    pops,
                    hashes,
                    phases,
                };
            }
        }
        phases.push(p.copy());
        pops.push(pop);
        hashes.push(hash);
    }
    for (let period = 1; period < pops.length; period++) {
        let diffs: number[] = [];
        let prev = pops[0];
        for (let i = period; i < pops.length; i += period) {
            diffs.push(pops[i] - prev);
            prev = pops[i];
        }
        if (diffs.length < 8) {
            continue;
        }
        for (let j = 0; j < diffs.length - 7; j++) {
            if (diffs[j] > 0 && diffs.slice(j + 1).every(x => x === diffs[j])) {
                return {linear: true, period, stabilizedAt: j, pops, hashes, phases};
            }
        }
    }
    return {stabilizedAt: -1, period: -1, pops, hashes, phases};
}


export function identify(p: Pattern, limit: number, acceptStabilized: boolean = true): Identified {
    p = p.copy();
    let type = findType(p, limit, acceptStabilized);
    let apgcode: string;
    if (type.disp) {
        let prefix: string;
        if (type.disp[0] === 0 && type.disp[1] === 0) {
            if (type.period === 1) {
                let cells = type.pops[type.pops.length - 1];
                if (cells === 0) {
                    return {apgcode: 'xs0_0', ...type};
                }
                prefix = 'xs' + cells;
            } else {
                prefix = 'xp' + type.period;
            }
        } else {
            prefix = 'xq' + type.period;
        }
        apgcode = p.toCanonicalApgcode(type.period, prefix);
    } else if (type.linear) {
        let diffs = type.pops.slice(0, -1).map((x, i) => type.pops[i + type.period] - x);
        let subperiod = -1;
        for (let i = 1; i < limit; i++) {
            let found = true;
            for (let j = 0; j < diffs.length - j; j++) {
                if (diffs[j] !== diffs[j + i]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                subperiod = i;
                break;
            }
        }
        if (subperiod === -1) {
            apgcode = 'PATHOLOGICAL';
        } else {
            let moment0 = 0;
            let moment1 = 0;
            let moment2 = 0;
            for (let i = 0; i < type.period; i++) {
                let diff = type.pops[i + subperiod] - type.pops[i];
                moment0 += diff;
                moment1 += diff**2;
                moment2 += diff**3;
            }
            let str = moment1 + '#' + moment2;
            let array = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                array[i] = str.charCodeAt(i);
            }
            apgcode = `yl${type.period}_${subperiod}_${moment0}_${stringMD5(moment1 + '#' + moment2)}`;
        }
    } else {
        let tx = 0;
        let ty = 0;
        let txy = 0;
        let tx2 = 0;
        for (let i = 0; i < type.pops.length; i++) {
            let x = Math.log(i + 1);
            let y = Math.log(type.pops[i]);
            tx += x;
            ty += y;
            txy += x * y;
            tx2 += x**2;
        }
        let power = (type.pops.length * txy - tx * ty) / (type.pops.length * tx2 - tx**2);
        type.power = power;
        if (power < 1.15) {
            apgcode = 'PATHOLOGICAL';
        } else if (power < 1.65) {
            apgcode = 'zz_REPLICATOR';
        } else if (power < 2.1) {
            apgcode = 'zz_LINEAR';
        } else if (power < 2.9) {
            apgcode = 'zz_EXPLOSIVE';
        } else {
            apgcode = 'zz_QUADRATIC';
        }
    }
    return {apgcode, ...type};
}


function verifyType(p: Pattern, type: PartialIdentified, limit: number): boolean {
    for (let i = 0; i < (type.period > 0 ? type.period : limit) + 1; i++) {
        if (p.hash32() !== type.hashes[i] || p.population !== type.pops[i]) {
            return false;
        }
        let q = type.phases[i];
        if (p.height !== q.height || p.width !== q.width || !p.data.every((x, i) => x === q.data[i])) {
            return false;
        }
        p.runGeneration().shrinkToFit();
    }
    return true;
}

function isotropicMinmax(p: MAPPattern | MAPGenPattern, type: PartialIdentified, allTrs: {[key: string]: number[]}, limit: number): {minB: string[], minS: string[], maxB: string[], maxS: string[]} {
    let [b, s] = arrayToTransitions(p.trs, allTrs);
    let minB = new Set(b);
    let minS = new Set(s);
    let maxB = new Set(b);
    let maxS = new Set(s);
    for (let tr in allTrs) {
        let q = p.copy();
        q.trs = new Uint8Array(q.trs);
        if (minB.has(tr)) {
            for (let i of allTrs[tr]) {
                q.trs[i] = 0;
            }
            if (verifyType(q, type, limit)) {
                minB.delete(tr);
            }
        } else {
            for (let i of allTrs[tr]) {
                q.trs[i] = 1;
            }
            if (verifyType(q, type, limit)) {
                maxB.add(tr);
            }
        }
        q = p.copy();
        q.trs = new Uint8Array(q.trs);
        if (minS.has(tr)) {
            for (let i of allTrs[tr]) {
                q.trs[i | (1 << 4)] = 0;
            }
            if (verifyType(q, type, limit)) {
                minS.delete(tr);
            }
        } else {
            for (let i of allTrs[tr]) {
                q.trs[i | (1 << 4)] = 1;
            }
            if (verifyType(q, type, limit)) {
                maxS.add(tr);
            }
        }
    }
    return {
        minB: Array.from(minB),
        minS: Array.from(minS),
        maxB: Array.from(maxB),
        maxS: Array.from(maxS),
    };
}

function mapStringMinmax(p: MAPPattern | MAPGenPattern, type: PartialIdentified, limit: number): [string, string] {
    let min = p.trs.slice();
    let max = p.trs.slice();
    for (let i = 0; i < 512; i++) {
        let q = p.copy();
        q.trs[i] = q.trs[i] ? 0 : 1;
        if (verifyType(q, type, limit)) {
            if (q.trs[i]) {
                min[i] = 0;
            } else {
                max[i] = 1;
            }
        }
        q.trs[i] = q.trs[i] ? 0 : 1;
    }
    return [unparseMAP(min), unparseMAP(max)];
}

function mapMinmax(p: MAPPattern | MAPGenPattern, type: PartialIdentified, limit: number): [string, string] {
    p.shrinkToFit();
    let minB: string;
    let minS: string;
    let maxB: string;
    let maxS: string;
    if (p.ruleStr.endsWith('H')) {
        let data = isotropicMinmax(p, type, HEX_TRANSITIONS, limit);
        minB = unparseTransitions(data.minB, VALID_HEX_TRANSITIONS, true);
        minS = unparseTransitions(data.minS, VALID_HEX_TRANSITIONS, true);
        maxB = unparseTransitions(data.maxB, VALID_HEX_TRANSITIONS, true);
        maxS = unparseTransitions(data.maxS, VALID_HEX_TRANSITIONS, true);
    } else if (p.ruleStr.startsWith('MAP')) {
        let [min, max] = mapStringMinmax(p, type, limit);
        if (p instanceof MAPGenPattern) {
            min += '/' + p.states;
            max += '/' + p.states;
        }
        return [min, max];
    } else {
        let data = isotropicMinmax(p, type, TRANSITIONS, limit);
        minB = unparseTransitions(data.minB, VALID_TRANSITIONS, true);
        minS = unparseTransitions(data.minS, VALID_TRANSITIONS, true);
        maxB = unparseTransitions(data.maxB, VALID_TRANSITIONS, true);
        maxS = unparseTransitions(data.maxS, VALID_TRANSITIONS, true);
    }
    let min: string;
    let max: string;
    if (p instanceof MAPPattern) {
        min = `B${minB}/S${minS}`;
        max = `B${maxB}/S${maxS}`;
    } else {
        min = `${minS}/${minB}/${p.states}`;
        max = `${maxS}/${maxB}/${p.states}`;
    }
    if (p.ruleStr.endsWith('H')) {
        min += 'H';
        max += 'H';
    }
    return [min, max];
}

export function findMinmax(p: Pattern, type: PartialIdentified, limit: number): [string, string] {
    let q = type.phases[type.phases.length - 1].copy();
    q.runGeneration().shrinkToFit();
    type.pops.push(q.population);
    type.hashes.push(q.hash32());
    type.phases.push(q);
    if (p instanceof MAPPattern || p instanceof MAPGenPattern) {
        return mapMinmax(p, type, limit);
    } else if (p instanceof MAPB0Pattern || p instanceof MAPB0GenPattern) {
        throw new RuleError('Min/max is not supported for B0 rules');
    } else if (p instanceof AlternatingPattern) {
        throw new RuleError('Min/max is not supported for alternating rules');
    } else {
        throw new RuleError(`Unknown Pattern subclass: ${p}`);
    }
}


export interface LinearInfo {
    period: number;
    disp: [number, number];
    ash: Pattern;
}

export function classifyLinear(p: Pattern, type: PartialIdentified, maxPeriodMul: number): null | LinearInfo {
    p = p.copy().run(type.stabilizedAt);
    let engine = p.copy();
    let width = engine.width;
    let height = engine.height;
    for (let i = 0; i < maxPeriodMul; i++) {
        p.run(type.period).shrinkToFit();
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let j = 0;
                let k = y * p.width + x;
                let found = true;
                for (let row = 0; row < height; row++) {
                    let engineRow = engine.data.slice(j, j + width);
                    let dataRow = p.data.slice(k, k + width);
                    if (!engineRow.every((x, i) => !x || x === dataRow[i])) {
                        found = false;
                        break;
                    }
                    j += width;
                    k += p.width;
                }
                if (found) {
                    let xDisp = x + p.xOffset;
                    let yDisp = y + p.yOffset;
                    let ash = p.copy();
                    for (let y2 = 0; y2 < height; y2++) {
                        for (let x2 = 0; x2 < width; x2++) {
                            if (engine.data[y2 * width + x2]) {
                                ash.data[(y2 + y) * ash.width + (x2 + x)] = 0;
                            }
                        }
                    }
                    ash.shrinkToFit();
                    return {period: (i + 1) * type.period, disp: [xDisp, yDisp], ash};
                }
            }
        }
    }
    return null;
}


export interface OscillatorInfo {
    heat: number;
    temperature: number;
    volatility: number;
    strictVolatility: number;
}

export function findOscillatorInfo(type: PartialIdentified): number | OscillatorInfo {
    let period = type.period;
    let oldPhases = type.phases.slice(0, period);
    let phases: Uint8Array[] = [];
    let minX = Math.min(...oldPhases.map(p => p.xOffset));
    let minY = Math.min(...oldPhases.map(p => p.yOffset));
    let maxX = Math.max(...oldPhases.map(p => p.xOffset + p.width));
    let maxY = Math.max(...oldPhases.map(p => p.yOffset + p.height));
    let height = maxY - minY + 1;
    let width = maxX - minX + 1;
    let size = height * width;
    for (let phase of oldPhases) {
        let p = phase.copy();
        let up = p.yOffset - minY;
        let down = height - p.height - up;
        if (down < 0) {
            down = 0;
        }
        let left = p.xOffset - minX;
        let right = width - p.width - left;
        if (right < 0) {
            right = 0;
        }
        p.expand(up, down, left, right);
        phases.push(p.data);
    }
    let totalHeat = 0;
    for (let i = 0; i < period; i++) {
        let p = phases[i];
        let q = phases[(i + 1) % period];
        let heat = 0;
        for (let i = 0; i < p.length; i++) {
            if (p[i] !== q[i]) {
                heat++;
            }
        }
        totalHeat += heat;
    }
    let heat = totalHeat / type.period;
    if (!type.disp || (type.disp[0] !== 0 || type.disp[1] !== 0)) {
        return heat;
    }
    let cellHistories: Uint8Array[] = [];
    for (let i = 0; i < size; i++) {
        cellHistories.push(new Uint8Array(period));
    }
    for (let i = 0; i < type.period; i++) {
        for (let j = 0; j < size; j++) {
            cellHistories[j][i] = phases[i][j];
        }
    }
    let activeCells = cellHistories.map<number>(x => x.some(y => y) ? 1 : 0).reduce((x, y) => x + y);
    let statorCells = 0;
    let strictCells = 0;
    let factors: number[] = [];
    for (let i = 2; i < Math.ceil(Math.sqrt(period)); i++) {
        if (period % i === 0) {
            factors.push(period);
        }
        if (i**2 !== period) {
            factors.push(period / i);
        }
    }
    for (let i = 0; i < size; i++) {
        let data = cellHistories[i];
        if (data.every(x => x === 0)) {
            continue;
        } else if (data.every(x => x > 0)) {
            statorCells++;
        } else {
            let isStrict = true;
            for (let p of factors) {
                let found = true;
                for (let i = 0; i < data.length - p; i++) {
                    if (data[i] !== data[i + p]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    isStrict = false;
                    break;
                }
            }
            if (isStrict) {
                strictCells++;
            }
        }
    }
    let temperature = heat / activeCells;
    let volatility = (activeCells - statorCells) / activeCells;
    let strictVolatility = strictCells / activeCells;
    return {heat, temperature, volatility, strictVolatility};
}


export interface FullIdentified {
    apgcode: string;
    stabilizedAt: number;
    desc: string;
    linear?: boolean;
    period: number;
    disp?: [number, number];
    output?: FullIdentified;
    power?: number;
    pops: number[];
    hashes: number[];
    phases: Pattern[];
    heat?: number;
    temperature?: number;
    volatility?: number;
    strictVolatility?: number;
    minmax?: [string, string];
}

export function fullIdentify(p: Pattern, limit: number, maxPeriodMul: number = 8): FullIdentified {
    p = p.copy().shrinkToFit();
    let type = identify(p, limit);
    let minmax: [string, string] | undefined = undefined;
    try {
        minmax = findMinmax(p, type, limit);
    } catch (error) {
        if (!(error instanceof RuleError)) {
            throw error;
        }
    }
    let oscInfo: Partial<OscillatorInfo> = {};
    if (type.disp) {
        // @ts-ignore
        let data = findOscillatorInfo(type);
        if (typeof data === 'number') {
            oscInfo = {heat: data};
        } else {
            oscInfo = data;
        }
    }
    let output: FullIdentified | undefined = undefined;
    if (type.linear) {
        let data = classifyLinear(p, type, maxPeriodMul);
        if (data) {
            type.period = data.period;
            type.disp = data.disp;
            output = fullIdentify(data.ash, limit, maxPeriodMul);
        }
    }
    let desc: string;
    if (type.linear) {
        if (type.disp) {
            if (type.disp[0] === 0 && type.disp[1] === 0) {
                desc = `p${type.period} gun`;
            } else {
                desc = `(${type.disp[0]}, ${type.disp[1]})c/${type.period} puffer`;
            }
        } else {
            desc = `p${type.period} linear growth`;
        }
    } else if (type.disp) {
        if (type.disp[0] === 0 && type.disp[1] === 0) {
            if (type.period === 1) {
                desc = `${type.pops[type.pops.length - 1]}-cell still life`;
            } else {
                desc = `p${type.period} oscillator`;
            }
        } else {
            desc = `(${type.disp[0]}, ${type.disp[1]})c/${type.period} spaceship`;
        }
    } else {
        desc = 'cannot identify';
    }
    return {...type, minmax, output, desc, ...oscInfo};
}
