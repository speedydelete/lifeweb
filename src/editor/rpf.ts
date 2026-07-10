
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
const ROTATIONS = new Set(['F', 'Fx', 'L', 'Lx', 'B', 'Bx', 'R', 'Rx']);

export const ROTATION_COMBINE: {[K in Rotation]: {[K in Rotation]: Rotation}} = {
  F: { F: 'F', Fx: 'Fx', L: 'L', Lx: 'Lx', B: 'B', Bx: 'Bx', R: 'R', Rx: 'Rx' },
  Fx: { F: 'Fx', Fx: 'F', L: 'Lx', Lx: 'L', B: 'Bx', Bx: 'B', R: 'Rx', Rx: 'R' },
  L: { F: 'L', Fx: 'Rx', L: 'B', Lx: 'Fx', B: 'R', Bx: 'Lx', R: 'F', Rx: 'Bx' },
  Lx: { F: 'Lx', Fx: 'R', L: 'Bx', Lx: 'F', B: 'Rx', Bx: 'L', R: 'Fx', Rx: 'B' },
  B: { F: 'B', Fx: 'Bx', L: 'R', Lx: 'Rx', B: 'F', Bx: 'Fx', R: 'L', Rx: 'Lx' },
  Bx: { F: 'Bx', Fx: 'B', L: 'Rx', Lx: 'R', B: 'Fx', Bx: 'F', R: 'Lx', Rx: 'L' },
  R: { F: 'R', Fx: 'Lx', L: 'F', Lx: 'Bx', B: 'L', Bx: 'Rx', R: 'B', Rx: 'Fx' },
  Rx: { F: 'Rx', Fx: 'L', L: 'Fx', Lx: 'B', B: 'Lx', Bx: 'R', R: 'Bx', Rx: 'F' }
};

export const TRANSPOSE_ROTATIONS = new Set<Rotation>(['L', 'Lx', 'R', 'Rx']);

export function applyRotation<T extends Pattern>(p: T, rotation: Rotation): T {
    if (rotation === 'F') {
        return p;
    } else if (rotation === 'Fx') {
        return p.flipVertical().shrinkToFit();
    } else if (rotation === 'L') {
        return p.rotateLeft().shrinkToFit();
    } else if (rotation === 'Lx') {
        return p.flipDiagonal().shrinkToFit();
    } else if (rotation === 'B') {
        return p.rotate180().shrinkToFit();
    } else if (rotation === 'Bx') {
        return p.flipHorizontal().shrinkToFit();
    } else if (rotation === 'R') {
        return p.rotateRight().shrinkToFit();
    } else {
        return p.flipAntiDiagonal().shrinkToFit();
    }
}

export function transformCoordinates(x: number, y: number, height: number, width: number, rotation: Rotation): [number, number] {
    // if (TRANSPOSE_ROTATIONS.has(rotation)) {
    //     let temp = height;
    //     height = width;
    //     width = temp;
    // }
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

export function transformCoordinatesOfPart(x: number, y: number, height1: number, width1: number, height2: number, width2: number, rotation: Rotation): [number, number] {
    // if (TRANSPOSE_ROTATIONS.has(rotation)) {
    //     let temp = height1;
    //     height1 = width1;
    //     width1 = temp;
    //     temp = height2;
    //     height2 = width2;
    //     width2 = temp;
    // }
    if (rotation === 'F') {
        return [x, y];
    } else if (rotation === 'Fx') {
        return [x, height1 - y - height2];
    } else if (rotation === 'L') {
        return [y, width1 - x - width2];
    } else if (rotation === 'Lx') {
        return [y, x];
    } else if (rotation === 'B') {
        return [width1 - x - width2, height1 - y - height2];
    } else if (rotation === 'Bx') {
        return [width1 - x - width2, y];
    } else if (rotation === 'R') {
        return [height1 - y - height2, x];
    } else {
        return [height1 - y - height2, width1 - x - width2];
    }
}


export class PartialRPFReference<T extends Pattern = Pattern> {

    parent: RPFPattern<T>;
    p: T | RPFPattern<T>;
    x: number;
    y: number;
    rotation: Rotation;
    time: number;

    minX: number;
    minY: number;
    height: number;
    width: number;
    population: number;

    constructor(parent: RPFPattern<T>, p: T | RPFPattern<T>, x: number = 0, y: number = 0, rotation: Rotation = 'F', time: number = 0) {
        this.parent = parent;
        this.p = p;
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.time = time;
        p = p.copy();
        p.run(time);
        p.shrinkToFit();
        this.population = p.population;
        let offset = p.getFullOffset();
        this.minX = x + offset[1];
        this.minY = y + offset[0];
        if (TRANSPOSE_ROTATIONS.has(rotation)) {
            this.height = p.width;
            this.width = p.height;
        } else {
            this.height = p.height;
            this.width = p.width;
        }
    }

    toString(file: RPFFile<T> | undefined, dir: string): string {
        let str: string | undefined = undefined;
        if (this.p instanceof RPFPattern) {
            let dir2 = path.dirname(this.p.path);
            if (!file || dir === dir2) {
                str = this.p.key;
            } else {
                for (let imported of file.starImports) {
                    if (dir2 === imported.path) {
                        str = this.p.key;
                        break;
                    }
                }
                if (str === undefined) {
                    for (let [key, imported] of Object.entries(file.imports)) {
                        if (dir2 === imported.path) {
                            str = `${key}.${this.p.key}`;
                            break;
                        }
                    }
                }
                if (str === undefined) {
                    str = this.p.path;
                }
            }
        } else {
            str = '*' + this.p.toApgcode();
        }
        if (this.x !== 0 || this.y !== 0 || this.rotation !== 'F' || this.time !== 0) {
            str += ` ${this.x} ${this.y}`;
            if (this.rotation !== 'F' || this.time !== 0) {
                str += ` ${this.rotation}`;
                if (this.time !== 0) {
                    str += ` ${this.time}`;
                }
            }
        }
        return str;
    }

    static fromString<T extends Pattern>(file: RPFFile<T>, parent: RPFPattern<T>, data: string[]): PartialRPFReference<T> {
        if (data.length > 5) {
            throw new RPFError(`Extra data in partial RPF reference: '${data.join(' ')}'`);
        }
        let p = data[0].startsWith('*') ? file.base.loadApgcode(data[0].slice(1)).shrinkToFit() : file.lookupName(data[0]);
        if (!p) {
            throw new RPFError(`Cannot find RPF object '${data[0]}'`);
        }
        let x = data[1] === undefined ? 0 : Number(data[1]);
        let y = data[2] === undefined ? 0 : Number(data[2]);
        let rotation = data[3] === undefined ? 'F' : data[3] as Rotation;
        if (!ROTATIONS.has(rotation)) {
            throw new RPFError(`Invalid rotation: '${data[3]}'`);
        }
        let time = data[4] === undefined ? 0 : Number(data[4]);
        return new PartialRPFReference(parent, p, x, y, rotation, time);
    }

    copy(parent: RPFPattern<T>): PartialRPFReference<T> {
        return new PartialRPFReference(parent, this.p, this.x, this.y, this.rotation, this.time);
    }

    deepCopy(parent: RPFPattern<T>): PartialRPFReference<T> {
        return new PartialRPFReference(parent, this.p instanceof RPFPattern ? this.p.deepCopy() : this.p.copy(), this.x, this.y, this.rotation, this.time);
    }

    applyTransform(rotation: Rotation): this {
        let oldRotation = this.rotation;
        rotation = ROTATION_COMBINE[oldRotation][rotation];
        this.rotation = rotation;
        if (TRANSPOSE_ROTATIONS.has(oldRotation) !== TRANSPOSE_ROTATIONS.has(rotation)) {
            let temp = this.height;
            this.height = this.width;
            this.width = temp;
        }
        return this;
    }

}


export class RPFReference<T extends Pattern = Pattern> extends PartialRPFReference<T> {

    static fromString<T extends Pattern>(file: RPFFile<T>, parent: RPFPattern<T>, data: string[]): RPFReference<T> {
        if (data.length > 5) {
            throw new RPFError(`Extra data in RPF reference: '${data.join(' ')}'`);
        }
        let p = data[0].startsWith('*') ? file.base.loadApgcode(data[0].slice(1)).shrinkToFit() : file.lookupName(data[0]);
        if (!p) {
            throw new RPFError(`Cannot find RPF object '${data[0]}'`);
        }
        let x = data[1] === undefined ? 0 : Number(data[1]);
        let y = data[2] === undefined ? 0 : Number(data[2]);
        let rotation = data[3] === undefined ? 'F' : data[3] as Rotation;
        if (!ROTATIONS.has(rotation)) {
            throw new RPFError(`Invalid rotation: '${data[3]}'`);
        }
        let time = data[4] === undefined ? 0 : Number(data[4]);
        return new RPFReference(parent, p, x, y, rotation, time);
    }

    copy(parent: RPFPattern<T>): RPFReference<T> {
        return new RPFReference(parent, this.p, this.x, this.y, this.rotation, this.time);
    }

    deepCopy(parent: RPFPattern<T>): RPFReference<T> {
        return new RPFReference(parent, this.p instanceof RPFPattern ? this.p.deepCopy() : this.p.copy(), this.x, this.y, this.rotation, this.time);
    }

}


let envelopeBase = createPattern('B3/S23') as MAPPattern;

export class RPFPattern<T extends Pattern = Pattern> extends Pattern {

    base: T;
    key: string;
    path: string;
    data: Set<RPFReference<T>> = new Set();

    minX: number = 0;
    minY: number = 0;
    height: number = 0;
    width: number = 0;

    xOffset: 0 = 0;
    yOffset: 0 = 0;
    generation: number = 0;
    population: number = 0;
    rule: Rule;

    // we set optional values to undefined so the V8 hidden classes are the same
    name?: string = undefined;
    desc?: string = undefined;
    periodic?: {dx: number, dy: number, period: number} = undefined;
    creates?: {ref: RPFReference, times: number[]} = undefined;
    conduit?: {
        recoveryTime: number;
        repeatTime: number;
        overclock: number[];
        inputs: PartialRPFReference<T>[];
        outputs: PartialRPFReference<T>[];
    } = undefined;
    envelope?: {
        x: number;
        y: number;
        p: MAPPattern;
    } = undefined;

    constructor(base: T, key: string, path: string) {
        super();
        this.base = base;
        this.key = key;
        this.path = path;
        this.rule = base.rule;
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
            out.push(`#periodic ${this.periodic.dx} ${this.periodic.dy} ${this.periodic.period}`);
        }
        if (this.creates) {
            out.push(`#creates ${this.creates.times.join(',')} ${this.creates.ref.toString(file, dir)}`);
        }
        if (this.envelope) {
            out.push(`#envelope ${this.envelope.x} ${this.envelope.y} ${this.envelope.p.toApgcode()}`);
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
                str += ` input ${input.toString(file, dir)}`;
            }
            for (let output of data.outputs) {
                str += ` output ${output.toString(file, dir)}`;
            }
        }
        for (let value of this.data) {
            out.push(value.toString(file, dir));
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
        let out = new RPFPattern(file.base, key, path.join(file.path, key));
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
                    out.periodic = {dx, dy, period};
                } else if (parts[0] === '#creates') {
                    if (!parts[1] || !parts[2]) {
                        throw new RPFError(`Expected object after '#creates'`);
                    }
                    let times = parts[1].split(',').map(Number);
                    if (times.some(x => Number.isNaN(x))) {
                        throw new RPFError(`Invalid times: '${times}'`);
                    }
                    out.creates = {ref: RPFReference.fromString(file, out, parts.slice(2)), times};
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
                    parts = parts.slice(3);
                    let refs: string[][] = [];
                    let currentRef: string[] = [];
                    for (let part of parts) {
                        if (part === 'input' || part === 'output') {
                            if (currentRef.length > 0) {
                                refs.push(currentRef);
                            }
                            currentRef = [part];
                        } else {
                            currentRef.push(part);
                        }
                    }
                    if (currentRef.length > 0) {
                        refs.push(currentRef);
                    }
                    for (let data of refs) {
                        let type = data[0];
                        if (type !== 'input' && type !== 'output') {
                            throw new RPFError(`Expected 'input' or 'output' in #conduit`);
                        }
                        let ref = PartialRPFReference.fromString(file, out, data.slice(1));
                        if (type === 'input') {
                            conduit.inputs.push(ref);
                        } else {
                            conduit.outputs.push(ref);
                        }
                    }
                    out.conduit = conduit;
                } else if (parts[0] === '#envelope') {
                    let x = Number(parts[1]);
                    let y = Number(parts[2]);
                    let p = envelopeBase.loadApgcode(parts[3]).shrinkToFit();
                    out.setEnvelope(x, y, p);
                }
            } else {
                out.data.add(RPFReference.fromString(file, out, parts));
            }
        }
        out.recomputeSizes();
        return out;
    }

    fromPattern(key: string, file: RPFFile<T>, p: T | RPFPattern<T>): RPFPattern<T> {
        let out = new RPFPattern(this.base, key, path.join(file.path, key));
        out.add(new RPFReference(out, p));
        return out;
    }

    add(ref: RPFReference<T>): this {
        if (this.data.has(ref)) {
            return this;
        }
        if (ref.parent !== this) {
            throw new Error(`Attempted addition of RPFReference whose parent is not the target`);
        }
        this.data.add(ref);
        this.population += ref.population;
        this.width = Math.max(this.minX + this.width, ref.x + ref.width) - this.minX;
        this.height = Math.max(this.minY + this.height, ref.y + ref.height) - this.minY;
        this.minX = Math.min(this.minX, ref.x);
        this.minY = Math.min(this.minY, ref.y);
        return this;
    }

    remove(ref: RPFReference<T>): boolean {
        if (this.data.delete(ref)) {
            this.recomputeSizes();
            return true;
        }
        return false;
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
            let p = value.p.copy();
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

    getRefAt(x: number, y: number, level: number): RPFReference | undefined {
        for (let ref of this.data) {
            if (x < ref.minX || y < ref.minY || x > ref.minX + ref.width || y > ref.minY + ref.height) {
                continue;
            }
            let [x2, y2] = transformCoordinates(x - ref.x, y - ref.y, ref.height, ref.width, ref.rotation);
            if (level === 0 && ref.p instanceof RPFPattern && ref.p.envelope) {
                if (ref.p.envelope.p.get(x2 - ref.p.envelope.x, y2 - ref.p.envelope.y)) {
                    return ref;
                }
            }
            if (ref.p.get(x2, y2)) {
                if (level === 0) {
                    return ref;
                } else if (ref.p instanceof RPFPattern) {
                    let out = ref.p.getRefAt(x2, y2, level - 1);
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
        let {dx, dy, period} = this.periodic;
        let moves = dx !== 0 || dy !== 0;
        if (this.creates) {
            let prefix = speedToString(dx, dy, period) + ' ';
            let q = this.creates.ref.p;
            if (!(q instanceof RPFPattern)) {
                return `${prefix} ${moves ? 'puffer' : 'factory'}`;
            }
            prefix += q.getName() + ' ';
            if (!q.periodic) {
                return `${prefix} ${moves ? 'puffer' : 'factory'}`;
            }
            let qMoves = q.periodic.dx !== 0 || q.periodic.dy !== 0;
            if (q.creates) {
                prefix = speedToString(dx, dy, period) + ' ';
                prefix += moves ? 'M' : 'S';
                prefix += qMoves ? 'M' : 'S';
                let r = q.creates.ref.p;
                if (r instanceof RPFPattern && r.periodic) {
                    prefix += (r.periodic.dx !== 0 || r.periodic.dy !== 0) ? 'M' : 'S';
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
            ref: deep ? this.creates.ref.deepCopy(p) : this.creates.ref.copy(p),
            times: this.creates.times.slice(),
        } : undefined;
        p.conduit = this.conduit ? {
            recoveryTime: this.conduit.recoveryTime,
            repeatTime: this.conduit.repeatTime,
            overclock: this.conduit.overclock.slice(),
            inputs: this.conduit.inputs.map(ref => deep ? ref.deepCopy(p) : ref.copy(p)),
            outputs: this.conduit.outputs.map(ref => deep ? ref.deepCopy(p) : ref.copy(p)),
        } : undefined;
        if (this.envelope) {
            p.setEnvelope(this.envelope.x, this.envelope.y, this.envelope.p.copy());
        }
    }

    copy(): this {
        let out = new RPFPattern(this.base, this.key, this.path);
        this.assignMetadata(out, false);
        for (let value of this.data) {
            out.add(value.copy(out));
        }
        return out as this;
    }

    deepCopy(): RPFPattern<T> {
        let out = new RPFPattern(this.base, this.key, this.path);
        this.assignMetadata(out, true);
        for (let value of this.data) {
            out.add(value.deepCopy(out));
        }
        return out;
    }

    clearedCopy(): this {
        let out = new RPFPattern(this.base, this.key, this.path);
        this.assignMetadata(out, false);
        return out as this;
    }

    clearedDeepCopy(): this {
        let out = new RPFPattern(this.base, this.key, this.path);
        this.assignMetadata(out, true);
        return out as this;
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

    get(x: number, y: number/*, debug?: boolean*/): number {
        for (let ref of this.data) {
            if (x < ref.minX || y < ref.minY || x > ref.minX + ref.width || y > ref.minY + ref.height) {
                // if (debug) {
                //     console.log(`culled ${ref.p instanceof RPFPattern ? ref.p.key : 'pattern'}: x = ${x}, y = ${y}, minX = ${ref.minX}, minY = ${ref.minY}, height = ${ref.height}, width = ${ref.width}`);
                // }
                continue;
            }
            let [x2, y2] = transformCoordinates(x - ref.x, y - ref.y, ref.height, ref.width, ref.rotation);
            // if (debug) {
            //     console.log(`${ref.p instanceof RPFPattern ? ref.p.key : 'pattern'}: x = ${x}, y = ${y}, ref.x = ${ref.x}, ref.y = ${ref.y}, x1 = ${x - ref.x}, y1 = ${y - ref.y}`);
            //     console.log(`height = ${ref.height}, width = ${ref.width}, rotation = ${ref.rotation}, x2 = ${x2}, y2 = ${y2}`)
            // }
            if (ref.p.get(x2, y2/*, debug*/)) {
                return 1;
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
        let p = this.base.clearedCopy();
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
        return this.toPattern().hash32();
    }

    hash64(): bigint {
        return this.toPattern().hash64();
    }

    hash128(): bigint {
        return this.toPattern().hash128();
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

    loadApgcode(code: string): this {
        let out = new RPFPattern(this.base, this.key, this.path);
        out.add(new RPFReference<T>(out, this.base.loadApgcode(code)));
        return out as this;
    }

    loadRLE(rle: string): this {
        let out = new RPFPattern(this.base, this.key, this.path);
        out.add(new RPFReference<T>(out, this.base.loadRLE(rle)));
        return out as this;
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

    setEnvelope(x: number, y: number, p: MAPPattern): this {
        this.height = Math.max(this.minY + this.height, y + p.height) - this.minY;
        this.width = Math.max(this.minX + this.width, x + p.width) - this.minX;
        this.minX = Math.min(this.minX, x);
        this.minY = Math.min(this.minY, y);
        this.envelope = {x, y, p};
        return this;
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
