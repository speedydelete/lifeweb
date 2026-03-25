
import {MAPPattern, findType, getKnots, INTSeparator, createPattern} from './core/index.js';


const VERSION = '1.0';

export type Direction = 'F' | 'Fx' | 'R' | 'Rx' | 'B' | 'Bx' | 'L' | 'Lx';
export type GliderDirection = 'NW' | 'NE' | 'SW' | 'SE';

export const DIRECTION_COMBINE: {[K in Direction]: {[K in Direction]: Direction}} = {
    F: {F: 'F', Fx: 'Fx', R: 'R', Rx: 'Rx', B: 'B', Bx: 'Bx', L: 'L', Lx: 'Lx'},
    Fx: {F: 'Fx', Fx: 'F', R: 'Rx', Rx: 'R', B: 'Bx', Bx: 'B', L: 'Lx', Lx: 'L'},
    R: {F: 'R', Fx: 'Rx', R: 'B', Rx: 'Bx', B: 'L', Bx: 'Lx', L: 'F', Lx: 'Fx'},
    Rx: {F: 'Rx', Fx: 'R', R: 'Bx', Rx: 'B', B: 'Lx', Bx: 'L', L: 'Fx', Lx: 'F'},
    B: {F: 'B', Fx: 'Bx', R: 'L', Rx: 'Lx', B: 'F', Bx: 'Fx', L: 'R', Lx: 'Rx'},
    Bx: {F: 'Bx', Fx: 'B', R: 'Lx', Rx: 'L', B: 'Fx', Bx: 'F', L: 'Rx', Lx: 'R'},
    L: {F: 'L', Fx: 'Lx', R: 'F', Rx: 'Fx', B: 'R', Bx: 'Rx', L: 'B', Lx: 'Bx'},
    Lx: {F: 'Lx', Fx: 'L', R: 'Fx', Rx: 'F', B: 'Rx', Bx: 'R', L: 'Bx', Lx: 'B'},
};

export const CONDUIT_OBJECTS: {[key: string]: [name: string, symmetric: boolean, data: [code: string, centerX: number, centerY: number][]]} = {
    'R': ['R-pentomino', false, [['472', 1, 1]]],
    'B': ['B-heptomino', false, [['pe4', 1, 2], ['d72', 1, 1]]],
    'H': ['herschel', false, [['74e', 1, 2]]],
    'C': ['century', false, [['c97', 2, 1]]],
    'D': ['dove', false, [['ci97', 2, 1]]],
    'E': ['E-heptomino', false, [['1572', 2, 1]]],
    'P': ['pi-heptomino', true, [['557', 1, 1], ['577', 1, 1]]],
    'Q': ['queen bee', true, [['3us8z31', 2, 3]]],
    'W': ['wing', true, [['c53', 1, 1]]],
    'U': ['U-turner', false, [['77ac', 1, 1]]],
    'L': ['LWSS', false, [['5889e', 4, 2]]],
    'M': ['MWSS', false, [['aghgis', 5, 3]]],
};

const GLIDERS: {[key: string]: [GliderDirection, number]} = {
    '111100010': ['NW', 0],
    '010110101': ['NW', 3],
    '110101100': ['NW', 2],
    '011110001': ['NW', 1],
    '111001010': ['NE', 0],
    '010011101': ['NE', 3],
    '011101001': ['NE', 2],
    '110011100': ['NE', 1],
    '010100111': ['SW', 0],
    '101110010': ['SW', 3],
    '100101110': ['SW', 2],
    '001110011': ['SW', 1],
    '010001111': ['SE', 0],
    '101011010': ['SE', 3],
    '001101011': ['SE', 2],
    '100011110': ['SE', 1],
};

const CONDUIT_OBJECT_LOOKAHEAD_GENS = 64;
const MIN_OBJ_SEP_SIZE = 64;
const MAX_REPEAT_TIME = 384;

const IDENTIFY_MAX_TIME = 384;
const IDENTIFY_SEP_GENS = 8;
const IDENTIFY_START_SEP_GENS = 8;
const IDENTIFY_IDENTIFY_GENS = 30;

const UPDATE_INTERVAL = 3;


let base = createPattern('B3/S23') as MAPPattern;

let knots = getKnots(base.trs);

const BLOCK = base.loadApgcode('33').shrinkToFit();


let conduitObjects: {[key: string]: {p: MAPPattern, obj: string, dir: Direction, x: number, y: number, time: number}} = {};
let reverseConduitObjects: {[key: string]: MAPPattern} = {};

function addRegion(p: MAPPattern, obj: string, dir: Direction, time: number): void {
    let found = false;
    let x2 = 0;
    let y2 = 0;
    let i = 0;
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            if (p.data[i++] === 2) {
                x2 = x;
                y2 = y;
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
    let x = x2 + p.xOffset;
    let y = y2 + p.yOffset;
    let q = p.copy();
    q.data = q.data.map(x => x ? 1 : 0);
    conduitObjects[q.toApgcode()] = {p, obj, dir, x, y, time};
    reverseConduitObjects[obj + dir + time] = q;
}

for (let key in CONDUIT_OBJECTS) {
    for (let [code, x, y] of CONDUIT_OBJECTS[key][2]) {
        let p = base.loadApgcode(code).shrinkToFit();
        p.xOffset = 0;
        p.yOffset = 0;
        for (let i = 0; i < CONDUIT_OBJECT_LOOKAHEAD_GENS; i++) {
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
            let prevCenter = p.get(x2, y2);
            p.set(x2, y2, 2);
            addRegion(p, key, 'F', i);
            p.rotateRight();
            addRegion(p, key, 'R', i);
            p.rotateRight();
            addRegion(p, key, 'B', i);
            p.rotateRight();
            addRegion(p, key, 'L', i);
            p.rotateRight();
            p.flipVertical();
            addRegion(p, key, 'Fx', i);
            p.rotateRight();
            addRegion(p, key, 'Rx', i);
            p.rotateRight();
            addRegion(p, key, 'Bx', i);
            p.rotateRight();
            addRegion(p, key, 'Lx', i);
            p.rotateRight();
            p.flipVertical();
            p.set(x2, y2, prevCenter);
            p.runGeneration();
            p.shrinkToFit();
        }
    }
}


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

// export function createPartial(p: MAPPattern): Partial {

// }


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

export interface Glider {
    dir: GliderDirection;
    lane: number;
    timing: number;
}

export interface Conduit {
    p: MAPPattern;
    input: string;
    output: (ConduitObject & {x: number, y: number, p: MAPPattern})[];
    gliders: Glider[];
    factoryTime?: number;
    otherOutputs: (ObjData & {code: string})[];
    repeatTime?: number;
    repeatTimeNoFNG?: number;
    overclock?: number[];
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
    for (let i = 0; i < data.output.length; i++) {
        let obj = data.output[i];
        let value = obj.dir + obj.time;
        if (!(data.input === 'H' && obj.obj === 'H')) {
            value = data.input + value + obj.obj;
        }
        out.push(value);
    }
    for (let obj of data.gliders) {
        let value = obj.dir + obj.lane + 'T' + obj.timing;
        if (out.length === 0 && data.input !== 'H') {
            value = data.input + value;
        }
        out.push(value);
    }
    if (out.length === 0 && data.factoryTime !== undefined) {
        out.push(data.input + data.factoryTime);
    }
    if (data.otherOutputs.length > 0) {
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
    return out.join('_');
}

function worksAtRepeatTime(data: Conduit, start: MAPPattern, rt: number, maxTime: number, removeFNG?: number): boolean {
    // TODO ADD CODE TO DEAL WITH GLIDERS SOMEWHERE IN HERE
    let p = data.p.copy();
    for (let i = 0; i < rt; i++) {
        p.runGeneration();
        if (i > maxTime) {
            continue;
        }
        if (removeFNG !== undefined && p.generation === removeFNG) {
            let i = (-p.yOffset - 4) * p.height - p.xOffset - 1;
            p.data[i + 1] = 0;
            p.data[i + p.width] = 0;
            p.data[i + 2 * p.width] = 0;
            p.data[i + 2 * p.width + 1] = 0;
            p.data[i + 2 * p.width + 2] = 0;
        }
        for (let obj of data.output) {
            if (obj.obj !== '' && obj.time === p.generation) {
                p.insertXor(obj.p, obj.x + p.xOffset, obj.y + p.yOffset);
            }
        }
    }
    p.insert(start, -p.xOffset, -p.yOffset);
    let found = 0;
    for (let i = 0; i < maxTime; i++) {
        p.runGeneration();
        for (let obj of data.output) {
            if (obj.obj !== '' && (obj.time === p.generation || obj.time === p.generation - rt)) {
                let i = 0;
                let loc = 0;
                let failed = false;
                for (let y = 0; y < obj.p.height; y++) {
                    for (let x = 0; x < obj.p.width; x++) {
                        if (obj.p.data[i++] !== p.data[loc]) {
                            failed = true;
                            break;
                        }
                        p.data[loc++] = 0;
                    }
                    loc += p.width - obj.p.width;
                }
                found++;
            }
        }
    }
    return found === data.output.length;
}

function getConduitInfo(data: Partial, input: ConduitObject, output: Conduit['output'], gliders: Glider[], otherOutputs: (ObjData & {code: string})[], reconstruct: boolean = false, factoryTime?: number): Conduit {
    for (let x of output) {
        x.dir = DIRECTION_COMBINE[input.dir][x.dir];
        x.time += input.time;
    }
    let p: MAPPattern;
    let start: MAPPattern;
    if (input.obj.startsWith('(')) {
        start = base.loadApgcode(input.obj.slice(1, input.obj.indexOf(')'))).shrinkToFit();
    } else {
        start = reverseConduitObjects[input.obj + input.dir + input.time];
    }
    if (reconstruct) {
        // we need to reconstruct the conduit from the catalysts
        let minX = start.xOffset;
        let minY = start.yOffset;
        let maxX = start.xOffset + start.width;
        let maxY = start.yOffset + start.height;
        for (let obj of data.cats) {
            if (obj.x < minX) {
                minX = obj.x;
            }
            if (obj.y < minY) {
                minY = obj.y;
            }
            if (obj.x + obj.p.width > maxX) {
                maxX = obj.x + obj.p.width;
            }
            if (obj.y + obj.p.height > maxY) {
                maxY = obj.x + obj.p.width;
            }
        }
        let p = base.copy();
        p.height = maxY - minY + 1;
        p.width = maxX - minX + 1;
        p.size = p.height * p.width;
        p.data = new Uint8Array(p.size);
        p.xOffset = minX - p.xOffset;
        p.yOffset = minY - p.yOffset;
        p.insert(start, start.xOffset - minX, start.yOffset - minY);
        for (let obj of data.cats) {
            p.insert(obj.p, obj.x - minX, obj.y - minY);
        }
        p.shrinkToFit();
    } else {
        p = data.p;
    }
    let out: Conduit = {p: data.p, input: input.obj, output, gliders, otherOutputs};
    if (factoryTime) {
        out.factoryTime = factoryTime;
    }
    // now we find the repeat time and determine overclocks
    let maxTime = Math.max(...output.map(x => x.time));
    let worksAt: boolean[] = [];
    for (let rt = 1; rt < MAX_REPEAT_TIME; rt++) {
        worksAt.push(worksAtRepeatTime(out, start, rt, maxTime));
    }
    let rt = worksAt.length;
    if (worksAt[rt]) {
        for (; rt > 1; rt--) {
            if (!worksAt[rt - 1]) {
                break;
            }
        }
        out.repeatTime = rt;
        out.overclock = worksAt.slice(0, rt).map((x, i) => x ? i : -1).filter(x => x !== -1);
        if (input.obj === 'H') {
            let offset = 21 - input.time;
            for (; rt > 0; rt--) {
                if (!worksAtRepeatTime(out, start, rt, maxTime, offset)) {
                    break;
                }
            }
            out.repeatTimeNoFNG = rt;
        }
    }
    return out;
}

function combineObjects(objs: ObjData[]): ObjData {
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
        x -= p.xOffset;
        y -= p.yOffset;
        time = p.generation - time;
        if (!(x === 0 && y === 0 && time === 0)) {
            return getConduitInfo(data, start, [{obj, dir, time, x: -x, y: -y, p: q}], [], [], true);
        }
    }
    // now we check if it is has a more complicated output
    if (p.size < MIN_OBJ_SEP_SIZE) {
        return false;
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
        let height = p.height;
        let width = p.width;
        let data = p.data;
        let pop = p.population;
        let value: [GliderDirection, number];
        // we do quick checks for common objects to speed it up a bit
        if (height === 2 && width === 2 && pop === 4) {
            code = 'xs4_33';
        } else if (pop === 3 && ((height === 1 && width === 3) || (height === 3 && width === 1))) {
            code = 'xp2_7';
        } else if (pop === 6 && p.size === 12 && data[1] && data[10] && ((height === 4 && width === 3 && data[3] && data[5] && data[6] && data[8]) || (data[2] && data[4] && data[7] && data[9]))) {
            code = 'xs6_696';
        } else if (height === 3 && width === 3 && pop === 5 && (value = GLIDERS[data.join('')])) {
            let [dir, timing] = value;
            timing += p.generation - (p.generation % 4);
            let x = p.xOffset + 1;
            let y = p.yOffset + 1;
            let lane: number;
            if (dir === 'NW' || dir === 'SE') {
                lane = x - y;
                timing += x + y;
            } else {
                lane = x + y;
                timing += y - x;
            }
            gliders.push({dir, lane, timing});
            continue;
        } else if (height === 3 && width === 3 && pop < 7 && data[1] && data[3] && data[5] && data[7]) {
            code = pop === 5 ? 'xs5_253' : (pop === 6 ? 'xs6_356' : 'xs4_252');
        } else {
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
        return getConduitInfo(data, start, [], gliders, objs as (ObjData & {code: string})[], true, p.generation);
    }
    // now we check every combination and see if it's a conduit
    for (let groups of partitions(objs)) {
        let objs = groups.map(x => combineObjects(x));
        let outputs: Conduit['output'] = [];
        let otherOutputs: (ObjData & {code: string})[] = [];
        let found = false;
        for (let obj of objs) {
            if (obj.code) {
                otherOutputs.push(obj as ObjData & {code: string});
            } else {
                let code = obj.p.toApgcode();
                if (code in conduitObjects) {
                    let {obj: obj2, dir, x, y, time} = conduitObjects[code];
                    x += obj.p.xOffset;
                    y += obj.p.yOffset;
                    time = p.generation - time;
                    if (x === 0 && y === 0 && time === 0) {
                        found = true;
                        break;
                    }
                    outputs.push({obj: obj2, dir, time, p: obj.p, x: obj.x + x, y: obj.y + y});
                } else {
                    found = true;
                    break;
                }
            }
        }
        if (!found) {
            return getConduitInfo(data, start, outputs, gliders, otherOutputs, true);
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
            let str = getConduitName(x);
            if (x.repeatTime) {
                str += `, rt ${x.repeatTime}`;
                if (x.repeatTimeNoFNG || x.overclock) {
                    str += ' (';
                    if (x.overclock) {
                        str += `overclock: ${toRanges(x.overclock)}`;
                        if (x.repeatTimeNoFNG) {
                            str += ', ';
                        }
                    }
                    if (x.repeatTimeNoFNG) {
                        str += `no FNG: ${x.repeatTimeNoFNG}`;
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
    ./catask identify <rle> [sep-gens]
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
    let sepGens = IDENTIFY_START_SEP_GENS;
    if (args[2]) {
        sepGens = parseInt(args[2]);
        if (Number.isNaN(sepGens)) {
            console.error(`Error: Invalid value for sep-gens: '${args[2]}', must be a number`);
            process.exit(1);
        }
    }
    let sep = new INTSeparator(p, knots);
    for (let i = 0; i < sepGens; i++) {
        sep.runGeneration();
        sep.resolveKnots();
    }
    let startP: MAPPattern | undefined = undefined;
    let cats: Catalyst[] = [];
    for (let p of sep.getObjects()) {
        let type = findType(p, IDENTIFY_IDENTIFY_GENS);
        type.pops = [];
        type.hashes = [];
        type.phases = [];
        if (type.disp) {
            if (type.stabilizedAt > 0) {
                continue;
            } else if (type.disp[0] !== 0 || type.disp[1] !== 0) {
                console.error('Error: Spaceships are not supported');
                process.exit(1);
            } else if (type.period !== 1) {
                console.error('Error: Oscillators are not supported');
                process.exit(1);
            }
            cats.push({type: 'custom', p, x: p.xOffset, y: p.yOffset});
        } else {
            if (startP !== undefined) {
                console.error('Error: More than 1 start object! (If there isn\'t actually more than 1, there is a bug, please report this to speedydelete)');
                process.exit(1);
            }
            startP = p;
        }
    }
    if (!startP) {
        console.error('Error: No start object!');
        process.exit(1);
    }
    let start: ConduitObject;
    let code = startP.toApgcode();
    if (code in conduitObjects) {
        let data = conduitObjects[code];
        start = data;
        p.xOffset -= startP.xOffset - data.x;
        p.yOffset -= startP.yOffset - data.y;
        for (let cat of cats) {
            cat.x -= startP.xOffset - data.x;
            cat.y -= startP.yOffset - data.y;
        }
    } else {
        start = {obj: `(${code})`, dir: 'F', time: 0};
    }
    for (let i = 0; i < IDENTIFY_MAX_TIME; i++) {
        if (catalystsAreFine(p, cats) === 'restored') {
            let value = checkConduit({p, cats}, IDENTIFY_SEP_GENS, start);
            if (value) {
                console.log(getConduitName(value));
                if (value.input.startsWith('(')) {
                    console.log(`Input: ${value.input}`);
                } else {
                    let name = CONDUIT_OBJECTS[value.input][0];
                    name = name[0].toUpperCase() + name.slice(1);
                    console.log(`Input: ${name}`);
                }
                for (let obj of value.output) {
                    if (obj.obj !== '') {
                        let suffix = `at generation ${obj.time} and position (${obj.x}, ${obj.y})`;
                        if (obj.obj.startsWith('(')) {
                            console.log(`Output: ${obj.obj} ${suffix}`);
                        } else {
                            let name = CONDUIT_OBJECTS[obj.obj][0];
                            name = name[0].toUpperCase() + name.slice(1);
                            console.log(`Output: ${name} ${suffix}`);
                        }
                    }
                }
                for (let glider of value.gliders) {
                    console.log(`Output: ${glider.dir} glider lane ${glider.lane} timing ${glider.timing}`);
                }
                for (let obj of value.otherOutputs) {
                    console.log(`Output: ${obj.code} (${obj.x}, ${obj.y})`);
                }
                if (value.repeatTime) {
                    console.log(`Repeat time: ${value.repeatTime}`);
                    if (value.repeatTimeNoFNG) {
                        console.log(`Repeat time (no FNG): ${value.repeatTime}`);
                    }
                    if (value.overclock) {
                        if (value.overclock.length === 0) {
                            console.log('Not overclockable');
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
    console.log('Not a conduit');
    process.exit(0);
}


let p: MAPPattern;
if (args[0].endsWith('!')) {
    p = base.loadRLE(args[0]);
} else if (args[0] in CONDUIT_OBJECTS) {
    p = base.loadApgcode(CONDUIT_OBJECTS[args[0]][2][0][0]);
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
