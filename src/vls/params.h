
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
#define HEIGHT 8
#define WIDTH 8

// number of generations of the object we are looking for, period + 1 for periodic objects..
#define GENS 5

// the number of variables
#define VAR_COUNT 9

// the type of cells
// 0 = dead, 1 = alive, 2 = unknown, 3 = undefined behavior, >3 = variables (but indexed more complicated)
// the variable indexing for this is 6 + 4*variable (so the binary always ends in 10, so we can do ANDing and ensure that it's unknown)
typedef uint8_t cell_t;
// the smallest integer type that can store the size of the grid
typedef uint8_t index_t;

// the number of unknown cells
#define TOTAL_UNKNOWN_CELLS 66

// defines what it is searching for
static cell_t initial_grid[GENS][HEIGHT][WIDTH] = {{{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 6, 10, 14, 0, 0, 0}, {0, 0, 18, 22, 26, 0, 0, 0}, {0, 0, 30, 34, 38, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 6, 10, 14, 0, 0}, {0, 0, 0, 18, 22, 26, 0, 0}, {0, 0, 0, 30, 34, 38, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}};

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


// search method parameters

// the order that cells are searched in
// format is {t, x, y}
static int search_order[TOTAL_UNKNOWN_CELLS][3] = {{0, 2, 2}, {0, 3, 2}, {0, 4, 2}, {0, 2, 3}, {0, 3, 3}, {0, 4, 3}, {0, 2, 4}, {0, 3, 4}, {0, 4, 4}, {1, 2, 2}, {1, 3, 2}, {1, 4, 2}, {1, 5, 2}, {1, 2, 3}, {1, 3, 3}, {1, 4, 3}, {1, 5, 3}, {1, 2, 4}, {1, 3, 4}, {1, 4, 4}, {1, 5, 4}, {1, 2, 5}, {1, 3, 5}, {1, 4, 5}, {1, 5, 5}, {2, 2, 2}, {2, 3, 2}, {2, 4, 2}, {2, 5, 2}, {2, 2, 3}, {2, 3, 3}, {2, 4, 3}, {2, 5, 3}, {2, 2, 4}, {2, 3, 4}, {2, 4, 4}, {2, 5, 4}, {2, 2, 5}, {2, 3, 5}, {2, 4, 5}, {2, 5, 5}, {3, 2, 2}, {3, 3, 2}, {3, 4, 2}, {3, 5, 2}, {3, 2, 3}, {3, 3, 3}, {3, 4, 3}, {3, 5, 3}, {3, 2, 4}, {3, 3, 4}, {3, 4, 4}, {3, 5, 4}, {3, 2, 5}, {3, 3, 5}, {3, 4, 5}, {3, 5, 5}, {4, 3, 3}, {4, 4, 3}, {4, 5, 3}, {4, 3, 4}, {4, 4, 4}, {4, 5, 4}, {4, 3, 5}, {4, 4, 5}, {4, 5, 5}};

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

// filtering

#define SOLUTION_FILTERING false

// whether to keep track of various things
#define TRACK_PHASE_POPS false

// don't change this
static cell_t grid[GENS][HEIGHT][WIDTH];
static index_t set_cells;
#ifdef MAXPOP
#if !TRACK_PHASE_POPS
#define SPECIAL_PHASE_0_POP
static index_t phase_0_pop;
#endif
#endif
#if TRACK_PHASE_POPS
static index_t phase_pops[GENS];
#endif
typedef cell_t grid_item_t[WIDTH];

// filtering
#if FILTERING
static inline bool solution_filter() {return true;}
#endif


// misc options

// benchmarking iterations
// #define BENCHMARK 67

// debug level
#define DEBUG 0
