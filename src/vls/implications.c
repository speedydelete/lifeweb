
// defines the core searching algorithm

#pragma once

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#ifdef CUSTOM
    #include CUSTOM
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
// or what unknown cells we can alias to each other

// transition format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 67 cd
// 23 89 ef -> ij
// 45 ab gh

// output format for `implication_table`: 0b_012_345_678_9ab_cde_fgh_ijk_lmn_opq_rst_uv
// if uv = 0, it's a normal implication:
    // 012 9ab ijk
    // 345 cde lmn -> rst
    // 678 fgh opq
    // each 3-bit value represents something to do with the corresponding cell
    // alias groups: the variables are aliased with each other, or with their NOTs
    // 0 - do nothing, for all known cells this must be the value
    // 1 - must be off
    // 2 - must be on
    // 3 - undefined behavior
    // 4 - alias group 0
    // 5 - NOT alias group 0
    // 6 - alias group 1
    // 7 - NOT alias group 1
// if uv = 1, it's a contradiction
// if uv = 2, it's to be looked up in `big_implication_table`

uint32_t* implication_table;

// big implication table
// does the same thing but supports more than 2 alias groups
// we only need 5 alias groups to have all combinations, because there are only 10 cells
// not always used
// output format is a series of 10 4-bit values and then a 2-bit value
// the 2-bit value: 0 = normal, 1 = contradiction
// the 4-bit values correspond to cells in the same way as in `implication_table`
// 1 - must be off
// 2 - must be on
// 3 - undefined behavior
// 4 - alias group 0
// 5 - NOT alias group 0
// 6 - alias group 1
// 7 - NOT alias group 1
// 8 - alias group 2
// 9 - NOT alias group 2
// 10 - alias group 3
// 11 - NOT alias group 3
// 12 - alias group 4
// 13 - NOT alias group 4

uint64_t* big_implication_table;

#define DO_NOTHING 0
#define CONTRADICTION 1
#define USE_BIG_IMPLICATION_TABLE 2

static inline uint32_t tr_to_implication_tr(int16_t tr) {
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

// ALIASING NEEDS TO BE IMPLEMENTED HERE
// IT IS NOT YET IMPLEMENTED!!!!

static inline uint32_t get_implication(uint32_t tr) {
    CellValue next = tr & 3;
    IMPLICATIONDPRINTF(tr, "tr = %i, next = %i\n", tr, next);
    int32_t out = DO_NOTHING;
    // find the value for the next generation
    if (next == UNKNOWN) {
        uint32_t forward_0 = implication_table[(tr & ~3) | OFF];
        uint32_t forward_1 = implication_table[(tr & ~3) | ON];
        bool zero_possible = forward_0 != CONTRADICTION;
        bool one_possible = forward_1 != CONTRADICTION;
        IMPLICATIONDPRINTF(tr, "checking next, (zero: %i -> %i -> %s, one: %i -> %i -> %s\n", (tr & ~3) | OFF, forward_0, zero_possible ? "true" : "false", (tr & ~3) | ON, forward_1, one_possible ? "true" : "false");
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
        uint32_t forward_0 = implication_table[tr2 | (OFF << i)];
        uint32_t forward_1 = implication_table[tr2 | (ON << i)];
        bool zero_possible = (forward_0 != CONTRADICTION) && ((forward_0 & 3) == next || (forward_0 & 3) == UNKNOWN || (forward_0 & 3) == DONT_CARE);
        bool one_possible = (forward_1 != CONTRADICTION) && ((forward_1 & 3) == next || (forward_1 & 3) == UNKNOWN || (forward_1 & 3) == DONT_CARE);
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

static inline void init_implications(void) {
    implication_table = safe_malloc(sizeof(uint32_t) * 1048576);
    // fill in the values with 0 unknown cells
    for (uint16_t tr = 0; tr < 512; tr++) {
        CellValue value = state.trs[tr] ? ON : OFF;
        uint32_t tr2 = tr_to_implication_tr(tr);
        implication_table[tr2 | OFF] = value == OFF ? DO_NOTHING : CONTRADICTION;
        implication_table[tr2 | ON] = value == ON ? DO_NOTHING : CONTRADICTION;
        IMPLICATIONDPRINTF(tr2 | OFF, "tr = %i, value = %i, result = %i\n", tr2 | OFF, value, implication_table[tr2 | OFF]);
        IMPLICATIONDPRINTF(tr2 | ON, "tr = %i, value = %i, result = %i\n", tr2 | ON, value, implication_table[tr2 | ON]);
    }
    // fill in the rest
    for (int unknown = 1; unknown < 8; unknown++) {
        for (uint32_t tr = 0; tr < 1048576; tr++) {
            int tr_unknown = 0;
            bool found = false;
            for (int i = 0; i < 20; i += 2) {
                CellValue part = (tr >> i) & 3;
                if (part == UNKNOWN) {
                    tr_unknown++;
                    if (tr_unknown > unknown) {
                        break;
                    }
                }
            }
            IMPLICATIONDPRINTF(tr, "tr_unknown = %i, found = %s\n", tr_unknown, found ? "true" : "false");
            if (found) {
                implication_table[tr] = CONTRADICTION;
            } else if (tr_unknown != unknown) {
                continue;
            }
            implication_table[tr] = get_implication(tr);
        }
    }
}

static inline void destroy_implications(void) {
    safe_free(implication_table);
}


static bool set_cell_and_propagate(Cell* cell, CellValue value, bool is_explicit);


static inline bool set_cell(Cell* cell, CellValue value) {
    cell->value = value;
    for (size_t i = 0; i < cell->use_count; i++) {
        CAClauseData* data = &(cell->uses[i]);
        #define add(clause, shift) \
            if ((clause) != NULL) { \
                (clause)->tr = ((clause)->tr & ~(3 << (shift))) | (value << (shift)); \
            }
        add(data->center, 10);
        add(data->prev, 0);
        add(data->nw, 2);
        add(data->w, 4);
        add(data->sw, 6);
        add(data->n, 8);
        add(data->s, 12);
        add(data->ne, 14);
        add(data->e, 16);
        add(data->se, 18);
        #undef add
    }
    return true;
}

static inline uint32_t compute_implication_tr(CAClause* clause) {
    uint32_t tr = 
            (clause->nw->value << 18)
          | (clause->w->value << 16)
          | (clause->sw->value << 14)
          | (clause->n->value << 12)
          | (clause->center->value << 10)
          | (clause->s->value << 8)
          | (clause->ne->value << 6)
          | (clause->e->value << 4)
          | (clause->se->value << 2)
          | (clause->next->value << 0);
    return tr;
}


// stack of clauses to check in set_cell_and_propagate
CAClause* clause_stack[16384];
// stack pointer for `clause_stack`
CAClause* clause_sp;
// stack pointer for the done entries of clause_stack
CAClause* clause_done_sp;

static inline bool internal_clause_set_cell(Cell* cell, CellValue value, bool is_explicit) {
    // maybe make its own function and manually inline and optimize the set_cell_and_push?
    // could be faster? depends on how clever the compiler is
    if (!set_cell_and_push(cell, value, is_explicit)) {
        return false;
    }
    for (size_t i = 0; i < cell->use_count; i++) {
        CAClauseData* data = &(cell->uses[i]);
        #define add(clause) \
            if ((clause) != NULL) { \
                *clause_sp = *(clause); \
                clause_sp++; \
            }
        add(data->center);
        add(data->prev);
        add(data->nw);
        add(data->w);
        add(data->sw);
        add(data->n);
        add(data->s);
        add(data->ne);
        add(data->e);
        add(data->se);
        #undef add
    }
    return true;
}

// returns false if contradiction, true if no contradiction
static inline bool check_implication(CAClause* clause) {
    uint32_t value = implication_table[clause->tr];
    DPRINTF4("Implication: tr = %i, value = %"PRIu32"\n", clause->tr, value);
    if (value == DO_NOTHING) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION)");
        return false;
    }
    #define check(cell, place) \
        if (value & (3 << (place))) { \
            if (!internal_clause_set_cell((cell), ((value >> (place)) & 3), false)) { \
                return false; \
            } \
        }
    check(clause->center, 10);
    check(clause->next, 0);
    if ((value & 0b11111111001111111100) == 0) {
        return true;
    }
    check(clause->se, 2);
    check(clause->e, 4);
    check(clause->ne, 6);
    check(clause->s, 8);
    check(clause->n, 12);
    check(clause->sw, 14);
    check(clause->w, 16);
    check(clause->nw, 18);
    #undef check
    return true;
}

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static inline bool set_cell_and_propagate(Cell* cell, CellValue value, bool is_explicit) {
    clause_sp = clause_stack[0];
    clause_done_sp = clause_stack[0];
    if (!internal_clause_set_cell(cell, value, is_explicit)) {
        return false;
    }
    while (clause_done_sp < clause_sp) {
        if (!check_implication(clause_done_sp)) {
            return false;
        }
        clause_done_sp++;
    }
    return true;
}
