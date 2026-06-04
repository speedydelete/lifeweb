
#include <stdbool.h>
#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>


// for checking static:
// \n(?!#|//|static|\n|    |\}|typedef)
// for checking inline:
// (?<=\n)static [^ (]+ (?!main|run_depth|set_cell|get_forward_big_tr|_get_possible_trs)[a-zA-Z_]+\(

// BEGIN CONFIGURATION

// the default search will find the glider (i think)

// for transition lookup tables the indexing is like
// 8 5 2
// 7 4 1
// 6 3 0
// where the bitstring is 0b876543210

// the search area should be padded on all sides by 2 cells unless otherwise specified below (then it is padded by 1 cell)

// height and width of the bounding box
#define HEIGHT 8
#define WIDTH 8

// number of generations of the object we are looking for, period + 1 for periodic objects..
#define GENS 5

// the number of variables
#define VAR_COUNT 9
// the maximum number of uses of any single variable
#define MAX_VAR_USES 2

// the type of cells
// 0 = dead, 1 = alive, 2 = unknown, 3 = undefined behavior, >3 = variables (but indexed more complicated)
// the variable indexing for this is 6 + 4*variable (so the binary always ends in 10, so we can do ANDing and ensure that it's unknown)
typedef uint8_t cell_t;

// the number of unknown cells
#define TOTAL_UNKNOWN_CELLS 66

// defines what it is searching for
static cell_t initial_grid[GENS][HEIGHT][WIDTH] = {{{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 6, 10, 14, 0, 0, 0}, {0, 0, 18, 22, 26, 0, 0, 0}, {0, 0, 30, 34, 38, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 6, 10, 14, 0, 0}, {0, 0, 0, 18, 22, 26, 0, 0}, {0, 0, 0, 30, 34, 38, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}};

// the order that cells are searched in
// format is {t, x, y}
static int search_order[TOTAL_UNKNOWN_CELLS][3] = {{0, 2, 2}, {0, 3, 2}, {0, 4, 2}, {0, 2, 3}, {0, 3, 3}, {0, 4, 3}, {0, 2, 4}, {0, 3, 4}, {0, 4, 4}, {1, 2, 2}, {1, 3, 2}, {1, 4, 2}, {1, 5, 2}, {1, 2, 3}, {1, 3, 3}, {1, 4, 3}, {1, 5, 3}, {1, 2, 4}, {1, 3, 4}, {1, 4, 4}, {1, 5, 4}, {1, 2, 5}, {1, 3, 5}, {1, 4, 5}, {1, 5, 5}, {2, 2, 2}, {2, 3, 2}, {2, 4, 2}, {2, 5, 2}, {2, 2, 3}, {2, 3, 3}, {2, 4, 3}, {2, 5, 3}, {2, 2, 4}, {2, 3, 4}, {2, 4, 4}, {2, 5, 4}, {2, 2, 5}, {2, 3, 5}, {2, 4, 5}, {2, 5, 5}, {3, 2, 2}, {3, 3, 2}, {3, 4, 2}, {3, 5, 2}, {3, 2, 3}, {3, 3, 3}, {3, 4, 3}, {3, 5, 3}, {3, 2, 4}, {3, 3, 4}, {3, 4, 4}, {3, 5, 4}, {3, 2, 5}, {3, 3, 5}, {3, 4, 5}, {3, 5, 5}, {4, 3, 3}, {4, 4, 3}, {4, 5, 3}, {4, 3, 4}, {4, 4, 4}, {4, 5, 4}, {4, 3, 5}, {4, 4, 5}, {4, 5, 5}};

// whether to do multi-rule searching
#define MULTI_RULE true

// the transition lookup table for the rule
// if multi-rule, rule-dependent ones are 3
static
#if !MULTI_RULE
const
#endif
uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

#if !MULTI_RULE

// special single-rule parameters

// the rulestring
#define RULE "B3/S23"

// whether to check backwards implications
#define CHECK_BACKWARDS_IMPLICATIONS true

#else

// special multi-rule parameters

// the base-2 logarithm of the number of rules in the rulespace
#define MAX_RULE_CHANGES 512

// // the transitions that are allowed to change
// // indexing: B0c, B1c, B1e, B2a, B2c, B2e, ..., B7e, B8c, S0c, S1c, ..., S7e, S8c
// static const bool change_trs[102] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

// whether to check backwards implications
// this is not supported yet for multi-rule
#define CHECK_BACKWARDS_IMPLICATIONS false

#endif

// can be set to e.g. "History" or ":T20,20" during configuration
#define SPECIAL_AFTER_RULE ""

// edge modes, this lets it search for waves/wicks/agars
// this also defines expected values for initial_grid

// the corresponding side has 2 extra blank slices of padding
#define NONE 0
// the corresponding side has 1 extra slice and it's a duplicate of the slice before it
#define EVEN 1
// the corresponding side has 1 extra slice and it's a duplicate of the slice 2 slices before it
#define ODD 2
// the corresponding side has 1 extra slice and it's a duplicate of the last slice on the other side
// if being used you should replace these with the "real" width and the "real" height
#define WRAP_WIDTH width
#define WRAP_HEIGHT height

#define TOP NONE
#define BOTTOM NONE
#define LEFT NONE
#define RIGHT NONE

// initial value for unknown cells
#define INITIAL_VALUE 0

// whether to check if the output is empty or not
#define CHECK_EMPTY true

// whether to filter duplicates or not
#define FILTER_DUPLICATES true

// maximum population
// #define MAXPOP 67

// solution filtering

#define FILTERING false

// whether to keep track of various things
#define TRACK_PHASE_POPS false

// don't change these types
typedef struct search_state {
    cell_t grid[GENS][HEIGHT][WIDTH];
    int set_cells;
    #ifdef MAXPOP
    #if !TRACK_PHASE_POPS
    #define SPECIAL_PHASE_0_POP
    int phase_0_pop;
    #endif
    #endif
    #if TRACK_PHASE_POPS
    int phase_pops[GENS];
    #endif
} search_state;
typedef cell_t grid_item_t[WIDTH];

// filtering
#if FILTERING
static inline bool solution_filter(search_state* state) {return true;}
#endif

// benchmarking iterations
// #define BENCHMARK 67

// debug level
#define DEBUG 0

// END CONFIGURATION


#define UNKNOWN 2
#define IS_KNOWN(x) ((x) < UNKNOWN)

#define VAR_TO_CELL_VAR(x) (6 + 4*(x))
#define CELL_VAR_TO_VAR(x) (((x) >> 2) - 1)

#if MULTI_RULE

#define TOTAL_MAX_DEPTH TOTAL_UNKNOWN_CELLS + MAX_RULE_CHANGES

#define TR_TO_BIG_TR(x) ((x) & 1) | (((x) & 2) << 1) | (((x) & 4) << 2) | (((x) & 8) << 3) | (((x) & 16) << 4) | (((x) & 32) << 5) | (((x) & 64) << 6) | (((x) & 128) << 7) | (((x) & 256) << 8)
#define BIG_TR_TO_TR(x) ((x) & 1) | (((x) >> 1) & 2) | (((x) >> 2) & 4) | (((x) >> 3) & 8) | (((x) >> 4) & 16) | (((x) >> 5) & 32) | (((x) >> 6) & 64) | (((x) >> 7) & 128) | (((x) >> 8) & 256)

#define INT_TRANSITION_COUNT 102
#define MAX_MAP_TRS_PER_INT_TR 8
#define INT_NUMBER_COUNT 9
#define MAX_LETTERS_PER_INT_NUM 13

static const int int_transitions[INT_TRANSITION_COUNT][MAX_MAP_TRS_PER_INT_TR + 1] = {
    {0, -1, -1, -1, -1, -1, -1, -1, -1},
    {4, 256, 1, 64, -1, -1, -1, -1, -1},
    {2, 128, 8, 32, -1, -1, -1, -1, -1},
    {6, 384, 3, 9, 72, 36, 192, 288, -1},
    {5, 320, 65, 260, -1, -1, -1, -1, -1},
    {34, 160, 10, 136, -1, -1, -1, -1, -1},
    {130, 40, -1, -1, -1, -1, -1, -1, -1},
    {66, 129, 258, 264, 12, 96, 132, 33, -1},
    {68, 257, -1, -1, -1, -1, -1, -1, -1},
    {38, 416, 11, 200, -1, -1, -1, -1, -1},
    {69, 321, 261, 324, -1, -1, -1, -1, -1},
    {42, 168, 138, 162, -1, -1, -1, -1, -1},
    {292, 73, 7, 448, -1, -1, -1, -1, -1},
    {137, 74, 164, 224, 35, 392, 290, 14, -1},
    {98, 161, 266, 140, -1, -1, -1, -1, -1},
    {37, 352, 13, 67, 193, 262, 328, 388, -1},
    {100, 289, 265, 259, 196, 70, 76, 385, -1},
    {131, 194, 134, 104, 41, 296, 386, 44, -1},
    {133, 322, 97, 268, -1, -1, -1, -1, -1},
    {420, 294, 201, 39, 480, 15, 75, 456, -1},
    {325, -1, -1, -1, -1, -1, -1, -1, -1},
    {170, -1, -1, -1, -1, -1, -1, -1, -1},
    {45, 360, 195, 390, -1, -1, -1, -1, -1},
    {169, 106, 172, 226, 163, 394, 298, 142, -1},
    {99, 225, 270, 330, 141, 354, 396, 165, -1},
    {356, 293, 329, 263, 452, 71, 77, 449, -1},
    {102, 417, 267, 204, -1, -1, -1, -1, -1},
    {139, 202, 166, 232, 43, 424, 418, 46, -1},
    {135, 450, 105, 300, -1, -1, -1, -1, -1},
    {228, 291, 393, 78, -1, -1, -1, -1, -1},
    {389, 326, 197, 101, 353, 269, 323, 332, -1},
    {198, 387, 297, 108, -1, -1, -1, -1, -1},
    {457, 79, 484, 295, -1, -1, -1, -1, -1},
    {426, 174, 234, 171, -1, -1, -1, -1, -1},
    {453, 327, 357, 333, -1, -1, -1, -1, -1},
    {203, 422, 488, 47, -1, -1, -1, -1, -1},
    {358, 421, 331, 271, 460, 103, 205, 481, -1},
    {397, 334, 229, 355, -1, -1, -1, -1, -1},
    {458, 143, 482, 428, 302, 233, 167, 107, -1},
    {395, 206, 230, 236, 299, 425, 419, 110, -1},
    {364, 301, 361, 391, 454, 199, 109, 451, -1},
    {362, 173, 398, 227, -1, -1, -1, -1, -1},
    {489, 111, 492, 486, 423, 459, 303, 207, -1},
    {490, 175, 430, 235, -1, -1, -1, -1, -1},
    {461, 335, 485, 359, -1, -1, -1, -1, -1},
    {365, 455, -1, -1, -1, -1, -1, -1, -1},
    {429, 366, 237, 231, 483, 399, 363, 462, -1},
    {427, 238, -1, -1, -1, -1, -1, -1, -1},
    {491, 239, 494, 431, -1, -1, -1, -1, -1},
    {493, 367, 487, 463, -1, -1, -1, -1, -1},
    {495, -1, -1, -1, -1, -1, -1, -1, -1},
    {16, -1, -1, -1, -1, -1, -1, -1, -1},
    {20, 272, 17, 80, -1, -1, -1, -1, -1},
    {18, 144, 24, 48, -1, -1, -1, -1, -1},
    {22, 400, 19, 25, 88, 52, 208, 304, -1},
    {21, 336, 81, 276, -1, -1, -1, -1, -1},
    {50, 176, 26, 152, -1, -1, -1, -1, -1},
    {146, 56, -1, -1, -1, -1, -1, -1, -1},
    {82, 145, 274, 280, 28, 112, 148, 49, -1},
    {84, 273, -1, -1, -1, -1, -1, -1, -1},
    {54, 432, 27, 216, -1, -1, -1, -1, -1},
    {85, 337, 277, 340, -1, -1, -1, -1, -1},
    {58, 184, 154, 178, -1, -1, -1, -1, -1},
    {308, 89, 23, 464, -1, -1, -1, -1, -1},
    {153, 90, 180, 240, 51, 408, 306, 30, -1},
    {114, 177, 282, 156, -1, -1, -1, -1, -1},
    {53, 368, 29, 83, 209, 278, 344, 404, -1},
    {116, 305, 281, 275, 212, 86, 92, 401, -1},
    {147, 210, 150, 120, 57, 312, 402, 60, -1},
    {149, 338, 113, 284, -1, -1, -1, -1, -1},
    {436, 310, 217, 55, 496, 31, 91, 472, -1},
    {341, -1, -1, -1, -1, -1, -1, -1, -1},
    {186, -1, -1, -1, -1, -1, -1, -1, -1},
    {61, 376, 211, 406, -1, -1, -1, -1, -1},
    {185, 122, 188, 242, 179, 410, 314, 158, -1},
    {115, 241, 286, 346, 157, 370, 412, 181, -1},
    {372, 309, 345, 279, 468, 87, 93, 465, -1},
    {118, 433, 283, 220, -1, -1, -1, -1, -1},
    {155, 218, 182, 248, 59, 440, 434, 62, -1},
    {151, 466, 121, 316, -1, -1, -1, -1, -1},
    {244, 307, 409, 94, -1, -1, -1, -1, -1},
    {405, 342, 213, 117, 369, 285, 339, 348, -1},
    {214, 403, 313, 124, -1, -1, -1, -1, -1},
    {473, 95, 500, 311, -1, -1, -1, -1, -1},
    {442, 190, 250, 187, -1, -1, -1, -1, -1},
    {469, 343, 373, 349, -1, -1, -1, -1, -1},
    {219, 438, 504, 63, -1, -1, -1, -1, -1},
    {374, 437, 347, 287, 476, 119, 221, 497, -1},
    {413, 350, 245, 371, -1, -1, -1, -1, -1},
    {474, 159, 498, 444, 318, 249, 183, 123, -1},
    {411, 222, 246, 252, 315, 441, 435, 126, -1},
    {380, 317, 377, 407, 470, 215, 125, 467, -1},
    {378, 189, 414, 243, -1, -1, -1, -1, -1},
    {505, 127, 508, 502, 439, 475, 319, 223, -1},
    {506, 191, 446, 251, -1, -1, -1, -1, -1},
    {477, 351, 501, 375, -1, -1, -1, -1, -1},
    {381, 471, -1, -1, -1, -1, -1, -1, -1},
    {445, 382, 253, 247, 499, 415, 379, 478, -1},
    {443, 254, -1, -1, -1, -1, -1, -1, -1},
    {507, 255, 510, 447, -1, -1, -1, -1, -1},
    {509, 383, 503, 479, -1, -1, -1, -1, -1},
    {511, -1, -1, -1, -1, -1, -1, -1, -1},
};

static const char int_letters[INT_NUMBER_COUNT][MAX_LETTERS_PER_INT_NUM + 1] = {
    {'c', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 'e', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'k', 'n', 0, 0, 0, 0, 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 't', 'w', 'y', 'z', 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'k', 'n', 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 'e', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
};

#else

#define TOTAL_MAX_DEPTH TOTAL_UNKNOWN_CELLS

#endif

#if DEBUG >= 1
#define DPRINTF1 printf
#define DPRINTGRID1(state) print_grid(stdout, state)
#else
#define DPRINTF1(...)
#define DPRINTGRID1(state)
#endif

#if DEBUG >= 2
#define DPRINTF2 printf
#define DPRINTGRID2(state) print_grid(stdout, state)
#else
#define DPRINTF2(...)
#define DPRINTGRID2(state)
#endif

#if DEBUG >= 3
#define DPRINTF3 printf
#define DPRINTGRID3(state) print_grid(stdout, state)
#else
#define DPRINTF3(...)
#define DPRINTGRID3(state)
#endif

#if DEBUG >= 4
#define DPRINTF4 printf
#define DPRINTGRID4(state) print_grid(stdout, state)
#else
#define DPRINTF4(...)
#define DPRINTGRID4(state)
#endif

#if DEBUG >= 5
#define DPRINTF5 printf
#define DPRINTGRID5(state) print_grid(stdout, state)
#else
#define DPRINTF5(...)
#define DPRINTGRID5(state)
#endif

#if DEBUG >= 6
#define DPRINTF6 printf
#define DPRINTGRID6(state) print_grid(stdout, state)
#else
#define DPRINTF6(...)
#define DPRINTGRID6(state)
#endif

static int unknown_cells = TOTAL_UNKNOWN_CELLS;
static int max_depth = TOTAL_MAX_DEPTH;


// the transition lookup table for the 3-state rule including unknown cells
// the result is 3 if it's rule-dependent, and it's + 4 if it should be updated when changing the rule
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh
// 01 23 45
// 67 89 ab
// cd ef gh
static cell_t big_trs_forward[262144];

#if MULTI_RULE

static inline int unparse_transitions(char* out, int next_char, bool s) {
    int or = s ? (1 << 4) : 0;
    char seen_letters[MAX_LETTERS_PER_INT_NUM + 1];
    int trs_index = 0;
    for (int number = 0; number < 9; number++) {
        int num_letters = 0;
        for (int i = 0; i < MAX_LETTERS_PER_INT_NUM + 1; i++) {
            seen_letters[i] = 0;
        }
        int total_letters = 0;
        for (int i = 0; i < MAX_LETTERS_PER_INT_NUM + 1; i++) {
            char letter = int_letters[number][i];
            if (letter == 0) {
                break;
            }
            total_letters++;
            int tr = int_transitions[trs_index][0] | or;
            if (trs[tr] == 1) {
                seen_letters[num_letters++] = letter;
            }
            trs_index++;
        }
        if (num_letters == 0) {
            continue;
        }
        out[next_char++] = number + '0';
        if (num_letters == total_letters) {
            continue;
        } else if (num_letters > (total_letters % 2 == 0 ? (total_letters / 2) : (total_letters / 2 + 1))) {
            out[next_char++] = '-';
            for (int i = 0; i < total_letters; i++) {
                char letter = int_letters[number][i];
                if (!strchr(seen_letters, letter)) {
                    out[next_char++] = letter;
                }
            }
        } else {
            for (int i = 0; i < num_letters; i++) {
                out[next_char++] = seen_letters[i];
            }
        }
    }
    return next_char;
}

static inline void get_rule(char* out) {
    int next_char = 0;
    out[next_char++] = 'B';
    next_char = unparse_transitions(out, next_char, false);
    out[next_char++] = '/';
    out[next_char++] = 'S';
    next_char = unparse_transitions(out, next_char, true);
}

#endif


static search_state* states[TOTAL_MAX_DEPTH + 1];

static inline void copy_state(search_state* from, search_state* to) {
    memcpy(to, from, sizeof(search_state));
}

static inline void init_states(void) {
    search_state* state = malloc(sizeof(search_state));
    memcpy(state->grid, initial_grid, sizeof(initial_grid));
    state->set_cells = 0;
    #ifdef SPECIAL_PHASE_0_POP
    state->phase_0_pop = 0;
    #endif
    #if TRACK_PHASE_POPS
    for (int i = 0; i < GENS; i++) {
        state->phase_pops[i] = 0;
    }
    #endif
    states[0] = state;
    for (int i = 1; i < max_depth + 1; i++) {
        search_state* new_state = malloc(sizeof(search_state));
        copy_state(state, new_state);
        states[i] = new_state;
    }
}

static inline void free_states(void) {
    for (int i = 0; i < GENS; i++) {
        free(states[i]);
    }
}

static const char* LETTERS = ".o*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static inline void print_cell(FILE* stream, cell_t value) {
    if (value > 3) {
        value = CELL_VAR_TO_VAR(value) + 3;
    }
    if (value < 64) {
        fprintf(stream, "%c", LETTERS[value]);
    } else {
        fprintf(stream, "(%i)", value);
    }
}

static inline void print_grid(FILE* stream, search_state* state) {
    #if MULTI_RULE
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = 0;
    }
    get_rule(rule);
    fprintf(stream, "Grid (rule = %s, set_cells = %i):\n", rule, state->set_cells);
    #else
    fprintf(stream, "Grid (set_cells = %i):\n", state->set_cells);
    #endif
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                print_cell(stream, state->grid[t][y][x]);
            }
            fprintf(stream, "$\n");
        }
        if (t == GENS - 1) {
            fprintf(stream, "!\n");
        } else {
            fprintf(stream, "$\n");
        }
    }
}


// a list of where variables are used in
// format for each entry: {there_is_more, t, x, y}
static int var_uses[VAR_COUNT][MAX_VAR_USES][4];

static inline void init_var_uses(void) {
    int num_var_uses[VAR_COUNT];
    for (int i = 0; i < VAR_COUNT;i ++) {
        num_var_uses[i] = 0;
        for (int j = 0; j < MAX_VAR_USES; j++) {
            var_uses[i][j][0] = 0;
            var_uses[i][j][1] = 0;
            var_uses[i][j][2] = 0;
            var_uses[i][j][3] = 0;
        }
    }
    for (int t = 0; t < GENS; t++) {
        for (int y = (TOP == NONE ? 0 : 1); y < HEIGHT - (BOTTOM == NONE ? 0 : 1); y++) {
            for (int x = (LEFT == NONE ? 0 : 1); x < WIDTH - (RIGHT == NONE ? 0 : 1); x++) {
                cell_t value = initial_grid[t][y][x];
                if (value > 3) {
                    int var = CELL_VAR_TO_VAR(value);
                    int* data = var_uses[var][num_var_uses[var]++];
                    data[0] = 1;
                    data[1] = t;
                    data[2] = x;
                    data[3] = y;
                }
            }
        }
    }
}

static cell_t get_forward_big_tr(int prev, int tr, int depth) {
    int state = tr & 3;
    tr >>= 2;
    int next = prev << 1;
    // shortcut
    if (state == 3) {
        return 0;
    }
    if (depth == 8) {
        if (IS_KNOWN(state)) {
            return trs[next | state];
        } else {
            int a = trs[next | 0];
            // #ifdef MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            int b = trs[next | 1];
            // #ifdef MULTI_RULE
            // if (b == 3) {
            //     return 3;
            // }
            // #endif
            // unknown cell: if they disagree return unknown
            #ifdef MULTI_RULE
            return a == b ? (a == 3 ? 4 + UNKNOWN : a) : UNKNOWN;
            #else
            return a == b ? a : UNKNOWN;
            #endif
        }
    } else {
        if (IS_KNOWN(state)) {
            return get_forward_big_tr(next | state, tr, depth + 1);
        } else {
            int a = get_forward_big_tr(next | 0, tr, depth + 1);
            // #ifdef MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            int b = get_forward_big_tr(next | 1, tr, depth + 1);
            // #ifdef MULTI_RULE
            // if (b == 3) {
            //     return 3;
            // }
            // #endif
            // unknown cell: if they disagree return unknown
            #ifdef MULTI_RULE
            return a == b ? (a == 3 ? 4 + UNKNOWN : a) : UNKNOWN;
            #else
            return a == b ? a : UNKNOWN;
            #endif
        }
    }
}

#if CHECK_BACKWARDS_IMPLICATIONS

// backwards lookup table
// this is about as crazy as it sounds so hear me out
// (ok fine it's not that crazy all previous lifesrcs do this)
// we see what values of unknown cells we can set
// because we know that they won't be settable
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 23 45
// 67 89 ab -> ij
// cd ef gh
// return value is an int of the same format as the index but >> 2, so without ij
// do nothing = 2, set off = 0, set on = 1, contradiction = 3, do nothing for any cell = 15
static int big_trs_backward[1048576];

static inline int get_backward_big_tr(int tr) {
    if ((tr & 3) == UNKNOWN) {
        return 15;
    }
    // check for contradiction
    cell_t target = big_trs_forward[tr >> 2];
    if (target == UNKNOWN) {
        return 15;
    }
    if (target != (tr & 3)) {
        return 3;
    }
    int out = 0b101010101010101010;
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != 2) {
            continue;
        }
        int tr2 = tr & ~(3 << i);
        cell_t forward_0 = big_trs_forward[tr2 >> 2];
        bool zero_possible = forward_0 == target || forward_0 == UNKNOWN;
        cell_t forward_1 = big_trs_forward[(tr2 | (1 << i)) >> 2];
        bool one_possible = forward_1 == target || forward_1 == UNKNOWN;
        // if (tr == 131333) {
        //     printf("%i, zero: %i -> %i -> %s, one: %i -> %i -> %s, target = %i\n", i, tr2 >> 2, forward_0, zero_possible ? "true" : "false", (tr2 | (1 << i)) >> 2, forward_1, one_possible ? "true" : "false", target);
        // }
        if (one_possible && !zero_possible) {
            // must be 1
            out = (out & ~(3 << (i - 2))) | (1 << (i - 2));
        } else if (zero_possible && !one_possible) {
            // must be 0
            out = (out & ~(3 << (i - 2))) | (0 << (i - 2));
        } else if (!zero_possible && !one_possible) {
            // contradiction
            return 3;
        }
    }
    return out;
}

#endif

static inline void generate_big_trs(void) {
    for (int tr = 0; tr < 262144; tr++) {
        big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    }
    #if CHECK_BACKWARDS_IMPLICATIONS
    for (int tr = 0; tr < 1048576; tr++) {
        int value = get_backward_big_tr(tr);
        big_trs_backward[tr] = value == 0b101010101010101010 ? 15 : value;
    }
    #endif
}

// set_cell has different modes depending on its caller
typedef enum set_cell_mode_t {
    NORMAL,
    IMPLICATION,
} set_cell_mode_t;

static bool set_cell(search_state* state, int t, int x, int y, cell_t value, set_cell_mode_t mode);

#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
static int rule_dependent_tr = -1;
#endif

// check if the unknown cell can be set, and if so, set it, propagating checks
// returns false if contradiction (or rule-dependent), true if no contradiction
static inline bool check_forward_implication(search_state* state, int t, int x, int y) {
    if (t < 0 || t + 1 >= GENS || x <= 0 || x >= WIDTH - 1 || y <= 0 || y >= HEIGHT - 1) {
        return true;
    }
    // grid_item_t* grid = state->grid[t];
    grid_item_t* grid = state->grid[t];
    #define get(x, y) ((int)(grid[(y)][(x)] & 3))
    int tr = (get(x - 1, y - 1) << 16)
           | (get(x - 1, y) << 14)
           | (get(x - 1, y + 1) << 12)
           | (get(x, y - 1) << 10)
           | (get(x, y) << 8)
           | (get(x, y + 1) << 6)
           | (get(x + 1, y - 1) << 4)
           | (get(x + 1, y) << 2)
           | (get(x + 1, y + 1));
    #undef get
    int value = state->grid[t + 1][y][x];
    int tr_value = big_trs_forward[tr];
    DPRINTF4("Forward: t = %i, x = %i, y = %i, tr = %i, value = %i, tr_value = %i\n", t, x, y, tr, (int)value, (int)tr_value);
    #if MULTI_RULE
    if (tr_value >= 4) {
        tr_value -= 4;
    }
    if (tr_value == 3) {
        rule_dependent_tr = BIG_TR_TO_TR(tr);
        return false;
    }
    #endif
    if (value != tr_value) {
        if (IS_KNOWN(tr_value)) {
            if (IS_KNOWN(value)) {
                DPRINTGRID4(state);
                DPRINTF4("Contradiction (forward, both known and unequal, t = %i, x = %i, y = %i)\n", t, x, y);
                #if MULTI_RULE
                rule_dependent_tr = -1;
                #endif
                return false;
            } else {
                bool out = set_cell(state, t + 1, x, y, tr_value, IMPLICATION);
                if (!out) {
                    return false;
                }
            }
        }
    }
    return true;
}

#if CHECK_BACKWARDS_IMPLICATIONS

// returns false if contradiction, true if no contradiction
static inline bool check_backward_implication(search_state* state, int t, int x, int y) {
    if (t < 0 || t + 1 >= GENS
        || x <= (LEFT == NONE ? 1 : 0)
        || x >= (RIGHT == NONE ? WIDTH - 2 : WIDTH - 1)
        || y <= (TOP == NONE ? 1 : 0)
        || y >= (BOTTOM == NONE ? HEIGHT - 2 : HEIGHT - 1)) {
        return true;
    }
    grid_item_t* grid = state->grid[t];
    #define get(x, y) ((int)(grid[(y)][(x)] & 3))
    int tr = (get(x - 1, y - 1) << 18)
           | (get(x - 1, y) << 16)
           | (get(x - 1, y + 1) << 14)
           | (get(x, y - 1) << 12)
           | (get(x, y) << 10)
           | (get(x, y + 1) << 8)
           | (get(x + 1, y - 1) << 6)
           | (get(x + 1, y) << 4)
           | (get(x + 1, y + 1) << 2)
           | (((int)(state->grid[t + 1][y][x] & 3)));
    #undef get
    int value = big_trs_backward[tr];
    if (value == 15) {
        return true;
    } else if (value == 3) {
        DPRINTGRID4(state);
        DPRINTF4("Contradiction (backward, value = 3, tr = %i, t = %i, x = %i, y = %i)\n", tr, t, x, y);
        return false;
    }
    #define check(x, y, value) if (!set_cell(state, t, (x), (y), (value), NORMAL)) {return false;}
    if ((value & 3) != 2) {
        check(x + 1, y + 1, value & 3);
    }
    if (((value >> 2) & 3) != 2) {
        check(x + 1, y, (value >> 2) & 3);
    }
    if (((value >> 4) & 3) != 2) {
        check(x + 1, y - 1, (value >> 4) & 3);
    }
    if (((value >> 6) & 3) != 2) {
        check(x, y + 1, (value >> 6) & 3);
    }
    if (((value >> 8) & 3) != 2) {
        check(x, y, (value >> 8) & 3);
    }
    if (((value >> 10) & 3) != 2) {
        check(x, y - 1, (value >> 10) & 3);
    }
    if (((value >> 12) & 3) != 2) {
        check(x - 1, y + 1, (value >> 12) & 3);
    }
    if (((value >> 14) & 3) != 2) {
        check(x - 1, y, (value >> 14) & 3);
    }
    if (((value >> 16) & 3) != 2) {
        check(x - 1, y - 1, (value >> 16) & 3);
    }
    #undef check
    return true;
}

#endif

#if CHECK_BACKWARDS_IMPLICATIONS
#define CHECK_IMPLICATIONS(state, t, x, y) ( \
    check_forward_implication((state), (t), (x), y) \
    && check_backward_implication((state), (t) - 1, (x), y) \
    && check_backward_implication((state), (t), (x), y) \
    && check_forward_implication((state), (t), (x) - 1, y - 1) \
    && check_forward_implication((state), (t), (x) - 1, y) \
    && check_forward_implication((state), (t), (x) - 1, y + 1) \
    && check_forward_implication((state), (t), (x), y - 1) \
    && check_forward_implication((state), (t), (x), y + 1) \
    && check_forward_implication((state), (t), (x) + 1, y - 1) \
    && check_forward_implication((state), (t), (x) + 1, y) && \
    check_forward_implication((state), (t), (x) + 1, y + 1))
#else
#define CHECK_IMPLICATIONS(state, t, x, y) ( \
    check_forward_implication((state), (t), (x), y) \
    && check_forward_implication((state), (t), (x) - 1, y - 1) \
    && check_forward_implication((state), (t), (x) - 1, y) \
    && check_forward_implication((state), (t), (x) - 1, y + 1) \
    && check_forward_implication((state), (t), (x), y - 1) \
    && check_forward_implication((state), (t), (x), y + 1) \
    && check_forward_implication((state), (t), (x) + 1, y - 1) \
    && check_forward_implication((state), (t), (x) + 1, y) && \
    check_forward_implication((state), (t), (x) + 1, y + 1))
#endif

static cell_t prev_values[MAX_VAR_USES];

// set a cell to a value, taking care of edges and filters but not propagating implications
static inline bool _set_cell(search_state* state, int t, int x, int y, cell_t value) {
    cell_t old = state->grid[t][y][x];
    if (IS_KNOWN(old) && old != value) {
        return false;
    }
    #ifdef SPECIAL_PHASE_0_POP
    if (t == 0 && value == 1) {
        state->phase_0_pop++;
        if (state->phase_0_pop > MAXPOP) {
            return false;
        }
    }
    #endif
    #if TRACK_PHASE_POPS
    if (value == 1) {
        state->phase_pops[t]++;
    }
    #endif
    state->set_cells++;
    state->grid[t][y][x] = value;
    #if TOP != NONE
    if (y == TOP) {
        state->grid[t][0][x] = value;
        #if LEFT != NONE
        if (x == LEFT) {
            state->grid[t][0][0] = value;
        }
        #endif
        #if RIGHT != NONE
        if (x == WIDTH - 1 - RIGHT) {
            state->grid[t][0][WIDTH - 1] = value;
        }
        #endif
    }
    #endif
    #if BOTTOM != NONE
    if (y == HEIGHT - 1 - LEFT) {
        state->grid[t][HEIGHT - 1][x] = value;
        #if LEFT != NONE
        if (x == LEFT) {
            state->grid[t][HEIGHT - 1][0] = value;
        }
        #endif
        #if RIGHT != NONE
        if (x == WIDTH - 1 - RIGHT) {
            state->grid[t][HEIGHT - 1][WIDTH - 1] = value;
        }
        #endif
    }
    #endif
    #if LEFT != NONE
    if (x == LEFT) {
        state->grid[t][y][0] = value;
    }
    #endif
    #if RIGHT != NONE
    if (x == WIDTH - 1 - RIGHT) {
        state->grid[t][y][WIDTH - 1] = value;
    }
    #endif
    return true;
}

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell(search_state* state, int t, int x, int y, cell_t value, set_cell_mode_t mode) {
    cell_t prev_value = state->grid[t][y][x];
    DPRINTF3("Setting cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", t, x, y, value, prev_value);
    DPRINTGRID4(state);
    if (IS_KNOWN(prev_value)) {
        return prev_value == value;
    } else if (prev_value < 4) {
        if (!_set_cell(state, t, x, y, value)) {
            return false;
        }
        return CHECK_IMPLICATIONS(state, t, x, y);
    }
    cell_t var = CELL_VAR_TO_VAR(prev_value);
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, t, x, y);
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        int t = var_uses[var][use][1];
        int x = var_uses[var][use][2];
        int y = var_uses[var][use][3];
        DPRINTF4("Read variable data: there_is_more = %i, t = %i, x = %i, y = %i\n", there_is_more, t, x, y);
        cell_t prev_value = state->grid[t][y][x];
        prev_values[use] = prev_value;
        if (IS_KNOWN(prev_value)) {
            if (prev_value != value) {
                return false;
            }
        } else {
            if (!_set_cell(state, t, x, y, value)) {
                return false;
            }
        }
        if (there_is_more == 0) {
            break;
        }
    }
    DPRINTF4("Checking variable set implications\n");
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        int t = var_uses[var][use][1];
        int x = var_uses[var][use][2];
        int y = var_uses[var][use][3];
        DPRINTF4("Read variable data: there_is_more = %i, t = %i, x = %i, y = %i\n", there_is_more, t, x, y);
        if (!IS_KNOWN(prev_values[use])) {
            if (!CHECK_IMPLICATIONS(state, t, x, y)) {
                return false;
            }
        }
        if (there_is_more == 0) {
            break;
        }
    }
    return true;
}


static inline double get_time() {
    return (double)(clock()) / CLOCKS_PER_SEC;
}

static double start;
static double last_progress_shown;


#ifndef BENCHMARK
static uint64_t solutions_found;
#endif

static uint64_t branches;

#if FILTER_DUPLICATES

typedef struct bb_t {
    int height;
    int width;
    int x_offset;
    int y_offset;
} bb_t;

static inline void get_true_bb(bb_t* bb, grid_item_t* grid) {
    bb->height = HEIGHT - 4;
    bb->width = WIDTH - 4;
    bb->x_offset = 2;
    bb->y_offset = 2;
    #define get(x, y) (grid[(y) + bb->y_offset][(x) + bb->x_offset])
    // top
    int shrink_top = 0;
    for (int y = 0; y < bb->height; y++) {
        bool found = false;
        for (int x = 0; x < bb->width; x++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_top++;
        }
    }
    bb->height -= shrink_top;
    bb->y_offset += shrink_top;
    // bottom
    int shrink_bottom = 0;
    for (int y = bb->height - 1; y >= 0; y--) {
        bool found = false;
        for (int x = 0; x < bb->width; x++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_bottom++;
        }
    }
    bb->height -= shrink_bottom;
    // left
    int shrink_left = 0;
    for (int x = 0; x < bb->width; x++) {
        bool found = false;
        for (int y = 0; y < bb->height; y++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_left++;
        }
    }
    bb->width -= shrink_left;
    bb->x_offset += shrink_left;
    // right
    int shrink_right = 0;
    for (int x = bb->width - 1; x >= 0; x--) {
        bool found = false;
        for (int y = 0; y < bb->height; y++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_right++;
        }
    }
    bb->width -= shrink_right;
}

typedef uint64_t hash_t;

static inline hash_t min_hash(hash_t a, hash_t b) {
    return a < b ? a : b;
}

typedef enum axis_trans_t {
    POS_X,
    POS_Y,
    NEG_X,
    NEG_Y,
} axis_trans_t;

static inline void transform_coords(bb_t* bb, int x, int y, axis_trans_t x_trans, axis_trans_t y_trans, int* x_out, int* y_out) {
    if (x_trans == POS_X) {
        *x_out = x;
    } else if (x_trans == POS_Y) {
        *x_out = y;
    } else if (x_trans == NEG_X) {
        *x_out = bb->width - x - 1;
    } else if (x_trans == NEG_Y) {
        *x_out = bb->width - y - 1;
    }
    if (y_trans == POS_X) {
        *y_out = x;
    } else if (y_trans == POS_Y) {
        *y_out = y;
    } else if (y_trans == NEG_X) {
        *y_out = bb->height - x - 1;
    } else if (y_trans == NEG_Y) {
        *y_out = bb->height - y - 1;
    }
    *x_out += bb->x_offset;
    *y_out += bb->y_offset;
}

#if MULTI_RULE

#define NO_OFFSET (67676767)

static inline hash_t hash_with_offset(search_state* state, int offset, axis_trans_t x_trans, axis_trans_t y_trans) {
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    hash_t out = 0xcbf29ce484222325ULL;
    int x_offset_0 = NO_OFFSET;
    int y_offset_0 = NO_OFFSET;
    for (int fake_t = 0; fake_t < GENS; fake_t++) {
        int t = (fake_t + offset) % GENS;
        bb_t bb;
        get_true_bb(&bb, state->grid[t]);
        int height = bb.height;
        int width = bb.width;
        if (transpose) {
            int temp = height;
            height = width;
            width = temp;
        }
        out ^= bb.height;
        out *= 0x00000100000001b3ULL;
        out ^= bb.width;
        out *= 0x00000100000001b3ULL;
        if (x_offset_0 == NO_OFFSET) {
            x_offset_0 = bb.x_offset;
            y_offset_0 = bb.y_offset;
            out *= 0x00000100000001b3ULL;
            out *= 0x00000100000001b3ULL;
        } else {
            out ^= bb.x_offset - x_offset_0;
            out *= 0x00000100000001b3ULL;
            out ^= bb.y_offset - y_offset_0;
            out *= 0x00000100000001b3ULL;
        }
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int real_x = 0;
                int real_y = 0;
                transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
                out ^= state->grid[t][real_y][real_x];
                out *= 0x00000100000001b3ULL;
            }
        }
    }
    return out;
}

static inline hash_t hash(search_state* state, axis_trans_t x_trans, axis_trans_t y_trans) {
    hash_t out = hash_with_offset(state, 0, x_trans, y_trans);
    for (int offset = 1; offset < GENS; offset++) {
        out = min_hash(out, hash_with_offset(state, offset, x_trans, y_trans));
    }
    return out;
}

static inline hash_t hash_state(search_state* state) {
    hash_t out = hash(state, POS_X, POS_Y);
    out = min_hash(out, hash(state, POS_X, NEG_Y));
    out = min_hash(out, hash(state, NEG_X, POS_Y));
    out = min_hash(out, hash(state, NEG_X, NEG_Y));
    out = min_hash(out, hash(state, POS_Y, POS_X));
    out = min_hash(out, hash(state, POS_Y, NEG_X));
    out = min_hash(out, hash(state, NEG_Y, POS_X));
    out = min_hash(out, hash(state, NEG_Y, NEG_X));
    return out;
}

#else

static inline hash_t hash(grid_item_t* grid, bb_t* bb, axis_trans_t x_trans, axis_trans_t y_trans) {
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    int height = bb->height;
    int width = bb->width;
    if (transpose) {
        int temp = height;
        height = width;
        width = temp;
    }
    hash_t out = 0xcbf29ce484222325ULL;
    out ^= bb->height;
    out *= 0x00000100000001b3ULL;
    out ^= bb->width;
    out *= 0x00000100000001b3ULL;
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int real_x = 0;
            int real_y = 0;
            transform_coords(bb, x, y, x_trans, y_trans, &real_x, &real_y);
            out ^= grid[real_y][real_x];
            out *= 0x00000100000001b3ULL;
        }
    }
    return out;
}

static inline hash_t octohash(grid_item_t* grid) {
    bb_t bb;
    get_true_bb(&bb, grid);
    hash_t out = hash(grid, &bb, POS_X, POS_Y);
    out = min_hash(out, hash(grid, &bb, POS_X, NEG_Y));
    out = min_hash(out, hash(grid, &bb, NEG_X, POS_Y));
    out = min_hash(out, hash(grid, &bb, NEG_X, NEG_Y));
    out = min_hash(out, hash(grid, &bb, POS_Y, POS_X));
    out = min_hash(out, hash(grid, &bb, POS_Y, NEG_X));
    out = min_hash(out, hash(grid, &bb, NEG_Y, POS_X));
    out = min_hash(out, hash(grid, &bb, NEG_Y, NEG_X));
    return out;
}

static inline hash_t hash_state(search_state* state) {
    hash_t out = octohash(state->grid[0]);
    for (int i = 1; i < GENS; i++) {
        out = min_hash(out, octohash(state->grid[i]));
    }
    return out;
}

#endif

static hash_t known_solutions[1048576];

static inline void init_known_solutions(void) {
    for (int i = 0; i < sizeof(known_solutions) / sizeof(hash_t); i++) {
        known_solutions[i] = 0;
    }
}

#endif

static inline void print_progress(FILE* stream, int depth);

static inline void print_solution(search_state* state, bool preprocessing, int depth) {
    #ifndef BENCHMARK
    DPRINTF2("Checking solution:\n");
    DPRINTGRID2(state);
    #if CHECK_EMPTY
    bool found = false;
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            if (state->grid[0][y][x] != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        DPRINTF2("Dropping solution (empty)\n");
        if (preprocessing) {
            printf("Solved in preprocessing, 0 solutions\n");
        }
        return;
    }
    #endif
    #if FILTERING
    if (!solution_filter(state)) {
        DPRINTF2("Dropping solution (filtered)\n");
        return;
    }
    #endif
    #if FILTER_DUPLICATES
    hash_t hash = hash_state(state);
    for (int i = 0; i < solutions_found; i++) {
        hash_t value = known_solutions[i];
        if (value == 0) {
            break;
        }
        if (hash == value) {
            DPRINTF2("Dropping solution (equal to solution %i)\n", i);
            return;
        }
    }
    if (solutions_found < sizeof(known_solutions) / sizeof(hash_t)) {
        known_solutions[solutions_found] = hash;
    }
    #endif
    solutions_found++;
    // #if DEBUG >= 2
    // for (int i = 0; i < depth; i++) {
    //     print_grid(stdout, states[i]);
    // }
    // #endif
    #if MULTI_RULE
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = 0;
    }
    get_rule(rule);
    #else
    char* rule = RULE;
    #endif
    if (preprocessing) {
        printf("Solved in preprocessing, 1 solution:\nx = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE"\n", rule);
    } else {
        printf("Solution found:\nx = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE"\n", rule);
    }
    int last_y = HEIGHT - (BOTTOM == NONE ? 2 : 1);
    for (int y = (TOP == NONE ? 2 : 1); y < last_y; y++) {
        for (int x = (LEFT == NONE ? 2 : 1); x < WIDTH - (RIGHT == NONE ? 2 : 1); x++) {
            cell_t value = state->grid[0][y][x];
            if (value > 1) {
                fprintf(stderr, "\n");
                print_grid(stderr, state);
                fprintf(stderr, "\nStatus: ");
                // print_progress(stderr, depth, 70);
                print_progress(stderr, depth);
                fprintf(stderr, "\nError: This error should not occur (unknown cell in solution)\nPlease report this error along with the debug information printed above\n");
                exit(1);
            }
            printf("%c", value ? 'o' : '.');
        }
        if (y == last_y - 1) {
            printf("!\n");
        } else {
            printf("$\n");
        }
    }
    #endif
}


#if MULTI_RULE

// static int possible_trs[TOTAL_MAX_DEPTH][512];
// static int possible_trs_counts[TOTAL_MAX_DEPTH];

// static inline void add_possible_tr(int tr, int loc) {
//     for (int i = 0; i < INT_TRANSITION_COUNT; i++) {
//         bool found = false;
//         for (int j = 0; j < INT_NUMBER_COUNT; j++) {
//             int value = int_transitions[i][j];
//             if (value == -1) {
//                 break;
//             } else if (value == tr) {
//                 found = true;
//                 break;
//             }
//         }
//         if (found) {
//             for (int j = 0; j < INT_NUMBER_COUNT; j++) {
//                 for (int k = 0; k < possible_trs_counts[loc]; k++) {
//                     if (possible_trs[loc][k] == int_transitions[i][j]) {
//                         return;
//                     }
//                 }
//             }
//             possible_trs[loc][possible_trs_counts[loc]] = tr;
//             possible_trs_counts[loc] += 1;
//             return;
//         }
//     }
//     fprintf(stderr, "\nError: This error should not occur (nonexistent transition: %i)\nPlease report this error\n", tr);
//     exit(1);
// }

// static void _get_possible_trs(int prev, int tr, int depth, int loc) {
//     int state = tr & 3;
//     tr >>= 2;
//     int next = prev << 1;
//     if (depth == 8) {
//         if (IS_KNOWN(state)) {
//             add_possible_tr(next | state, loc);
//         } else {
//             add_possible_tr(next | 0, loc);
//             add_possible_tr(next | 1, loc);
//         }
//     } else {
//         if (IS_KNOWN(state)) {
//             _get_possible_trs(next | state, tr, depth + 1, loc);
//         } else {
//             _get_possible_trs(next | 0, tr, depth + 1, loc);
//             _get_possible_trs(next | 1, tr, depth + 1, loc);
//         }
//     }
// }

// static inline void get_possible_trs(int tr, int depth) {
//     _get_possible_trs(0, tr, 0, depth);
// }

static int tr_to_int_tr[512];

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < 9; i++) {
        int tr2 = int_transitions[tr_to_int_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        trs[tr2] = value;
    }
    for (int tr = 0; tr < 262144; tr++) {
        if (big_trs_forward[tr] == 3 || big_trs_forward[tr] >= 4) {
            int value = get_forward_big_tr(0, tr, 0);
            if (value < 4) {
                value += 4;
            }
            big_trs_forward[tr] = value;
        }
    }
}

// static inline void set_possible_trs_to_value(int depth, int to_set, bool reset) {
//     for (int i = 0; i < possible_trs_counts[depth]; i++) {
//         int tr = possible_trs[depth][i];
//         int value = reset ? 3 : (to_set >> i) & 1;
//     }
// }

typedef struct set_tr_info {
    bool set;
    int cell;
    int tr;
    int value;
} set_tr_info;

set_tr_info set_tr_info_for_depth[TOTAL_MAX_DEPTH];

static inline void init_multi_rule() {
    for (int tr = 0; tr < 512; tr++) {
        bool found = false;
        for (int i = 0; i < INT_TRANSITION_COUNT; i++) {
            for (int j = 0; j < INT_NUMBER_COUNT; j++) {
                int value = int_transitions[i][j];
                if (value == -1) {
                    break;
                } else if (value == tr) {
                    found = true;
                    break;
                }
            }
            if (found) {
                tr_to_int_tr[tr] = i;
                break;
            }
        }
        if (!found) {
            fprintf(stderr, "\nError: This error should not occur (nonexistent transition: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
    for (int i = 0; i < TOTAL_MAX_DEPTH; i++) {
        set_tr_info_for_depth[i].set = false;
    }
}

static inline void print_progress(FILE* stream, int depth) {
    int search_order_pos = 0;
    for (int i = 0; i < depth; i++) {
        if (set_tr_info_for_depth[i].set) {
            int tr = set_tr_info_for_depth[i].tr;
            int value = set_tr_info_for_depth[i].value;
            char tr_str[4];
            if (tr & (1 << 4)) {
                tr &= ~(1 << 4);
                tr_str[0] = 'S';
            } else {
                tr_str[0] = 'B';
            }
            int index = 0;
            for (int i = 0; i < 9; i++) {
                bool found = false;
                for (int j = 0; j < 14; j++) {
                    char letter = int_letters[i][j];
                    if (letter == 0) {
                        break;
                    }
                    for (int k = 0; k < 9; k++) {
                        if (tr == int_transitions[index][k]) {
                            found = true;
                            if (i == 0 || i == 8) {
                                tr_str[1] = 0;
                                tr_str[2] = '\0';
                            }
                            tr_str[1] = i + '0';
                            tr_str[2] = letter;
                            tr_str[3] = '\0';
                            break;
                        }
                    }
                    if (found) {
                        break;
                    }
                    index++;
                }
                if (found) {
                    break;
                }
            }
            printf("[%s=%i]", tr_str, value);
        } else {
            int* cell = search_order[search_order_pos];
            search_order_pos++;
            cell_t value = states[depth - 1]->grid[cell[0]][cell[2]][cell[1]];
            printf("%c", value ? '1' : '0');
        }
    }
}

#else

static inline void print_progress(FILE* stream, int depth) {
    int search_order_pos = 0;
    for (int i = 0; i < depth; i++) {
        int* cell = search_order[search_order_pos];
        search_order_pos++;
        cell_t value = states[depth - 1]->grid[cell[0]][cell[2]][cell[1]];
        printf("%c", value ? '1' : '0');
    }
}

#endif

static void run_depth(int depth
    #if MULTI_RULE
    , int search_order_depth, int force_value
    #endif
    );

static inline void _run_depth(search_state* state, int* cell, cell_t value, int depth
    #if MULTI_RULE
    , int search_order_depth
    #endif
    ) {
    copy_state(states[depth - 1], state);
    if (set_cell(state, cell[0], cell[1], cell[2], value, NORMAL)) {
        #if MULTI_RULE
        run_depth(depth + 1, search_order_depth + 1, -1);
        #else
        run_depth(depth + 1);
        #endif
    #if MULTI_RULE
    } else if (rule_dependent_tr != -1) {
        int tr = rule_dependent_tr;
        // if (possible_trs_count == 0) {
        //     DPRINTF4("Skipping branching rule on transition %i (depth = %i)\n", tr, depth);
        //     continue;
        // }
        copy_state(states[depth - 1], state);
        set_tr_info_for_depth[depth].set = true;
        set_tr_info_for_depth[depth].tr = tr;
        DPRINTF3("Branching rule on transition %i (depth = %i)\n", tr, depth);
        set_tr_info_for_depth[depth].value = 0;
        set_tr(tr, 0);
        run_depth(depth + 1, search_order_depth, 0);
        set_tr_info_for_depth[depth].value = 1;
        set_tr(tr, 1);
        run_depth(depth + 1, search_order_depth, 1);
        set_tr(tr, 3);
        set_tr_info_for_depth[depth].set = false;
    #endif
    }
}

static void run_depth(int depth
    #if MULTI_RULE
    , int search_order_depth, int force_value
    #endif
    ) {
    #if DEBUG >= 3
    printf("Running depth %i: ", depth);
    print_progress(stdout, depth);
    printf("\n");
    #endif
    branches++;
    if (depth > max_depth || states[depth - 1]->set_cells == unknown_cells) {
        print_solution(states[depth - 1], false, depth);
        return;
    }
    search_state* state = states[depth];
    #if DEBUG >= 4
    copy_state(states[depth - 1], state);
    DPRINTGRID4(state);
    #endif
    double time = get_time();
    if (time - last_progress_shown > 1) {
        last_progress_shown = time;
        #ifndef BENCHMARK
        printf("%i seconds, %"PRIu64" branches, depth: %i, progress: ", (int)(time - start), branches, depth);
        print_progress(stderr, depth);
        printf("\n");
        #endif
    }
    #if MULTI_RULE
    int* cell = search_order[search_order_depth];
    #else
    int* cell = search_order[depth - 1];
    #endif
    if (IS_KNOWN(states[depth - 1]->grid[cell[0]][cell[2]][cell[1]])) {
        copy_state(states[depth - 1], state);
        #if MULTI_RULE
        run_depth(depth + 1, search_order_depth + 1, -1);
        #else
        run_depth(depth + 1);
        #endif
        return;
    }
    #if MULTI_RULE
    if (force_value == -1) {
    #endif
        #if INITIAL_VALUE == 0
        for (int value = 0; value < 2; value++)
        #else
        for (int value = 1; value >= 0; value--)
        #endif
        {
            #if MULTI_RULE
            _run_depth(state, cell, value, depth, search_order_depth);
            #else
            _run_depth(state, cell, value, depth);
            #endif
        }
    #if MULTI_RULE
    } else {
        _run_depth(state, cell, force_value, depth, search_order_depth);
    }
    #endif
}

int main(void) {
    init_states();
    init_var_uses();
    generate_big_trs();
    #if MULTI_RULE
    init_multi_rule();
    #else
    init_known_solutions();
    #endif
    search_state* state = states[0];
    DPRINTGRID2(state);
    // preprocessing: search for and remove trivial cells
    printf("Preprocessing\n");
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                if (!check_forward_implication(state, t, x, y)) {
                    #if MULTI_RULE
                    if (rule_dependent_tr != -1) {
                        rule_dependent_tr = 0;
                        continue;
                    }
                    #endif
                    printf("Contradiction found in preprocessing (cell at t = %i, x = %i, y = %i)\n", t, x - 2, y - 2);
                    return 0;
                }
                #if CHECK_BACKWARDS_IMPLICATIONS
                if (!check_backward_implication(state, t, x, y)) {
                    printf("Contradiction found in preprocessing (cell at t = %i, x = %i, y = %i)\n", t, x - 2, y - 2);
                    return 0;
                }
                #endif
            }
        }
    }
    // remove trivial cells from search order
    for (int i = 0; i < unknown_cells; i++) {
        int* cell = search_order[i];
        if (IS_KNOWN(state->grid[cell[0]][cell[2]][cell[1]])) {
            for (int j = i; j < unknown_cells - 1; j++) {
                memcpy(search_order[j], search_order[j + 1], sizeof(int) * 3);
            }
            i--;
            unknown_cells--;
        }
    }
    int trivial = state->set_cells;
    state->set_cells = 0;
    if (unknown_cells == 0) {
        print_solution(state, true, 1);
        return 0;
    }
    printf("%i unknown cells (%i total, %i trivial cells found)\n", unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
    // long value = strtol(
    //     "00" "01" "01"
    //     "00" "00" "00"
    //     "00" "00" "00"
    // , NULL, 2);
    // printf("%ld -> %i\n", value, big_trs_forward[value]);
    printf("Running search\n");
    DPRINTGRID1(state);
    #if DEBUG >= 2
    printf("Search order:\n");
    for (int i = 0; i < unknown_cells; i++) {
        int t = search_order[i][0];
        int x = search_order[i][1];
        int y = search_order[i][2];
        printf("t = %i, x = %i, y = %i, value = ", t, x, y);
        print_cell(stdout, state->grid[t][y][x]);
        printf("\n");
    }
    #endif
    start = get_time();
    last_progress_shown = start;
    #ifdef BENCHMARK
    for (int i = 0; i < BENCHMARK; i++) {
        double start = get_time();
        #if MULTI_RULE
        run_depth(1, 0);
        #else
        run_depth(1);
        #endif
        printf("Iteration %i/%i complete in %.6f seconds\n", i, BENCHMARK, get_time() - start);
    }
    double time = get_time() - start;
    printf("All iterations complete in %.6f seconds, average %.6f seconds/iteration\n", time, time / BENCHMARK);
    #else
    #if MULTI_RULE
    run_depth(1, 0, -1);
    #else
    run_depth(1);
    #endif
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #endif
    free_states();
    return 0;
}
