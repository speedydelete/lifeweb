
import {Matcher, EOF, ParserPosition, ParserError, BaseParser, RuleError, RuleSymmetry, INTSpec, INT, HEX_INT, VON_NEUMANN_INT, INT_SPECS, parseTransitions, unparseTransitions, findTransitionsSymmetry, findTransitionsNeighborhood, parseMAPRuleFull, unparseMAPRuleFull} from '../core/index.js';


// transition format:
// 0b_abc_def_ghi_j
// abc
// def -> j
// ghi

export type TransitionClass = 'A' | 'B' | 'S' | 'D';

export const TRANSITION_CLASSES = new Set(['A', 'B', 'S', 'D'] as TransitionClass[]);

export const TRANSITION_CLASS_ORS: {[K in TransitionClass]: number} = {
    'A': 0b000_000_000_0,
    'B': 0b000_000_000_1,
    'D': 0b000_010_000_0,
    'S': 0b000_010_000_1,
};

export type SymmetryTable = Uint16Array;
export type Symmetry = SymmetryTable[];

export type Vector = number[];
export type Basis = Vector[];


export function transitionToMAPString(tr: number): string {
    let str = tr.toString(2).padStart(10, '0');
    return str.slice(0, 3) + '.' + str.slice(3, 6) + '.' + str.slice(6, 9) + '.' + str.slice(9);
}

export function classifyTransition(tr: number): TransitionClass {
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


export function functionToSymmetry(func: (tr: number) => number): Symmetry {
    let out = new Uint16Array(1024);
    for (let tr = 0; tr < 1024; tr++) {
        out[tr] = func(tr);
    }
    return [out];
}

export function optimizeSymmetry(symmetry: Symmetry): Symmetry {
    let done = new Set<string>();
    let out: Symmetry = [];
    for (let table of symmetry) {
        let key = table.join('');
        if (done.has(key)) {
            continue;
        }
        done.add(key);
        out.push(table);
    }
    return out;
}


export function swapVector(vector: Vector): Vector {
    return vector.map(x => x ^ 1);
}

export function vectorSorter(x: number, y: number): number {
    let xC = classifyTransition(x);
    let yC = classifyTransition(y);
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

export function trNumBasisSorter(x: Vector, y: Vector): number {
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        let value = vectorSorter(x[i], y[i]);
        if (value !== 0) {
            return value;
        }
    }
    return x.length - y.length;
}

export function normalizeBasis(basis: Basis, formats?: VectorFormatSpec): Basis {
    let basisSorter: Parameters<Basis['sort']>[0] = formats ? ((x, y) => stringBasisSorter(x, y, formats)) : trNumBasisSorter;
    basis = basis.map(vector => vector.slice().sort(vectorSorter)).sort(basisSorter);
    let out: Basis = [];
    let done = new Set<string>();
    for (let vector of basis) {
        vector = vector.slice().sort(vectorSorter);
        vector = [vector, swapVector(vector).sort(vectorSorter)].sort()[0];
        let key = vector.join(',');
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
export const DEFAULT_BASIS_VECTOR_FORMAT_SPECS: VectorFormat[] = ['int', 'hex', 'map'];
const BASIS_VECTOR_FORMAT_INT_SPECS: {[K in 'int' | 'hex' | 'vn']: INTSpec} = {'int': INT, 'hex': HEX_INT, 'vn': VON_NEUMANN_INT};

function attemptINTSpecReplace(vector: Vector, spec: INTSpec): [string[], Vector] {
    vector = vector.slice();
    let out: string[] = [];
    for (let key in spec.trs) {
        for (let [letter, or] of Object.entries(TRANSITION_CLASS_ORS)) {
            if (spec.trs[key].every(tr => vector.includes((tr << 1) | or))) {
                out.push(letter + key);
                for (let tr of spec.trs[key]) {
                    tr = ((tr << 1) | or);
                    let index = vector.indexOf(tr);
                    if (index === -1) {
                        throw new Error(`This error should not occur, please report it (cannot find tr in vector)`);
                    }
                    vector.splice(index, 1);
                }
            }
        }
    }
    return [out, vector];
}

function formatVector(vector: Vector, format: VectorFormat): string {
    vector = vector.slice();
    if (format === 'map') {
        return vector.sort(vectorSorter).map(tr => classifyTransition(tr) + transitionToMAPString(tr).slice(0, -2)).join(', ');
    }
    let spec = BASIS_VECTOR_FORMAT_INT_SPECS[format];
    let value = attemptINTSpecReplace(vector, spec);
    let classes: {[K in TransitionClass]: string[]} = {'B': [], 'S': [], 'A': [], 'D': []};
    for (let tr of value[0]) {
        classes[tr[0] as TransitionClass].push(tr.slice(1));
    }
    let extraClasses: {[K in TransitionClass]: string[]} = {'B': [], 'S': [], 'A': [], 'D': []};
    for (let tr of value[1]) {
        let cls = classifyTransition(tr);
        extraClasses[cls].push(cls + transitionToMAPString(tr).slice(0, -2));
    }
    let out = '';
    if (classes['B'].length > 0 || classes['S'].length > 0 || extraClasses['B'].length > 0 || extraClasses['S'].length > 0) {
        if (classes['B'].length > 0) {
            out += `B${unparseTransitions(classes['B'], spec)}`;
            if (classes['S'].length > 0) {
                out += '/';
            } else {
                out += spec.after;
            }
        }
        if (classes['S'].length > 0) {
            out += `S${unparseTransitions(classes['S'], spec)}${spec.after}`;
        }
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
        if (classes['A'].length > 0) {
            out += `A${unparseTransitions(classes['A'], spec)}`;
            if (classes['D'].length > 0) {
                out += '/';
            } else {
                out += spec.after;
            }
        }
        if (classes['D'].length > 0) {
            out += `D${unparseTransitions(classes['D'], spec)}${spec.after}`;
        }
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

export function vectorToString(vector: Vector, formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): string {
    if (vector.length === 0) {
        return '<empty vector>';
    }
    let sorted = formats.slice().flat().filter(format => format !== 'map').map(format => {
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

export function stringBasisSorter(x: Vector, y: Vector, formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): number {
    let xStr = vectorToString(x, formats);
    let yStr = vectorToString(y, formats);
    if (xStr < yStr) {
        return -1;
    } else if (xStr > yStr) {
        return 1;
    } else {
        return 0;
    }
}

export function basisToString(basis: Basis, formats: VectorFormatSpec = DEFAULT_BASIS_VECTOR_FORMAT_SPECS): string {
    return normalizeBasis(basis, formats).map(vector => vectorToString(vector, formats)).sort().join('\n');
}

function _vectorsToRule(trs: Uint8Array, vectors: Iterable<Vector>, xor: number): string | undefined {
    for (let vector of vectors) {
        for (let longTr of vector) {
            longTr ^= xor;
            let next = longTr & 1;
            let tr = longTr >> 1;
            let value = trs[tr];
            if (value === 2) {
                trs[tr] = next;
            } else if (value !== next) {
                return 'contradiction';
            }
        }
    }
}

export function vectorsToRule(enabled: Iterable<Vector>, disabled: Iterable<Vector>): string {
    let trs = new Uint8Array(512);
    trs.fill(2);
    _vectorsToRule(trs, enabled, 0);
    _vectorsToRule(trs, disabled, 1);
    for (let i = 0; i < trs.length; i++) {
        if (trs[i] === 2) {
            trs[i] = 0;
        }
    }
    return unparseMAPRuleFull(trs, 2);
}


export const IDENTITY = functionToSymmetry(tr => tr);

export function findBasis(symmetry: Symmetry): Basis | string {
    symmetry = optimizeSymmetry(IDENTITY.concat(symmetry));
    let out: Basis = [];
    let done: {[key: number]: Vector} = {};
    for (let tr = 0; tr < 1024; tr++) {
        let foundTrs = new Set<number>();
        let foundVectors: Vector[] = [];
        for (let table of symmetry) {
            let tr2 = table[tr];
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


export class SymmetryError extends ParserError {

    name: string = 'SymmetryError';
    [Symbol.toStringTag]: string = 'SymmetryError';

    constructor(message: string, stackPositions: ParserPosition[], nameOverride?: string) {
        super(message, stackPositions, nameOverride ?? 'SymmetryError');
    }

}


// https://codegolf.stackexchange.com/questions/24983/build-a-2-way-universal-logic-processor-using-nand-logic-gates
// format in left to right order: bit 0 = 00, bit 1 = 01, bit 2 = 10, bit 3 = 11
const ULP_MASKS: {[key: string]: number} = {
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
    '=': 0b1001,
    '!=': 0b0110,
};

function evalULP(x: number, y: number, mask: number): number {
    return 0
        | ((~x & ~y) & ((mask & 0b1000) ? 0xffffffff : 0))
        | ((~x & y) & ((mask & 0b0100) ? 0xffffffff : 0))
        | ((x & ~y) & ((mask & 0b0010) ? 0xffffffff : 0))
        | ((x & y) & ((mask & 0b0001) ? 0xffffffff : 0));
}


type Operation = {type: 'value', value: number} | {type: 'get', index: number} | {type: 'ulp', mask: number, x: Operation, y: Operation};

const CELL_POSITIONS: {[key: string]: number} = {
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
};

const T_CELL_POSITION: Matcher = [/^[ns][we]?|[wce]|r$/, 'cell position'];

function runOperation(op: Operation, tr: number): number {
    if (op.type === 'value') {
        return op.value;
    } else if (op.type === 'get') {
        return (tr & (1 << (9 - op.index))) ? 1 : 0;
    } else if (op.type === 'ulp') {
        return evalULP(runOperation(op.x, tr), runOperation(op.y, tr), op.mask);
    } else {
        throw new Error(`Bad operation type: '${(op as any).type}'`);
    }
}


export class SymmetryParser extends BaseParser {

    static ParserError = SymmetryError;

    namespace: {[key: string]: Symmetry};

    constructor(code: string, namespace: {[key: string]: Symmetry} = Object.create(null)) {
        super(undefined, code);
        this.namespace = namespace;
    }

    static readonly SPECIAL_VALUES = new Set(['\n', ';', '=', ',', '(', ')', '[', ']', '!', '&', '|', '^', '!&', '!|', '!^', '->' ,'<-', '!->', '!<-', '!=', '{', '}', '?', ':']);

    tokenize(code: string): void {
        let current = '';
        let startPos = 0;
        for (let pos = 0; pos < code.length; pos++) {
            let char = code[pos];
            if (char === ' ') {
                if (current.length === 0) {
                    startPos++;
                } else {
                    current += char;
                }
                continue;
            } else if (char === '/' && code[pos + 1] === '/') {
                while (pos < code.length && code[pos] !== '\n') {
                    pos++;
                }
                continue;
            } else if (pos < code.length - 2 && SymmetryParser.SPECIAL_VALUES.has(char + code[pos + 1] + code[pos + 2])) {
                if (current.length > 0) {
                    this.addToken(current.trimEnd(), startPos);
                }
                this.addToken(char + code[pos + 1] + code[pos + 2], pos);
                current = '';
                startPos = pos + 3;
                pos += 2;
            } else if (pos < code.length - 1 && SymmetryParser.SPECIAL_VALUES.has(char + code[pos + 1])) {
                if (current.length > 0) {
                    this.addToken(current.trimEnd(), startPos);
                }
                this.addToken(char + code[pos + 1], pos);
                current = '';
                startPos = pos + 2;
                pos++;
            } else if (SymmetryParser.SPECIAL_VALUES.has(char)) {
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

    static readonly T_IDENTIFIER: Matcher = [/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'identifier'];

    identifier(): string {
        let out = this.eat(SymmetryParser.T_IDENTIFIER)[0];
        if (out === '__proto__') {
            this.error(`Identifier cannot be '__proto__'`, -1);
        } else if (out === 'constructor') {
            this.error(`Identifier cannot be 'constructor'`, -1);
        }
        return out;
    }

    _transitionsSection(value: string, spec: INTSpec): number[] {
        if (value === '') {
            return [];
        }
        let hasClass = false;
        let or = 0;
        let maybeClass = value[0].toUpperCase() as TransitionClass;
        if (TRANSITION_CLASSES.has(maybeClass)) {
            hasClass = true;
            or = TRANSITION_CLASS_ORS[maybeClass];
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
                this.error(`No transition class provided for transitions`, -1);
            }
            value = value.toLowerCase();
            let out: number[] = [];
            try {
                for (let key of parseTransitions(value, spec)) {
                    for (let tr of spec.trs[key]) {
                        out.push((tr << 1) | or);
                    }
                }
            } catch (error) {
                if (error instanceof RuleError) {
                    this.error(error.message);
                } else {
                    throw error;
                }
            }
            return out;
        }
    }

    transitions(value: string): number[] {
        let spec = INT;
        if (value.length > 0) {
            let lastChar = value[value.length - 1].toUpperCase();
            if (lastChar in INT_SPECS) {
                spec = INT_SPECS[lastChar as keyof typeof INT_SPECS];
                value = value.slice(0, -1);
            }
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

    static readonly T_BITWISE_OPERATOR: Matcher = [new Set(['&', '|', '^', '!&', '!|', '!^', '->', '<-', '!->', '!<-']), 'bitwise operator'];

    bitwiseLiteral(): Symmetry {
        let operator = this.eat(SymmetryParser.T_BITWISE_OPERATOR)[0];
        let value = this.advance();
        let mask = ULP_MASKS[operator];
        let out: Symmetry = [];
        for (let tr of this.transitions(value)) {
            let table = new Uint16Array(1024);
            for (let i = 0; i < 1024; i++) {
                table[i] = evalULP(tr, i, mask);
            }
            out.push(table);
        }
        return optimizeSymmetry(out);
    }

    operationLiteral(): Operation {
        if (this.match('0') || this.match('1')) {
            return {type: 'value', value: Number(this.advance())};
        } else if (this.match(T_CELL_POSITION)) {
            return {type: 'get', index: CELL_POSITIONS[this.advance()]};
        } else {
            this.error(`Expected 0, 1, or a cell position, got '${this.nextTokenToString()}'`);
        }
    }

    operation(): Operation {
        let out: Operation;
        if (this.match('(')) {
            this.advance();
            out = this.operation();
            this.eat([')', 'right parenthesis']);
        } else {
            out = this.operationLiteral();
        }
        while (this.match(SymmetryParser.T_BITWISE_OPERATOR) || this.match('=') || this.match('!=')) {
            let op = this.advance();
            let right = this.operation();
            out = {
                type: 'ulp',
                mask: ULP_MASKS[op],
                x: out,
                y: right,
            };
        }
        return out;
    }

    permutationLiteral(): Symmetry {
        this.eat(['[', 'left bracket']);
        let perm: Operation[] = [];
        for (let i = 0; i < 10; i++) {
            perm.push({type: 'get', index: i});
        }
        let pos = 0;
        while (true) {
            if (this.match(']')) {
                this.advance();
                break;
            } else if (this.match(T_CELL_POSITION, '=')) {
                let cell = CELL_POSITIONS[this.advance()];
                this.advance();
                perm[cell] = this.operation();
            } else {
                perm[pos] = this.operationLiteral();
            }
            if (this.match(']')) {
                this.advance();
                break;
            } else {
                this.eat([',', 'comma']);
                pos = (pos + 1) % 10;
            }
        }
        let out = new Uint16Array(1024);
        for (let tr = 0; tr < 1024; tr++) {
            let value = 0;
            for (let bit = 0; bit < 10; bit++) {
                value |= (runOperation(perm[bit], tr) << (9 - bit));
            }
            out[tr] = value;
        }
        return [out];
    }

    literal(): Symmetry {
        if (this.match(SymmetryParser.T_BITWISE_OPERATOR)) {
            return this.bitwiseLiteral();
        } else if (this.match('[')) {
            return this.permutationLiteral();
        } else if (this.match(SymmetryParser.T_IDENTIFIER)) {
            let id = this.identifier();
            if (id in this.namespace) {
                return this.namespace[id].slice();
            } else {
                this.error(`Name ${id} is not defined`, -1);
            }
        } else {
            this.error(`Invalid literal or identifier: '${this.nextTokenToString()}'`);   
        }
    }

    expression(): Symmetry {
        if (this.match(SymmetryParser.T_LINE_END)) {
            return [];
        }
        if (this.match('{')) {
            this.advance();
            let cond = this.operation();
            this.eat(['}', 'closing brace']);
            this.eat(['?', 'question mark']);
            let ifTrue = this.expression();
            this.eat([':', 'colon']);
            let ifFalse = this.expression();
            let tables = Math.max(ifTrue.length, ifFalse.length);
            let out: Symmetry = [];
            for (let i = 0; i < tables; i++) {
                out.push(new Uint16Array(1024));
            }
            for (let tr = 0; tr < 1024; tr++) {
                for (let i = 0; i < tables; i++) {
                    out[i][tr] = (((runOperation(cond, tr) & 1) ? ifTrue : ifFalse)[i] ?? IDENTITY)[tr];
                }
            }
            return out;
        }
        if (this.match('(')) {
            this.advance();
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
                while (!(this.match(')') || this.match(EOF))) {
                    for (let func of this.expression()) {
                        args.push(func);
                    }
                }
                this.eat([')', 'right parenthesis']);
                let newOut: Symmetry = [];
                for (let table1 of out) {
                    for (let table2 of args) {
                        let newTable = new Uint16Array(1024);
                        for (let tr = 0; tr < 1024; tr++) {
                            newTable[tr] = table1[table2[tr]];
                        }
                        newOut.push(newTable);
                    }
                }
                out = newOut;
            } else if (this.match(SymmetryParser.T_BITWISE_OPERATOR)) {
                let left = out;
                let op = this.advance();
                let right: Symmetry;
                if (this.match('(')) {
                    this.advance();
                    right = this.expression();
                    this.eat([')', 'right parenthesis']);
                } else {
                    right = this.literal();
                }
                let tables = Math.max(out.length, right.length);
                let out2: Symmetry = [];
                for (let tr = 0; tr < 1024; tr++) {
                    for (let i = 0; i < tables; i++) {
                        let x = left[i]?.[tr];
                        let y = right[i]?.[tr];
                        if (x !== undefined && y !== undefined) {
                            out2[i][tr] = evalULP(x, y, ULP_MASKS[op]);
                        } else {
                            out2[i][tr] = x ?? y;
                        }
                    }
                }
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

none = []

moore = []
vonNeumann = [nw=0, ne=0, sw=0, se=0]
hexagonal = [ne=0, sw=0]
tripod = [n=0, ne=0, w=0, sw=0, se=0]
noCenter = [c=0]
onlyCenter = [nw=0, n=0, ne=0, w=0, e=0, sw=0, s=0, se=0]

VN = vonNeumann
hex = hexagonal

identity = [nw,n,ne, w,c,e, sw,s,se]

rotate180 = [se,s,sw, e,c,w, ne,n,nw]
rotate90Left = [ne,e,se, n,c,s, nw,w,sw]
rotate90Right = [sw,w,nw, s,c,n, se,e,ne]
flipHorizontal = [ne,n,nw, e,c,w, se,s,sw]
flipVertical = [sw,s,se, w,c,e, nw,n,ne]
flipDiagonal = [nw,w,sw, n,c,s, ne,e,se]
flipAntiDiagonal = [se,e,ne, s,c,n, sw,w,nw]

rotateLeft = rotate90Left
rotateRight = rotate90Right

rotate8Left = [n,ne,e, nw,c,se, w,sw,s]
rotate8Right = [w,nw,n, sw,c,ne, s,se,e]

C1 = identity
C2 = rotate180
C4 = rotateLeft
C8 = rotate8Left
D2h = flipHorizontal
D2v = flipVertical
D2b = flipDiagonal
D2s = flipAntiDiagonal
D4p = D2h, D2v
D4x = D2b, D2h
D8 = C4, D2h

rotate2 = C2
rotate4 = C4
rotate8 = rotate8Left
rotate2reflect = D4p
rotate4reflect = D8
rotate8reflect = rotate8, flipVertical

INT = D8

F = identity
Fx = flipVertical
L = rotateLeft
Lx = flipAntiDiagonal
B = rotate180
Bx = flipHorizontal
R = rotateRight
Rx = flipDiagonal

rotate120Left = [e,se,0, n,c,s, 0,n,nw]
rotate120Right = [s,w,0, se,c,nw, 0,e,n]
rotate60Left = [n,e,0, nw,c,se, 0,w,s]
rotate60Right = [w,nw,0, s,c,n, 0,se,e]

rotate120 = rotate120Left
rotate60 = rotate60Left

C3 = rotate120
C6 = rotate60

hexC3 = C3
hexC6 = C6

rotate3 = C3
rotate6 = C6
// rotate6reflect = D12

outerTotalistic = rotate8Left, [nw=n, n=nw]
OT = outerTotalistic
permute = outerTotalistic
totalistic = outerTotalistic, [n=c, c=n]

D8_2 = {(nw = ne) & (w = e) & (sw = se)} ? [nw=n, w=c, sw=s] : identity

`;

export const PREDEFINED_SYMMETRY_NAMESPACE: {[key: string]: Symmetry} = Object.create(null);
let parser = new SymmetryParser(PREDEFINED_SYMMETRIES, PREDEFINED_SYMMETRY_NAMESPACE);
parser.program();


export function parseSymmetry(data: string): Symmetry {
    let parser = new SymmetryParser(data, PREDEFINED_SYMMETRY_NAMESPACE);
    let out = parser.program();
    if (out === undefined) {
        parser.error('No return value found');
        // TYPESCRIPT WTF THIS IS UNREACHABLE CODE
        throw new Error('THIS ERROR SHOULD DEFINITELY NOT OCCUR, PLEASE REPORT IT');
    }
    return out;
}


export const REVERSE_PREDEFINED_SYMMETRIES: {[key: string]: string} = {};
for (let [key, value] of Object.entries(PREDEFINED_SYMMETRY_NAMESPACE)) {
    let textTables = value.map(table => table.join('')).sort().join(', ');
    if (!(textTables in REVERSE_PREDEFINED_SYMMETRIES)) {
        REVERSE_PREDEFINED_SYMMETRIES[textTables] = key;
    }
}

function tryReplaceWithPredefined(symmetryStr: string): string {
    let symmetry = parseSymmetry(symmetryStr);
    let textTables = symmetry.map(table => table.join('')).sort().join(', ');
    if (textTables in REVERSE_PREDEFINED_SYMMETRIES) {
        return REVERSE_PREDEFINED_SYMMETRIES[textTables];
    } else {
        return symmetryStr;
    }
}


export function xorTransitionsToString(trs: Set<number>): string[] {
    trs = new Set(Array.from(trs).sort(vectorSorter));
    let out: string[] = [];
    for (let spec of [INT, HEX_INT]) {
        for (let letter of TRANSITION_CLASSES) {
            let or = TRANSITION_CLASS_ORS[letter];
            for (let [trName, values] of Object.entries(spec.trs)) {
                if (trName === '0c' || trName === '8c') {
                    trName = trName[0];
                }
                let found = false;
                for (let tr of values) {
                    tr = (tr << 1) | or;
                    if (trs.has(tr)) {
                        trs.delete(tr);
                    } else {
                        found = true;
                    }
                }
                if (!found) {
                    out.push(tryReplaceWithPredefined(`^${letter}${trName}${spec.after}`));
                }
            }
        }
    }
    for (let tr of Array.from(trs).sort(vectorSorter)) {
        out.push(transitionToString(tr));
    }
    return out.filter(x => x !== 'none');
}


const NEIGHBORHOOD_CELLS: {[key: string]: string} = {
    '-1,-1': 'nw',
    '-1,0': 'w',
    '-1,1': 'sw',
    '0,-1': 'n',
    '0,0': 'c',
    '0,1': 's',
    '1,-1': 'ne',
    '1,0': 'e',
    '1,1': 'se',
};

const FULL_NEIGHBORHOOD = ['nw', 'n', 'ne', 'w', 'c', 'e', 'sw', 's', 'se'];

const STATIC_SYMMETRIES: {[K in RuleSymmetry]: string} = {
    'C1': 'C1',
    'C2': 'C2',
    'C4': 'C4',
    'D2|': 'D2h',
    'D2-': 'D2v',
    'D2/': 'D2s',
    'D2\\': 'D2b',
    'D4+': 'D4p',
    'D4x': 'D4x',
    'D8': 'D8',
};

export function getSymmetriesOfRule(rule: string): string {
    let out: string[] = [];
    let trs = parseMAPRuleFull(rule).trs;
    // neighborhood restriction
    let nh = findTransitionsNeighborhood(trs).map(cell => NEIGHBORHOOD_CELLS[cell.join(',')]);
    if (nh.length !== 9) {
        let notNH = new Set(FULL_NEIGHBORHOOD);
        for (let value of nh) {
            notNH.delete(value);
        }
        let str = `[${Array.from(notNH).map(cell => `${cell}=0`).join(', ')}]`;
        out.push(tryReplaceWithPredefined(str));
    }
    // static symmetries
    out.push(tryReplaceWithPredefined(STATIC_SYMMETRIES[findTransitionsSymmetry(trs)]));
    // XOR symmetries
    let xorTrs = new Set<number>();
    for (let xorTr = 0; xorTr < 1024; xorTr++) {
        let mask = xorTr >> 1;
        let next = xorTr & 1;
        let found = false;
        for (let tr = 0; tr < 512; tr++) {
            if (trs[tr ^ mask] !== (trs[tr] ^ next)) {
                found = true;
                break;
            }
        }
        if (!found) {
            xorTrs.add(xorTr);
        }
    }
    for (let str of xorTransitionsToString(xorTrs)) {
        out.push(str);
    }
    return out.filter(x => x !== 'none').join(', ');
}
