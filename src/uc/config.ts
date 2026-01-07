
// the default settings will work for the B2ce/S1 glider, but you may have to modify some of the specifics for different rules

const RULE = 'B2-ak3y4jn5jy78/S12-k3j4-akn5ir';

// the glider is the spaceship used for slow salvos and single channel recipes
// this part is an array of [height, width, array of [x, y] coordinates] for each phase
// should be facing southeast for diagonals or south for orthogonals
const GLIDER_CELLS: [number, number, [number, number][]][] = [
    [2, 3, [[2, 0], [0, 1], [1, 1]]],
    [2, 3, [[2, 0], [0, 1], [2, 1]]],
    [3, 2, [[1, 0], [1, 1], [0, 2]]],
    [3, 2, [[1, 0], [0, 2], [1, 2]]],
];
const GLIDER_DX = 1;
const GLIDER_DY = 1;
const GLIDER_PERIOD = 4;
const GLIDER_POPULATION_PERIOD = 1;

// the starting object for syntheses
// must be D8 or D4 symmetric for now
const START_OBJECT = 'xs2_11';
// a rotated version of it, if applicable, set to null to disable
const ROTATED_START_OBJECT: string | null = 'xs2_3';

// the spacing (in cells) between the glider and the target
const GLIDER_TARGET_SPACING = 7;

// makes lane numbers more sane, set to -1 for B2n, and 0 otherwise
const LANE_OFFSET = -1;

// the spacing (in cells) between 2 gliders in a multi-glider slow salvo
const GLIDER_SPACING_SS = 10;

// the lane used for single-channel collisions with START_OBJECT
const SINGLE_CHANNEL_LANE = 10;
// the minimum spacing between single-channel gliders
const MIN_SPACING_SC = 20;

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

// the valid directions for a ship
// for diagonals
type ShipDirection = 'NW' | 'NE' | 'SW' | 'SE';
// for orthogonals
// type ShipDirection = 'N' | 'E' | 'S' | 'W';

// the possible names for ships
type ShipName = 'glider';

/*
ok this is how this part works:
you must provide it like this
for orthogonals, it's easy: every one must put it in the same phase (the phase doesn't matter) and the right orientation
for diagonals, i shall give this example with the glider
NW: NE:
ooo ooo
o.. ..o
.o. .o.
SW: SE:
.o. .o.
..o o..
ooo ooo
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
    height: number;
    width: number;
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
        height: 2,
        width: 3,
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


// internal stuff, don't change this

export const GLIDER_SLOPE = GLIDER_DX / GLIDER_DY;

export {RULE, GLIDER_CELLS, GLIDER_DX, GLIDER_DY, GLIDER_PERIOD, GLIDER_POPULATION_PERIOD, START_OBJECT, ROTATED_START_OBJECT, GLIDER_TARGET_SPACING, LANE_OFFSET, GLIDER_SPACING_SS, SINGLE_CHANNEL_LANE, MIN_SPACING_SC, WAIT_GENERATIONS, MAX_GENERATIONS, PERIOD_SECURITY, VALID_POPULATION_PERIODS, EXTRA_GENERATIONS, SEPARATOR_GENERATIONS, MAX_PSEUDO_DISTANCE, LANE_LIMIT, ShipDirection, ShipName, ShipIdentification, SHIP_IDENTIFICATION};
