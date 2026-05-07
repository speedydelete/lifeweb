
import {RuleError, permutations} from './util.js';
import {RuleSymmetry, SYMMETRY_JOIN, Rule, DataPattern} from './pattern.js';


type Symmetry = RuleSymmetry | 'C8' | 'D16' | 'permute';

export interface TreeData {
    states: number;
    neighborhood: [number, number][];
    symmetry: RuleSymmetry;
    data: Uint32Array;
    originalData: number[][];
}

export interface TableData {
    states: number;
    neighborhood: [number, number][];
    symmetry: RuleSymmetry;
    trs: Uint8Array;
}

export interface AtRule {
    name?: string;
    desc?: string;
    tree?: TreeData;
    table?: TableData;
    names?: {[key: number]: string};
    colors?: {[key: number]: [number, number, number]};
    icons?: string;
}

const NEIGHBORHOODS: {[key: string]: [number, number][]} = {
    'moore': [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
    'vonneumann': [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]],
    'hexagonal': [[0, 0], [0, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1]],
    'onedimensional': [[0, 0], [-1, 0], [1, 0]],
};

const TREE_NEIGHBORHOOD: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]];

const SYMMETRIES: {[key: string]: Symmetry} = {
    'c1': 'C1',
    'c2': 'C2',
    'c4': 'C4',
    'c8': 'C8',
    'd2|': 'D2|',
    'd2-': 'D2-',
    'd2/': 'D2/',
    'd2\\': 'D2\\',
    'd4+': 'D4+',
    'd4x': 'D4x',
    'd8': 'D8',
    'd16': 'D16',
    'permute': 'permute',
    'rotate2': 'C2',
    'rotate2reflect': 'D4+',
    'rotate4': 'C4',
    'rotate4reflect': 'D8',
    'rotate8': 'C8',
    'rotate8reflect': 'D16',
};


/** Parses JSON loosely. Lifelib uses literal_eval for this, which is probably unsafe and doesn't exist in JS anyway. */
function parseJSONLoose(data: string): number[][] {
    let level = 0;
    let out: number[][] = [];
    let section: number[] = [];
    let num = '';
    for (let char of data.slice(1)) {
        if (char === '(' || char === '[') {
            level++;
        } else if (char === ')' || char === ']') {
            level--;
        } else if (char === ',') {
            if (level > 1) {
                section.push(Number(num));
            } else {
                out.push(section);
                section = [];
            }
        } else if (char === ' ') {
            continue;
        } else {
            num += char;
        }
    }
    if (num.trim() !== '') {
        section.push(Number(num));
    }
    if (section.length > 0) {
        out.push(section);
    }
    return out;
}

function parseTree(data: string): TreeData {
    let neighborhood: [number, number][] = NEIGHBORHOODS['moore'];
    let tree: [boolean, number[]][] = [];
    let originalData: number[][] = [];
    let length = 0;
    let states = 1;
    let symmetry: RuleSymmetry = 'C1';
    for (let line of data.split('\n')) {
        if (line.includes('=')) {
            let [cmd, arg] = line.split('=');
            cmd = cmd.trim();
            arg = arg.trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                neighborhood = parseJSONLoose(arg) as [number, number][];
                if (!neighborhood.every(x => x.length === 2)) {
                    throw new RuleError(`Invalid neighborhood: '${arg}'`);
                }
            } else if (cmd === 'num_neighbors') {
                let value = Number(arg);
                if (value === 4) {
                    neighborhood = NEIGHBORHOODS['vonneumann'];
                } else if (value === 8) {
                    neighborhood = NEIGHBORHOODS['moore'];
                } else {
                    throw new RuleError(`Invalid num_neighbors value: '${arg}'`);
                }
            } else if (cmd === 'symmetry') {
                if (!(arg in SYMMETRY_JOIN)) {
                    throw new RuleError(`Invalid rule symmetry: '${arg}'`);
                }
                symmetry = arg as RuleSymmetry;
            }
        } else {
            let values = line.split(' ').map(x => Number(x));
            originalData.push(values);
            let [depth, ...data] = values;
            if (depth === 1) {
                let newStates = Math.max(...data) + 1;
                if (newStates > states) {
                    states = newStates;
                }
            }
            tree.push([depth === 1, data]);
            length += data.length;
        }
    }
    let out = new Uint32Array(length);
    let i = 0;
    for (let [isLeaf, data] of tree) {
        for (let value of data) {
            out[i++] = isLeaf ? value * states : value;
        }
    }
    return {
        neighborhood,
        states,
        symmetry,
        data: out,
        originalData,
    };
}

const ANY = -1;
const LIVE = -2;

// the new center cell is the last value, the rest is in the neighborhood
type TableLine = (number | {bind: true, index: number} | (number | {bind: true, index: number})[])[];

type TableVars = {[key: string]: {value: TableLine, bind: boolean}};

interface TableSection {
    values: TableLine[];
    neighborhood: [number, number][];
    symmetry: Symmetry;
}

function parseBraceList(data: string, vars: TableVars): TableLine {
    let braceLevel = 0;
    let out: TableLine = [];
    let section: TableLine[number] = [];
    let value = '';
    let boundVars: {[key: string]: number} = {};
    let inBind = false;
    for (let char of data) {
        if (char === '{') {
            braceLevel++;
        } else if (char === '}') {
            if (value !== '') {
                if (value.match(/^\d+$/)) {
                    if (inBind) {
                        section.push({bind: true, index: Number(value)});
                    } else {
                        section.push(Number(value));
                    }
                } else {
                    if (inBind) {
                        throw new RuleError(`Cannot lookup variable binds`);
                    }
                    if (!(value in vars)) {
                        throw new RuleError(`Undeclared variable: '${value}'`);
                    }
                    if (value in boundVars) {
                        section.push({bind: true, index: boundVars[value]});
                    } else {
                        let data = vars[value];
                        if (braceLevel === 0) {
                            if (data.bind) {
                                boundVars[value] = out.length;
                            }
                            out.push(...data.value);
                        } else {
                            section.push(...data.value.flat());
                        }
                    }
                }
                value = '';
            }
            if (section.length > 0) {
                if (section.length === 1) {
                    out.push(section[0]);
                } else {
                    out.push(Array.from(new Set(section)));
                }
            }
            braceLevel--;
            if (braceLevel < 0) {
                braceLevel = 0;
            }
        } else if (char === '[') {
            inBind = true;
        } else if (char === ']') {
            inBind = false;
        } else if (char === ',') {
            value = value.trim();
            if (value !== '') {
                if (value.match(/^\d+$/)) {
                    if (inBind) {
                        section.push({bind: true, index: Number(value)});
                    } else {
                        section.push(Number(value));
                    }
                } else {
                    if (inBind) {
                        throw new RuleError(`Cannot lookup variable binds`);
                    }
                    if (!(value in vars)) {
                        throw new RuleError(`Undeclared variable: '${value}'`);
                    }
                    if (value in boundVars) {
                        section.push({bind: true, index: boundVars[value]});
                    } else {
                        let data = vars[value];
                        if (braceLevel === 0) {
                            if (data.bind) {
                                boundVars[value] = out.length;
                            }
                            out.push(...data.value);
                        } else {
                            section.push(...data.value.flat());
                        }
                    }
                }
                value = '';
            }
            if (braceLevel === 0 && section.length > 0) {
                out.push(Array.from(new Set(section)));
                section = [];
            }
        } else if (char === ' ') {
            continue;
        } else {
            value += char;
        }
    }
    if (value !== '') {
        if (value.match(/^\d+$/)) {
            if (inBind) {
                section.push({bind: true, index: Number(value)});
            } else {
                section.push(Number(value));
            }
        } else {
            if (inBind) {
                throw new RuleError(`Cannot lookup variable binds`);
            }
            if (!(value in vars)) {
                throw new RuleError(`Undeclared variable: '${value}'`);
            }
            if (value in boundVars) {
                section.push({bind: true, index: boundVars[value]});
            } else {
                let data = vars[value];
                if (braceLevel === 0) {
                    if (data.bind) {
                        boundVars[value] = out.length;
                    }
                    out.push(...data.value);
                } else {
                    section.push(...data.value.flat());
                }
            }
        }
        value = '';
    }
    if (section.length > 0) {
        out.push(Array.from(new Set(section)));
    }
    return out;
}

type Remapping<T> = ({ref: false, value: T} | {ref: true, value: number})[];

function combineRemappings<T>(a: Remapping<T>, b: Remapping<T>): Remapping<T> {
    let out: Remapping<T> = [];
    for (let i = 0; i < b.length; i++) {
        let value = b[i];
        if (value.ref) {
            out.push(a[value.value]);
        } else {
            out.push(value);
        }
    }
    return out;
}

function applyRemapping<T>(data: T[], remapping: Remapping<T>): T[] {
    let out: T[] = [];
    for (let i = 0; i < remapping.length; i++) {
        let value = remapping[i];
        if (value.ref) {
            out.push(data[value.value]);
        } else {
            out.push(value.value);
        }
    }
    out.push(data[data.length - 1]);
    return out;
}

function getNeighborhoodRemapping(old: [number, number][], nh: [number, number][]): Remapping<number> {
    let out: Remapping<number> = [];
    for (let i = 0; i < nh.length; i++) {
        out.push({ref: false, value: ANY});
    }
    for (let i = 0; i < old.length; i++) {
        let index = nh.findIndex(x => x[0] === old[i][0] && x[1] === old[i][1]);
        if (index === -1) {
            throw new RuleError(`Cannot use coordinate (${old[i][0]}, ${old[i][1]})`);
        }
        out[index] = {ref: true, value: i};
    }
    return out;
}

function getSymmetryRemapping(nh: [number, number][], f: (x: number, y: number) => [number, number]): Remapping<number> {
    let out: Remapping<number> = [];
    for (let i = 0; i < nh.length; i++) {
        let cell = nh[i];
        let cell2 = f(cell[0], cell[1]);
        let index = nh.findIndex(x => x[0] === cell2[0] && x[1] === cell2[1]);
        if (index === -1) {
            out.push({ref: false, value: ANY});
        } else {
            out.push({ref: true, value: index});
        }
    }
    return out;
}

function rotateC8(x: number, y: number): [number, number] {
    if (x === 0) {
        x = y;
    } else if (y === 0) {
        y = -x;
    } else if (Math.sign(x) !== Math.sign(y)) {
        x = 0;
    } else {
        y = 0;
    }
    return [x, y];
}

function getSymmetryRemappings(nh: [number, number][], symmetry: Symmetry): Remapping<number>[] {
    let out: Remapping<number>[] = [];
    if (symmetry === 'permute') {
        let center = nh.findIndex(([x, y]) => x === 0 && y === 0);
        let map: number[] = [center];
        for (let i = 0; i < nh.length; i++) {
            if (i !== center) {
                map.push(i);
            }
        }
        for (let perm of permutations(map.slice(1))) {
            perm.unshift(center);
            out.push(perm.map(x => ({ref: true, value: x})));
        }
        return out;
    }
    if (symmetry === 'C2' || symmetry === 'C4' || symmetry === 'C8' || symmetry === 'D4+' || symmetry === 'D4x' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [-x, -y]));
    }
    if (symmetry === 'C4' || symmetry === 'C8' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [y, -x]));
        out.push(getSymmetryRemapping(nh, (x, y) => [-y, x]));
    }
    if (symmetry === 'D2|' || symmetry === 'D4+' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [-x, y]));
    }
    if (symmetry === 'D2-' || symmetry === 'D4+' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [x, -y]));
    }
    if (symmetry === 'D2/' || symmetry === 'D4+' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [y, x]));
    }
    if (symmetry === 'D2\\' || symmetry === 'D4+' || symmetry === 'D8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => [-y, -x]));
    }
    if (symmetry === 'C8' || symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, rotateC8));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [y, -x];
        }));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [-x, -y];
        }));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [-y, x];
        }));
    }
    if (symmetry === 'D16') {
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [x, -y];
        }));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [y, x];
        }));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [-x, y];
        }));
        out.push(getSymmetryRemapping(nh, (x, y) => {
            [x, y] = rotateC8(x, y);
            return [-y, -x];
        }));
    }
    return out;
}

function expandBinds(data: TableLine, states: number, index: number = 0, prevBinds?: {[key: number]: number[]}): number[][] {
    let out: number[][] = [];
    if (Array.isArray(data[index])) {
        for (let value of data[index]) {
            let data2 = structuredClone(data);
            data2[index] = value;
            if (index === data.length - 1) {
                out.push(data2 as number[]);
            } else {
                out.push(...expandBinds(data2, states, index, prevBinds));
            }
        }
    } else if (typeof data[index] === 'number') {
        let value = data[index];
        if (value === ANY || value === LIVE) {
            for (let state = value === ANY ? 0 : 1; state < states; state++) {
                let data2 = structuredClone(data);
                data2[index] = state;
                if (prevBinds && index in prevBinds) {
                    for (let index2 of prevBinds[index]) {
                        data2[index2] = state;
                    }
                }
                if (index === data.length - 1) {
                    out.push(data2 as number[]);
                } else {
                    out.push(...expandBinds(data2, states, index + 1, prevBinds));
                }
            }
        } else {
            let data2 = structuredClone(data);
            data2[index] = value;
            if (prevBinds && index in prevBinds) {
                for (let index2 of prevBinds[index]) {
                    data2[index2] = value;
                }
            }
            if (index === data.length - 1) {
                out.push(data2 as number[]);
            } else {
                out.push(...expandBinds(data2, states, index + 1, prevBinds));
            }
        }
    } else {
        let value = data[index].index;
        if (value < index) {
            let data2 = structuredClone(data);
            data2[index] = data[value];
            if (index === data.length - 1) {
                throw new RuleError(`Unresolved bind`);
            } else {
                out.push(...expandBinds(data2, states, index + 1, prevBinds));
            }
            out.push(data2 as number[]);
        } else if (value === index) {
            throw new RuleError(`Recursive bind`);
        } else {
            if (!prevBinds) {
                prevBinds = [];
            }
            if (value in prevBinds) {
                prevBinds[value].push(index);
            } else {
                prevBinds[value] = [index];
            }
            if (index === data.length - 1) {
                throw new RuleError(`Unresolved bind`);
            } else {
                out.push(...expandBinds(data, states, index + 1, prevBinds));
            }
        }
    }
    return out;
}

function expandAny(data: number[], states: number, index: number = 0): number[][] {
    if (index >= data.length - 1) {
        return [data];
    } else if (data[index] === ANY) {
        let out: number[][] = [];
        for (let state = 0; state < states; state++) {
            let data2 = data.slice();
            data2[index] = state;
            out.push(...expandAny(data, states, index + 1));
        }
        return out;
    } else {
        return expandAny(data, states, index + 1);
    }
}

function resolveTableSection(data: TableSection, neighborhood: [number, number][], states: number): Uint8Array {
    let nhRemapping = getNeighborhoodRemapping(data.neighborhood, neighborhood);
    let remappings: Remapping<number>[] = [nhRemapping];
    for (let remapping of getSymmetryRemappings(neighborhood, data.symmetry)) {
        remappings.push(combineRemappings(nhRemapping, remapping));
    }
    let out: number[] = [];
    for (let unresolved of data.values) {
        for (let value of expandBinds(unresolved, states)) {
            for (let remapping of remappings) {
                for (let value2 of expandAny(applyRemapping(value, remapping), states)) {
                    out.push(...value2);
                }
            }
        }
    }
    return new Uint8Array(out);
}

function parseTable(data: string): TableData {
    let vars: TableVars = {'any': {value: [[ANY]], bind: false}, 'live': {value: [[LIVE]], bind: false}};
    let sections: TableSection[] = [];
    let current: TableLine[] = [];
    let neighborhood: [number, number][] = NEIGHBORHOODS['moore'];
    let symmetry: Symmetry = 'D8';
    let fullNeighborhood: [number, number][] = NEIGHBORHOODS['moore'].slice();
    let states = 0;
    for (let line of data.split('\n')) {
        if (line.includes(':')) {
            let index = line.indexOf(':');
            let cmd = line.slice(0, index);
            let arg = line.slice(index + 1).trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                sections.push({values: current, neighborhood, symmetry});
                if (arg.startsWith('(')) {
                    let list = parseJSONLoose(arg);
                    if (!list.every(x => x.length === 2)) {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                    neighborhood = list as [number, number][];
                } else {
                    let lower = arg.toLowerCase();
                    if (lower in NEIGHBORHOODS) {
                        neighborhood = NEIGHBORHOODS[lower];
                        if (current.length === 0) {
                            fullNeighborhood = neighborhood;
                        } else {
                            for (let [x, y] of neighborhood) {
                                if (!fullNeighborhood.some(cell => x === cell[0] && y === cell[1])) {
                                    fullNeighborhood.push([x, y]);
                                }
                            }
                        }
                    } else {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                }
                continue;
            } else if (cmd === 'symmetry' || cmd === 'symmetries') {
                sections.push({values: current, neighborhood, symmetry});
                symmetry = 'C1';
                for (let value of arg.split(',') as Symmetry[]) {
                    value = value.trim() as Symmetry;
                    let original = value;
                    value = value.toLowerCase() as Symmetry;
                    if (!(value in SYMMETRIES)) {
                        throw new RuleError(`Invalid symmetry: '${original}'`);
                    }
                    value = SYMMETRIES[value];
                    if (symmetry === 'permute') {
                        continue;
                    } else if (value === 'permute' || value === 'D16') {
                        symmetry = value;
                    } else if (symmetry === 'D16') {
                        continue;
                    } else if (value === 'C8') {
                        if (symmetry.startsWith('D')) {
                            symmetry = 'D16';
                        } else {
                            symmetry = value;
                        }
                    } else if (symmetry === 'C8') {
                        if (value.startsWith('D')) {
                            symmetry = 'D16';
                        }
                    } else {
                        symmetry = SYMMETRY_JOIN[symmetry][value];
                    }
                }
                continue;
            } else if (cmd === 'n_states' || cmd === 'states' || cmd === 'num_states') {
                continue;
            }
        }
        if (line.includes('=')) {
            let [name, value] = line.split('=');
            name = name.trim();
            let bind = false;
            if (name.startsWith('var ')) {
                bind = true;
                name = name.slice(4);
            }
            vars[name] = {bind, value: parseBraceList(value, vars)};
        } else if (line.match(/^\d+$/)) {
            let data = Array.from(line).map(Number);
            for (let value of data) {
                if (value + 1 > states) {
                    states = value + 1;
                }
            }
            current.push(data);
        } else {
            let data = parseBraceList(line, vars);
            for (let value of data) {
                if (typeof value === 'number') {
                    if (value + 1 > states) {
                        states = value + 1;
                    }
                } else if (Array.isArray(value)) {
                    for (let x of value) {
                        if (typeof x === 'number' && x + 1 > states) {
                            states = x + 1;
                        }
                    }
                }
            }
            current.push(data);
        }
    }
    if (current.length > 0) {
        sections.push({values: current, neighborhood, symmetry});
    }
    fullNeighborhood = TREE_NEIGHBORHOOD;
    let out: Uint8Array[] = [];
    let length = 0;
    let ruleSymmetry: RuleSymmetry = 'C1';
    for (let section of sections) {
        if (section.symmetry === 'permute' || section.symmetry === 'D16') {
            ruleSymmetry = 'D8';
        } else if (section.symmetry === 'C8') {
            ruleSymmetry = 'C4';
        } else {
            ruleSymmetry = SYMMETRY_JOIN[ruleSymmetry][section.symmetry];
        }
        let value = resolveTableSection(section, fullNeighborhood, states);
        out.push(value);
        length += value.length;
    }
    let trs = new Uint8Array(length);
    let i = 0;
    for (let array of out) {
        trs.set(array, i);
        i += array.length;
    }
    return {
        neighborhood,
        states,
        symmetry: ruleSymmetry,
        trs,
    };
}


function _functionToTree(cache: Map<string, number>, out: string[], nhLength: number, states: number, f: (cells: number[]) => number, prev: number[], index: number): number {
    if (prev.length === nhLength) {
        return f(prev);
    }
    let str = String(index);
    for (let i = 0; i < states; i++) {
        prev[index] = i;
        str += ' ' + _functionToTree(cache, out, nhLength, states, f, prev, index + 1);
    }
    let value = cache.get(str);
    if (value !== undefined) {
        return value;
    } else {
        let num = out.length;
        out.push(str);
        cache.set(str, num);
        return num;
    }
}

export function functionToTree(neighborhood: 'moore' | [number, number][], states: number, symmetry: RuleSymmetry, f: (cells: number[]) => number): string {
    let data: string[] = [];
    _functionToTree(new Map(), data, neighborhood.length, states, f, new Array(neighborhood.length), 0);
    let out = `@TREE\n\nnum_states = ${states}\n`;
    if (neighborhood === 'moore') {
        out += `num_neighbors = 8\n`;
    } else {
        out += `neighborhood = [${neighborhood.map(x => `(${x[0]}, ${x[1]})`).join(', ')}]\n`;
    }
    out += `num_nodes = ${data.length}\nsymmetry = ${symmetry}\n`;
    out += '\n' + data.map(x => x + '\n').join('');
    return out;
}


function tableCellLookup(table: TableData, cells: number[]): number {
    let nhLength = table.neighborhood.length;
    for (let i = 0; i < table.trs.length; i += nhLength + 1) {
        let found = false;
        for (let cell = 0; cell <= nhLength; cell++) {
            if (table.trs[i + cell] !== cells[i]) {
                found = true;
                break;
            }
        }
        if (!found) {
            return table.trs[i + nhLength];
        }
    }
    return cells.at(table.neighborhood.findIndex(x => x[0] === 0 && x[1] === 0)) ?? 0;
}

export function parseAtRule(rule: string): AtRule {
    let section = '';
    let out: AtRule = {};
    let data = '';
    for (let line of (rule + '\n@END').split('\n')) {
        line = line.trim();
        if (line === '' || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }
        if (!line.startsWith('@')) {
            if (data === '') {
                data = line;
            } else {
                data += '\n' + line;
            }
            continue;
        }
        console.log(section);
        if (section === '@TABLE') {
            if (out.table || out.tree) {
                continue;
            }
            let table = parseTable(data);
            out.table = table;
            out.tree = parseTree(functionToTree(table.neighborhood, table.states, table.symmetry, cells => tableCellLookup(table, cells)));
        } else if (section === '@TREE') {
            if (out.table || out.tree) {
                continue;
            }
            out.tree = parseTree(data);
        } else if (section ==='@NAMES') {
            out.names = {};
            for (let line of data.split('\n')) {
                let index = line.indexOf(' ');
                if (index === -1) {
                    continue;
                }
                out.names[Number(line.slice(0, index))] = line.slice(index + 1);
            }
        } else if (section === '@COLORS') {
            out.colors = {};
            for (let line of data.split('\n')) {
                let [state, r, g, b] = line.split(' ').filter(x => x);
                out.colors[Number(state)] = [Number(r), Number(g), Number(b)];
            }
        } else if (section === '@ICONS') {
            out.icons = data;
        }
        let args = line.split(' ');
        section = args[0];
        if (section === '@RULE') {
            if (args[1]) {
                out.name = args[1];
            }
        }
        data = '';
    }
    return out;
}

export function atRuleToString(rule: AtRule): string {
    let out = '';
    if (rule.name || rule.desc) {
        out += '@RULE';
        if (rule.name) {
            out += ' ' + rule.name;
        }
        out += '\n';
        if (rule.desc) {
            out += rule.desc + '\n';
        }
    }
    if (rule.tree) {
        out += `@TREE\n\nnum_states = ${rule.tree.states}\n`;
        if (JSON.stringify(rule.tree.neighborhood) !== JSON.stringify(NEIGHBORHOODS['moore'])) {
            out += `neighborhood = [${rule.tree.neighborhood.map(x => `(${x[0]}, ${x[1]})`).join(', ')}]\n`;
        } else {
            out += `num_neighbors = 8\n`;
        }
        out += `num_nodes = ${rule.tree.originalData.length}\nsymmetry = ${rule.tree.symmetry}\n\n`;
        out += rule.tree.originalData.map(x => x.join(' ') + '\n').join('') + '\n';
    }
    if (rule.names) {
        out += `@NAMES\n${Object.entries(rule.names).map(x => x[0] + x[1]).join('\n')}\n`;
    }
    if (rule.icons) {
        out += `@ICONS\n${rule.icons}\n`;
    }
    if (rule.colors) {
        out += `@COLORS\n${Object.entries(rule.colors).map(x => x.join(' ')).join('\n')}\n`;
    }
    return out;
}


export class TreePattern extends DataPattern {

    tree: Uint32Array;
    atRule: AtRule;

    constructor(height: number, width: number, data: Uint8Array, rule: Rule, tree: Uint32Array, atRule: AtRule) {
        super(height, width, data, rule);
        this.tree = tree;
        this.atRule = atRule;
    }

    lookupCell(nw: number, n: number, ne: number, w: number, c: number, e: number, sw: number, s: number, se: number): number {
        return this.tree[nw + this.tree[ne + this.tree[sw + this.tree[se + this.tree[n + this.tree[w + this.tree[e + this.tree[s + this.tree[c]]]]]]]]];
    }

    runGeneration(): void {
        // we first compute how it should expand, if at all
        // then we run the interior of the pattern
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let data = this.data;
        let trs = this.tree;
        let width2 = width << 1;
        let lastRow = size - width;
        let secondLastRow = size - width2;
        let expandUp = 0;
        let expandDown = 0;
        let upExpands = new Uint8Array(width);
        let downExpands = new Uint8Array(width);
        let cell: number;
        // this part is only for B1e and B2a rules
        if (width > 1) {
            cell = this.lookupCell(0, 0, 0, 0, 0, 0, 0, data[0], data[1]);
            if (cell) {
                expandUp = 1;
                upExpands[0] = cell;
            }
            cell = this.lookupCell(0, data[lastRow], data[lastRow + 1], 0, 0, 0, 0, 0, 0);
            if (cell) {
                expandDown = 1;
                downExpands[0] = cell;
            }
        } else {
            cell = this.lookupCell(0, 0, 0, 0, 0, 0, 0, data[0], 0);
            if (cell) {
                expandUp = 1;
                upExpands[0] = cell;
            }
            cell = this.lookupCell(0, data[lastRow], 0, 0, 0, 0, 0, 0, 0);
            if (cell) {
                expandDown = 1;
                downExpands[0] = cell;
            }
        }
        let i = 0;
        let j = lastRow;
        for (let loc = 1; loc < width - 1; loc++) {
            i++;
            j++;
            cell = this.lookupCell(0, 0, 0, 0, 0, 0, data[i - 1], data[i], data[i + 1]);
            if (cell) {
                expandUp = 1;
                upExpands[loc] = cell;
            }
            cell = this.lookupCell(data[j - 1], data[j], data[j + 1], 0, 0, 0, 0, 0, 0);
            if (cell) {
                expandUp = 1;
                upExpands[loc] = cell;
            }
        }
        // this part is only for B1e and B2a rules
        if (width > 1) {
            cell = this.lookupCell(0, 0, 0, 0, 0, 0, data[width - 2], data[width - 1], 0);
            if (cell) {
                expandUp = 1;
                upExpands[width - 1] = cell;
            }
            cell = this.lookupCell(data[size - 2], data[size - 1], 0, 0, 0, 0, 0, 0, 0);
            if (cell) {
                expandDown = 1;
                downExpands[width - 1] = cell;
            }
        }
        // we then compute how it should expand to the left and right
        let expandLeft = 0;
        let expandRight = 0;
        let leftExpands = new Uint8Array(height);
        let rightExpands = new Uint8Array(height);
        // this part is only for B1e and B2a rules
        if (height > 1) {
            cell = this.lookupCell(0, 0, 0, 0, 0, data[0], 0, 0, data[width]);
            if (cell) {
                expandLeft = 1;
                leftExpands[0] = cell;
            }
            cell = this.lookupCell(0, 0, 0, data[width - 1], 0, 0, 0, 0, data[width2 - 1]);
            if (cell) {
                expandRight = 1;
                rightExpands[0] = cell;
            }
        } else {
            cell = this.lookupCell(0, 0, 0, 0, 0, data[0], 0, 0, 0);
            if (cell) {
                expandLeft = 1;
                leftExpands[0] = cell;
            }
            cell = this.lookupCell(0, 0, 0, data[width - 1], 0, 0, 0, 0, 0);
            if (cell) {
                expandRight = 1;
                rightExpands[0] = cell;
            }
        }
        let loc = 0;
        for (i = width; i < size - width; i += width) {
            loc++;
            cell = this.lookupCell(0, 0, data[i - width], 0, 0, data[i], 0, 0, data[i + width]);
            if (cell) {
                expandLeft = 1;
                leftExpands[loc] = cell;
            }
            cell = this.lookupCell(data[i - 1], 0, 0, data[i + width - 1], 0, 0, data[i + width2 - 1], 0, 0);
            if (cell) {
                expandRight = 1;
                rightExpands[loc] = cell;
            }
        }
        // this part is only for B1c, B1e, or B2a rules
        if (height > 1) {
            cell = this.lookupCell(0, 0, data[size - width2 - 1], 0, 0, data[size - width - 1], 0, 0, data[size - 1]);
            if (cell) {
                expandLeft = 1;
                leftExpands[height - 1] = cell;
            }
            cell = this.lookupCell(data[lastRow - width2], 0, 0, data[lastRow - width], 0, 0, data[lastRow], 0, 0);
            if (cell) {
                expandRight = 1;
                rightExpands[height - 1] = cell;
            }
        }
        // special B1c checks
        let b1cnw = (trs[1] && data[0]) ? 1 : 0;
        let b1cne = (trs[64] && data[width - 1]) ? 1 : 0;
        let b1csw = (trs[4] && data[lastRow]) ? 1 : 0;
        let b1cse = (trs[256] && data[size - 1]) ? 1 : 0;
        if (b1cnw || b1cne) {
            expandUp = 1;
        }
        if (b1csw || b1cse) {
            expandDown = 1;
        }
        if (b1cnw || b1csw) {
            expandLeft = 1;
        }
        if (b1cne || b1cse) {
            expandRight = 1;
        }
        /** The offset for each row, how many new elements are between each row. */
        let oX = expandLeft + expandRight;
        /** The offset between the start of `data` and the start of `out`. */
        let oStart = (expandUp ? width + oX : 0) + expandLeft;
        /** The offset between the end of `data` and the end of `out`. */
        let oSize = oStart + oX * height;
        /** The width of each row of `out`. */
        let newWidth = width + oX;
        /** The height of `out`. */
        let newHeight = height + expandUp + expandDown;
        /** The length of `out`. */
        let newSize = newWidth * newHeight;
        /** The output pattern data, after running the generation. */
        let out = new Uint8Array(newSize);
        // putting the expansion data into the output
        out[0] = b1cnw;
        out[newWidth - 1] = b1cne;
        out[newSize - newWidth] = b1csw;
        out[newSize - 1] = b1cse;
        if (expandUp) {
            out.set(upExpands, expandLeft);
        }
        if (expandDown) {
            out.set(downExpands, size + oSize);
        }
        if (expandLeft) {
            let loc = oStart - width - oX - 1;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = leftExpands[i];
            }
        }
        if (expandRight) {
            let loc = oStart - oX;
            for (i = 0; i < height; i++) {
                loc += width + oX;
                out[loc] = rightExpands[i];
            }
        }
        // we need to do a special case for when width === 1, the basic method breaks in that case
        if (width <= 1) {
            if (width === 1) {
                let loc = oStart;
                // top
                cell = this.lookupCell(0, 0, 0, 0, data[0], 0, 0, data[1], 0);
                if (cell) {
                    out[loc] = cell;
                }
                loc += oX + 1;
                for (i = 1; i < height - 1; i++) {
                    // middle
                    cell = this.lookupCell(0, data[i - 1], 0, 0, data[i], 0, 0, data[i + 1], 0);
                    if (cell) {
                        out[loc] = cell;
                    }
                    loc += oX + 1;
                }
                // bottom
                cell = this.lookupCell(0, data[height - 2], 0, 0, data[height - 1], 0, 0, 0, 0);
                if (cell) {
                    out[loc] = cell;
                }
            }
        } else {
            let loc1 = oStart;
            let loc2 = lastRow + oSize - oX;
            // top-left
            cell = this.lookupCell(0, 0, 0, 0, data[0], data[1], 0, data[width], data[width + 1]);
            if (cell) {
                out[loc1] = cell;
            }
            // bottom-left
            cell = this.lookupCell(0, data[lastRow - width], data[lastRow - width + 1], 0, data[lastRow], data[lastRow + 1], 0, 0, 0);
            if (cell) {
                out[loc2] = cell;
            }
            j = lastRow;
            for (i = 1; i < width - 1; i++) {
                j++;
                loc1++;
                loc2++;
                // top row
                cell = this.lookupCell(0, 0, 0, data[i - 1], data[i], data[i + 1], data[i + width - 1], data[i + width], data[i + width + 1]);
                if (cell) {
                    out[loc1] = cell;
                }
                // bottom row
                cell = this.lookupCell(data[j - width - 1], data[j - width], data[j - width + 1], data[j - 1], data[j], data[j + 1], 0, 0, 0);
                if (cell) {
                    out[loc2] = cell;
                }
            }
            // top-right
            cell = this.lookupCell(0, 0, 0, data[width - 2], data[width - 1], 0, data[width2 - 2], data[width2 - 1], 0);
            if (cell) {
                out[loc1 + 1] = cell;
            }
            // bottom-right
            cell = this.lookupCell(data[size - width - 2], data[size - width - 1], 0, data[size - 2], data[size - 1], 0, 0, 0, 0);
            if (cell) {
                out[loc2 + 1] = cell;
            }
            loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += oX;
                // left column
                let i = y * width;
                cell = this.lookupCell(0, data[i - width], data[i - width + 1], 0, data[i], data[i + 1], 0, data[i + width], data[i + width + 1]);
                if (cell) {
                    out[loc] = cell;
                }
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    // middle
                    i = y * width + x;
                    cell = this.lookupCell(data[i - width - 1], data[i - width], data[i - width + 1], data[i - 1], data[i], data[i + 1], data[i + width - 1], data[i + width], data[i + width + 1]);
                    if (cell) {
                        out[loc] = cell;
                    }
                    loc++;
                }
                // right column
                i = (y + 1) * width - 1;
                cell = this.lookupCell(data[i - width - 1], data[i - width], 0, data[i - 1], data[i], 0, data[i + width - 1], data[i + width], 0);
                if (cell) {
                    out[loc] = cell;
                }
                loc++;
            }
        }
        this.height = newHeight;
        this.width = newWidth;
        this.size = newSize;
        this.data = out;
        this.xOffset -= expandLeft;
        this.yOffset -= expandUp;
        this.generation++;
    }

    copy(): TreePattern {
        let out = new TreePattern(this.height, this.width, this.data.slice(), this.rule, this.tree, this.atRule);
        out.generation = this.generation;
        out.xOffset = this.xOffset;
        out.yOffset = this.yOffset;
        return out;
    }

    clearedCopy(): TreePattern {
        return new TreePattern(0, 0, new Uint8Array(0), this.rule, this.tree, this.atRule);
    }

    copyPart(x: number, y: number, height: number, width: number): TreePattern {
        let data = new Uint8Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        return new TreePattern(height, width, data, this.rule, this.tree, this.atRule);
    }

    loadApgcode(code: string): TreePattern {
        let [height, width, data] = this._loadApgcode(code);
        return new TreePattern(height, width, data, this.rule, this.tree, this.atRule);
    }
    
    loadRLE(rle: string): TreePattern {
        let [height, width, data] = this._loadRLE(rle);
        return new TreePattern(height, width, data, this.rule, this.tree, this.atRule);
    }

}


export function createTreePattern(rule: string, height: number, width: number, data: Uint8Array, ruleStr?: string): TreePattern {
    let atRule = parseAtRule(rule);
    if (!atRule.tree) {
        throw new RuleError(`No @TABLE or @TREE present`);
    }
    let tree = atRule.tree;
    let ruleData: Rule = {
        str: ruleStr ?? atRuleToString(atRule),
        states: tree.states,
        neighborhood: tree.neighborhood,
        symmetry: tree.symmetry,
        period: 1,
        range: 1
    };
    return new TreePattern(height, width, data, ruleData, tree.data, atRule);
}
