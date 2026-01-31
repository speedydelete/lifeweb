
/* A broken implemetation of the RuleLoader algorithm, described in detail at https://golly.sourceforge.io/Help/formats.html#rule. Also implements parts of Nutshell (https://github.com/supposedly/nutshell), and the lifelib/CAViewer-specific unbounded neighborhoods. */

import {RuleError, CoordPattern, COORD_WIDTH as WIDTH, COORD_BIAS as BIAS} from './pattern.js';


/** Stores a compiled rule tree data. */
export type Tree = (number | Tree)[];

/** Associated information for a rule tree. */
export interface RuleTree {
    states: number;
    /** The weighted HROT neighborhood. */
    neighborhood: Int8Array;
    data: Tree;
}

/** A parsed @ RULE rule. */
export interface AtRule {
    name?: string;
    desc?: string;
    tree: RuleTree;
    names?: {[key: number]: string};
    colors?: {[key: number]: [number, number, number]};
    icons?: string;
}


/** The valid neighorhoods. */
const RULELOADER_NEIGHBORHOODS: {[key: string]: [number, number][]} = {
    'moore': [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]],
    'vonneumann': [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0]],
    'hexagonal': [[0, 0], [0, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1]],
    'onedimensional': [[0, 0], [-1, 0], [1, 0]],
};


// These functions are symmetry generators for a given neighborhood.
// I honestly forget how exactly the symmetries are stored in it.

function symC1(nh: [number, number][]): number[][] {
    return [];
}

function symC2(nh: [number, number][]): number[][] {
    let out: number[] = [];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === -x && p[1] === -y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for C2 symmetry');
        }
        out.push(j);
    }
    return [out];
}

function symC4(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === y && p[1] === -x);
        let k = nh.findIndex(p => p[0] === -x && p[1] === -y);
        let l = nh.findIndex(p => p[0] === -y && p[1] === x);
        if (j === -1 || k === -1 || l === -1) {
            throw new RuleError('Invalid neighborhood for C4 symmetry');
        }
        out[0].push(j);
        out[1].push(k);
        out[2].push(l);
    }
    return out;
}

function symC8(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for C8 symmetry');
        }
        for (let j = 0; j < 7; j++) {
            if (x === 0) {
                y = x;
            } else if (y === 0) {
                x = -y;
            } else if (x > 0) {
                x = 0;
                y *= 2;
            } else {
                x *= 2;
                y = 0;
            }
            let k = nh.findIndex(p => p[0] === x && p[1] === y);
            if (k === -1) {
                throw new RuleError('Invalid neighborhood for C8 symmetry');
            }
            out[j].push(k);
        }
    }
    return out;
}

function symC8alt(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for C8alt symmetry');
        }
        for (let j = 0; j < 7; j++) {
            if (x === 0) {
                y = x;
            } else if (y === 0) {
                x = -y;
            } else if (x > 0) {
                x = 0;
            } else {
                y = 0;
            }
            let k = nh.findIndex(p => p[0] === x && p[1] === y);
            if (k === -1) {
                throw new RuleError('Invalid neighborhood for C8alt symmetry');
            }
            out[j].push(k);
        }
    }
    return out;
}

function symD2h(nh: [number, number][]): number[][] {
    let out: number[] = [];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === x && p[1] === -y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2- symmetry');
        }
        out.push(j);
    }
    return [out];
}

function symD2v(nh: [number, number][]): number[][] {
    let out: number[] = [];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === -x && p[1] === y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2| symmetry');
        }
        out.push(j);
    }
    return [out];
}

function symD2x(nh: [number, number][]): number[][] {
    let out: number[] = [];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === y && p[1] === x);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2x symmetry');
        }
        out.push(j);
    }
    return [out];
}

function symD4p(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === x && p[1] === -y);
        let k = nh.findIndex(p => p[0] === -x && p[1] === y);
        let l = nh.findIndex(p => p[0] === -x && p[1] === -y);
        if (j === -1 || k === -1 || l === -1) {
            throw new RuleError('Invalid neighborhood for D4+ symmetry');
        }
        out[0].push(j);
        out[1].push(k);
        out[2].push(l);
    }
    return out;
}

function symD4x(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === y && p[1] === x);
        let k = nh.findIndex(p => p[0] === -y && p[1] === -x);
        let l = nh.findIndex(p => p[0] === -x && p[1] === -y);
        if (j === -1 || k === -1 || l === -1) {
            throw new RuleError('Invalid neighborhood for D4x  symmetry');
        }
        out[0].push(j);
        out[1].push(k);
        out[2].push(l);
    }
    return out;
}

function symD8(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], [], [], [], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        let j = nh.findIndex(p => p[0] === x && p[1] === -y);
        let k = nh.findIndex(p => p[0] === -x && p[1] === y);
        let l = nh.findIndex(p => p[0] === -x && p[1] === -y);
        let m = nh.findIndex(p => p[0] === y && p[1] === x);
        let n = nh.findIndex(p => p[0] === y && p[1] === -x);
        let o = nh.findIndex(p => p[0] === -y && p[1] === x);
        let p = nh.findIndex(p => p[0] === -y && p[1] === -x);
        if (j === -1 || k === -1 || l === -1) {
            throw new RuleError('Invalid neighborhood for D4x  symmetry');
        }
        out[0].push(j);
        out[1].push(k);
        out[2].push(l);
        out[3].push(m);
        out[4].push(n);
        out[5].push(o);
        out[6].push(p);
    }
    return out;
}

function symD16(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for D16 symmetry');
        }
        for (let f = 0; f < 2; f++) {
            for (let j = 0; j < 7; j++) {
                if (x === 0) {
                    y = x;
                } else if (y === 0) {
                    x = -y;
                } else if (x > 0) {
                    x = 0;
                    y *= 2;
                } else {
                    x *= 2;
                    y = 0;
                }
                let k = nh.findIndex(p => p[0] === x && p[1] === y);
                if (k === -1) {
                    throw new RuleError('Invalid neighborhood for D16 symmetry');
                }
                out[j].push(k);
            }
            let temp = x;
            x = y;
            y = temp;
        }
    }
    return out;
}

function symD16alt(nh: [number, number][]): number[][] {
    let out: number[][] = [[], [], [], [], [], [], [], [], [], [], [], [], [], [], []];
    for (let i = 0; i < nh.length; i++) {
        let [x, y] = nh[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for D16 symmetry');
        }
        for (let f = 0; f < 2; f++) {
            for (let j = 0; j < 7; j++) {
                if (x === 0) {
                    y = x;
                } else if (y === 0) {
                    x = -y;
                } else if (x > 0) {
                    x = 0;
                } else {
                    y = 0;
                }
                let k = nh.findIndex(p => p[0] === x && p[1] === y);
                if (k === -1) {
                    throw new RuleError('Invalid neighborhood for D16 symmetry');
                }
                out[j].push(k);
            }
            let temp = x;
            x = y;
            y = temp;
        }
    }
    return out;
}

function permutations<T>(data: T[]): T[][] {
    let out: T[][] = [];
    for (let i = 0; i < data.length; i = i + 1) {
        let rest = permutations(data.slice(0, i).concat(data.slice(i + 1)));
        if (rest.length === 0) {
            out.push([data[i]]);
        } else {
            for (let j = 0; j < rest.length; j = j + 1) {
                out.push([data[i]].concat(rest[j]));
            }
        }
    }
    return out;
}

function symPermute(nh: [number, number][]): number[][] {
    return permutations(nh.slice(1).map((_, i) => i + 1)).map(x => [0].concat(x));
}

/** Every valid symmetry in RuleLoader. */
const SYMMETRIES: {[key: string]: (nh: [number, number][]) => number[][]} = {
    C1: symC1,
    C2: symC2,
    C4: symC4,
    C8: symC8,
    C8alt: symC8alt,
    D2h: symD2h,
    'D2|': symD2h,
    D2v: symD2v,
    'D2-': symD2v,
    D2x: symD2x,
    D4p: symD4p,
    'D4+': symD4p,
    D4x: symD4x,
    D8: symD8,
    D16: symD16,
    D16alt: symD16alt,
    none: symC1,
    rotate2: symC2,
    rotate2reflect: symD4p,
    rotate4: symC4,
    rotate4reflect: symD8,
    rotate8: symC8alt,
    rotate8reflect: symD16alt,
    permute: symPermute,
};

/** The default symmetry for rules. */
const MOORE_PERMUTE = symPermute(RULELOADER_NEIGHBORHOODS['moore']);


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
                section.push(parseInt(num));
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
        section.push(parseInt(num));
    }
    if (section.length > 0) {
        out.push(section);
    }
    return out;
}

/** Parses a rule tree. This function is probably broken. */
function parseTree(data: string): RuleTree {
    let nh: [number, number][] = [];
    let nodes: Tree[] = [];
    let states = 0;
    for (let line of data.split('\n')) {
        if (line.includes('=')) {
            let [cmd, arg] = line.split('=');
            cmd = cmd.trim();
            arg = arg.trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                nh = parseJSONLoose(arg) as [number, number][];
                if (!nh.every(x => x.length === 2)) {
                    throw new RuleError(`Invalid neighborhood: '${arg}'`);
                }
            } else if (cmd === 'num_neighbors') {
                if (parseInt(arg) === 4) {
                    nh = [[0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]];
                } else {
                    nh = [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [-1, 0], [1, 0], [0, 1], [0, 0]]
                }
            }
        } else {
            let [depth, ...data] = line.split(' ').map(x => parseInt(x));
            if (depth === 1) {
                let newStates = Math.max(...data);
                if (newStates > states) {
                    states = newStates;
                }
                nodes.push(data);
            } else {
                nodes.push(data.map(x => nodes[x]));
            }
        }
    }
    return {
        states: states + 1,
        neighborhood: new Int8Array(nh.flat()),
        data: nodes[nodes.length - 1],
    };
}

/** A single line in a rule table. */
type TableValue = (number | {bind: true, index: number})[][];

/** Stores the current variables in a rule table. */
type TableVars = {[key: string]: {value: TableValue, bind: boolean}};

/** Parses a brace list. These can be used inside rule table entries, unlike Golly, but like Nutshell. */
function parseBraceList(data: string, vars: TableVars): TableValue {
    let braceLevel = 0;
    let out: TableValue = [];
    let section: TableValue[number] = [];
    let value = '';
    let boundVars: {[key: string]: number} = {};
    let inBind = false;
    for (let char of data) {
        if (char === '{') {
            braceLevel++;
        } else if (char === '}') {
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
                        section.push({bind: true, index: parseInt(value)});
                    } else {
                        section.push(parseInt(value));
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
                section.push({bind: true, index: parseInt(value)});
            } else {
                section.push(parseInt(value));
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

/** Turns a rule table line into a rule tree. */
function trsToTree(trs: number[][], states: number, center: number | null = null): Tree {
    if (trs[0].length === 2) {
        let out: Tree = [];
        for (let state = 0; state < states; state++) {
            // -1 means any
            let value = trs.find(x => x[0] === state || x[0] === -1);
            if (value) {
                out.push(value[1]);
            } else {
                out.push(center ?? state);
            }
        }
        return out;
    }
    let groups: number[][][] = [];
    for (let i = 0; i < states; i++) {
        groups.push([]);
    }
    for (let tr of trs) {
        let state = tr[0];
        tr = tr.slice(1);
        if (state === -1) {
            for (let group of groups) {
                group.push(tr);
            }
        } else if (state in groups) {
            groups[state].push(tr);
        } else {
            groups[state] = [tr];
        }
    }
    let out: Tree = [];
    for (let state = 0; state < states; state++) {
        let trs = groups[state];
        if (trs.length === 0) {
            out.push(center ?? state);
        } else {
            out.push(trsToTree(trs, states, center ?? state));
        }
    }
    return out;
}

/** Parses a rule table. */
function parseTable(data: string): RuleTree {
    // First, we resolve all variables and generate a normalized transition list in the lines variable.
    let nh: [number, number][] = RULELOADER_NEIGHBORHOODS['moore'];
    let sym: number[][] = MOORE_PERMUTE;
    let symString = 'permute';
    let vars: TableVars = {};
    let lines: {value: TableValue, nh: [number, number][], sym: number[][]}[] = [];
    for (let line of data.split('\n')) {
        if (line.includes(':')) {
            let index = line.indexOf(':');
            let cmd = line.slice(0, index);
            let arg = line.slice(index + 1).trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                if (arg.startsWith('(')) {
                    let list = parseJSONLoose(arg);
                    if (!list.every(x => x.length === 2)) {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                    nh = list as [number, number][];
                } else {
                    let lower = arg.toLowerCase();
                    if (lower in RULELOADER_NEIGHBORHOODS) {
                        nh = RULELOADER_NEIGHBORHOODS[lower];
                    } else {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                }
                sym = SYMMETRIES[symString](nh);
                continue;
            } else if (cmd === 'symmetry' || cmd === 'symmetries') {
                let newSym: number[][];
                if (arg.startsWith('[')) {
                    if (arg.startsWith('[[')) {
                        arg = arg.slice(1);
                    }
                    newSym = parseJSONLoose(arg);
                } else {
                    let lower = arg.toLowerCase();
                    if (lower in SYMMETRIES) {
                        symString = lower;
                        newSym = SYMMETRIES[lower](nh);
                    } else {
                        throw new RuleError(`Invalid symmetry: '${arg}'`);
                    }
                }
                sym = newSym;
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
            lines.push({value: Array.from(line).map(x => [parseInt(x)]), nh, sym});
        } else {
            let value = parseBraceList(line, vars);
            lines.push({value, nh, sym});
        }
    }
    let states = 0;
    let totalNh: [number, number][] = [[0, 0]];
    for (let {value, nh} of lines) {
        for (let section of value) {
            for (let x of section) {
                if (typeof x === 'number' && x > states) {
                    states = x;
                }
            }
        }
        for (let [x, y] of nh) {
            if (!totalNh.some(p => p[0] === x && p[1] === y)) {
                totalNh.push([x, y]);
            }
        }
    }
    states++;
    let trs: number[][] = [];
    let done = new Set<string>();
    for (let {value: line, nh, sym} of lines) {
        let data: number[][] = [];
        if (line.length === 0) {
            continue;
        }
        for (let x of line[0]) {
            if (typeof x === 'number') {
                data.push([x]);
            }
        }
        for (let i = 1; i < line.length; i++) {
            let section = line[i];
            if (section.length === 1) {
                let value = section[0];
                if (typeof value === 'number') {
                    for (let tr of data) {
                        tr.push(value);
                    }
                } else {
                    for (let tr of data) {
                        tr.push(tr[value.index]);
                    }
                }
            } else if (section.length === states) {
                for (let tr of data) {
                    tr.push(-1);
                }
            } else {
                let start = data;
                data = [];
                for (let value of section) {
                    let trs = structuredClone(start);
                    if (typeof value === 'number') {
                        for (let tr of trs) {
                            tr.push(value);
                        }
                    } else {
                        for (let tr of trs) {
                            tr.push(tr[value.index]);
                        }
                    }
                    data.push(...trs);
                }
            }
        }
        // We need to remap the neighborhoods, because you can change the neighborhood within the rule table.
        let remap: number[] = [];
        for (let [x, y] of totalNh) {
            remap.push(nh.findIndex(p => p[0] === x && p[1] === y));
        }
        for (let tr of data) {
            let tr2: number[] = [];
            for (let i of remap) {
                if (i === -1) {
                    tr2.push(-1);
                } else {
                    tr2.push(tr[i]);
                }
            }
            tr2.push(tr[tr.length - 1]);
            let str = tr2.join(' ');
            if (!done.has(str)) {
                done.add(str);
                trs.push(tr2);
            }
            for (let remap2 of sym) {
                let tr3: number[] = [];
                for (let i of remap2) {
                    tr3.push(tr[i]);
                }
                let tr4: number[] = [];
                for (let i of remap) {
                    if (i === -1) {
                        tr4.push(-1);
                    } else {
                        tr4.push(tr3[i]);
                    }
                }
                tr4.push(tr[tr.length - 1]);
                let str2 = tr4.join(' ');
                if (!done.has(str2)) {
                    done.add(str2);
                    trs.push(tr4);
                }
            }
        }
    }
    return {
        states,
        neighborhood: new Int8Array(totalNh.flat()),
        data: trsToTree(trs, states),
    };
}

/** Parses an @ RULE rule. */
export function parseAtRule(rule: string): AtRule {
    let section = '';
    let out: Omit<AtRule, 'tree'> = {};
    let tree: RuleTree | null = null;
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
        if (section === '@TABLE') {
            if (tree) {
                continue;
            }
            tree = parseTable(data);
        } else if (section === '@TREE') {
            if (tree) {
                continue;
            }
            tree = parseTree(data);
        } else if (section === '@XTREE') {
            tree = JSON.parse(data);
        } else if (section ==='@NAMES') {
            out.names = {};
            for (let line of data.split('\n')) {
                let index = line.indexOf(' ');
                if (index === -1) {
                    continue;
                }
                out.names[parseInt(line.slice(0, index))] = line.slice(index + 1);
            }
        } else if (section === '@COLORS') {
            out.colors = {};
            for (let line of data.split('\n')) {
                let [state, r, g, b] = line.split(' ').filter(x => x);
                out.colors[parseInt(state)] = [parseInt(r), parseInt(g), parseInt(b)];
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
    if (tree === null) {
        throw new RuleError('At least one @TABLE or @TREE expected');
    }
    return {...out, tree};
}

/** Turns a parsed @ RULE into a canonicalized rulestring. */
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
    out += `@XTREE\n${JSON.stringify(rule.tree)}\n`;
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


/** The most general built-in pattern class, can implement any rule, but is probably broken in some way. */
export class TreePattern extends CoordPattern {
    
    nh: Int8Array;
    tree: Tree;
    states: number;
    ruleStr: string;
    ruleSymmetry: 'C1' = 'C1';
    rule: AtRule;
    rulePeriod: 1 = 1;

    constructor(coords: Map<number, number>, nh: Int8Array, tree: Tree, states: number, ruleStr: string, rule: AtRule) {
        super(coords, Math.max(...nh.map(Math.abs)));
        this.nh = nh;
        this.tree = tree;
        this.states = states;
        this.ruleStr = ruleStr;
        this.rule = rule;
    }

    runGeneration(): void {
        let range = this.range;
        let {minX, maxX, minY, maxY} = this.getMinMaxCoords();
        minX = minX - range + BIAS;
        maxX = maxX + range + BIAS;
        minY = minY - range + BIAS;
        maxY = maxY + range + BIAS;
        let out = new Map<number, number>();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                let value: Tree | number = this.tree;
                for (let i = 0; i < this.nh.length; i += 2) {
                    value = value[this.coords.get((x + this.nh[i]) * WIDTH + (y + this.nh[i + 1])) ?? 0];
                    if (typeof value === 'number') {
                        break;
                    }
                }
                if (value) {
                    out.set(x * WIDTH + y, value as number);
                }
            }
        }
        this.generation++;
        this.coords = out;
    }

    copy(): TreePattern {
        let out = new TreePattern(new Map(this.coords), this.nh, this.tree, this.states, this.ruleStr, this.rule);
        out.generation = this.generation;
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): TreePattern {
        let out = new Map<number, number>();
        for (let [key, value] of this.coords) {
            let px = Math.floor(key / WIDTH) - BIAS;
            let py = (key & (WIDTH - 1)) - BIAS;
            if (px >= x && px < x + width && py >= y && py < y + height) {
                out.set(key, value);
            }
        }
        let p = new TreePattern(out, this.nh, this.tree, this.states, this.ruleStr, this.rule);
        p.generation = this.generation;
        return p;
    }

    clearedCopy(): TreePattern {
        return new TreePattern(new Map(), this.nh, this.tree, this.states, this.ruleStr, this.rule);
    }

    loadApgcode(code: string): TreePattern {
        return new TreePattern(this._loadApgcode(code), this.nh, this.tree, this.states, this.ruleStr, this.rule);
    }

}
