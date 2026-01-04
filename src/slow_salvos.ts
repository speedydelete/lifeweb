
import * as fs from 'node:fs/promises';
import {MAPPattern, createPattern, INTSeparator, getKnots, identify} from './core/index.js';


const OFFSET = 5;
const MAX_PSEUDO_DISTANCE = 6;


let base = createPattern('B2-ak3y4jn5jy78/S12-k3j4-akn5ir') as MAPPattern;
let knots = getKnots(base.trs);


interface Salvo {
    target: string;
    lanes: number[];
}

function createConfiguration(s: Salvo): [MAPPattern, number, number] {
    let minLane = Math.min(0, ...s.lanes);
    let p = base.copy();
    for (let i = 0; i < s.lanes.length; i++) {
        let lane = s.lanes[i];
        let y = i * 20;
        let x = y + lane - minLane;
        p.ensure(x + 3, y + 2);
        p.set(x + 2, y, 1);
        p.set(x, y + 1, 1);
        p.set(x + 1, y + 1, 1);
    }
    let target = base.loadApgcode(s.target);
    let yPos = (s.lanes.length - 1) * 20 + 6;
    let xPos = yPos + target.height + OFFSET - minLane * 2;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}


type CAObjectNoP = ({x: number, y: number, w: number, h: number} & ({type: 'sl' | 'other', code: string} | {type: 'glider', dir: 'nw' | 'ne' | 'sw' | 'se', t: number}));

type CAObject = CAObjectNoP & {p: MAPPattern};

function distance(a: CAObject, b: CAObject): number {
    return Math.abs(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) + Math.abs(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function findOutcome(s: Salvo): false | null | CAObject[] {
    let [p, xPos, yPos] = createConfiguration(s);
    let found = false;
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
    if (!found) {
        return null;
    }
    let pops: number[] = [];
    found = false;
    for (let i = 0; i < 1024; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pops.slice(-64).every(x => x === pop)) {
            found = true;
            break;
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
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    let sep = new INTSeparator(p, knots);
    sep.runGeneration();
    sep.resolveKnots();
    let objs: CAObject[] = [];
    for (let p of sep.getObjects()) {
        if (p.isEmpty()) {
            return false;
        }
        p.shrinkToFit();
        let type = identify(p, 1024, false);
        if (type.apgcode.startsWith('xs')) {
            if (type.apgcode === 'xs0_0') {
                continue;
            }
            objs.push({
                type: 'sl',
                x: p.xOffset,
                y: p.yOffset,
                w: p.width,
                h: p.height,
                p,
                code: p.toApgcode('xs' + p.population),
            });
        } else if (type.apgcode === 'xq4_15') {
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
            objs.push({
                type: 'glider',
                x: p.xOffset,
                y: p.yOffset,
                dir,
                w: 3,
                h: 2,
                p,
                t: p.generation,
            });
        } else if (type.apgcode === 'PATHOLOGICAL' || type.apgcode.startsWith('zz')) {
            return false;
        } else {
            objs.push({
                type: 'other',
                x: p.xOffset,
                y: p.yOffset,
                w: p.width,
                h: p.height,
                p,
                code: type.apgcode,
            });
        }
    }
    let out: CAObject[] = [];
    let used = new Uint8Array(objs.length);
    for (let i = 0; i < objs.length; i++) {
        let obj = objs[i];
        if (obj.type !== 'sl') {
            out.push(obj);
            continue;
        }
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let data = [];
        for (let j = 0; j < objs.length; j++) {
            if (objs[j].type !== 'sl' || used[j]) {
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
        p.shrinkToFit();
        let type = identify(p, 2, false);
        if (type.period !== 1 || !type.disp || type.disp[0] !== 0 || type.disp[1] !== 0) {
            return false;
        }
        out.push({
            type: 'sl',
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
    let out = s.lanes.join(', ') + ': ';
    if (data === false) {
        return out + 'unknown';
    }
    let gliders: (Omit<CAObject & {type: 'glider'}, 'p'>)[] = [];
    for (let obj of data) {
        if (obj.type === 'glider') {
            gliders.push(obj);
            continue;
        }
        out += obj.code + ' (' + obj.x + ', ' + obj.y + '), ';
    }
    for (let ship of gliders) {
        let lane: number;
        if (ship.dir === 'ne' || ship.dir === 'sw') {
            lane = ship.x + ship.y;
        } else {
            lane = ship.y - ship.x;
        }
        out += 'g ' + ship.dir + ' lane ' + lane + ' timing ' + (ship.t - 3) + ', ';
    }
    if (data.length > 0) {
        out = out.slice(0, -2);
    } else {
        out += 'nothing';
    }
    return out;
}

function getSalvos(target: string, limit: number): [Set<string>, [number, false | null | CAObjectNoP[]][], string] {
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    let out: [number, false | null | CAObjectNoP[]][] = [];
    let failed = false;
    let hadCollision = false;
    let str = 'xs' + base.loadApgcode(target).population + '_' + target + ':\n';
    for (let lane = 0; lane < limit; lane++) {
        let s = {target, lanes: [lane]};
        let data = findOutcome(s);
        out.push([lane, data ? data.map(x => x.type === 'glider' ? {type: 'glider', x: x.x, y: x.y, w: x.w, h: x.h, dir: x.dir, t: x.t} : {type: x.type, x: x.x, y: x.y, w: x.w, h: x.h, code: x.code}) : data]);
        if (data === null) {
            if (!hadCollision) {
                continue;
            }
            if (failed) {
                break;
            } else {
                failed = true;
                str += lane + ': ' + 'no collision\n';
                continue;
            }
        }
        if (!hadCollision) {
            hadCollision = true;
        }
        failed = false;
        str += salvoToString(s, data) + '\n';
        if (data) {
            for (let obj of data) {
                if (obj.type === 'sl') {
                    newObjs.add(obj.code);
                }
            }
        }
    }
    return [newObjs, out, str];
}


function normalizeOutcome(data: false | null | CAObjectNoP[]): string | false {
    if (!data || data.length === 0) {
        return false;
    }
    let stillLifes: (CAObjectNoP & {type: 'sl'})[] = [];
    let gliders: (CAObjectNoP & {type: 'glider'})[] = [];
    for (let obj of data) {
        if (obj.type === 'sl') {
            // @ts-ignore
            stillLifes.push(obj);
        } else if (obj.type === 'glider') {
            gliders.push(obj);
        } else {
            return false;
        }
    }
    stillLifes = stillLifes.sort((a, b) => {
        if (a.x < b.x) {
            return -1;
        } else if (a.x > b.x) {
            return 1;
        } else if (a.y < b.y) {
            return -1;
        } else if (a.y > b.y) {
            return 1;
        } else {
            return 0;
        }
    });
    gliders = gliders.sort((a, b) => {
        if (a.t < b.t) {
            return -1;
        } else if (a.t > b.t) {
            return 1;
        }
        let aLane = a.dir === 'ne' || a.dir === 'sw' ? a.x + a.y : a.y - a.x;
        let bLane = b.dir === 'ne' || b.dir === 'sw' ? b.x + b.y : b.y - b.x;
        if (aLane < bLane) {
            return -1;
        } else if (aLane > bLane) {
            return 1;
        } else {
            return 1;
        }
    });
    let out = '';
    for (let obj of stillLifes) {
        out += obj.code + ' (' + obj.x + ', ' + obj.y + '), ';
    }
    for (let ship of gliders) {
        let lane: number;
        if (ship.dir === 'ne' || ship.dir === 'sw') {
            lane = ship.x + ship.y;
        } else {
            lane = ship.y - ship.x;
        }
        out += 'g ' + ship.dir + ' lane ' + lane + ' timing ' + (ship.t - 3) + ', ';
    }
    return out.slice(0, -2);
}

function getAllRecipes(data: {[key: string]: [number, false | null | CAObjectNoP[]][]}, code: string, prefix: number[], x: number, y: number, limit: number, out: {[key: string]: [CAObjectNoP[], number[][]]}, add: CAObjectNoP[] = []): void {
    for (let [lane, objs] of data[code]) {
        let recipe = prefix.concat(lane - y + x);
        if (!objs || objs.some(x => x.type === 'other')) {
            continue;
        } else {
            objs = objs.map(value => {
                let out = structuredClone(value);
                out.x += x;
                out.y += y;
                return out;
            });
            objs.push(...add);
            let str = normalizeOutcome(objs);
            if (str) {
                if (str in out) {
                    out[str][1].push(recipe);
                } else {
                    out[str] = [objs, [recipe]];
                }
            }
            if (limit > 1) {
                for (let i = 0; i < objs.length; i++) {
                    let obj = objs[i];
                    if (obj.type === 'sl' && obj.code in data) {
                        getAllRecipes(data, obj.code, recipe, x + obj.x, y + obj.y, limit - 1, out, objs.toSpliced(i, 1));
                    }
                }
            }
        }
    }
}


if (process.argv[2] === 'search') {
    console.log('');
    let limit = parseInt(process.argv[3]);
    let done = new Set<string>();
    let out: {[key: string]: [number, false | null | CAObjectNoP[]][]} = {};
    let queue = ['xs2_11'];
    for (let i = 0; i < limit; i++) {
        let newQueue: string[] = [];
        for (let code of queue) {
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            let [newObjs, newOut, str] = getSalvos(code, 64);
            if (newOut.length === 64) {
                continue;
            }
            console.log(str);
            out[code] = newOut;
            newQueue.push(...newObjs);
        }
        queue = newQueue;
    }
    console.log('');
    let recipes: {[key: string]: [CAObjectNoP[], number[][]]} = {};
    getAllRecipes(out, 'xs2_11', [], 0, 0, limit, recipes);
    for (let key in recipes) {
        console.log('');
        console.log(key + ':');
        let data = recipes[key][1].sort((x, y) => x.length - y.length).map(x => {
            while (x.length > 0 && x[0] === 6) {
                x.shift();
            }
            return x;
        });
        recipes[key] = [recipes[key][0], data];
        for (let recipe of new Set(data.map(x => x.join(', ')))) {
            console.log(recipe);
        }
    }
    await fs.writeFile('salvos.json', JSON.stringify(recipes));
} else {
    let lanes = process.argv.slice(2).join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x).map(x => parseInt(x)).reverse();
    console.log(createConfiguration({target: '11', lanes})[0].toRLE());
}
