
// defines the core searching algorithm

#pragma once

#include <stdio.h>

#include "params2.h"
#include "base.c"


// the transition lookup table for the 3-state rule including unknown cells
// the result is 3 if it's rule-dependent, and it's + 4 if it should be updated when changing the rule
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh
// 01 67 cd
// 23 89 ef
// 45 ab gh
cell_value_t big_trs[262144];

static cell_value_t get_big_tr(int prev, uint32_t tr, int depth) {
    int state = tr & 3;
    tr >>= 2;
    int next = prev << 1;
    // shortcut
    if (state == 3) {
        return 0;
    }
    if (depth == 8) {
        if (state != UNKNOWN) {
            return trs[next | state];
        } else {
            cell_value_t a = trs[next | 0];
            cell_value_t b = trs[next | 1];
            // unknown cell: if they disagree return unknown
            #if MULTI_RULE
            return a == b ? (a == 3 ? 4 + UNKNOWN : a) : UNKNOWN;
            #else
            return a == b ? a : UNKNOWN;
            #endif
        }
    } else {
        if (state != UNKNOWN) {
            return get_big_tr(next | state, tr, depth + 1);
        } else {
            cell_value_t a = get_big_tr(next | 0, tr, depth + 1);
            cell_value_t b = get_big_tr(next | 1, tr, depth + 1);
            // unknown cell: if they disagree return unknown
            #if MULTI_RULE
            return a == b ? (a == 3 ? 4 + UNKNOWN : a) : UNKNOWN;
            #else
            return a == b ? a : UNKNOWN;
            #endif
        }
    }
}

// backwards lookup table
// this is about as crazy as it sounds so hear me out
// (ok fine it's not that crazy all previous lifesrcs do this)
// we see what values of unknown cells we can set
// because we know that they won't be settable
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 67 cd
// 23 89 ef -> ij
// 45 ab gh
// return value is a uint32_t of the same format as the index
// do nothing = 2, set off = 0, set on = 1, contradiction = 3, do nothing for any cell = 15
uint32_t implications[1048576];

#define CONTRADICTION 3
#define DO_NOTHING 15

#if false
#define SPECIALDEBUGPRINTF printf
#else
#define SPECIALDEBUGPRINTF(...)
#endif

static inline uint32_t get_implication_tr(uint32_t tr) {
    for (int i = 0; i < 20; i += 2) {
        if (((tr >> i) & 3) == 3) {
            return CONTRADICTION;
        }
    }
    // check for contradiction
    cell_value_t target = big_trs[tr >> 2];
    if (target != UNKNOWN && (tr & 3) != UNKNOWN && target != (tr & 3)) {
        SPECIALDEBUGPRINTF("early contradiction detected, target = %i, tr & 3 = %i, returning CONTRADICTION\n", target, tr & 3);
        return CONTRADICTION;
    }
    uint32_t out = 0b10101010101010101010;
    if ((tr & 3) == UNKNOWN) {
        cell_value_t value = big_trs[tr >> 2];
        if (value != UNKNOWN) {
            out = (out & ~3) | value;
            tr = (tr & ~3) | value;
        } else {
            // if we can't infer the correct cell value in the next generation, nothing can be implied
            return DO_NOTHING;
        }
    }
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != UNKNOWN) {
            continue;
        }
        uint32_t tr2 = tr & ~(3 << i);
        cell_value_t forward_0 = big_trs[tr2 >> 2];
        bool zero_possible = forward_0 == (tr & 3) || forward_0 == UNKNOWN;
        cell_value_t forward_1 = big_trs[(tr2 | (1 << i)) >> 2];
        bool one_possible = forward_1 == (tr & 3) || forward_1 == UNKNOWN;
        SPECIALDEBUGPRINTF("i = %i, tr2 = %i, zero: %i -> %i -> %s, one: %i -> %i -> %s, tr & 3 = %i\n", i, tr2, tr2 >> 2, forward_0, zero_possible ? "true" : "false", (tr2 | (1 << i)) >> 2, forward_1, one_possible ? "true" : "false", tr & 3);
        if (one_possible && !zero_possible) {
            SPECIALDEBUGPRINTF("must be 1\n");
            // must be 1
            out = (out & ~(3 << i)) | (1 << i);
        } else if (zero_possible && !one_possible) {
            SPECIALDEBUGPRINTF("must be 0\n");
            // must be 0
            out = (out & ~(3 << i)) | (0 << i);
        } else if (!zero_possible && !one_possible) {
            // contradiction
            SPECIALDEBUGPRINTF("contradiction detected, returning 3\n");
            return CONTRADICTION;
        }
    }
    SPECIALDEBUGPRINTF("result: %i -> %i", tr, out);
    return out;
}

static inline void generate_big_trs(void) {
    for (uint32_t tr = 0; tr < 262144; tr++) {
        big_trs[tr] = get_big_tr(0, tr, 0);
    }
    for (uint32_t tr = 0; tr < 1048576; tr++) {
        uint32_t value = get_implication_tr(tr);
        implications[tr] = value == 0b10101010101010101010 ? DO_NOTHING : value;
    }
}


static bool set_cell_and_propagate(cell* cell, cell_value_t value);

#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
uint32_t rule_dependent_tr = -1;
#endif

// returns false if contradiction, true if no contradiction
static inline bool check_implication(cell* cell) {
    if (cell == NULL) {
        return true;
    }
    #if !TIME_WRAP
    if (cell->next == NULL) {
        return true;
    }
    #endif
    if (cell->x == 0 || cell->y == 0 || cell->x == WIDTH - 1 || cell->y == HEIGHT - 1) {
        return true;
    }
    uint32_t value = implications[cell->big_tr];
    DPRINTF4("Implication: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, cell->big_tr, (int)value);
    if (value == DO_NOTHING) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION, tr = %i, t = %i, x = %i, y = %i)\n", cell->big_tr, cell->t, cell->x, cell->y);
        return false;
    }
    #define check(cell, value) \
        if ((value) != UNKNOWN) { \
            if (!set_cell_and_propagate((cell), (value))) { \
                return false; \
            } \
        }
    check(cell->next, value & 3);
    check(cell->se, (value >> 2) & 3);
    check(cell->e, (value >> 4) & 3);
    check(cell->ne, (value >> 6) & 3);
    check(cell->s, (value >> 8) & 3);
    check(cell, (value >> 10) & 3);
    check(cell->n, (value >> 12) & 3);
    check(cell->sw, (value >> 14) & 3);
    check(cell->w, (value >> 16) & 3);
    check(cell->nw, value >> 18);
    #undef check
    return true;
}

#define CHECK_IMPLICATIONS(cell) ( \
       check_implication((cell)) \
    && check_implication((cell)->prev) \
    && check_implication((cell)->nw) \
    && check_implication((cell)->n) \
    && check_implication((cell)->ne) \
    && check_implication((cell)->w) \
    && check_implication((cell)->e) \
    && check_implication((cell)->sw) \
    && check_implication((cell)->s) \
    && check_implication((cell)->se) \
)


#if VARIABLES
cell_value_t prev_values[MAX_VAR_USES];
#endif

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(cell* cell, cell_value_t value) {
    DPRINTF3("Setting cell and propagating: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    DPRINTGRID4();
    if (cell->value != UNKNOWN) {
        #if DEBUG >= 4
        if (cell->value != value) {
            DPRINTF4("Contradiction (previous value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
        }
        #endif
        return cell->value == value;
    }
    #if VARIABLES
    else if (cell->var == 0) {
        if (!set_cell(cell, value)) {
            return false;
        }
        return CHECK_IMPLICATIONS(cell);
    }
    var_t var = cell->var;
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, cell->t, cell->x, cell->y);
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        prev_values[use] = cell->value;
        if (cell->value != UNKNOWN) {
            if (cell->value != value) {
                DPRINTF4("Contradiction (previous variable value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
                return false;
            }
        } else {
            if (!set_cell(cell, value)) {
                return false;
            }
        }
    }
    DPRINTF4("Checking variable set implications\n");
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        if (prev_values[use] == UNKNOWN) {
            if (!CHECK_IMPLICATIONS(cell)) {
                return false;
            }
        }
    }
    return true;
    #else
    if (!set_cell(cell, value)) {
        return false;
    }
    return CHECK_IMPLICATIONS(cell);
    #endif
}
