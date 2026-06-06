
export let path: (typeof import('node:path'))['posix'];
(async () => {
    if (typeof window === 'object' && window === globalThis) {
        // @ts-ignore
        path = (await import('https://esm.sh/path')).posix;
    } else {
        // @ts-ignore
        path = (await import('node:path')).posix;
    }
    (globalThis as any).path = path;
})();

import {LifewebError, Rect, Rule, Pattern, MAPPattern, speedToString, createPattern} from '../core/index.js';


export class RPFError extends LifewebError {
    name = 'RPFError';
    [Symbol.toStringTag] = 'RPFError';
};


export type Rotation = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';
const ROTATIONS: string[] = ['F', 'Fx', 'L', 'Lx', 'B', 'Bx', 'R', 'Rx'];

export const ROTATION_COMBINE: {[K in Rotation]: {[K in Rotation]: Rotation}} = {
    F: {F: 'F', Fx: 'Fx', L: 'L', Lx: 'Lx', B: 'B', Bx: 'Bx', R: 'R', Rx: 'Rx'},
    Fx: {F: 'Fx', Fx: 'F', L: 'Lx', Lx: 'L', B: 'Bx', Bx: 'B', R: 'Rx', Rx: 'R'},
    L: {F: 'L', Fx: 'Lx', L: 'B', Lx: 'Bx', B: 'R', Bx: 'Rx', R: 'F', Rx: 'Fx'},
    Lx: {F: 'Lx', Fx: 'L', L: 'Bx', Lx: 'F', B: 'Rx', Bx: 'R', R: 'Fx', Rx: 'B'},
    B: {F: 'B', Fx: 'Bx', L: 'R', Lx: 'Rx', B: 'F', Bx: 'Fx', R: 'L', Rx: 'Lx'},
    Bx: {F: 'Bx', Fx: 'B', L: 'Rx', Lx: 'R', B: 'Fx', Bx: 'F', R: 'Lx', Rx: 'L'},
    R: {F: 'R', Fx: 'Rx', L: 'F', Lx: 'Fx', B: 'L', Bx: 'Lx', R: 'B', Rx: 'Bx'},
    Rx: {F: 'Rx', Fx: 'R', L: 'Fx', Lx: 'B', B: 'Lx', Bx: 'L', R: 'Bx', Rx: 'F'},
};

export function applyRotation<T extends Pattern>(p: T, rotation: Rotation): T {
    if (rotation === 'F') {
        return p;
    } else if (rotation === 'Fx') {
        return p.flipVertical();
    } else if (rotation === 'L') {
        return p.rotateLeft();
    } else if (rotation === 'Lx') {
        return p.flipDiagonal();
    } else if (rotation === 'B') {
        return p.flipHorizontal();
    } else if (rotation === 'Bx') {
        return p.rotate180();
    } else if (rotation === 'R') {
        return p.rotateRight();
    } else {
        return p.flipAntiDiagonal();
    }
}

export function transformCoordinates(x: number, y: number, width: number, height: number, rotation: Rotation): [number, number] {
    if (rotation === 'F') {
        return [x, y];
    } else if (rotation === 'Fx') {
        return [x, height - y - 1];
    } else if (rotation === 'L') {
        return [height - y - 1, x];
    } else if (rotation === 'Lx') {
        return [y, x];
    } else if (rotation === 'B') {
        return [width - x - 1, height - y - 1];
    } else if (rotation === 'Bx') {
        return [width - x - 1, y];
    } else if (rotation === 'R') {
        return [y, width - x - 1];
    } else {
        return [height - y - 1, width - x - 1];
    }
}


export interface RPFRect {
    x: number;
    y: number;
    p: {
        width: number;
        height: number;
    };
}

export function isInside(x: number, y: number, value: RPFRect): boolean {
    return x >= value.x && y >= value.y && x < value.x + value.p.width && y < value.y + value.p.height;
}

export function getOverlap(a: RPFRect, b: RPFRect): {overlap: boolean, x: number, y: number, minX: number, maxX: number, minY: number, maxY: number} {
    let minX = Math.max(a.x, b.x);
    let maxX = Math.min(a.x + a.p.width, b.x + b.p.width);
    let minY = Math.max(a.y, b.y);
    let maxY = Math.min(a.y + a.p.height, b.y + b.p.height);
    let x = maxX - minX;
    let y = maxY - minY;
    return {overlap: x < 0 || y < 0, x, y, minX, maxX, minY, maxY};
}


export interface PartialRPFObjectData<T extends Pattern = Pattern> {
    p: T | RPFPattern<T>;
    x: number;
    y: number;
    rotation: Rotation;
    time: number;
}

export interface RPFObjectData<T extends Pattern = Pattern> extends PartialRPFObjectData<T> {
}

let envelopeBase = createPattern('B3/S23') as MAPPattern;

export class RPFPattern<T extends Pattern = Pattern> extends Pattern {

    base: T;
    key: string;
    path: string;
    data: Set<RPFObjectData<T>>;
    minX: number;
    minY: number;
    height: number;
    width: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    population: number;
    rule: Rule;
    // we set optional values to undefined so the V8 hidden classes are the same
    name?: string = undefined;
    desc?: string = undefined;
    periodic?: [number, number, number] = undefined;
    creates?: {
        p: T | RPFPattern<T>;
        x: number;
        y: number;
        rotation: Rotation;
        times: number[];
    } = undefined;
    conduit?: {
        recoveryTime: number;
        repeatTime: number;
        overclock: number[];
        inputs: PartialRPFObjectData<T>[];
        outputs: PartialRPFObjectData<T>[];
    } = undefined;
    envelope?: {
        x: number;
        y: number;
        p: MAPPattern;
    } = undefined;

    constructor(base: T, key: string, path: string, data: Set<RPFObjectData<T>>) {
        super();
        this.base = base;
        this.key = key;
        this.path = path;
        this.data = data;
        if (data.size > 0) {
            this.minX = Infinity;
            this.minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            this.population = 0;
            for (let value of data) {
                let p = value.p.copy() as T;
                applyRotation(p, value.rotation);
                p.run(value.time);
                p.shrinkToFit();
                this.population += p.population;
                let offset = p.getFullOffset();
                let x = value.x + offset[0];
                let y = value.y + offset[1];
                this.minX = Math.min(this.minX, x);
                this.minY = Math.min(this.minY, y);
                maxX = Math.max(maxX, x + p.width);
                maxY = Math.max(maxY, y + p.height);
            }
            this.height = maxY - this.minY;
            this.width = maxX - this.minX;
            // alert(this.minX + ' ' + this.minY + ' ' + this.height + ' ' + this.width);
        } else {
            this.minX = 0;
            this.minY = 0;
            this.height = 0;
            this.width = 0;
            this.population = 0;
        }
        this.rule = base.rule;
    }

    _stringifyObject(file: RPFFile<T> | undefined, dir: string, obj: PartialRPFObjectData<T> | (Omit<PartialRPFObjectData<T>, 'time'> & {times: number[]})): string {
        let str: string | undefined = undefined;
        if (obj.p instanceof RPFPattern) {
            let dir2 = path.dirname(obj.p.path);
            if (!file || dir === dir2) {
                str = obj.p.key;
            } else {
                for (let imported of file.starImports) {
                    if (dir2 === imported.path) {
                        str = obj.p.key;
                        break;
                    }
                }
                if (str === undefined) {
                    for (let [key, imported] of Object.entries(file.imports)) {
                        if (dir2 === imported.path) {
                            str = `${key}.${obj.p.key}`;
                            break;
                        }
                    }
                }
                if (str === undefined) {
                    str = obj.p.path;
                }
            }
        } else {
            str = '*' + obj.p.toApgcode();
        }
        let timeIsNontrivial = 'times' in obj ? !(obj.times.length === 1 && obj.times[0] === 0) : obj.time !== 0;
        if (obj.x !== 0 || obj.y !== 0 || obj.rotation !== 'F' || timeIsNontrivial) {
            str += ` ${obj.x} ${obj.y}`;
            if (obj.rotation !== 'F' || !timeIsNontrivial) {
                str += ` ${obj.rotation}`;
                if (timeIsNontrivial) {
                    if ('times' in obj) {
                        str += ` ${obj.times.join(',')}`;
                    } else {
                        str += ` ${obj.time}`;
                    }
                }
            }
        }
        return str;
    }

    toString(file?: RPFFile<T>, pasting?: boolean): string {
        let dir = path.dirname(this.path);
        let out: string[] = [`${this.key}:`];
        if (pasting) {
            out.push(`#pasting ${this.key}`);
        }
        if (this.name) {
            out.push(`#name ${this.name}`);
        }
        if (this.desc) {
            out.push(`#desc ${this.desc.replaceAll('\\', '\\\\').replaceAll('\n', '\\n')}`);
        }
        if (this.periodic) {
            out.push(`#periodic ${this.periodic.join(' ')}`);
        }
        if (this.creates) {
            out.push(`#creates ${this._stringifyObject(file, dir, this.creates)}`);
        }
        if (this.envelope) {
            out.push(`#envelope ${this.envelope.x}`)
        }
        if (this.conduit) {
            let data = this.conduit;
            let str = `#conduit ${data.recoveryTime}`;
            if (data.overclock.length > 0) {
                str += ` ${data.overclock.join(',')},${data.repeatTime}`;
            } else {
                str += ` ${data.repeatTime}`;
            }
            for (let input of data.inputs) {
                str += ` input ${this._stringifyObject(file, dir, input)}`;
            }
            for (let output of data.outputs) {
                str += ` output ${this._stringifyObject(file, dir, output)}`;
            }
        }
        if (this.envelope) {

        }
        for (let value of this.data) {
            out.push(this._stringifyObject(file, dir, value));
        }
        return out.join('\n');
    }
 
    static fromString<T extends Pattern>(data: string, file: RPFFile<T>): RPFPattern<T> {
        data = data.trim();
        let lines = data.split('\n').map(x => x.trim()).filter(x => x !== '' && !x.startsWith('//'));
        if (!lines[0].endsWith(':')) {
            throw new RPFError(`Invalid first line of RPF object: '${lines[0]}'`);
        }
        let key = lines[0].slice(0, -1);
        let out = new RPFPattern(file.base, key, path.join(file.path, key), new Set());
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            let parts = line.split(' ');
            if (parts[0].startsWith('#')) {
                if (parts[0] === '#pasting') {
                    let key = parts.slice(1).join(' ');
                    if (key in file.data) {
                        return file.data[key];
                    }
                } else if (parts[0] === '#name') {
                    out.name = parts.slice(1).join(' ');
                } else if (parts[0] === '#desc') {
                    out.desc = parts.slice(1).join(' ').replaceAll('\\n', '\n').replaceAll('\\\\', '\\');
                } else if (parts[0] === '#periodic') {
                    if (parts.length < 4) {
                        throw new RPFError(`Invalid #periodic: '${line}'`);
                    }
                    let [dx, dy, period] = parts.slice(1).map(Number);
                    if (Number.isNaN(dx) || Number.isNaN(dy) || Number.isNaN(period)) {
                        throw new RPFError(`Invalid #periodic: '${line}'`);
                    }
                    out.periodic = [dx, dy, period];
                } else if (parts[0] === '#creates') {
                    if (!parts[1]) {
                        throw new RPFError(`Expected object after '#creates'`);
                    }
                    let p = parts[1].startsWith('*') ? file.base.loadApgcode(parts[1].slice(1)).shrinkToFit() as T : file.lookupName(parts[1]);
                    if (!p) {
                        throw new RPFError(`Cannot find RPF object '${parts[1]}'`);
                    }
                    if (parts[4] !== undefined && !ROTATIONS.includes(parts[4])) {
                        throw new RPFError(`Invalid rotation: '${parts[4]}'`);
                    }
                    out.creates = {
                        p,
                        x: parts[2] === undefined ? 0 : Number(parts[2]),
                        y: parts[3] === undefined ? 0 : Number(parts[3]),
                        rotation: parts[4] === undefined ? 'F' : parts[4] as Rotation,
                        times: parts[5] === undefined ? [0] : parts[5].split(',').map(Number),
                    };
                } else if (parts[0] === '#conduit') {
                    if (parts.length < 3) {
                        throw new Error(`Expected 2 values after '#conduit'`);
                    }
                    let ranges = parts[2].split(',').map(Number);
                    let conduit: RPFPattern<T>['conduit'] = {
                        recoveryTime: Number(parts[1]),
                        repeatTime: ranges[ranges.length - 1],
                        overclock: ranges.slice(0, -1),
                        inputs: [],
                        outputs: [],
                    };
                    for (let i = 3; i < parts.length; i++) {
                        let type = parts[i];
                        if (type !== 'input' && type !== 'output') {
                            throw new RPFError(`Expected 'input' or 'output' in #conduit`);
                        }
                        if (!parts[i + 1]) {
                            throw new RPFError(`Expected object after '${type}'`);
                        }
                        let p = parts[i + 1].startsWith('*') ? file.base.loadApgcode(parts[i + 1].slice(1)).shrinkToFit() as T : file.lookupName(parts[i + 1]);
                        if (!p) {
                            throw new RPFError(`Cannot find RPF object '${parts[1]}'`);
                        }
                        if (parts[4] !== undefined && !ROTATIONS.includes(parts[4])) {
                            throw new RPFError(`Invalid rotation: '${parts[4]}'`);
                        }
                        let obj: PartialRPFObjectData<T> = {
                            p,
                            x: parts[2] === undefined ? 0 : Number(parts[2]),
                            y: parts[3] === undefined ? 0 : Number(parts[3]),
                            rotation: parts[4] === undefined ? 'F' : parts[4] as Rotation,
                            time: parts[4] === undefined ? 0 : Number(parts[4]),
                        };
                        if (type === 'input') {
                            conduit.inputs.push(obj);   
                        } else {
                            conduit.outputs.push(obj);
                        }
                    }
                    out.conduit = conduit;
                } else if (parts[0] === '#envelope') {
                    let x = Number(parts[1]);
                    let y = Number(parts[2]);
                    let p = envelopeBase.loadApgcode(parts[3]).shrinkToFit();
                    out.envelope = {x, y, p};
                }
            } else {
                let p = parts[0].startsWith('*') ? file.base.loadApgcode(parts[0].slice(1)).shrinkToFit() as T : file.lookupName(parts[0]);
                if (!p) {
                    throw new RPFError(`Cannot find RPF object '${parts[0]}'`);
                }
                if (parts[3] !== undefined && !ROTATIONS.includes(parts[3])) {
                    throw new RPFError(`Invalid rotation: '${parts[3]}'`);
                }
                out.data.add({
                    p,
                    x: parts[1] === undefined ? 0 : Number(parts[1]),
                    y: parts[2] === undefined ? 0 : Number(parts[2]),
                    rotation: parts[3] === undefined ? 'F' : parts[3] as Rotation,
                    time: parts[4] === undefined ? 0 : Number(parts[4]),
                });
            }
        }
        out.recomputeSizes();
        return out;
    }

    fromPattern(key: string, file: RPFFile<T>, p: T): RPFPattern<T> {
        return new RPFPattern(this.base, key, path.join(file.path, key), new Set([{p, x: 0, y: 0, rotation: 'F', time: 0}]));
    }

    addObject(obj: RPFObjectData<T>): this {
        if (this.data.has(obj)) {
            return this;
        }
        this.data.add(obj);
        let p = obj.p.copy() as T;
        applyRotation(p, obj.rotation);
        p.run(obj.time);
        p.shrinkToFit();
        let offset = p.getFullOffset();
        let x = obj.x + offset[0];
        let y = obj.y + offset[1];
        this.population += p.population;
        this.width = Math.max(this.minX + this.width, x + obj.p.width) - this.minX;
        this.height = Math.max(this.minY + this.height, y + obj.p.height) - this.minY;
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        return this;
    }

    removeObject(obj: RPFObjectData<T>): this {
        if (this.data.delete(obj)) {
            this.recomputeSizes();
        }
        return this;
    }

    recomputeSizes(recursive: boolean = false): this {
        this.minX = Infinity;
        this.minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        this.population = 0;
        for (let value of this.data) {
            if (recursive && value.p instanceof RPFPattern) {
                value.p.recomputeSizes();
            }
            let p = value.p.copy() as T;
            applyRotation(p, value.rotation);
            p.run(value.time);
            p.shrinkToFit();
            this.population += p.population;
            let offset = p.getFullOffset();
            let x = value.x + offset[0];
            let y = value.y + offset[1];
            this.minX = Math.min(this.minX, x);
            this.minY = Math.min(this.minY, y);
            maxX = Math.max(maxX, x + p.width);
            maxY = Math.max(maxY, y + p.height);
        }
        this.height = maxY - this.minY;
        this.width = maxX - this.minX;
        return this;
    }

    setKey(key: string): this {
        this.key = key;
        this.path = path.join(path.dirname(this.path), key);
        return this;
    }

    getObjectAt(x: number, y: number, level: number, depth: number = 0): RPFObjectData | undefined {
        for (let value of this.data) {
            let [x2, y2] = transformCoordinates(x - value.x, y - value.y, value.p.width, value.p.height, value.rotation);
            if (value.p.get(x2, y2)) {
                if (level === depth) {
                    return value;
                } else if (value.p instanceof RPFPattern) {
                    let out = value.p.getObjectAt(x2, y2, level, depth + 1);
                    if (out) {
                        return out;
                    }
                }
            }
        }
    }

    getName(capitalize: boolean = false): string {
        let out = this.name ?? this.key.replaceAll('_', ' ');
        if (capitalize) {
            out = out[0].toUpperCase() + out.slice(1);
        }
        return out;
    }

    getTypeDescription(): string | undefined {
        if (!this.periodic) {
            return;
        }
        let [dx, dy, period] = this.periodic;
        let moves = dx !== 0 || dy !== 0;
        if (this.creates) {
            let prefix = speedToString(dx, dy, period) + ' ';
            let q = this.creates.p;
            if (!(q instanceof RPFPattern)) {
                return `${prefix} ${moves ? 'puffer' : 'factory'}`;
            } 
            prefix += q.getName() + ' ';
            if (!q.periodic) {
                return `${prefix} ${moves ? 'puffer' : 'factory'}`;
            }
            let qMoves = q.periodic[0] !== 0 || q.periodic[1] !== 0;
            if (q.creates) {
                prefix = speedToString(dx, dy, period) + ' ';
                prefix += moves ? 'M' : 'S';
                prefix += qMoves ? 'M' : 'S';
                let r = q.creates.p;
                if (r instanceof RPFPattern && r.periodic) {
                    prefix += (r.periodic[0] !== 0 || r.periodic[1] !== 0) ? 'M' : 'S';
                } else {
                    prefix += '?';
                }
                return `${prefix} ${q.getName()} breeder`;
            } else {
                if (moves) {
                    return `${prefix} ${qMoves ? 'rake' : 'puffer'}`;
                } else {
                    return `${prefix} ${qMoves ? 'gun' : 'factory'}`;
                }
            }
        } else {
            if (dx === 0 && dy === 0) {
                if (period === 1) {
                    return `still life`;
                } else {
                    return `p${period} oscillator`;
                }
            } else {
                return `${speedToString(dx, dy, period)} spaceship`;
            }
        }
    }

    runGeneration(): number {
        // TO IMPLEMENT
        return 0;
    }

    run(gens: number): this {
        for (let i = 0; i < gens; i++) {
            this.runGeneration();
        }
        return this;
    }

    getRect(): Rect {
        return {height: this.height, width: this.width, xOffset: this.minX, yOffset: this.minY};
    }

    getFullOffset(): [number, number] {
        return [this.minX, this.minY];
    }

    isEmpty(): boolean {
        for (let value of this.data) {
            if (!value.p.isEmpty()) {
                return false;
            }
        }
        return true;
    }

    assignMetadata(p: RPFPattern<T>, deep: boolean): void {
        p.name = this.name;
        p.periodic = structuredClone(this.periodic);
        p.creates = this.creates ? {
            p: deep ? (this.creates.p instanceof RPFPattern ? this.creates.p.deepCopy() : this.creates.p.copy() as T) : this.creates.p,
            x: this.creates.x,
            y: this.creates.y,
            rotation: this.creates.rotation,
            times: structuredClone(this.creates.times),
        } : undefined;
        p.conduit = this.conduit ? {
            recoveryTime: this.conduit.recoveryTime,
            repeatTime: this.conduit.repeatTime,
            overclock: this.conduit.overclock.slice(),
            inputs: this.conduit.inputs.map(obj => ({
                p: deep ? (obj.p instanceof RPFPattern ? obj.p.deepCopy() : obj.p.copy() as T) : obj.p,
                x: obj.x,
                y: obj.y,
                rotation: obj.rotation,
                time: obj.time,
            })),
            outputs: this.conduit.outputs.map(obj => ({
                p: deep ? (obj.p instanceof RPFPattern ? obj.p.deepCopy() : obj.p.copy() as T) : obj.p,
                x: obj.x,
                y: obj.y,
                rotation: obj.rotation,
                time: obj.time,
            })),
        } : undefined;
        p.envelope = structuredClone(this.envelope);
    }

    copy(): RPFPattern<T> {
        let data = new Set<RPFObjectData<T>>();
        for (let value of this.data) {
            data.add({
                p: value.p,
                x: value.x,
                y: value.y,
                rotation: value.rotation,
                time: value.time,
            });
        }
        let out = new RPFPattern(this.base, this.key, this.path, data);
        this.assignMetadata(out, false);
        return out;
    }

    deepCopy(): RPFPattern<T> {
        let data = new Set<RPFObjectData<T>>();
        for (let value of this.data) {
            data.add({
                p: value.p instanceof RPFPattern ? value.p.deepCopy() : value.p.copy() as T,
                x: value.x,
                y: value.y,
                rotation: value.rotation,
                time: value.time,
            });
        }
        let out = new RPFPattern(this.base, this.key, this.path, data);
        this.assignMetadata(out, true);
        return out;
    }

    clearedCopy(): RPFPattern<T> {
        let out = new RPFPattern(this.base, this.key, this.path, new Set());
        this.assignMetadata(out, false);
        return out;
    }

    clearedDeepCopy(): RPFPattern<T> {
        let out = new RPFPattern(this.base, this.key, this.path, new Set());
        this.assignMetadata(out, true);
        return out;
    }

    copyPart(x: number, y: number, height: number, width: number): never {
        throw new Error(`Cannot use copyPart with RPFPattern`);
    }

    ensure(x: number, y: number): this {
        return this;
    }

    offsetBy(x: number, y: number): this {
        for (let value of this.data) {
            value.x += x;
            value.y += y;
        }
        this.minX += x;
        this.minY += y;
        return this;
    }

    get(x: number, y: number): number {
        for (let value of this.data) {
            if (isInside(x, y, value)) {
                let x2 = x - value.x;
                let y2 = y - value.y;
                if (value.rotation === 'Fx') {
                    y2 = value.p.height - y2 - 1;
                } else if (value.rotation === 'L') {
                    let temp = x2;
                    x2 = value.p.height - y2 - 1;
                    y2 = temp;
                } else if (value.rotation === 'Lx') {
                    let temp = x2;
                    x2 = y2;
                    y2 = temp;
                } else if (value.rotation === 'B') {
                    x2 = value.p.width - x2 - 1;
                    y2 = value.p.height - y2 - 1;
                } else if (value.rotation === 'Bx') {
                    x2 = value.p.width - x2 - 1;
                } else if (value.rotation === 'R') {
                    let temp = x2;
                    x2 = y2;
                    y2 = value.p.width - temp - 1;
                } else if (value.rotation === 'Rx') {
                    let temp = x2;
                    x2 = value.p.height - y2 - 1;
                    y2 = value.p.width - temp - 1;
                }
                let cell = value.p.get(x2, y2);
                if (cell) {
                    return cell;
                }
            }
        }
        return 0;
    }

    set(x: number, y: number, value: number): never {
        throw new Error(`Cannot use set with RPFPattern`);
    }

    clear(): this {
        this.data = new Set();
        this.height = 0;
        this.width = 0;
        this.population = 0;
        return this;
    }

    clearPart(x: number, y: number, height: number, width: number): this {
        for (let value of this.data) {
            let minX = Math.max(x, value.x);
            let maxX = Math.min(x + width, value.x + value.p.width);
            let minY = Math.max(y, value.y);
            let maxY = Math.min(y + height, value.y + value.p.height);
            if ((maxX - minX) < 0 || (maxY - minY) < 0) {
                value.p.clearPart(minX, minY, maxY - minY, maxX - minX);
            }
        }
        return this;
    }

    insert(p: T, x: number, y: number): never {
        throw new Error(`Cannot use insert with RPFPattern`);
    }

    toPattern(): T {
        let p = this.base.clearedCopy() as T;
        p.ensure(this.width, this.height);
        for (let value of this.data) {
            let q = value.p.copy();
            applyRotation(q, value.rotation);
            q.run(value.time);
            p.insert(q, value.x - this.minX, value.y - this.minY);
        }
        return p;
    }

    getData(): Uint8Array {
        return this.toPattern().getData();
    }

    setData(height: number, width: number, data: Uint8Array): never {
        throw new Error(`Cannot use setData with RPFPattern`);
    }

    getCoords(): Map<number, number> {
        return this.toPattern().getCoords();
    }

    setCoords(coords: Map<number, number>): never {
        throw new Error(`Cannot use setCoords with RPFPattern`);
    }

    isEqual(other: Pattern): boolean {
        if (!(this.height === other.height && this.width === other.width)) {
            return false;
        }
        let [x, y] = other.getFullOffset();
        if (this.minX !== x && this.minY !== y) {
            return false;
        }
        let data = this.getData();
        let otherData = other.getData();
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== otherData[i]) {
                return false;
            }
        }
        return true;
    }

    isEqualWithTranslate(other: Pattern): false | [number, number] {
        if (!(this.height === other.height && this.width === other.width)) {
            return false;
        }
        let data = this.getData();
        let otherData = other.getData();
        for (let i = 0; i < data.length; i++) {
            if (data[i] !== otherData[i]) {
                return false;
            }
        }
        let [x, y] = other.getFullOffset();
        return [x - this.minX, y - this.minY];
    }

    hash32(): number {
        let data = this.getData();
        let out = 0x811c9dc5;
        if (this.rule.states === 2) {
            for (let i = 0; i < data.length; i += 8) {
                out ^= data[i] | (data[i + 1] << 1) | (data[i + 2] << 2) | (data[i + 3] << 3) | (data[i + 4] << 4) | (data[i + 5] << 5) | (data[i + 6] << 5) | (data[i + 7] << 5);
                out *= 0x01000193;
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                out ^= data[i];
                out *= 0x01000193;
            }
        }
        return out;
    }

    hash64(): bigint {
        let data = this.getData();
        let out = 0xcbf29ce484222325n;
        if (this.rule.states === 2) {
            for (let i = 0; i < data.length; i += 8) {
                out ^= BigInt(data[i] | (data[i + 1] << 1) | (data[i + 2] << 2) | (data[i + 3] << 3) | (data[i + 4] << 4) | (data[i + 5] << 5) | (data[i + 6] << 5) | (data[i + 7] << 5));
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        } else {
            for (let i = 0; i < data.length; i++) {
                out ^= BigInt(data[i]);
                out = (out + 0x00000100000001b3n) % (2n ** 64n);
            }
        }
        return out;
    }

    shrinkToFit(): this {
        return this;
    }

    expand(up: number, down: number, left: number, right: number): this {
        return this;
    }

    flipHorizontal(): this {
        let max = this.minX + this.width;
        for (let value of this.data) {
            value.x = max - value.x - value.p.width;
            value.rotation = ROTATION_COMBINE[value.rotation]['Bx'];
        }
        return this;
    }

    flipVertical(): this {
        let max = this.minY + this.height;
        for (let value of this.data) {
            value.y = max - value.y - value.p.height;
            value.rotation = ROTATION_COMBINE[value.rotation]['Fx'];
        }
        return this;
    }
    
    transpose(): this {
        let centerX = this.minX + Math.floor(this.height / 2);
        let centerY = this.minY + Math.floor(this.width / 2);
        for (let value of this.data) {
            let temp = -(value.x - centerX) + centerY;
            value.x = -(value.y - centerY) + centerX;
            value.y = temp;
            value.rotation = ROTATION_COMBINE[value.rotation]['Lx'];
        }
        let temp = this.height;
        this.height = this.width;
        this.width = temp;
        temp = this.minX;
        this.minX = this.minY;
        this.minY = temp;
        return this;
    }

    rotateLeft(): this {
        let centerX = this.minX + Math.floor(this.height / 2);
        let centerY = this.minY + Math.floor(this.width / 2);
        for (let value of this.data) {
            let temp = -(value.x + value.p.width - centerX) + centerY;
            value.x = (value.y - centerY) + centerX;
            value.y = temp;
            value.rotation = ROTATION_COMBINE[value.rotation]['L'];
        }
        let temp = this.height;
        this.height = this.width;
        this.width = temp;
        temp = this.minX;
        this.minX = this.minY;
        this.minY = temp;
        return this;
    }

    rotateRight(): this {
        let centerX = this.minX + Math.floor(this.height / 2);
        let centerY = this.minY + Math.floor(this.width / 2);
        for (let value of this.data) {
            let temp = (value.x - centerX) + centerY;
            value.x = -(value.y + value.p.height - centerY) + centerX;
            value.y = temp;
            value.rotation = ROTATION_COMBINE[value.rotation]['R'];
        }
        let temp = this.height;
        this.height = this.width;
        this.width = temp;
        temp = this.minX;
        this.minX = this.minY;
        this.minY = temp;
        return this;
    }

    rotate180(): this {
        let centerX = this.minX + Math.floor(this.height / 2);
        let centerY = this.minY + Math.floor(this.width / 2);
        for (let value of this.data) {
            let temp = -(value.x + value.p.width - centerX) + centerY;
            value.x = -(value.y + value.p.height - centerY) + centerX;
            value.y = temp;
            value.rotation = ROTATION_COMBINE[value.rotation]['B'];
        }
        return this;
    }

    flipDiagonal(): this {
        return this.transpose();
    }

    flipAntiDiagonal(): this {
        let centerX = this.minX + Math.floor(this.height / 2);
        let centerY = this.minY + Math.floor(this.width / 2);
        for (let value of this.data) {
            let temp = -(value.x + value.p.width - centerX) + centerY;
            value.x = -(value.y + value.p.height - centerY) + centerX;
            value.y = temp;
            value.rotation = ROTATION_COMBINE[value.rotation]['Rx'];
        }
        let temp = this.height;
        this.height = this.width;
        this.width = temp;
        temp = this.minX;
        this.minX = this.minY;
        this.minY = temp;
        return this;
    }

    inflate(times: number): never {
        throw new Error(`Cannot use inflate with RPFPattern`);
    }

    toApgcode(prefix?: string): string {
        return this.toPattern().toApgcode(prefix);
    }

    toCanonicalApgcode(period: number = 1, prefix?: string): string {
        let p = this.copy();
        p.shrinkToFit();
        let codes: string[] = [];
        for (let j = 0; j < period; j++) {
            if (j > 0) {
                p.runGeneration();
                p.shrinkToFit();
            }
            codes.push(p.toApgcode());
            if (this.rule.symmetry !== 'C1') {
                let q = p.copy();
                if (this.rule.symmetry === 'D8') {
                    codes.push(q.rotateLeft().toApgcode());
                    for (let i = 0; i < 2; i++) {
                        for (let j = 0; j < 4; j++) {
                            codes.push(q.rotateLeft().toApgcode());
                        }
                        q.flipHorizontal();
                    }
                } else if (this.rule.symmetry === 'C2') {
                    codes.push(q.rotate180().toApgcode());
                } else if (this.rule.symmetry === 'C4') {
                    for (let i = 0; i < 4; i++) {
                        codes.push(q.rotateLeft().toApgcode());
                    }
                } else if (this.rule.symmetry === 'D2-') {
                    codes.push(q.flipHorizontal().toApgcode());
                } else if (this.rule.symmetry === 'D2|') {
                    codes.push(q.flipVertical().toApgcode());
                } else if (this.rule.symmetry === 'D2/') {
                    codes.push(q.flipDiagonal().toApgcode());
                } else if (this.rule.symmetry === 'D2\\') {
                    codes.push(q.transpose().toApgcode());
                } else if (this.rule.symmetry === 'D4+') {
                    codes.push(q.flipHorizontal().toApgcode());
                    codes.push(q.flipVertical().toApgcode());
                    codes.push(q.flipHorizontal().toApgcode());
                } else {
                    codes.push(q.flipDiagonal().toApgcode());
                    codes.push(q.transpose().toApgcode());
                    codes.push(q.flipDiagonal().toApgcode());
                }
            }
        }
        let out = codes[0];
        for (let code of codes.slice(1)) {
            if (code.length < out.length || (code.length === out.length && code < out)) {
                out = code;
            }
        }
        if (prefix === undefined) {
            prefix = '';
        } else {
            prefix += '_';
        }
        return prefix + out;
    }

    toRLE(header: boolean = true): string {
        return this.toPattern().toRLE(header);
    }

    loadApgcode(code: string): RPFPattern<T> {
        let p = this.base.loadApgcode(code) as T;
        return new RPFPattern(this.base, this.key, this.path, new Set([{p, x: 0, y: 0, rotation: 'F', time: 0}]));
    }

    loadRLE(rle: string): RPFPattern<T> {
        let p = this.base.loadRLE(rle) as T;
        return new RPFPattern(this.base, this.key, this.path, new Set([{p, x: 0, y: 0, rotation: 'F', time: 0}]));
    }

    _toRPFFile(out: {[key: string]: RPFPattern<T>}): void {
        out[this.key] = this;
        for (let value of this.data) {
            if (value.p instanceof RPFPattern) {
                value.p._toRPFFile(out);
            }
        }
    }

    toRPFFile(): RPFFile<T> {
        let data: {[key: string]: RPFPattern<T>} = {};
        this._toRPFFile(data);
        return new RPFFile(this.base, this.path.slice(0, this.path.lastIndexOf('/')), data);
    }

}


export class FSError extends LifewebError {
    name: 'FSError' = 'FSError';
    [Symbol.toStringTag] = 'FSError';
}

type FileSystemFileHandle = typeof globalThis extends {FileSystemFileHandle: new () => infer T} ? T : unknown;
type FileSystemDirectoryHandle = typeof globalThis extends {FileSystemDirectoryHandle: new () => infer T} ? T : unknown;


export class File {

    name: string;
    path: string;
    value: string;
    rpf?: RPFFile;
    lastModified: number;
    handle?: FileSystemFileHandle;

    constructor(name: string, path: string, value: string | RPFFile) {
        this.name = name;
        this.path = path;
        if (typeof value === 'string') {
            this.value = value;
        } else {
            this.value = value.toString();
            this.rpf = value;
        }
        this.lastModified = Date.now();
    }

    write(value: string | RPFFile): void {
        if (typeof value === 'string') {
            this.value = value;
            this.rpf = undefined;
        } else {
            this.value = value.toString();
            this.rpf = value;
        }
        this.lastModified = Date.now();
    }

    getRPF(basePath: string): RPFFile {
        if (this.rpf) {
            return this.rpf;
        }
        this.rpf = RPFFile.fromString(this.value, basePath);
        return this.rpf;
    }
    
    async sync(): Promise<void> {
        if (!this.handle) {
            return;
        }
        let file = await this.handle.getFile();
        if (file.lastModified > this.lastModified) {
            this.value = await file.text();
        } else {
            let stream = await this.handle.createWritable();
            await stream.write(this.value);
            await stream.close();
        }
    }

}


export class Directory {

    name: string;
    path: string;
    data: {[key: string]: Directory | File};
    handle?: FileSystemDirectoryHandle;

    constructor(name: string, path: string, data: Directory['data'] = {}, handle?: FileSystemDirectoryHandle) {
        this.name = name;
        this.path = path;
        this.data = data;
        this.handle = handle;
    }

    exists(name: string): boolean {
        name = path.normalize(name);
        if (name.startsWith('/')) {
            name = name.slice(1);
        }
        if (name.includes('/')) {
            let index = name.indexOf('/');
            let start = name.slice(0, index);
            let dir = this.data[start];
            if (dir instanceof Directory) {
                return dir.exists(name.slice(index + 1));
            } else {
                return false;
            }
        }
        return name in this.data;
    }

    read(name: string): Directory | File {
        name = path.normalize(name);
        if (name.startsWith('/')) {
            name = name.slice(1);
        }
        if (name.includes('/')) {
            let index = name.indexOf('/');
            let start = name.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                return dir.read(name.slice(index + 1));
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (name in this.data) {
            return this.data[name];
        } else {
            throw new FSError(`File '${name}' does not exist`);
        }
    }

    write(name: string, value: string | RPFFile | File): void {
        name = path.normalize(name);
        if (name.startsWith('/')) {
            name = name.slice(1);
        }
        if (name.includes('/')) {
            let index = name.indexOf('/');
            let start = name.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                dir.write(name.slice(index + 1), value);
                return;
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (name in this.data) {
            let file = this.data[name];
            if (file instanceof Directory) {
                throw new FSError(`Cannot write to file '${name}', is a directory`);
            }
            if (value instanceof File) {
                this.data[name] = value;
            } else {
                file.write(value);
            }
        } else {
            if (typeof value === 'string') {
                this.data[name] = new File(name, path.join(this.path, name), value);
            } else if (value instanceof RPFFile) {
                let file = new File(name, path.join(this.path, name), value.toString());
                file.rpf = value;
                this.data[name] = file;
            } else {
                value.lastModified = Date.now();
                this.data[name] = value;
            }
        }
    }

    mkdir(name: string): Directory {
        name = path.normalize(name);
        if (name.startsWith('/')) {
            name = name.slice(1);
        }
        if (name.includes('/')) {
            let index = name.indexOf('/');
            let start = name.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                return dir.mkdir(name.slice(index + 1));
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (!(name in this.data)) {
            let out = new Directory(name, path.join(this.path, name));
            this.data[name] = out;
            return out;
        } else {
            throw new FSError(`File '${name}' already exists`);
        }
    }

    rm(name: string): void {
        name = path.normalize(name);
        if (name.startsWith('/')) {
            name = name.slice(1);
        }
        if (name.includes('/')) {
            let index = name.indexOf('/');
            let start = name.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                dir.rm(name.slice(index + 1));
                return;
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (name in this.data) {
            delete this.data[name];
        } else {
            throw new FSError(`File '${name}' does not exist`);
        }
    }

}


export class RPFFile<T extends Pattern = Pattern> {

    base: T;
    path: string;
    imports: {[key: string]: RPFFile<T>} = {};
    starImports: RPFFile<T>[] = [];
    data: {[key: string]: RPFPattern<T>};

    constructor(base: T, path: string, data: {[key: string]: RPFPattern<T>}) {
        this.base = base;
        this.path = path;
        this.data = data;
    }

    toString(): string {
        let map = new Map<string, Set<string>>();
        for (let key in this.data) {
            let value = new Set<string>();
            for (let item of this.data[key].data) {
                if (item.p instanceof RPFPattern) {
                    if (item.p.key in this.data) {
                        value.add(item.p.key);
                    }
                }
            }
            map.set(key, value);
        }
        let layers: string[][] = [];
        while (map.size > 0) {
            let currentLayer: string[] = [];
            for (let [key, value] of map) {
                if (value.size === 0) {
                    currentLayer.push(key);
                }
            }
            if (currentLayer.length === 0) {
                throw new RPFError(`Cycle detected while serializing RPF:\n\n${layers.map(x => x.join(', ')).join('\n')}\n\n${Array.from(map.entries()).map(x => x[0] + ': ' + Array.from(x[1]).join(', ')).join('\n')}\n`);
            }
            layers.push(currentLayer);
            for (let key of currentLayer) {
                map.delete(key);
            }
            for (let value of map.values()) {
                for (let key of currentLayer) {
                    value.delete(key);
                }
            }
        }
        let out = `\n${this.base.rule.str}\n`;
        for (let layer of layers) {
            for (let key of layer.sort()) {
                out += '\n' + this.data[key].toString(this) + '\n';
            }
        }
        return out;
    }

    static fromString<T extends Pattern = Pattern>(data: string, basePath: string, fs?: Directory): RPFFile<T> {
        let groups: string[] = [];
        let currentGroup: string[] = [];
        for (let line of data.split('\n')) {
            line = line.trim();
            if (line === '' || line.startsWith('//')) {
                continue;
            }
            if (line.endsWith(':')) {
                groups.push(currentGroup.join('\n'));
                currentGroup = [line];
            } else {
                currentGroup.push(line);
            }
        }
        groups.push(currentGroup.join('\n'));
        let headerLines = groups[0].split('\n');
        let base = createPattern(headerLines[0]) as T;
        let out = new RPFFile(base, basePath, {});
        for (let line of headerLines.slice(1)) {
            if (line.startsWith('import ')) {
                if (!fs) {
                    throw new RPFError(`Import statement in RPF but no file system given`);
                }
                let rename: string | undefined;
                let specifier: string;
                if (line.startsWith('import * from ')) {
                    rename = undefined;
                    specifier = line.slice('import * from '.length);
                } else {
                    let match = line.match(/import \* as (\S+) from /);
                    if (!match) {
                        throw new RPFError(`Invalid import (unrecognized format): '${line}'`);
                    }
                    rename = match[1];
                    specifier = line.slice(match[0].length);
                }
                if (!path.isAbsolute(specifier)) {
                    specifier = path.join(path.dirname(out.path), specifier);
                }
                let value = fs.read(specifier);
                let rpf: RPFFile<T>;
                if (value instanceof Directory) {
                    throw new RPFError(`Cannot import from '${specifier}' (is a directory)`);
                } else if (value.rpf) {
                    rpf = value.rpf as RPFFile<T>;
                } else {
                    rpf = RPFFile.fromString<T>(value.value, basePath);
                    value.rpf = rpf;
                }
                if (rename === undefined) {
                    out.starImports.push(rpf);
                } else {
                    out.imports[rename] = rpf;
                }
            } else {
                console.log('SERIOUSLY');
                throw new RPFError(`Invalid header line: '${line}'`);
            }
        }
        for (let i = 1; i < groups.length; i++) {
            let p = RPFPattern.fromString(groups[i], out);
            out.data[p.key] = p;
        }
        return out;
    }

    lookupName(name: string): RPFPattern<T> | undefined {
        if (name in this.data) {
            return this.data[name];
        }
        if (name.includes('.')) {
            let index = name.indexOf('.');
            let module = name.slice(0, index);
            if (!(module in this.imports)) {
                throw new RPFError(`Unrecognized module: '${module}'`);
            }
            return this.imports[module].lookupName(name.slice(index + 1));
        } else {
            for (let file of this.starImports) {
                let value = file.lookupName(name);
                if (value) {
                    return value;
                }
            }
        }
        return undefined;
    }

}
