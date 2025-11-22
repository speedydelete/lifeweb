
import {MAPPattern, createPattern, INTSeparator, getKnots, identify} from './index.js';


const OFFSET = 5;
const MAX_PSEUDO_DISTANCE = 6;


let base = createPattern('B2-ak5j/S12-k') as MAPPattern;
let knots = getKnots(base.trs);


interface Salvo {
    lanes: [number, boolean][];
    target: string;
}

function createConfiguration(s: Salvo): MAPPattern {
    let p = base.copy();
    for (let i = 0; i < s.lanes.length; i++) {
        let [lane, isW] = s.lanes[i];
        let y = i * 20;
        let x = y + lane;
        if (x < 0 || y < 0) {
            p.ensure(x, y);
        }
        if (isW) {
            p.ensure(x + 4, y + 4);
            p.set(x, y, 1);
            p.set(x + 1, y, 1);
            p.set(x, y + 1, 1);
            p.set(x + 1, y + 1, 1);
            p.set(x + 2, y + 2, 1);
            p.set(x, y + 3, 1);
            p.set(x + 1, y + 3, 1);
        } else {
            p.ensure(x + 3, y + 2);
            p.set(x + 2, y, 1);
            p.set(x, y + 1, 1);
            p.set(x + 1, y + 1, 1);
        }
    }
    let target = base.loadApgcode(s.target).shrinkToFit();
    let yPos = s.lanes.length * 20;
    let xPos = yPos + target.height + OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    return p;
}


type CAObject = {x: number, y: number, w: number, h: number, p: MAPPattern} & ({isShip: false, code: string} | {isShip: true, isW: boolean, dir: 'nw' | 'ne' | 'sw' | 'se', t: number});

function distance(a: CAObject, b: CAObject): number {
    return Math.max(0, Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w))) + Math.max(0, Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h)));
}

function findOutcome(s: Salvo): false | null | CAObject[] {
    let p = createConfiguration(s);
    let found = false;
    if (s.lanes.some(x => x[1])) {
        let prevPop2 = p.population;
        p.runGeneration();
        let prevPop = p.population;
        for (let i = 0; i < s.lanes.length * 192; i++) {
            p.runGeneration();
            let pop = p.population;
            if (pop !== prevPop2) {
                found = true;
                break;
            }
            prevPop2 = prevPop;
            prevPop = pop;
        }
    } else {
        let prevPop = p.population;
        for (let i = 0; i < s.lanes.length * 192; i++) {
            p.runGeneration();
            let pop = p.population;
            if (pop !== prevPop) {
                found = true;
                break;
            }
            prevPop = pop;
        }
    }
    if (!found) {
        return null;
    }
    let pops: number[] = [];
    found = false;
    for (let i = 0; i < 256; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pops.slice(-16).every(x => x === pop)) {
            found = true;
        }
        pops.push(pop);
    }
    if (!found) {
        for (let i = pops.length - 64; i < pops.length - 4; i++) {
            if (pops[i] !== pops[i + 2]) {
                return false;
            }
        }
    }
    p.run(60);
    p.shrinkToFit();
    p.xOffset -= s.lanes.length * 20 + base.loadApgcode(s.target).height + OFFSET;
    p.yOffset -= s.lanes.length * 20;
    let sep = new INTSeparator(p, knots);
    sep.runGeneration();
    sep.resolveKnots();
    let objs: CAObject[] = [];
    let out: CAObject[] = [];
    for (let p of sep.getObjects()) {
        if (p.isEmpty()) {
            return false;
        }
        p.shrinkToFit();
        let start = p.copy();
        p.runGeneration();
        p.shrinkToFit();
        if (p.isEqual(start)) {
            let code = p.toApgcode('xs' + p.population);
            objs.push({
                isShip: false,
                code,
                x: p.xOffset,
                y: p.yOffset,
                w: p.width,
                h: p.height,
                p,
            });
        } else {
            let type = identify(p, 4);
            if (type.apgcode === 'xq4_15') {
                let dir: 'nw' | 'ne' | 'sw' | 'se' | null = null;
                if (p.width === 2 && p.height === 3) {
                    if (p.data[1] && p.data[2] && p.data[4]) {
                        dir = 'nw';
                        p.run(2);
                    } else if (p.data[0] && p.data[1] && p.data[4]) {
                        dir = 'nw';
                        p.run(1);
                    } else if (p.data[0] && p.data[3] && p.data[5]) {
                        dir = 'ne';
                        p.run(2);
                    } else if (p.data[0] && p.data[1] && p.data[5]) {
                        dir = 'ne';
                        p.run(1);
                    } else if (p.data[0] && p.data[2] && p.data[5]) {
                        dir = 'sw';
                        p.run(2);
                    } else if (p.data[0] && p.data[4] && p.data[5]) {
                        dir = 'sw';
                        p.run(1);
                    } else if (p.data[1] && p.data[3] && p.data[4]) {
                        dir = 'se';
                        p.run(2);
                    } else if (p.data[1] && p.data[4] && p.data[5]) {
                        dir = 'se';
                        p.run(1);
                    }
                } else if (p.width === 3 && p.height === 2) {
                    if (p.data[1] && p.data[2] && p.data[3]) {
                        dir = 'nw';
                    } else if (p.data[0] && p.data[2] && p.data[3]) {
                        dir = 'nw';
                        p.run(3);
                    } else if (p.data[0] && p.data[1] && p.data[5]) {
                        dir = 'ne';
                    } else if (p.data[0] && p.data[2] && p.data[5]) {
                        dir = 'ne';
                        p.run(3);
                    } else if (p.data[0] && p.data[4] && p.data[5]) {
                        dir = 'sw';
                    } else if (p.data[0] && p.data[3] && p.data[5]) {
                        dir = 'sw';
                        p.run(3);
                    } else if (p.data[2] && p.data[3] && p.data[4]) {
                        dir = 'se';
                    } else if (p.data[2] && p.data[3] && p.data[5]) {
                        dir = 'se';
                        p.run(3);
                    }
                }
                if (!dir) {
                    throw new Error(`Invalid glider:\n${p.toRLE()}`);
                }
                out.push({
                    isShip: true,
                    isW: false,
                    x: p.xOffset,
                    y: p.yOffset,
                    dir,
                    w: 3,
                    h: 2,
                    p,
                    t: p.generation,
                });
            } else if (type.apgcode === 'xq4_59') {
                if (p.population !== 4) {
                    p.runGeneration();
                }
                p.shrinkToFit();
                let dir: 'nw' | 'ne' | 'sw' | 'se';
                if (p.width !== 2 || p.height !== 4) {
                    p.run(2).shrinkToFit();
                    if (p.width !== 2 || p.height !== 4) {
                        throw new Error(`Invalid wider:\n${p.toRLE()}`);
                    }
                }
                if (p.data[0] && p.data[1] && p.data[4] && p.data[7]) {
                    dir = 'nw';
                } else if (p.data[0] && p.data[1] && p.data[5] && p.data[6]) {
                    dir = 'ne';
                } else if (p.data[1] && p.data[2] && p.data[6] && p.data[7]) {
                    dir = 'sw';
                } else if (p.data[0] && p.data[3] && p.data[6] && p.data[7]) {
                    dir = 'se';
                } else {
                    throw new Error(`Invalid wider:\n${p.toRLE()}`);
                }
                p.runGeneration();
                out.push({
                    isShip: true,
                    isW: true,
                    x: p.xOffset,
                    y: p.yOffset,
                    dir,
                    w: 4,
                    h: 4,
                    p,
                    t: p.generation,
                });
            } else {
                return false;
            }
        }
    }
    let used = new Uint8Array(objs.length);
    for (let i = 0; i < objs.length; i++) {
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let obj = objs[i];
        let data = [];
        for (let j = 0; j < objs.length; j++) {
            if (used[j]) {
                continue;
            }
            if (distance(obj, objs[j]) <= MAX_PSEUDO_DISTANCE) {
                used[j] = 1;
                data.push(objs[j]);
            }
        }
        if (data.length === 0) {
            out.push(obj);
            continue;
        }
        let minX = obj.x;
        let maxX = obj.x + obj.w;
        let minY = obj.y;
        let maxY = obj.y + obj.h;
        for (let obj of data) {
            if (obj.x < minX) {
                minX = obj.x;
            }
            if (obj.x + obj.w > maxX) {
                maxX = obj.x + obj.w;
            }
            if (obj.y < minY) {
                minY = obj.y;
            }
            if (obj.y + obj.h > maxY) {
                maxY = obj.y + obj.h;
            }
        }
        let p = base.copy();
        p.height = maxY - minY;
        p.width = maxX - minX;
        p.size = p.height * p.width;
        p.data = new Uint8Array(p.size);
        p.insert(obj.p, obj.x - minX, obj.y - minY);
        for (let obj of data) {
            p.insert(obj.p, obj.x - minX, obj.y - minY);
        }
        out.push({
            isShip: false,
            code: p.toApgcode('xs' + p.population),
            x: minX,
            y: minY,
            w: p.width,
            h: p.height,
            p,
        })
    };
    return out;
}


function salvoToString(s: Salvo, data: false | CAObject[]): string {
    let out = s.lanes.map(x => x[1] ? x[0] + 'w' : x[0]).join(', ') + ': ';
    if (data === false) {
        return out + 'unknown';
    }
    let ships: (CAObject & {isShip: true})[] = [];
    for (let obj of data) {
        if (obj.isShip) {
            ships.push(obj);
            continue;
        }
        out += obj.code + ' (' + (obj.x - 1) + ', ' + (obj.y - 1) + '), ';
    }
    for (let ship of ships) {
        let lane: number;
        if (ship.dir === 'ne' || ship.dir === 'sw') {
            lane = ship.x + ship.y;
        } else {
            lane = ship.y - ship.x;
        }
        out += (ship.isW ? 'w' : 'g') + ' ' + ship.dir + ' lane ' + lane + ' timing ' + (ship.t - 5) + ', ';
        ship.y = 0;
    }
    if (data.length > 0) {
        out = out.slice(0, -2);
    } else {
        out += 'nothing';
    }
    return out;
}

function getSalvos(target: string, limit: number): Set<string> {
    console.log('\n' + target + ':');
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    for (let isW of [false, true]) {
        let failed = false;
        let hadCollision = false;
        for (let lane = 0; lane < limit; lane++) {
            let s = {lanes: [[lane, isW]], target} as Salvo;
            let data = findOutcome(s);
            if (data === null) {
                if (!hadCollision) {
                    continue;
                }
                if (failed) {
                    break;
                } else {
                    failed = true;
                    console.log(lane + (isW ? 'w' : '') + ': ' + 'no collision');
                    continue;
                }
            }
            if (!hadCollision) {
                hadCollision = true;
            }
            failed = false;
            console.log(salvoToString(s, data));
            if (data) {
                for (let obj of data) {
                    if (obj.isShip) {
                        continue;
                    }
                    newObjs.add(obj.code);
                }
            }
        }
    }
    return newObjs;
}


if (process.argv[2] === 'search') {
    let newObjs = getSalvos(process.argv[3], 32);
    console.log('outputs: ' + Array.from(newObjs).join(', '));
} else if (process.argv[2] === 'search_all') {
    let limit = parseInt(process.argv[3]);
    let done = new Set<string>();
    let queue = ['xs2_11'];
    for (let i = 0; i < limit; i++) {
        let newQueue: string[] = [];
        for (let code of queue) {
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            newQueue.push(...getSalvos(code, 256));
        }
        queue = newQueue;
    }
} else {
    let lanes = process.argv.slice(3).join(' ').split(', ').map<[number, boolean]>(x => [parseInt(x), x.endsWith('w')]);
    console.log(createConfiguration({lanes, target: process.argv[2].slice(process.argv[2].indexOf('_') + 1)}).toRLE());
}


