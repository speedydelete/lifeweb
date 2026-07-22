
export let path: (typeof import('node:path'))['posix'];
let normalize: (typeof path)['normalize'];
let join: (typeof path)['join'];
(async () => {
    if (typeof window === 'object' && window === globalThis) {
        // @ts-ignore
        path = (await import('https://esm.sh/path')).posix;
    } else {
        // @ts-ignore
        path = (await import('node:path')).posix;
    }
    (globalThis as any).path = path;
    normalize = path.normalize;
    join = path.join;
})();

import {LifewebError, Rect, Rule, Pattern, IdentityPattern, speedToString, createPattern} from '../core/index.js';


export class RPFError extends LifewebError {
    name = 'RPFError';
    [Symbol.toStringTag] = 'RPFError';
};


export type Rotation = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';
export const ROTATIONS = new Set(['F', 'Fx', 'L', 'Lx', 'B', 'Bx', 'R', 'Rx'] as Rotation[]);

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


export class RPFReference<T extends Pattern = Pattern> {

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

    _toString(): string {
        if (this.p instanceof RPFPattern) {
            if (this.p.key) {
                let file = this.parent.file;
                let pFile = this.p.file;
                let out: string | undefined;
                for (let imported of file.starImports) {
                    if (pFile.path === imported.path) {
                        out = this.p.key;
                        break;
                    }
                }
                if (out === undefined) {
                    for (let [key, imported] of Object.entries(file.imports)) {
                        if (pFile.path === imported.path) {
                            out = `${key}.${this.p.key}`;
                            break;
                        }
                    }
                }
                if (out === undefined) {
                    out = this.p.key;
                }
                return out;
            } else {
                let out = '{\n';
                for (let line of this.p.toString().split('\n')) {
                    out += '    ' + line + '\n';
                }
                out += '}';
                return out;
            }
        } else {
            return '*' + this.p.toApgcode();
        }
    }

    toString(): string {
        let out = this._toString();
        if (this.x !== 0 || this.y !== 0 || this.rotation !== 'F' || this.time !== 0) {
            out += ` ${this.x} ${this.y}`;
            if (this.rotation !== 'F' || this.time !== 0) {
                out += ` ${this.rotation}`;
                if (this.time !== 0) {
                    out += ` ${this.time}`;
                }
            }
        }
        return out;
    }

    copy(parent: RPFPattern<T>): RPFReference<T> {
        return new RPFReference(parent, this.p, this.x, this.y, this.rotation, this.time);
    }

    deepCopy(parent: RPFPattern<T>): RPFReference<T> {
        return new RPFReference(parent, this.p instanceof RPFPattern ? this.p.deepCopy() : this.p.copy(), this.x, this.y, this.rotation, this.time);
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


export class RPFPattern<T extends Pattern = Pattern> extends Pattern {

    /** The file that it's part of. */
    file: RPFFile<T>;
    /** Only present if it isn't anonymous. */
    key?: string;

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
        inputs: RPFReference<T>[];
        outputs: RPFReference<T>[];
    } = undefined;
    envelope?: {
        x: number;
        y: number;
        p: IdentityPattern;
    } = undefined;

    constructor(file: RPFFile<T>, key?: string) {
        super();
        this.file = file;
        this.key = key;
        this.rule = file.base.rule;
    }

    toString(): string {
        let out: string[] = [];
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
            out.push(`#creates ${this.creates.times.join(',')} ${this.creates.ref.toString()}`);
        }
        if (this.envelope) {
            out.push(`#envelope ${this.envelope.x} ${this.envelope.y} ${this.envelope.p.toApgcode()}`);
        }
        if (this.conduit) {
            let data = this.conduit;
            let str = `#conduit ${data.recoveryTime}`;
            if (data.overclock.length > 0) {
                str += ` ${data.overclock.join(',')},${data.repeatTime}+`;
            } else {
                str += ` ${data.repeatTime}`;
            }
            for (let input of data.inputs) {
                str += ` input ${input.toString()}`;
            }
            for (let output of data.outputs) {
                str += ` output ${output.toString()}`;
            }
        }
        for (let value of this.data) {
            out.push(value.toString());
        }
        return out.join('\n');
    }

    fromPattern(p: T | RPFPattern<T>): RPFPattern<T> {
        let out = new RPFPattern(this.file);
        out.add(p);
        return out;
    }

    createRef(p: T | RPFPattern<T>, x?: number, y?: number, rotation?: Rotation, time?: number): RPFReference<T> {
        return new RPFReference(this, p, x, y, rotation, time);
    }

    add(ref: RPFReference<T>): this;
    add(p: T | RPFPattern<T>, x?: number, y?: number, rotation?: Rotation, time?: number): this;
    add(ref: RPFReference<T> | T | RPFPattern<T>, x?: number, y?: number, rotation?: Rotation, time?: number): this {
        if (!(ref instanceof RPFReference)) {
            ref = this.createRef(ref, x, y, rotation, time);
        }
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

    getName(capitalize: boolean = false): string | undefined {
        let out: string;
        if (this.name) {
            out = this.name;
        } else if (this.key) {
            out = this.key.replaceAll('_', ' ');
        } else {
            return;
        }
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
        p.key = this.key;
        p.name = this.name;
        p.desc = this.desc;
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
        let out = new RPFPattern(this.file);
        this.assignMetadata(out, false);
        for (let value of this.data) {
            out.add(value.copy(out));
        }
        return out as this;
    }

    deepCopy(): RPFPattern<T> {
        let out = new RPFPattern(this.file);
        this.assignMetadata(out, true);
        for (let value of this.data) {
            out.add(value.deepCopy(out));
        }
        return out;
    }

    clearedCopy(): this {
        let out = new RPFPattern(this.file);
        this.assignMetadata(out, false);
        return out as this;
    }

    clearedDeepCopy(): this {
        let out = new RPFPattern(this.file);
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
        let p = this.file.base.clearedCopy();
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
        let out = new RPFPattern(this.file);
        out.add(this.file.base.loadApgcode(code));
        return out as this;
    }

    loadRLE(rle: string): this {
        let out = new RPFPattern(this.file);
        out.add(this.file.base.loadRLE(rle));
        return out as this;
    }

    setEnvelope(x: number, y: number, p: IdentityPattern): this {
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


const DUMMY_IDENTITY_PATTERN = new IdentityPattern(0, 0, new Uint8Array(0));

export class File {

    parent: Directory;
    name: string;
    path: string;
    value: string;
    rpf?: RPFFile;
    lastModified: number;
    handle?: FileSystemFileHandle;

    constructor(parent: Directory, name: string, value: string | RPFFile) {
        this.parent = parent;
        this.name = name;
        this.path = join(parent.path, name);
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

    getRPF(): RPFFile {
        if (this.rpf) {
            return this.rpf;
        }
        let parser = new RPFParser(DUMMY_IDENTITY_PATTERN, this.path, this.value);
        this.rpf = parser.parseFile(this.parent);
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
        this.path = normalize(path);
        if (!this.path.endsWith('/')) {
            this.path += '/';
        }
        this.data = data;
        this.handle = handle;
    }

    exists(path: string): boolean {
        path = normalize(path);
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.includes('/')) {
            let index = path.indexOf('/');
            let start = path.slice(0, index);
            let dir = this.data[start];
            if (dir instanceof Directory) {
                return dir.exists(path.slice(index + 1));
            } else {
                return false;
            }
        }
        return path in this.data;
    }

    read(path: string): Directory | File {
        path = normalize(path);
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.includes('/')) {
            let index = path.indexOf('/');
            let start = path.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                return dir.read(path.slice(index + 1));
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (path in this.data) {
            return this.data[path];
        } else {
            throw new FSError(`File '${name}' does not exist`);
        }
    }

    write(path: string, value: string | RPFFile | File): void {
        path = normalize(path);
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.includes('/')) {
            let index = path.indexOf('/');
            let start = path.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                dir.write(path.slice(index + 1), value);
                return;
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (path in this.data) {
            let file = this.data[path];
            if (file instanceof Directory) {
                throw new FSError(`Cannot write to file '${path}', is a directory`);
            }
            if (value instanceof File) {
                this.data[path] = value;
            } else {
                file.write(value);
            }
        } else {
            if (typeof value === 'string') {
                this.data[path] = new File(this, path, value);
            } else if (value instanceof RPFFile) {
                let file = new File(this, path, value.toString());
                file.rpf = value;
                this.data[path] = file;
            } else {
                value.lastModified = Date.now();
                this.data[path] = value;
            }
        }
    }

    mkdir(path: string): Directory {
        path = normalize(path);
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.includes('/')) {
            let index = path.indexOf('/');
            let start = path.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                return dir.mkdir(path.slice(index + 1));
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (!(path in this.data)) {
            let out = new Directory(path, join(this.path, path));
            this.data[path] = out;
            return out;
        } else {
            throw new FSError(`File '${path}' already exists`);
        }
    }

    rm(path: string): void {
        path = normalize(path);
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        if (path.includes('/')) {
            let index = path.indexOf('/');
            let start = path.slice(0, index);
            let dir = this.data[start];
            if (!dir) {
                throw new FSError(`Directory '${start}' does not exist`);
            } else if (dir instanceof Directory) {
                dir.rm(path.slice(index + 1));
                return;
            } else {
                throw new FSError(`File '${start}' is not a directory`);
            }
        }
        if (path in this.data) {
            delete this.data[path];
        } else {
            throw new FSError(`File '${path}' does not exist`);
        }
    }

}


export class RPFFile<T extends Pattern = Pattern> {

    base: T;
    path: string;
    imports: {[key: string]: RPFFile<T>} = {};
    starImports: RPFFile<T>[] = [];
    data: {[key: string]: RPFPattern<T>};

    constructor(base: T, path: string, data: {[key: string]: RPFPattern<T>} = {}) {
        this.base = base;
        this.path = normalize(path);
        this.data = data;
    }

    toString(): string {
        let map = new Map<string, Set<string>>();
        for (let key in this.data) {
            let value = new Set<string>();
            for (let item of this.data[key].data) {
                if (item.p instanceof RPFPattern) {
                    if (item.p.key && item.p.key in this.data) {
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
                out += `\n${key}:\n${this.data[key].toString()}\n`;
            }
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


const EOF = '';

type Matcher = [string | Set<string> | RegExp, string];

const T_EOF: Matcher = [EOF, 'end of file'];
const T_NEWLINE: Matcher = ['\n', 'newline'];
const T_LEFT_BRACE: Matcher = ['{', 'left brace'];
const T_RIGHT_BRACE: Matcher = ['}', 'right brace'];

const T_NATURAL_NUMBER: Matcher = [/^\d+$/, 'natural number'];
const T_INTEGER: Matcher = [/^-?\d+$/, 'integer'];
const T_ROTATION: Matcher = [ROTATIONS, 'rotation'];
const T_APGCODE: Matcher = [/^[a-z0-9]+$/, 'apgcode'];
const T_KEY_INDICATOR: Matcher = [/^.*:$/, 'key indicator'];

export class RPFParser<T extends Pattern> {

    base: T;
    file: RPFFile<T>;
    code: string;
    tokens: string[];
    tokenPositions: number[];
    pos: number;

    constructor(base: T, file: string | RPFFile<T>, code: string) {
        this.base = base;
        this.file = typeof file === 'string' ? new RPFFile(base, file) : file;
        // remove comments
        let commentsRemoved = '';
        for (let i = 0; i < code.length; i++) {
            if (code[i] === '/' && code[i + 1] === '/') {
                while (code[i] !== '\n') {
                    i++;
                }
            } else {
                commentsRemoved += code[i];
            }
        }
        code = commentsRemoved.trim();
        this.code = code;
        this.tokens = [];
        this.tokenPositions = [];
        let currentValue = '';
        let currentPos = 0;
        for (let i = 0; i < code.length; i++) {
            let char = code[i];
            if (char === ' ' || char === '\n') {
                if (currentValue.length === 0) {
                    currentPos++;
                    continue;
                }
                this.tokens.push(currentValue);
                this.tokenPositions.push(currentPos);
                if (char === '\n') {
                    this.tokens.push('\n');
                    this.tokenPositions.push(i);
                }
                currentValue = '';
                currentPos = i + 1;
            } else {
                currentValue += char;
            }
        }
        if (currentValue !== '') {
            this.tokens.push(currentValue);
            this.tokenPositions.push(currentPos);
        }
        if (this.tokens[this.tokens.length - 1] !== '\n') {
            this.tokens.push('\n');
            this.tokenPositions.push(code.length);
        }
        this.pos = 0;
    }

    error(msg: string, increment: number = 0): never {
        let pos = this.tokenPositions[this.pos + increment];
        let line = 0;
        let col = 0;
        for (let i = 0; i < pos; i++) {
            if (this.code[i] === '\n') {
                col = 0;
                line++;
            } else {
                col++;
            }
        }
        throw new RPFError(`Syntax error (at ${this.file.path}:${line}:${col}): ${msg}`);
    }

    peek(): string | typeof EOF {
        return this.tokens[this.pos] ?? EOF;
    }

    advance(): string {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            return EOF;
        } else {
            this.pos++;
            return out;
        }
    }

    match(...data: (Matcher | Matcher[0])[]): boolean {
        for (let i = 0; i < data.length; i++) {
            let matcher = data[i];
            if (Array.isArray(matcher)) {
                matcher = matcher[0];
            }
            let token = this.tokens[this.pos + i] ?? EOF;
            if (matcher instanceof Set) {
                let found = false;
                for (let value of matcher) {
                    if (value === token) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    return false;
                }
            } else if (typeof matcher === 'string') {
                if (matcher !== token) {
                    return false;
                }
            } else {
                if (!token.match(matcher)) {
                    return false;
                }
            }
        }
        return true;
    }

    expect(...data: Matcher[]): void {
        for (let i = 0; i < data.length; i++) {
            let [matcher, errorMsg] = data[i];
            let token = this.tokens[this.pos + i] ?? EOF;
            if (matcher instanceof Set) {
                let found = false;
                for (let value of matcher) {
                    if (value === token) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    if (token === EOF) {
                        this.error(`Unexpected end of input (expected ${errorMsg})`, i);
                    } else {
                        this.error(`Unexpected token: ${token} (expected ${errorMsg})`, i);
                    }
                }
            } else if (typeof matcher === 'string') {
                if (matcher !== token) {
                    if (token === EOF) {
                        this.error(`Unexpected end of input (expected ${errorMsg})`, i);
                    } else {
                        this.error(`Unexpected token: ${token} (expected ${errorMsg})`, i);
                    }
                }
            } else {
                if (!token.match(matcher)) {
                    if (token === EOF) {
                        this.error(`Unexpected end of input (expected ${errorMsg})`, i);
                    } else {
                        this.error(`Unexpected token: ${token} (expected ${errorMsg})`, i);
                    }
                }
            }
        }
    }

    eat(...data: Matcher[]): string[] {
        this.expect(...data);
        let out: string[] = [];
        for (let i = 0; i < data.length; i++) {
            out.push(this.advance());
        }
        return out;
    }

    _literalOrIdentifier(): T | RPFPattern<T> {
        if (this.match(T_APGCODE)) {
            return this.file.base.loadApgcode(this.advance());
        } else {
            let value = this.advance();
            let out = this.file.lookupName(value);
            if (!out) {
                this.error(`Cannot resolve name '${value}'`, -1);
            }
            return out;
        }
    }

    reference(parent: RPFPattern<T>): RPFReference<T> {
        let p: T | RPFPattern<T>;
        if (this.match(T_LEFT_BRACE)) {
            this.advance();
            p = this.pattern();
            this.eat(T_RIGHT_BRACE);
        } else {
            p = this._literalOrIdentifier();
        }
        let x = 0;
        let y = 0;
        let rotation: Rotation = 'F';
        let time: number = 0;
        if (this.match(T_INTEGER)) {
            x = Number(this.advance());
            if (this.match(T_INTEGER)) {
                y = Number(this.advance());
                if (this.match(T_ROTATION)) {
                    rotation = this.advance() as Rotation;
                    if (this.match(T_INTEGER)) {
                        time = Number(this.advance());
                    }
                }
            }
        }
        return new RPFReference(parent, p, x, y, rotation, time);
    }

    getUntilLineEnd(): string {
        let out: string[] = [];
        while (true) {
            let value = this.advance();
            if (value === EOF || value === '\n') {
                break;
            }
            out.push(value);
        }
        return out.join(' ');
    }

    patternMetadata(out: RPFPattern<T>): void {
        let type = this.advance();
        if (type === '#pasting') {
            throw new Error('fix #pasting');
        } else if (type === '#name') {
            out.name = this.getUntilLineEnd();
        } else if (type === '#desc') {
            out.desc = this.getUntilLineEnd().replaceAll('\\n', '\n').replaceAll('\\\\', '\\');
        } else if (type === '#periodic') {
            let dx = Number(this.eat(T_INTEGER)[0]);
            let dy = Number(this.eat(T_INTEGER)[0]);
            let period = Number(this.eat(T_APGCODE)[0]);
            out.periodic = {dx, dy, period};
            this.eat(T_NEWLINE);
        } else if (type === '#creates') {
            let times = this.eat([/^\d+(,\d+)*$/, 'comma-separated list of natural numbers'])[0].split(',').map(Number);
            out.creates = {ref: this.reference(out), times};
        } else if (type === '#conduit') {
            let recoveryTime = Number(this.eat(T_NATURAL_NUMBER)[0]);
            let useTimes = this.eat([/^(\d+,)*\d+\+$/, 'repeat time ranges'])[0].slice(0, -1).split(',').map(Number);
            let conduit: RPFPattern<T>['conduit'] = {
                recoveryTime,
                repeatTime: useTimes[useTimes.length - 1],
                overclock: useTimes.slice(0, -1),
                inputs: [],
                outputs: [],
            };
            while (true) {
                if (this.match('input') || this.match('output')) {
                    let type = this.advance() as 'input' | 'output';
                    let value = this.reference(out);
                    if (type === 'input') {
                        conduit.inputs.push(value);
                    } else {
                        conduit.outputs.push(value);
                    }
                } else if (this.match(T_NEWLINE)) {
                    break;
                } else {
                    this.error(`Expected 'input', 'output', or a newline`);
                }
            }
            out.conduit = conduit;
        } else if (type === '#envelope') {
            let x = Number(this.eat(T_INTEGER)[0]);
            let y = Number(this.eat(T_INTEGER)[0]);
            let p = IdentityPattern.loadApgcode(this.eat(T_APGCODE)[0]).shrinkToFit();
            out.setEnvelope(x, y, p);
        }
    }

    pattern(key?: string): RPFPattern<T> {
        let out = new RPFPattern<T>(this.file, key);
        while (!(this.match(T_RIGHT_BRACE) || this.match(T_EOF) || this.match(T_KEY_INDICATOR))) {
            if (this.match([/^#/, ''])) {
                this.patternMetadata(out);
                this.eat(T_NEWLINE);
            } else {
                out.add(this.reference(out));
                this.eat(T_NEWLINE);
            }
        }
        return out;
    }

    import(out: RPFFile<T>, fs: Directory) {
        this.eat(['*', 'star']);
        let rename: string | undefined = undefined;
        if (this.match('as')) {
            this.advance();
            rename = this.advance();
            if (!rename.match(/^[a-zA-Z_][a-zA-Z0-9]*$/)) {
                this.error(`Invalid characters in import rename: '${name}'`, -1);
            }
            if (rename === '__proto__') {
                this.error(`Import rename cannot be '__proto__'`, -1);
            }
        }
        this.eat(['from', `'from'`]);
        let specifier = this.getUntilLineEnd();
        if (!path.isAbsolute(specifier)) {
            specifier = path.join(path.dirname(out.path), specifier);
        }
        let value = fs.read(specifier);
        let rpf: RPFFile<T>;
        if (value instanceof Directory) {
            throw new RPFError(`Cannot import from '${specifier}' (is a directory)`);
        } else {
            rpf = value.getRPF() as RPFFile<T>;
        }
        if (rename === undefined) {
            out.starImports.push(rpf);
        } else {
            out.imports[rename] = rpf;
        }
    }

    parseFile(fs?: Directory): RPFFile<T> {
        let ruleTokens: string[] = [];
        while (!this.match(T_NEWLINE)) {
            ruleTokens.push(this.advance());
        }
        this.eat(T_NEWLINE);
        let base = createPattern(ruleTokens.join(' ')) as T;
        this.base = base;
        let out = new RPFFile(base, this.file.path);
        this.file = out;
        while (!this.match(T_KEY_INDICATOR, T_NEWLINE)) {
            this.expect(['import', 'import statement']);
            if (!fs) {
                throw new RPFError(`Import statement in RPF but no file system given`);
            }
            this.import(out, fs);
        }
        while (!this.match(T_EOF)) {
            let key = this.eat(T_KEY_INDICATOR)[0];
            if (key === '') {
                this.error(`Key cannot be empty`, -1);
            }
            if (key === '__proto__') {
                this.error(`Key cannot be '__proto__'`, -1);
            }
            if (key.match(/^[a-zA-Z_][a-zA-Z0-9]*$/)) {
                this.error(`Invalid characters in key: '${key}'`, -1);
            }
            this.eat(T_NEWLINE);
            out.data[key] = this.pattern(key);
        }
        this.expect(T_EOF);
        return out;
    }

}
