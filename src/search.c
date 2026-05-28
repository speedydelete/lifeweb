
#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>


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
#define NUM_VARS 9
// the maximum number of uses of any single variable
#define MAX_VAR_USES 2
// the type of the mask used to store whether variables are set or not
typedef uint16_t set_vars_t;
// whether set_vars_t is array
#define SET_VARS_IS_ARRAY 0
// if set_vars_t is an array, the underlying type
// typedef uint64_t set_vars_item_t;

// utility macros
#define SIZE (HEIGHT * WIDTH)
#define CELL(t, y, x) ((t) * SIZE + (y) * WIDTH + (x))

// uncomment for multi-rule searching
// #define MULTI_RULE

// the type of cells
// 0 = dead, 1 = alive, 2 = unknown, 3 = undefined behavior, >3 = variables (but indexed more complicated)
// the variable indexing for this is 6 + 4*variable (so the binary always ends in 10, so we can do ANDing and ensure that it's unknown)
typedef uint8_t cell_t;

#define VAR_TO_CELL_VAR(x) (6 + 4*(x))
#define CELL_VAR_TO_VAR(x) (((x) >> 2) - 1)

// defines what it is searching for
cell_t initial_grid[GENS][HEIGHT][WIDTH] = {
    {
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 6, 10, 14, 0, 0, 0},
        {0, 0, 18, 22, 26, 0, 0, 0},
        {0, 0, 30, 34, 38, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
    },
    {
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
    },
    {
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
    },
    {
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 2, 2, 2, 2, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
    },
    {
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 6, 10, 14, 0, 0},
        {0, 0, 0, 18, 22, 26, 0, 0},
        {0, 0, 0, 30, 34, 38, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
        {0, 0, 0, 0, 0, 0, 0, 0},
    },
};

// the order that cells are searched in
// format is {t, y, x}
const int search_order[][3] = {
    {0, 2, 2},
    {0, 2, 3},
    {0, 2, 4},
    {0, 3, 2},
    {0, 3, 3},
    {0, 3, 4},
    {0, 4, 2},
    {0, 4, 3},
    {0, 4, 4},
    {1, 2, 2},
    {1, 2, 3},
    {1, 2, 4},
    {1, 2, 5},
    {1, 3, 2},
    {1, 3, 3},
    {1, 3, 4},
    {1, 3, 5},
    {1, 4, 2},
    {1, 4, 3},
    {1, 4, 4},
    {1, 4, 5},
    {1, 5, 2},
    {1, 5, 3},
    {1, 5, 4},
    {1, 5, 5},
    {2, 2, 2},
    {2, 2, 3},
    {2, 2, 4},
    {2, 2, 5},
    {2, 3, 2},
    {2, 3, 3},
    {2, 3, 4},
    {2, 3, 5},
    {2, 4, 2},
    {2, 4, 3},
    {2, 4, 4},
    {2, 4, 5},
    {2, 5, 2},
    {2, 5, 3},
    {2, 5, 4},
    {2, 5, 5},
    {3, 2, 2},
    {3, 2, 3},
    {3, 2, 4},
    {3, 2, 5},
    {3, 3, 2},
    {3, 3, 3},
    {3, 3, 4},
    {3, 3, 5},
    {3, 4, 2},
    {3, 4, 3},
    {3, 4, 4},
    {3, 4, 5},
    {3, 5, 2},
    {3, 5, 3},
    {3, 5, 4},
    {3, 5, 5},
    {4, 3, 3},
    {4, 3, 4},
    {4, 3, 5},
    {4, 4, 3},
    {4, 4, 4},
    {4, 4, 5},
    {4, 5, 3},
    {4, 5, 4},
    {4, 5, 5},
};

// single-rule searching parameters
#ifndef MULTI_RULE

// the rule
#define RULE "B3/S23"

// the transition lookup table for the rule
const uint8_t trs[512] = {0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};

// multi-rule searching parameters
#else

#endif

// END CONFIGURATION


typedef struct search_state {
    cell_t grid[GENS][HEIGHT][WIDTH];
    set_vars_t set_vars;
} search_state;

search_state* states[GENS + 1];

static inline void copy_state(search_state* from, search_state* to) {
    memcpy(to->grid, from->grid, sizeof(to->grid));
    #if SET_VARS_IS_ARRAY
    for (int i = 0; i < sizeof(set_vars_t) / sizeof(set_vars_item_t); i++) {
        to->set_vars[i] = from->set_vars[i];
    }
    #else
    to->set_vars = from->set_vars;
    #endif
}

static inline void init_states(void) {
    search_state* initial_state = malloc(sizeof(search_state));
    memcpy(initial_state->grid, initial_grid, sizeof(initial_grid));
    #if SET_VARS_IS_ARRAY
    for (int i = 0; i < sizeof(set_vars_t) / sizeof(set_vars_item_t); i++) {
        initial_state->set_vars[i] = 0;
    }
    #else
    initial_state->set_vars = 0;
    #endif
    states[0] = initial_state;
    for (int i = 1; i < GENS + 1; i++) {
        search_state* state = malloc(sizeof(search_state));
        copy_state(initial_state, state);
        states[i] = state;
    }
}

static inline void free_states(void) {
//     for (int i = 0; i < GENS; i++) {
//         free(states[i]);
//     }
}


// a list of where variables are used in
// format for each entry: {there_is_more, t, x, y}
int var_uses[NUM_VARS][MAX_VAR_USES][4];

static inline void init_var_uses(void) {
    int num_var_uses[NUM_VARS];
    for (int i = 0; i < NUM_VARS;i ++) {
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
cell_t big_trs[262144];

static int resolve_big_transition(int prev, int tr, int depth) {
    int state = tr & 3;
    tr >>= 2;
    // state 3 is undefined behavior
    if (state == 3) {
        return 2;
    }
    if (depth == 9) {
        if (state < 2) {
            return trs[(prev << 1) | state];
        } else {
            int a = trs[(prev << 1) | 0];
            int b = trs[(prev << 1) | 1];
            // unknown cell: if they disagree return unknown
            return a == b ? a : 2;
        }
    } else {
        if (state < 2) {
            return resolve_big_transition((prev << 1) | state, tr, depth + 1);
        } else {
            int a = resolve_big_transition((prev << 1) | 0, tr, depth + 1);
            int b = resolve_big_transition((prev << 1) | 1, tr, depth + 1);
            return a == b ? a : 2;
        }
    }
}

static inline void generate_big_trs(void) {
    for (int tr = 0; tr < 262144; tr++) {
        big_trs[tr] = resolve_big_transition(0, tr, 0);
    }
}

// get the big transition of a cell
static inline cell_t get_big_tr(search_state* state, int t, int x, int y) {
    #define grid (state->grid[t])
    return big_trs[
        ((grid[y - 1][x - 1] & 3) << 16)
        | ((grid[y - 1][x] & 3) << 14)
        | ((grid[y - 1][x + 1] & 3) << 12)
        | ((grid[y][x - 1] & 3) << 10)
        | ((grid[y][x] & 3) << 8)
        | ((grid[y][x + 1] & 3) << 6)
        | ((grid[y + 1][x - 1] & 3) << 4)
        | ((grid[y + 1][x] & 3) << 2)
        | (grid[y + 1][x + 1] & 3)
    ];
    #undef grid
}

// // check if a cell is a contradiction
// // returns false if contradiction, true if no contradiction
// static inline bool check_contradiction(search_state* state, int i) {
//     cell_t value = state->grid[i];
//     if (value >= 2) {
//         return true;
//     }
//     return value == get_big_tr(state, i);
// }

static bool set_cell(search_state* state, int t, int x, int y, cell_t value);

// check if the unknown cell can be set, and if so, set it, propagating checks
// returns false if contradiction, true if no contradiction
static bool _check_implication(search_state* state, int t, int x, int y) {
    if (!(x > 0 && x < WIDTH - 1 && y > 0 && y < HEIGHT - 1)) {
        return false;
    }
    if (t + 1 > GENS) {
        return true;
    }
    cell_t value = state->grid[t + 1][x][y];
    cell_t tr_value = get_big_tr(state, t, x, y);
    if (value != tr_value) {
        if (value < 2) {
            return false;
        }
        return set_cell(state, t + 1, x, y, tr_value);
    }
    return true;
}

static inline bool check_implication(search_state* state, int t, int x, int y) {
    bool out = _check_implication(state, t, x, y);
    printf("Checking implications for cell at t = %i, (%i, %i): %s\n", t, x, y, out ? "true" : "false");
    return out;
}

static bool set_var(search_state* state, int var, cell_t value);

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell(search_state* state, int t, int x, int y, cell_t value) {
    printf("Setting cell at t = %i, (%i, %i) to %i\n", t, x, y, value);
    cell_t prev_value = state->grid[t][y][x];
    if (prev_value < 2) {
        return prev_value == value;
    } else if (prev_value < 4) {
        state->grid[t][y][x] = value;
    } else {
        set_var(state, prev_value, value);
    }
    return check_implication(state, t, x, y) && check_implication(state, t, x - 1, y - 1) && check_implication(state, t, x - 1, y) && check_implication(state, t, x - 1, y + 1) && check_implication(state, t, x, y - 1) && check_implication(state, t, x, y + 1) && check_implication(state, t, x + 1, y - 1) && check_implication(state, t, x + 1, y) && check_implication(state, t, x + 1, y + 1);
}

// set a variable to a value, propagating implication checking
// returns false if contradiction, true if no contradiction
static bool set_var(search_state* state, int var, cell_t value) {
    #if SET_VARS_IS_ARRAY
    if (state->set_vars[var / (sizeof(var_set_item_t) / 8)] | 1 << (var % (sizeof(var_set_item_t) / 8)))
    #else
    if (state->set_vars | 1 << var)
    #endif
    {
        return false;
    }
    for (int use = 0; use < MAX_VAR_USES; use++) {
        int there_is_more = var_uses[var][use][0];
        int t = var_uses[var][use][1];
        int x = var_uses[var][use][2];
        int y = var_uses[var][use][3];
        if (!set_cell(state, t, x, y, value)) {
            return false;
        }
        if (there_is_more == 0) {
            break;
        }
    }
    return true;
}

uint64_t solutions_found;

void run_depth(int depth) {
    printf("Running depth %i\n", depth);
    search_state* state = states[depth];
    if (depth == GENS + 1) {
        solutions_found++;
        printf("Solution found:\nx = 0, y = 0, rule = "RULE);
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                printf("%c", state->grid[0][y][x] ? 'o' : 'b');
            }
            printf("\n");
        }
        printf("\n");
        return;
    }
    const int* cell = search_order[depth];
    for (int value = 0; value < 2; value++) {
        copy_state(states[depth - 1], state);
        if (set_cell(state, cell[0], cell[1], cell[2], value)) {
            run_depth(depth + 1);
        }
    }
}

int main(void) {
    init_states();
    init_var_uses();
    generate_big_trs();
    printf("Running search\n");
    run_depth(1);
    free_states();
    printf("Search complete, found %"PRIu64" solutions\n", solutions_found);
    return 0;
}
