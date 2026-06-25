
// defines the core searching algorithm

#pragma once

#include <stdlib.h>

#include "params2.h"
#include "base.c"

#if VARIABLES
#include <stdio.h>
#endif


// the transition lookup table for the 3-state rule including unknown cells
// the result is + 4 if it should be updated when changing the rule
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh
// 01 67 cd
// 23 89 ef
// 45 ab gh
cell_value_t big_trs[262144];
#define IS_BIG_TRS_RULE_DEPENDANT(x) ((x) > 3)
#define TO_BIG_TRS_RULE_DEPENDANT(x) ((x) + 4)
#define FROM_BIG_TRS_RULE_DEPENDANT(x) ((x) - 4)

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
            #if MULTI_RULE
            cell_value_t value = trs[next | state];
            return value == TRS_RULE_DEPENDANT ? TO_BIG_TRS_RULE_DEPENDANT(UNKNOWN) : value;
            #else
            return trs[next | state];
            #endif
        } else {
            cell_value_t a = trs[next | 0];
            cell_value_t b = trs[next | 1];
            // unknown cell: if they disagree return unknown
            #if MULTI_RULE
            return a == b ? (a == TRS_RULE_DEPENDANT ? TO_BIG_TRS_RULE_DEPENDANT(UNKNOWN) : a) : UNKNOWN;
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
            return a == b ? (a == TRS_RULE_DEPENDANT ? TO_BIG_TRS_RULE_DEPENDANT(UNKNOWN) : a) : UNKNOWN;
            #else
            return a == b ? a : UNKNOWN;
            #endif
        }
    }
}

// implication table
// tells us what values of unknown cells we can set
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 67 cd
// 23 89 ef -> ij
// 45 ab gh
// return value is a uint32_t of the same format as the index
// do nothing = 2, set off = 0, set on = 1
// and special CONTRADICTION, DO_NOTHING, and IMPLICATION_RULE_DEPENDANT values (DO_NOTHING means for all cells)
int32_t implications[1048576];

#define CONTRADICTION -1
#define DO_NOTHING -2
#define IMPLICATION_RULE_DEPENDANT -3

#if false
#define SPECIALDEBUGPRINTF printf
#else
#define SPECIALDEBUGPRINTF(...)
#endif

static inline int32_t get_implication(uint32_t tr) {
    // invalid transition
    for (int i = 0; i < 20; i += 2) {
        if (((tr >> i) & 3) == 3) {
            return CONTRADICTION;
        }
    }
    cell_value_t next = tr & 3;
    cell_value_t target = big_trs[tr >> 2];
    SPECIALDEBUGPRINTF("target = %i\n", target);
    #if MULTI_RULE
    if (IS_BIG_TRS_RULE_DEPENDANT(target)) {
        // return IMPLICATION_RULE_DEPENDANT;
        target = FROM_BIG_TRS_RULE_DEPENDANT(target);
    }
    #endif
    // check for contradiction
    if (target != UNKNOWN && next != UNKNOWN && target != next) {
        SPECIALDEBUGPRINTF("tr = %i, early contradiction detected, target = %i, next = %i, returning CONTRADICTION\n", tr, target, next);
        return CONTRADICTION;
    }
    int32_t out = 0b10101010101010101010;
    if (next == UNKNOWN) {
        if (target != UNKNOWN) {
            out = (out & ~3) | target;
            tr = (tr & ~3) | target;
            next = target;
        } else {
            // if we can't infer the correct cell value in the next generation, nothing can be implied
            SPECIALDEBUGPRINTF("tr = %i, no implication possible, target = %i, next = %i, returning DO_NOTHING\n", tr, target, next);
            return DO_NOTHING;
        }
    }
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != UNKNOWN) {
            continue;
        }
        uint32_t tr2 = tr & ~(3 << i);
        cell_value_t forward_0 = big_trs[tr2 >> 2];
        #if MULTI_RULE
        if (IS_BIG_TRS_RULE_DEPENDANT(forward_0)) {
            // return IMPLICATION_RULE_DEPENDANT;
            forward_0 = FROM_BIG_TRS_RULE_DEPENDANT(forward_0);
        }
        #endif
        bool zero_possible = forward_0 == next || forward_0 == UNKNOWN;
        cell_value_t forward_1 = big_trs[(tr2 | (1 << i)) >> 2];
        #if MULTI_RULE
        if (IS_BIG_TRS_RULE_DEPENDANT(forward_1)) {
            // return IMPLICATION_RULE_DEPENDANT;
            forward_1 = FROM_BIG_TRS_RULE_DEPENDANT(forward_1);
        }
        #endif
        bool one_possible = forward_1 == next || forward_1 == UNKNOWN;
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
            SPECIALDEBUGPRINTF("contradiction detected, returning CONTRADICTION\n");
            return CONTRADICTION;
        }
    }
    out = out == 0b10101010101010101010 ? DO_NOTHING : out;
    SPECIALDEBUGPRINTF("result: %i -> %i\n", tr, out);
    return out;
}

static inline void generate_big_trs(void) {
    for (uint32_t tr = 0; tr < 262144; tr++) {
        big_trs[tr] = get_big_tr(0, tr, 0);
    }
    for (uint32_t tr = 0; tr < 1048576; tr++) {
        implications[tr] = get_implication(tr);
    }
    #if MULTI_RULE
    for (uint32_t tr = 0; tr < 512; tr++) {
        if (trs[tr] == 3) {
            uint32_t tr2 = TR_TO_BIG_TR(tr) << 2;
            implications[tr2] = IMPLICATION_RULE_DEPENDANT;
            implications[tr2 | 1] = IMPLICATION_RULE_DEPENDANT;
        }
    }
    #endif
}


static bool set_cell_and_propagate(cell* cell, cell_value_t value);

#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
int32_t rule_dependent_tr = -1;
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
    uint32_t tr = 
            (cell->nw->value << 18)
          | (cell->w->value << 16)
          | (cell->sw->value << 14)
          | (cell->n->value << 12)
          | (cell->value << 10)
          | (cell->s->value << 8)
          | (cell->ne->value << 6)
          | (cell->e->value << 4)
          | (cell->se->value << 2)
          | (cell->next->value);
    int32_t value = implications[tr];
    DPRINTF4("Implication: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, tr, (int)value);
    if (value == DO_NOTHING) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION, tr = %i, t = %i, x = %i, y = %i)\n", tr, cell->t, cell->x, cell->y);
        return false;
    }
    #if MULTI_RULE
    if (value == IMPLICATION_RULE_DEPENDANT) {
        rule_dependent_tr =
                (cell->nw->value << 8)
              | (cell->w->value << 7)
              | (cell->sw->value << 6)
              | (cell->n->value << 5)
              | (cell->value << 4)
              | (cell->s->value << 3)
              | (cell->ne->value << 2)
              | (cell->e->value << 1)
              | (cell->se->value);
        return false;
    }
    #endif
    #define check(cell, value) \
        if ((value) != UNKNOWN) { \
            if (!set_cell_and_propagate((cell), (value))) { \
                return false; \
            } \
        }
    check(cell, (value >> 10) & 3);
    check(cell->next, value & 3);
    check(cell->se, (value >> 2) & 3);
    check(cell->e, (value >> 4) & 3);
    check(cell->ne, (value >> 6) & 3);
    check(cell->s, (value >> 8) & 3);
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


#if MULTI_RULE

int tr_to_bound_tr[512];

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < MAX_MAP_TRS_PER_BOUND_TR + 1; i++) {
        int16_t tr2 = bound_trs[tr_to_bound_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        trs[tr2] = value;
        big_trs[TR_TO_BIG_TR(tr2)] = value;
    }
    // i'm not sure if you need to do this
    // so i hope you don't
    // for (int i = 0; i < 262144; i++) {
    //     if (IS_BIG_TRS_RULE_DEPENDANT(big_trs[i])) {
    //         big_trs[i] = get_big_tr(0, i, 0);
    //     }
    // }
    for (int i = 0; i < MAX_MAP_TRS_PER_BOUND_TR + 1; i++) {
        int16_t tr2 = bound_trs[tr_to_bound_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        uint32_t tr3 = TR_TO_BIG_TR((uint32_t)tr2) << 2;
        if (value == 3) {
            implications[tr3] = IMPLICATION_RULE_DEPENDANT;
            implications[tr3 | 1] = IMPLICATION_RULE_DEPENDANT;
        } else {
            implications[tr3] = get_implication(tr3);
            implications[tr3 | 1] = get_implication(tr3 | 1);
        }
    }
}

static inline void init_tr_to_bound_tr() {
    for (int tr = 0; tr < 512; tr++) {
        bool found = false;
        for (int i = 0; i < BOUND_TRANSITION_COUNT; i++) {
            for (int j = 0; j < MAX_MAP_TRS_PER_BOUND_TR; j++) {
                int value = bound_trs[i][j];
                if (value == -1) {
                    break;
                } else if (value == tr) {
                    found = true;
                    break;
                }
            }
            if (found) {
                tr_to_bound_tr[tr] = i;
                break;
            }
        }
        if (!found) {
            fprintf(stderr, "\nError: This error should not occur (nonexistent transition in init_multi_rule: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
}

#endif
