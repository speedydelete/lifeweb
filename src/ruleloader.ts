
import {RuleError, RuleSymmetry, DataPattern} from './pattern.js';


export type Tree = (number | Tree)[];

export interface RuleTree {
    states: number;
    neighborhood: string | [number, number][];
    data: Tree;
}

export interface AtRule {
    name?: string;
    desc?: string;
    tree: RuleTree;
    names?: {[key: number]: string};
    colors?: {[key: number]: [number, number, number]};
    icons?: string;
}


const NEIGHBORHOODS: {[key: string]: [number, number][]} = {
    'moore': [[0, 0], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, 0]],
    'vonneumann': [[0, 0], [0, -1], [1, 0], [0, 1], [-1, 0], [0, 0]],
    'hexagonal': [[0, 0], [0, -1], [1, 0], [1, 1], [0, 1], [-1, 0], [-1, -1], [0, 0]],
    'onedimensional': [[0, 0], [-1, 0], [1, 0], [0, 0]],
};


function symC1(n: [number, number][]): [] {
    return [];
}

function symC2(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (y >= -x) {
            continue;
        }
        let j = n.findIndex(p => p[0] === -x && p[1] === -y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for C2 symmetry');
        }
        if (i !== j) {
            out.push([i, j]);
        }
    }
    return [out];
}

function symC4(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (x > 0 || y >= 0) {
            continue;
        }
        let j = n.findIndex(p => p[0] === y && p[1] == -x);
        let k = n.findIndex(p => p[0] === -x && p[1] === -y);
        let l = n.findIndex(p => p[0] === -y && p[1] === x);
        if (j === -1 || k === -1 || l === -1) {
            throw new RuleError('Invalid neighborhood for C4 symmetry');
        }
        out.push([i, j, k, l]);
    }
    return [out];
}

function symC8(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for C8 symmetry');
        }
        if (x > 0 || y >= 0) {
            continue;
        }
        let cycle: number[] = [i];
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
            let k = n.findIndex(p => p[0] === x && p[1] === y);
            if (k === -1) {
                throw new RuleError('Invalid neighborhood for C8 symmetry');
            }
        }
        out.push(cycle);
    }
    return [out];
}

function symC8alt(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (Math.abs(x) !== Math.abs(y) && !(x === 0 || y === 0)) {
            throw new RuleError('Invalid neighborhood for C8alt symmetry');
        }
        if (x > 0 || y >= 0) {
            continue;
        }
        let cycle: number[] = [i];
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
            let k = n.findIndex(p => p[0] === x && p[1] === y);
            if (k === -1) {
                throw new RuleError('Invalid neighborhood for C8alt symmetry');
            }
        }
        out.push(cycle);
    }
    return [out];
}

function symD2h(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (y >= 0) {
            continue;
        }
        let j = n.findIndex(p => p[0] === x && p[1] === -y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2h symmetry');
        }
        out.push([i, j]);
    }
    return [out];
}

function symD2v(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (x >= 0) {
            continue;
        }
        let j = n.findIndex(p => p[0] === -x && p[1] === y);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2v symmetry');
        }
        out.push([i, j]);
    }
    return [out];
}

function symD2x(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length; i++) {
        let [x, y] = n[i];
        if (y >= x) {
            continue;
        }
        let j = n.findIndex(p => p[0] === y && p[1] === x);
        if (j === -1) {
            throw new RuleError('Invalid neighborhood for D2x symmetry');
        }
        out.push([i, j]);
    }
    return [out];
}

function symD4p(n: [number, number][]): number[][][] {
    return [symD2h(n)[0], symD2v(n)[0]];
}

function symD4x(n: [number, number][]): number[][][] {
    return [symC2(n)[0], symD2x(n)[0]];
}

function symD8(n: [number, number][]): number[][][] {
    return [symC4(n)[0], symD2h(n)[0]];
}

function symD16(n: [number, number][]): number[][][] {
    return [symC8(n)[0], symD2h(n)[0]];
}

function symD16alt(n: [number, number][]): number[][][] {
    return [symC8(n)[0], symD2h(n)[0]];
}

function symPermute(n: [number, number][]): [number[][]] {
    let out: number[][] = [];
    for (let i = 0; i < n.length - 1; i++) {
        out.push([i, i + 1]);
    }
    return [out];
}

const SYMMETRIES: {[key: string]: (n: [number, number][]) => number[][][]} = {
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

function symToPerms(sym: number[][][], length: number): number[][] {
    let out: number[][] = [];
    for (let cycles of sym) {
        let perm: number[] = new Array<number>(length);
        for (let cycle of cycles) {
            for (let i = 0; i < cycle.length; i++) {
                perm[cycle[i - 1]] = cycle[i];
            }
        }
        out.push(perm);
    }
    return out;
}

const MOORE_PERMUTE = symToPerms(symPermute(NEIGHBORHOODS['Moore']), 9);


function parsePythonTuples(data: string): number[][][] {
    let inParen = false;
    let inBracket = false;
    let out: number[][][] = [];
    let list: number[][] = [];
    let tuple: number[] = [];
    let num = '';
    for (let char of data.slice(1)) {
        if (char === '(') {
            inParen = true;
        } else if (char === ')') {
            inParen = false;
        } else if (char === '[') {
            inBracket = true;
        } else if (char === ']') {
            inBracket = false;
        } else if (char === ',') {
            if (inParen) {
                tuple.push(parseInt(num));
                num = '';
            } else if (inBracket) {
                list.push(tuple);
                tuple = [];
            } else {
                out.push(list);
                list = [];
            }
        } else if (char === ' ') {
            continue;
        } else {
            num += char;
        }
    }
    if (num.trim() !== '') {
        tuple.push(parseInt(num));
    }
    if (tuple.length > 0) {
        list.push(tuple);
    }
    if (list.length > 0) {
        out.push(list);
    }
    return out;
}

function parseTree(data: string): RuleTree {
    let nh: [number, number][] = [];
    let nodes: Tree[] = [];
    let states = 0;
    for (let line of data.split('\n')) {
        if (line.includes(':')) {
            let [cmd, arg] = line.split(':');
            cmd = cmd.trim();
            arg = arg.trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                nh = parsePythonTuples(arg)[0] as [number, number][];
                if (!nh.every(x => x.length === 2)) {
                    throw new Error(`Invalid neighborhood: '${arg}'`);
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
                nodes.push(data);
                let newStates = Math.max(...data);
                if (newStates > states) {
                    states = newStates;
                }
            } else {
                nodes.push(data.map(x => nodes[x]));
            }
        }
    }
    return {
        states: states + 1,
        neighborhood: nh,
        data: nodes[nodes.length - 1],
    };
}

type TableValue = (number | {bind: true, index: number})[][];

type TableVars = {[key: string]: {value: TableValue, bind: boolean}};

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
    if (section.length > 0) {
        out.push(Array.from(new Set(section)));
    }
    return out;
}

function trsToTree(trs: number[][], states: number, center: number | null = null): Tree {
    if (trs[0].length === 2) {
        let out: Tree = [];
        for (let state = 0; state < states; state++) {
            let value = trs.find(x => x[0] === state);
            if (value) {
                out.push(value);
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

function parseTable(data: string): RuleTree {
    let nh: [number, number][] = NEIGHBORHOODS['Moore'];
    let sym = 0;
    let symString = 'permute';
    let syms: number[][][] = [MOORE_PERMUTE];
    let vars: TableVars = {};
    let lines: {value: TableValue, nh: [number, number][], sym: number}[] = [];
    for (let line of data.split('\n')) {
        if (line.includes(':')) {
            let index = line.indexOf(':');
            let cmd = line.slice(0, index);
            let arg = line.slice(index + 1).trim();
            if (cmd === 'neighborhood' || cmd === 'neighbourhood') {
                if (arg.startsWith('[')) {
                    if (!arg.endsWith(']')) {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                    arg = arg.slice(1, -1);
                }
                if (arg.startsWith('(')) {
                    let list = parsePythonTuples(arg)[0];
                    if (!list.every(x => x.length === 2)) {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                    nh = list as [number, number][];
                } else {
                    let lower = arg.toLowerCase();
                    if (lower in NEIGHBORHOODS) {
                        nh = NEIGHBORHOODS[lower];
                    } else {
                        throw new RuleError(`Invalid neighborhood: '${arg}'`);
                    }
                }
                let newSym = symToPerms(SYMMETRIES[symString](nh), nh.length);
                let index = syms.findIndex(sym => sym.every((x, i) => x.every((y, j) => y === newSym[i][j])));
                if (index === -1) {
                    sym = syms.length;
                    syms.push(newSym);
                } else {
                    sym = index;
                }
                continue;
            } else if (cmd === 'symmetry' || cmd === 'symmetries') {
                let newSym: number[][];
                if (arg.startsWith('[')) {
                    if (arg.startsWith('[[')) {
                        arg = arg.slice(1);
                    }
                    newSym = symToPerms(parsePythonTuples(arg), nh.length);
                } else {
                    let lower = arg.toLowerCase();
                    if (lower in SYMMETRIES) {
                        symString = lower;
                        newSym = symToPerms(SYMMETRIES[lower](nh), nh.length);
                    } else {
                        throw new RuleError(`Invalid symmetry: '${arg}'`);
                    }
                }
                let index = syms.findIndex(sym => sym.every((x, i) => x.every((y, j) => y === newSym[i][j])));
                if (index === -1) {
                    sym = syms.length;
                    syms.push(newSym);
                } else {
                    sym = index;
                }
                continue;
            }
        }
        if (line.includes('=')) {
            let [name, value] = line.split('=');
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
                if (typeof x == 'number' && x > states) {
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
    for (let {value: line, nh, sym: symNum} of lines) {
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
        if (!(nh.length === totalNh.length && totalNh.every(([x, y], i) => x === nh[i][0] && y === nh[i][1]))) {
            let remap = [];
            for (let [x, y] of totalNh) {
                remap.push(nh.findIndex(p => p[0] === x && p[1] === y));
            }
            data = data.map(tr => {
                let out = [];
                for (let i of remap) {
                    if (i === -1) {
                        out.push(-1);
                    } else {
                        out.push(tr[i]);
                    }
                }
                return out;
            });
        }
        let sym = syms[symNum];
        let done = new Set(data.map(x => x.join(' ')));
        for (let tr of data) {
            trs.push(tr);
            let prevNew: number[][] = [];
            while (prevNew.length > 0) {
                let newNew: number[][] = [];
                for (let tr of prevNew) {
                    for (let gen of sym) {
                        let tr2 = gen.map(i => tr[i]);
                        let str = tr2.join(' ');
                        if (!done.has(str)) {
                            done.add(str);
                            trs.push(tr);
                            newNew.push(tr);
                        }
                    }
                }
                prevNew = newNew;
            }
        }
    }
    return {
        states,
        neighborhood: totalNh,
        data: trsToTree(trs, states),
    };
}

export function parseAtRule(rule: string): AtRule {
    let section = '';
    let out: Omit<AtRule, 'tree'> = {};
    let tree: RuleTree | null = null;
    let data = '';
    for (let line of rule.split('\n')) {
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
                let [state, r, g, b] = line.split(' ');
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
        throw new Error('At least one @TABLE or @TREE expected');
    }
    return {...out, tree};
}
