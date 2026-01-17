
const RULE = 'B2-ak3y4jn5jy78/S12-k3j4-akn5ir';

// the glider is the spaceship used for slow salvos and single channel recipes
// this part is an array of [height, width, array of [x, y] coordinates] for each phase
// should be facing southeast for diagonals or south for orthogonals
const GLIDER_APGCODE = 'xq4_15';
const GLIDER_DX = 1;
const GLIDER_DY = 1;
const GLIDER_PERIOD = 4;
const GLIDER_SLOPE = GLIDER_DX / GLIDER_DY;
const GLIDER_POPULATION_PERIOD = 1;

// makes lane numbers more sane for some rules
const LANE_OFFSET = -1;

// the spacing (in cells) between the glider and the target
const GLIDER_TARGET_SPACING = 7;

// the starting object for slow-salvo syntheses
const START_OBJECT = 'xs2_11';
// the spacing (in cells) between 2 gliders in a multi-glider slow salvo
const GLIDER_SPACING = 10;
// the period of slow salvos
const SLOW_SALVO_PERIOD = 1;

// the valid single-channel elbow objects, format is [lane, whether it is flipped from SINGLE_CHANNEL_START]
const SINGLE_CHANNEL_OBJECTS: {[key: string]: [number, boolean][]} = {
    xs2_11: [[10, false], ],
};
// the single-channel object to start with
const SINGLE_CHANNEL_START: [string, number] = ['xs2_11', 10];

// the minimum spacing between single-channel gliders
const MIN_SPACING = 20;

// the number of generations it should take a glider to get to the object, dependant on GLIDER_SPACING
const WAIT_GENERATIONS = 192;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 64;
// the number of population periods to repeat to make sure it's stable
const PERIOD_SECURITY = 16;
// this is optional, they enable a RSS-like period filter (see https://conwaylife.com/forums/viewtopic.php?f=9&t=7098&p=222961#p222961) that can help, set to null to disable
const VALID_POPULATION_PERIODS: null | number[] = [1];
// the extra generations to run after a collision, just to make sure
const EXTRA_GENERATIONS = 64;
// the generations to run the colorizing object separation for
const SEPARATOR_GENERATIONS = 1;
// the maximum separation between still lifes for them to be combined (this is useful because collisions generally require much more space around the stil life to work)
const MAX_PSEUDO_DISTANCE = 6;
// the limit for the number of lanes to search, if anything gets to this it assumes there was a problem and drops the object
const LANE_LIMIT = 128;

// don't change this
// the ones with 2 after them are flipped
type ShipDirection = 'NW' | 'NE' | 'SW' | 'SE' | 'N' | 'E' | 'S' | 'W' | 'NW2' | 'NE2' | 'SW2' | 'SE2' | 'N2' | 'E2' | 'S2' | 'W2';

/*
ok this is how this part works:
for each ship
determine the canonical phase, this should head southwest for diagonals or south for orthogonals
put that canonical phase in the height, width, and cells options, those are described below
then you tell it how to normalize it to an orientation of that phase
you should orient it like this, rotating 90 degrees each time:
NW: NE:
ooo .oo
o.. o.o
.o. ..o
SW: SE:
o.. .o.
o.o ..o
oo. ooo
then you provide a list of test cases, each case consists of a height, width, and population
for each case you provide a list of subcases, each subcase has the following format:
[cells: number[], dir: ShipDirection, timing: number][]
the cells let you actually test for the pattern that is the ship
here's an example
{
    height: 2,
    width: 3,
    population: 3,
    data: [
        [[2, 3, 4], 'NW', 0]
    ],
}
the cells argument tells you the indices of alive cells
you use a grid like this (for height 2 and width 3):
0 1 2
3 4 5
so [2, 3, 4] means that cells 2, 3, and 4 must be on, and therefore the pattern must look like this:
bbo$
oob!
then a direction
then a number of generations to run to get to the canonical phase
then a boolean of whether to flip it to get to the canonical phase
*/

interface ShipIdentification {
    height: number;
    width: number;
    cells: number[];
    data: {
        height: number;
        width: number;
        population: number;
        data: [cells: number[], dir: ShipDirection, timing: number][];
    }[];
}

const SHIP_IDENTIFICATION: {[key: string]: ShipIdentification} = {
    xq4_15: {
        height: 2,
        width: 3,
        cells: [2, 3, 4],
        data: [
            {
                height: 3,
                width: 2,
                population: 3,
                data: [
                    [[1, 2, 4], 'NW', 2],
                    [[0, 1, 4], 'NW', 1],
                    [[0, 3, 5], 'NE', 0],
                    [[0, 1, 5], 'NE', 3],
                    [[0, 2, 5], 'SW', 0],
                    [[0, 4, 5], 'SW', 3],
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
                    [[0, 1, 5], 'NE', 2],
                    [[0, 2, 5], 'NE', 1],
                    [[0, 4, 5], 'SW', 2],
                    [[0, 3, 5], 'SW', 1],
                    [[2, 3, 4], 'SE', 0],
                    [[2, 3, 5], 'SE', 3],
                ],
            },
        ],
    },
}

export {RULE, GLIDER_APGCODE, GLIDER_DX, GLIDER_DY, GLIDER_SLOPE, GLIDER_PERIOD, GLIDER_POPULATION_PERIOD, LANE_OFFSET, GLIDER_TARGET_SPACING, START_OBJECT, GLIDER_SPACING, SLOW_SALVO_PERIOD, SINGLE_CHANNEL_OBJECTS, SINGLE_CHANNEL_START, MIN_SPACING, WAIT_GENERATIONS, MAX_GENERATIONS, PERIOD_SECURITY, VALID_POPULATION_PERIODS, EXTRA_GENERATIONS, SEPARATOR_GENERATIONS, MAX_PSEUDO_DISTANCE, LANE_LIMIT, ShipDirection, SHIP_IDENTIFICATION};
