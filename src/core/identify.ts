
import {stringMD5} from './md5.js';
import {RuleError, Pattern} from './pattern.js';
import {PhaseData, findMinmax} from './minmax.js';


export interface PatternType extends PhaseData {
    stabilizedAt: number;
    period: number;
    disp?: [number, number];
    linear?: boolean;
    power?: number;
}


export function findType(p: Pattern, limit: number, acceptStabilized: boolean = true): PatternType {
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


export function getApgcode(type: PatternType): string {
    if (type.disp) {
        let prefix: string;
        if (type.disp[0] === 0 && type.disp[1] === 0) {
            let cells = type.pops[type.pops.length - 1];
            if (type.period === 1) {
                if (cells === 0) {
                    return 'xs0_0';
                }
                prefix = 'xs' + cells;
            } else {
                if (cells === 0) {
                    return `xp${type.period}_0`;
                }
                prefix = 'xp' + type.period;
            }
        } else {
            prefix = 'xq' + type.period;
        }
        return type.phases[0].toCanonicalApgcode(type.period, prefix);
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
            return 'PATHOLOGICAL';
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
            return `yl${type.period}_${subperiod}_${moment0}_${stringMD5(moment1 + '#' + moment2)}`;
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
            return 'PATHOLOGICAL';
        } else if (power < 1.65) {
            return 'zz_REPLICATOR';
        } else if (power < 2.1) {
            return 'zz_LINEAR';
        } else if (power < 2.9) {
            return 'zz_EXPLOSIVE';
        } else {
            return 'zz_QUADRATIC';
        }
    }
}

export function getDescription(type: PatternType): string {
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


export interface LinearInfo {
    period: number;
    disp: [number, number];
    ash: Pattern;
}

export function classifyLinear(p: Pattern, type: PatternType, maxPeriodMul: number): null | LinearInfo {
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

export function findOscillatorInfo(type: PatternType): number | OscillatorInfo {
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


export type StaticSymmetry = 'n' | '.c' | '.-e' | '.|e' | '.k' | 'rc' | 'rk' | '-c' | '-e' | '|c' | '|e' | '/' | '\\' | '+c' | '+-e' | '+|e' | '+k' | 'xc' | 'xk' | 'rc' | 'rk' | '*c' | '*k';
export type PatternSymmetry = StaticSymmetry | 'n.c' | 'n.-e' | 'n.|e' | 'n.k' | 'nrc' | 'nrk' | 'n-c' | 'n-e' | 'n|c' | 'n|e' | 'n/' | 'n\\' | '.crc' | '.c+c' | '.cxc' | '.-e+-e' | '.|e+|e' | '.krk' | '.k+k' | '.kxk' | 'rc*c' | 'rk*k' | '-c+c' | '-c+-e' | '-e+-e' | '-e+k' | '|c+c' | '|c+|e' | '|e+|e' | '|e+k' | '/xc' | '/xk' | '\\xc' | '\\xk' | '+c*c' | '+k*k' | 'xc*c' | 'xk*k';

export const ALTERNATE_SYMMETRIES: {[K in PatternSymmetry]: string} = {
    'n': 'C1',
    '.c': 'C2_1',
    '.-e': 'C2_-2',
    '.|e': 'C2_|2',
    '.k': 'C2_4',
    'rc': 'C4_1',
    'rk': 'C4_4',
    '-c': 'D2_-1',
    '-e': 'D2_-2',
    '|c': 'D2_|1',
    '|e': 'D2_|2',
    '/': 'D2_/',
    '\\': 'D2_\\',
    '+c': 'D4_+1',
    '+-e': 'D4_-2',
    '+|e': 'D4_|2',
    '+k': 'D4_+4',
    'xc': 'D4_x1',
    'xk': 'D4_x4',
    '*c': 'D8_1',
    '*k': 'D8_4',
    'n.c': 'C1 C2_1',
    'n.-e': 'C1 C2_-',
    'n.|e': 'C1 C2_|',
    'n.k': 'C1 C2_4',
    'nrc': 'C1 C4_1',
    'nrk': 'C1 C4_4',
    'n-c': 'C1 D2_-1',
    'n-e': 'C1 D2_-2',
    'n|c': 'C1 D2_|1',
    'n|e': 'C1 D2_|2',
    'n/': 'C1 D2_/',
    'n\\': 'C1 D2_\\',
    '.crc': 'C2_1 C4_1',
    '.c+c': 'C2_1 D4_+1',
    '.cxc': 'C2_1 D4_x1',
    '.-e+-e': 'C2_- D4_-2',
    '.|e+|e': 'C2_| D4_|2',
    '.krk': 'C2_4 C4_4',
    '.k+k': 'C2_4 D4_+4',
    '.kxk': 'C2_4 D4_x4',
    'rc*c': 'C4_1 D8_1',
    'rk*k': 'C4_4 D8_4',
    '-c+c': 'D2_-1 D4_+1',
    '-c+-e': 'D2_-1 D4_-2',
    '-e+-e': 'D2_-2 D4_+2',
    '-e+k': 'D2_-2 D4_+4',
    '|c+c': 'D2_|1 D4_+1',
    '|c+|e': 'D2_|1 D4_|2',
    '|e+|e': 'D2_|2 D4_|2',
    '|e+k': 'D2_|2 D4_+4',
    '/xc': 'D2_/ D4_x1',
    '/xk': 'D2_/ D4_x4',
    '\\xc': 'D2_\\ D4_x1',
    '\\xk': 'D2_\\ D4_x4',
    '+c*c': 'D4_+1 D8_1',
    '+k*k': 'D4_+4 D8_4',
    'xc*c': 'D4_x1 D8_1',
    'xk*k': 'D4_x4 D8_4',
};

export function findStaticSymmetry(p: Pattern): StaticSymmetry {
    if (p.copy().rotate180().isEqual(p)) {
        if (p.copy().rotateRight().isEqual(p)) {
            if (p.copy().flipHorizontal().isEqual(p)) {
                return p.width % 2 === 1 ? '*c' : '*k';
            } else {
                return p.width % 2 === 1 ? 'rc' : 'rk';
            }
        } else if (p.copy().flipHorizontal().isEqual(p) || p.copy().flipVertical().isEqual(p)) {
            if (p.height % 2 === 1) {
                return p.width % 2 === 1 ? '+c' : '+|e';
            } else {
                return p.width % 2 === 1 ? '+-e' : '+k';
            }
        } else {
            if (p.height % 2 === 1) {
                return p.width % 2 === 1 ? '.c' : '.|e';
            } else {
                return p.width % 2 === 1 ? '.-e' : '.k';
            }
        }
    } else if (p.copy().flipVertical().isEqual(p)) {
        if (p.copy().flipHorizontal().isEqual(p)) {
            if (p.height % 2 === 1) {
                return p.width % 2 === 1 ? '+c' : '+|e';
            } else {
                return p.width % 2 === 1 ? '+-e' : '+k';
            }
        } else {
            return p.height % 2 === 1 ? '-c' : '-e';
        }
    } else if (p.copy().flipHorizontal().isEqual(p)) {
        return p.width % 2 === 1 ? '|c' : '|e';
    } else if (p.copy().flipAntiDiagonal().isEqual(p)) {
        if (p.copy().flipDiagonal().isEqual(p)) {
            return p.width % 2 === 1 ? 'xc' : 'xk';
        } else {
            return '/';
        }
    } else if (p.copy().flipDiagonal().isEqual(p)) {
        return '\\';
    } else {
        return 'n';
    }
}

export function findPatternSymmetry(type: PatternType): PatternSymmetry {
    let p = type.phases[0].run(type.stabilizedAt).shrinkToFit();
    if (p.isEmpty()) {
        return 'n';
    }
    let start = findStaticSymmetry(p);
    if (type.period === -1 || type.period === 1 || type.period % 2 === 1) {
        return start;
    }
    let half = p.copy().run(type.period / 2).shrinkToFit();
    if (start === 'n') {
        if (p.copy().rotate180().isEqual(half)) {
            if (p.copy().run(type.period / 4).rotateRight().isEqual(p)) {
                return p.width % 2 === 1 ? 'nrc' : 'nrk';
            } else {
                if (p.width % 2 === 1) {
                    return p.height % 2 === 1 ? 'n.c' : 'n.|e';
                } else {
                    return p.height % 2 === 1 ? 'n.-e' : 'n.k';
                }
            }
        } else if (p.copy().flipVertical().isEqual(half)) {
            return p.width % 2 === 1 ? 'n-c' : 'n-e';
        } else if (p.copy().flipHorizontal().isEqual(half)) {
            return p.height % 2 === 1 ? 'n|c' : 'n|e';
        } else if (p.copy().flipAntiDiagonal().isEqual(half)) {
            return 'n/';
        } else if (p.copy().flipDiagonal().isEqual(half)) {
            return 'n\\';
        } else {
            return 'n';
        }
    } else if (start === '.c') {
        if (p.copy().rotateRight().isEqual(half)) {
            return '.crc';
        } else if (p.copy().flipHorizontal().isEqual(half)) {
            return '.c+c';
        } else if (p.copy().flipDiagonal().isEqual(half)) {
            return '.cxc';
        } else {
            return '.c';
        }
    } else if (start === '.-e') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return '.-e+-e';
        } else {
            return '.-e';
        }
    } else if (start === '.|e') {
        if (p.copy().flipVertical().isEqual(half)) {
            return '.|e+|e';
        } else {
            return '.|e';
        }
    } else if (start === '.k') {
        if (p.copy().rotateRight().isEqual(half)) {
            return '.krk';
        } else if (p.copy().flipHorizontal().isEqual(half)) {
            return '.k+k';
        } else if (p.copy().flipDiagonal().isEqual(half)) {
            return '.kxk';
        } else {
            return '.k';
        }
    } else if (start === 'rc') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return 'rc*c';
        } else {
            return 'rc';
        }
    } else if (start === 'rk') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return 'rk*k';
        } else {
            return 'rk';
        }
    } else if (start === '-c') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return p.height % 2 === 1 ? '-c+c' : '-c+-e';
        } else {
            return '-c';
        }
    } else if (start === '-e') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return p.height % 2 === 1 ? '-e+-e' : '-e+k';
        } else {
            return '-e';
        }
    } else if (start === '|c') {
        if (p.copy().flipVertical().isEqual(half)) {
            return p.height % 2 === 1 ? '|c+c' : '|c+|e';
        } else {
            return '|c';
        }
    } else if (start === '|e') {
        if (p.copy().flipVertical().isEqual(half)) {
            return p.height % 2 === 1 ? '|e+|e' : '|e+k';
        } else {
            return '|e';
        }
    } else if (start === '/') {
        if (p.copy().flipDiagonal().isEqual(half)) {
            return p.height % 2 === 1 ? '/xc' : '/xk';
        } else {
            return '/';
        }
    } else if (start === '\\') {
        if (p.copy().flipAntiDiagonal().isEqual(half)) {
            return p.height % 2 === 1 ? '\\xc' : '\\xk';
        } else {
            return '\\';
        }
    } else if (start === '+c') {
        if (p.copy().flipDiagonal().isEqual(half)) {
            return '+c*c';
        } else {
            return '+c';
        }
    } else if (start === '+k') {
        if (p.copy().flipDiagonal().isEqual(half)) {
            return '+k*k';
        } else {
            return '+k';
        }
    } else if (start === 'xc') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return 'xc*c';
        } else {
            return 'xc';
        }
    } else if (start === 'xk') {
        if (p.copy().flipHorizontal().isEqual(half)) {
            return 'xk*k';
        } else {
            return 'xk';
        }
    } else {
        return start;
    }
}


export interface Identified extends PatternType {
    desc: string;
    output?: Identified;
    heat?: number;
    temperature?: number;
    volatility?: number;
    strictVolatility?: number;
    minmax?: [string, string];
    symmetry: PatternSymmetry;
}

export function identify(p: Pattern, limit: number, acceptStabilized?: boolean, maxPeriodMul: number = 8): Identified {
    p = p.copy().shrinkToFit();
    let type = findType(p, limit, acceptStabilized);
    let minmax: [string, string] | undefined = undefined;
    try {
        minmax = findMinmax(p, type.period === -1 ? limit : type.period, type);
    } catch (error) {
        if (!(error instanceof RuleError)) {
            throw error;
        }
    }
    let oscInfo: Partial<OscillatorInfo> = {};
    if (type.disp) {
        let data = findOscillatorInfo(type);
        if (typeof data === 'number') {
            oscInfo = {heat: data};
        } else {
            oscInfo = data;
        }
    }
    let output: Identified | undefined = undefined;
    if (type.linear) {
        let data = classifyLinear(p, type, maxPeriodMul);
        if (data) {
            type.period = data.period;
            type.disp = data.disp;
            output = identify(data.ash, limit, acceptStabilized, maxPeriodMul);
        }
    }
    return {...type, output, desc: getDescription(type), ...oscInfo, minmax, symmetry: findPatternSymmetry(type)};
}
