
import {stringMD5} from './md5.js';
import {Pattern, RuleError} from './pattern.js';
import {MAPPattern, MAPGenPattern, MAPB0Pattern, MAPB0GenPattern, TRANSITIONS, VALID_TRANSITIONS, HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, arrayToTransitions, unparseTransitions, unparseMAP} from './map.js';
import {unparseHROTRanges, HROTPattern, HROTB0Pattern} from './hrot.js';
import {AlternatingPattern} from './alternating.js';
import {TreePattern} from './ruleloader.js';


export interface PhaseData {
    pops: number[];
    hashes: number[];
    phases: Pattern[];
}

export interface Identified extends PhaseData {
    apgcode: string;
    stabilizedAt: number;
    period: number;
    disp?: [number, number];
    linear?: boolean;
    power?: number;
}

export type PartialIdentified = Omit<Identified, 'rle' | 'apgcode' | 'desc' | 'min' | 'max'>;


export function findType(p: Pattern, limit: number, acceptStabilized: boolean = true): PartialIdentified {
    p.shrinkToFit();
    let phases: Pattern[] = [p.copy()];
    let pops: number[] = [p.population];
    let hashes: number[] = [p.hash32()];
    for (let i = 0; i < limit; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let pop = p.population;
        let hash = p.hash32();
        if (pop === 0) {
            for (let j = 0; j < p.rulePeriod; j++) {
                phases.push(p.copy());
            }
            return {period: p.rulePeriod, stabilizedAt: i, disp: [0, 0], pops: [0], hashes: [hash], phases};
        }
        if ((i + 1) % p.rulePeriod === 0) {
            for (let j = 0; j <= (acceptStabilized ? i : 0); j += p.rulePeriod) {
                if (hash === hashes[j] && pop === pops[j]) {
                    let q = phases[j];
                    if (!p.isEqualWithTranslate(q)) {
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
        let diffs = type.pops.slice(type.stabilizedAt, -type.period).map((x, i) => type.pops[type.stabilizedAt + i + type.period] - x);
        let subperiod: number | null = null;
        for (let i = 1; i < type.period; i++) {
            let found = true;
            for (let j = 0; j < diffs.length - i - 1; j++) {
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
        if (subperiod === null) {
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
        let data: [number, number][] = [];
        let totalI = 0;
        let pop = 0;
        for (let i = 0; i < type.pops.length; i++) {
            let x = Math.log(i + 1);
            totalI += x;
            pop += type.pops[i];
            data.push([x, Math.log(pop)]);
        }
        let meanI = totalI / data.length;
        let meanPop = pop / type.pops.length;
        let a = 0;
        let b = 0;
        for (let [x, y] of data) {
            a += (x - meanI) * (y - meanPop);
            b += (x - meanI) ** 2;
        }
        let power = a / b;
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


function verifyType(p: Pattern, data: PhaseData, gens: number, step: number): boolean {
    for (let i = 0; i < gens + 1; i++) {
        if (p.hash32() !== data.hashes[i] || p.population !== data.pops[i]) {
            return false;
        }
        let q = data.phases[i];
        if (!p.isEqualWithTranslate(q)) {
            return false;
        }
        p.run(step);
        p.shrinkToFit();
    }
    return true;
}

function isotropicMinmax(p: MAPPattern | MAPGenPattern, data: PhaseData, gens: number, step: number, allTrs: {[key: string]: number[]}): {minB: string[], minS: string[], maxB: string[], maxS: string[]} {
    let [b, s] = arrayToTransitions(p.trs, allTrs);
    let minB = new Set(b);
    let minS = new Set(s);
    let maxB = new Set(b);
    let maxS = new Set(s);
    for (let tr in allTrs) {
        let q = p.copy();
        q.trs = q.trs.slice();
        if (tr !== '0c') {
            if (minB.has(tr)) {
                for (let i of allTrs[tr]) {
                    q.trs[i] = 0;
                }
                if (verifyType(q, data, gens, step)) {
                    minB.delete(tr);
                }
            } else {
                for (let i of allTrs[tr]) {
                    q.trs[i] = 1;
                }
                if (verifyType(q, data, gens, step)) {
                    maxB.add(tr);
                }
            }
            q = p.copy();
            q.trs = q.trs.slice();
        }
        if (minS.has(tr)) {
            for (let i of allTrs[tr]) {
                q.trs[i | (1 << 4)] = 0;
            }
            if (verifyType(q, data, gens, step)) {
                minS.delete(tr);
            }
        } else {
            for (let i of allTrs[tr]) {
                q.trs[i | (1 << 4)] = 1;
            }
            if (verifyType(q, data, gens, step)) {
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

function isotropicB0Minmax(p: MAPB0Pattern | MAPB0GenPattern, data: PhaseData, gens: number, step: number, allTrs: {[key: string]: number[]}): {minB: string[], minS: string[], maxB: string[], maxS: string[]} {
    let [b, s] = arrayToTransitions(p.evenTrs.map(x => 1 - x), allTrs);
    b.push('0c');
    let minB = new Set(b);
    let minS = new Set(s);
    let maxB = new Set(b);
    let maxS = new Set(s);
    for (let tr in allTrs) {
        if (tr !== '0c') {
            let q = p.copy();
            q.evenTrs = q.evenTrs.slice();
            q.oddTrs = q.oddTrs.slice();
            if (minB.has(tr)) {
                for (let i of allTrs[tr]) {
                    q.evenTrs[i] = 1;
                    q.oddTrs[511 - i] = 0;
                }
                if (verifyType(q, data, gens, step)) {
                    minB.delete(tr);
                }
            } else {
                for (let i of allTrs[tr]) {
                    q.evenTrs[i] = 0;
                    q.oddTrs[511 - i] = 1;
                }
                if (verifyType(q, data, gens, step)) {
                    maxB.add(tr);
                }
            }
        }
        if (tr !== '8c') {
            let q = p.copy();
            q.evenTrs = q.evenTrs.slice();
            q.oddTrs = q.oddTrs.slice();
            if (minS.has(tr)) {
                for (let i of allTrs[tr]) {
                    q.evenTrs[i | (1 << 4)] = 1;
                    q.oddTrs[511 - (i | (1 << 4))] = 0;
                }
                if (verifyType(q, data, gens, step)) {
                    minS.delete(tr);
                }
            } else {
                for (let i of allTrs[tr]) {
                    q.evenTrs[i | (1 << 4)] = 0;
                    q.oddTrs[511 - (i | (1 << 4))] = 1;
                }
                if (verifyType(q, data, gens, step)) {
                    maxS.add(tr);
                }
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

function mapStringMinmax(p: MAPPattern | MAPGenPattern, data: PhaseData, gens: number, step: number): [string, string] {
    let min = p.trs.slice();
    let max = p.trs.slice();
    for (let i = 0; i < 512; i++) {
        let q = p.copy();
        q.trs[i] = 1 - q.trs[i];
        if (verifyType(q, data, gens, step)) {
            if (q.trs[i]) {
                min[i] = 0;
            } else {
                max[i] = 1;
            }
        }
        q.trs[i] = 1 - q.trs[i];
    }
    return [unparseMAP(min), unparseMAP(max)];
}

function mapB0StringMinmax(p: MAPB0Pattern | MAPB0GenPattern, data: PhaseData, gens: number, step: number): [string, string] {
    let min = p.evenTrs.map(x => 1 - x);
    let max = p.evenTrs.map(x => 1 - x);
    for (let i = 0; i < 512; i++) {
        let q = p.copy();
        q.evenTrs[i] = 1 - q.evenTrs[i];
        q.oddTrs[511 - i] = 1 - q.oddTrs[511 - i];
        if (verifyType(q, data, gens, step)) {
            if (q.evenTrs[i]) {
                min[i] = 1;
            } else {
                max[i] = 0;
            }
        }
        q.evenTrs[i] = 1 - q.evenTrs[i];
        q.oddTrs[511 - i] = 1 - q.oddTrs[511 - i];
    }
    return [unparseMAP(min), unparseMAP(max)];
}

function mapMinmax(p: MAPPattern | MAPB0Pattern | MAPGenPattern | MAPB0GenPattern, data: PhaseData, gens: number, step: number): [string, string] {
    p.shrinkToFit();
    let minB: string;
    let minS: string;
    let maxB: string;
    let maxS: string;
    let out: ReturnType<typeof isotropicMinmax>;
    if (p.ruleStr.endsWith('H')) {
        if (p instanceof MAPPattern || p instanceof MAPGenPattern) {
            out = isotropicMinmax(p, data, gens, step, HEX_TRANSITIONS);
        } else {
            out = isotropicB0Minmax(p, data, gens, step, HEX_TRANSITIONS);
        }
        minB = unparseTransitions(out.minB, VALID_HEX_TRANSITIONS, true);
        minS = unparseTransitions(out.minS, VALID_HEX_TRANSITIONS, true);
        maxB = unparseTransitions(out.maxB, VALID_HEX_TRANSITIONS, true);
        maxS = unparseTransitions(out.maxS, VALID_HEX_TRANSITIONS, true);
    } else if (p.ruleStr.startsWith('MAP')) {
        let min: string, max: string;
        if (p instanceof MAPPattern || p instanceof MAPGenPattern) {
            [min, max] = mapStringMinmax(p, data, gens, step);
        } else {
            [min, max] = mapB0StringMinmax(p, data, gens, step);
        }
        if (p instanceof MAPGenPattern) {
            min += '/' + p.states;
            max += '/' + p.states;
        }
        return [min, max];
    } else {
        if (p instanceof MAPPattern || p instanceof MAPGenPattern) {
            out = isotropicMinmax(p, data, gens, step, TRANSITIONS);
        } else {
            out = isotropicB0Minmax(p, data, gens, step, TRANSITIONS);
        }
        minB = unparseTransitions(out.minB, VALID_TRANSITIONS, false);
        minS = unparseTransitions(out.minS, VALID_TRANSITIONS, false);
        maxB = unparseTransitions(out.maxB, VALID_TRANSITIONS, false);
        maxS = unparseTransitions(out.maxS, VALID_TRANSITIONS, false);
    }
    let min: string;
    let max: string;
    if (p instanceof MAPPattern || p instanceof MAPB0Pattern) {
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

function otMinmax(p: MAPPattern | MAPGenPattern, minB: number[], minS: number[], data: PhaseData, gens: number, step: number, allTrs: {[key: string]: number[]}, validTrs: string[]): [number[], number[], number[], number[]] {
    let maxB = minB.slice();
    let maxS = minS.slice();
    for (let i = 0; i < validTrs.length; i++) {
        let q = p.copy();
        q.trs = q.trs.slice();
        if (i !== 0) {
            if (minB.includes(i)) {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.trs[tr] = 0;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    minB.splice(minB.indexOf(i), 1);
                }
            } else {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.trs[tr] = 1;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    maxB.push(i);
                }
            }
            q = p.copy();
            q.trs = q.trs.slice();
        }
        if (minS.includes(i)) {
            for (let letter of validTrs[i]) {
                for (let tr of allTrs[i + letter]) {
                    q.trs[tr | (1 << 4)] = 0;
                }
            }
            if (verifyType(q, data, gens, step)) {
                minS.splice(minS.indexOf(i), 1);
            }
        } else {
            for (let letter of validTrs[i]) {
                for (let tr of allTrs[i + letter]) {
                    q.trs[tr | (1 << 4)] = 1;
                }
            }
            if (verifyType(q, data, gens, step)) {
                maxS.push(i);
            }
        }
    }
    return [minB, minS, maxB, maxS];
}

function otB0Minmax(p: MAPB0Pattern | MAPB0GenPattern, minB: number[], minS: number[], data: PhaseData, gens: number, step: number, allTrs: {[key: string]: number[]}, validTrs: string[]): [number[], number[], number[], number[]] {
    let maxB = minB.slice();
    let maxS = minS.slice();
    for (let i = 0; i < validTrs.length; i++) {
        if (i !== 0) {
            let q = p.copy();
            q.evenTrs = q.evenTrs.slice();
            q.oddTrs = q.oddTrs.slice();
            if (minB.includes(i)) {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.evenTrs[tr] = 1;
                        q.oddTrs[511 - tr] = 0;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    minB.splice(minB.indexOf(i), 1);
                }
            } else {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.evenTrs[tr] = 0;
                        q.oddTrs[511 - tr] = 1;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    maxB.push(i);
                }
            }
        }
        if (i !== 8) {
            let q = p.copy();
            q.evenTrs = q.evenTrs.slice();
            q.oddTrs = q.oddTrs.slice();
            if (minS.includes(i)) {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.evenTrs[tr | (1 << 4)] = 1;
                        q.oddTrs[511 - (tr | (1 << 4))] = 0;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    minS.splice(minS.indexOf(i), 1);
                }
            } else {
                for (let letter of validTrs[i]) {
                    for (let tr of allTrs[i + letter]) {
                        q.evenTrs[tr | (1 << 4)] = 0;
                        q.oddTrs[511 - (tr | (1 << 4))] = 1;
                    }
                }
                if (verifyType(q, data, gens, step)) {
                    maxS.push(i);
                }
            }
        }
    }
    return [minB, minS, maxB, maxS];
}

function fullOTMinmax(p: MAPPattern | MAPB0Pattern | MAPGenPattern | MAPB0GenPattern, data: PhaseData, gens: number, step: number): [string, string] {
    let isHex = p.ruleStr.endsWith('H');
    let allTrs = isHex ? HEX_TRANSITIONS : TRANSITIONS;
    let validTrs = isHex ? VALID_HEX_TRANSITIONS : VALID_TRANSITIONS;
    if (isHex ? p.ruleSymmetry === 'D4x' : p.ruleSymmetry !== 'D8') {
        throw new Error(`Pattern must be in [Hexagonal] [Generations] [B0] INT for outer-totalistic minmax`);
    }
    let startB: number[] = [];
    let startS: number[] = [];
    let trs = 'trs' in p ? p.trs : p.evenTrs.map(x => 1 - x);
    for (let i = 0; i <= (isHex ? 6 : 8); i++) {
        let bFound = true;
        let sFound = true;
        for (let letter of validTrs[i]) {
            if (!trs[allTrs[i + letter][0]]) {
                bFound = false;
            }
            if (!trs[allTrs[i + letter][0] | (1 << 4)]) {
                sFound = false;
            }
        }
        if (bFound) {
            startB.push(i);
        }
        if (sFound) {
            startS.push(i);
        }
    }
    let outData: number[][] = [];
    if (p instanceof MAPPattern || p instanceof MAPGenPattern) {
        outData = otMinmax(p, startB, startS, data, gens, step, allTrs, validTrs);
    } else {
        outData = otB0Minmax(p, startB, startS, data, gens, step, allTrs, validTrs);
    }
    let [minB, minS, maxB, maxS] = outData.map(x => x.sort((x, y) => x - y).join(''));
    if (p instanceof MAPPattern || p instanceof MAPB0Pattern) {
        return [`B${minB}/S${minS}`, `B${maxB}/S${maxS}`];
    } else {
        return [`${minS}/${minB}/${p.states}`, `${maxS}/${maxB}/${p.states}`];
    }
}

function hrotMinmax(p: HROTPattern, data: PhaseData, gens: number, step: number): [string, string] {
    let parts = p.ruleStr.split(',');
    let min = `${parts[0]},${parts[1]},S`;
    let max = `${parts[0]},${parts[1]},S`;
    let minS = p.s.slice();
    let maxS = p.s.slice();
    for (let i = 0; i < minS.length; i++) {
        if (minS[i]) {
            p.s[i] = 0;
            if (verifyType(p, data, gens, step)) {
                minS[i] = 0;
            }
            p.s[i] = 1;
        } else {
            p.s[i] = 1;
            if (verifyType(p, data, gens, step)) {
                maxS[i] = 1;
            }
            p.s[i] = 0;
        }
    }
    min += unparseHROTRanges(minS) + ',B';
    max += unparseHROTRanges(maxS) + ',B';
    let minB = p.b.slice();
    let maxB = p.b.slice();
    for (let i = 1; i < minB.length; i++) {
        if (minB[i]) {
            p.b[i] = 0;
            if (verifyType(p, data, gens, step)) {
                minB[i] = 0;
            }
            p.b[i] = 1;
        } else {
            p.b[i] = 1;
            if (verifyType(p, data, gens, step)) {
                maxB[i] = 1;
            }
            p.b[i] = 0;
        }
    }
    min += unparseHROTRanges(minB);
    max += unparseHROTRanges(maxB);
    if (parts.length === 5) {
        min += ',' + parts[4];
        max += ',' + parts[4];
    }
    return [min, max];
}

function hrotB0Minmax(p: HROTB0Pattern, data: PhaseData, gens: number, step: number): [string, string] {
    let parts = p.ruleStr.split(',');
    let min = `${parts[0]},${parts[1]},S`;
    let max = `${parts[0]},${parts[1]},S`;
    let minS = p.evenS.map(x => 1 - x);
    let maxS = p.evenS.map(x => 1 - x);
    for (let i = 0; i < minS.length; i++) {
        if (minS[i]) {
            p.evenS[i] = 1;
            p.oddS[minS.length - 1 - i] = 0;
            if (verifyType(p, data, gens, step)) {
                minS[i] = 0;
            }
            p.evenS[i] = 0;
            p.oddS[minS.length - 1 - i] = 1;
        } else {
            p.evenS[i] = 0;
            p.oddS[minS.length - 1 - i] = 1;
            if (verifyType(p, data, gens, step)) {
                maxS[i] = 1;
            }
            p.evenS[i] = 1;
            p.oddS[minS.length - 1 - i] = 0;
        }
    }
    min += unparseHROTRanges(minS) + ',B';
    max += unparseHROTRanges(maxS) + ',B';
    let minB = p.evenB.map(x => 1 - x);
    let maxB = p.evenB.map(x => 1 - x);
    for (let i = 0; i < minB.length; i++) {
        if (minB[i]) {
            p.evenB[i] = 1;
            p.oddB[minB.length - 1 - i] = 0;
            if (verifyType(p, data, gens, step)) {
                minB[i] = 0;
            }
            p.evenB[i] = 0;
            p.oddB[minB.length - 1 - i] = 1;
        } else {
            p.evenB[i] = 0;
            p.oddB[minB.length - 1 - i] = 1;
            if (verifyType(p, data, gens, step)) {
                maxB[i] = 1;
            }
            p.evenB[i] = 1;
            p.oddB[minB.length - 1 - i] = 0;
        }
    }
    min += unparseHROTRanges(minB);
    max += unparseHROTRanges(maxB);
    if (parts.length === 5) {
        min += ',' + parts[4];
        max += ',' + parts[4];
    }
    return [min, max];
}

function alternatingMinmax(p: AlternatingPattern, data: PhaseData, gens: number, step: number, ot?: boolean): [string, string] {
    let min: string[] = [];
    let max: string[] = [];
    let count = p.patterns.length * step;
    for (let i = 0; i < count; i += step) {
        let q = p.patterns[i % p.patterns.length].copy();
        let phase = data.phases[i] as AlternatingPattern;
        q.setData(phase.data, phase.height, phase.width);
        let newData: PhaseData = {pops: [], hashes: [], phases: []};
        for (let j = i; j < gens; j += count) {
            newData.pops.push(data.pops[j]);
            newData.hashes.push(data.hashes[j]);
            newData.phases.push(data.phases[j]);
        }
        let minmax = findMinmax(q, Math.floor((gens - i) / count), newData, count, ot);
        min.push(minmax[0]);
        max.push(minmax[1]);
    }
    return [min.join('|'), max.join('|')];
}

export function findMinmax(p: Pattern, gens: number, data?: PhaseData, step: number = 1, ot?: boolean): [string, string] {
    p = p.copy();
    if (data === undefined) {
        let pops: number[] = [p.population];
        let hashes: number[] = [p.hash32()];
        let phases: Pattern[] = [p.copy()];
        let q = p.copy();
        for (let i = 0; i < gens + 1; i++) {
            q.run(step);
            q.shrinkToFit();
            pops.push(q.population);
            hashes.push(q.hash32());
            phases.push(q.copy());
        }
        data = {pops, hashes, phases};
    } else {
        let q = data.phases[data.phases.length - 1].copy();
        q.run(step);
        q.shrinkToFit();
        data.pops.push(q.population);
        data.hashes.push(q.hash32());
        data.phases.push(q);
    }
    if (p instanceof MAPPattern || p instanceof MAPGenPattern || p instanceof MAPB0Pattern || p instanceof MAPB0GenPattern) {
        if (ot && p.ruleSymmetry === 'D8') {
            return fullOTMinmax(p, data, gens, step);
        } else {
            return mapMinmax(p, data, gens, step);
        }
    } else if (p instanceof HROTPattern) {
        return hrotMinmax(p, data, gens, step);
    } else if (p instanceof HROTB0Pattern) {
        return hrotB0Minmax(p, data, gens, step);
    } else if (p instanceof AlternatingPattern) {
        return alternatingMinmax(p, data, gens, step, ot);
    } else if (p instanceof TreePattern) {
        return [p.ruleStr, p.ruleStr];
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
    p = p.copy().run(type.stabilizedAt).shrinkToFit();
    p.xOffset = 0;
    p.yOffset = 0;
    let engine = p.copy();
    let engineData = engine.getData();
    let width = engine.width;
    let height = engine.height;
    for (let i = 0; i < maxPeriodMul; i++) {
        p.run(type.period).shrinkToFit();
        let pData = p.getData();
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let j = 0;
                let k = y * p.width + x;
                let found = true;
                for (let row = 0; row < height; row++) {
                    let engineRow = engineData.slice(j, j + width);
                    let dataRow = pData.slice(k, k + width);
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
                    let ashData = ash.getData();
                    for (let y2 = 0; y2 < height; y2++) {
                        for (let x2 = 0; x2 < width; x2++) {
                            if (engineData[y2 * width + x2]) {
                                ashData[(y2 + y) * ash.width + (x2 + x)] = 0;
                            }
                        }
                    }
                    ash.setData(ashData, ash.height, ash.width);
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
    let oldPhases = type.phases.slice(type.stabilizedAt, type.stabilizedAt + period);
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
        phases.push(p.getData());
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


export function getDescription(type: Identified): string {
    let out: string;
    if (type.linear) {
        if (type.disp) {
            if (type.disp[0] === 0 && type.disp[1] === 0) {
                out = `p${type.period} gun`;
            } else {
                out = `(${type.disp[0]}, ${type.disp[1]})c/${type.period} puffer`;
            }
        } else {
            out = `p${type.period} linear growth`;
        }
    } else if (type.disp) {
        if (type.disp[0] === 0 && type.disp[1] === 0) {
            if (type.period === 1) {
                out = `${type.pops[type.pops.length - 1]}-cell still life`;
            } else {
                out = `p${type.period} oscillator`;
            }
        } else {
            out = `(${type.disp[0]}, ${type.disp[1]})c/${type.period} spaceship`;
        }
    } else {
        out = 'cannot identify';
    }
    return out;
}

export interface FullIdentified extends Identified {
    desc: string;
    output?: FullIdentified;
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
        minmax = findMinmax(p, type.period > 0 ? type.period + type.stabilizedAt : limit, type);
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
    return {...type, minmax, output, desc: getDescription(type), ...oscInfo};
}
