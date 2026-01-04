
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
const GLIDER_SPACING = 10;
// the spacing (in cells) between the glider and the target
const GLIDER_TARGET_SPACING = 7;

// the offset number for lanes, I set this to -1 because B2n
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


// internal stuff, don't change this

import {createPattern, MAPPattern} from '../core/index.js';

export type CAObject = ({x: number, y: number, w: number, h: number} & ({type: 'sl' | 'other', code: string} | {type: ShipName, dir: ShipDirection, t: number, n: number}));

export let base = createPattern(RULE) as MAPPattern;

export {RULE, GLIDER_HEIGHT, GLIDER_WIDTH, GLIDER_CELLS, GLIDER_SLOPE, GLIDER_POPULATION_PERIOD, START_OBJECT, ROTATED_START_OBJECT, GLIDER_SPACING, GLIDER_TARGET_SPACING, LANE_OFFSET, WAIT_GENERATIONS, MAX_GENERATIONS, PERIOD_SECURITY, VALID_POPULATION_PERIODS, EXTRA_GENERATIONS, SEPARATOR_GENERATIONS, MAX_PSEUDO_DISTANCE, LANE_LIMIT, ShipDirection, ShipName, ShipIdentification, SHIP_IDENTIFICATION, findLane};

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

export function objectSorter(a: CAObject, b: CAObject): number {
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

export function objectsSorter(a: CAObject[], b: CAObject[]): number {
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
