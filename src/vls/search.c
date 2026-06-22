
// defines the core searching algorithm

#pragma once

#include <stdio.h>

#include "params2.h"
#include "base.c"


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
            // #if MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            int b = trs[next | 1];
            // #if MULTI_RULE
            // if (b == 3) {
            //     return 3;
            // }
            // #endif
            // unknown cell: if they disagree return unknown
            #if MULTI_RULE
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
            // #if MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            int b = get_forward_big_tr(next | 1, tr, depth + 1);
            // #if MULTI_RULE
            // if (b == 3) {
            //     return 3;
            // }
            // #endif
            // unknown cell: if they disagree return unknown
            #if MULTI_RULE
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
uint32_t big_trs_backward[1048576];

#if false
#define SPECIALDEBUGPRINTF printf
#else
#define SPECIALDEBUGPRINTF(...)
#endif

static inline uint32_t get_backward_big_tr(int tr) {
    if ((tr & 3) == UNKNOWN) {
        SPECIALDEBUGPRINTF("(tr & 3) == UNKNOWN, returning 15\n");
        return 15;
    }
    // check for contradiction
    cell_t target = big_trs_forward[tr >> 2];
    // if (target == UNKNOWN) {
    //     return 15;
    // }
    // if (target != (tr & 3)) {
    //     return 3;
    // }
    if (target != UNKNOWN && target != (tr & 3)) {
        SPECIALDEBUGPRINTF("early contradiction detected, target = %i, tr & 3 = %i, returning 3\n", target, tr & 3);
        return 3;
    }
    uint32_t out = 0b101010101010101010;
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != 2) {
            continue;
        }
        int tr2 = tr & ~(3 << i);
        cell_t forward_0 = big_trs_forward[tr2 >> 2];
        bool zero_possible = forward_0 == (tr & 3) || forward_0 == UNKNOWN;
        cell_t forward_1 = big_trs_forward[(tr2 | (1 << i)) >> 2];
        bool one_possible = forward_1 == (tr & 3) || forward_1 == UNKNOWN;
        SPECIALDEBUGPRINTF("i = %i, tr2 = %i, zero: %i -> %i -> %s, one: %i -> %i -> %s, tr & 3 = %i\n", i, tr2, tr2 >> 2, forward_0, zero_possible ? "true" : "false", (tr2 | (1 << i)) >> 2, forward_1, one_possible ? "true" : "false", tr & 3);
        if (one_possible && !zero_possible) {
            SPECIALDEBUGPRINTF("must be 1\n");
            // must be 1
            out = (out & ~(3 << (i - 2))) | (1 << (i - 2));
        } else if (zero_possible && !one_possible) {
            SPECIALDEBUGPRINTF("must be 0\n");
            // must be 0
            out = (out & ~(3 << (i - 2))) | (0 << (i - 2));
        } else if (!zero_possible && !one_possible) {
            // contradiction
            SPECIALDEBUGPRINTF("contradiction detected, returning 3\n");
            return 3;
        }
    }
    SPECIALDEBUGPRINTF("result: %i -> %i", tr, out);
    return out;
}

#endif

static inline void generate_big_trs(void) {
    for (int tr = 0; tr < 262144; tr++) {
        big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    }
    #if CHECK_BACKWARDS_IMPLICATIONS
    for (int tr = 0; tr < 1048576; tr++) {
        uint32_t value = get_backward_big_tr(tr);
        big_trs_backward[tr] = value == 0b101010101010101010 ? 15 : value;
    }
    #endif
}


// set_cell_and_propagate has different modes depending on its caller
typedef enum set_cell_and_propagate_mode_t {
    NORMAL,
    IMPLICATION,
} set_cell_and_propagate_mode_t;

static bool set_cell_and_propagate(int t, int x, int y, cell_t value, set_cell_and_propagate_mode_t mode);


#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
int rule_dependent_tr = -1;
#endif


// check if the unknown cell can be set, and if so, set it, propagating checks
// returns false if contradiction (or rule-dependent), true if no contradiction
static inline bool check_forward_implication(int t, int x, int y) {
    if (t < 0 || t + 1 >= GENS || x <= 0 || x >= WIDTH - 1 || y <= 0 || y >= HEIGHT - 1) {
        return true;
    }
    grid_item_t* table = grid[t];
    #define get(x, y) ((int)(table[(y)][(x)] & 3))
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
    int value = grid[t + 1][y][x];
    int tr_value = big_trs_forward[tr];
    DPRINTF4("Forward: t = %i, x = %i, y = %i, tr = %i, value = %i, tr_value = %i\n", t, x, y, tr, (int)value, (int)tr_value);
    #if MULTI_RULE
    if (tr_value >= 4) {
        tr_value -= 4;
    }
    if (tr_value == 3) {
        rule_dependent_tr = BIG_TR_TO_TR(tr);
        if (trs[rule_dependent_tr] != 3) {
            fprintf(stderr, "Forward: t = %i, x = %i, y = %i, tr = %i, value = %i, tr_value = %i\n", t, x, y, tr, (int)value, (int)tr_value);
            fprintf(stderr, "\nError: This error should not occur (trs[rule_dependent_tr] != 3 in check_forward_implication)\nPlease report this error along with the debug information printed above\n");
            exit(1);
        }
        return false;
    }
    #endif
    if (value != tr_value) {
        if (IS_KNOWN(tr_value)) {
            if (IS_KNOWN(value)) {
                DPRINTGRID4();
                DPRINTF4("Contradiction (forward, both known and unequal, t = %i, x = %i, y = %i)\n", t, x, y);
                #if MULTI_RULE
                rule_dependent_tr = -1;
                #endif
                return false;
            } else {
                bool out = set_cell_and_propagate(t + 1, x, y, tr_value, IMPLICATION);
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
static inline bool check_backward_implication(int t, int x, int y) {
    if (t < 0 || t + 1 >= GENS
        || x <= (LEFT == NONE ? 1 : 0)
        || x >= (RIGHT == NONE ? WIDTH - 2 : WIDTH - 1)
        || y <= (TOP == NONE ? 1 : 0)
        || y >= (BOTTOM == NONE ? HEIGHT - 2 : HEIGHT - 1)) {
        return true;
    }
    grid_item_t* table = grid[t];
    #define get(x, y) ((int)(table[(y)][(x)] & 3))
    int tr = (get(x - 1, y - 1) << 18)
           | (get(x - 1, y) << 16)
           | (get(x - 1, y + 1) << 14)
           | (get(x, y - 1) << 12)
           | (get(x, y) << 10)
           | (get(x, y + 1) << 8)
           | (get(x + 1, y - 1) << 6)
           | (get(x + 1, y) << 4)
           | (get(x + 1, y + 1) << 2)
           | (((int)(grid[t + 1][y][x] & 3)));
    #undef get
    int value = big_trs_backward[tr];
    DPRINTF4("Backward: t = %i, x = %i, y = %i, tr = %i, value = %i\n", t, x, y, tr, (int)value);
    if (value == 15) {
        return true;
    } else if (value == 3) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (backward, value = 3, tr = %i, t = %i, x = %i, y = %i)\n", tr, t, x, y);
        return false;
    }
    #define check(x, y, value) if (!set_cell_and_propagate(t, (x), (y), (value), NORMAL)) {return false;}
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
#define CHECK_IMPLICATIONS(t, x, y) ( \
    check_forward_implication((t), (x), y) \
    && check_backward_implication((t) - 1, (x), y) \
    && check_backward_implication((t), (x), y) \
    && check_forward_implication((t), (x) - 1, y - 1) \
    && check_forward_implication((t), (x) - 1, y) \
    && check_forward_implication((t), (x) - 1, y + 1) \
    && check_forward_implication((t), (x), y - 1) \
    && check_forward_implication((t), (x), y + 1) \
    && check_forward_implication((t), (x) + 1, y - 1) \
    && check_forward_implication((t), (x) + 1, y) && \
    check_forward_implication((t), (x) + 1, y + 1))
#else
#define CHECK_IMPLICATIONS(t, x, y) ( \
    check_forward_implication((t), (x), y) \
    && check_forward_implication((t), (x) - 1, y - 1) \
    && check_forward_implication((t), (x) - 1, y) \
    && check_forward_implication((t), (x) - 1, y + 1) \
    && check_forward_implication((t), (x), y - 1) \
    && check_forward_implication((t), (x), y + 1) \
    && check_forward_implication((t), (x) + 1, y - 1) \
    && check_forward_implication((t), (x) + 1, y) && \
    check_forward_implication((t), (x) + 1, y + 1))
#endif


cell_t prev_values[MAX_VAR_USES];

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(int t, int x, int y, cell_t value, set_cell_and_propagate_mode_t mode) {
    cell_t prev_value = grid[t][y][x];
    DPRINTF3("Setting cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", t, x, y, value, prev_value);
    DPRINTGRID4();
    if (IS_KNOWN(prev_value)) {
        return prev_value == value;
    } else if (prev_value < 4) {
        if (!set_cell(t, x, y, value)) {
            return false;
        }
        return CHECK_IMPLICATIONS(t, x, y);
    }
    cell_t var = CELL_VAR_TO_VAR(prev_value);
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, t, x, y);
    for (int use = 0; use < num_var_uses[var]; use++) {
        int t = var_uses[var][use][0];
        int x = var_uses[var][use][1];
        int y = var_uses[var][use][2];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", t, x, y);
        cell_t prev_value = grid[t][y][x];
        prev_values[use] = prev_value;
        if (IS_KNOWN(prev_value)) {
            if (prev_value != value) {
                DPRINTF4("Contradiction (previous variable value mismatch, value = %i, prev_value = %i)\n", value, prev_value);
                return false;
            }
        } else {
            if (!set_cell(t, x, y, value)) {
                return false;
            }
        }
    }
    DPRINTF4("Checking variable set implications\n");
    for (int use = 0; use < num_var_uses[var]; use++) {
        int t = var_uses[var][use][0];
        int x = var_uses[var][use][1];
        int y = var_uses[var][use][2];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", t, x, y);
        if (!IS_KNOWN(prev_values[use])) {
            if (!CHECK_IMPLICATIONS(t, x, y)) {
                return false;
            }
        }
    }
    return true;
}
