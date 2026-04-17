
// basic information

const RULE = 'B3/S23';

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
    // whether the spaceship supports flipped recipes, for diagonals it's true if it's glide symmetric, for orthogonals it's true if it's statically symmetric
    supportsFlipped: boolean;
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

    'xq4_153': {
        code: 'xq4_153',
        dx: 1,
        dy: 1,
        period: 4,
        slope: 1,
        popPeriod: 1,
        supportsFlipped: true,
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

    'xq4_6frc': {
        code: 'xq4_6frc',
        dx: 0,
        dy: 1,
        period: 4,
        slope: 0,
        popPeriod: 2,
        supportsFlipped: false,
        height: 5,
        width: 4,
        cells: [0, 2, 7, 11, 12, 15, 17, 18, 19],
        identification: [
            [5, 4, 9, [0, 1, 2, 4, 7, 8, 12, 17, 19], 'N'],
            [4, 5, 9, [1, 2, 3, 4, 5, 9, 14, 15, 18], 'E'],
            [5, 4, 9, [0, 2, 7, 11, 12, 15, 17, 18, 19], 'S'],
            [4, 5, 9, [1, 4, 5, 10, 14, 15, 16, 17, 18], 'W'],
        ],
    },

    'xq4_27dee6': {
        code: 'xq4_27dee6',
        dx: 0,
        dy: 1,
        period: 4,
        slope: 0,
        popPeriod: 2,
        supportsFlipped: false,
        height: 6,
        width: 5,
        cells: [1, 3, 9, 10, 14, 19, 21, 24, 27, 28, 29],
        identification: [
            [6, 5, 11, [0, 1, 2, 5, 8, 10, 15, 19, 20, 26, 28], 'N'],
            [5, 6, 11, [1, 2, 3, 4, 5, 6, 11, 17, 18, 22, 26], 'E'],
            [6, 5, 11, [1, 3, 9, 10, 14, 19, 21, 24, 27, 28, 29], 'S'],
            [5, 6, 11, [3, 7, 11, 12, 18, 23, 24, 25, 26, 27, 28], 'W'],
        ],
    },

    'xq4_27deee6': {
        code: 'xq4_27deee6',
        dx: 0,
        dy: 1,
        period: 4,
        slope: 0,
        popPeriod: 2,
        supportsFlipped: false,
        height: 7,
        width: 5,
        cells: [1, 3, 9, 10, 14, 15, 19, 24, 26, 29, 32, 33, 34],
        identification: [
            [7, 5, 13, [0, 1, 2, 5, 8, 10, 15, 19, 20, 24, 25, 31, 33], 'N'],
            [5, 7, 13, [1, 2, 3, 4, 5, 6, 7, 13, 20, 21, 26, 30, 31], 'E'],
            [7, 5, 13, [1, 3, 9, 10, 14, 15, 19, 24, 26, 29, 32, 33, 34], 'S'],
            [5, 7, 13, [3, 4, 8, 13, 14, 21, 27, 28, 29, 30, 31, 32, 33], 'W'],
        ],
    },

};

// makes lane numbers more sane, set it to whatever makes most sense but make sure it's consistent bwetween people
const LANE_OFFSET = 5;

// the spacing (in cells) between a glider and the target
const GLIDER_TARGET_SPACING = 8;


// information about slow salvo synthesis methods

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
    // restriction on lane numbers
    restriction?: (lane: number) => boolean;
}

// you name the construction types whatever you want

const SALVO_INFO: {[key: string]: SalvoInfo} = {

    'Slow salvo': {
        aliases: ['ss'],
        ship: SPACESHIPS['xq4_153'],
        startObject: 'xs4_33',
        gliderSpacing: 60,
        period: 2,
        intermediateObjects: ['xs4_33', 'xp2_111', 'xp2_7', 'xs6_696', 'xs6_2552', 'xs7_2596', 'xs7_4a96', 'xs7_69a4', 'xs7_6952', 'xs5_253', 'xs5_256', 'xs5_652', 'xs5_352', 'xs6_356', 'xs6_653', 'xs4_252', 'xs8_6996', 'xs7_25ac', 'xs7_ca52', 'xs7_35a4', 'xs7_4a53'],
        laneLimit: 128,
        maxRecipes: 5,
    },

    'Monochrome slow salvo (even)': {
        aliases: ['msse'],
        ship: SPACESHIPS['xq4_153'],
        startObject: 'xs4_33',
        gliderSpacing: 20,
        period: 2,
        intermediateObjects: ['xs4_33'],
        laneLimit: 128,
        maxRecipes: 2,
        restriction(lane: number): boolean {
            return lane % 2 === 0;
        },
    },

    'Monochrome slow salvo (odd)': {
        aliases: ['msse'],
        ship: SPACESHIPS['xq4_153'],
        startObject: 'xs4_33',
        gliderSpacing: 20,
        period: 2,
        intermediateObjects: ['xs4_33'],
        laneLimit: 128,
        maxRecipes: 2,
        restriction(lane: number): boolean {
            return lane % 2 === 1;
        },
    },


};


// information for restricted-channel synthesis methods

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
    // the initial bound in the exponential search
    initialBound: number;
    // construction types that it can use recipes from
    compatibleWith: string[];
    // // restriction on the sum of the timing gaps
    // restriction?: (time: number) => boolean;
}

// you name the construction types whatever you want

const CHANNEL_INFO: {[key: string]: ChannelInfo} = {

    'Single-channel (14)': {
        aliases: ['sc14', 'sc'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[14]],
        minSpacing: 14,
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: ['Single-channel (15)', 'Single-channel (61)', 'Single-channel (syringe)', 'Single-channel (90)'],
    },

    'Single-channel (15)': {
        aliases: ['sc15'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[15]],
        minSpacing: 15,
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: ['Single-channel (61)', 'Single-channel (syringe)', 'Single-channel (90)'],
    },

    'Single-channel (61)': {
        aliases: ['sc61'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[61]],
        minSpacing: 61,
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: ['Single-channel (syringe)', 'Single-channel (90)'],
    },

    'Single-channel (69)': {
        aliases: ['sc69'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[69]],
        minSpacing: 69,
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: ['Single-channel (syringe)', 'Single-channel (90)'],
    },

    'Single-channel (syringe)': {
        aliases: ['sc78'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[74]],
        minSpacing: 74,
        excludeSpacings: [[[76, 77]]],
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: ['Single-channel (90)'],
    },

    'Single-channel (90)': {
        aliases: ['sc90'],
        ship: SPACESHIPS['xq4_153'],
        channels: [0],
        period: 2,
        minSpacings: [[90]],
        minSpacing: 90,
        maxNextSpacing: 512,
        initialBound: 16,
        compatibleWith: [],
    },

    // 'Single-channel (61) (twin bees assisted)': {
    //     aliases: ['sc61p46'],
    //     ship: SPACESHIPS['xq4_153'],
    //     channels: [0],
    //     period: 2,
    //     minSpacings: [[61]],
    //     minSpacing: 61,
    //     maxNextSpacing: 512,
    //     restriction(time: number): boolean {
    //         return time % 46 > 2;
    //     },
    // },

    // 'Single-channel (70) (twin bees assisted)': {
    //     aliases: ['sc70p46'],
    //     ship: SPACESHIPS['xq4_153'],
    //     channels: [0],
    //     period: 2,
    //     minSpacings: [[70]],
    //     minSpacing: 70,
    //     maxNextSpacing: 512,
    //     restriction(time: number): boolean {
    //         return time % 46 > 2;
    //     },
    // },

};


// information for how searches proceed

// the maximum number of generations it should take a glider to get to the object (dependant on GLIDER_TARGET_SPACING)
const MAX_WAIT_GENERATIONS = 60;
// the maximum number of generations it can take a collision to stabilize, collisions past this are reported as "unknown"
const MAX_GENERATIONS = 512;
// MAX_GENERATIONS but for elbow checking, this should be pretty high
const ELBOW_MAX_GENERATIONS = 4096;
// the maximum population period, optional
const MAX_POPULATION_PERIOD: null | number = null;
// whether to do linear growth checking
const CHECK_LINEAR_GROWTH = false;
// the number of population periods to repeat to make sure it's stable
const PERIOD_SECURITY = 128;
// this is optional, they enable a RSS-like period filter (see https://conwaylife.com/forums/viewtopic.php?f=9&t=7098&p=222961#p222961) that can help, set to null to disable
const VALID_POPULATION_PERIODS: null | number[] = null;

// the maximum separation between still lifes for them to be combined (this is useful because collisions generally require much more space around the stil life to work)
const MAX_PSEUDO_DISTANCE = 12;

// extra options for channel searching

// maximum number of generations for running (should be high but not infinite)
const MAX_CHANNEL_RUN_GENERATIONS = 1024;
// the created object population limit
const CREATE_SIZE_LIMIT = 16;
// overrides for the created object limit
const CREATE_SIZE_LIMIT_OVERRIDES: string[] = ['xs24_y1696z2552wgw2552zy1343', 'xs28_g88m952g8gz1218kid221', 'xs28_g8g259m88gz122dik8121'];
// the elbow population limit
const ELBOW_SIZE_LIMIT = 16;
// overrides for the elbow size limit
const ELBOW_SIZE_LIMIT_OVERRIDES: string[] = ['xs24_y1696z2552wgw2552zy1343', 'xs28_g88m952g8gz1218kid221', 'xs28_g8g259m88gz122dik8121'];


export {RULE, ShipDirection, SpaceshipInfo, SPACESHIPS, LANE_OFFSET, GLIDER_TARGET_SPACING, SalvoInfo, SALVO_INFO, ChannelInfo, CHANNEL_INFO, MAX_WAIT_GENERATIONS, MAX_GENERATIONS, ELBOW_MAX_GENERATIONS, MAX_POPULATION_PERIOD, PERIOD_SECURITY, CHECK_LINEAR_GROWTH, VALID_POPULATION_PERIODS, MAX_PSEUDO_DISTANCE, MAX_CHANNEL_RUN_GENERATIONS, CREATE_SIZE_LIMIT, CREATE_SIZE_LIMIT_OVERRIDES, ELBOW_SIZE_LIMIT, ELBOW_SIZE_LIMIT_OVERRIDES};
