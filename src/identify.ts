
import {Pattern} from './pattern.js';
import {arrayToTransitions, MAPPattern, TRANSITIONS, transitionsToArray, unparseTransitions, VALID_TRANSITIONS} from './map.js';


export interface Identified {
    rle: string;
    apgcode: string;
    stabilizedAt: number;
    desc: string;
    period: number;
    disp?: [number, number];
    power?: number;
    pops: number[];
    hashes: number[];
    phases: Pattern[];
    min: string;
    max: string;
}

type PartialIdentified = Omit<Identified, 'rle' | 'apgcode' | 'desc' | 'min' | 'max'>;


function findType(p: Pattern, limit: number): PartialIdentified {
    p.resizeToFit();
    let phases: Pattern[] = [p.copy()];
    let pops: number[] = [p.population];
    let hashes: number[] = [p.hash32()];
    let offset: [number, number] | false;
    for (let i = 0; i < limit; i++) {
        p.runGeneration();
        p.resizeToFit();
        let pop = p.population;
        let hash = p.hash32();
        for (let j = 0; j <= i; j++) {
            if (hash === hashes[j] && pop === pops[j]) {
                let q = phases[j];
                if (!p.isEqual(q)) {
                    continue;
                }
                return {
                    period: i - j,
                    stabilizedAt: j,
                    disp: [q.xOffset - p.xOffset, q.yOffset - p.xOffset],
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
        let fpops = pops.filter((_, i) => i % period === 0);
        let diffs = fpops.slice(0, -1).map((x, i) => fpops[i + 1] - x);
        if (diffs.length < 8) {
            continue;
        }
        for (let j = 0; j < diffs.length - 7; j++) {
            if (diffs[j] > 0 && diffs.slice(j + 1).every(x => x === diffs[j])) {
                return {period, stabilizedAt: j, pops, hashes, phases};
            }
        }
    }
    return {stabilizedAt: -1, period: -1, pops, hashes, phases};
}


function verifyType(p: Pattern, type: PartialIdentified): boolean {
    for (let i = 0; i < (type.disp ? type.period + 1 : 8 * type.period); i++) {
        p.runGeneration();
        p.resizeToFit();
        if (p.hash32() !== type.hashes[i] && p.population !== type.pops[i] && !p.isEqual(type.phases[i])) {
            return false;
        }
    }
    return true;
}

// @ts-ignore
function mapMinmax(p: MAPPattern, type: PartialIdentified): {min: string, max: string} {
    if (p.ruleSymmetry === 'D8') {
        let [b, s] = arrayToTransitions(p.trs, TRANSITIONS);
        let minB = b.slice();
        let minS = s.slice();
        let maxB = b.slice();
        let maxS = s.slice();
        for (let tr in TRANSITIONS) {
            let q = p.copy();
            q.trs = q.trs.slice();
            if (b.includes(tr)) {
                for (let x of TRANSITIONS[tr]) {
                    q.trs[x] = 0;
                }
                if (verifyType(q, type)) {
                    minB = minB.filter(x => x !== tr);
                }
            } else {
                for (let x of TRANSITIONS[tr]) {
                    q.trs[x] = 1;
                }
                if (verifyType(q, type)) {
                    maxB.push(tr);
                }
            }
            q = p.copy();
            q.trs = q.trs.slice();
            if (s.includes(tr)) {
                for (let x of TRANSITIONS[tr]) {
                    q.trs[x] = 0;
                }
                if (verifyType(q, type)) {
                    minS = minS.filter(x => x !== tr);
                }
            } else {
                for (let x of TRANSITIONS[tr]) {
                    q.trs[x] = 1;
                }
                if (verifyType(q, type)) {
                    maxS.push(tr);
                }
            }
        }
        return {
            min: 'B' + unparseTransitions(minB, VALID_TRANSITIONS, false) + '/S' + unparseTransitions(minS, VALID_TRANSITIONS, false),
            max: 'B' + unparseTransitions(minB, VALID_TRANSITIONS, false) + '/S' + unparseTransitions(maxS, VALID_TRANSITIONS, false),
        }
    } else {

    }
}


const MD5_CONSTANTS = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];

const MD5_SHIFTS = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_BLOCKS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12,
    5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2,
    0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9,
];

function md5(data: Uint8Array): Uint32Array {
    let out = new Uint32Array(4);
    out[0] = 0x01234567;
    out[1] = 0x89abcdef;
    out[2] = 0xfedcba98;
    out[3] = 0x76543210;
    let blockCount = Math.ceil(data.length / 64);
    if (blockCount === 0) {
        blockCount = 1;
    }
    if (data.length % 64 >= 56) {
        blockCount++;
    }
    let padded = new Uint8Array(blockCount * 64);
    padded.set(data);
    padded[data.length] = 128;
    console.log(padded);
    let blocks = new DataView(padded.buffer);
    blocks.setBigUint64(padded.length - 8, BigInt(data.length), true);
    for (let block = 0; block < blockCount; block++) {
        let a = out[0];
        let b = out[1];
        let c = out[2];
        let d = out[3];
        for (let i = 0; i < 64; i++) {
            let f: number;
            if (i < 20) {
                f = (b & c) | (~b & d);
            } else if (i < 40) {
                f = (b & c) | (b & ~d);
            } else if (i < 60) {
                f = b ^ c ^ d;
            } else {
                f = b ^ (c | ~d);
            }
            f = (f + a + MD5_CONSTANTS[i] + blocks.getUint32((block * 4 + MD5_BLOCKS[i]) * 4)) | 0;
            a = d;
            d = c;
            c = b;
            b += (f << MD5_SHIFTS[i]) | (f >>> (-MD5_SHIFTS[i] & ((1 << 31) * 2 - 1)));
        }
        out[0] += a;
        out[1] += b;
        out[2] += c;
        out[3] += d;
    }
    return out;
}

console.log(Array.from(md5(new Uint8Array(0))).map(x => x.toString(16).padStart(8, '0')).join(''));

export function identify(p: Pattern, limit: number): Identified {
    let type = findType(p, limit);
    let minmax: {min: string, max: string};
    if (p instanceof MAPPattern) {
        minmax = mapMinmax(p, type);
    } else {
        throw new Error('Unknown Pattern subclass');
    }
    let apgcode: string;
    let desc: string;
    if (type.disp) {
        let prefix: string;
        if (type.disp[0] === 0 && type.disp[1] === 0) {
            if (type.period === 1) {
                let cells = type.pops[type.pops.length - 1];
                prefix = 'xs' + cells;
                desc = cells + (cells === 1 ? '-cell' : '-cells') + ' still life';
            } else {
                prefix = 'xp' + type.period;
                desc = 'p' + type.period + 'oscillator';
            }
        } else {
            prefix = 'xq' + type.period;
            desc = `(${type.disp[0]}, ${type.disp[1]})c/${type.period} spaceship`;
        }
        apgcode = p.toCanonicalApgcode(type.period, prefix);
    } else if (type.period > 0) {
        desc = 'p' + type.period + ' linear growth';
        let diffs = type.pops.slice(0, -1).map((x, i) => type.pops[i + 1] - x);
        let qeriod = -1;
        for (let q = 1; q < type.period; q++) {
            let correct = true;
            for (let i = 0; i < type.pops.length; i++) {
                if (diffs[i] !== diffs[i + q]) {
                    correct = false;
                    break;
                }
            }
            if (correct) {
                qeriod = q;
                break;
            }
        }
        if (qeriod === -1) {
            apgcode = 'PATHOLOGICAL';
        } else {
            let moment0 = 0;
            let moment1 = 0;
            let moment2 = 0;
            let str = moment1 + '#' + moment2;
            let array = new Uint8Array(str.length);
            for (let i = 0; i < str.length; i++) {
                array[i] = str.charCodeAt(i);
            }
            let hash = Array.from(md5(array)).map(x => x.toString(16).padStart(8, '0')).join('');
            apgcode = `yl${type.period}_${qeriod}_${moment0}_${hash}`;
        }
    } else {
        desc = 'cannot identify';
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
            apgcode = 'zz_QAUDRATIC';
        }
    }
    return {rle: p.toRLE(), apgcode, desc, ...type, ...minmax};
}
