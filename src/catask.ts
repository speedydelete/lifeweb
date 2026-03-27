
import {MAPPattern, findType, findStaticSymmetry, getKnots, INTSeparator, createPattern} from './core/index.js';


const VERSION = '1.0';

const CONDUIT_OBJECT_LOOKAHEAD_GENS = 64;
const MAX_REPEAT_TIME = 384;

const CREATE_PARTIAL_MAX_SEP_GENS = 16;

const IDENTIFY_MAX_TIME = 384;
const IDENTIFY_CONDUIT_SEP_GENS = 0;
const IDENTIFY_IDENTIFY_GENS = 30;

const UPDATE_INTERVAL = 3;


export type Direction = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';
export type ExpandedDirection = Direction | 'F*' | 'L*' | 'B*' | 'R*' | 'T';

export type GliderDirection = 'NW' | 'NE' | 'SW' | 'SE';
export type XWSSDirection = 'N' | 'S' | 'E' | 'W';

export type CatalystType = 'block' | 'custom';

export interface Catalyst {
    type: CatalystType;
    p: MAPPattern;
    x: number;
    y: number;
}

export interface Partial {
    p: MAPPattern;
    cats: Catalyst[];
    p2Prev?: {
        hash: number;
        pop: number;
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
    dir: ExpandedDirection;
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
    output: ConduitObjectInfo[];
    gliders: Glider[];
    otherOutputs: (ObjData & {code: string})[];
    repeatTime?: number;
    repeatTimeWithFNG?: number;
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

export const CONDUIT_OBJECTS: {[key: string]: [name: string, code: string, centerX: number, centerY: number, symmetric: boolean]} = {
    'R': ['R-pentomino', '472', 1, 1, false],
    'B': ['B-heptomino', 'd72', 1, 1, false],
    'H': ['herschel', '74e', 1, 2, false],
    'C': ['century', 'c97', 2, 1, false],
    'D': ['dove', 'ci97', 2, 1, false],
    'E': ['E-heptomino', '1572' , 2, 1, false],
    'P': ['pi-heptomino', '557', 1, 1, true],
    'Q': ['queen bee', '3us8z31', 2, 3, true],
    'W': ['wing', 'c53', 1, 1, false],
    'U': ['U-turner', '77ac', 1, 1, false],
    'L': ['LWSS', '5889e', 4, 2, false],
    'M': ['MWSS', 'aghgis', 5, 3, false],
};

const OTHER_CONDUIT_OBJECTS: {[key: string]: [value: string, time: number, x: number, y: number, symmetric: boolean, gens: number]} = {
    'pe4': ['B', 0, 1, 2, false, 0],
    '2eehfd': ['H', -5, 4, 3, false, 4],
    '577': ['P', 0, 1, 1, false, 2],
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


let base = createPattern('B3/S23') as MAPPattern;

let knots = getKnots(base.trs);

const BLOCK = base.loadApgcode('33').shrinkToFit();

let reverseGliders: {[key: string]: [p: MAPPattern, x: number, y: number]} = {};
for (let [key, [rle, x, y]] of Object.entries(REVERSE_GLIDERS)) {
    reverseGliders[key] = [base.loadRLE(rle), x, y];
}

let conduitObjects: {[key: string]: ConduitObjectInfo} = {};

function addRegion(p: MAPPattern, obj: string, dir: ExpandedDirection, time: number, center: number): void {
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
        (p.states as number) = 3;
        p.ruleStr = 'B3/S23History';
        console.log(p.toRLE());
        throw new Error(`No center cell found for ${obj}${dir}${time}`);
    }
    let value = {p, obj, dir, x, y, time};
    let code = p.toApgcode();
    conduitObjects[code] = value;
    let key = obj + dir + time;
    if (!(key in conduitObjects)) {
        conduitObjects[key] = value;
    }
}

function addConduitObject(key: string, code: string, x: number, y: number, symmetric: boolean, gens: number = CONDUIT_OBJECT_LOOKAHEAD_GENS, timeOffset: number = 0): void {
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
        if (symmetric) {
            addRegion(p, key, 'F*', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'R*', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'B*', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'L*', i + timeOffset, center);
            p.rotateRight();
        } else {
            addRegion(p, key, 'F', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'R', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'B', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'L', i + timeOffset, center);
            p.rotateRight();
            p.flipVertical();
            addRegion(p, key, 'Fx', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'Rx', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'Bx', i + timeOffset, center);
            p.rotateRight();
            addRegion(p, key, 'Lx', i + timeOffset, center);
            p.rotateRight();
            p.flipVertical();
        }
        p.set(x2, y2, center);
        p.runGeneration();
        p.shrinkToFit();
    }
}

for (let [key, value] of Object.entries(CONDUIT_OBJECTS)) {
    addConduitObject(key, value[1], value[2], value[3], value[4]);
}

for (let [key, value] of Object.entries(OTHER_CONDUIT_OBJECTS)) {
    addConduitObject(value[0], key, value[1], value[2], value[4], value[5], value[3]);
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


export function getObjectInfo(obj: string | ConduitObject): ConduitObjectInfo {
    if (typeof obj === 'string') {
        if (obj.startsWith('(')) {
            return {obj, dir: 'F', time: 0, p: base.loadApgcode(obj.slice(1, -1)), x: 0, y: 0};
        } else {
            return conduitObjects[obj + 'F0'];
        }
    } else {
        if (obj.obj.startsWith('(')) {
            return Object.assign({}, obj, {p: base.loadApgcode(obj.obj.slice(1, -1)), x: 0, y: 0});
        } else {
            return conduitObjects[obj.obj + obj.dir + obj.time];
        }
    }
}

export function isSymmetric(obj: string): boolean {
    if (obj.startsWith('(')) {
        let p = base.loadApgcode(obj.slice(1, -1));
        return findStaticSymmetry(p) !== 'n';
    } else {
        return CONDUIT_OBJECTS[obj][4];
    }
}

export function createPartial(p: MAPPattern): [Partial, ConduitObject] {
    let sep = new INTSeparator(p, knots);
    sep.resolveKnots();
    let startP: MAPPattern | undefined = undefined;
    let cats: Catalyst[] = [];
    for (let i = 0; i < CREATE_PARTIAL_MAX_SEP_GENS; i++) {
        startP = undefined;
        cats = [];
        for (let p of sep.getObjects()) {
            let type = findType(p, IDENTIFY_IDENTIFY_GENS);
            type.pops = [];
            type.hashes = [];
            type.phases = [];
            if (type.disp) {
                if (type.stabilizedAt > 0) {
                    continue;
                } else if (type.disp[0] !== 0 || type.disp[1] !== 0) {
                    throw new Error('Spaceships are not supported');
                } else if (type.period !== 1) {
                    throw new Error('Oscillators are not supported');
                }
                cats.push({type: 'custom', p, x: p.xOffset, y: p.yOffset});
            } else {
                if (startP !== undefined) {
                    if (INTENTIONAL_SPARKS.includes(p.toCanonicalApgcode())) {
                        continue;
                    }
                    if (i === CREATE_PARTIAL_MAX_SEP_GENS - 1) {
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
        if (!(data.dir === 'F' || data.dir === 'F*')) {
            p = p.copy();
            let dir = data.dir;
            if (dir[0] === 'R') {
                p.rotateLeft();
            } else if (dir[0] === 'L') {
                p.rotateRight();
            } else if (dir[0] === 'B') {
                p.rotate180();
            } else if (dir[0] === 'T') {
                p.rotateRight();
            }
            if (dir[1] === 'x') {
                p.flipVertical();
            }
            return createPartial(p);
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
    return [{p, cats}, start];
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
        out.push(obj.dir + obj.time + obj.obj);
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
        if (data.input.startsWith('(')) {
            input = `(${data.input.slice(1, -1)}${data.inputTime < 0 ? data.inputTime : '+' + data.inputTime})`;
        } else {
            input = `(${data.input}${data.inputTime < 0 ? data.inputTime : '+' + data.inputTime})`;
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
    if (name[index - 1] === 'H') {
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
            for (let ship of data.gliders) {
                if (data.input === 'H' && removeFNG !== undefined && ship.dir === 'SW' && ship.lane === -2 && ship.timing === 21) {
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
                let i = 0;
                for (let y2 = 0; y2 < q.height; y2++) {
                    let loc = (y + y2 - p.yOffset - 1) * p.width + (x - p.xOffset - 1);
                    for (let x2 = 0; x2 < q.width; x2++) {
                        if (q.data[i++]) {
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
                if (p.generation === data.time && data.input === 'H' && removeFNG !== undefined && ship.dir === 'SW' && ship.lane === -2 && ship.timing === 21) {
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

function getConduitInfo(data: Partial, input: ConduitObject, time: number, output: Conduit['output'], gliders: Glider[], otherOutputs: (ObjData & {code: string})[], reconstruct: boolean = false): Conduit {
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
    for (let rt = 1; rt < MAX_REPEAT_TIME; rt++) {
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
        if (removeFNG !== undefined) {
            for (; rt > 0; rt--) {
                if (!worksAtRepeatTime(out, data.cats, start, rt)) {
                    break;
                }
            }
            out.repeatTimeWithFNG = rt;
        }
    }
    if (isSymmetric(out.input)) {
        for (let obj of out.output) {
            if (obj.dir.startsWith('F')) {
                obj.dir = 'F*';
            } else if (obj.dir.startsWith('B')) {
                obj.dir = 'B*';
            } else {
                if (isSymmetric(obj.obj)) {
                    obj.dir = 'T';
                } else {
                    if (obj.dir.startsWith('L')) {
                        obj.dir = 'L*';
                    } else {
                        obj.dir = 'R*';
                    }
                }
            }
        }
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

export function checkConduit(data: Partial, sepGens: number, start: ConduitObject, maxStables?: number, maxUnstables?: number): false | Conduit {
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
        time = p.generation - time;
        if (!(x === 0 && y === 0 && time === 0)) {
            return getConduitInfo(data, start, time, [{obj, dir, time, x, y, p: q}], [], [], true);
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
            if (maxStables !== undefined && stableCount > maxStables) {
                return false;
            }
        } else {
            unstableCount++;
            if (maxUnstables !== undefined && unstableCount > maxUnstables) {
                return false;
            }
        }
    }
    // if there are no unstables then it's a factory
    if (unstableCount === 0) {
        return getConduitInfo(data, start, sep.generation, [], gliders, objs as (ObjData & {code: string})[], true);
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
                    time = (p.generation + (sepGens + 1)) - time;
                    if (x === 0 && y === 0 && time === 0) {
                        found = true;
                        break;
                    }
                    outputs.push({obj: obj2, dir, time, p: q, x, y});
                } else {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            return getConduitInfo(data, start, sep.generation, outputs, gliders, otherOutputs, true);
        }
    }
    return false;
}


export const ALL_ALLOWED_CATALYSTS: string[] = ['block'];

function catalystsAreFine(p: MAPPattern, cats: Catalyst[]): false | true | 'restored' {
    let height = p.height;
    let width = p.width;
    let data = p.data;
    let restored = true;
    for (let cat of cats) {
        let x = cat.x - p.xOffset;
        let y = cat.y - p.yOffset;
        let i = y * p.width + x;
        if (cat.type === 'block') {
            let pop = data[i] + data[i + 1] + data[i + width] + data[i + width + 1];
            if (pop < 2) {
                // only 1 cell remains in the block, so it has failed
                return false;
            } else if (pop === 2) {
                restored = false;
                if (data[i]) {
                    if (data[i + 1]) {
                        // there is a domino on the top, so there must be a grin facing downwards, or the catalyst has failed
                        if (!(data[i + width - 1] && data[i + width + 2])) {
                            return false;
                        }
                    } else if (data[i + width]) {
                        // there is a domino on the left
                        if (!(data[i - width + 1] && data[i + 2 * width + 1])) {
                            return false;
                        }
                    } else {
                        // there is a duoplet
                        return false;
                    }
                } else if (data[i + width + 1]) {
                    if (data[i + 1]) {
                        // there is a domino on the right
                        if (!(data[i - width] && data[i + 2 * width])) {
                            return false;
                        }
                    } else if (data[i + width]) {
                        // there is a domino on the bottom
                        if (!(data[i - 1] && data[i + 2])) {
                            return false;
                        }
                    } else {
                        // there is a duoplet
                        return false;
                    }
                }
            } else if (pop === 3) {
                restored = false;
            } // else the population is 4 so it is restored
        } else if (cat.type === 'custom') {
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
            throw new Error(`Unrecognized catalyst type: '${cat.type}'`);
        }
    }
    return restored ? 'restored' : true;
}

function checkIfBlockWorks(p: MAPPattern, x: number, y: number, dir: string): boolean {
    // in the first generation the block should be intact
    p.runGeneration();
    let i = y * p.width + x;
    if (!(p.data[i] && p.data[i + 1] && p.data[i + p.width] && p.data[i + p.width + 1])) {
        return false;
    }
    // in the second generation there should be a grin
    p.runGeneration();
    i = y * p.width + x;
    if (dir === 'top') {
        if (!(p.data[i] && p.data[i + 1] && !p.data[i + p.width] && !p.data[i + p.width + 1] && p.data[i + p.width - 1] && p.data[i + p.width + 2])) {
            return false;
        }
    } else if (dir === 'bottom') {
        if (!(p.data[i - 1] && !p.data[i] && !p.data[i + 1] && p.data[i + 2] && p.data[i + p.width] && p.data[i + p.width + 1])) {
            return false;
        }
    } else if (dir === 'left') {
        if (!(p.data[i - p.width] && !p.data[i] && p.data[i + 1] && !p.data[i + p.width] && p.data[i + p.width + 1] && p.data[i + 2 * p.width])) {
            return false;
        }
    } else if (dir === 'right') {
        if (!(p.data[i - p.width + 1] && p.data[i] && !p.data[i + 1] && p.data[i + p.width] && !p.data[i + p.width + 1] && p.data[i + 2 * p.width + 1])) {
            return false;
        }
    } else {
        throw new Error(`Unrecognized direction for block: '${dir}'`);
    }
    // in the third and fourth generations there should be a pre-block
    for (let j = 0; j < 2; j++) {
        p.runGeneration();
        i = y * p.width + x;
        if (p.data[i] + p.data[i + 1] + p.data[i + p.width] + p.data[i + p.width + 1] !== 3) {
            return false;
        }
    }
    // in the fith generation the block should be restored
    p.runGeneration();
    i = y * p.width + x;
    if (!(p.data[i] && p.data[i + 1] && p.data[i + p.width] && p.data[i + p.width + 1])) {
        return false;
    }
    return true;
}

function addCatalyst(out: Partial[], {p, cats, p2Prev}: Partial, type: CatalystType, newCat: MAPPattern, x: number, y: number, dir: string): void {
    x -= p.xOffset;
    y -= p.yOffset;
    // we have to ensure there are no overlaps with other catalysts
    let height = newCat.height;
    let width = newCat.width;
    for (let cat of cats) {
        let minX = Math.min(x, cat.x);
        let minY = Math.min(y, cat.y);
        let maxX = Math.max(x + width, cat.x + cat.p.width);
        let maxY = Math.max(y + height, cat.y + cat.p.height)
        let dx = maxX - minX - (width + cat.p.width);
        let dy = maxY - minY - (width + cat.p.height);
        if (dx <= 0 && dy <= 0) {
            // maybe replace with an auto-welder?
            return;
        // only works if no B2ikn
        } else if (dx >= 2 && dy >= 2) {
            continue;
        } else {
            // we have to test it to know if the still lifes collide
            let p = base.copy();
            p.height = maxX - minX + 1;
            p.width = maxY - minY + 1;
            p.size = p.height * p.width;
            p.data = new Uint8Array(p.size);
            p.insert(newCat, x - minX, y - minY);
            p.insert(cat.p, cat.x - minX, cat.y - minY);
            let q = p.copy();
            q.runGeneration();
            if (p.height !== q.height || p.width !== q.width || !p.data.every((x, i) => x === q.data[i])) {
                // maybe replace with an auto-welder?
                return;
            }
        }
    }
    // add the new catalyst in
    let newCats = cats.slice();
    newCats.push({type, p: newCat, x, y});
    p = p.copy();
    x += p.xOffset;
    y += p.yOffset;
    if (x < 0 || x + width >= p.width || y < 0 || y + height >= p.height) {
        p.expand(
            y < 0 ? -y : 0,
            y + height >= p.height ? y + height - p.height : 0,
            x < 0 ? -x : 0,
            x + width >= p.width ? x + width - p.width : 0,
        );
    }
    p.insert(newCat, x + p.xOffset, y + p.yOffset);
    // make sure the new catalyst actually works
    let q = p.copy();
    if (type === 'block') {
        if (!checkIfBlockWorks(q, x, y, dir)) {
            return;
        }
    } else {
        throw new Error(`Unrecognized catalyst type: '${type}'`);
    }
    out.push({p, cats, p2Prev});
}

export interface SearchOptions {
    start: ConduitObject;
    allowedCatalysts: Set<string>;
    maxCatalysts?: number;
    maxStables?: number;
    maxUnstables?: number;
}

export function searchSingleObject(data: Partial, options: SearchOptions): false | Partial[] {
    let {p, p2Prev} = data;
    let prevHash = p.hash32();
    let prevPop = p.population;
    let prevData = p.data;
    p.runGeneration();
    // check if it died, is period 1, or is period 2
    if (p.population === 0 || (p.data.length === prevData.length && p.population === prevPop && p.hash32() === prevHash && p.data.every((x, i) => prevData[i] === x)) || (p2Prev && (p.data.length === p2Prev.data.length && p.population === p2Prev.pop && p.hash32() === p2Prev.hash && p.data.every((x, i) => p2Prev.data[i] === x)))) {
        return false;
    }
    // make sure the previous catalysts aren't destroyed
    let fine = catalystsAreFine(p, data.cats);
    if (!fine) {
        return false;
    }
    data = {p, cats: data.cats, p2Prev: {hash: prevHash, pop: prevPop, data: prevData}};
    // check if it's a conduit
    if (fine === 'restored' && data.cats.length > 0) {
        let x = checkConduit(data, 0, options.start, options.maxStables, options.maxUnstables);
        if (x) {
            console.log(`\x1b[92mConduit found:\x1b[0m`);
            let str = removeHIfPossible(getConduitName(x));
            if (x.repeatTime) {
                str += `, rt ${x.repeatTime}`;
                if (x.repeatTimeWithFNG || x.overclock) {
                    str += ' (';
                    if (x.overclock) {
                        str += `overclock: ${toRanges(x.overclock)}`;
                        if (x.repeatTimeWithFNG) {
                            str += ', ';
                        }
                    }
                    if (x.repeatTimeWithFNG) {
                        str += `with FNG: ${x.repeatTimeWithFNG}`;
                    }
                    str += ')';
                }
            }
            str += ':';
            console.log(str);
            console.log(p.toRLE());
            return false;
        }
    }
    // try to add catalysts
    let out: Partial[] = [data];
    if (options.maxCatalysts && data.cats.length < options.maxCatalysts) {
        return out;
    }
    let height = p.height;
    let width = p.width;
    // these 4 variables contain the leading edges
    let top = p.data;
    let bottom = p.data.slice(p.size - width);
    let left = new Uint8Array(height);
    let right = new Uint8Array(height);
    for (let i = 0; i < height; i++) {
        left[i] = p.data[i * width];
        right[i] = p.data[i * (width + 1) - 1];
    }
    // block
    if (options.allowedCatalysts.has('block')) {
        for (let x = 1; x < p.width - 1; x++) {
            if (top[x] && !top[x - 1] && !top[x + 1]) {
                addCatalyst(out, data, 'block', BLOCK, x - 1, -3, 'down');
                addCatalyst(out, data, 'block', BLOCK, x, -3, 'down');
            }
            if (bottom[x] && !bottom[x - 1] && !bottom[x + 1]) {
                addCatalyst(out, data, 'block', BLOCK, x - 1, height + 2, 'up');
                addCatalyst(out, data, 'block', BLOCK, x , height + 2, 'up');
            }
        }
        for (let y = 1; y < p.height - 1; y++) {
            if (left[y] && !left[y - 1] && !left[y + 1]) {
                addCatalyst(out, data, 'block', BLOCK, -3, y - 1, 'right');
                addCatalyst(out, data, 'block', BLOCK, -3, y, 'right');
            }
            if (right[y] && !right[y - 1] && !right[y + 1]) {
                addCatalyst(out, data, 'block', BLOCK, width + 2, y - 1, 'left');
                addCatalyst(out, data, 'block', BLOCK, width + 2, y, 'left');
            }
        }
    }
    return out;
}


export function run(): void {


const HELP_MESSAGE = `
CatAsk ${VERSION} - searches for conduits in Conway's Game of Life

Usage:
    ./catask <rle> [options]
    ./catask identify <rle>
    ./catask (help|version|-h|--help|-v|--version)

Options:
    -h, --help: Show this message and exit
    -v, --version: Show the program version and exit
    -c <values>, --catalysts <values>: Set the allowed catalysts, valid values are ${ALL_ALLOWED_CATALYSTS.join(', ')}
    -m <amount>, --max-catalysts <amount>: Set the maximum number of catalysts
    -s <amount>, --max-stables <amount>: Set the maximum amount of stable objects in a result
    -u <amount>, --max-unstables <amount>: Set the maximum amount of unstable objects in a result
`;

let args = process.argv.slice(2);

if (args[0] === 'help' || args[0] === '-h' || args[0] === '--help') {
    console.log(HELP_MESSAGE);
    process.exit(0);
} else if (args[0] === 'version' || args[0] === '-v' || args[0] === '--version') {
    console.log(`CatAsk ${VERSION}`);
    process.exit(0);
}

if (args[0] === 'identify') {
    let p = base.loadRLE(args[1]).shrinkToFit();
    let [partial, start] = createPartial(p);
    p = partial.p;
    for (let i = 0; i < IDENTIFY_MAX_TIME; i++) {
        if (catalystsAreFine(p, partial.cats) === 'restored') {
            let value = checkConduit(partial, IDENTIFY_CONDUIT_SEP_GENS, start);
            if (value) {
                console.log(`\x1b[92m${removeHIfPossible(getConduitName(value))}\x1b[0m`);
                if (value.input.startsWith('(')) {
                    console.log(`Input: ${value.input}`);
                } else {
                    let name = CONDUIT_OBJECTS[value.input][0];
                    name = name[0].toUpperCase() + name.slice(1);
                    console.log(`Input: ${name}`);
                }
                for (let obj of value.output) {
                    let suffix = `at generation ${obj.time} and position (${obj.x}, ${obj.y})`;
                    if (obj.obj.startsWith('(')) {
                        console.log(`Output: ${obj.obj} ${suffix}`);
                    } else {
                        let name = CONDUIT_OBJECTS[obj.obj][0];
                        name = name[0].toUpperCase() + name.slice(1);
                        console.log(`Output: ${name} ${suffix}`);
                    }
                }
                for (let glider of value.gliders) {
                    console.log(`Output: ${glider.dir} glider lane ${glider.lane} timing ${glider.timing}`);
                }
                for (let obj of value.otherOutputs) {
                    console.log(`Output: ${obj.code} (${obj.x}, ${obj.y})`);
                }
                if (value.repeatTime !== undefined) {
                    console.log(`Repeat time: ${value.repeatTime}`);
                    if (value.repeatTimeWithFNG) {
                        console.log(`Repeat time (with FNG): ${value.repeatTime}`);
                    }
                    if (value.overclock) {
                        if (value.overclock.length === 0) {
                            console.log('No overclock');
                        } else {
                            console.log(`Overclock: ${toRanges(value.overclock)}`);
                        }
                    }
                }
                process.exit(0);
            }
        }
        p.runGeneration();
    }
    console.log('Error: Not a conduit');
    process.exit(0);
}


let p: MAPPattern;
if (args[0].endsWith('!')) {
    p = base.loadRLE(args[0]);
} else if (args[0] in CONDUIT_OBJECTS) {
    p = base.loadApgcode(CONDUIT_OBJECTS[args[0]][1]);
} else {
    throw new Error(`Invalid start object: '${args[0]}'`);
}
p.shrinkToFit();

let start: ConduitObject;
let startApgcode = p.toApgcode();
if (startApgcode in conduitObjects) {
    let data = conduitObjects[startApgcode];
    start = data;
    p.xOffset -= data.x;
    p.yOffset -= data.y;
} else {
    start = {obj: `(${startApgcode})`, dir: 'F', time: 0};
}


const ALLOWED_FLAGS = ['--help', '-h', '--version', '-v', '--catalysts', '-c', '--max-catalysts', '-m', '--max-stables', '-s', '--max-unstables', '-u'];
const FLAG_ALIASES: {[key: string]: string} = {
    'c': 'catalysts',
    'm': 'max-catalysts',
    's': 'max-stables',
    'u': 'max-unstables',
};
let flags: {[key: string]: string[]} = {};
let prevFlag: string | undefined = undefined;
for (let arg of args.slice(1)) {
    if (arg.startsWith('-')) {
        if (!ALLOWED_FLAGS.includes(arg)) {
            console.error(`Error: Unrecognized flag: '${arg}'`);
            process.exit(1);
        }
        prevFlag = arg.startsWith('--') ? arg.slice(2) : arg.slice(1);
    } else {
        if (prevFlag === undefined) {
            console.error(`Error: Maximum 1 positional argument`);
            process.exit(1);
        }
        flags[prevFlag in FLAG_ALIASES ? FLAG_ALIASES[prevFlag] : prevFlag].push(arg);
    }
}

if (flags['help']) {
    console.log(HELP_MESSAGE);
    process.exit(0);
} else if (flags['version']) {
    console.log(`CatAsk ${VERSION}`);
    process.exit(0);
}

let allowedCatalysts = new Set(ALL_ALLOWED_CATALYSTS);
if (flags.allowedCatalysts) {
    allowedCatalysts = new Set(flags.allowedCatalysts);
    for (let catalyst of allowedCatalysts) {
        if (!ALL_ALLOWED_CATALYSTS.includes(catalyst)) {
            console.error(`Error: Invalid catalyst: '${catalyst}' (valid catalysts: ${ALL_ALLOWED_CATALYSTS.join(', ')})`);
        }
    }
}

function validateNumber(option: string): number | undefined {
    if (flags[option]) {
        let out = parseInt(flags[option][flags[option].length - 1]);
        if (Number.isNaN(out)) {
            console.error(`Error: Invalid value for ${option}: '${flags[option].join(' ')}', must be a number`);
            process.exit(1);
        }
        return out;
    }
}

let options: SearchOptions = {
    start,
    allowedCatalysts,
    maxCatalysts: validateNumber('max-catalysts'),
    maxStables: validateNumber('max-stables'),
    maxUnstables: validateNumber('max-unstables'),
};


console.log(`This is CatAsk ${VERSION} searching for conduits with input '${start.obj}'`);
let depth = 1;
let data: Partial[] = [{p, cats: []}];
let startTime = performance.now();
let prevUpdateTime = startTime;
let totalPartialsChecked = 0;
while (true) {
    console.log(`Searching depth ${depth} (${data.length} partials)`);
    prevUpdateTime = performance.now();
    let newData: Partial[] = [];
    let prevPartialsChecked = 0;
    for (let i = 0; i < data.length; i++) {
        let value = searchSingleObject(data[i], options);
        if (value) {
            newData.push(...value);
        }
        totalPartialsChecked++;
        let now = performance.now();
        if ((now - prevUpdateTime) / 1000 > UPDATE_INTERVAL) {
            console.log(`${i}/${data.length} (${(i / data.length * 100).toFixed(3)}%) complete (${((i - prevPartialsChecked)/((now - prevPartialsChecked) / 1000)).toFixed(3)} partials/second current, ${(totalPartialsChecked / ((now - startTime) / 1000)).toFixed(3)} overall)`);
            prevUpdateTime = now;
            prevPartialsChecked = i;
        }
    }
    data = newData;
}


}


if (import.meta.main) {
    run();
}
