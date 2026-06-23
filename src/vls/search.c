
// defines the core searching algorithm

#pragma once

#include <stdio.h>

#include "params2.h"
#include "base.c"


// the transition lookup table for the 3-state rule including unknown cells
// the result is 3 if it's rule-dependent, and it's + 4 if it should be updated when changing the rule
// indexed in ternary: abc_def_ghi
// a d g
// b e h
// c f i
cell_value_t big_trs_forward[19683];

static cell_value_t get_forward_big_tr(int prev, uint32_t tr, int depth) {
    int state = tr % 3;
    tr /= 3;
    int next = prev << 1;
    if (depth == 8) {
        if (IS_KNOWN(state)) {
            return trs[next | state];
        } else {
            cell_value_t a = trs[next | 0];
            // #if MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            cell_value_t b = trs[next | 1];
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
            cell_value_t a = get_forward_big_tr(next | 0, tr, depth + 1);
            // #if MULTI_RULE
            // if (a == 3) {
            //     return 3;
            // }
            // #endif
            cell_value_t b = get_forward_big_tr(next | 1, tr, depth + 1);
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
// indexes are ternary: abcdefghij
// a d g
// b e h -> j
// c f i
// return value is an int32_t of the same format as the index but / 3, so no j
// do nothing = 2, set off = 0, set on = 1
// contradiction = BACKWARD_CONTRADICTION, do nothing = BACKWARD_DO_NOTHING
#define BACKWARD_CONTRADICTION (0xffff)
#define BACKWARD_DO_NOTHING (0xfffe)
uint16_t big_trs_backward[59049];

#if false
#define SPECIALDEBUGPRINTF printf
#else
#define SPECIALDEBUGPRINTF(...)
#endif

static inline uint16_t get_backward_big_tr(uint32_t tr) {
    if ((tr % 3) == UNKNOWN) {
        SPECIALDEBUGPRINTF("(tr %% 3) == UNKNOWN, returning BACKWARD_DO_NOTHING\n");
        return BACKWARD_DO_NOTHING;
    }
    // check for contradiction
    cell_value_t target = big_trs_forward[tr / 3];
    // if (target == UNKNOWN) {
    //     return BACKWARD_DO_NOTHING;
    // }
    // if (target != (tr % 3)) {
    //     return BACKWARD_CONTRADICTION;
    // }
    if (target != UNKNOWN && target != (tr % 3)) {
        SPECIALDEBUGPRINTF("early contradiction detected, target = %i, tr %% 3 = %i, returning BACKWARD_CONTRADICTION\n", target, tr % 3);
        return BACKWARD_CONTRADICTION;
    }
    // 222222222 in base 3
    uint16_t out = 19682;
    uint32_t mask = 3;
    uint32_t out_mask = 1;
    for (int i = 1; i < 10; i++) {
        if (((tr / mask) % 3) != UNKNOWN) {
            continue;
        }
        // remove the unknown trit, setting it to 0
        uint32_t tr2 = tr - (UNKNOWN * mask);
        cell_value_t forward_0 = big_trs_forward[tr2 / 3];
        bool zero_possible = forward_0 == (tr % 3) || forward_0 == UNKNOWN;
        // and for this one we have to set the unknown trit to 1
        cell_value_t forward_1 = big_trs_forward[(tr2 + (1 * mask)) / 3];
        bool one_possible = forward_1 == (tr % 3) || forward_1 == UNKNOWN;
        SPECIALDEBUGPRINTF("i = %i, tr2 = %i, zero: %i -> %i -> %s, one: %i -> %i -> %s, tr & 3 = %i\n", i, tr2, tr2 / 3, forward_0, zero_possible ? "true" : "false", (tr2 + (1 * mask)) / 3, forward_1, one_possible ? "true" : "false", tr & 3);
        if (one_possible && !zero_possible) {
            // must be 1
            SPECIALDEBUGPRINTF("must be 1\n");
            out = out - (((out / out_mask) % 3) * out_mask) + 1 * out_mask;
        } else if (zero_possible && !one_possible) {
            // must be 0
            SPECIALDEBUGPRINTF("must be 0\n");
            out = out - (((out / out_mask) % 3) * out_mask) + 0 * out_mask;
        } else if (!zero_possible && !one_possible) {
            // contradiction
            SPECIALDEBUGPRINTF("contradiction detected, returning BACKWARD_CONTRADICTION\n");
            return BACKWARD_CONTRADICTION;
        }
        mask *= 3;
        out_mask *= 3;
    }
    SPECIALDEBUGPRINTF("finished normally\n");
    return out;
}

#endif

static inline void generate_big_trs(void) {
    for (uint32_t tr = 0; tr < 19683; tr++) {
        big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    }
    #if CHECK_BACKWARDS_IMPLICATIONS
    for (uint32_t tr = 0; tr < 59049; tr++) {
        uint32_t value = get_backward_big_tr(tr);
        big_trs_backward[tr] = value == 19682 ? BACKWARD_DO_NOTHING : value;
    }
    #endif
}


static bool set_cell_and_propagate(cell* cell, cell_value_t value);


#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
uint32_t rule_dependent_tr = -1;
#endif


// check if the unknown cell can be set, and if so, set it, propagating checks
// returns false if contradiction (or rule-dependent), true if no contradiction
static inline bool check_forward_implication(cell* cell) {
    #if TIME_WRAP
    if (cell == NULL) {
        return true;
    }
    #else
    if (cell == NULL || cell->next == NULL) {
        return true;
    }
    #endif
    int tr = ((int)(cell->nw->value & 3) * 6561)
           + ((int)(cell->w->value & 3) * 2187)
           + ((int)(cell->sw->value & 3) * 729)
           + ((int)(cell->n->value & 3) * 243)
           + ((int)(cell->value & 3) * 81)
           + ((int)(cell->s->value & 3) * 27)
           + ((int)(cell->ne->value & 3) * 9)
           + ((int)(cell->e->value & 3) * 3)
           + ((int)(cell->se->value & 3));
    int value = cell->next->value;
    int tr_value = big_trs_forward[tr];
    DPRINTF4("Forward: t = %i, x = %i, y = %i, tr = %i, value = %i, tr_value = %i\n", cell->t, cell->x, cell->y, tr, (int)value, (int)tr_value);
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
                DPRINTF4("Contradiction (forward, both known and unequal, t = %i, x = %i, y = %i)\n", cell->t, cell->x, cell->y);
                #if MULTI_RULE
                rule_dependent_tr = -1;
                #endif
                return false;
            } else {
                bool out = set_cell_and_propagate(cell->next, tr_value);
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
static inline bool check_backward_implication(cell* cell) {
    #if TIME_WRAP
    if (cell == NULL
        || cell->x <= (LEFT == NONE ? 1 : 0)
        || cell->x >= (RIGHT == NONE ? WIDTH - 2 : WIDTH - 1)
        || cell->y <= (TOP == NONE ? 1 : 0)
        || cell->y >= (BOTTOM == NONE ? HEIGHT - 2 : HEIGHT - 1)) {
        return true;
    }
    #else
    if (cell == NULL || cell->next == NULL
        || cell->x <= (LEFT == NONE ? 1 : 0)
        || cell->x >= (RIGHT == NONE ? WIDTH - 2 : WIDTH - 1)
        || cell->y <= (TOP == NONE ? 1 : 0)
        || cell->y >= (BOTTOM == NONE ? HEIGHT - 2 : HEIGHT - 1)) {
        return true;
    }
    #endif
    uint32_t tr = ((uint32_t)(cell->nw->value & 3) * 19683)
                + ((uint32_t)(cell->w->value & 3) * 6561)
                + ((uint32_t)(cell->sw->value & 3) * 2187)
                + ((uint32_t)(cell->n->value & 3) * 729)
                + ((uint32_t)(cell->value & 3) * 243)
                + ((uint32_t)(cell->s->value & 3) * 81)
                + ((uint32_t)(cell->ne->value & 3) * 27)
                + ((uint32_t)(cell->e->value & 3) * 9)
                + ((uint32_t)(cell->se->value & 3) * 3)
                + ((uint32_t)(cell->next->value & 3));
    uint32_t value = big_trs_backward[tr];
    DPRINTF4("Backward: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, tr, (int)value);
    if (value == BACKWARD_DO_NOTHING) {
        return true;
    } else if (value == BACKWARD_CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (backward, value = 3, tr = %i, t = %i, x = %i, y = %i)\n", tr, cell->t, cell->x, cell->y);
        return false;
    }
    #define check(cell, value) \
        if ((value) != 2) { \
            if (!set_cell_and_propagate((cell), (value))) { \
                return false; \
            } \
        }
    check(cell->se, value % 3);
    check(cell->e, (value / 3) % 3);
    check(cell->ne, (value / 9) % 3);
    check(cell->s, (value / 27) % 3);
    check(cell, (value / 81) % 3);
    check(cell->n, (value / 243) % 3);
    check(cell->sw, (value / 729) % 3);
    check(cell->w, (value / 2187) % 3);
    check(cell->nw, (value / 6561) % 3);
    #undef check
    return true;
}

#endif

#if CHECK_BACKWARDS_IMPLICATIONS
#define CHECK_IMPLICATIONS(cell) ( \
       check_forward_implication((cell)) \
    && check_forward_implication((cell)->nw) \
    && check_forward_implication((cell)->n) \
    && check_forward_implication((cell)->ne) \
    && check_forward_implication((cell)->w) \
    && check_forward_implication((cell)->e) \
    && check_forward_implication((cell)->sw) \
    && check_forward_implication((cell)->s) \
    && check_forward_implication((cell)->se) \
    && check_backward_implication((cell)) \
    && check_backward_implication((cell)->prev) \
    && check_backward_implication((cell)->nw) \
    && check_backward_implication((cell)->n) \
    && check_backward_implication((cell)->ne) \
    && check_backward_implication((cell)->w) \
    && check_backward_implication((cell)->e) \
    && check_backward_implication((cell)->sw) \
    && check_backward_implication((cell)->s) \
    && check_backward_implication((cell)->se) \
)
#else
#define CHECK_IMPLICATIONS(cell) ( \
       check_forward_implication((cell)) \
    && check_forward_implication((cell)->nw) \
    && check_forward_implication((cell)->n) \
    && check_forward_implication((cell)->ne) \
    && check_forward_implication((cell)->w) \
    && check_forward_implication((cell)->e) \
    && check_forward_implication((cell)->sw) \
    && check_forward_implication((cell)->s) \
    && check_forward_implication((cell)->se) \
)
#endif


cell_value_t prev_values[MAX_VAR_USES];

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(cell* cell, cell_value_t value) {
    DPRINTF3("Setting cell and propagating: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    DPRINTGRID4();
    if (IS_KNOWN(cell->value)) {
        #if DEBUG >= 4
        if (cell->value != value) {
            DPRINTF4("Contradiction (previous value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
        }
        #endif
        return cell->value == value;
    } else if (cell->value < 4) {
        if (!set_cell(cell, value)) {
            return false;
        }
        return CHECK_IMPLICATIONS(cell);
    }
    cell_value_t var = CELL_VAR_TO_VAR(cell->value);
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, cell->t, cell->x, cell->y);
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        prev_values[use] = cell->value;
        if (IS_KNOWN(cell->value)) {
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
        if (!IS_KNOWN(prev_values[use])) {
            if (!CHECK_IMPLICATIONS(cell)) {
                return false;
            }
        }
    }
    return true;
}
