
import {Rect, Rule, Pattern, createPattern} from './core/index.js';


export class RPFError extends Error {};


export type Rotation = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';
const ROTATIONS: string[] = ['F', 'Fx', 'L', 'Lx', 'B', 'Bx', 'R', 'Rx'];

export const ROTATION_COMBINE: {[K in Rotation]: {[K in Rotation]: Rotation}} = {
    F: {F: 'F', Fx: 'Fx', L: 'L', Lx: 'Lx', B: 'B', Bx: 'Bx', R: 'R', Rx: 'Rx'},
    Fx: {F: 'Fx', Fx: 'F', L: 'Lx', Lx: 'L', B: 'Bx', Bx: 'B', R: 'Rx', Rx: 'R'},
    L: {F: 'L', Fx: 'Lx', L: 'B', Lx: 'Bx', B: 'R', Bx: 'Rx', R: 'F', Rx: 'Fx'},
    Lx: {F: 'Lx', Fx: 'L', L: 'Bx', Lx: 'B', B: 'Rx', Bx: 'R', R: 'Fx', Rx: 'F'},
    B: {F: 'B', Fx: 'Bx', L: 'R', Lx: 'Rx', B: 'F', Bx: 'Fx', R: 'L', Rx: 'Lx'},
    Bx: {F: 'Bx', Fx: 'B', L: 'Rx', Lx: 'R', B: 'Fx', Bx: 'F', R: 'Lx', Rx: 'L'},
    R: {F: 'R', Fx: 'Rx', L: 'F', Lx: 'Fx', B: 'L', Bx: 'Lx', R: 'B', Rx: 'Bx'},
    Rx: {F: 'Rx', Fx: 'R', L: 'Fx', Lx: 'F', B: 'Lx', Bx: 'L', R: 'Bx', Rx: 'B'},
};


function applyRotation<T extends Pattern>(p: T, rotation: Rotation): T {
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


interface RPFRect {
    x: number;
    y: number;
    p: {
        width: number;
        height: number;
    };
}

function isInside(x: number, y: number, value: RPFRect): boolean {
    return x >= value.x && y >= value.y && x < value.x + value.p.width && y < value.y + value.p.height;
}

function getOverlap(a: RPFRect, b: RPFRect): {overlap: boolean, x: number, y: number, minX: number, maxX: number, minY: number, maxY: number} {
    let minX = Math.max(a.x, b.x);
    let maxX = Math.min(a.x + a.p.width, b.x + b.p.width);
    let minY = Math.max(a.y, b.y);
    let maxY = Math.min(a.y + a.p.height, b.y + b.p.height);
    let x = maxX - minX;
    let y = maxY - minY;
    return {overlap: x < 0 || y < 0, x, y, minX, maxX, minY, maxY};
}


export function normalize(path: string): string {
    let out: string[] = [];
    for (let part of path.split('/')) {
        if (part === '' || part === '.') {
            continue;
        } else if (part === '..') {
            if (out.length === 0) {
                throw new Error(`Path goes back too far: '${path}'`);
            }
            out.pop();
        } else {
            out.push(part);
        }
    }
    return (path.startsWith('/') ? '/' : '') + out.join('/');
}

export function resolve(start: string, ...paths: string[]): string {
    let out = '';
    for (let i = paths.length - 1; i >= 0; i--) {
        out += '/' + paths[i];
        if (paths[i].startsWith('/')) {
            return out;
        }
    }
    return start + out;
}

export function join(...paths: string[]): string {
    return normalize(paths.join('/'));
}


export interface RPFObjectData<T extends Pattern = Pattern> {
    p: T | RPFPattern<T>;
    x: number;
    y: number;
    rotation: Rotation;
    time: number;
}

export class RPFPattern<T extends Pattern = Pattern> extends Pattern {

    base: T;
    key: string;
    path: string;
    data: Set<RPFObjectData>;
    // we set optional values to undefined so the V8 hidden classes are the same
    name?: string = undefined;
    minX: number;
    minY: number;
    height: number;
    width: number;
    xOffset: number = 0;
    yOffset: number = 0;
    generation: number = 0;
    population: number;
    rule: Rule;

    constructor(base: T, key: string, path: string, data: Set<RPFObjectData>) {
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
                this.minX = Math.min(this.minX, value.x);
                this.minY = Math.min(this.minY, value.y);
                let p = value.p.copy() as T;
                applyRotation(p, value.rotation);
                p.run(value.time);
                p.shrinkToFit();
                value.p = p;
                maxX = Math.max(maxX, value.x + p.width);
                maxY = Math.max(maxY, value.y + p.height);
                this.population += p.population;
            }
            this.height = maxY - this.minY;
            this.width = maxX - this.minX;
        } else {
            this.minX = 0;
            this.minY = 0;
            this.height = 0;
            this.width = 0;
            this.population = 0;
        }
        this.rule = base.rule;
    }

    toString(): string {
        let out: string[] = [`${this.key}:`];
        if (this.name) {
            out.push(`#name ${this.name}`);
        }
        for (let value of this.data) {
            let start = value.p instanceof RPFPattern ? value.p.key : '*' + value.p.toApgcode();
            if (value.time === 0) {
                if (value.rotation === 'F') {
                    if (value.x === 0 && value.y === 0) {
                        out.push(`${start}`);
                    } else {
                        out.push(`${start} ${value.x} ${value.y}`);
                    }
                } else {
                    out.push(`${start} ${value.x} ${value.y} ${value.rotation}`);
                }
            } else {
                out.push(`${start} ${value.x} ${value.y} ${value.rotation} ${value.time}`);
            }
        }
        return out.join('\n');
    }
 
    static fromString<T extends Pattern>(data: string, file: RPFFile<T>): RPFPattern<T> {
        let lines = data.split('\n');
        let key = lines[0].slice(0, -1);
        let out = new RPFPattern(file.base, key, join(file.path, key), new Set());
        for (let i = 1; i < lines.length; i++) {
            let line = lines[i];
            let parts = line.split(' ');
            if (parts[0].startsWith('#')) {
                if (parts[0] === '#name') {
                    out.name = parts.slice(1).join(' ');
                }
            } else {
                let p = parts[0].startsWith('*') ? file.base.loadApgcode(parts[0].slice(1)).shrinkToFit() as T : file.data[parts[0]];
                if (!p) {
                    throw new RPFError(`RPF object '${parts[0]}' was never defined`);
                }
                out.addObject({
                    p,
                    x: parts[1] === undefined ? 0 : Number(parts[1]),
                    y: parts[2] === undefined ? 0 : Number(parts[2]),
                    rotation: parts[3] === undefined ? 'F' : parts[3] as Rotation,
                    time: parts[4] === undefined ? 0 : Number(parts[4]),
                });
            }
        }
        return out;
    }

    addObject(obj: RPFObjectData<T>): this {
        if (this.data.has(obj)) {
            return this;
        }
        this.data.add(obj);
        this.population += obj.p.population;
        this.width = Math.max(this.minX + this.width, obj.x + obj.p.width) - this.minX;
        this.height = Math.max(this.minY + this.height, obj.y + obj.p.height) - this.minY;
        this.minX = Math.min(this.minX, obj.x);
        this.minY = Math.min(this.minY, obj.y);
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
            this.minX = Math.min(this.minX, value.x);
            this.minY = Math.min(this.minY, value.y);
            if (recursive && value.p instanceof RPFPattern) {
                value.p.recomputeSizes();
            }
            let p = value.p.copy() as T;
            applyRotation(p, value.rotation);
            p.run(value.time);
            p.shrinkToFit();
            value.p = p;
            maxX = Math.max(maxX, value.x + p.width);
            maxY = Math.max(maxY, value.y + p.height);
            this.population += p.population;
        }
        this.height = maxY - this.minY;
        this.width = maxX - this.minX;
        return this;
    }

    setKey(key: string): this {
        this.key = key;
        this.path = join(this.path.slice(0, this.path.lastIndexOf('/')), key);
        return this;
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

    assignMetadata(p: RPFPattern<T>): void {
        p.name = this.name;
    }

    copy(): RPFPattern<T> {
        let data = new Set<RPFObjectData>();
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
        this.assignMetadata(out);
        return out;
    }

    deepCopy(): RPFPattern<T> {
        let data = new Set<RPFObjectData>();
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
        this.assignMetadata(out);
        return out;
    }

    clearedCopy(): RPFPattern<T> {
        let out = new RPFPattern(this.base, this.key, this.path, new Set());
        this.assignMetadata(out);
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
        return {
            base: this.base,
            path: this.path.slice(0, this.path.lastIndexOf('/')),
            data,
        };
    }

}


export interface RPFFile<T extends Pattern = Pattern> {
    base: T;
    path: string;
    data: {[key: string]: RPFPattern<T>};
}

export function rpfToString<T extends Pattern>(file: RPFFile<T>): string {
    let map = new Map<string, Set<string>>();
    for (let key in file.data) {
        let value = new Set<string>();
        for (let item of file.data[key].data) {
            if (item.p instanceof RPFPattern) {
                if (item.p.key in file.data) {
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
            throw new RPFError('Cycle detected while serializing RPF');
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
    let out = `\n${file.base.rule.str}\n`;
    for (let layer of layers) {
        for (let key of layer.sort()) {
            out += '\n' + file.data[key].toString() + '\n';
        }
    }
    return out;
}

export function parseRPF<T extends Pattern = Pattern>(data: string, basePath: string): RPFFile<T> {
    let groups: string[] = [];
    let currentGroup: string[] = [];
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line === '') {
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
    let base = createPattern(groups[0]) as T;
    let out: RPFFile<T> = {
        base,
        path: basePath,
        data: {},
    };
    for (let i = 1; i < groups.length; i++) {
        let p = RPFPattern.fromString(groups[i], out);
        out.data[p.key] = p;
    }
    return out;
}
