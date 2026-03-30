
// basic information

const RULE = 'B2-ak5j/S12-k';

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

    'xq4_15': {
        code: 'xq4_15',
        dx: 1,
        dy: 1,
        period: 4,
        slope: 1,
        popPeriod: 1,
        glideSymmetric: true,
        height: 2,
        width: 3,
        cells: [2, 3, 4],
        identification: [
            [2, 3, 3, [1, 2, 3], 'NW'],
            [3, 2, 3, [0, 3, 5], 'NE'],
            [3, 2, 3, [0, 2, 5], 'SW'],
            [2, 3, 3, [2, 3, 4], 'SE'],
        ],
    },

};


// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 6;

// the spacing (in cells) between a glider and the target
const GLIDER_TARGET_SPACING = 5;


// information for slow salvo synthesis

interface SalvoInfo {
    // aliases for it, can be used in the CLI
    aliases?: string[];
    // the spaceship being used
    ship: SpaceshipInfo;
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
    // congruence restrictions on lane numbers: AND of OR's of [mod, value] pairs
    restriction?: [number, number][][];
}

// you name the construction types whatever you want

const SALVO_INFO: {[key: string]: SalvoInfo} = {

    'Slow salvo': {
        aliases: ['ss'],
        ship: SPACESHIPS['xq4_15'],
        startObject: 'xs2_11',
        gliderSpacing: 10,
        period: 1,
        intermediateObjects: ['xs2_11', 'xs2_3', 'xs3_111', 'xs3_7', 'xs3_13', 'xs3_31', 'xs3_32', 'xs3_23'],
        laneLimit: 128,
        maxRecipes: 2,
    },

    'Monochrome slow salvo': {
        aliases: ['mss'],
        ship: SPACESHIPS['xq4_15'],
        startObject: 'xs2_11',
        gliderSpacing: 10,
        period: 1,
        intermediateObjects: ['xs2_11', 'xs2_3'],
        laneLimit: 128,
        maxRecipes: 2,
        restriction: [[[2, 0]]],
    },

};


// information about restricted-channel synthesis methods

interface ChannelInfo {
    // aliases for it, can be used in the CLI
    aliases?: string[];
    // the spaceship being used
    ship: SpaceshipInfo;
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
