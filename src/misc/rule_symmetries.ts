
import {LifewebError, INTSpec, INT, HEX_INT, VON_NEUMANN_INT, parseTransitions, unparseTransitions} from '../core/index.js';


// transition format:
// 0b_abc_def_ghi_j
// abc
// def -> j
// ghi

export type TransitionClass = 'B' | 'S' | 'A' | 'D';

export const TRANSITION_CLASSES = new Set(['B', 'S', 'A', 'D']);

export const TRANSITION_CLASS_ORS: {[K in TransitionClass]: number} = {
    'B': 0b000_000_000_1,
    'S': 0b000_010_000_1,
    'A': 0b000_000_000_0,
    'D': 0b000_010_000_0,
};

export type Symmetry = (tr: number) => number;
export type SymmetryList = Symmetry[];

export type Vector = number[];
export type Basis = Vector[];


export function trToString(tr: number): string {
    let str = tr.toString(2).padStart(10, '0');
    return str.slice(0, 3) + '.' + str.slice(3, 6) + '.' + str.slice(6, 9) + '.' + str.slice(9);
}

export function classifyTr(tr: number): TransitionClass {
    if (tr & 1) {
        if (tr & (1 << 5)) {
            return 'S';
        } else {
            return 'B';
        }
    } else {
        if (tr & (1 << 5)) {
            return 'D';
        } else {
            return 'A';
        }
    }
}


export function identity(tr: number): number {
    return tr;
}

/*
    return (tr & 1)
         | ((tr & 0b100_000_000_0))
         | ((tr & 0b010_000_000_0))
         | ((tr & 0b001_000_000_0))
         | ((tr & 0b000_100_000_0))
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0))
         | ((tr & 0b000_000_100_0))
         | ((tr & 0b000_000_010_0))
         | ((tr & 0b000_000_001_0));
*/

export function rotate180(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 8)
         | ((tr & 0b010_000_000_0) >> 6)
         | ((tr & 0b001_000_000_0) >> 4)
         | ((tr & 0b000_100_000_0) >> 2)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) << 2)
         | ((tr & 0b000_000_100_0) << 4)
         | ((tr & 0b000_000_010_0) << 6)
         | ((tr & 0b000_000_001_0) << 8);
}

export function rotateLeft(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 6)
         | ((tr & 0b010_000_000_0) >> 2)
         | ((tr & 0b001_000_000_0) << 2)
         | ((tr & 0b000_100_000_0) >> 4)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) << 4)
         | ((tr & 0b000_000_100_0) >> 2)
         | ((tr & 0b000_000_010_0) << 2)
         | ((tr & 0b000_000_001_0) << 6);
}

export function rotateRight(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 2)
         | ((tr & 0b010_000_000_0) >> 4)
         | ((tr & 0b001_000_000_0) >> 6)
         | ((tr & 0b000_100_000_0) << 2)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) >> 2)
         | ((tr & 0b000_000_100_0) << 6)
         | ((tr & 0b000_000_010_0) << 4)
         | ((tr & 0b000_000_001_0) << 2);
}

export function flipVertical(tr: number): number {
    return (tr & 1)
         | ((tr & 0b111_000_000_0) >> 6)
         | ((tr & 0b000_111_000_0))
         | ((tr & 0b000_000_111_0) << 6);
}

export function flipHorizontal(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_100_100_0) >> 2)
         | ((tr & 0b010_010_010_0))
         | ((tr & 0b001_001_001_0) << 2);
}

export function flipDiagonal(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0))
         | ((tr & 0b010_000_000_0) >> 2)
         | ((tr & 0b001_000_000_0) >> 4)
         | ((tr & 0b000_100_000_0) << 2)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) >> 2)
         | ((tr & 0b000_000_100_0) << 4)
         | ((tr & 0b000_000_010_0) << 2)
         | ((tr & 0b000_000_001_0));
}

export function flipAntiDiagonal(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 8)
         | ((tr & 0b010_000_000_0) >> 4)
         | ((tr & 0b001_000_000_0))
         | ((tr & 0b000_100_000_0) >> 4)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) << 4)
         | ((tr & 0b000_000_100_0))
         | ((tr & 0b000_000_010_0) << 4)
         | ((tr & 0b000_000_001_0) << 8);
}

export function rotate8Left(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 3)
         | ((tr & 0b010_000_000_0) << 1)
         | ((tr & 0b001_000_000_0) << 1)
         | ((tr & 0b000_100_000_0) >> 3)
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0) << 3)
         | ((tr & 0b000_000_100_0) << 3)
         | ((tr & 0b000_000_010_0) << 1)
         | ((tr & 0b000_000_001_0) << 1);
}

export function swapTopAndTopLeftCells(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0) >> 1)
         | ((tr & 0b010_000_000_0) << 1)
         | ((tr & 0b001_000_000_0))
         | ((tr & 0b000_100_000_0))
         | ((tr & 0b000_010_000_0))
         | ((tr & 0b000_001_000_0))
         | ((tr & 0b000_000_100_0))
         | ((tr & 0b000_000_010_0))
         | ((tr & 0b000_000_001_0));
}

export const OT_SYMMETRY: SymmetryList = [rotate8Left, swapTopAndTopLeftCells];

export function swapCenterAndTopCells(tr: number): number {
    return (tr & 1)
         | ((tr & 0b100_000_000_0))
         | ((tr & 0b010_000_000_0) >> 3)
         | ((tr & 0b001_000_000_0))
         | ((tr & 0b000_100_000_0))
         | ((tr & 0b000_010_000_0) << 3)
         | ((tr & 0b000_001_000_0))
         | ((tr & 0b000_000_100_0))
         | ((tr & 0b000_000_010_0))
         | ((tr & 0b000_000_001_0));
}

export const TOTALISTIC_SYMMETRY: SymmetryList = [...OT_SYMMETRY, swapCenterAndTopCells];

export const D4P_SYMMETRY: SymmetryList = [flipVertical, flipHorizontal];
export const D4X_SYMMETRY: SymmetryList = [flipDiagonal, flipAntiDiagonal];
export const D8_SYMMETRY: SymmetryList = [rotateLeft, flipVertical];
export const ROTATE_8_REFLECT_SYMMETRY: SymmetryList = [flipVertical, rotate8Left];


export function createAND(value: number): Symmetry {
    return tr => tr & value;
}

export function createOR(value: number): Symmetry {
    return tr => tr | value;
}

export function createXOR(value: number): Symmetry {
    return tr => tr ^ value;
}

export function createNAND(value: number): Symmetry {
    return tr => ~(tr & value);
}

export function createNOR(value: number): Symmetry {
    return tr => ~(tr | value);
}

export function createXNOR(value: number): Symmetry {
    return tr => ~(tr ^ value);
}

export function createRestrictNH(nh: number): SymmetryList {
    let removed: number[] = [];
    for (let i = 0; i < 9; i++) {
        if (!(nh & (1 << i))) {
            removed.push(i);
        }
    }
    let and = (nh << 1) | 0b000_000_000_1;
    let out: SymmetryList = [];
    let done = new Set<number>();
    for (let i = 0; i < 2**removed.length; i++) {
        let or = 0;
        for (let j = 0; j < removed.length; j++) {
            if (i & (1 << j)) {
                or |= (1 << (removed[j] + 1));
            }
        }
        if (done.has(or)) {
            continue;
        }
        done.add(or);
        out.push(tr => (tr & and) | or);
    }
    return out;
}

function rightShift(value: number, places: number): number {
    if (places >= 0) {
        return value >> places;
    } else {
        return value << places;
    }
}

export function createPermute(values: number[]): Symmetry {
    let shifts: number[] = [];
    for (let i = 0; i < 9; i++) {
        shifts.push(values.indexOf(i) - i);
    }
    return tr => {
        return (tr & 1)
             | rightShift(tr & 0b100_000_000_0, shifts[0])
             | rightShift(tr & 0b010_000_000_0, shifts[1])
             | rightShift(tr & 0b001_000_000_0, shifts[2])
             | rightShift(tr & 0b000_100_000_0, shifts[3])
             | rightShift(tr & 0b000_010_000_0, shifts[4])
             | rightShift(tr & 0b000_001_000_0, shifts[5])
             | rightShift(tr & 0b000_000_100_0, shifts[6])
             | rightShift(tr & 0b000_000_010_0, shifts[7])
             | rightShift(tr & 0b000_000_001_0, shifts[8]);
    };
}


export const NO_CENTER_NH = createRestrictNH(0b111_101_111);

export const VON_NEUMANN_NH = createRestrictNH(0b010_111_010);
export const VON_NEUMANN_INT_SYMMETRY: SymmetryList = [...VON_NEUMANN_NH, ...D8_SYMMETRY];


export const HEX_NH = createRestrictNH(0b110_111_011);
export const TRIPOD_NH = createRestrictNH(0b010_110_001);


export const BW_REVERSAL_SYMMETRY = createXOR(0b111_111_111);


export const BASIC_SYMMETRIES: {[key: string]: Symmetry | SymmetryList} = {

    'none': [],
    'c1': [],
    'nothing': [],
    'empty': [],
    'null': [],
    'undefined': [],
    'nil': [],

    'identity': identity,
    'noop': identity,
    'f': identity,

    'rotate180': rotate180,
    '180rotate': rotate180,
    'rotate2': rotate180,
    'c2': rotate180,
    'b': rotate180,

    'rotateleft': rotateLeft,
    'leftrotate': rotateLeft,
    'rotate': rotateLeft,
    'c4': rotateLeft,
    'l': rotateLeft,

    'rotateright': rotateRight,
    'rightrotate': rotateRight,
    'r': rotateRight,

    'flipvertical': flipVertical,
    'verticalflip': flipVertical,
    'd2-': flipVertical,
    'd2h': flipVertical,
    'fx': flipVertical,

    'fliphorizontal': flipHorizontal,
    'horizontalflip': flipHorizontal,
    'd2|': flipHorizontal,
    'd2v': flipHorizontal,
    'bx': flipHorizontal,

    'flipdiagonal': flipDiagonal,
    'd2\\': flipDiagonal,
    'd2b': flipDiagonal,
    'rx': flipDiagonal,

    'flipantidiagonal': flipAntiDiagonal,
    'd2/': flipAntiDiagonal,
    'd2s': flipAntiDiagonal,
    'lx': flipAntiDiagonal,

    'rotate8left': rotate8Left,
    'rotate8': rotate8Left,
    'rotate8right': rotate8Left,

    'outertotalistic': OT_SYMMETRY,
    'ot': OT_SYMMETRY,
    'permute': OT_SYMMETRY,
    'totalpermute': OT_SYMMETRY,

    'totalistic': TOTALISTIC_SYMMETRY,
    't': TOTALISTIC_SYMMETRY,

    'd4+': D4P_SYMMETRY,
    'd4p': D4P_SYMMETRY,
    'rotate2flip': D4P_SYMMETRY,
    'fliprotate2': D4P_SYMMETRY,
    'rotate180flip': D4P_SYMMETRY,
    'fliprotate180': D4P_SYMMETRY,

    'd4x': D4X_SYMMETRY,

    'd8': D8_SYMMETRY,
    'int': D8_SYMMETRY,

    'rotate8flip': ROTATE_8_REFLECT_SYMMETRY,

    'nocenter': NO_CENTER_NH,

    'vn': VON_NEUMANN_NH,
    'vnint': VON_NEUMANN_INT_SYMMETRY,

    'hex': HEX_NH,
    'tripod': TRIPOD_NH,

    'bw': BW_REVERSAL_SYMMETRY,

};

export const SYMMETRY_FACTORIES: {[key: string]: (value: number) => (Symmetry | SymmetryList)} = {

    'and': createAND,
    'or': createOR,
    'xor': createXOR,
    'nand': createNAND,
    'nor': createNOR,
    'xnor': createXNOR,

    'nh': createRestrictNH,

};

export function normalizeSymmetryName(value: string): string {
    return value
        .trim().toLowerCase()
        .replaceAll(/[_.]/g, '')
        .replaceAll('reversal', 'reverse')
        .replaceAll('rotation', 'rotate')
        .replaceAll('reflect', 'flip').replaceAll('reflection', 'flip')
        .replaceAll('permute', 'perm').replaceAll('permutation', 'perm')
        .replaceAll('vonneumann', 'vn')
        .replaceAll('neighborhood', 'nh')
        .replaceAll('blackwhitereverse', 'bw').replaceAll('blackwhite', 'bw');
}


export function swapVector(vector: Vector): Vector {
    return vector.map(x => x ^ 1);
}

export function vectorSorter(x: number, y: number): number {
    let xC = classifyTr(x);
    let yC = classifyTr(y);
    if (xC === yC) {
        return x - y;
    } else if (xC === 'B') {
        return -1;
    } else if (yC === 'B') {
        return 1;
    } else if (xC === 'S') {
        return -1;
    } else if (yC === 'S') {
        return 1;
    } else if (xC === 'A') {
        return -1;
    } else if (yC === 'A') {
        return 1;
    } else {
        return -1;
    }
}

export function basisSorter(x: Vector, y: Vector): number {
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        let value = vectorSorter(x[i], y[i]);
        if (value !== 0) {
            return value;
        }
    }
    return x.length - y.length;
}

export function normalizeBasis(basis: Basis): Basis {
    basis = basis.map(vector => vector.slice().sort(vectorSorter)).sort(basisSorter);
    let out: Basis = [];
    let done = new Set<string>();
    for (let vector of basis) {
        vector = vector.slice().sort(vectorSorter);
        let key = [vector, swapVector(vector).sort(vectorSorter)].sort(basisSorter).map(x => x.join(',')).join(' ');
        if (done.has(key)) {
            continue;
        }
        done.add(key);
        out.push(vector);
    }
    return out.sort(basisSorter);
}

export function findBasis(symmetries: SymmetryList): Basis | 'contradiction' {
    symmetries = Array.from(new Set([identity].concat(symmetries)));
    let out: Basis = [];
    let done: {[key: number]: Vector} = {};
    for (let tr = 0; tr < 1024; tr++) {
        let foundTrs = new Set<number>();
        let foundVectors: Vector[] = [];
        for (let symmetry of symmetries) {
            let tr2 = symmetry(tr);
            if (tr2 in done) {
                if (!foundVectors.includes(done[tr2])) {
                    foundVectors.push(done[tr2]);
                }
                for (let value of done[tr2]) {
                    foundTrs.add(value);
                }
            } else {
                foundTrs.add(tr2);
            }
        }
        if (foundVectors.length === 1 && Array.from(foundTrs).every(tr => foundVectors[0].includes(tr))) {
            continue;
        }
        for (let vector of foundVectors) {
            let index = out.indexOf(vector);
            if (index === -1) {
                throw new Error(`This error should not occur, please report it (cannot find vector in basis)`);
            }
            out.splice(index, 1);
        }
        let newVector = Array.from(foundTrs);
        for (let tr of foundTrs) {
            done[tr] = newVector;
            if (foundTrs.has(tr ^ 1)) {
                return 'contradiction';
            }
        }
        out.push(newVector);
    }
    return normalizeBasis(out);
}


export type VectorFormat = 'map' | 'int' | 'hex' | 'vn';
export type VectorFormatSpec = (VectorFormat | VectorFormat[])[];
const DEFAULT_BASIS_VECTOR_FORMAT_SPECS: VectorFormat[] = ['int', 'hex', 'map'];
const BASIS_VECTOR_FORMAT_INT_SPECS: {[K in 'int' | 'hex' | 'vn']: INTSpec} = {'int': INT, 'hex': HEX_INT, 'vn': VON_NEUMANN_INT};

function attemptINTSpecReplace(value: number[], spec: INTSpec): [string[], Vector] {
    value = value.slice();
    let out: string[] = [];
    for (let key in spec.trs) {
        for (let [letter, or] of Object.entries(TRANSITION_CLASS_ORS)) {
            if (spec.trs[key].every(tr => value.includes((tr << 1) | or))) {
                out.push(letter + key);
                for (let tr of spec.trs[key]) {
                    tr = ((tr << 1) | or);
                    let index = value.indexOf(tr);
                    if (index === -1) {
                        throw new Error(`This error should not occur, please report it (cannot find tr in vector)`);
                    }
                    value.splice(index, 1);
                }
            }
        }
    }
    return [out, value];
}

function formatVector(vector: Vector, format: VectorFormat): string {
    vector = vector.slice();
    if (format === 'map') {
        return vector.sort(vectorSorter).map(tr => classifyTr(tr) + trToString(tr).slice(0, -2)).join(', ');
    }
    let spec = BASIS_VECTOR_FORMAT_INT_SPECS[format];
    let value = attemptINTSpecReplace(vector, spec);
    let classes: {[K in TransitionClass]: string[]} = {'B': [], 'S': [], 'A': [], 'D': []};
    for (let tr of value[0]) {
        classes[tr[0] as TransitionClass].push(tr.slice(1));
    }
    let extraClasses: {[K in TransitionClass]: string[]} = {'B': [], 'S': [], 'A': [], 'D': []};
    for (let tr of value[1]) {
        let cls = classifyTr(tr);
        extraClasses[cls].push(cls + trToString(tr).slice(0, -2));
    }
    let out = '';
    if (classes['B'].length > 0 || classes['S'].length > 0 || extraClasses['B'].length > 0 || extraClasses['S'].length > 0) {
        out += `B${unparseTransitions(classes['B'], spec)}/S${unparseTransitions(classes['S'], spec)}${spec.after}`;
        if (extraClasses['B'].length > 0) {
            out += ' ' + extraClasses['B'].join(', ');
        }
        if (extraClasses['S'].length > 0) {
            out += ' ' + extraClasses['S'].join(', ');
        }
    }
    if (classes['A'].length > 0 || classes['D'].length > 0 || extraClasses['A'].length > 0 || extraClasses['D'].length > 0) {
        if (out !== '') {
            out += ', ';
        }
        out += `A${unparseTransitions(classes['A'], spec)}/D${unparseTransitions(classes['D'], spec)}${spec.after}`;
        if (extraClasses['A'].length > 0) {
            out += ' ' + extraClasses['A'].join(', ');
        }
        if (extraClasses['D'].length > 0) {
            out += ' ' + extraClasses['D'].join(', ');
        }
    }
    return out;
}

function getFormatIndex(format: VectorFormatSpec, value: VectorFormat): number {
    return format.findIndex(x => x === value || (Array.isArray(x) && x.includes(value)));
}

export function vectorToString(vector: number[], formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): string {
    let sorted = formats.flat().filter(format => format !== 'map').map(format => {
        let [found, extra] = attemptINTSpecReplace(vector, BASIS_VECTOR_FORMAT_INT_SPECS[format]);
        if (found.length === 0) {
            return false;
        }
        return [format, found.length, extra.length] as [VectorFormat, number, number];
    }).filter(x => x !== false).sort((x, y) => {
        if (x[2] === 0 && y[2] !== 0) {
            return -1;
        } else if (x[2] !== 0 && y[2] === 0) {
            return 1;
        } else {
            let value = getFormatIndex(formats, x[0]) - getFormatIndex(formats, y[0]);
            if (value === 0) {
                return x[1] - y[1];
            } else {
                return value;
            }
        }
    });
    if (sorted.length === 0) {
        return formatVector(vector, 'map');
    } else if (sorted.length === 1) {
        return formatVector(vector, sorted[0][0]);
    } else {
        if (sorted[0][1] === sorted[1][1]) {
            let tiedFormats = sorted.filter(x => x[1] === sorted[0][1]).map<[VectorFormat, number]>(x => [x[0], formats.indexOf(x[0])]);
            return formatVector(vector, tiedFormats.sort((x, y) => x[1] - y[1])[0][0]);
        } else {
            return formatVector(vector, sorted[0][0]);
        }
    }
}

export function basisToString(basis: Basis, formats: VectorFormat[] = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): string {
    return normalizeBasis(basis).map(vector => vectorToString(vector, formats)).join('\n');
}


function parseTrsSection(value: string): number[] {
    let or = 0;
    if (TRANSITION_CLASSES.has(value[0].toUpperCase())) {
        or = TRANSITION_CLASS_ORS[value[0].toUpperCase() as TransitionClass];
        value = value.slice(1);
    }
    if (value.match(/^[0-1._]+$/)) {
        value = value.replaceAll(/[._]/g, '');
        let out = parseInt(value, 2);
        if (value.length === 9) {
            out <<= 1;
        }
        return [out | or];
    } else {
        value = value.toLowerCase();
        let spec = INT;
        if (value.endsWith('M')) {
            value = value.slice(0, -1);
        } else if (value.endsWith('H')) {
            value = value.slice(0, -1);
            spec = HEX_INT;
        } else if (value.endsWith('V')) {
            value = value.slice(0, -1);
            spec = VON_NEUMANN_INT;
        }
        let out: number[] = [];
        for (let key of parseTransitions(value, spec)) {
            for (let tr of spec.trs[key]) {
                out.push((tr << 1) | or);
            }
        }
        return out;
    }
}

export function parseTrs(trs: string): number[] {
    let out: number[] = [];
    for (let section of trs.split(/[ ,_/]/)) {
        out.push(...parseTrsSection(section));
    }
    return out;
}


export class SymmetryParsingError extends LifewebError {
    name = 'SymmetryParsingError';
    [Symbol.toStringTag] = 'SymmetryParsingError';
}

export function parseSymmetries(data: string): SymmetryList {
    let out: SymmetryList = [];
    for (let symmetry of data.split(',')) {
        symmetry = symmetry.trim().toLowerCase();
        let key = normalizeSymmetryName(symmetry);
        if (key in BASIC_SYMMETRIES) {
            let value = BASIC_SYMMETRIES[key];
            if (Array.isArray(value)) {
                for (let symmetry of value) {
                    out.push(symmetry);
                }
            } else {
                out.push(value);
            }
        } else if (symmetry.includes('(')) {
            if (!symmetry.endsWith(')')) {
                throw new SymmetryParsingError(`Invalid function call: '${symmetry}'`);
            }
            symmetry = symmetry.slice(0, -1);
            let [funcName, argStr] = symmetry.split('(');
            let key = normalizeSymmetryName(funcName);
            if (!(key in SYMMETRY_FACTORIES)) {
                throw new SymmetryParsingError(`Function '${funcName}' does not exist`);
            }
            let args = parseTrs(argStr);
            let func = SYMMETRY_FACTORIES[key];
            for (let arg of args) {
                let value = func(arg);
                if (Array.isArray(value)) {
                    for (let symmetry of value) {
                        out.push(symmetry);
                    }
                } else {
                    out.push(value);
                }
            }
        } else {
            throw new SymmetryParsingError(`Variable '${symmetry}' does not exist`);
        }
    }
    return out;
}
