
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {gcd, MAPPattern} from '../core/index.js';
import {c, SalvoInfo, maxGenerations, base, CAObject, gliderPattern} from './base.js';
import {ForCombining, combineStableObjects, separateObjectsPartial, separateObjects, stabilize} from './runner.js';
import {createSalvoPattern} from './slow_salvos.js';


let info: SalvoInfo = {startObject: '', gliderSpacing: 0, period: 1, intermediateObjects: [], laneLimit: 256};


function getCollision(code: string, lane: number): false | 'no collision' | 'no' | 'linear' | [CAObject[], ForCombining[]] {
    let inc = c.GLIDER_POPULATION_PERIOD;
    if (code.startsWith('xp')) {
        let period = parseInt(code.slice(2));
        inc = inc * period / gcd(inc, period);
    }
    let p = gliderPattern.copy();
    let q = base.loadApgcode(code.slice(code.indexOf('_') + 1)).shrinkToFit();
    let yPos = c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) + c.LANE_OFFSET - lane;
    p.ensure(q.width + xPos, q.height + yPos);
    p.insert(q, xPos, yPos);
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    let prevPop = p.population;
    for (let i = 0; i < c.MAX_WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            if (i === 0) {
                return 'no';
            }
            p.generation = 0;
            let period = stabilize(p);
            if (period === 'linear') {
                return 'linear';
            } else if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
                return false;
            }
            p.shrinkToFit();
            let out = separateObjectsPartial(p, period * 4, period * 4);
            if (typeof out === 'object') {
                for (let obj of out[0]) {
                    if (obj.type === 'osc') {
                        obj.timing %= parseInt(obj.code.slice(2));
                    }
                }
                for (let obj of out[1]) {
                    if (obj.type === 'osc') {
                        obj.timing %= parseInt(obj.code.slice(2));
                    }
                }
            }
            return out;
        }
        prevPop = pop;
    }
    return 'no collision';
}

function checkObject(code: string): false | [number, string][] {
    let index = code.indexOf('_');
    let prefix = code.slice(0, index);
    let codePattern = base.loadApgcode(code.slice(index + 1));
    let codeObjs = separateObjects(codePattern, 2, 2, false);
    if (!codeObjs || !codeObjs.every(x => x.type === 'sl')) {
        console.log(`Not a still life: '${code}'`);
        return false;
    }
    let canonical = codePattern.toCanonicalApgcode(prefix.startsWith('xs') ? 1 : parseInt(prefix.slice(2)), prefix);
    let lane = 0;
    let data = getCollision(code, lane);
    if (data === 'no') {
        return false;
    }
    while (data !== 'no collision') {
        lane--;
        data = getCollision(code, lane);
        if (data === 'no') {
            return false;
        }
        if (lane === -info.laneLimit) {
            return false;
        }
    }
    lane--;
    data = getCollision(code, lane);
    if (data === 'no') {
        return false;
    }
    while (data !== 'no collision') {
        lane--;
        data = getCollision(code, lane);
        if (data === 'no') {
            return false;
        }
        if (lane === -info.laneLimit) {
            return false;
        }
    }
    lane++;
    let failed = false;
    let out: [number, string][] = [];
    let hadCollision = false;
    for (; lane < info.laneLimit; lane++) {
        let data = getCollision(code, lane);
        if (data === 'no') {
            return out;
        }
        if (data === 'linear') {
            out.push([lane, 'linear']);
            continue;
        } else if (data === 'no collision') {
            if (!hadCollision) {
                continue;
            }
            if (failed) {
                break;
            } else {
                failed = true;
                continue;
            }
        } else if (data) {
            let [ships, stables] = data;
            if (!ships.every(x => x.type === 'ship')) {
                continue;
            }
            let combined = combineStableObjects(stables);
            if (!combined) {
                continue;
            }
            let obj: CAObject | undefined;
            for (let x of combined) {
                let index = x.code.indexOf('_');
                let prefix = x.code.slice(0, index);
                let data = x.code.slice(index + 1);
                let period: number;
                if (x.type === 'sl') {
                    period = 1;
                } else if (x.type === 'osc') {
                    period = parseInt(prefix.slice(2));
                } else {
                    continue;
                }
                let code = base.loadApgcode(data).toCanonicalApgcode(period, prefix);
                if (code === canonical) {
                    obj = x;
                    break;
                }
            }
            if (obj) {
                if (obj.code === code && obj.x === 0 && obj.y === 0) {
                    if (combined.length === 1) {
                        if (ships.length === 0) {
                            out.push([lane, 'eater']);
                        } else if (ships.length === 1) {
                            out.push([lane, 'reflector']);
                        } else {
                            out.push([lane, 'splitter']);
                        }        
                    } else if (combined.length === 2 && ships.length === 0) {
                        out.push([lane, 'factory']);
                    }
                } else if (combined.length === 1 && ships.length > 0) {
                    if (obj.code === code) {
                        out.push([lane, 'possible crawler']);
                    } else {
                        if (ships.length === 1) {
                            out.push([lane, 'failed reflector']);
                        } else {
                            out.push([lane, 'failed splitter']);
                        }
                    }
                } else if (combined.length === 2 && ships.length === 0) {
                    out.push([lane, 'failed factory']);
                }
            } else if (stables.length > codeObjs.length) {
                let found = true;
                for (let obj of codeObjs) {
                    if (!stables.some(x => x.type === obj.type && x.code === obj.code && x.x === obj.x && x.y === obj.y)) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    out.push([lane, 'factory']);
                }
            }
        }
        if (!hadCollision) {
            hadCollision = true;
        }
        failed = false;
        if (lane === info.laneLimit - 1) {
            return false;
        }
    }
    return out;
}


function testObject(p: MAPPattern, obj: MAPPattern, x: number, y: number): false | MAPPattern {
    p = p.copy();
    let oldPop = p.population;
    p.insert(obj, x, y);
    if (p.population !== oldPop + obj.population) {
        return false;
    }
    let q = p.copy();
    q.runGeneration();
    if (p.isEqual(q)) {
        return p;
    } else {
        return false;
    }
}

function getRandomObject(height: number, width: number, objects: MAPPattern[], count: number, retries: number = 0): false | string[] {
    let p = base.copy();
    p.height = height;
    p.width = width;
    p.size = height * width;
    p.data = new Uint8Array(p.size);
    for (let i = 0; i < count; i++) {
        let found = false;
        for (let j = 0; j < 1024; j++) {
            let obj = objects[Math.floor(Math.random() * objects.length)];
            let x = Math.floor(Math.random() * (width - obj.width + 1));
            let y = Math.floor(Math.random() * (height - obj.height + 1));
            let q = testObject(p, obj, x, y);
            if (q) {
                p = q;
                found = true;
                break;
            }
        }
        if (!found) {
            if (retries === 512) {
                return false;
            }
            return getRandomObject(height, width, objects, count, retries + 1);
        }
    }
    p.shrinkToFit();
    p.xOffset = 0;
    p.yOffset = 0;
    return Array.from(expandObjects(p)).sort();
}

function getAllObjects(height: number, width: number, objects: MAPPattern[], count: number, p?: MAPPattern): MAPPattern[] {
    if (!p) {
        p = base.copy();
        p.height = height;
        p.width = width;
        p.size = height * width;
        p.data = new Uint8Array(p.size);
    }
    let out: MAPPattern[] = [];
    for (let obj of objects) {
        for (let y = 0; y < height; y++) {
            if (y + obj.height > height) {
                break;
            }
            for (let x = 0; x < width; x++) {
                if (x + obj.width > width) {
                    break;
                }
                let q = testObject(p, obj, x, y);
                if (q) {
                    let r = q.copy();
                    r.shrinkToFit();
                    r.xOffset = 0;
                    r.yOffset = 0;
                    out.push(r);
                    if (count > 1) {
                        out.push(...getAllObjects(height, width, objects, count - 1, q));
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
        p.shrinkToFit();
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 5; j++) {
                p.rotateLeft();
                out.add(p.toApgcode());
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

function expandObjects(p: MAPPattern, out: Set<string> = new Set()): Set<string> {
    let prefix = `xs${p.population}`;
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 4; j++) {
            p.rotateLeft();
            let value = p.toApgcode(prefix);
            if (c.GLIDER_IS_GLIDE_SYMMETRIC) {
                let flipped = c.GLIDER_SLOPE === 1 ? p.copy().flipDiagonal().toApgcode(prefix) : p.copy().flipHorizontal().toApgcode(prefix);
                if (!(out.has(value) || out.has(flipped))) {
                    if (c.GLIDER_SLOPE === 1 && p.height > p.width) {
                        out.add(flipped);
                    } else {
                        out.add(value);
                    }
                }
            } else {
                out.add(value);
            }
        }
        p.flipHorizontal();
    }
    return out;
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
        expandObjects(p, out);
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${i}/${patterns.length} (${((i) / patterns.length * 100).toFixed(3)}%) patterns normalized`);
            lastUpdate = now;
        }
    }
    return Array.from(out).sort();
}


const FILE = 'out.txt';

export async function searchConduits(lssPath: string, height: number, width: number, objects?: [string[], number], noEater?: boolean, strictHeight?: boolean, strictWidth?: boolean): Promise<void> {
    console.log('Getting objects');
    let start = performance.now() / 1000;
    let sls: string[];
    if (objects) {
        let set = new Set<string>();
        for (let p of getAllObjects(height, width, normalizeObjects(objects[0]), objects[1])) {
            expandObjects(p, set);
        }
        sls = Array.from(set).sort();
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
    await fs.appendFile(FILE, `${!wasEmpty ? '\n' : ''}\n${height}x${width} ${objects ? `objects search with up to ${objects[1]} objects picked from '${objects[0].join(', ')} and` : 'search with'} max generations ${maxGenerations} in ${c.RULE}:\n`);
    for (let i = 0; i < sls.length; i++) {
        let code = sls[i];
        let data = checkObject(code);
        if (data) {
            for (let [lane, result] of data) {
                if (noEater && result === 'eater') {
                    continue;
                }
                let rle = createSalvoPattern(info, code.slice(code.indexOf('_') + 1), [[lane, 0]]).toRLE();
                result = result[0].toUpperCase() + result.slice(1);
                let msg = `\n${result} (${code}, ${lane}):\n${rle}\n`;
                await fs.appendFile(FILE, msg);
                if (!result.startsWith('Eater')) {
                    console.log(`\x1b[${result.toLowerCase().includes('failed') ? '94' : '92'}m${result} detected (${code}, ${lane}):\n${rle}\x1b[0m`);
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
    await fs.appendFile(FILE, `${!wasEmpty ? '\n' : ''}\n${height}x${width} random search with up to ${count} objects picked from '${objects.join(', ')} and max generations ${maxGenerations} in ${c.RULE}:\n`);
    let totalSearched = 0;
    while (true) {
        let data = getRandomObject(height, width, sls, count);
        if (!data) {
            console.log('\x1b[91mSkipped\x1b[0m');
            continue;
        }
        for (let code of data) {
            let data = checkObject(code);
            if (data) {
                for (let [lane, result] of data) {
                    if (noEater && result === 'eater') {
                        continue;
                    }
                    let rle = createSalvoPattern(info, code.slice(code.indexOf('_') + 1), [[lane, 0]]).toRLE();
                    result = result[0].toUpperCase() + result.slice(1);
                    let msg = `\n${result} (${code}, ${lane}):\n${rle}\n`;
                    await fs.appendFile(FILE, msg);
                    if (!result.startsWith('Eater')) {
                        console.log(`\x1b[${result.toLowerCase().includes('failed') ? '94' : '92'}m${result} detected (${code}, ${lane}):\n${rle}\x1b[0m`);
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
