
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {MAPPattern} from '../core/index.js';
import {c, SalvoInfo, base} from './base.js';
import {createSalvoPattern, get1GSalvos} from './slow_salvos.js';


function testObject(p: MAPPattern, obj: MAPPattern, x: number, y: number): false | MAPPattern {
    p = p.copy();
    p.insert(obj, x, y);
    let q = p.copy();
    q.runGeneration();
    if (p.isEqual(q)) {
        return p;
    } else {
        return false;
    }
}

function getRandomObject(height: number, width: number, objects: MAPPattern[], count: number): string {
    let p = base.copy();
    p.height = height;
    p.width = width;
    p.size = height * width;
    for (let i = 0; i < count; i++) {
        let found = false;
        for (let j = 0; j < 1000; j++) {
            let obj = objects[Math.floor(Math.random() * objects.length)];
            let x = Math.floor(Math.random() * objects.length);
            let y = Math.floor(Math.random() * objects.length);
            let q = testObject(p, obj, x, y);
            if (q) {
                p = q;
                found = true;
                break;
            }
        }
        if (!found) {
            return getRandomObject(height, width, objects, count);
        }
    }
    return 'x_' + p.toApgcode();
}

function getAllObjects(height: number, width: number, objects: MAPPattern[], count: number, recursive: boolean = false, p?: MAPPattern): string[] {
    if (!p) {
        p = base.copy();
        p.height = height;
        p.width = width;
        p.size = height * width;
    }
    let out: string[] = [];
    for (let obj of objects) {
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let q = testObject(p, obj, x, y);
                if (q) {
                    if (count === 1) {
                        out.push('x_' + q.toApgcode());
                    } else {
                        out.push(...getAllObjects(height, width, objects, count - 1, true, q));
                    }
                }
            }
        }
    }
    return out;
}

function normalizeObjects(objs: string[]): MAPPattern[] {
    let out = new Set<string>();
    for (let obj of objs) {
        let p = base.loadApgcode(obj.slice(obj.indexOf('_') + 1));
        let prefix = 'xs' + p.population;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 5; j++) {
                p.rotateLeft();
                out.add(p.toApgcode(prefix));
            }
            p.flipHorizontal();
        }
    }
    return Array.from(out).map(code => {
        let p = base.loadApgcode(code);
        p.shrinkToFit();
        p.xOffset = 0;
        p.yOffset = 0;
        return p;
    });
}

async function getStillLifes(lssPath: string, height: number, width: number, strictHeight?: boolean, strictWidth?: boolean): Promise<string[]> {
    let start = performance.now();
    let cmd = `${lssPath}/venv/bin/python3 ${lssPath}/lss.py -r '${c.RULE}' slenum ${width} ${height}`;
    let data = execSync(cmd, {maxBuffer: 2**31}).toString();
    console.log(`LSS complete in ${((performance.now() - start) / 1000).toFixed(3)} seconds!`);
    let patterns: MAPPattern[] = [];
    let currentRLE = '';
    for (let line of data.split('\n')) {
        if ('bo0123456789$!'.includes(line[0])) {
            currentRLE += line;
        } else if (line.startsWith('x')) {
            if (currentRLE.length > 0) {
                let p = base.loadRLE(currentRLE);
                patterns.push(p);
                currentRLE = '';
            }
        } else {
            continue;
        }
    }
    if (currentRLE.length > 0) {
        patterns.push(base.loadRLE(currentRLE));
    }
    console.log(`${patterns.length} RLEs loaded, normalizing patterns`);
    let out = new Set<string>();
    let lastUpdate = performance.now() / 1000;
    for (let i = 0; i < patterns.length; i++) {
        let p = patterns[i];
        p.shrinkToFit();
        p.xOffset = 0;
        p.yOffset = 0;
        if ((strictHeight && p.height !== height) || (strictWidth && p.width !== width)) {
            continue;
        }
        let prefix = `xs${p.population}`;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 4; j++) {
                p.rotateLeft();
                let value = p.toApgcode(prefix);
                let flipped = p.copy().flipDiagonal().toApgcode(prefix);
                if (!(out.has(value) || out.has(flipped))) {
                    if (p.height > p.width) {
                        out.add(flipped);
                    } else {
                        out.add(value);
                    }
                }
            }
            p.flipHorizontal();
        }
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${i}/${patterns.length} (${((i) / patterns.length * 100).toFixed(3)}%) patterns normalized`);
            lastUpdate = now;
        }
    }
    return Array.from(out);
}


let info: SalvoInfo = {startObject: '', gliderSpacing: 0, period: 1, intermediateObjects: [], laneLimit: 256};

const FILE = 'out.txt';

export async function searchConduits(lssPath: string, height: number, width: number, objects?: [string[], number], noEater?: boolean, strictHeight?: boolean, strictWidth?: boolean): Promise<void> {
    console.log('Getting objects');
    let start = performance.now() / 1000;
    let sls: string[];
    if (objects) {
        sls = getAllObjects(height, width, normalizeObjects(objects[0]), objects[1]);
    } else {
        sls = await getStillLifes(lssPath, height, width, strictHeight, strictWidth);
    }
    console.log(`Checking ${sls.length} objects (took ${(performance.now() / 1000 - start).toFixed(3)} seconds to get objects)`);
    start = performance.now() / 1000;
    let lastUpdate = start;
    let prevCount = 0;
    let wasEmpty: boolean;
    if (existsSync(FILE)) {
        wasEmpty = (await fs.readFile(FILE)).toString().trim().length === 0;
    } else {
        wasEmpty = true;
    }
    await fs.appendFile(FILE, `${!wasEmpty ? '\n' : ''}\n${height}x${width} ${objects ? `objects search with ${objects.join(', ')}` : 'search'} in ${c.RULE}:\n`);
    for (let i = 0; i < sls.length; i++) {
        let code = sls[i];
        let data = get1GSalvos(info, code, 0, true);
        if (data) {
            for (let [lane, timing, result] of data[1]) {
                if (typeof result === 'string') {
                    if (noEater && result === 'eater') {
                        continue;
                    }
                    let rle = createSalvoPattern(info, code.slice(code.indexOf('_') + 1), [[lane, timing]]).toRLE();
                    result = result[0].toUpperCase() + result.slice(1);
                    let msg = `\n${result} (${code}, ${lane}):\n${rle}\n`;
                    await fs.appendFile(FILE, msg);
                    if (!result.startsWith('Eater')) {
                        console.log(`\x1b[${result.toLowerCase().includes('failed') ? '94' : '92'}m${result} detected (${code}, ${lane}):\n${rle}\x1b[0m`);
                    }
                }
            }
        }
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${i}/${sls.length} (${((i) / sls.length * 100).toFixed(3)}%) complete (${((i - prevCount) / (now - lastUpdate)).toFixed(3)} per second current, ${(i / (now - start)).toFixed(3)} overall)`);
            lastUpdate = now;
            prevCount = i;
        }
    }
    console.log(`Search complete in ${(performance.now() / 1000 - start).toFixed(3)} seconds`);
}

export async function searchConduitsRandom(height: number, width: number, objects: string[], count: number, noEater?: boolean): Promise<void> {
    let sls = normalizeObjects(objects);
    let start = performance.now() / 1000;
    let lastUpdate = start;
    let prevCount = 0;
    let wasEmpty: boolean;
    if (existsSync(FILE)) {
        wasEmpty = (await fs.readFile(FILE)).toString().trim().length === 0;
    } else {
        wasEmpty = true;
    }
    await fs.appendFile(FILE, `${!wasEmpty ? '\n' : ''}\n${height}x${width} random search with ${objects.join(', ')} in ${c.RULE}:\n`);
    let totalSearched = 0;
    while (true) {
        for (let code of getRandomObject(height, width, sls, count)) {
            let data = get1GSalvos(info, code, 0, true);
            if (data) {
                for (let [lane, timing, result] of data[1]) {
                    if (typeof result === 'string') {
                        if (noEater && result === 'eater') {
                            continue;
                        }
                        let rle = createSalvoPattern(info, code.slice(code.indexOf('_') + 1), [[lane, timing]]).toRLE();
                        result = result[0].toUpperCase() + result.slice(1);
                        let msg = `\n${result} (${code}, ${lane}):\n${rle}\n`;
                        await fs.appendFile(FILE, msg);
                        if (!result.startsWith('Eater')) {
                            console.log(`\x1b[${result.toLowerCase().includes('failed') ? '94' : '92'}m${result} detected (${code}, ${lane}):\n${rle}\x1b[0m`);
                        }
                    }
                }
            }
        }
        totalSearched++;
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${totalSearched} objects checked (${((totalSearched - prevCount) / (now - lastUpdate)).toFixed(3)} per second current, ${(totalSearched / (now - start)).toFixed(3)} overall)`);
            lastUpdate = now;
            prevCount = totalSearched;
        }
    }
}
