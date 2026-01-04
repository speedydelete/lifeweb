
/*

slow salvo searching program

this program is wrapped by the "ss" file which makes it easier to use
remember to run "npx tsc" to recompile whenever you change this file!

to use:

./ss 1, 2, 3
to get the slow salvo RLE for lanes 1, 2, and 3

./ss search 3
to search all slow salvos with 3 or less gliders
note that the search command outputs an insane amount of data
you should probably send it to a file, like "./ss search 3 > salvos.txt"
it will also create a salvos.json file which future programs may use!
the output consists of 2 parts: a full list of collision results, then a full list of salvos that do certain things

*/

// the default settings will work for the B2ce/S1 glider, but you may have to modify some of the specifics for different rules

const RULE = 'B2-ak3y4jn5jy78/S12-k3j4-akn5ir';

// the glider is the spaceship used for slow salvos and single channel recipes
const GLIDER_HEIGHT = 2;
const GLIDER_WIDTH = 3;
// this part is an array of [x, y] coordinates
const GLIDER_CELLS = [[2, 0], [0, 1], [1, 1]];
const GLIDER_SLOPE = 1;
const GLIDER_POPULATION_PERIOD = 1;

// the starting object for syntheses
// must be D8 or D4 symmetric for now
const START_OBJECT = 'xs2_11';
// a rotated version of it, if applicable, set to null to disable
const ROTATED_START_OBJECT: string | null = 'xs2_3';

// the spacing (in cells) between 2 gliders in a multi-glider slow salvo
const GLIDER_SPACING = 20;
// the spacing (in cells) between the glider and the target
const GLIDER_TARGET_SPACING = 5;

// the timing offset for collisions, set this to whatever notion of timing you like
const TIMING_DIFFERENCE = 0;
// the lane offset, I set this to -1 because B2n
const LANE_OFFSET = -1;

// the number of generations it should take a glider to get to the object, dependant on GLIDER_SPACING
const WAIT_GENERATIONS = 192;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 30;
// the number of population periods to repeat to make sure it's stable
const PERIOD_SECURITY = 16;
// this is optional, they enable a RSS-like period filter (see https://conwaylife.com/forums/viewtopic.php?f=9&t=7098&p=222961#p222961) that can help, set to null to disable
const VALID_POPULATION_PERIODS: null | number[] = [1];
// the extra generations to run after a collision, just to make sure
const EXTRA_GENERATIONS = 60;
// the generations to run the colorizing object separation for
const SEPARATOR_GENERATIONS = 1;
// the maximum separation between still lifes for them to be combined (this is useful because collisions generally require much more space around the stil life to work)
const MAX_PSEUDO_DISTANCE = 6;
// the limit for the number of lanes to search, if anything gets to this it assumes there was a problem and drops the object
const LANE_LIMIT = 128;

// this setting can help if the START_OBJECT functions as an eater, it will strip input gliders of those lanes off
const EATER_LANES = [2];

// the valid directions for a ship, this is purely for user convenience
type ShipDirection = 'NW' | 'NE' | 'SW' | 'SE';

// the possible names for ships
type ShipName = 'glider';

/*
ok this is how this part works:
this lets you produce nice outputs for ships instead of literally dropping everything that outputs ships (well, they'll be kept, but won't be included in the final enumeration)
for each apgcode you provide a name which is a ShipName
then you provide a list of test cases, each case consists of a height, width, and population
for each case you provide a lsit of subcases, each subcase has the following format:
[cells: number[], dir: ShipDirection, timing: number][]
the cells let you actually test for the pattern that is the ship
here's an example
{
    height: 3,
    width: 2,
    population: 3,
    data: [
        [[1, 2, 4], 'NW', 2]
    ],
}
the cells argument tells you the indices of alive cells
you use a grid like this (for height 3 and width 2):
0 1
2 3
4 5
so [1, 2, 4] means that cells 1, 2, and 4 must be on, and therefore the pattern must look like this:
bo$
ob$
ob!
then a ShipDirection
then a number of generations to run to get to the canonical phase (important for timing!), use whatever notion of timing and canonical phases of ships you like best
*/

interface ShipIdentification {
    name: ShipName;
    data: {
        height: number;
        width: number;
        population: number;
        data: [cells: number[], dir: ShipDirection, timing: number][];
    }[];
}

const SHIP_IDENTIFICATION: {[key: string]: ShipIdentification} = {
    xq4_15: {
        name: 'glider',
        data: [
            {
                height: 3,
                width: 2,
                population: 3,
                data: [
                    [[1, 2, 4], 'NW', 2],
                    [[0, 1, 4], 'NW', 1],
                    [[0, 3, 5], 'NE', 2],
                    [[0, 1, 5], 'NE', 1],
                    [[0, 2, 5], 'SW', 2],
                    [[0, 4, 5], 'SW', 1],
                    [[1, 3, 4], 'SE', 2],
                    [[1, 4, 5], 'SE', 1],
                ],
            },
            {
                height: 2,
                width: 3,
                population: 3,
                data: [
                    [[1, 2, 3], 'NW', 0],
                    [[0, 2, 3], 'NW', 3],
                    [[0, 1, 5], 'NE', 0],
                    [[0, 2, 5], 'NE', 3],
                    [[0, 4, 5], 'SW', 0],
                    [[0, 3, 5], 'SW', 3],
                    [[2, 3, 4], 'SE', 0],
                    [[2, 3, 5], 'SE', 3],
                ],
            },
        ],
    },
}

// this function determines lane numbers of ships, change this to whatever notion of lane numbering you like
function findLane(ship: CAObject & {type: ShipName}): number {
    if (ship.dir === 'NE' || ship.dir === 'SW') {
        return ship.x + ship.y;
    } else {
        return ship.y - ship.x;
    }
}


import * as fs from 'node:fs/promises';
import {MAPPattern, createPattern, INTSeparator, getKnots, identify} from './core/index.js';


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
    let yPos = (s.lanes.length - 1) * GLIDER_SPACING + GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * GLIDER_SLOPE) - LANE_OFFSET + target.height - minLane;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos];
}


type CAObject = ({x: number, y: number, w: number, h: number} & ({type: 'sl' | 'other', code: string} | {type: ShipName, dir: ShipDirection, t: number, n: number}));

function distance(a: CAObject, b: CAObject): number {
    return Math.abs(Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) + Math.abs(Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
}

function findOutcome(s: Salvo): false | null | true | CAObject[] {
    let [p, xPos, yPos] = createConfiguration(s);
    let found = false;
    let prevPop = p.population;
    for (let i = 0; i < s.lanes.length * WAIT_GENERATIONS / GLIDER_POPULATION_PERIOD; i++) {
        p.run(GLIDER_POPULATION_PERIOD);
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
    for (let i = 0; i < MAX_GENERATIONS; i++) {
        p.runGeneration();
        let pop = p.population;
        for (period = 1; period < Math.min(MAX_GENERATIONS, Math.floor(pops.length / PERIOD_SECURITY)); period++) {
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
    if (found && VALID_POPULATION_PERIODS && !VALID_POPULATION_PERIODS.includes(period)) {
        return false;
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
        out += `${ship.dir} ${ship.type} lane ${findLane(ship)} timing ${ship.t - TIMING_DIFFERENCE}, `;
    }
    if (data.length > 0) {
        out = out.slice(0, -2);
    } else {
        out += 'nothing';
    }
    return out;
}

function getSalvos(target: string): false | [Set<string>, [number, false | null | CAObject[]][], string] {
    target = target.slice(target.indexOf('_') + 1);
    let newObjs = new Set<string>();
    let out: [number, false | null | CAObject[]][] = [];
    let failed = false;
    let hadCollision = false;
    let str = 'xs' + base.loadApgcode(target).population + '_' + target + ':\n';
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
        if (lane === -LANE_LIMIT) {
            return false;
        }
    }
    lane++;
    for (; lane < LANE_LIMIT; lane++) {
        let s = {target, lanes: [lane]};
        let data = findOutcome(s);
        if (data === true) {
            return false;
        }
        // @ts-ignore
        out.push([lane, data ? data.map(x => (x.type === 'sl' || x.type === 'other') ? {type: x.type, x: x.x, y: x.y, w: x.w, h: x.h, code: x.code} : {type: x.type, x: x.x, y: x.y, w: x.w, h: x.h, dir: x.dir, t: x.t, n: x.n}) : data]);
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
        if (lane === LANE_LIMIT - 1) {
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
        let aLane = findLane(a);
        let bLane = findLane(b);
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
        out += `${ship.dir} ${ship.type} lane ${findLane(ship)} emitted ${ship.n} timing ${ship.t - TIMING_DIFFERENCE}, `;
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


function xyCompare(a: CAObject, b: CAObject): number {
    if (a.y < b.y) {
        return -1;
    } else if (a.y > b.y) {
        return 1;
    } else if (a.x < b.x) {
        return -1;
    } else if (a.x > b.x) {
        return 1;
    } else {
        return 0;
    }
}

function objectSorter(a: CAObject, b: CAObject): number {
    if (a.type === 'sl') {
        if (b.type !== 'sl') {
            return -1;
        } else if (a.code < b.code) {
            return -1;
        } else if (a.code > b.code) {
            return 1;
        } else {
            return xyCompare(a, b);
        }
    } else if (a.type === 'other') {
        if (b.type !== 'other') {
            return 1;
        } else if (a.code < b.code) {
            return -1;
        } else if (a.code > b.code) {
            return 1;
        } else {
            return xyCompare(a, b);
        }
    } else {
        if (a.type < b.type) {
            return -1;
        } else if (a.type > b.type) {
            return 1;
        } else {
            return xyCompare(a, b);
        }
    }
}

function objectsSorter(a: CAObject[], b: CAObject[]): number {
    if (a.length < b.length) {
        return -1;
    } else if (a.length > b.length) {
        return 1;
    } else {
        a = a.toSorted(objectSorter);
        b = b.toSorted(objectSorter);
        for (let i = 0; i < a.length; i++) {
            let out = objectSorter(a[i], b[i]);
            if (out !== 0) {
                return out;
            }
        }
        return 0;
    }
}


let args = process.argv.slice(2);

async function searchSalvos(): Promise<void> {
    console.log('\nPer-object data:\n\n');
    let limit = parseInt(args[1]);
    let done = new Set<string>();
    let perObject: {[key: string]: [number, false | null | CAObject[]][]} = {};
    let queue = [START_OBJECT];
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
    getAllRecipes(perObject, START_OBJECT, [], 0, 0, 0, limit - 1, recipes);
    for (let [key, value] of Object.entries(recipes).sort(([_, [x, _2]], [_3, [y, _4]]) => objectsSorter(x, y))) {
        console.log('');
        console.log(key + ':');
        let data = value[1].sort((x, y) => x.length - y.length);
        if (EATER_LANES.length > 0) {
            data = data.map(x => {
                while (EATER_LANES.includes(x[0])) {
                    x.shift();
                }
                return x;
            });
            data = data.filter(x => x.length > 0);
        }
        let outData: number[][] = [];
        for (let recipe of new Set(data.map(x => x.join(', ')))) {
            outData.push(recipe.split(', ').map(x => parseInt(x)));
            console.log(recipe);
        }
        recipes[key] = [recipes[key][0], outData];
    }
    let moves: [[number, number, boolean][], number[][]][] = [];
    for (let [objs, data] of Object.values(recipes)) {
        if (objs.every(x => x.type === 'sl' && (x.code === START_OBJECT || x.code === ROTATED_START_OBJECT))) {
            moves.push([objs.map(x => [x.x, x.y, (x as {code: string}).code === ROTATED_START_OBJECT]), data]);
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

if (args[0] === 'search') {
    searchSalvos();
} else {
    let lanes = args.join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x).map(x => parseInt(x)).reverse();
    console.log(createConfiguration({target: START_OBJECT.slice(START_OBJECT.indexOf('_') + 1), lanes})[0].toRLE());
}
