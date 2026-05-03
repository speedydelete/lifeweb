
import {MAPPattern, createMAPPattern} from './map.js';
import {findType} from './identify.js';
import {getKnots, INTSeparator} from './intsep.js';


const CONDUIT_OBJECT_LOOKAHEAD_GENS = 32;


export type Direction = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';

export type GliderDirection = 'NW' | 'NE' | 'SW' | 'SE';
export type XWSSDirection = 'N' | 'S' | 'E' | 'W';

export type Symmetry = 'C1' | 'C2' | 'C4' | 'D2+' | 'D2x' | 'D4+' | 'D4x' | 'D8';

export interface Catalyst {
    period: number;
    p: MAPPattern;
    x: number;
    y: number;
}

export interface Partial {
    p: MAPPattern;
    cats: Catalyst[];
    prevPs: MAPPattern[];
    p2Prev?: {
        pop: number;
        hash: number;
        data: Uint8Array;
    };
}

export interface ObjData {
    p: MAPPattern;
    x: number;
    y: number;
    w: number;
    h: number;
    maxX: number;
    maxY: number;
    code?: string;
}

export interface ConduitObject {
    obj: string;
    dir: Direction;
    time: number;
}

export interface ConduitObjectInfo extends ConduitObject {
    p: MAPPattern;
    x: number;
    y: number;
}

export interface Glider {
    dir: GliderDirection;
    lane: number;
    timing: number;
}

export interface Conduit {
    p: MAPPattern;
    input: string;
    inputTime?: number;
    time: number;
    output: (ConduitObjectInfo & {objTime: number})[];
    gliders: Glider[];
    otherOutputs: (ObjData & {code: string})[];
    repeatTime?: number;
    overclock?: number[];
}


export const DIRECTION_COMBINE: {[K in Direction]: {[K in Direction]: Direction}} = {
    F: {F: 'F', Fx: 'Fx', L: 'L', Lx: 'Lx', B: 'B', Bx: 'Bx', R: 'R', Rx: 'Rx'},
    Fx: {F: 'Fx', Fx: 'F', L: 'Lx', Lx: 'L', B: 'Bx', Bx: 'B', R: 'Rx', Rx: 'R'},
    L: {F: 'L', Fx: 'Lx', L: 'B', Lx: 'Bx', B: 'R', Bx: 'Rx', R: 'F', Rx: 'Fx'},
    Lx: {F: 'Lx', Fx: 'L', L: 'Bx', Lx: 'B', B: 'Rx', Bx: 'R', R: 'Fx', Rx: 'F'},
    B: {F: 'B', Fx: 'Bx', L: 'R', Lx: 'Rx', B: 'F', Bx: 'Fx', R: 'L', Rx: 'Lx'},
    Bx: {F: 'Bx', Fx: 'B', L: 'Rx', Lx: 'R', B: 'Fx', Bx: 'F', R: 'Lx', Rx: 'L'},
    R: {F: 'R', Fx: 'Rx', L: 'F', Lx: 'Fx', B: 'L', Bx: 'Lx', R: 'B', Rx: 'Bx'},
    Rx: {F: 'Rx', Fx: 'R', L: 'Fx', Lx: 'F', B: 'Lx', Bx: 'L', R: 'Bx', Rx: 'B'},
};

export const CONDUIT_OBJECTS: {[key: string]: [name: string, code: string, centerX: number, centerY: number]} = {
    'R': ['R-pentomino', '472', 1, 1],
    'B': ['B-heptomino', 'd72', 1, 1],
    'H': ['herschel', '74e', 1, 2],
    'C': ['century', 'c97', 2, 1],
    'D': ['dove', 'ci97', 2, 1],
    'E': ['E-heptomino', '1572' , 2, 1],
    'I': ['I-heptomino', 'c463', 1, 2],
    // 'J': ['blonk-tie', ],
    // 'O': ['two-glider octomino', ],
    'P': ['pi-heptomino', '557', 1, 1],
    'Q': ['queen bee', '3us8z31', 2, 3],
    'W': ['wing', 'c53', 1, 1],
    'U': ['U-turner', '77ac', 1, 1],
    '(TL)': ['traffic light', '757', 1, 1],
    '(HF)': ['honey farm', 's21112sz012221', 3, 3],
    '(LOM)': ['lumps of muck', 'c63', 1, 1],
    '(FLEET)': ['fleet', '799e', 1, 1],
    '(BAKERY)': ['bakery', 's211hez0111', 2, 2],
    '(TEARDROP)': ['teardrop', '699e', 3, 3],
    '(LONGBUN)': ['long bun', '25556', 2, 1],
    '(PROC)': ['procrastinator', '46232', 2, 1],
    '(IWONA)': ['Iwona active region', '3t', 1, 1],
    '(RT)': ['R-turner', '2598c', 1, 1],
    '(DIEHARD)': ['original die hard', '207z062', 2, 1],
    '(JASON)': ['object hassled in Jason\'s p22', '4ahiic', 2, 2],
    '(BUTTERFLY)': ['butterfly', '8ca7', 3, 3],
    '(O2)': ['octomino 2', '8d72', 2, 1],
    '(KAREL)': ['object hassled in Karel\'s p177', 'sid', 1, 1],
};

const OTHER_CONDUIT_OBJECTS: {[key: string]: [value: string, time: number, x: number, y: number, gens: number]} = {
    'pe4': ['B', 0, 1, 2, 0],
    '2eehfd': ['H', -5, 4, 3, 4],
    '577': ['P', 0, 1, 1, 2],
    'c72': ['C', -1, 2, 1, 0],
    '4be4': ['(TEARDROP)', -1, 3, 3, 0],
};

const SMALL_OBJECT_DIMENSIONS: [number, number][] = [[1, 1], [1, 2], [1, 3], [1, 4], [1, 5], [1, 6], [1, 7], [1, 8], [2, 1], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8], [3, 1], [3, 2], [3, 3], [3, 4], [3, 5], [4, 1], [4, 2], [4, 3], [4, 4], [5, 1], [5, 2], [5, 3], [6, 1], [6, 2], [7, 1], [7, 2], [8, 1], [8, 2]];

const GLIDERS: {[key: string]: [dir: GliderDirection, timing: number, x: number]} = {
    '111100010': ['NW', 0, 0],
    '010110101': ['NW', 3, -1],
    '110101100': ['NW', 2, -1],
    '011110001': ['NW', 1, 0],
    '111001010': ['NE', 0, 0],
    '010011101': ['NE', 3, 1],
    '011101001': ['NE', 2, 1],
    '110011100': ['NE', 1, 0],
    '010100111': ['SW', 0, 0],
    '101110010': ['SW', 3, -1],
    '100101110': ['SW', 2, -1],
    '001110011': ['SW', 1, 0],
    '010001111': ['SE', 0, 0],
    '101011010': ['SE', 3, 1],
    '001101011': ['SE', 2, 1],
    '100011110': ['SE', 1, 0],
};

const REVERSE_GLIDERS: {[key: string]: [rle: string, x: number, y: number]} = {
    'NW0': ['3o$o$bo!', 0, 0],
    'NW1': ['bo$2o$obo!', 0, -1],
    'NW2': ['2o$obo$o!', 0, -1],
    'NW3': ['b2o$2o$2bo!', -1, -1],
    'NE0': ['3o$2bo$bo!', 0, 0],
    'NE1': ['bo$b2o$obo!', 0, -1],
    'NE2': ['b2o$obo$2bo!', 0, -1],
    'NE3': ['2o$b2o$o!', 1, -1],
    'SW0': ['bo$o$3o!', 0, 0],
    'SW1': ['obo$2o$bo!', 0, 1],
    'SW2': ['o$obo$2o!', 0, 1],
    'SW3': ['2bo$2o$b2o!', -1, 1],
    'SE0': ['bo$2bo$3o!', 0, 0],
    'SE1': ['obo$b2o$bo!', 0, 1],
    'SE2': ['2bo$obo$b2o!', 0, 1],
    'SE3': ['o$b2o$2o!', 1, 1],
};

const INTENTIONAL_SPARKS = ['32e', '167', '296', '16', '3'];


let base = createMAPPattern('B3/S23') as MAPPattern;

let knots = getKnots(base.trs);

let reverseGliders: {[key: string]: [p: MAPPattern, x: number, y: number]} = {};
for (let [key, [rle, x, y]] of Object.entries(REVERSE_GLIDERS)) {
    reverseGliders[key] = [base.loadRLE(rle), x, y];
}

let conduitObjects: {[key: string]: ConduitObjectInfo} = {};

function addRegion(p: MAPPattern, obj: string, dir: Direction, time: number, center: number): void {
    p = p.copy();
    let found = false;
    let x = 0;
    let y = 0;
    let i = 0;
    for (let y2 = 0; y2 < p.height; y2++) {
        for (let x2 = 0; x2 < p.width; x2++) {
            if (p.data[i++] === 2) {
                p.data[i - 1] = center;
                x = x2;
                y = y2;
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        p.rule.states = 3;
        p.rule.str = 'B3/S23History';
        console.log(p.toRLE());
        throw new Error(`No center cell found for ${obj}${dir}${time}`);
    }
    let value = {p, obj, dir, x, y, time};
    let code = p.toApgcode();
    if (!(code in conduitObjects)) {
        conduitObjects[code] = value;
    }
    let key = obj + dir + time;
    if (!(key in conduitObjects)) {
        conduitObjects[key] = value;
    }
}

function addConduitObject(key: string, code: string, x: number, y: number, gens: number = CONDUIT_OBJECT_LOOKAHEAD_GENS, timeOffset: number = 0): void {
    let p = base.loadApgcode(code).shrinkToFit();
    p.xOffset = 0;
    p.yOffset = 0;
    for (let i = 0; i <= gens; i++) {
        let x2 = x - p.xOffset;
        let y2 = y - p.yOffset;
        if (x2 < 0 || y2 < 0 || x2 >= p.width || y2 >= p.height) {
            let oldX = p.xOffset;
            let oldY = p.yOffset;
            p.expand(
                y2 < 0 ? -y2 : 0,
                y2 >= p.height ? p.height - y2 + 1 : 0,
                x2 < 0 ? -x2 : 0,
                x2 >= p.width ? p.width - x2 + 1 : 0,
            );
            x2 += oldX - p.xOffset;
            y2 += oldY - p.yOffset;
        }
        let center = p.get(x2, y2);
        p.set(x2, y2, 2);
        addRegion(p, key, 'F', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'L', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'B', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'R', i + timeOffset, center);
        p.rotateLeft();
        p.flipVertical();
        addRegion(p, key, 'Fx', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'Lx', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'Bx', i + timeOffset, center);
        p.rotateLeft();
        addRegion(p, key, 'Rx', i + timeOffset, center);
        p.rotateLeft();
        p.flipVertical();
        p.set(x2, y2, center);
        p.runGeneration();
        p.shrinkToFit();
    }
}

for (let [key, value] of Object.entries(CONDUIT_OBJECTS)) {
    addConduitObject(key, value[1], value[2], value[3]);
}

for (let [key, value] of Object.entries(OTHER_CONDUIT_OBJECTS)) {
    addConduitObject(value[0], key, value[1], value[2], value[4], value[3]);
}

let smallObjectFates: {[key: string]: (false | string | (typeof GLIDERS)[string])[]} = {};
for (let [width, height] of SMALL_OBJECT_DIMENSIONS) {
    let size = height * width;
    let p = base.copy();
    let value: (typeof smallObjectFates)[string] = [];
    for (let i = 0; i < 2**size; i++) {
        p.width = width;
        p.height = height;
        p.size = size;
        p.data = new Uint8Array(size);
        for (let j = 0; j < size; j++) {
            p.data[j] = (i & (1 << j)) >> j;
        }
        if (p.population < 3) {
            value.push(false);
            continue;
        }
        if (width === 3 && height === 3 && p.data.join('') in GLIDERS) {
            value.push(GLIDERS[p.data.join('')]);
            continue;
        }
        p.runGeneration();
        if (p.population < 3) {
            value.push(false);
            continue;
        } else if (p.width === width && p.height === height && p.data.every((x, j) => x === ((i & (1 << j)) >> j))) {
            value.push(`xs${p.population}_${p.shrinkToFit().toCanonicalApgcode()}`);
            continue;
        }
        p.runGeneration();
        if (p.population < 3) {
            value.push(false);
            continue;
        } else if (p.width === width && p.height === height && p.data.every((x, j) => x === ((i & (1 << j)) >> j))) {
            value.push(`xp2_${p.shrinkToFit().toCanonicalApgcode(2)}`);
            continue;
        }
        value.push(false);
    }
    smallObjectFates[String(width) + String(height)] = value;
}


export function catalystsAreFine(p: MAPPattern, cats: Catalyst[]): boolean {
    for (let cat of cats) {
        let x = cat.x - p.xOffset;
        let y = cat.y - p.yOffset;
        let i = y * p.width + x;
        if (cat.period === 1) {
            let j = 0;
            for (let y2 = 0; y2 < cat.p.height; y2++) {
                for (let x2 = 0; x2 < cat.p.width; x2++) {
                    if (cat.p.data[j++] !== p.data[i + x2]) {
                        return false;
                    }
                }
                i += p.width;
            }
        } else {
            let q = cat.p.copy().run(p.generation % cat.period).shrinkToFit();
            let i = (y + q.yOffset) * p.width + (x + q.xOffset);
            let j = 0;
            for (let y2 = 0; y2 < cat.p.height; y2++) {
                for (let x2 = 0; x2 < cat.p.width; x2++) {
                    if (q.data[j++] !== p.data[i + x2]) {
                        return false;
                    }
                }
                i += p.width;
            }
        }
    }
    return true;
}


export function getObjectInfo(obj: string | ConduitObject): ConduitObjectInfo {
    if (typeof obj === 'string') {
        if ((obj + 'F0') in conduitObjects) {
            return conduitObjects[obj + 'F0'];
        } else {
            return {obj, dir: 'F', time: 0, p: base.loadApgcode(obj.slice(1, -1)), x: 0, y: 0};
        }
    } else {
        let key = obj.obj + obj.dir + obj.time;
        if (key in conduitObjects) {
            return conduitObjects[key];
        } else {
            return Object.assign({}, obj, {p: base.loadApgcode(obj.obj.slice(1, -1)), x: 0, y: 0});
        }
    }
}

export function createPartial(p: MAPPattern, sepGens: number, identifyGens: number): [Partial, ConduitObject] {
    let sep = new INTSeparator(p, knots);
    sep.resolveKnots();
    let startP: MAPPattern | undefined = undefined;
    let cats: Catalyst[] = [];
    for (let i = 0; i <= sepGens; i++) {
        startP = undefined;
        cats = [];
        for (let p of sep.getObjects()) {
            let type = findType(p, identifyGens);
            if (type.disp && type.stabilizedAt === 0 && type.disp[0] === 0 && type.disp[1] === 0) {
                cats.push({period: type.period, p, x: p.xOffset, y: p.yOffset});
            } else {
                if (startP !== undefined) {
                    if (INTENTIONAL_SPARKS.includes(p.toCanonicalApgcode())) {
                        continue;
                    }
                    if (i === sepGens - 1) {
                        throw new Error(`More than 1 start object! (If there isn't, there is a bug, please tell speedydelete)`);
                    }
                }
                startP = p;
            }
        }
        if (startP) {
            break;
        }
        sep.runGeneration();
        sep.resolveKnots();
    }
    if (!startP) {
        throw new Error('No start object!');
    }
    let start: ConduitObject;
    let code = startP.toApgcode();
    if (code in conduitObjects) {
        let data = conduitObjects[code];
        if (data.dir !== 'F') {
            p = p.copy();
            let dir = data.dir;
            if (dir[0] === 'R') {
                p.rotateLeft();
            } else if (dir[0] === 'L') {
                p.rotateRight();
            } else if (dir[0] === 'B') {
                p.rotate180();
            }
            if (dir[1] === 'x') {
                p.flipVertical();
            }
            return createPartial(p, sepGens, identifyGens);
        }
        start = {obj: data.obj, dir: data.dir, time: data.time};
        p.xOffset -= startP.xOffset + data.x;
        p.yOffset -= startP.yOffset + data.y;
        for (let cat of cats) {
            cat.x -= startP.xOffset + data.x;
            cat.y -= startP.yOffset + data.y;
        }
    } else {
        start = {obj: `(${code})`, dir: 'F', time: 0};
    }
    return [{p, cats, prevPs: []}, start];
}


export function toRanges(data: number[]): string {
    data = data.sort((a, b) => a - b);
    let out: string[] = [];
    let start = data[0];
    let last = data[0];
    for (let value of data.slice(1)) {
        if (value !== last + 1) {
            if (start === last) {
                out.push(String(start));
            } else {
                out.push(`${start}-${last}`);
            }
            start = value;
        }
        last = value;
    }
    if (start === last) {
        out.push(String(start));
    } else {
        out.push(`${start}-${last}`);
    }
    return out.join(', ');
}

export function getConduitName(data: Conduit): string {
    let out: string[] = [];
    for (let obj of data.output) {
        let objStr: string;
        if (obj.objTime !== 0) {
            if (obj.obj.startsWith('(')) {
                objStr = `(${obj.obj.slice(1, -1)}+${obj.objTime})`;
            } else {
                objStr = `(${obj.obj}+${obj.objTime})`;
            }
        } else {
            objStr = obj.obj;
        }
        out.push(obj.dir + obj.time + objStr);
    }
    for (let obj of data.gliders) {
        out.push(obj.dir + obj.lane + 'T' + obj.timing);
    }
    if (data.otherOutputs.length > 0) {
        out.push(data.time + 'X');
        let counts: {[key: string]: number} = {};
        for (let obj of data.otherOutputs) {
            if (obj.code in counts) {
                counts[obj.code]++;
            } else {
                counts[obj.code] = 1;
            }
        }
        for (let [obj, count] of Object.entries(counts).sort((a, b) => a[0] < b[0] ? -1 : 1)) {
            out.push(`${count === 1 ? '' : count + 'x'}(${obj})`);   
        }
    }
    let input: string;
    if (data.inputTime) {
        let inputTimeStr: string;
        if (data.inputTime < 0) {
            inputTimeStr = '-' + data.inputTime;
        } else {
            inputTimeStr = '+' + data.inputTime;
        }
        if (data.input.startsWith('(')) {
            input = `(${data.input.slice(1, -1)}${inputTimeStr})`;
        } else {
            input = `(${data.input}${inputTimeStr})`;
        }
    } else {
        input = data.input;
    }
    if (out.length === 0) {
        return input + data.time + 'X';
    } else {
        return input + out.join('_');
    }
}

export function removeHIfPossible(name: string): string {
    if (!name.startsWith('H')) {
        return name;
    }
    let index = name.indexOf('_');
    if (index === -1) {
        if (name[name.length - 1] === 'H') {
            return name.slice(1, -1);
        } else {
            return name;
        }
    } else if (name[index - 1] === 'H') {
        return name.slice(1, index - 1) + name.slice(index);
    } else if (name.startsWith('HNW') || name.startsWith('HNE') || name.startsWith('HSW') || name.startsWith('HSE')) {
        return name.slice(1);
    } else {
        return name;
    }
}


function worksAtRepeatTime(data: Conduit, cats: Catalyst[], start: ConduitObjectInfo, rt: number, removeFNG?: number): boolean {
    let p = data.p.copy(); 
    for (let i = 0; i < rt; i++) {
        p.runGeneration();
        p.shrinkToFit();
        if (i > data.time) {
            continue;
        }
        if (removeFNG !== undefined && p.generation === removeFNG) {
            let i = (-p.yOffset - 3) * p.width - p.xOffset - 1;
            p.data[i + 1] = 0;
            p.data[i + p.width] = 0;
            p.data[i + 2 * p.width] = 0;
            p.data[i + 2 * p.width + 1] = 0;
            p.data[i + 2 * p.width + 2] = 0;
        }
        for (let obj of data.output) {
            if (p.generation === obj.time) {
                let value = conduitObjects[obj.obj + obj.dir + '0'];
                let x = obj.x - value.x - p.xOffset;
                let y = obj.y - value.y - p.yOffset;
                let i = 0;
                for (let y2 = 0; y2 < value.p.height; y2++) {
                    let loc = (y + y2) * p.width + x;
                    for (let x2 = 0; x2 < value.p.width; x2++) {
                        if (value.p.data[i++]) {
                            p.data[loc] = 0;
                        }
                        loc++;
                    }
                }
            }
        }
        if (p.generation === data.time) {
            for (let obj of data.otherOutputs) {
                let x = obj.x - p.xOffset;
                let y = obj.y - p.yOffset;
                let i = 0;
                for (let y2 = 0; y2 < obj.p.height; y2++) {
                    let loc = (y + y2) * p.width + x;
                    for (let x2 = 0; x2 < obj.p.width; x2++) {
                        if (obj.p.data[i++]) {
                            p.data[loc] = 0;
                        }
                        loc++;
                    }
                }
                p.shrinkToFit();
            }
        }
    }
    let x = -p.xOffset - start.x;
    let y = -p.yOffset - start.y;
    if (x < 0 || x + start.p.width >= p.width || y < 0 || y + start.p.height >= p.height) {
        p.expand(
            y < 0 ? -y : 0,
            y + start.p.height >= p.height ? y + start.p.height - p.height : 0,
            x < 0 ? -x : 0,
            x + start.p.width >= p.width ? x + start.p.width - p.width : 0,
        );
    }
    p.insert(start.p, -p.xOffset - start.x, -p.yOffset - start.y);
    let found = 0;
    for (let i = 0; i <= data.time; i++) {
        p.runGeneration();
        p.shrinkToFit();
        for (let obj of data.output) {
            if (p.generation === obj.time || p.generation === obj.time + rt) {
                let value = conduitObjects[obj.obj + obj.dir + '0'];
                let x = obj.x - value.x - p.xOffset;
                let y = obj.y - value.y - p.yOffset;
                if (x < 0 || y < 0 || x + value.p.width > p.width || y + value.p.height > p.height) {
                    return false;
                }
                let i = 0;
                for (let y2 = 0; y2 < value.p.height; y2++) {
                    let loc = (y + y2) * p.width + x;
                    for (let x2 = 0; x2 < value.p.width; x2++) {
                        if (value.p.data[i] !== p.data[loc]) {
                            return false;
                        }
                        i++;
                        p.data[loc++] = 0;
                    }
                }
                if (p.generation === obj.time + rt) {
                    found++;
                }
            }
        }
        if (p.generation === data.time || p.generation === data.time + rt) {
            for (let obj of data.otherOutputs) {
                let x = obj.x - p.xOffset;
                let y = obj.y - p.yOffset;
                let i = 0;
                for (let y2 = 0; y2 < obj.p.height; y2++) {
                    let loc = (y + y2) * p.width + x;
                    for (let x2 = 0; x2 < obj.p.width; x2++) {
                        if (obj.p.data[i] !== p.data[loc]) {
                            return false;
                        }
                        i++;
                        p.data[loc++] = 0;
                    }
                }
                p.shrinkToFit();
                if (p.generation === data.time + rt) {
                    found++;
                }
            }
            for (let ship of data.gliders) {
                if (p.generation === data.time && data.input === 'H' && ship.dir === 'SW' && ship.lane === -2 && ship.timing === 21) {
                    continue;
                }
                let timing = data.time - ship.timing;
                let mod4 = timing % 4;
                if (mod4 < 0) {
                    mod4 += 4;
                }
                let [q, x, y] = reverseGliders[ship.dir + mod4];
                timing -= mod4;
                if (ship.dir === 'NW') {
                    x -= timing / 4;
                    y -= ship.lane + timing / 4;
                } else if (ship.dir === 'NE') {
                    x += timing / 4;
                    y -= ship.lane + timing / 4;
                } else if (ship.dir === 'SW') {
                    x -= timing / 4;
                    y += ship.lane + timing / 4;
                } else {
                    x += timing / 4;
                    y += -ship.lane + timing / 4;
                }
                x -= p.xOffset + 1;
                y -= p.yOffset + 1;
                let i = 0;
                for (let y2 = 0; y2 < q.height; y2++) {
                    let loc = (y + y2) * p.width + x;
                    for (let x2 = 0; x2 < q.width; x2++) {
                        if (q.data[i] !== p.data[loc]) {
                            return false;
                        }
                        i++;
                        p.data[loc++] = 0;
                    }
                }
                p.shrinkToFit();
                if (p.generation === data.time + rt) {
                    found++;
                }
            }
        }
    }
    return Boolean(found === data.output.length + data.gliders.length + data.otherOutputs.length && catalystsAreFine(p, cats));
}

function getConduitInfo(data: Partial, input: ConduitObject, time: number, output: Conduit['output'], gliders: Glider[], otherOutputs: (ObjData & {code: string})[], maxRT: number, reconstruct: boolean = false): Conduit {
    for (let x of output) {
        x.time += input.time;
    }
    for (let x of gliders) {
        x.timing += input.time;
    }
    let start = getObjectInfo(input);
    let p: MAPPattern;
    if (reconstruct) {
        // we need to reconstruct the conduit from the catalysts
        let minX = -start.x;
        let minY = -start.y;
        let maxX = minX + start.p.width;
        let maxY = minY + start.p.height;
        for (let cat of data.cats) {
            minX = Math.min(minX, cat.x);
            minY = Math.min(minY, cat.y);
            maxX = Math.max(maxX, cat.x + cat.p.width);
            maxY = Math.max(maxY, cat.y + cat.p.height);
        }
        p = base.copy();
        p.height = maxY - minY + 1;
        p.width = maxX - minX + 1;
        p.size = p.height * p.width;
        p.data = new Uint8Array(p.size);
        p.xOffset = minX;
        p.yOffset = minY;
        p.insert(start.p, -minX - start.x, -minY - start.y);
        for (let obj of data.cats) {
            p.insert(obj.p, obj.x - minX, obj.y - minY);
        }
        p.shrinkToFit();
    } else {
        p = data.p;
    }
    let out: Conduit = {p, input: input.obj, time, output, gliders, otherOutputs};
    if (input.time !== 0) {
        out.inputTime = input.time;
    }
    // now we find the repeat time and determine overclocks
    let removeFNG: number | undefined = undefined;
    if (input.obj === 'H' && gliders.some(x => x.dir === 'SW' && x.lane === -2 && x.timing === 21)) {
        removeFNG = 21 - input.time;
    }
    let worksAt: boolean[] = [false];
    for (let rt = 1; rt < maxRT; rt++) {
        worksAt.push(worksAtRepeatTime(out, data.cats, start, rt, removeFNG));
    }
    let rt = worksAt.length - 1;
    if (worksAt[rt]) {
        for (; rt > 1; rt--) {
            if (!worksAt[rt - 1]) {
                break;
            }
        }
        out.repeatTime = rt;
        out.overclock = worksAt.slice(0, rt).map((x, i) => x ? i : -1).filter(x => x !== -1);
    }
    return out;
}

function combineObjects(objs: ObjData[]): undefined | ObjData {
    if (objs.length === 1) {
        return objs[0];
    }
    let obj = objs[0];
    let data = objs.slice(1);
    let minX = obj.x;
    let minY = obj.y;
    let maxX = obj.maxX;
    let maxY = obj.maxY;
    for (let obj of data) {
        if (obj.x < minX) {
            minX = obj.x;
        }
        if (obj.y < minY) {
            minY = obj.y;
        }
        if (obj.maxX > maxX) {
            maxX = obj.maxX;
        }
        if (obj.maxY > maxY) {
            maxY = obj.maxY;
        }
    }
    let p = base.copy();
    p.height = maxY - minY + 1;
    p.width = maxX - minX + 1;
    p.size = p.height * p.width;
    p.data = new Uint8Array(p.size);
    p.xOffset = minX;
    p.yOffset = minY;
    p.insert(obj.p, obj.x - minX, obj.y - minY);
    for (let obj of data) {
        p.insert(obj.p, obj.x - minX, obj.y - minY);
    }
    p.shrinkToFit();
    let code: string | undefined = undefined;
    let type = findType(p, 2);
    if (type.period !== -1) {
        if (type.pops[type.pops.length - 1] === 0) {
            return undefined;
        }
        if (type.stabilizedAt === 1) {
            p.runGeneration();
        }
        code = `${type.period === 2 ? 'xp2' : 'xs' + p.population}_${p.toCanonicalApgcode(type.period)}`;
    }
    return {
        p,
        x: p.xOffset,
        y: p.yOffset,
        w: p.width,
        h: p.height,
        maxX: p.xOffset + p.width,
        maxY: p.yOffset + p.height,
        code,
    };
}

function partitions<T>(data: T[], index: number = 0, groups: T[][] = []): T[][][] {
    if (index === data.length) {
        return [groups.map(x => x.slice())];
    }
    let out: T[][][] = [];
    let value = data[index];
    for (let group of groups) {
        group.push(value);
        for (let x of partitions(data, index + 1, groups)) {
            out.push(x);
        }
        group.pop();
    }
    groups.push([value]);
    for (let x of partitions(data, index + 1, groups)) {
        out.push(x);
    }
    groups.pop();
    return out;
}

export function checkConduit(data: Partial, sepGens: number, start: ConduitObject, maxRT: number): false | Conduit {
    // first we remove the catalysts (we assume that all catalysts are restored)
    let p = data.p.copy();
    for (let cat of data.cats) {
        let i = 0;
        for (let y = 0; y < cat.p.height; y++) {
            for (let x = 0; x < cat.p.width; x++) {
                if (cat.p.data[i++]) {
                    p.data[(y + cat.y - p.yOffset) * p.width + (x + cat.x - p.xOffset)] = 0;
                }
            }
        }
    }
    p.shrinkToFit();
    // now we check if it is a pure conduit
    let code = p.toApgcode();
    if (code in conduitObjects) {
        let {p: q, obj, dir, x, y, time} = conduitObjects[code];
        x += p.xOffset;
        y += p.yOffset;
        if (time >= 0) {
            let time2 = p.generation - time;
            if (!(x === 0 && y === 0 && time2 === 0)) {
                return getConduitInfo(data, start, time, [{obj, dir, time: time2, x, y, p: q, objTime: time}], [], [], maxRT, true);
            }
        }
    }
    // first we run object separation and get a list of stable and unstable objects
    let sep = new INTSeparator(p, knots);
    sep.runGeneration();
    for (let i = 0; i < sepGens; i++) {
        sep.runGeneration();
        sep.resolveKnots();
    }
    let objs: ObjData[] = [];
    let stableCount = 0;
    let unstableCount = 0;
    let gliders: Glider[] = [];
    for (let p of sep.getObjects()) {
        let code: string | undefined = undefined;
        let key = String(p.width) + String(p.height);
        if (key in smallObjectFates) {
            let key2 = 0;
            for (let i = 0; i < p.data.length; i++) {
                key2 |= p.data[i] << i;
            }
            let value = smallObjectFates[key][key2];
            if (value) {
                if (typeof value === 'string') {
                    code = value;
                } else {
                    let [dir, timing, xAdjust] = value;
                    let x = p.xOffset + 1 + xAdjust;
                    let y = p.yOffset + 1;
                    timing += sep.generation - sepGens;
                    let lane: number;
                    if (dir === 'NW') {
                        lane = x - y;
                        timing += x * 4;
                    } else if (dir === 'NE') {
                        lane = x + y;
                        timing -= x * 4;
                    } else if (dir === 'SW') {
                        lane = x + y;
                        timing += x * 4;
                    } else {
                        lane = x - y;
                        timing -= x * 4;
                    }
                    gliders.push({dir, lane, timing});
                    continue;
                }
            }
        } else {
            let pop = p.population;
            let q = p.copy();
            q.runGeneration();
            if (p.height === q.height && p.width === q.width && q.population === pop && q.data.every((x, i) => x === p.data[i])) {
                code = `xs${pop}_${p.toCanonicalApgcode()}`;
            } else {
                q.runGeneration();
                if (p.height === q.height && p.width === q.width && q.population === pop && q.data.every((x, i) => x === p.data[i])) {
                    code = `xp2_${p.toCanonicalApgcode(2)}`;
                }
            }
        }
        objs.push({
            p,
            x: p.xOffset,
            y: p.yOffset,
            w: p.width,
            h: p.height,
            maxX: p.xOffset + p.width,
            maxY: p.yOffset + p.height,
            code,
        });
        if (code) {
            stableCount++;
        } else {
            unstableCount++;
        }
    }
    // if there are no unstables then it's a factory
    if (unstableCount === 0) {
        return getConduitInfo(data, start, sep.generation, [], gliders, objs as (ObjData & {code: string})[], maxRT, true);
    }
    // now we check every combination and see if it's a conduit
    for (let groups of partitions(objs)) {
        let objs = groups.map(x => combineObjects(x)).filter(x => x !== undefined);
        let outputs: Conduit['output'] = [];
        let otherOutputs: (ObjData & {code: string})[] = [];
        let found = false;
        for (let obj of objs) {
            if (obj.code) {
                otherOutputs.push(obj as ObjData & {code: string});
            } else {
                let code = obj.p.toApgcode();
                if (code in conduitObjects) {
                    let {p: q, obj: obj2, dir, x, y, time} = conduitObjects[code];
                    x += obj.x;
                    y += obj.y;
                    if (time >= 0) {
                        let time2 = (p.generation + (sepGens + 1)) - time;
                        if (x === 0 && y === 0 && time2 === 0) {
                            found = true;
                            break;
                        }
                        if (time > 0) {
                            let index = data.prevPs.length - 1 + (sepGens + 1);
                            while (time > 0 && index > 0) {
                                let p2 = data.prevPs[index] ?? p;
                                let obj3 = conduitObjects[obj2 + dir + (time - 1)];
                                let i = 0;
                                let found = false;
                                for (let y2 = 0; y2 < obj3.p.height; y2++) {
                                    let loc = (y - p2.yOffset - obj3.y + y2) * p2.width + (x - p2.xOffset - obj3.x);
                                    for (let x2 = 0; x2 < obj3.p.width; x2++) {
                                        if (obj3.p.data[i++]) {
                                            if (!p2.data[loc]) {
                                                found = true;
                                                break;
                                            }
                                        }
                                        loc++;
                                    }
                                    if (found) {
                                        break;
                                    }
                                }
                                if (found) {
                                    break;
                                }
                                time--;
                                index--;
                            }
                        }
                        outputs.push({obj: obj2, dir, time: time2, p: q, x, y, objTime: time});
                    } else {
                        continue;
                    }
                } else {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            return getConduitInfo(data, start, sep.generation, outputs, gliders, otherOutputs, maxRT, true);
        }
    }
    return false;
}


export function identifyConduit(p: MAPPattern, minTime: number, maxTime: number, maxRT: number, sepGens: number, identifyGens: number): false | Conduit {
    let [partial, start] = createPartial(p, sepGens, identifyGens);
    p = partial.p;
    for (let i = 0; i < maxTime; i++) {
        if (i >= minTime && catalystsAreFine(p, partial.cats)) {
            let value = checkConduit(partial, sepGens, start, maxRT);
            if (value) {
                return value;
            }
        }
        partial.prevPs.push(p.copy());
        p.runGeneration();
    }
    return false;
}
