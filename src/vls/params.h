
// defines configuration

#pragma once

#include <inttypes.h>


// the default search will find the glider (i think)

// for transition lookup tables the indexing is like
// 8 5 2
// 7 4 1
// 6 3 0
// where the bitstring is 0b876543210

// the search area should be padded on all sides by 2 cells unless otherwise specified below (then it is padded by 1 cell)


// search parameters

// height and width of the bounding box
#define HEIGHT 11
#define WIDTH 13

// number of generations of the object we are looking for, period + 1 for periodic objects..
#define GENS 4

// whether variables are present
#define VARIABLES true

#if VARIABLES
// the number of variables
#define VAR_COUNT 1
#endif

// the type of cells, don't change this
// 0 = dead, 1 = alive, 2 = unknown
typedef uint8_t cell_value_t;

// the smallest integer type that can store the size of the grid
typedef uint16_t index_t;
#if VARIABLES
// the smallest integer type that can store the number of variables
typedef uint8_t var_t;
#endif

// the number of unknown cells
#define TOTAL_UNKNOWN_CELLS 238

// defines what it is searching for
static const cell_value_t initial_grid[GENS][HEIGHT][WIDTH] = {{{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 2, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}};
#if VARIABLES
// the variables
static const var_t initial_vars[GENS][HEIGHT][WIDTH] = {{{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0}}};
#endif

// time wraparound
#define TIME_WRAP true
#if TIME_WRAP
#define TIME_WRAP_DX 2
#define TIME_WRAP_DY 0
#endif

// whether to do multi-rule searching
#define MULTI_RULE false

// the transition lookup table for the rule
// if multi-rule, rule-dependent ones are 3
#define TRS_RULE_DEPENDANT 3
static
#if !MULTI_RULE
const
#endif
uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

#if !MULTI_RULE

// special single-rule parameters

// the rulestring
#define RULE "B3/S23"

#else

// special multi-rule parameters

// the base-2 logarithm of the number of rules in the rulespace
#define MAX_RULE_CHANGES 512

// // the transitions that are allowed to change
// // indexing: B0c, B1c, B1e, B2a, B2c, B2e, ..., B7e, B8c, S0c, S1c, ..., S7e, S8c
// static const bool change_trs[102] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

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
#define WRAP_WIDTH 9
#define WRAP_HEIGHT 7

#define TOP NONE
#define BOTTOM NONE
#define LEFT NONE
#define RIGHT NONE


// search method parameters

// the order that cells are searched in
// format is {t, x, y}
index_t search_order[TOTAL_UNKNOWN_CELLS][3] = {{0, 8, 2}, {0, 8, 3}, {0, 8, 4}, {0, 8, 5}, {0, 8, 6}, {0, 8, 7}, {0, 8, 8}, {0, 7, 2}, {0, 7, 3}, {0, 7, 4}, {0, 7, 5}, {0, 7, 6}, {0, 7, 7}, {0, 7, 8}, {0, 6, 2}, {0, 6, 3}, {0, 6, 4}, {0, 6, 5}, {0, 6, 6}, {0, 6, 7}, {0, 6, 8}, {0, 5, 2}, {0, 5, 3}, {0, 5, 4}, {0, 5, 5}, {0, 5, 6}, {0, 5, 7}, {0, 5, 8}, {0, 4, 2}, {0, 4, 3}, {0, 4, 4}, {0, 4, 5}, {0, 4, 6}, {0, 4, 7}, {0, 4, 8}, {0, 3, 2}, {0, 3, 3}, {0, 3, 4}, {0, 3, 5}, {0, 3, 6}, {0, 3, 7}, {0, 3, 8}, {0, 2, 2}, {0, 2, 3}, {0, 2, 4}, {0, 2, 5}, {0, 2, 6}, {0, 2, 7}, {0, 2, 8}, {1, 10, 2}, {1, 10, 3}, {1, 10, 4}, {1, 10, 5}, {1, 10, 6}, {1, 10, 7}, {1, 10, 8}, {1, 9, 2}, {1, 9, 3}, {1, 9, 4}, {1, 9, 5}, {1, 9, 6}, {1, 9, 7}, {1, 9, 8}, {1, 8, 2}, {1, 8, 3}, {1, 8, 4}, {1, 8, 5}, {1, 8, 6}, {1, 8, 7}, {1, 8, 8}, {1, 7, 2}, {1, 7, 3}, {1, 7, 4}, {1, 7, 5}, {1, 7, 6}, {1, 7, 7}, {1, 7, 8}, {1, 6, 2}, {1, 6, 3}, {1, 6, 4}, {1, 6, 5}, {1, 6, 6}, {1, 6, 7}, {1, 6, 8}, {1, 5, 2}, {1, 5, 3}, {1, 5, 4}, {1, 5, 5}, {1, 5, 6}, {1, 5, 7}, {1, 5, 8}, {1, 4, 2}, {1, 4, 3}, {1, 4, 4}, {1, 4, 5}, {1, 4, 6}, {1, 4, 7}, {1, 4, 8}, {1, 3, 2}, {1, 3, 3}, {1, 3, 4}, {1, 3, 5}, {1, 3, 6}, {1, 3, 7}, {1, 3, 8}, {1, 2, 2}, {1, 2, 3}, {1, 2, 4}, {1, 2, 5}, {1, 2, 6}, {1, 2, 7}, {1, 2, 8}, {2, 10, 2}, {2, 10, 3}, {2, 10, 4}, {2, 10, 5}, {2, 10, 6}, {2, 10, 7}, {2, 10, 8}, {2, 9, 2}, {2, 9, 3}, {2, 9, 4}, {2, 9, 5}, {2, 9, 6}, {2, 9, 7}, {2, 9, 8}, {2, 8, 2}, {2, 8, 3}, {2, 8, 4}, {2, 8, 5}, {2, 8, 6}, {2, 8, 7}, {2, 8, 8}, {2, 7, 2}, {2, 7, 3}, {2, 7, 4}, {2, 7, 5}, {2, 7, 6}, {2, 7, 7}, {2, 7, 8}, {2, 6, 2}, {2, 6, 3}, {2, 6, 4}, {2, 6, 5}, {2, 6, 6}, {2, 6, 7}, {2, 6, 8}, {2, 5, 2}, {2, 5, 3}, {2, 5, 4}, {2, 5, 5}, {2, 5, 6}, {2, 5, 7}, {2, 5, 8}, {2, 4, 2}, {2, 4, 3}, {2, 4, 4}, {2, 4, 5}, {2, 4, 6}, {2, 4, 7}, {2, 4, 8}, {2, 3, 2}, {2, 3, 3}, {2, 3, 4}, {2, 3, 5}, {2, 3, 6}, {2, 3, 7}, {2, 3, 8}, {2, 2, 2}, {2, 2, 3}, {2, 2, 4}, {2, 2, 5}, {2, 2, 6}, {2, 2, 7}, {2, 2, 8}, {3, 10, 2}, {3, 10, 3}, {3, 10, 4}, {3, 10, 5}, {3, 10, 6}, {3, 10, 7}, {3, 10, 8}, {3, 9, 2}, {3, 9, 3}, {3, 9, 4}, {3, 9, 5}, {3, 9, 6}, {3, 9, 7}, {3, 9, 8}, {3, 8, 2}, {3, 8, 3}, {3, 8, 4}, {3, 8, 5}, {3, 8, 6}, {3, 8, 7}, {3, 8, 8}, {3, 7, 2}, {3, 7, 3}, {3, 7, 4}, {3, 7, 5}, {3, 7, 6}, {3, 7, 7}, {3, 7, 8}, {3, 6, 2}, {3, 6, 3}, {3, 6, 4}, {3, 6, 5}, {3, 6, 6}, {3, 6, 7}, {3, 6, 8}, {3, 5, 2}, {3, 5, 3}, {3, 5, 4}, {3, 5, 5}, {3, 5, 6}, {3, 5, 7}, {3, 5, 8}, {3, 4, 2}, {3, 4, 3}, {3, 4, 4}, {3, 4, 5}, {3, 4, 6}, {3, 4, 7}, {3, 4, 8}, {3, 3, 2}, {3, 3, 3}, {3, 3, 4}, {3, 3, 5}, {3, 3, 6}, {3, 3, 7}, {3, 3, 8}, {3, 2, 2}, {3, 2, 3}, {3, 2, 4}, {3, 2, 5}, {3, 2, 6}, {3, 2, 7}, {3, 2, 8}};

// initial value for unknown cells
#define INITIAL_VALUE 0

// whether to use LLS instead
// #define LLS "path/to/lls"

// maximum population
// #define MAXPOP 67


// solution parameters

// whether to show solutions at all
#define SHOW_SOLUTIONS true

// number of solutions to report
// #define MAX_SOLUTIONS 67

// whether to check if the solution is empty or not
#define CHECK_EMPTY true

// whether to filter duplicates or not
#define FILTER_DUPLICATES true
// whether to filter every phase or just phase 0
#define FILTER_EVERY_PHASE true

// reporting interval
#define REPORTING_INTERVAL 1
// partial reporting interval
#define PARTIAL_REPORTING_INTERVAL 60



// whether to keep track of various things
#define TRACK_PHASE_POPS false

// don't change this stuff

typedef struct cell {
    // the x coordinate
    index_t x;
    // the y coordinate
    index_t y;
    // the generation
    index_t t;
    // (t * SIZE) + (y * WIDTH) + x
    index_t index;
    // the value of the cell, 0 = dead, 1 = alive, 2 = unknown, 3 = undefined behavior, >3 = variables
    cell_value_t value;
    #if VARIABLES
    // the variable stored in the cell
    var_t var;
    #endif
    // the next cell in the search order
    struct cell* next_in_search_order;
    // the previous cell (in time)
    struct cell* prev;
    // the next cell (in time)
    struct cell* next;
    // the northwest neighbor
    struct cell* nw;
    // the north neighbor
    struct cell* n;
    // the northeast neighbor
    struct cell* ne;
    // the west neighbor
    struct cell* w;
    // the east neighbor
    struct cell* e;
    // the southwest neighbor
    struct cell* sw;
    // the south neighbor
    struct cell* s;
    // the southeast neighbor
    struct cell* se;
} cell;

cell grid[GENS][HEIGHT][WIDTH];

index_t set_cells;

#ifdef MAXPOP
#if !TRACK_PHASE_POPS
#define SPECIAL_PHASE_0_POP
index_t phase_0_pop;
#endif
#endif

#if TRACK_PHASE_POPS
index_t phase_pops[GENS];
#endif


// custom stuff
// define special tracking above!

#define CUSTOM_INIT true
#define CUSTOM_SOLUTION_FILTERING true
#define CUSTOM_PRUNING false


#define MIN(a, b) ((a) < (b) ? (a) : (b))
#define MAX(a, b) ((a) > (b) ? (a) : (b))

int cat_min_x = WIDTH;
int cat_max_x = -1;
int cat_min_y = HEIGHT;
int cat_max_y = -1;

#if CUSTOM_INIT
static inline void custom_init() {
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            if (grid[0][y][x].var != 0) {
                cat_min_x = MIN(cat_min_x, x);
                cat_max_x = MAX(cat_max_x, x);
                cat_min_y = MIN(cat_min_y, y);
                cat_max_y = MAX(cat_max_y, y);
            }
        }
    }
}
#endif

#define EATER_Y_OFFSET 4

#if false
#include <stdio.h>
#define FILTERPRINTF printf
#else
#define FILTERPRINTF(...)
#endif

// filter function here
#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter() {
    #define get(x, y) (grid[0][(cat_min_y) + (y) + (Y_OFFSET)][(x)].value)
    #define on(x2, y2) (get(x + (x2), y2) == 1)
    #define off(x2, y2) (get(x + (x2), y2) == 0)
    /*
    #define get(x, y) ({ \
        FILTERPRINTF("    getting (%i, %i) -> %i\n", (x), (cat_min_y) + (y) + (EATER_Y_OFFSET), grid[0][(cat_min_y) + (y) + (EATER_Y_OFFSET)][(x)].value); \
        grid[0][(cat_min_y) + (y) + (EATER_Y_OFFSET)][(x)].value; \
    })
    #define on(x2, y2) ({ \
        bool out = get(x + (x2), y2) == 1; \
        FILTERPRINTF("    on(%i, %i) -> %i\n", (x2), (y2), out); \
        out; \
    })
    #define off(x2, y2) ({ \
        bool out = get(x + (x2), y2) == 0; \
        FILTERPRINTF("    off(%i, %i) -> %i\n", (x2), (y2), out); \
        out; \
    })
    */
    // check for non-eater
    int total_pop = 0;
    int var_pop = 0;
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            if (grid[GENS - 1][y][x].value == 0) {
                continue;
            }
            total_pop++;
            if (initial_vars[GENS - 1][y][x] > 0) {
                var_pop++;
            }
        }
    }
    FILTERPRINTF("total_pop = %i, var_pop = %i, cat_min_y = %i\n", total_pop, var_pop, cat_min_y);
    if (total_pop != var_pop) {
        FILTERPRINTF("total_pop != var_pop, returning true\n");
        return true;
    }
    for (int x = cat_min_x; x <= cat_max_x - 3; x++) {
        #define Y_OFFSET (EATER_Y_OFFSET)
        // check for eater head
        // OO.
        // O.O
        FILTERPRINTF("checking for eater head for x = %i\n", x);
        if ( on(0, 0) &&  on(1, 0) && off(2, 0) &&
             on(0, 1) && off(1, 1) &&  on(2, 1)) {
            return false;
        }
        // check for beehive
        // .OO.
        // O..O
        // .O**
        FILTERPRINTF("checking for beehive for x = %i\n", x);
        if (off(0, 0) &&  on(1, 0) &&  on(2, 0) && off(3, 0) &&
             on(0, 1) && off(1, 1) && off(2, 1) &&  on(3, 1) &&
            off(0, 2) &&  on(1, 2)) {
            return false;
        }
        // check for sparky eater
        // ...
        // O.O
        // OOO
        // ..O
        FILTERPRINTF("checking for sparky eater for x = %i\n", x);
        if (off(0, 0) && off(1, 0) && off(2, 0) &&
             on(0, 1) && off(1, 1) &&  on(2, 1) &&
             on(0, 2) &&  on(1, 2) &&  on(2, 2) &&
            off(0, 3) && off(1, 3) &&  on(2, 3)) {
            return false;
        }
        #if EATER_Y_OFFSET > 2
        #undef Y_OFFSET
        #define Y_OFFSET (EATER_Y_OFFSET - 1)
        // check for eater tail bridge snake or whatever it's called
        // OO
        // O.
        // .O
        if ( on(0, 0) &&  on(1, 0) &&
             on(0, 1) && off(1, 1) &&
            off(0, 2) &&  on(1, 2)) {
            return false;
        }
        #endif
        #undef Y_OFFSET
        #define Y_OFFSET 0
        // check for anything above or on row EATER_Y_OFFSET_1 + 1
        // this will intercept the T before it hits the eaters
        FILTERPRINTF("checking for interceptor\n");
        for (int y = 0; y <= EATER_Y_OFFSET + 1; y++) {
            if (on(0, y)) {
                FILTERPRINTF("interceptor found\n");
                return true;
            }
        }
        #undef Y_OFFSET
    }
    FILTERPRINTF("returning normally\n");
    return true;
    #undef get
    #undef on
    #undef off
}
/*
static inline bool custom_solution_filter() {
    // #define on(x, y) (grid[GENS - 1][(y) + 2][(x) + 2].value == 1)
    // #define off(x, y) (grid[GENS - 1][(y) + 2][(x) + 2].value == 0)
    // return !(
    //     off(16, 16) &&  on(17, 16) && off(18, 16) &&
    //      on(16, 17) && off(17, 17) && off(18, 17) &&
    //     off(16, 18) &&  on(17, 18) &&  on(18, 18)
    // );
    // #undef on
    // #undef off
}
*/
#endif

#if CUSTOM_PRUNING
static inline bool custom_prune() {
    return true;
}
#endif



// misc options

// benchmarking iterations
// #define BENCHMARK 67

// debug level
#define DEBUG 0
