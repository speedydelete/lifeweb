
#include <stdbool.h>
#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>


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
#define MULTI_RULE false

// single-rule searching parameters
#if !MULTI_RULE

// the rule
#define RULE "B3/S23"

// the transition lookup table for the rule
static const uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

// multi-rule searching parameters
#else

#endif

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
    #ifdef TRACK_PHASE_POPS
    int phase_pops[GENS];
    #endif
} search_state;
typedef cell_t grid_item_t[WIDTH];

// filtering
#if FILTERING
bool solution_filter(search_state* state) {return true;}
#endif

// benchmarking iterations
// #define BENCHMARK 67

// debug level
#define DEBUG 0

// END CONFIGURATION


#if DEBUG >= 1
#define DPRINTF1 printf
#define DPRINTGRID1 print_grid
#else
#define DPRINTF1(...)
#define DPRINTGRID1(state)
#endif

#if DEBUG >= 2
#define DPRINTF2 printf
#define DPRINTGRID2 print_grid
#else
#define DPRINTF2(...)
#define DPRINTGRID2(state)
#endif

#if DEBUG >= 3
#define DPRINTF3 printf
#define DPRINTGRID3 print_grid
#else
#define DPRINTF3(...)
#define DPRINTGRID3(state)
#endif

#if DEBUG >= 4
#define DPRINTF4 printf
#define DPRINTGRID4 print_grid
#else
#define DPRINTF4(...)
#define DPRINTGRID4(state)
#endif

#if DEBUG >= 5
#define DPRINTF5 printf
#define DPRINTGRID5 print_grid
#else
#define DPRINTF5(...)
#define DPRINTGRID5(state)
#endif

#if DEBUG >= 6
#define DPRINTF6 printf
#define DPRINTGRID6 print_grid
#else
#define DPRINTF6(...)
#define DPRINTGRID6(state)
#endif

#define UNKNOWN 2
#define IS_KNOWN(x) ((x) < UNKNOWN)

#define VAR_TO_CELL_VAR(x) (6 + 4*(x))
#define CELL_VAR_TO_VAR(x) (((x) >> 2) - 1)


static int unknown_cells = TOTAL_UNKNOWN_CELLS;


search_state* states[TOTAL_UNKNOWN_CELLS + 1];

static inline void copy_state(search_state* from, search_state* to) {
    memcpy(to, from, sizeof(search_state));
}

static inline void init_states(void) {
    search_state* initial_state = malloc(sizeof(search_state));
    memcpy(initial_state->grid, initial_grid, sizeof(initial_grid));
    initial_state->set_cells = 0;
    #ifdef SPECIAL_PHASE_0_POP
    initial_state->phase_0_pop = 0;
    #endif
    #ifdef TRACK_PHASE_POPS
    for (int i = 0; i < GENS; i++) {
        initial_state->phase_pops[i] = 0;
    }
    #endif
    states[0] = initial_state;
    for (int i = 1; i < unknown_cells + 1; i++) {
        search_state* state = malloc(sizeof(search_state));
        copy_state(initial_state, state);
        states[i] = state;
    }
}

static inline void free_states(void) {
    for (int i = 0; i < GENS; i++) {
        free(states[i]);
    }
}

static const char* LETTERS = ".o*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static void print_cell(cell_t value) {
    if (value > 3) {
        value = CELL_VAR_TO_VAR(value) + 3;
    }
    if (value < 64) {
        printf("%c", LETTERS[value]);
    } else {
        printf("(%i)", value);
    }
}

static void print_grid(search_state* state) {
    printf("Grid:\n");
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                print_cell(state->grid[t][y][x]);
            }
            printf("$\n");
        }
        if (t == GENS - 1) {
            printf("!\n");
        } else {
            printf("$\n");
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

// the transition lookup table for the 3-state rule including unknown cells
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh
// 01 23 45
// 67 89 ab
// cd ef gh
static cell_t big_trs_forward[262144];

static cell_t get_forward_big_tr(int prev, int tr, int depth) {
    int state = tr & 3;
    tr >>= 2;
    int next = prev << 1;
    // state 3 is undefined behavior
    if (state == 3) {
        return UNKNOWN;
    }
    if (depth == 8) {
        if (state < UNKNOWN) {
            return trs[next | state];
        } else {
            int a = trs[next | 0];
            int b = trs[next | 1];
            // unknown cell: if they disagree return unknown
            return a == b ? a : UNKNOWN;
        }
    } else {
        if (state < UNKNOWN) {
            return get_forward_big_tr(next | state, tr, depth + 1);
        } else {
            int a = get_forward_big_tr(next | 0, tr, depth + 1);
            int b = get_forward_big_tr(next | 1, tr, depth + 1);
            // unknown cell: if they disagree return unknown
            return a == b ? a : UNKNOWN;
        }
    }
}

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
    if ((tr & 3) == 2) {
        return 15;
    }
    // check for contradiction
    cell_t target = big_trs_forward[tr >> 2];
    if (target == 2) {
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

static inline void generate_big_trs(void) {
    for (int tr = 0; tr < 262144; tr++) {
        big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    }
    for (int tr = 0; tr < 1048576; tr++) {
        int value = get_backward_big_tr(tr);
        big_trs_backward[tr] = value == 0b101010101010101010 ? 15 : value;
    }
}

// set_cell has different modes depending on its caller
typedef enum set_cell_mode_t {
    NORMAL,
    IMPLICATION,
} set_cell_mode_t;

static bool set_cell(search_state* state, int t, int x, int y, cell_t value, set_cell_mode_t mode);

// check if the unknown cell can be set, and if so, set it, propagating checks
// returns false if contradiction, true if no contradiction
static inline bool check_forward_implication(search_state* state, int t, int x, int y) {
    if (t < 0 || t + 1 >= GENS || x <= 0 || x >= WIDTH - 1 || y <= 0 || y >= HEIGHT - 1) {
        return true;
    }
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
    DPRINTF5("forward: t = %i, x = %i, y = %i, tr = %i, value = %i, tr_value = %i\n", t, x, y, tr, (int)value, (int)tr_value);
    if (value != tr_value) {
        if (IS_KNOWN(tr_value)) {
            if (IS_KNOWN(value)) {
                DPRINTGRID5(state);
                DPRINTF5("Contradiction (forward, both known and unequal, t = %i, x = %i, y = %i)\n", t, x, y);
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
        DPRINTGRID5(state);
        DPRINTF5("Contradiction (backward, value == 3, tr = %i, t = %i, x = %i, y = %i)\n", tr, t, x, y);
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

static cell_t prev_values[MAX_VAR_USES];

// set a cell to a value, taking care of edges and filters but not propagating implications
static inline void _set_cell(search_state* state, int t, int x, int y, cell_t value) {
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
}

// set a variable to a value, propagating implication checking
// returns false if contradiction, true if no contradiction
static inline bool set_var(search_state* state, int var, cell_t value) {
    DPRINTF4("Setting variable %i to %i\n", var, value);
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        int t = var_uses[var][use][1];
        int x = var_uses[var][use][2];
        int y = var_uses[var][use][3];
        DPRINTF5("Read variable data: t = %i, x = %i, y = %i\n", t, x, y);
        cell_t prev_value = state->grid[t][y][x];
        prev_values[use] = prev_value;
        if (IS_KNOWN(prev_value)) {
            if (prev_value != value) {
                return false;
            }
        } else {
            _set_cell(state, t, x, y, value);
        }
        if (there_is_more == 0) {
            break;
        }
    }
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        if (!IS_KNOWN(prev_values[use])) {
            int t = var_uses[var][use][1];
            int x = var_uses[var][use][2];
            int y = var_uses[var][use][3];
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

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell(search_state* state, int t, int x, int y, cell_t value, set_cell_mode_t mode) {
    cell_t prev_value = state->grid[t][y][x];
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", t, x, y, value, prev_value);
    if (IS_KNOWN(prev_value)) {
        return prev_value == value;
    } else if (prev_value < 4) {
        _set_cell(state, t, x, y, value);
        return CHECK_IMPLICATIONS(state, t, x, y);
    } else {
        return set_var(state, CELL_VAR_TO_VAR(prev_value), value);
    }
}


static double get_time() {
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

static void get_true_bb(bb_t* bb, grid_item_t* grid) {
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
        *x_out = bb->height - y - 1;
    }
    if (y_trans == POS_X) {
        *y_out = x;
    } else if (y_trans == POS_Y) {
        *y_out = y;
    } else if (y_trans == NEG_X) {
        *y_out = bb->width - x - 1;
    } else if (y_trans == NEG_Y) {
        *y_out = bb->height - y - 1;
    }
    *x_out += bb->x_offset;
    *y_out += bb->y_offset;
}

static inline hash_t hash(grid_item_t* grid, bb_t* bb, axis_trans_t x_trans, axis_trans_t y_trans) {
    hash_t out = 0xcbf29ce484222325;
    for (int y = 0; y < bb->height; y++) {
        for (int x = 0; x < bb->width; x++) {
            int real_x = 0;
            int real_y = 0;
            transform_coords(bb, x, y, x_trans, y_trans, &real_x, &real_y);
            out ^= grid[real_y][real_x];
            out *= 0x00000100000001b3;
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

static hash_t known_solutions[1048576];

static void init_known_solutions(void) {
    for (int i = 0; i < sizeof(known_solutions) / sizeof(hash_t); i++) {
        known_solutions[i] = 0;
    }
}

#endif

static void print_solution(search_state* state, bool preprocessing, int depth) {
    #ifndef BENCHMARK
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
        if (preprocessing) {
            printf("Solved in preprocessing, 0 solutions\n");
        }
        return;
    }
    #endif
    #if FILTERING
    if (!solution_filter(state)) {
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
            return;
        }
    }
    if (solutions_found < sizeof(known_solutions) / sizeof(hash_t)) {
        known_solutions[solutions_found] = hash;
    }
    #endif
    solutions_found++;
    DPRINTGRID2(state);
    // #if DEBUG >= 2
    // for (int i = 0; i < depth; i++) {
    //     print_grid(states[i]);
    // }
    // #endif
    if (preprocessing) {
        printf("Solved in preprocessing, 1 solution:\nx = 0, y = 0, rule = "RULE"\n");
    } else {
        printf("Solution found:\nx = 0, y = 0, rule = "RULE"\n");
    }
    int last_y = HEIGHT - (BOTTOM == NONE ? 2 : 1);
    for (int y = (TOP == NONE ? 2 : 1); y < last_y; y++) {
        for (int x = (LEFT == NONE ? 2 : 1); x < WIDTH - (RIGHT == NONE ? 2 : 1); x++) {
            cell_t value = state->grid[0][y][x];
            if (value > 1) {
                print_grid(state);
                printf("\nError: this error should not occur (unknown cell in solution)\n");
                printf("Please report this error along with the debug information printed above\n");
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


static void run_depth(int depth) {
    branches++;
    if (depth > unknown_cells || states[depth - 1]->set_cells == unknown_cells) {
        print_solution(states[depth - 1], false, depth);
        return;
    }
    search_state* state = states[depth];
    DPRINTF3("Running depth %i\n", depth);
    #if DEBUG >= 4
    copy_state(states[depth - 1], state);
    DPRINTGRID4(state);
    #endif
    double time = get_time();
    #if DEBUG >= 4
    printf("Status: ");
    int end = depth - 1 < 30 ? depth - 1 : 30;
    for (int i = 0; i < end; i++) {
        int* cell = search_order[i];
        cell_t value = states[depth - 1]->grid[cell[0]][cell[2]][cell[1]];
        printf("%c", value ? '1' : '0');
    }
    printf("\n");
    #endif
    if (time - last_progress_shown > 1) {
        last_progress_shown = time;
        #ifndef BENCHMARK
        printf("%i seconds, %"PRIu64" branches, progress: ", (int)(time - start), branches);
        int end = depth - 1 < 30 ? depth - 1 : 30;
        for (int i = 0; i < end; i++) {
            int* cell = search_order[i];
            cell_t value = states[depth - 1]->grid[cell[0]][cell[2]][cell[1]];
            printf("%c", value ? '1' : '0');
        }
        printf("\n");
        #endif
    }
    int* cell = search_order[depth - 1];
    if (IS_KNOWN(states[depth - 1]->grid[cell[0]][cell[2]][cell[1]])) {
        copy_state(states[depth - 1], state);
        run_depth(depth + 1);
        return;
    }
    #if INITIAL_VALUE == 0
    for (int value = 0; value < 2; value++)
    #else
    for (int value = 1; value >= 0; value--)
    #endif
    {
        copy_state(states[depth - 1], state);
        if (set_cell(state, cell[0], cell[1], cell[2], value, NORMAL)) {
            run_depth(depth + 1);
        }
    }
}

int main(void) {
    init_states();
    init_var_uses();
    generate_big_trs();
    init_known_solutions();
    search_state* state = states[0];
    DPRINTGRID2(state);
    // preprocessing: search for and remove trivial cells
    printf("Preprocessing\n");
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                if (!check_forward_implication(state, t, x, y)) {
                    printf("Contradiction found in preprocessing (cell at t = %i, x = %i, y = %i)\n", t, x - 2, y - 2);
                    return 0;
                }
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
        print_solution(state, true, 0);
        return 0;
    }
    printf("%i unknown cells (%i total cells, %i trivial cells found)\n", unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
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
        print_cell(state->grid[t][y][x]);
        printf("\n");
    }
    #endif
    start = get_time();
    last_progress_shown = start;
    #ifdef BENCHMARK
    for (int i = 0; i < BENCHMARK; i++) {
        double start = get_time();
        run_depth(1);
        printf("Iteration %i/%i complete in %.6f seconds\n", i, BENCHMARK, get_time() - start);
    }
    double time = get_time() - start;
    printf("All iterations complete in %.6f seconds, average %.6f seconds/iteration\n", time, time / BENCHMARK);
    #else
    run_depth(1);
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #endif
    free_states();
    return 0;
}
