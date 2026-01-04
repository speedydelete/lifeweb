
import * as fs from 'node:fs/promises';
import {MAPPattern, createPattern, INTSeparator, getKnots, identify, Pattern} from './core/index.js';


const RULE = 'B2-ak3y4jn5jy78/S12-k3j4-akn5ir';

const GLIDER_HEIGHT = 2;
const GLIDER_WIDTH = 3;
const GLIDER_CELLS = [[2, 0], [0, 1], [1, 1]];
const GLIDER_SLOPE = 1;

const START_OBJECT = 'xs2_11';

const GLIDER_SPACING = 20;
const LANE_OFFSET = 5;
const TIMING_DIFFERENCE = 11;

const WAIT_GENERATIONS = 192;
const MAX_GENERATION = 1024;
const PERIOD_FACTOR_NUMBER = 2;
const PERIOD_SECURITY = 64;
const EXTRA_GENERATIONS = 60;
const SEPARATOR_GENERATIONS = 1;
const MAX_PSEUDO_DISTANCE = 6;

type ShipDirection = 'nw' | 'ne' | 'sw' | 'se';

type ShipName = 'glider';

const SHIP_IDENTIFICATION: {[key: string]: {name: ShipName, data: {height: number, width: number, population: number, data: [cells: number[], dir: ShipDirection, timing: number][]}[]}} = {
    xq4_15: {
        name: 'glider',
        data: [
            {
                height: 3,
                width: 2,
                population: 3,
                data: [
                    [[1, 2, 4], 'nw', 2],
                    [[0, 1, 4], 'nw', 1],
                    [[0, 3, 5], 'ne', 2],
                    [[0, 1, 5], 'ne', 1],
                    [[0, 2, 5], 'sw', 2],
                    [[0, 4, 5], 'sw', 1],
                    [[1, 3, 4], 'se', 2],
                    [[1, 4, 5], 'se', 1],
                ],
            },
            {
                height: 2,
                width: 3,
                population: 3,
                data: [
                    [[1, 2, 3], 'nw', 0],
                    [[0, 2, 3], 'nw', 3],
                    [[0, 1, 5], 'ne', 0],
                    [[0, 2, 5], 'ne', 3],
                    [[0, 4, 5], 'sw', 0],
                    [[0, 3, 5], 'sw', 3],
                    [[2, 3, 4], 'se', 0],
                    [[2, 3, 5], 'se', 3],
                ],
            },
        ],
    },
}


let base = createPattern(RULE) as MAPPattern;
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
        let y = i * GLIDER_SPACING;
        let x = Math.floor(y * GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + GLIDER_WIDTH, y + GLIDER_HEIGHT);
        for (let cell of GLIDER_CELLS) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
    let target = base.loadApgcode(s.target);
    let yPos = (s.lanes.length - 1) * GLIDER_SPACING + LANE_OFFSET + 1;
    let xPos = Math.floor(yPos * GLIDER_SLOPE) + target.height + LANE_OFFSET - minLane * 2;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}


type CAObject = ({x: number, y: number, w: number, h: number} & ({type: 'sl' | 'other', code: string} | {type: ShipName, dir: ShipDirection, t: number, n: number}));

function distance(a: CAObject, b: CAObject): number {
    return Math.abs(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) + Math.abs(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function findOutcome(s: Salvo): false | null | CAObject[] {
    let [p, xPos, yPos] = createConfiguration(s);
    let found = false;
    let prevPop = p.population;
    for (let i = 0; i < s.lanes.length * WAIT_GENERATIONS; i++) {
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
    for (let i = 0; i < MAX_GENERATION; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pops.slice(-PERIOD_SECURITY).every(x => x === pop)) {
            found = true;
            break;
        }
        pops.push(pop);
    }
    if (!found) {
        for (let i = pops.length - PERIOD_SECURITY; i < pops.length - PERIOD_FACTOR_NUMBER; i++) {
            if (pops[i] !== pops[i + PERIOD_FACTOR_NUMBER]) {
                return false;
            }
        }
    }
    p.run(EXTRA_GENERATIONS);
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    let sep = new INTSeparator(p, knots);
    for (let i = 0; i < SEPARATOR_GENERATIONS; i++) {
        sep.runGeneration();
        sep.resolveKnots();
    }
    let out: CAObject[] = [];
    let stillLifes: (CAObject & {type: 'sl', p: MAPPattern})[] = [];
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
            stillLifes.push({
                type: 'sl',
                x: p.xOffset,
                y: p.yOffset,
                w: p.width,
                h: p.height,
                p,
                code: p.toApgcode('xs' + p.population),
            });
        } else if (type.apgcode in SHIP_IDENTIFICATION) {
            let {name, data: info} = SHIP_IDENTIFICATION[type.apgcode];
            let found = false;
            for (let {height, width, population, data} of info) {
                if (p.height === height && p.width === width && p.population === population) {
                    for (let [cells, dir, timing] of data) {
                        found = true;
                        for (let i of cells) {
                            if (!p.data[i]) {
                                found = false;
                                break;
                            }
                        }
                        if (found) {
                            out.push({
                                type: name,
                                x: p.xOffset,
                                y: p.yOffset,
                                w: width,
                                h: height,
                                dir,
                                t: p.generation + timing,
                                n: 0,
                            })
                            break;
                        }
                    }
                }
            }
            if (!found) {
                throw new Error(`Invalid glider: ${p.toRLE()}`);
            }
        } else if (type.apgcode === 'PATHOLOGICAL' || type.apgcode.startsWith('zz')) {
            return false;
        } else {
            out.push({
                type: 'other',
                x: p.xOffset,
                y: p.yOffset,
                w: p.width,
                h: p.height,
                code: type.apgcode,
            });
        }
    }
    let used = new Uint8Array(stillLifes.length);
    for (let i = 0; i < stillLifes.length; i++) {
        let obj = stillLifes[i];
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let data = [];
        for (let j = 0; j < stillLifes.length; j++) {
            if (used[j]) {
                continue;
            }
            if (distance(obj, stillLifes[j]) <= MAX_PSEUDO_DISTANCE) {
                used[j] = 1;
                data.push(stillLifes[j]);
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
        out += `${ship.dir.toUpperCase()} glider lane ${lane} timing ${ship.t - TIMING_DIFFERENCE}, `;
    }
    if (data.length > 0) {
        out = out.slice(0, -2);
    } else {
        out += 'nothing';
    }
    return out;
}

function getSalvos(target: string, limit: number): [Set<string>, [number, false | null | CAObject[]][], string] {
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    let out: [number, false | null | CAObject[]][] = [];
    let failed = false;
    let hadCollision = false;
    let str = 'xs' + base.loadApgcode(target).population + '_' + target + ':\n';
    for (let lane = 0; lane < limit; lane++) {
        let s = {target, lanes: [lane]};
        let data = findOutcome(s);
        out.push([lane, data ? data.map(x => x.type === 'glider' ? {type: 'glider', x: x.x, y: x.y, w: x.w, h: x.h, dir: x.dir, t: x.t, n: x.n} : {type: x.type, x: x.x, y: x.y, w: x.w, h: x.h, code: x.code,}) : data]);
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


function normalizeOutcome(data: false | null | CAObject[]): string | false {
    if (!data || data.length === 0) {
        return false;
    }
    let stillLifes: (CAObject & {type: 'sl'})[] = [];
    let gliders: (CAObject & {type: ShipName})[] = [];
    for (let obj of data) {
        if (obj.type === 'sl') {
            // @ts-ignore
            stillLifes.push(obj);
        } else if (obj.type === 'other') {
            return false;
        } else {
            // @ts-ignore
            gliders.push(obj);
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
        if (a.type !== b.type) {
            if (a.type < b.type) {
                return -1;
            } else {
                return 1;
            }
        }
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
        out += `${ship.dir.toUpperCase()} glider lane ${lane} emitted ${ship.n} timing ${ship.t - TIMING_DIFFERENCE}, `;
    }
    return out.slice(0, -2);
}

function getAllRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [CAObject[], number[][]]}, add: CAObject[] = []): void {
    for (let [lane, objs] of data[code]) {
        if (!objs || objs.length === 0 || objs.some(x => x.type === 'other')) {
            continue;
        }
        let recipe = prefix.concat(lane - y + x);
        objs = objs.slice();
        objs.push(...add.map(value => {
            let out = structuredClone(value);
            if (out.type === 'glider') {
                out.n = count;
            }
            return out;
        }));
        objs = objs.map(value => {
            let out = structuredClone(value);
            out.x += x;
            out.y += y;
            return out;
        });
        let str = normalizeOutcome(objs);
        if (str) {
            if (str in out) {
                out[str][1].push(recipe);
            } else {
                out[str] = [objs, [recipe]];
            }
        }
        if (count < limit) {
            if (objs.length === 1 && objs[0].type === 'sl' && objs[0].code in data) {
                getAllRecipes(data, objs[0].code, recipe, objs[0].x, objs[0].y, count + 1, limit, out);
            } else {
                for (let i = 0; i < objs.length; i++) {
                    let obj = objs[i];
                    if (obj.type === 'sl' && obj.code in data) {
                        getAllRecipes(data, obj.code, recipe, obj.x, obj.y, count + 1, limit, out, objs.toSpliced(i, 1));
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
    let out: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [START_OBJECT];
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
    let recipes: {[key: string]: [CAObject[], number[][]]} = {};
    getAllRecipes(out, START_OBJECT, [], 0, 0, 1, limit, recipes);
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
    console.log(createConfiguration({target: START_OBJECT.slice(START_OBJECT.indexOf('_') + 1), lanes})[0].toRLE());
}
