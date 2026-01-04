

import * as fs from 'node:fs/promises';
import {MAPPattern, identify, INTSeparator, getKnots} from '../core/index.js';
import {ShipName, CAObject, base, objectsSorter} from './config.js';
import * as c from './config.js';


export interface Salvo {
    target: string;
    lanes: number[];
}


export function createConfiguration(s: Salvo): [MAPPattern, number, number] {
    let minLane = Math.min(0, ...s.lanes);
    let p = base.copy();
    for (let i = 0; i < s.lanes.length; i++) {
        let lane = s.lanes[i];
        let y = i * c.GLIDER_SPACING;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + c.GLIDER_WIDTH, y + c.GLIDER_HEIGHT);
        for (let cell of c.GLIDER_CELLS) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
    let target = base.loadApgcode(s.target);
    let yPos = (s.lanes.length - 1) * c.GLIDER_SPACING + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - c.LANE_OFFSET + target.height - minLane;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}


function distance(a: CAObject, b: CAObject): number {
    return Math.abs(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) + Math.abs(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

let knots = getKnots(base.trs);

function findOutcome(s: Salvo): false | null | true | CAObject[] {
    let [p, xPos, yPos] = createConfiguration(s);
    let found = false;
    let prevPop = p.population;
    for (let i = 0; i < s.lanes.length * c.WAIT_GENERATIONS / c.GLIDER_POPULATION_PERIOD; i++) {
        p.run(c.GLIDER_POPULATION_PERIOD);
        let pop = p.population;
        if (pop !== prevPop) {
            if (i === 0) {
                return true;
            }
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
    let period = -1;
    for (let i = 0; i < c.MAX_GENERATIONS; i++) {
        p.runGeneration();
        let pop = p.population;
        for (period = 1; period < Math.min(c.MAX_GENERATIONS, Math.floor(pops.length / c.PERIOD_SECURITY)); period++) {
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        pops.push(pop);
    }
    // @ts-ignore
    if (found && c.VALID_POPULATION_PERIODS && !c.VALID_POPULATION_PERIODS.includes(period)) {
        return false;
    }
    p.run(c.EXTRA_GENERATIONS);
    p.shrinkToFit();
    p.xOffset -= xPos;
    p.yOffset -= yPos;
    let sep = new INTSeparator(p, knots);
    for (let i = 0; i < c.SEPARATOR_GENERATIONS; i++) {
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
        } else if (type.apgcode in c.SHIP_IDENTIFICATION) {
            let {name, data: info} = c.SHIP_IDENTIFICATION[type.apgcode];
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
                            p.run(timing).shrinkToFit();
                            out.push({
                                type: name,
                                x: p.xOffset,
                                y: p.yOffset,
                                w: p.width,
                                h: p.height,
                                dir,
                                t: p.generation,
                                n: 0,
                            })
                            break;
                        }
                    }
                }
                if (found) {
                    break;
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
            if (distance(obj, stillLifes[j]) <= c.MAX_PSEUDO_DISTANCE) {
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
    let ships: (CAObject & {type: ShipName})[] = [];
    for (let obj of data) {
        if (obj.type !== 'sl' && obj.type !== 'other') {
            // @ts-ignore
            ships.push(obj);
            continue;
        }
        out += obj.code + ' (' + obj.x + ', ' + obj.y + '), ';
    }
    for (let ship of ships) {
        out += `${ship.dir} ${ship.type} lane ${c.findLane(ship)} timing ${ship.t}, `;
    }
    if (data.length > 0) {
        out = out.slice(0, -2);
    } else {
        out += 'nothing';
    }
    return out;
}

function getSalvos(target: string): false | [Set<string>, [number, false | null | CAObject[]][], string] {
    let originalTarget = target;
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    let out: [number, false | null | CAObject[]][] = [];
    let failed = false;
    let hadCollision = false;
    let str = originalTarget + ':\n';
    let lane = 0;
    let data = findOutcome({target, lanes: [lane]});
    if (data === true) {
        return false;
    }
    while (data !== null) {
        lane--;
        data = findOutcome({target, lanes: [lane]});
        if (data === true) {
            return false;
        }
        if (lane === -c.LANE_LIMIT) {
            return false;
        }
    }
    lane++;
    for (; lane < c.LANE_LIMIT; lane++) {
        let s = {target, lanes: [lane]};
        let data = findOutcome(s);
        if (data === true) {
            return false;
        }
        if (data && data.length === 1 && data[0].type === 'sl' && data[0].code === originalTarget && data[0].x === 0 && data[0].y === 0) {
            str += lane + ': ' + 'eater\n';
            continue;
        }
        out.push([lane, data]);
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
        if (lane === c.LANE_LIMIT - 1) {
            return false;
        }
    }
    return [newObjs, out, str];
}


function normalizeOutcome(data: false | null | CAObject[]): string | false {
    if (!data || data.length === 0) {
        return false;
    }
    let stillLifes: (CAObject & {type: 'sl'})[] = [];
    let ships: (CAObject & {type: ShipName})[] = [];
    for (let obj of data) {
        if (obj.type === 'sl') {
            // @ts-ignore
            stillLifes.push(obj);
        } else if (obj.type === 'other') {
            return false;
        } else {
            // @ts-ignore
            ships.push(obj);
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
    ships = ships.sort((a, b) => {
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
        let aLane = c.findLane(a);
        let bLane = c.findLane(b);
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
    for (let ship of ships) {
        out += `${ship.dir} ${ship.type} lane ${c.findLane(ship)} emitted ${ship.n} timing ${ship.t}, `;
    }
    return out.slice(0, -2);
}

function getAllRecipes(data: {[key: string]: [number, false | null | CAObject[]][]}, code: string, prefix: number[], x: number, y: number, count: number, limit: number, out: {[key: string]: [CAObject[], number[][]]}, add: CAObject[] = []): void {
    for (let [lane, objs] of data[code]) {
        if (!objs || objs.length === 0 || objs.some(x => x.type === 'other')) {
            continue;
        }
        let recipe = prefix.concat(lane - y + x);
        objs = objs.concat(add.map(value => {
            let out = structuredClone(value);
            if (out.type !== 'sl' && out.type !== 'other') {
                // @ts-ignore
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
}

export async function searchSalvos(limit: number): Promise<void> {
    console.log('\nPer-object data:\n\n');
    let done = new Set<string>();
    let perObject: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [c.START_OBJECT];
    for (let i = 0; i < limit; i++) {
        let newQueue: string[] = [];
        for (let code of queue) {
            if (done.has(code)) {
                continue;
            } else {
                done.add(code);
            }
            let data = getSalvos(code);
            if (data) {
                let [newObjs, newOut, str] = data;
                console.log(str);
                perObject[code] = newOut;
                newQueue.push(...newObjs);
            }
        }
        queue = newQueue;
    }
    console.log('\nPer-recipe data:\n');
    let recipes: {[key: string]: [CAObject[], number[][]]} = {};
    getAllRecipes(perObject, c.START_OBJECT, [], 0, 0, 0, limit - 1, recipes);
    for (let [key, value] of Object.entries(recipes).sort(([_, [x, _2]], [_3, [y, _4]]) => objectsSorter(x, y))) {
        console.log('');
        console.log(key + ':');
        let data = value[1].sort((x, y) => x.length - y.length);
        let outData: number[][] = [];
        for (let recipe of new Set(data.map(x => x.join(', ')))) {
            outData.push(recipe.split(', ').map(x => parseInt(x)));
            console.log(recipe);
        }
        recipes[key] = [recipes[key][0], outData];
    }
    let moves: [[number, number, boolean][], number[][]][] = [];
    for (let [objs, data] of Object.values(recipes)) {
        if (objs.every(x => x.type === 'sl' && (x.code === c.START_OBJECT || x.code === c.ROTATED_START_OBJECT))) {
            moves.push([objs.map(x => [x.x, x.y, (x as {code: string}).code === c.ROTATED_START_OBJECT]), data]);
        }
    }
    moves = moves.filter(([x]) => !(x.length === 1 && x[0][0] === 0 && x[0][1] === 0 && x[0][2] === false));
    moves = moves.sort((a, b) => {
        if (a.length < b.length) {
            return -1;
        } else if (a.length > b.length) {
            return 1;
        } else {
            for (let i = 0; i < a.length; i++) {
                if (a[i][0] < b[i][0]) {
                    return -1;
                } else if (a[i][0] > b[i][0]) {
                    return 1;
                } else if (a[i][1] < b[i][1]) {
                    return -1;
                } else if (a[i][1] > b[i][1]) {
                    return 1;
                }
            }
            return 0;
        }
    });
    console.log('\n\nMove recipes:\n');
    for (let [coords, recipes] of moves) {
        console.log('');
        if (coords.length === 1) {
            console.log(`(${coords[0][0]}, ${coords[0][1]}) ${coords[0][2] ? 'rotate' : 'move'}:`);
        } else {
            console.log(`${coords.map(x => `(${x[0]}, ${x[1]})${coords[0][2] ? ' rotated' : ''}`).join(', ')} split:`);
        }
        for (let recipe of recipes) {
            console.log(recipe.join(', '));
        }
    }
    await fs.writeFile('salvos.json', JSON.stringify({perObject, recipes, moves}));
}
