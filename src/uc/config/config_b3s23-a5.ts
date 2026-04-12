
// basic information

const RULE = 'B3/S23-a5';

// don't change this
// the ones with 2 after them are flipped from their canonical orientation, this only matters for non-glide-symmetric ships
type ShipDirection = 'N' | 'E' | 'S' | 'W' | 'NW' | 'NE' | 'SW' | 'SE' | 'N2' | 'E2' | 'S2' | 'W2' | 'NW2' | 'NE2' | 'SW2' | 'SE2';

// the spaceships being used

interface SpaceshipInfo {
    // yes this one should be the key
    code: string;
    dx: number;
    // this one should be greater than or equal to dx
    dy: number;
    period: number;
    slope: number;
    popPeriod: number;
    glideSymmetric: boolean;
    // now information about the ship itself
    // this is for the canonical (S for orthogonals, SE for diagonals, in between for obliques) phase, y * width + x
    height: number;
    width: number;
    cells: number[];
    // now for all 4 (or 8 if oblique) directions of the ship
    // yes this does mean repeating one of them...
    // you should orient it like this, rotating 90 degrees each time:
    // NW: NE:
    // ooo .oo
    // o.. o.o
    // .o. ..o
    // SW: SE:
    // o.. .o.
    // o.o ..o
    // oo. ooo
    identification: [height: number, width: number, pop: number, cells: number[], dir: ShipDirection][];
}

const SPACESHIPS: {[key: string]: SpaceshipInfo} = {
    
    'xq4_27': {
        code: 'xq4_27',
        dx: 0,
        dy: 1,
        period: 4,
        slope: 0,
        popPeriod: 4,
        glideSymmetric: false,
        height: 2,
        width: 3,
        cells: [1, 3, 4, 5],
        identification: [
            [2, 3, 4, [0, 1, 2, 4], 'N'],
            [2, 3, 4, [1, 3, 4, 5], 'S'],
            [3, 2, 4, [0, 2, 3, 4], 'W'],
            [3, 2, 4, [1, 2, 3, 5], 'E'],
        ],
    },

    'xq4_153': {
        code: 'xq4_153',
        dx: 1,
        dy: 1,
        period: 4,
        slope: 1,
        popPeriod: 1,
        glideSymmetric: true,
        height: 3,
        width: 3,
        cells: [1, 5, 6, 7, 8],
        identification: [
            [3, 3, 5, [0, 1, 2, 3, 7], 'NW'],
            [3, 3, 5, [1, 2, 3, 5, 8], 'NE'],
            [3, 3, 5, [0, 3, 5, 6, 7], 'SW'],
            [3, 3, 5, [1, 5, 6, 7, 8], 'SE'],
        ],
    },

};


// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 5;

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
const MAX_POPULATION_PERIOD: null | number = null;
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


// don't change this

export {RULE, SpaceshipInfo, SPACESHIPS, LANE_OFFSET, GLIDER_TARGET_SPACING, SalvoInfo, SALVO_INFO, ChannelInfo, CHANNEL_INFO, MAX_WAIT_GENERATIONS, MAX_GENERATIONS, ELBOW_MAX_GENERATIONS, MAX_POPULATION_PERIOD, PERIOD_SECURITY, CHECK_LINEAR_GROWTH, VALID_POPULATION_PERIODS, MAX_PSEUDO_DISTANCE, INJECTION_SPACING, MAX_ELBOW_POPULATION, MAX_CREATE_POPULATION, ShipDirection};
