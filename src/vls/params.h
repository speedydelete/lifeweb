
// defines configuration

#pragma once

// stdbool.h is for compatibility with old compilers
#include <stdbool.h>
#include <inttypes.h>


// the default search will find the glider (i think)


// for transition lookup tables the indexing is like
// 8 5 2
// 7 4 1
// 6 3 0
// where the bitstring is 0b876543210

// the search area should be padded on all sides by 2 cells unless otherwise specified below (then it is padded by 1 cell)


// search parameters

// width and height of the bounding box
#define INITIAL_WIDTH 7
#define INITIAL_HEIGHT 8

// number of generations of the object we are looking for
#define INITIAL_GENS 4

// whether variables are present
#define VARIABLES false

#if VARIABLES
// the number of variables
#define VAR_COUNT 1
#endif

// the type of cells, don't change this
typedef uint8_t CellValue;
#define UNKNOWN 0
#define OFF 1
#define ON 2
#define DONT_CARE 3

// the smallest integer type that can store the size of the grid
typedef uint8_t Index;

// the smallest integer type that can store the sizes of prefixes
typedef uint8_t PrefixIndex;

#if VARIABLES
// the smallest integer type that can store the number of variables
typedef uint8_t Variable;
#endif

// grid padding, don't change this
#define PADDING 2

// the number of unknown cells
#define TOTAL_UNKNOWN_CELLS 48

// defines what it is searching for
static const CellValue INITIAL_STATES[INITIAL_GENS][INITIAL_HEIGHT][INITIAL_WIDTH] = {{{1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}}, {{1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}}, {{1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}}, {{1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 0, 0, 0, 1, 1}, {1, 1, 1, 1, 1, 1, 1}, {1, 1, 1, 1, 1, 1, 1}}};

// whether there are don't care states
#define HAS_DONT_CARES false

#if VARIABLES
// the variables
static const Variable INITIAL_VARS[INITIAL_GENS][INITIAL_HEIGHT][INITIAL_WIDTH] = {{{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}};
#endif

// settability
typedef uint8_t Settability;
#define SEARCHABLE 0
#define NOT_SEARCHABLE 1
#define NOT_SETTABLE 2
static const Settability INITIAL_SETTABLE[INITIAL_GENS][INITIAL_HEIGHT][INITIAL_WIDTH] = {{{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0}}};

// the values of the next generations
// format is {t, x, y}
// {-1, -1, -1} means NULL
// {-2, -2, -2} means a special nonexistent cell that is forced to be empty
static const int32_t INITIAL_NEXTS[INITIAL_GENS][INITIAL_HEIGHT][INITIAL_WIDTH][3] = {};


// whether to do multi-rule searching
#define MULTI_RULE false

// whether the rule is an outer-totalistic rule
#define IS_OT true

// the transition lookup table for the rule
// if multi-rule, rule-dependent ones are 4
#define TRS_RULE_DEPENDENT 4
#if !MULTI_RULE
static const
#endif
uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

#if MULTI_RULE

// special multi-rule parameters

// the rulespace mode
#define RULESPACE_INT 0
#define RULESPACE_OT 1
#define RULESPACE_MAP 2
#define RULESPACE_HEX_INT 3
#define RULESPACE_HEX_OT 4
#define RULESPACE_HEX_MAP 5
#define RULESPACE_VN_INT 6
#define RULESPACE_VN_OT 7
#define RULESPACE_VN_MAP 8
#define RULESPACE RULESPACE_INT

#endif

// can be set to e.g. "History" or ":T20,20" during configuration
#define SPECIAL_AFTER_RULE ""


// search method parameters

// the order that cells are searched in
// format is {t, x, y}
Index search_order[TOTAL_UNKNOWN_CELLS][3] = {{0, 2, 2}, {0, 3, 2}, {0, 2, 3}, {0, 4, 2}, {0, 3, 3}, {0, 2, 4}, {0, 4, 3}, {0, 3, 4}, {0, 2, 5}, {0, 4, 4}, {0, 3, 5}, {0, 4, 5}, {1, 2, 2}, {1, 3, 2}, {1, 2, 3}, {1, 4, 2}, {1, 3, 3}, {1, 2, 4}, {1, 4, 3}, {1, 3, 4}, {1, 2, 5}, {1, 4, 4}, {1, 3, 5}, {1, 4, 5}, {2, 2, 2}, {2, 3, 2}, {2, 2, 3}, {2, 4, 2}, {2, 3, 3}, {2, 2, 4}, {2, 4, 3}, {2, 3, 4}, {2, 2, 5}, {2, 4, 4}, {2, 3, 5}, {2, 4, 5}, {3, 2, 2}, {3, 3, 2}, {3, 2, 3}, {3, 4, 2}, {3, 3, 3}, {3, 2, 4}, {3, 4, 3}, {3, 3, 4}, {3, 2, 5}, {3, 4, 4}, {3, 3, 5}, {3, 4, 5}};

// initial value for unknown cells
#define IV_0 0
#define IV_1 1
#define IV_SAME_0 2
#define IV_SAME_1 3
#define IV_DIFFERENT_0 4
#define IV_DIFFERENT_1 5
#define INITIAL_VALUE IV_1

// implication transition caching
// i think it's always slower if this is false
#define CACHE_IMPLICATION_TRS true

// prevents computing the implication for a cell twice
// i think this is generally slower for some reason
#define KEEP_LAST_CHECKED_TIME false


// other search parameters

// maximum population
// #define MAXPOP 67

// custom solution file
// #define CUSTOM "path/to/custom.c"

// searching for periodic patterns
#define PERIODIC false
#if PERIODIC
#define PERIODIC_DX 67
#define PERIODIC_DY 67
#define PERIODIC_PERIOD 67
// whether to check early exhaustion
#define CHECK_EARLY_EXHAUSTION true
#endif


// solution and information readout parameters

// whether to show solutions at all
#define SHOW_SOLUTIONS true

// number of solutions to report
// #define MAX_SOLUTIONS 67

// whether to check if the solution is empty or not
#define CHECK_EMPTY true

// whether to filter duplicates or not
#define FILTER_DUPLICATES true

// whether to filter subperiod or not
#define FILTER_SUBPERIOD true

// period filter for cells
// #define CELL_PERIOD_FILTER {67, 41}

// reporting interval
#define REPORTING_INTERVAL 1

// type of max partials to report
#define MAX_PARTIAL_TYPE_NONE 0
#define MAX_PARTIAL_TYPE_CELL 1
#define MAX_PARTIAL_TYPE_DEPTH 2
#define MAX_PARTIAL_TYPE MAX_PARTIAL_TYPE_CELL
// max partial reporting interval
#define MAX_PARTIAL_REPORTING_INTERVAL 1


// misc parameters

// benchmarking iterations
// #define BENCHMARK 67

// debug level
#define DEBUG 0
