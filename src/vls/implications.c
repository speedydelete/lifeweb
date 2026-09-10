
// defines the core searching algorithm

#pragma once

#include "params2.h"
#include "base.c"
#include "rulespaces.c"

#if MULTI_RULE
#include <stdio.h>
#endif


// #define IMPLICATION_CHECK_TR 350549

#ifdef IMPLICATION_CHECK_TR
#include <stdio.h>
#define IMPLICATIONDPRINTF(value, ...) if ((value) == IMPLICATION_CHECK_TR) {printf(__VA_ARGS__);}
#else
#define IMPLICATIONDPRINTF(...)
#endif


// implication table
// tells us what values of unknown cells we can set
// transition format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 67 cd
// 23 89 ef -> ij
// 45 ab gh
// return value is an int32_t of the same format as the transition
// do nothing = 0 = UNKNOWN, set off = 1 = OFF, set on = 2 = ON
// (this is disabled actually) but with an optional 21st bit that represents whether any neighbors are set or only the result is
// and special CONTRADICTION and IMPLICATION_RULE_DEPENDENT values
int32_t implications[1048576];

#define DO_NOTHING 0
#define CONTRADICTION -1
#if MULTI_RULE
#define IMPLICATION_RULE_DEPENDENT -3
#endif

static inline uint32_t tr_to_implication_tr(uint32_t tr) {
    uint32_t out = 0;
    out |= ((tr & 1) ? ON : OFF) << 2;
    out |= ((tr & 2) ? ON : OFF) << 4;
    out |= ((tr & 4) ? ON : OFF) << 6;
    out |= ((tr & 8) ? ON : OFF) << 8;
    out |= ((tr & 16) ? ON : OFF) << 10;
    out |= ((tr & 32) ? ON : OFF) << 12;
    out |= ((tr & 64) ? ON : OFF) << 14;
    out |= ((tr & 128) ? ON : OFF) << 16;
    out |= ((tr & 256) ? ON : OFF) << 18;
    return out;
}

static inline int32_t get_implication(uint32_t tr) {
    int next = tr & 3;
    IMPLICATIONDPRINTF(tr, "tr = %i, next = %i\n", tr, next);
    int32_t out = DO_NOTHING;
    // find the value for the next generation
    if (next == UNKNOWN) {
        int32_t forward_0 = implications[(tr & ~3) | OFF];
        int32_t forward_1 = implications[(tr & ~3) | ON];
        bool zero_possible = forward_0 != CONTRADICTION;
        bool one_possible = forward_1 != CONTRADICTION;
        IMPLICATIONDPRINTF(tr, "checking next, (zero: %i -> %i -> %s, one: %i -> %i -> %s\n", (tr & ~3) | OFF, implications[(tr & ~3) | OFF], zero_possible ? "true" : "false", (tr & ~3) | ON, implications[(tr & ~3) | ON], one_possible ? "true" : "false");
        if (!zero_possible && !one_possible) {
            // the cell cannot be any value in the next generation
            IMPLICATIONDPRINTF(tr, "early contradiction, next cell cannot be any value, returning CONTRADICTION\n");
        } else if (zero_possible && !one_possible) {
            // must be off
            IMPLICATIONDPRINTF(tr, "next cell must be off");
            out |= OFF;
            next = OFF;
        } else if (!zero_possible && one_possible) {
            // must be on
            IMPLICATIONDPRINTF(tr, "next cell must be on");
            out |= ON;
            next = ON;
        } else {
            // if we can't infer the correct cell value in the next generation, nothing can be implied
            IMPLICATIONDPRINTF(tr, "no implication possible, next cell can be any value, returning DO_NOTHING\n");
            return DO_NOTHING;
        }
    } else if (next == DONT_CARE) {
        // if the next generation can be anything, nothing can be implied
        IMPLICATIONDPRINTF(tr, "no implication possible, next cell is DONT_CARE, returning DO_NOTHING\n");
        return DO_NOTHING;
    }
    IMPLICATIONDPRINTF(tr, "resolved next = %i\n", next);
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != UNKNOWN) {
            continue;
        }
        uint32_t tr2 = tr & ~(3 << i);
        int32_t forward_0 = implications[tr2 | (OFF << i)];
        int32_t forward_1 = implications[tr2 | (ON << i)];
        bool zero_possible = (forward_0 != CONTRADICTION) && ((forward_0 & 3) == next || (forward_0 & 3) == UNKNOWN || (forward_0 & 3) == DONT_CARE);
        bool one_possible = (forward_1 != CONTRADICTION) && ((forward_1 & 3) == next || (forward_1 & 3) == UNKNOWN || (forward_1 & 3) == DONT_CARE);
        #if MULTI_RULE
        zero_possible |= (forward_0 == IMPLICATION_RULE_DEPENDENT);
        one_possible |= (forward_1 == IMPLICATION_RULE_DEPENDENT);
        #endif
        IMPLICATIONDPRINTF(tr, "i = %i, tr2 = %i, zero: %i -> %i -> %s, one: %i -> %i -> %s, tr & 3 = %i\n", i, tr2, tr2 | (OFF << i), forward_0, zero_possible ? "true" : "false", tr2 | (ON << i), forward_1, one_possible ? "true" : "false", tr & 3);
        if (one_possible && !zero_possible) {
            // must be on
            IMPLICATIONDPRINTF(tr, "must be on\n");
            out = (out & ~(3 << i)) | (ON << i);
        } else if (zero_possible && !one_possible) {
            // must be off
            IMPLICATIONDPRINTF(tr, "must be off\n");
            out = (out & ~(3 << i)) | (OFF << i);
        } else if (!zero_possible && !one_possible) {
            // contradiction
            IMPLICATIONDPRINTF(tr, "contradiction detected, returning CONTRADICTION\n");
            return CONTRADICTION;
        } else {
            // can be on or off, do nothing
        }
    }
    IMPLICATIONDPRINTF(tr, "result: %i -> %i\n", tr, out);
    return out;
}

#if IS_OT
static inline void _generate_implications(void)
#else
static inline void generate_implications(void)
#endif
{
    // fill in the values with 0 unknown cells
    for (int tr = 0; tr < 512; tr++) {
        #if MULTI_RULE
        int value = trs[tr] == TRS_RULE_DEPENDENT ? TRS_RULE_DEPENDENT : (trs[tr] ? ON : OFF);
        #else
        int value = trs[tr] ? ON : OFF;
        #endif
        int tr2 = tr_to_implication_tr(tr);
        #if MULTI_RULE
        if (value == TRS_RULE_DEPENDENT) {
            implications[tr2 | OFF] = IMPLICATION_RULE_DEPENDENT;
            implications[tr2 | ON] = IMPLICATION_RULE_DEPENDENT;
            IMPLICATIONDPRINTF(tr2 | OFF, "tr = %i, value = %i, result = %i\n", tr2 | OFF, value, implications[tr2 | OFF]);
            IMPLICATIONDPRINTF(tr2 | ON, "tr = %i, value = %i, result = %i\n", tr2 | ON, value, implications[tr2 | ON]);
            continue;
        }
        #endif
        implications[tr2 | OFF] = value == OFF ? DO_NOTHING : CONTRADICTION;
        implications[tr2 | ON] = value == ON ? DO_NOTHING : CONTRADICTION;
        IMPLICATIONDPRINTF(tr2 | OFF, "tr = %i, value = %i, result = %i\n", tr2 | OFF, value, implications[tr2 | OFF]);
        IMPLICATIONDPRINTF(tr2 | ON, "tr = %i, value = %i, result = %i\n", tr2 | ON, value, implications[tr2 | ON]);
    }
    // fill in the rest
    for (int unknown = 1; unknown < 8; unknown++) {
        for (uint32_t tr = 0; tr < 1048576; tr++) {
            int tr_unknown = 0;
            bool found = false;
            for (int i = 0; i < 20; i += 2) {
                int part = (tr >> i) & 3;
                if (part == UNKNOWN) {
                    tr_unknown++;
                    if (tr_unknown > unknown) {
                        break;
                    }
                }
            }
            IMPLICATIONDPRINTF(tr, "tr_unknown = %i, found = %s\n", tr_unknown, found ? "true" : "false");
            if (found) {
                implications[tr] = CONTRADICTION;
            } else if (tr_unknown != unknown) {
                continue;
            }
            implications[tr] = get_implication(tr);
        }
    }
}


static bool set_cell_and_propagate(cell* cell, cell_value_t value);


#if !IS_OT


// use normal method for noncontiguous OT rules


#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
int32_t rule_dependent_tr = -1;
#endif

// returns false if contradiction, true if no contradiction
static inline __attribute__((always_inline)) bool check_implication(cell* cell) {
    if (cell == NULL) {
        return true;
    }
    #if !TIME_WRAP
    if (cell->next == NULL) {
        return true;
    }
    #endif
    if (cell->x == 0 || cell->y == 0 || cell->x == WIDTH - 1 || cell->y == HEIGHT - 1) {
        if (cell->next == NULL) {
            return true;
        }
        if (cell->next->value == UNKNOWN) {
            set_cell_and_propagate(cell->next, OFF);
        } else if (cell->next->value == OFF) {
            return true;
        } else {
            return false;
        }
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
          | (cell->next->value << 0);
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
    if (value == IMPLICATION_RULE_DEPENDENT) {
        rule_dependent_tr =
                ((cell->nw->value == ON ? 1 : 0) << 8)
              | ((cell->w->value == ON ? 1 : 0) << 7)
              | ((cell->sw->value == ON ? 1 : 0) << 6)
              | ((cell->n->value == ON ? 1 : 0) << 5)
              | ((cell->value == ON ? 1 : 0) << 4)
              | ((cell->s->value == ON ? 1 : 0) << 3)
              | ((cell->ne->value == ON ? 1 : 0) << 2)
              | ((cell->e->value == ON ? 1 : 0) << 1)
              | ((cell->se->value == ON ? 1 : 0) << 0);
        return false;
    }
    #endif
    #define check(cell, place) \
        if (value & (3 << place)) { \
            if (!set_cell_and_propagate((cell), ((value >> (place)) & 3))) { \
                return false; \
            } \
        }
    check(cell, 10);
    check(cell->next, 0);
    if ((value & 0b11111111001111111100) == 0) {
        return true;
    }
    check(cell->se, 2);
    check(cell->e, 4);
    check(cell->ne, 6);
    check(cell->s, 8);
    check(cell->n, 12);
    check(cell->sw, 14);
    check(cell->w, 16);
    check(cell->nw, 18);
    #undef check
    return true;
}

// returns false if contradiction, true if no contradiction
static inline __attribute__((always_inline)) bool check_implication_for_preprocessing(cell* cell) {
    if (cell == NULL) {
        DPRINTF4("Contradiction (implication, cell == NULL)\n");
        return false;
    }
    uint32_t tr = 
            ((cell->nw ? cell->nw->value : OFF) << 18)
          | ((cell->w ? cell->w->value : OFF) << 16)
          | ((cell->sw ? cell->sw->value : OFF) << 14)
          | ((cell->n ? cell->n->value : OFF) << 12)
          | (cell->value << 10)
          | ((cell->s ? cell->s->value : OFF) << 8)
          | ((cell->ne ? cell->ne->value : OFF) << 6)
          | ((cell->e ? cell->e->value : OFF) << 4)
          | ((cell->se ? cell->se->value : OFF) << 2)
          | ((cell->next ? cell->next->value : OFF) << 0);
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
    if (value == IMPLICATION_RULE_DEPENDENT) {
        rule_dependent_tr =
                ((cell->nw->value == ON ? 1 : 0) << 8)
              | ((cell->w->value == ON ? 1 : 0) << 7)
              | ((cell->sw->value == ON ? 1 : 0) << 6)
              | ((cell->n->value == ON ? 1 : 0) << 5)
              | ((cell->value == ON ? 1 : 0) << 4)
              | ((cell->s->value == ON ? 1 : 0) << 3)
              | ((cell->ne->value == ON ? 1 : 0) << 2)
              | ((cell->e->value == ON ? 1 : 0) << 1)
              | ((cell->se->value == ON ? 1 : 0) << 0);
        return false;
    }
    #endif
    #define check(cell, place) \
        if (value & (3 << place)) { \
            if (!set_cell_and_propagate((cell), ((value >> (place)) & 3))) { \
                return false; \
            } \
        }
    check(cell, 10);
    check(cell->next, 0);
    if ((value & 0b11111111001111111100) == 0) {
        return true;
    }
    check(cell->se, 2);
    check(cell->e, 4);
    check(cell->ne, 6);
    check(cell->s, 8);
    check(cell->n, 12);
    check(cell->sw, 14);
    check(cell->w, 16);
    check(cell->nw, 18);
    #undef check
    return true;
}


#else


// #define OT_IMPLICATION_CHECK_TR 1541

#ifdef OT_IMPLICATION_CHECK_TR
#include <stdio.h>
#define OTIMPLICATIONDPRINTF(value, ...) if ((value) == OT_IMPLICATION_CHECK_TR) {printf(__VA_ARGS__);}
#else
#define OTIMPLICATIONDPRINTF(...)
#endif


// special optimization for contiguous OT rules

// we can optimize the implication table by a lot!
// for more information see https://github.com/DavidKinder/xlife/blob/main/XLife35/source/lifesearch/ORIGIN

// transition format: 0b_cc_nn_llll_dddd
// c is the state of the current cell
// n is the state of the cell in the next generation
// l is the number of live cells
// d is the number of dead cells

// return value format: a bitstring of this format
#define CURRENT_TO_0 1
#define CURRENT_TO_1 2
#define NEXT_TO_0 4
#define NEXT_TO_1 8
#define UNKNOWN_NEIGHBORS_TO_0 16
#define UNKNOWN_NEIGHBORS_TO_1 32

int8_t ot_implications[4096];


static void generate_implications(void) {
    _generate_implications();
    for (int tr = 0; tr < 4096; tr++) {
        int current = (tr >> 10) & 3;
        int next = (tr >> 8) & 3;
        int live = (tr >> 4) & 15;
        int dead = tr & 15;
        OTIMPLICATIONDPRINTF(tr, "current = %i, next = %i, live = %i, dead = %i, unknown = %i\n", current, next, live, dead, 8 - live - dead);
        if (live > 8 || dead > 8 || live + dead > 8) {
            OTIMPLICATIONDPRINTF(tr, "contradiction detected (impossible state)\n");
            ot_implications[tr] = CONTRADICTION;
            continue;
        }
        // calculate the corresponding big transition
        int big_tr = 0;
        big_tr |= current << 10;
        big_tr |= next << 0;
        int next_neighbor_index = 2;
        #define set_neighbor(value) \
            big_tr |= (value) << next_neighbor_index; \
            next_neighbor_index += 2; \
            if (next_neighbor_index == 10) { \
                next_neighbor_index += 2; \
            }
        while (live > 0) {
            set_neighbor(ON);
            live--;
        }
        while (dead > 0) {
            set_neighbor(OFF);
            dead--;
        }
        #undef set_neighbor
        int unknown_index = next_neighbor_index;
        int32_t value = implications[big_tr];
        OTIMPLICATIONDPRINTF(tr, "big_tr = %i, value = %i\n", big_tr, value);
        // and then decode it!
        if (value == CONTRADICTION) {
            ot_implications[tr] = CONTRADICTION;
            continue;
        }
        int8_t out = 0;
        if (((value >> 10) & 3) == OFF) {
            out |= CURRENT_TO_0;
        } else if (((value >> 10) & 3) == ON) {
            out |= CURRENT_TO_1;
        }
        if (((value >> 0) & 3) == OFF) {
            out |= NEXT_TO_0;
        } else if (((value >> 0) & 3) == ON) {
            out |= NEXT_TO_1;
        }
        bool found = false;
        int unknown_value = (value >> unknown_index) & 3;
        if (unknown_value == OFF || unknown_value == ON) {
            for (int i = 2; i < 20; i += 2) {
                if (i == 10) {
                    continue;
                }
                if (((big_tr >> i) & 3) == UNKNOWN && ((value >> i) & 3) != unknown_value) {
                    OTIMPLICATIONDPRINTF(tr, "found = true at i = %i\n", i);
                    found = true;
                    break;
                }
            }
            if (!found) {
                if (unknown_value == OFF) {
                    out |= UNKNOWN_NEIGHBORS_TO_0;
                } else {
                    out |= UNKNOWN_NEIGHBORS_TO_1;
                }
            }
        }
        OTIMPLICATIONDPRINTF(tr, "out = %i\n", out);
        ot_implications[tr] = out;
    }
}



// returns false if contradiction, true if no contradiction
static inline __attribute__((always_inline)) bool check_implication(cell* cell) {
    if (cell == NULL) {
        return true;
    }
    #if !TIME_WRAP
    if (cell->next == NULL) {
        return true;
    }
    #endif
    if (cell->x == 0 || cell->y == 0 || cell->x == WIDTH - 1 || cell->y == HEIGHT - 1) {
        if (cell->next == NULL) {
            return true;
        }
        if (cell->next->value == UNKNOWN) {
            set_cell_and_propagate(cell->next, OFF);
        } else if (cell->next->value == OFF) {
            return true;
        } else {
            return false;
        }
    }
    uint32_t tr = (cell->value << 10) | (cell->next->value << 8);
    #define add(cell) \
        if ((cell)->value == ON) { \
            tr += 16; \
        } else if ((cell)->value == OFF) { \
            tr += 1; \
        }
    add(cell->nw);
    add(cell->n);
    add(cell->ne);
    add(cell->w);
    add(cell->e);
    add(cell->sw);
    add(cell->s);
    add(cell->se);
    #undef add
    int8_t value = ot_implications[tr];
    DPRINTF4("Implication: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, tr, value);
    if (value == 0) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION, tr = %i, t = %i, x = %i, y = %i)\n", tr, cell->t, cell->x, cell->y);
        return false;
    }
    #define set(cell, value) \
        if (!set_cell_and_propagate((cell), (value))) { \
            return false; \
        }
    if (value & CURRENT_TO_0) {
        set(cell, OFF);
    } else if (value & CURRENT_TO_1) {
        set(cell, ON);
    }
    if (value & NEXT_TO_0) {
        set(cell->next, OFF);
    } else if (value & NEXT_TO_1) {
        set(cell->next, ON);
    }
    #define check(cell, new_value) \
        if ((cell)->value == UNKNOWN) { \
            set((cell), (new_value)); \
        }
    if (value & UNKNOWN_NEIGHBORS_TO_0) {
        check(cell->nw, OFF);
        check(cell->n, OFF);
        check(cell->ne, OFF);
        check(cell->w, OFF);
        check(cell->e, OFF);
        check(cell->sw, OFF);
        check(cell->s, OFF);
        check(cell->se, OFF);
    } else if (value & UNKNOWN_NEIGHBORS_TO_1) {
        check(cell->nw, ON);
        check(cell->n, ON);
        check(cell->ne, ON);
        check(cell->w, ON);
        check(cell->e, ON);
        check(cell->sw, ON);
        check(cell->s, ON);
        check(cell->se, ON);
    }
    #undef check
    #undef set
    return true;
}

// returns false if contradiction, true if no contradiction
static inline __attribute__((always_inline)) bool check_implication_for_preprocessing(cell* cell) {
    if (cell == NULL) {
        DPRINTF4("Contradiction (implication, cell == NULL)\n");
        return false;
    }
    uint32_t tr = (cell->value << 10) | (cell->next->value << 8);
    #define add(cell) \
        if ((cell) != NULL) { \
            if ((cell)->value == ON) { \
                tr += 16; \
            } else if ((cell)->value == OFF) { \
                tr += 1; \
            } \
        }
    add(cell->nw);
    add(cell->n);
    add(cell->ne);
    add(cell->w);
    add(cell->e);
    add(cell->sw);
    add(cell->s);
    add(cell->se);
    #undef add
    int8_t value = ot_implications[tr];
    DPRINTF4("Implication: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, tr, value);
    if (value == 0) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION, tr = %i, t = %i, x = %i, y = %i)\n", tr, cell->t, cell->x, cell->y);
        return false;
    }
    #define set(cell, value) \
        if (!set_cell_and_propagate((cell), (value))) { \
            return false; \
        }
    if (value & CURRENT_TO_0) {
        set(cell, OFF);
    } else if (value & CURRENT_TO_1) {
        set(cell, ON);
    }
    if (value & NEXT_TO_0) {
        set(cell->next, OFF);
    } else if (value & NEXT_TO_1) {
        set(cell->next, ON);
    }
    #define check(cell, new_value) \
        if ((cell) != nullptr && (cell)->value == UNKNOWN) { \
            set((cell), (new_value)); \
        }
    if (value & UNKNOWN_NEIGHBORS_TO_0) {
        check(cell->nw, OFF);
        check(cell->n, OFF);
        check(cell->ne, OFF);
        check(cell->w, OFF);
        check(cell->e, OFF);
        check(cell->sw, OFF);
        check(cell->s, OFF);
        check(cell->se, OFF);
    } else if (value & UNKNOWN_NEIGHBORS_TO_1) {
        check(cell->nw, ON);
        check(cell->n, ON);
        check(cell->ne, ON);
        check(cell->w, ON);
        check(cell->e, ON);
        check(cell->sw, ON);
        check(cell->s, ON);
        check(cell->se, ON);
    }
    #undef check
    #undef set
    return true;
}


#endif


static inline bool __attribute__((always_inline)) check_implications(cell* cell) {
    return check_implication((cell))
        && check_implication((cell)->prev)
        && check_implication((cell)->nw)
        && check_implication((cell)->n)
        && check_implication((cell)->ne)
        && check_implication((cell)->w)
        && check_implication((cell)->e)
        && check_implication((cell)->sw)
        && check_implication((cell)->s)
        && check_implication((cell)->se);
}


#if VARIABLES
cell_value_t prev_values[MAX_VAR_USES];
#endif

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static inline bool set_cell_and_propagate(cell* cell, cell_value_t value) {
    DPRINTF4("Setting cell and propagating: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    if (cell->value != UNKNOWN) {
        #if DEBUG >= 4
        if (cell->value != value) {
            DPRINTF4("Contradiction (previous value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
        } else {
            DPRINTF4("No action neccessary to set cell\n");
        }
        #endif
        return cell->value == value;
    }
    #if VARIABLES
    else if (cell->var == 0) {
        if (!set_cell(cell, value)) {
            return false;
        }
        DPRINTGRID4();
        return check_implications(cell);
    }
    var_t var = cell->var;
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, cell->t, cell->x, cell->y);
    DPRINTF4("Reading %i variable datas\n", num_var_uses[var]);
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
    DPRINTF4("Reading %i variable datas\n", num_var_uses[var]);
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        if (prev_values[use] == UNKNOWN) {
            if (!check_implications(cell)) {
                return false;
            }
        }
    }
    return true;
    #else
    if (!set_cell(cell, value)) {
        return false;
    }
    DPRINTGRID4();
    return check_implications(cell);
    #endif
}


#if MULTI_RULE

#include <stdlib.h>

int tr_to_bound_tr[512];

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
            fprintf(stderr, "Error: This error should not occur (nonexistent transition in init_tr_to_bound_tr: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
}

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < MAX_MAP_TRS_PER_BOUND_TR + 1; i++) {
        int tr2 = bound_trs[tr_to_bound_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        trs[tr2] = value == TRS_RULE_DEPENDENT ? TRS_RULE_DEPENDENT : (value == OFF ? 0 : 1);
        uint32_t tr3 = tr_to_implication_tr(tr2);
        if (value == TRS_RULE_DEPENDENT) {
            implications[tr3 | OFF] = IMPLICATION_RULE_DEPENDENT;
            implications[tr3 | ON] = IMPLICATION_RULE_DEPENDENT;
        } else {
            implications[tr3 | OFF] = value == OFF ? 0 : CONTRADICTION;
            implications[tr3 | ON] = value == ON ? 0 : CONTRADICTION;
        }

    }
}

#endif
