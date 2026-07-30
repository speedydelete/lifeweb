
import {Matcher, EOF, ParserError, BaseParser, INTSpec, INT, HEX_INT, VON_NEUMANN_INT, INT_SPECS, parseTransitions, unparseTransitions} from '../core/index.js';


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

export type SymmetryFunc = (tr: number) => number;
export type Symmetry = SymmetryFunc[];

export type Vector = number[];
export type Basis = Vector[];


export function trToMAPString(tr: number): string {
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

// /*
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0))
//          | ((tr & 0b010_000_000_0))
//          | ((tr & 0b001_000_000_0))
//          | ((tr & 0b000_100_000_0))
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0))
//          | ((tr & 0b000_000_100_0))
//          | ((tr & 0b000_000_010_0))
//          | ((tr & 0b000_000_001_0));
// */

// export function rotate180(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 8)
//          | ((tr & 0b010_000_000_0) >> 6)
//          | ((tr & 0b001_000_000_0) >> 4)
//          | ((tr & 0b000_100_000_0) >> 2)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) << 2)
//          | ((tr & 0b000_000_100_0) << 4)
//          | ((tr & 0b000_000_010_0) << 6)
//          | ((tr & 0b000_000_001_0) << 8);
// }

// export function rotateLeft(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 6)
//          | ((tr & 0b010_000_000_0) >> 2)
//          | ((tr & 0b001_000_000_0) << 2)
//          | ((tr & 0b000_100_000_0) >> 4)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) << 4)
//          | ((tr & 0b000_000_100_0) >> 2)
//          | ((tr & 0b000_000_010_0) << 2)
//          | ((tr & 0b000_000_001_0) << 6);
// }

// export function rotateRight(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 2)
//          | ((tr & 0b010_000_000_0) >> 4)
//          | ((tr & 0b001_000_000_0) >> 6)
//          | ((tr & 0b000_100_000_0) << 2)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) >> 2)
//          | ((tr & 0b000_000_100_0) << 6)
//          | ((tr & 0b000_000_010_0) << 4)
//          | ((tr & 0b000_000_001_0) << 2);
// }

export function flipVertical(tr: number): number {
    return (tr & 1)
         | ((tr & 0b111_000_000_0) >> 6)
         | ((tr & 0b000_111_000_0))
         | ((tr & 0b000_000_111_0) << 6);
}

// export function flipHorizontal(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_100_100_0) >> 2)
//          | ((tr & 0b010_010_010_0))
//          | ((tr & 0b001_001_001_0) << 2);
// }

// export function flipDiagonal(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0))
//          | ((tr & 0b010_000_000_0) >> 2)
//          | ((tr & 0b001_000_000_0) >> 4)
//          | ((tr & 0b000_100_000_0) << 2)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) >> 2)
//          | ((tr & 0b000_000_100_0) << 4)
//          | ((tr & 0b000_000_010_0) << 2)
//          | ((tr & 0b000_000_001_0));
// }

// export function flipAntiDiagonal(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 8)
//          | ((tr & 0b010_000_000_0) >> 4)
//          | ((tr & 0b001_000_000_0))
//          | ((tr & 0b000_100_000_0) >> 4)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) << 4)
//          | ((tr & 0b000_000_100_0))
//          | ((tr & 0b000_000_010_0) << 4)
//          | ((tr & 0b000_000_001_0) << 8);
// }

// export function rotate8Left(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 3)
//          | ((tr & 0b010_000_000_0) << 1)
//          | ((tr & 0b001_000_000_0) << 1)
//          | ((tr & 0b000_100_000_0) >> 3)
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0) << 3)
//          | ((tr & 0b000_000_100_0) >> 1)
//          | ((tr & 0b000_000_010_0) >> 1)
//          | ((tr & 0b000_000_001_0) << 3);
// }

// export function swapTopAndTopLeftCells(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0) >> 1)
//          | ((tr & 0b010_000_000_0) << 1)
//          | ((tr & 0b001_000_000_0))
//          | ((tr & 0b000_100_000_0))
//          | ((tr & 0b000_010_000_0))
//          | ((tr & 0b000_001_000_0))
//          | ((tr & 0b000_000_100_0))
//          | ((tr & 0b000_000_010_0))
//          | ((tr & 0b000_000_001_0));
// }

// export function swapCenterAndTopCells(tr: number): number {
//     return (tr & 1)
//          | ((tr & 0b100_000_000_0))
//          | ((tr & 0b010_000_000_0) >> 3)
//          | ((tr & 0b001_000_000_0))
//          | ((tr & 0b000_100_000_0))
//          | ((tr & 0b000_010_000_0) << 3)
//          | ((tr & 0b000_001_000_0))
//          | ((tr & 0b000_000_100_0))
//          | ((tr & 0b000_000_010_0))
//          | ((tr & 0b000_000_001_0));
// }

// export function createAND(value: number): Symmetry {
//     return tr => tr & value;
// }

// export function createOR(value: number): Symmetry {
//     return tr => tr | value;
// }

// export function createXOR(value: number): Symmetry {
//     return tr => tr ^ value;
// }

// export function createNAND(value: number): Symmetry {
//     return tr => ~(tr & value);
// }

// export function createNOR(value: number): Symmetry {
//     return tr => ~(tr | value);
// }

// export function createXNOR(value: number): Symmetry {
//     return tr => ~(tr ^ value);
// }

// export function createRestrictNH(nh: number): SymmetryList {
//     let removed: number[] = [];
//     for (let i = 0; i < 9; i++) {
//         if (!(nh & (1 << i))) {
//             removed.push(i);
//         }
//     }
//     let and = (nh << 1) | 0b000_000_000_1;
//     let out: SymmetryList = [];
//     let done = new Set<number>();
//     for (let i = 0; i < 2**removed.length; i++) {
//         let or = 0;
//         for (let j = 0; j < removed.length; j++) {
//             if (i & (1 << j)) {
//                 or |= (1 << (removed[j] + 1));
//             }
//         }
//         if (done.has(or)) {
//             continue;
//         }
//         done.add(or);
//         out.push(tr => (tr & and) | or);
//     }
//     return out;
// }

// function rightShift(value: number, places: number): number {
//     if (places >= 0) {
//         return value >> places;
//     } else {
//         return value << places;
//     }
// }

// export function createPermute(values: number[]): Symmetry {
//     console.log(values);
//     let shifts: number[] = [];
//     for (let i = 0; i < 10; i++) {
//         shifts.push(i - values.indexOf(i));
//     }
//     console.log(shifts);
//     return tr => {
//         return rightShift(tr & 0b100_000_000_0, shifts[0])
//              | rightShift(tr & 0b010_000_000_0, shifts[1])
//              | rightShift(tr & 0b001_000_000_0, shifts[2])
//              | rightShift(tr & 0b000_100_000_0, shifts[3])
//              | rightShift(tr & 0b000_010_000_0, shifts[4])
//              | rightShift(tr & 0b000_001_000_0, shifts[5])
//              | rightShift(tr & 0b000_000_100_0, shifts[6])
//              | rightShift(tr & 0b000_000_010_0, shifts[7])
//              | rightShift(tr & 0b000_000_001_0, shifts[8])
//              | rightShift(tr & 0b000_000_000_1, shifts[9]);
//     };
// }


// export const NO_CENTER_NH = createRestrictNH(0b111_101_111);

// export const VON_NEUMANN_NH = createRestrictNH(0b010_111_010);
// export const VON_NEUMANN_INT_SYMMETRY: SymmetryList = [...VON_NEUMANN_NH, ...D8_SYMMETRY];


// export const HEX_NH = createRestrictNH(0b110_111_011);
// export const TRIPOD_NH = createRestrictNH(0b010_110_001);


// export const BW_REVERSAL_SYMMETRY = createXOR(0b111_111_111);


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
        return vector.sort(vectorSorter).map(tr => classifyTr(tr) + trToMAPString(tr).slice(0, -2)).join(', ');
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
        extraClasses[cls].push(cls + trToMAPString(tr).slice(0, -2));
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
    if (vector.length === 0) {
        return '<empty vector>';
    }
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

export function transitionToString(tr: number, formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS) {
    return vectorToString([tr], formats);
}

export function basisToString(basis: Basis, formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): string {
    return normalizeBasis(basis).map(vector => vectorToString(vector, formats)).join('\n');
}


export function identity(tr: number): number {
    return tr;
}

export function findBasis(symmetry: Symmetry): Basis | string {
    symmetry = Array.from(new Set([identity].concat(symmetry)));
    let out: Basis = [];
    let done: {[key: number]: Vector} = {};
    for (let tr = 0; tr < 1024; tr++) {
        let foundTrs = new Set<number>();
        let foundVectors: Vector[] = [];
        for (let func of symmetry) {
            let tr2 = func(tr);
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
        for (let tr2 of foundTrs) {
            done[tr2] = newVector;
            if (foundTrs.has(tr2 ^ 1)) {
                return `contradiction (has ${transitionToString(tr2)} and ${transitionToString(tr2 ^ 1)}, discovered while processing ${transitionToString(tr)})`;
            }
        }
        out.push(newVector);
    }
    return normalizeBasis(out);
}





    // 'none': trs([]),
    // 'c1': 'none',
    // 'nothing': 'none',
    // 'empty': 'none',
    // 'null': 'none',
    // 'undefined': 'none',
    // 'nil': 'none',

    // 'identity': func(TR_TYPE, TR_TYPE, identity, true),
    // 'noop': 'identity',
    // 'f': 'identity',

    // 'rotate180': func(TR_TYPE, TR_TYPE, rotate180, true),
    // '180rotate': 'rotate180',
    // 'rotate2': 'rotate180',
    // 'c2': 'rotate180',
    // 'b': 'rotate180',

    // 'rotateleft': func(TR_TYPE, TR_TYPE, rotateLeft, true),
    // 'leftrotate': 'rotateleft',
    // 'rotate': 'rotateleft',
    // 'c4': 'rotateleft',
    // 'l': 'rotateleft',

    // 'rotateright': func(TR_TYPE, TR_TYPE, rotateRight, true),
    // 'rightrotate': 'rotateright',
    // 'r': 'rotateright',

    // 'flipvertical': func(TR_TYPE, TR_TYPE, flipVertical, true),
    // 'verticalflip': 'flipvertical',
    // 'd2-': 'flipvertical',
    // 'd2h': 'flipvertical',
    // 'fx': 'flipvertical',

    // 'fliphorizontal': func(TR_TYPE, TR_TYPE, flipHorizontal, true),
    // 'horizontalflip': 'fliphorizontal',
    // 'd2|': 'fliphorizontal',
    // 'd2v': 'fliphorizontal',
    // 'bx': 'fliphorizontal',

    // 'flipdiagonal': func(TR_TYPE, TR_TYPE, flipDiagonal, true),
    // 'd2\\': 'flipdiagonal',
    // 'd2b': 'flipdiagonal',
    // 'rx': 'flipdiagonal',

    // 'flipantidiagonal': func(TR_TYPE, TR_TYPE, flipAntiDiagonal, true),
    // 'd2/': 'flipantidiagonal',
    // 'd2s': 'flipantidiagonal',
    // 'lx': 'flipantidiagonal',

    // 'rotate8left': func(TR_TYPE, TR_TYPE, rotate8Left, true),
    // 'rotateleft8': 'rotate8left',
    // 'rotate8': 'rotate8left',
    // 'rotate8right': 'rotate8left',
    // 'rotateright8': 'rotate8left',

    // 'outertotalistic': {type: 'funcs', value: [
    //     func(TR_TYPE, TR_TYPE, rotate8Left),
    //     func(TR_TYPE, TR_TYPE, swapTopAndTopLeftCells),
    // ]},
    // 'ot': 'outertotalistic',
    // 'permute': 'outertotalistic',
    // 'totalpermute': 'outertotalistic',

    // 'totalistic': {type: 'funcs', value: [
    //     func(TR_TYPE, TR_TYPE, rotate8Left),
    //     func(TR_TYPE, TR_TYPE, swapTopAndTopLeftCells),
    //     func(TR_TYPE, TR_TYPE, swapCenterAndTopCells),
    // ]},
    // 't': 'totalistic',

    // 'd4+': D4P_SYMMETRY,
    // 'd4p': D4P_SYMMETRY,
    // 'rotate2flip': D4P_SYMMETRY,
    // 'fliprotate2': D4P_SYMMETRY,
    // 'rotate180flip': D4P_SYMMETRY,
    // 'fliprotate180': D4P_SYMMETRY,

    // 'd4x': D4X_SYMMETRY,

    // 'd8': D8_SYMMETRY,
    // 'int': D8_SYMMETRY,

    // 'rotate8flip': ROTATE_8_REFLECT_SYMMETRY,

    // 'nocenter': NO_CENTER_NH,

    // 'vn': VON_NEUMANN_NH,
    // 'vnint': VON_NEUMANN_INT_SYMMETRY,

    // 'hex': HEX_NH,
    // 'tripod': TRIPOD_NH,

    // 'bw': BW_REVERSAL_SYMMETRY,

    // 'and': createAND,
    // 'or': createOR,

export class SymmetryError extends ParserError {

    name = 'SymmetryError';
    [Symbol.toStringTag] = 'SymmetryError';

}

function leftShift(value: number, places: number) {
    if (places < 0) {
        return value >> -places;
    } else {
        return value << places;
    }
}

export class SymmetryParser extends BaseParser {

    static ParserError = SymmetryError;

    namespace: {[key: string]: Symmetry};

    constructor(code: string, namespace: {[key: string]: Symmetry} = {}) {
        super(undefined, code);
        this.namespace = namespace;
    }

    static readonly SPECIAL_CHARS = new Set([',', '(', ')', '=', '[', ']', '\n', ';']);

    tokenize(code: string): void {
        let current = '';
        let startPos = 0;
        for (let pos = 0; pos < code.length; pos++) {
            let char = code[pos];
            if (char === ' ') {
                if (current.length === 0) {
                    startPos++;
                    continue;
                } else {
                    current += char;
                }
            } else if (SymmetryParser.SPECIAL_CHARS.has(char)) {
                if (current.length > 0) {
                    this.addToken(current.trimEnd(), startPos);
                }
                this.addToken(char, pos);
                current = '';
                startPos = pos + 1;
            } else {
                current += char;
            }
        }
        current = current.trimEnd();
        if (current !== '') {
            this.addToken(current, startPos);
        }
    }

    normalizeName(name: string): string {
        return name.trim().toLowerCase().replaceAll(/[ _.]/g, '');
    }

    _transitionsSection(value: string, spec: INTSpec): number[] {
        if (value.length === 0) {
            return [];
        }
        let hasClass = false;
        let or = 0;
        if (TRANSITION_CLASSES.has(value[0].toUpperCase())) {
            hasClass = true;
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
        } else if (value.match(/^0[dboxDBOX]/)) {
            value = value.toLowerCase();
            if (value.startsWith('0d')) {
                value = value.slice(2);
            }
            return [Number(value) | or];
        } else {
            if (!hasClass) {
                this.error(`No transition class provided`, -1);
            }
            value = value.toLowerCase();
            let out: number[] = [];
            for (let key of parseTransitions(value, spec)) {
                for (let tr of spec.trs[key]) {
                    out.push((tr << 1) | or);
                }
            }
            return out;
        }
    }

    transitions(value: string): number[] {
        let spec = INT;
        let lastChar = value[value.length - 1].toUpperCase();
        if (lastChar in INT_SPECS) {
            spec = INT_SPECS[lastChar as keyof typeof INT_SPECS];
            value = value.slice(0, -1);
        }
        let out: number[] = [];
        let current = '';
        for (let char of value) {
            if (' /'.includes(char)) {
                for (let tr of this._transitionsSection(current, spec)) {
                    out.push(tr);
                }
                current = '';
            } else if ('BSbsAD'.includes(char)) {
                for (let tr of this._transitionsSection(current, spec)) {
                    out.push(tr);
                }
                current = char;
            } else {
                current += char;
            }
        }
        for (let tr of this._transitionsSection(current, spec)) {
            out.push(tr);
        }
        return out;
    }

    static readonly T_BITWISE_LITERAL: Matcher = [/^!?([&|^]|->|<-)/, 'bitwise literal'];

    // https://codegolf.stackexchange.com/questions/24983/build-a-2-way-universal-logic-processor-using-nand-logic-gates
    // format in left to right order: bit 0 = 00, bit 1 = 01, bit 2 = 10, bit 3 = 11
    static readonly ULP_MASKS: {[key: string]: number} = {
        '&': 0b0001,
        '|': 0b0111,
        '^': 0b0110,
        '!&': 0b1110,
        '!|': 0b1000,
        '!^': 0b1001,
        '->': 0b1101,
        '<-': 0b1011,
        '!->': 0b0010,
        '!<-': 0b0100,
    };

    bitwiseLiteral(): Symmetry {
        let value = this.eat(SymmetryParser.T_BITWISE_LITERAL)[0];
        let operator = '';
        if (value.startsWith('!')) {
            operator += '!';
            value = value.slice(1);
        }
        if (value.startsWith('->') || value.startsWith('<-')) {
            operator += value.slice(0, 2);
            value = value.slice(2);
        } else {
            operator += value[0];
            value = value.slice(1);
        }
        let ulpMask = SymmetryParser.ULP_MASKS[operator];
        let u00 = (ulpMask & 0b1000) ? 0xFFFFFFFF : 0;
        let u01 = (ulpMask & 0b0100) ? 0xFFFFFFFF : 0;
        let u10 = (ulpMask & 0b0010) ? 0xFFFFFFFF : 0;
        let u11 = (ulpMask & 0b0001) ? 0xFFFFFFFF : 0;
        return this.transitions(value).map(tr2 => (tr => 
            ((~tr & ~tr2) & u00) |
            ((~tr & tr2) & u01) |
            ((tr & ~tr2) & u10) |
            ((tr & tr2) & u11)
        ));
    }

    static readonly PERMUTATION_POSITIONS: {[key: string]: number} = {
        'nw': 0,
        'n': 1,
        'ne': 2,
        'w': 3,
        'c': 4,
        'e': 5,
        'sw': 6,
        's': 7,
        'se': 8,
        'r': 9,
        'x': 10,
    };

    permutationLiteral(): Symmetry {
        this.eat(['[', 'left bracket']);
        let startPos = this.pos;
        let value = '';
        while (!(this.match(']') || this.match(EOF))) {
            value += this.advance();
        }
        this.eat([']', 'closing bracket']);
        let posOffset = startPos - this.pos;
        let perm: number[] = [];
        let mask = 0;
        for (let i = 0; i < value.length; i++) {
            let char = value[i];
            if (' _.,'.includes(char)) {
                continue;
            }
            if (char === '0' || char === '1') {
                perm.push(-1);
                if (Number(char) === 1) {
                    mask |= (1 << (10 - i));
                }
            }
            if (char === 'n' || char === 's') {
                let next = value[i + 1];
                if (next === 'w' || next === 'e') {
                    char += next;
                    i++;
                }
            }
            if (!(char in SymmetryParser.PERMUTATION_POSITIONS)) {
                this.error(`Invalid permutation cell position: '${char}'`, -posOffset);
            } else {
                perm.push(SymmetryParser.PERMUTATION_POSITIONS[char]);
            }
        }
        if (perm.length === 9) {
            perm.push(9);
        }
        if (perm.length !== 10) {
            this.error(`Invalid permutation (parsed length is not 9 or 10)`, -posOffset);
        }
        let shifts: number[] = [];
        for (let i = 0; i < 10; i++) {
            shifts.push(i - perm.indexOf(i));
        }
        return [tr => {
            return mask
                 | leftShift(tr & 0b100_000_000_0, shifts[0])
                 | leftShift(tr & 0b010_000_000_0, shifts[1])
                 | leftShift(tr & 0b001_000_000_0, shifts[2])
                 | leftShift(tr & 0b000_100_000_0, shifts[3])
                 | leftShift(tr & 0b000_010_000_0, shifts[4])
                 | leftShift(tr & 0b000_001_000_0, shifts[5])
                 | leftShift(tr & 0b000_000_100_0, shifts[6])
                 | leftShift(tr & 0b000_000_010_0, shifts[7])
                 | leftShift(tr & 0b000_000_001_0, shifts[8])
                 | leftShift(tr & 0b000_000_000_1, shifts[9])
            ;
        }];
    }

    static readonly T_IDENTIFIER: Matcher = [/[a-zA-Z_][a-zA-Z0-9_]*/, 'identifier'];

    identifier(): string {
        let out = this.eat(SymmetryParser.T_IDENTIFIER)[0];
        if (out === '__proto__') {
            this.error(`Identifier cannot be '__proto__'`, -1);
        } else if (out === 'constructor') {
            this.error(`Identifier cannot be 'constructor'`, -1);
        }
        return out;
    }

    literal(): Symmetry {
        if (this.match(SymmetryParser.T_BITWISE_LITERAL)) {
            return this.bitwiseLiteral();
        } else if (this.match('[')) {
            return this.permutationLiteral();
        } else if (this.match(SymmetryParser.T_IDENTIFIER)) {
            let id = this.identifier();
            if (id in this.namespace) {
                return this.namespace[id];
            } else {
                this.error(`Name ${id} is not defined`, -1);
            }
        } else {
            this.error(`Invalid literal or identifier`);   
        }
    }

    expression(): Symmetry {
        if (this.match('(')) {
            let out = this.expression();
            this.eat([')', 'right parenthesis']);
            return out;
        }
        let out = this.literal();
        while (true) {
            if (this.match(',')) {
                this.advance();
                for (let value of this.expression()) {
                    out.push(value);
                }
            } else if (this.match('(')) {
                this.advance();
                let args: Symmetry = [];
                while (!this.match(')')) {
                    for (let func of this.expression()) {
                        args.push(func);
                    }
                }
                let newOut: Symmetry = [];
                for (let func of out) {
                    for (let func2 of args) {
                        newOut.push(tr => func(func2(tr)));
                    }
                }
                out = newOut;
            } else {
                break;
            }
        }
        return out;
    }

    variableSet(): void {
        let id = this.identifier();
        this.eat(['=', 'equals sign']);
        this.namespace[id] = this.expression();
    }

    static readonly T_LINE_END: Matcher = [new Set(['\n', ';', EOF]), 'line end'];

    statement(): Symmetry | undefined {
        if (this.match(SymmetryParser.T_LINE_END)) {
            this.advance();
            return;
        }
        let out: Symmetry | undefined;
        if (this.match(SymmetryParser.T_IDENTIFIER, '=')) {
            this.variableSet();
        } else {
            out = this.expression();
        }
        this.eat(SymmetryParser.T_LINE_END);
        return out;
    }

    block(): Symmetry | undefined {
        let out: Symmetry | undefined;
        while (!this.match(EOF)) {
            out = this.statement();
        }
        return out;
    }

    program(): Symmetry | undefined {
        return this.block();
    }

}


const PREDEFINED_SYMMETRIES = `
[sw,s,se,w,c,e,nw,n,ne]
`;

let parser = new SymmetryParser(PREDEFINED_SYMMETRIES);
parser.program();
export const PREDEFINED_SYMMETRY_NAMESPACE = parser.namespace;
