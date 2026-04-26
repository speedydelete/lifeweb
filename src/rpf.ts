
import {Pattern, createPattern} from './core/index.js';


export type Rotation = 'F' | 'Fx' | 'L' | 'Lx' | 'B' | 'Bx' | 'R' | 'Rx';
const ROTATIONS: string[] = ['F', 'Fx', 'L', 'Lx', 'B', 'Bx', 'R', 'Rx'];

export interface RPF<T extends Pattern = Pattern> {
    key: string;
    path: string;
    name?: string;
    data: ({
        value: [false, T] | [true, RPF<T>];
        x: number;
        y: number;
        rotation: Rotation;
        time: number;
    })[];
}

export interface RPFFile<T extends Pattern = Pattern> {
    base: T;
    data: {[key: string]: RPF<T>};
}


function applyRotation<T extends Pattern>(p: T, rotation: Rotation): T {
    if (rotation.endsWith('x')) {
        p.flipVertical();
    }
    if (rotation[0] === 'F') {
        return p;
    } else if (rotation[0] === 'L') {
        return p.rotateLeft();
    } else if (rotation[0] === 'B') {
        return p.rotate180();
    } else {
        return p.rotateRight();
    }
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


export class RPFFileError extends Error {};

export function rpfToString(file: RPFFile): string {
    let map = new Map<string, Set<string>>();
    for (let key in file.data) {
        let value = new Set<string>();
        for (let item of file.data[key].data) {
            if (item.value[0]) {
                let path = item.value[1].path;
                if (path in file.data) {
                    value.add(item.value[1].path);
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
            throw new RPFFileError('Cycle detected while serializing RPF');
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
            let rpf = file.data[key];
            out += `\n${key}:\n`;
            if (rpf.name) {
                out += `#name ${rpf.name}\n`;
            }
            for (let value of rpf.data) {
                let start = value.value[0] ? value.value[1].key : value.value[1].toRLE(false);
                if (value.time === 0) {
                    if (value.rotation === 'F') {
                        if (value.x === 0 && value.y === 0) {
                            out += `${start}\n`;
                        } else {
                            out += `${start} ${value.x} ${value.y}\n`;
                        }
                    } else {
                        out += `${start} ${value.x} ${value.y} ${value.rotation}\n`;
                    }
                } else {
                    out += `${start} ${value.x} ${value.y} ${value.rotation} ${value.time}\n`;
                }
            }
        }
    }
    return out;
}

export function parseRPF<T extends Pattern = Pattern>(data: string, basePath: string): RPFFile<T> {
    let groups: string[][] = [];
    let currentGroup: string[] = [];
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line === '') {
            continue;
        }
        if (line.endsWith(':')) {
            groups.push(currentGroup);
            currentGroup = [line];
        } else {
            currentGroup.push(line);
        }
    }
    groups.push(currentGroup);
    let base: T | undefined;
    for (let line of groups[0]) {
        if (line.startsWith('#')) {
            let parts = line.split(' ');
            if (parts[0] === '#rule') {
                base = createPattern(parts.slice(1).join(' ')) as T;
            } else {
                throw new RPFFileError(`Invalid RPF header line: '${line}'`);
            }
        } else {
            throw new RPFFileError(`Invalid RPF header line: '${line}'`);
        }
    }
    if (!base) {
        throw new RPFFileError(`No #rule line found in RPF!`);
    }
    let out: RPFFile<T> = {
        base,
        data: {},
    };
    for (let i = 1; i < groups.length; i++) {
        let group = groups[i];
        let key = group[0].slice(0, -1);
        let rpf: RPF<T> = {
            key,
            path: join(key, basePath),
            data: [],
        };
        for (let i = 1; i < group.length; i++) {
            let line = group[i];
            let parts = line.split(' ');
            if (parts[0].startsWith('#')) {
                if (parts[0] === '#name') {
                    rpf.name = parts.slice(1).join(' ');
                }
            } else {
                let value = parts[0].endsWith('!') ? [false, base.loadRLE(parts[0]) as T] as [false, T] : [true, out.data[parts[0]]] as [true, RPF<T>];
                if (!value[1]) {
                    throw new RPFFileError(`RPF object '${parts[0]}' was never defined`);
                }
                rpf.data.push({
                    value,
                    x: parts[1] === undefined ? 0 : Number(parts[1]),
                    y: parts[2] === undefined ? 0 : Number(parts[2]),
                    rotation: parts[3] === undefined ? 'F' : parts[3] as Rotation,
                    time: parts[4] === undefined ? 0 : Number(parts[4]),
                });
            }
        }
        out.data[key] = rpf;
    }
    return out;
}

import {inspect} from 'node:util';

export function rpfToPattern<T extends Pattern>(file: RPFFile<T>, rpf?: RPF<T>): T {
    if (!rpf) {
        rpf = file.data['main'];
        if (!rpf) {
            throw new RPFFileError(`Missing main object in RPF file`);
        }
    }
    let xOffset = 0;
    let yOffset = 0;
    let maxX = 0;
    let maxY = 0;
    let patterns: T[] = [];
    for (let value of rpf.data) {
        let p: T;
        if (value.value[0]) {
            p = rpfToPattern(file, value.value[1]);
        } else {
            p = value.value[1].clearedCopy() as T;
        }
        applyRotation(p, value.rotation);
        p.run(value.time);
        p.shrinkToFit();
        p.xOffset = value.x;
        p.yOffset = value.y;
        xOffset = Math.min(xOffset, value.x);
        yOffset = Math.min(yOffset, value.y);
        maxX = Math.max(maxX, value.x + p.width);
        maxY = Math.max(maxY, value.y + p.height);
        patterns.push(p);
    }
    throw new Error('```\n\n```ansi\n' + inspect({xOffset, yOffset, maxX, maxY, patterns}, {colors: true, depth: Infinity}) + '```');
    let width = maxX - xOffset + 1;
    let height = maxY - yOffset + 1;
    let p = file.base.clearedCopy() as T;
    p.ensure(width, height);
    p.xOffset = xOffset;
    p.yOffset = yOffset;
    for (let q of patterns) {
        p.insert(q, q.xOffset, q.yOffset);
    }
    return p;
}
