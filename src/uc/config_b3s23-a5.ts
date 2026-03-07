
// basic information

const RULE = 'B3/S23-a5';

// the glider is the spaceship used for slow salvos and single channel recipes
const GLIDER_APGCODE = 'xq4_27';
const GLIDER_DX = 0;
// this one should be greater than or equal to GLIDER_DX
const GLIDER_DY = 1;
const GLIDER_PERIOD = 4;
const GLIDER_SLOPE = GLIDER_DX / GLIDER_DY;
const GLIDER_POPULATION_PERIOD = 4;
const GLIDER_IS_GLIDE_SYMMETRIC = true;

// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 0;

// the spacing (in cells) between a glider and the target
const GLIDER_TARGET_SPACING = 7;


// information about slow salvo synthesis methods

interface SalvoInfo {
    // aliases for it, can be used in the cli
    aliases?: string[];
    // the starting elbow object
    startObject: string;
    // the spacing (in cells) between 2 gliders in a multi-glider salvo
    gliderSpacing: number;
    // the period, as in p2 slow salvo
    period: number;
    // the valid intermediate objects
    intermediateObjects: string[];
    // the limit for the number of lanes to search (during searching)
    laneLimit: number;
    // the maximum number of recipes to store for each outcome
    maxRecipes?: number;
}

// you name the construction types whatever you want

const SALVO_INFO: {[key: string]: SalvoInfo} = {

    'Slow salvo': {
        aliases: ['ss'],
        startObject: 'xp2_7',
        gliderSpacing: 20,
        period: 2,
        intermediateObjects: ['xp2_7', 'xp2_111', 'xp2_f', 'xp2_333', 'xs7_2596', 'xs7_4a96', 'xs7_69a4', 'xs7_6952', 'xs5_253', 'xs5_256', 'xs5_652', 'xs5_352', 'xs8_6996', 'xs6_696', 'xs6_2552', 'xs4_252', 'xs6_356', 'xs6_653', 'xp2_ff', 'xp2_3333', 'xs20_g8861688gz01168611'],
        laneLimit: 128,
        maxRecipes: 8,
    },

};


// information for restricted-channel synthesis methods

interface ChannelInfo {
    // aliases for it, can be used in the cli
    aliases?: string[];
    // the lanes for each channel, the first element of this should always be zero, the next should be the lane offsets
    channels: number[];
    // the period for output gliders (so it can be used to implement period n synthesis)
    period: number;
    // the minimum spacing between gliders on every combination of channels
    // format is a square 2D array for each channel, it should be mirrored across the diagonal
    // for 0hd, you can just do [[spacing]]
    minSpacings: number[][];
    // the minimum value of minSpacings
    minSpacing: number;
    // exclude these spacings, this makes it so you can do overclocking, same format as minSpacings except you provide an array
    excludeSpacings?: number[][][];
    // force a start sequence
    forceStart?: [number, number][];
    // the maximum possible next glider spacing (after a recipe)
    maxNextSpacing: number;
    // a filter for possibly useful recipes
    possiblyUsefulFilter: string[];
}

// you name the construction types whatever you want

const CHANNEL_INFO: {[key: string]: ChannelInfo} = {};


// information for how searches proceed

// the maximum number of generations it should take a glider to get to the object (dependant on GLIDER_TARGET_SPACING)
const MAX_WAIT_GENERATIONS = 60;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 384;
// MAX_GENERATIONS but for elbow checking, this should be pretty high
const ELBOW_MAX_GENERATIONS = 4096;
// the maximum population period, optional
const MAX_POPULATION_PERIOD: null | number = 2;
// whether to do linear growth checking
const CHECK_LINEAR_GROWTH = false;
// the number of population periods to repeat to make sure it's stable
const PERIOD_SECURITY = 16;
// this is optional, they enable a RSS-like period filter (see https://conwaylife.com/forums/viewtopic.php?f=9&t=7098&p=222961#p222961) that can help, set to null to disable
const VALID_POPULATION_PERIODS: null | number[] = null;

// the maximum separation between still lifes for them to be combined (this is useful because collisions generally require much more space around the stil life to work)
const MAX_PSEUDO_DISTANCE = 6;

// for channel searching, at what spacing to inject the gliders at (the default should be fine)
const INJECTION_SPACING = 2;
// for channel searching, the maximum elbow population
const MAX_ELBOW_POPULATION = 18;
// for channel searching, the maximum created object population
const MAX_CREATE_POPULATION = 18;


// information for spaceship identification

// don't change this
type ShipDirection = 'NW' | 'NE' | 'SW' | 'SE' | 'N' | 'E' | 'S' | 'W';

/*
ok this is how this part works:
the stuff that's not in the data property is simple, just provide the canonical phase you would like!
now for the stuff in the data property 
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
    xq4_27: {
        height: 2,
        width: 3,
        cells: [1, 3, 4, 5],
        data: [
            {
                height: 2,
                width: 3,
                population: 4,
                data: [
                    [[0, 1, 2, 4], 'N', 0],
                    [[1, 3, 4, 5], 'S', 0],
                ],
            },
            {
                height: 3,
                width: 2,
                population: 4,
                data: [
                    [[0, 2, 3, 4], 'W', 0],
                    [[1, 2, 3, 5], 'E', 0],
                ],
            },
            {
                height: 3,
                width: 3,
                population: 7,
                data: [
                    [[1, 3, 4, 5, 6, 7, 8], 'N', 3],
                    [[0, 1, 2, 3, 4, 5, 7], 'S', 3],
                    [[0, 1, 3, 4, 5, 6, 7], 'W', 3],
                    [[1, 2, 3, 4, 5, 7, 8], 'E', 3],
                ],
            },
            {
                height: 4,
                width: 3,
                population: 5,
                data: [
                    [[0, 1, 2, 7, 10], 'N', 2],
                    [[1, 4, 9, 10, 11], 'S', 2],
                ],
            },
            {
                height: 3,
                width: 4,
                population: 5,
                data: [
                    [[0, 4, 6, 7, 8], 'W', 0],
                    [[3, 4, 5, 7, 11], 'E', 0],
                ]
            },
            {
                height: 3,
                width: 3,
                population: 4,
                data: [
                    [[1, 4, 6, 8], 'N', 0],
                    [[0, 2, 4, 7], 'S', 0],
                    [[2, 3, 4, 8], 'W', 0],
                    [[0, 4, 5, 6], 'E', 0],
                ],
            },
        ],
    },
    xq4_153: {
        height: 3,
        width: 3,
        cells: [1, 5, 6, 7, 8],
        data: [
            {
                height: 3,
                width: 3,
                population: 5,
                data: [
                    [[0, 1, 2, 3, 7], 'NW', 0],
                    [[1, 3, 4, 6, 8], 'NW', 3],
                    [[0, 1, 3, 5, 6], 'NW', 2],
                    [[1, 2, 3, 4, 8], 'NW', 1],
                    [[1, 2, 3, 5, 8], 'NE', 0],
                    [[0, 1, 4, 5, 6], 'NE', 3],
                    [[0, 1, 2, 5, 7], 'NE', 2],
                    [[1, 4, 5, 6, 8], 'NE', 1],
                    [[0, 3, 5, 6, 7], 'SW', 0],
                    [[2, 3, 4, 7, 8], 'SW', 3],
                    [[1, 3, 6, 7, 8], 'SW', 2],
                    [[0, 2, 3, 4, 7], 'SW', 1],
                    [[1, 5, 6, 7, 8], 'SE', 0],
                    [[0, 2, 4, 5, 7], 'SE', 3],
                    [[2, 3, 5, 7, 8], 'SE', 2],
                    [[0, 4, 5, 6, 7], 'SE', 1],
                ],
            },
        ],
    },
};


// don't change this

export {RULE, GLIDER_APGCODE, GLIDER_DX, GLIDER_DY, GLIDER_SLOPE, GLIDER_PERIOD, GLIDER_POPULATION_PERIOD, GLIDER_IS_GLIDE_SYMMETRIC, LANE_OFFSET, GLIDER_TARGET_SPACING, SalvoInfo, SALVO_INFO, ChannelInfo, CHANNEL_INFO, MAX_WAIT_GENERATIONS, MAX_GENERATIONS, ELBOW_MAX_GENERATIONS, MAX_POPULATION_PERIOD, PERIOD_SECURITY, CHECK_LINEAR_GROWTH, VALID_POPULATION_PERIODS, MAX_PSEUDO_DISTANCE, INJECTION_SPACING, MAX_ELBOW_POPULATION, MAX_CREATE_POPULATION, ShipDirection, SHIP_IDENTIFICATION};
