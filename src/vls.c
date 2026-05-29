
#include <stdbool.h>
#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>


// BEGIN CONFIGURATION

// the default search will find the glider

// for transition lookup tables the indexing is like
// 8 7 6
// 5 4 3
// 2 1 0
// where the bitstring is 0b876543210

// the search must be zero padded with 2 rows/columns on all sides or it will break

// height and width of the bounding box
#define HEIGHT 8
#define WIDTH 8

// number of generations of the object we are looking for, period + 1 for periodic objects..
#define GENS 5

// the number of variables
#define VAR_COUNT 9
// the maximum number of uses of any single variable
#define MAX_VAR_USES 2

// uncomment for multi-rule searching
// #define MULTI_RULE

// the type of cells
// 0 = dead, 1 = alive, 2 = unknown, 3 = undefined behavior, >3 = variables (but indexed more complicated)
// the variable indexing for this is 6 + 4*variable (so the binary always ends in 10, so we can do ANDing and ensure that it's unknown)
typedef uint8_t cell_t;

// utility macros
#define SIZE (HEIGHT * WIDTH)
#define CELL(t, y, x) ((t) * SIZE + (y) * WIDTH + (x))
#define VAR_TO_CELL_VAR(x) (6 + 4*(x))
#define CELL_VAR_TO_VAR(x) (((x) >> 2) - 1)

// the number of unknown cells
#define TOTAL_UNKNOWN_CELLS 66

// defines what it is searching for
static cell_t initial_grid[GENS][HEIGHT][WIDTH] = {{{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 6, 10, 14, 0, 0, 0}, {0, 0, 18, 22, 26, 0, 0, 0}, {0, 0, 30, 34, 38, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 2, 2, 2, 2, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}, {{0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 6, 10, 14, 0, 0}, {0, 0, 0, 18, 22, 26, 0, 0}, {0, 0, 0, 30, 34, 38, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}, {0, 0, 0, 0, 0, 0, 0, 0}}};

// the order that cells are searched in
// format is {t, x, y}
static int search_order[][3] = {{0, 2, 2}, {0, 3, 2}, {0, 4, 2}, {0, 2, 3}, {0, 3, 3}, {0, 4, 3}, {0, 2, 4}, {0, 3, 4}, {0, 4, 4}, {1, 2, 2}, {1, 3, 2}, {1, 4, 2}, {1, 5, 2}, {1, 2, 3}, {1, 3, 3}, {1, 4, 3}, {1, 5, 3}, {1, 2, 4}, {1, 3, 4}, {1, 4, 4}, {1, 5, 4}, {1, 2, 5}, {1, 3, 5}, {1, 4, 5}, {1, 5, 5}, {2, 2, 2}, {2, 3, 2}, {2, 4, 2}, {2, 5, 2}, {2, 2, 3}, {2, 3, 3}, {2, 4, 3}, {2, 5, 3}, {2, 2, 4}, {2, 3, 4}, {2, 4, 4}, {2, 5, 4}, {2, 2, 5}, {2, 3, 5}, {2, 4, 5}, {2, 5, 5}, {3, 2, 2}, {3, 3, 2}, {3, 4, 2}, {3, 5, 2}, {3, 2, 3}, {3, 3, 3}, {3, 4, 3}, {3, 5, 3}, {3, 2, 4}, {3, 3, 4}, {3, 4, 4}, {3, 5, 4}, {3, 2, 5}, {3, 3, 5}, {3, 4, 5}, {3, 5, 5}, {4, 3, 3}, {4, 4, 3}, {4, 5, 3}, {4, 3, 4}, {4, 4, 4}, {4, 5, 4}, {4, 3, 5}, {4, 4, 5}, {4, 5, 5}};

// single-rule searching parameters
#ifndef MULTI_RULE

// the rule
#define RULE "B3/S23"

// the transition lookup table for the rule
static const uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

// multi-rule searching parameters
#else

#endif

// whether to check if the output is empty or not
#define CHECK_EMPTY true

// maximum population
// #define MAXPOP 5

// debug level
#define DEBUG 0

// END CONFIGURATION


#define UNKNOWN 2
#define IS_KNOWN(x) ((x) < UNKNOWN)

static int unknown_cells = TOTAL_UNKNOWN_CELLS;

typedef struct search_state {
    cell_t grid[GENS][HEIGHT][WIDTH];
    int set_cells;
    #ifdef MAXPOP
    int pop;
    #endif
} search_state;

search_state* states[TOTAL_UNKNOWN_CELLS + 1];

static inline void copy_state(search_state* from, search_state* to) {
    memcpy(to->grid, from->grid, sizeof(to->grid));
    to->set_cells = from->set_cells;
    #ifdef MAXPOP
    to->pop = from->pop;
    #endif
}

static inline void init_states(void) {
    search_state* initial_state = malloc(sizeof(search_state));
    memcpy(initial_state->grid, initial_grid, sizeof(initial_grid));
    initial_state->set_cells = 0;
    #ifdef MAXPOP
    initial_state->pop = 0;
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

static const char* LETTERS = ".o*ABCDEFGHIJKLMNOPQRSTUVWXYZ";

static void print_grid(search_state* state) {
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                cell_t value = state->grid[t][y][x];
                if (value > 3) {
                    value = CELL_VAR_TO_VAR(value) + 3;
                }
                if (value < 29) {
                    printf("%c", LETTERS[value]);
                } else {
                    printf("(%i)", value);
                }
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
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
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
// do nothing = 2, set off = 0, set on = 1, contradiction = 3
static int big_trs_backward[1048576];

static inline int get_backward_big_tr(int tr) {
    cell_t value = big_trs_forward[tr >> 2];
    // check for contradiction
    if (value != 2 && value != (tr & 3)) {
        return 3;
    }
    int out = 0b101010101010101010;
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != 2) {
            continue;
        }
        int tr2 = tr & (~(3 << i));
        bool zero = big_trs_forward[tr2 >> 2] == (tr & 3);
        bool one = big_trs_forward[(tr2 | (1 << i)) >> 2] == (tr & 3);
        // printf("%i, %i -> %s, %i -> %s\n", i, tr2 >> 2, zero ? "true" : "false", (tr2 | (1 << i)) >> 2, one ? "true" : "false");
        if (zero != one) {
            out = (out & ~(3 << (i - 2))) | (((int)one) << (i - 2));
        }
    }
    return out;
}

static inline void generate_big_trs(void) {
    for (int tr = 0; tr < 262144; tr++) {
        big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    }
    for (int tr = 0; tr < 1048576; tr++) {
        // if (tr != 67601) {
        //     big_trs_backward[tr] = 0b101010101010101010;
        //     continue;
        // }
        big_trs_backward[tr] = get_backward_big_tr(tr);
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
    if (!(x > 0 && x < WIDTH - 1 && y > 0 && y < HEIGHT - 1)) {
        return true;
    }
    if (t + 1 >= GENS) {
        return true;
    }
    #define grid (state->grid[t])
    int tr = ((int)(grid[y - 1][x - 1] & 3) << 16)
        | ((int)(grid[y - 1][x] & 3) << 14)
        | ((int)(grid[y - 1][x + 1] & 3) << 12)
        | ((int)(grid[y][x - 1] & 3) << 10)
        | ((int)(grid[y][x] & 3) << 8)
        | ((int)(grid[y][x + 1] & 3) << 6)
        | ((int)(grid[y + 1][x - 1] & 3) << 4)
        | ((int)(grid[y + 1][x] & 3) << 2)
        | (int)(grid[y + 1][x + 1] & 3);
    #undef grid
    int value = state->grid[t + 1][y][x];
    int tr_value = big_trs_forward[tr];
    #if DEBUG >= 5
    printf("tr = %i, value = %i, tr_value = %i\n", tr, (int)value, (int)tr_value);
    #endif
    if (value != tr_value) {
        if (IS_KNOWN(tr_value)) {
            if (IS_KNOWN(value)) {
                #if DEBUG >= 4
                printf("Contradiction\n");
                #endif
                return false;
            } else {
                bool out = set_cell(state, t + 1, x, y, tr_value, IMPLICATION);
                if (!out) {
                    #if DEBUG >= 4
                    printf("Contradiction\n");
                    #endif
                    return false;
                }
            }
        }
    }
    return true;
}

// returns false if contradiction, true if no contradiction
static inline bool check_backward_implication(search_state* state, int t, int x, int y) {
    return true;
    // int tr = (int)(state->grid[t + 1][y][x])
    // #define grid (state->grid[t])
    //     | ((int)(grid[y - 1][x - 1] & 3) << 18)
    //     | ((int)(grid[y - 1][x] & 3) << 16)
    //     | ((int)(grid[y - 1][x + 1] & 3) << 14)
    //     | ((int)(grid[y][x - 1] & 3) << 12)
    //     | ((int)(grid[y][x] & 3) << 10)
    //     | ((int)(grid[y][x + 1] & 3) << 8)
    //     | ((int)(grid[y + 1][x - 1] & 3) << 6)
    //     | ((int)(grid[y + 1][x] & 3) << 4)
    //     | ((int)(grid[y + 1][x + 1] & 3) << 2);
    // int value = big_trs_backward[tr];
    // if (value == 3) {
    //     #if DEBUG >= 4
    //     printf("Contradiction\n");
    //     #endif
    //     return false;
    // }
    // if ((value & 3) != 2) {
    //     grid[y + 1][x + 1] = value & 3;
    // }
    // if (((value >> 2) & 3) != 2) {
    //     grid[y + 1][x] = (value >> 2) & 3;
    // }
    // if (((value >> 4) & 3) != 2) {
    //     grid[y + 1][x - 1] = (value >> 4) & 3;
    // }
    // if (((value >> 6) & 3) != 2) {
    //     grid[y][x + 1] = (value >> 6) & 3;
    // }
    // if (((value >> 8) & 3) != 2) {
    //     grid[y][x] = (value >> 8) & 3;
    // }
    // if (((value >> 10) & 3) != 2) {
    //     grid[y][x - 1] = (value >> 10) & 3;
    // }
    // if (((value >> 12) & 3) != 2) {
    //     grid[y - 1][x + 1] = (value >> 12) & 3;
    // }
    // if (((value >> 14) & 3) != 2) {
    //     grid[y - 1][x] = (value >> 14) & 3;
    // }
    // if (((value >> 16) & 3) != 2) {
    //     grid[y - 1][x - 1] = (value >> 16) & 3;
    // }
    // return true;
    // #undef grid
}

static bool set_var(search_state* state, int var, cell_t value);

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell(search_state* state, int t, int x, int y, cell_t value, set_cell_mode_t mode) {
    cell_t prev_value = state->grid[t][y][x];
    #if DEBUG >= 3
    printf("Setting cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", t, x, y, value, prev_value);
    #endif
    if (IS_KNOWN(prev_value)) {
        return prev_value == value;
    } else if (prev_value < 4) {
        #ifdef MAXPOP
        if (value == 1) {
            state->pop++;
            if (state->pop > MAXPOP) {
                return false;
            }
        }
        #endif
        state->set_cells++;
        state->grid[t][y][x] = value;
        return (mode == IMPLICATION ? true : check_forward_implication(state, t, x, y)) && check_backward_implication(state, t - 1, x, y) && check_forward_implication(state, t, x - 1, y - 1) && check_forward_implication(state, t, x - 1, y) && check_forward_implication(state, t, x - 1, y + 1) && check_forward_implication(state, t, x, y - 1) && check_forward_implication(state, t, x, y + 1) && check_forward_implication(state, t, x + 1, y - 1) && check_forward_implication(state, t, x + 1, y) && check_forward_implication(state, t, x + 1, y + 1);
    } else {
        return set_var(state, CELL_VAR_TO_VAR(prev_value), value);
    }
}

static cell_t prev_values[MAX_VAR_USES];

// set a variable to a value, propagating implication checking
// returns false if contradiction, true if no contradiction
static bool set_var(search_state* state, int var, cell_t value) {
    #if DEBUG >= 3
    printf("Setting variable %i to %i\n", var, value);
    #endif
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        int t = var_uses[var][use][1];
        int x = var_uses[var][use][2];
        int y = var_uses[var][use][3];
        #if DEBUG >= 5
        printf("Read variable data: t = %i, x = %i, y = %i\n", t, x, y);
        #endif
        cell_t prev_value = state->grid[t][y][x];
        prev_values[use] = prev_value;
        if (IS_KNOWN(prev_value)) {
            if (prev_value != value) {
                return false;
            }
        } else {
            #ifdef MAXPOP
            if (value == 1) {
                state->pop++;
                if (state->pop > MAXPOP) {
                    return false;
                }
            }
            #endif
            state->set_cells++;
            state->grid[t][y][x] = value;
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
            if (!(check_forward_implication(state, t, x, y) && check_backward_implication(state, t - 1, x, y) && check_forward_implication(state, t, x - 1, y - 1) && check_forward_implication(state, t, x - 1, y) && check_forward_implication(state, t, x - 1, y + 1) && check_forward_implication(state, t, x, y - 1) && check_forward_implication(state, t, x, y + 1) && check_forward_implication(state, t, x + 1, y - 1) && check_forward_implication(state, t, x + 1, y) && check_forward_implication(state, t, x + 1, y + 1))) {
                return false;
            }
        }
        if (there_is_more == 0) {
            break;
        }
    }
    return true;
}

static uint64_t solutions_found;

static double get_time() {
    return (double)(clock()) / CLOCKS_PER_SEC;
}

static double start;
static double last_progress_shown;

static long long branches;

static void run_depth(int depth) {
    branches++;
    if (depth > unknown_cells || states[depth - 1]->set_cells == unknown_cells) {
        search_state* state = states[depth - 1];
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
            return;
        }
        #endif
        solutions_found++;
        #if DEBUG >= 2
        printf("Grid:\n");
        for (int i = 0; i < depth; i++) {
            print_grid(states[i]);
        }
        #endif
        printf("Solution found:\nx = 0, y = 0, rule = "RULE"\n");
        for (int y = 2; y < HEIGHT - 2; y++) {
            for (int x = 2; x < WIDTH - 2; x++) {
                cell_t value = state->grid[0][y][x];
                if (value > 1) {
                    printf("\nError: This error should not occur, please report (unknown cell in solution)\n");
                    exit(1);
                }
                printf("%c", value ? 'o' : '.');
            }
            if (y == HEIGHT - 3) {
                printf("!\n");
            } else {
                printf("$\n");
            }
        }
        return;
    }
    search_state* state = states[depth];
    #if DEBUG >= 2
    printf("Running depth %i\n", depth);
    #if DEBUG >= 3
    copy_state(states[depth - 1], state);
    printf("Grid:\n");
    print_grid(state);
    #endif
    #endif
    double time = get_time();
    if (time - last_progress_shown > 1) {
        last_progress_shown = time;
        printf("%i seconds, %lld branches, progress: ", (int)(time - start), branches);
        int end = depth - 1 < 30 ? depth - 1 : 30;
        for (int i = 0; i < end; i++) {
            int* cell = search_order[i];
            cell_t value = states[depth - 1]->grid[cell[0]][cell[2]][cell[1]];
            printf("%c", value ? '1' : '0');
        }
        printf("\n");
    }
    int* cell = search_order[depth - 1];
    if (IS_KNOWN(states[depth - 1]->grid[cell[0]][cell[2]][cell[1]])) {
        copy_state(states[depth - 1], state);
        run_depth(depth + 1);
        return;
    }
    for (int value = 0; value < 2; value++) {
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
    search_state* state = states[0];
    // preprocessing: search for and remove trivial cells
    printf("Preprocessing\n");
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                if (!check_forward_implication(state, t, x, y)) {
                    printf("Contradiction found in preprocessing (cell at t = %i, x = %i, y = %i)", t, x, y);
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
        printf("Proven unsatisfiable in preprocesing\n");
        return 0;
    }
    printf("%i unknown cells (%i total cells, %i trivial cells found)\n", unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
    // long value = strtol(
    //     "00" "01" "00"
    //     "00" "10" "00"
    //     "00" "01" "00"
    //     "01"
    // , NULL, 2);
    // printf("%ld -> %i\n", value, big_trs_backward[value]);
    printf("Running search\n");
    #if DEBUG >= 1
    printf("Grid:\n");
    print_grid(state);
    #endif
    start = get_time();
    last_progress_shown = start;
    run_depth(1);
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %lld branches\n", solutions_found, get_time() - start, branches);
    free_states();
    return 0;
}
