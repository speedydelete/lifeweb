
// basic information

const RULE = 'B3/S23';

// the glider is the spaceship used for slow salvos and single channel recipes
const GLIDER_APGCODE = 'xq4_153';
const GLIDER_DX = 1;
// this one should be greater than or equal to GLIDER_DX
const GLIDER_DY = 1;
const GLIDER_PERIOD = 4;
const GLIDER_SLOPE = GLIDER_DX / GLIDER_DY;
const GLIDER_POPULATION_PERIOD = 1;

// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 5;

// the spacing (in cells) between a glider and the target
const GLIDER_TARGET_SPACING = 7;


// information for slow salvo synthesis

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
        startObject: 'xs4_33',
        gliderSpacing: 20,
        period: 2,
        intermediateObjects: ['xs4_33', 'xp2_111', 'xp2_7', 'xs6_696', 'xs6_2552', 'xs7_2596', 'xs7_4a96', 'xs7_69a4', 'xs7_6952', 'xs5_253', 'xs5_256', 'xs5_652', 'xs5_352', 'xs6_356', 'xs6_653', 'xs4_252', 'xs8_6996', 'xs7_25ac', 'xs7_ca52', 'xs7_35a4', 'xs7_4a53'],
        laneLimit: 128,
        maxRecipes: 5,
    },

};


// information about restricted-channel synthesis methods

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
    // the starting elbow
    start: {
        apgcode: string;
        lane: number;
        spacing: number;
    };
    // the valid elbow objects, should be a list of lane differences from starting elbow where it produces the reaction
    // for non-single-channel, use the lower-numbered lane, so the higher-numbered one is (hd number) + (the lane value)
    elbows: {[key: string]: number[]};
    // force a start sequence
    forceStart?: [number, number][];
    // the maximum possible next glider spacing (after a recipe)
    maxNextSpacing: number;
    // the minimum spacing in full diagonals between a hand object and the construction lane(s)
    minHandSpacing: number;
    // a filter for possibly useful recipes
    possiblyUsefulFilter: string[];
}

// you name the construction types whatever you want

const CHANNEL_INFO: {[key: string]: ChannelInfo} = {

    'Single-channel (14)': {
        aliases: ['sc14', 'sc'],
        channels: [0],
        period: 2,
        minSpacings: [[14]],
        minSpacing: 14,
        start: {
            apgcode: '33',
            lane: 9,
            spacing: 7,
        },
        elbows: {
            xs4_33: [2, 9],
            xs5_253: [10],
            xs5_652: [1],
            xs6_2552: [10],
            xs6_696: [1],
            xs8_6996: [1, 10],
        },
        maxNextSpacing: 512,
        minHandSpacing: 16,
        possiblyUsefulFilter: [/*'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401', 'xp3_s0111s0s1110szo0555o0o5550oz1044410144401', 'xp3_ggg07kg0gk70gggzwh0rah0har0hz1110s51015s0111'*/],
    },

    'Single-channel (61)': {
        aliases: ['sc61'],
        channels: [0],
        period: 2,
        minSpacings: [[61]],
        minSpacing: 61,
        start: {
            apgcode: '33',
            lane: 9,
            spacing: 7,
        },
        elbows: {
            xs4_33: [2, 9],
            xs5_253: [10],
            xs5_652: [1],
            xs6_2552: [10],
            xs6_696: [1],
            xs8_6996: [1, 10],
        },
        maxNextSpacing: 512,
        minHandSpacing: 16,
        possiblyUsefulFilter: [/*'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401', 'xp3_s0111s0s1110szo0555o0o5550oz1044410144401', 'xp3_ggg07kg0gk70gggzwh0rah0har0hz1110s51015s0111'*/],
    },

    'Single-channel (syringe)': {
        aliases: ['sc78'],
        channels: [0],
        period: 2,
        minSpacings: [[74]],
        minSpacing: 74,
        excludeSpacings: [[[76, 77]]],
        start: {
            apgcode: '33',
            lane: 9,
            spacing: 7,
        },
        elbows: {
            xs4_33: [2, 9],
            xs5_253: [10],
            xs5_652: [1],
            xs6_2552: [10],
            xs6_696: [1],
            xs8_6996: [1, 10],
        },
        maxNextSpacing: 512,
        minHandSpacing: 16,
        possiblyUsefulFilter: [/*'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401', 'xp3_s0111s0s1110szo0555o0o5550oz1044410144401', 'xp3_ggg07kg0gk70gggzwh0rah0har0hz1110s51015s0111'*/],
    },

    'Single-channel (90)': {
        aliases: ['sc90'],
        channels: [0],
        period: 2,
        minSpacings: [[90]],
        minSpacing: 90,
        start: {
            apgcode: '33',
            lane: 9,
            spacing: 7,
        },
        elbows: {
            xs4_33: [2, 9],
            xs5_253: [10],
            xs5_652: [1],
            xs6_2552: [10],
            xs6_696: [1],
            xs8_6996: [1, 10],
        },
        maxNextSpacing: 512,
        minHandSpacing: 16,
        possiblyUsefulFilter: [/*'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401', 'xp3_s0111s0s1110szo0555o0o5550oz1044410144401', 'xp3_ggg07kg0gk70gggzwh0rah0har0hz1110s51015s0111'*/],
    },

};


// information for how searches proceed

// the maximum number of generations it should take a glider to get to the object (dependant on GLIDER_TARGET_SPACING)
const MAX_WAIT_GENERATIONS = 60;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 384;
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

// information for spaceship identification

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

export {RULE, GLIDER_APGCODE, GLIDER_DX, GLIDER_DY, GLIDER_SLOPE, GLIDER_PERIOD, GLIDER_POPULATION_PERIOD, LANE_OFFSET, GLIDER_TARGET_SPACING, SalvoInfo, SALVO_INFO, ChannelInfo, CHANNEL_INFO, MAX_WAIT_GENERATIONS, MAX_GENERATIONS, MAX_POPULATION_PERIOD, PERIOD_SECURITY, CHECK_LINEAR_GROWTH, VALID_POPULATION_PERIODS, MAX_PSEUDO_DISTANCE, INJECTION_SPACING, ShipDirection, SHIP_IDENTIFICATION};
