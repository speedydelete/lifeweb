
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
// the speed limit in the direction the ship moves as a period
const SPEED_LIMIT = 4;

// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 6;

// the spacing (in cells) between the glider and the target
const GLIDER_TARGET_SPACING = 7;

// the starting object for slow-salvo syntheses
const START_OBJECT = 'xs2_11';
// the spacing (in cells) between 2 gliders in a multi-glider slow salvo
const GLIDER_SPACING = 10;
// the period of slow salvos
const SLOW_SALVO_PERIOD = 1;
// the valid intermediate objects in slow salvos
const INTERMEDIATE_OBJECTS = ['xs2_11', 'xs2_3', 'xs3_111', 'xs3_7', 'xs4_1111', 'xs4_f', 'xs5_11111', 'xs5_v', 'xs3_13', 'xs3_31', 'xs3_32', 'xs3_23', 'xs4_36', 'xs4_63', 'xs4_231', 'xs4_132', 'xs5_174', 'xs5_471', 'xs5_623', 'xs5_326', 'xs5_136', 'xs5_631', 'xs5_463', 'xs5_364', 'xs7_2596', 'xs7_6952', 'xs7_4a96', 'xs7_69a4', 'xs6_25a4', 'xs6_4a52'];

// information about single-channel (0hd), double-channel (>0hd), and/or even higher numbers of channels (i don't even think anyone has used this, but i support it anyway) construction
// in this file we do 1hd double-channel construction

interface ChannelInfo {
    // the lanes for each channel, the first element of this should always be zero, the next should be the lane offsets
    channels: number[];
    // the minimum spacing between gliders on every combination of channels
    // format is a square 2D array for each channel, it should be mirrored across the diagonal
    // for 0hd, you can just do [[spacing]]
    minSpacings: number[][];
    // the minimum value of minSpacings
    minSpacing: number;
    // exclude these spacings, this makes it so you can do overclocking, same format as minSpacings except you provide an array
    excludeSpacings?: number[][][];
    // the starting elbow, format is [unprefixed apgcode, lane number]
    start: [string, number];
    // the valid elbow objects, format is [lane difference from starting elbow, then whether it is flipped from the starting elbow]
    // for non-single-channel, use the lower-numbered lane, so the higher-numbered one is (hd number) + (the lane value)
    elbows: {[key: string]: {[key: number]: boolean}};
    // force a start sequence
    forceStart?: [number, number][];
}

// you name them whatever you want

const CHANNEL_INFO: {[key: string]: ChannelInfo} = {
    '1hd': {
        channels: [0, 1],
        minSpacings: [[20, 22], [22, 20]],
        minSpacing: 20,
        excludeSpacings: [[[], [23]], [[23], []]],
        start: ['11', 8],
        elbows: {
            xs2_11: {8: false},
        },
    },
};

// the minimum spacing in full diagonals between a hand block and the construction lanes
const MIN_HAND_SPACING = 10;

// the number of generations it should take a glider to get to the object, dependant on GLIDER_SPACING
const WAIT_GENERATIONS = 192;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 256;
// the number of population periods to repeat to make sure it's stable
const PERIOD_SECURITY = 16;
// this is optional, they enable a RSS-like period filter (see https://conwaylife.com/forums/viewtopic.php?f=9&t=7098&p=222961#p222961) that can help, set to null to disable
const VALID_POPULATION_PERIODS: null | number[] = null;
// the extra generations to run after a collision, just to make sure
const EXTRA_GENERATIONS = 64;
// the maximum separation between still lifes for them to be combined (this is useful because collisions generally require much more space around the stil life to work)
const MAX_PSEUDO_DISTANCE = 6;
// the limit for the number of lanes to search, if anything gets to this it assumes there was a problem and drops the object
const LANE_LIMIT = 128;

// the maximum number of slow salvo recipes to store for each outcome
const MAX_SS_RECIPES = 5;

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

export {RULE, GLIDER_APGCODE, GLIDER_DX, GLIDER_DY, GLIDER_SLOPE, GLIDER_PERIOD, GLIDER_POPULATION_PERIOD, SPEED_LIMIT, LANE_OFFSET, GLIDER_TARGET_SPACING, START_OBJECT, GLIDER_SPACING, SLOW_SALVO_PERIOD, INTERMEDIATE_OBJECTS, ChannelInfo, CHANNEL_INFO, MIN_HAND_SPACING, WAIT_GENERATIONS, MAX_GENERATIONS, PERIOD_SECURITY, VALID_POPULATION_PERIODS, EXTRA_GENERATIONS, MAX_PSEUDO_DISTANCE, LANE_LIMIT, MAX_SS_RECIPES, ShipDirection, SHIP_IDENTIFICATION};
