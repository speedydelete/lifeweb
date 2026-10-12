
// defines the core searching algorithm

#pragma once

#include <inttypes.h>

#include "base.c"
#ifdef CUSTOM
    #include CUSTOM
#endif


static bool internal_clause_set_cell(Cell* cell, CellValue value, bool is_explicit);


#if IMPLICATION_BACKEND == IMPLICATION_BACKEND_CPU_INDEPENDENT


static inline bool implicstate_set_bit(ImplicState state, int bit, int value) {
    if (value == 0) {
        state[bit >> 6] &= ~((uint64_t)1 << (bit & 63));
    } else {
        state[bit >> 6] |= ((uint64_t)1 << (bit & 63));
    }
}

static inline bool implicstate_is_contradiction(ImplicState state) {
    for (int i = 0; i < 16; i++) {
        if (state[i] != 0) {
            return false;
        }
    }
    return true;
}

static inline bool implicstate_satisfies_mask(ImplicState state, ImplicState mask) {
    ImplicState value;
    memcpy(value, state, sizeof(ImplicState));
    for (int i = 0; i < 16; i++) {
        value[i] &= mask[i];
    }
    for (int i = 0; i < 16; i++) {
        if (value[i] != 0) {
            return true;
        }
    }
    return false;
}

static inline bool implicstate_set_cell(ImplicState state, int pos, int value) {
    int k = 0;
    for (int i = 0; i < 16; i++) {
        for (int j = 0; j < 64; j++) {
            if ((k >> pos) != value) {
                state[i] &= ~((uint64_t)1 << j);
            }
            k++;
        }
    }
}

static inline bool implicstate_alias_cell(ImplicState state, int pos1, int pos2, bool invert) {
    int k = 0;
    for (int i = 0; i < 16; i++) {
        for (int j = 0; j < 64; j++) {
            if (((k >> pos1) != (k >> pos2)) == invert) {
                state[i] &= ~((uint64_t)1 << j);
            }
            k++;
        }
    }
}


#endif


// these return the implic state mask for where the cell
// at position pos in the 10-bit state is on or off
ImplicState IMPLICSTATE_CELL_ON_MASKS[10];
ImplicState IMPLICSTATE_CELL_OFF_MASKS[10];

// IMPLICSTATE_PAIR_SAME_MASKS[pos1][pos2] returns the implic state mask for
// where the cells at position pos1 and pos2 have the same value
// and IMPLICSTATE_PAIR_DIFFERENT_MASKS is the same thing but the cell values must be different
ImplicState IMPLICSTATE_PAIR_SAME_MASKS[10][10];
ImplicState IMPLICSTATE_PAIR_DIFFERENT_MASKS[10][10];

static void init_implicstate(void) {
    for (int pos = 0; pos < 10; pos++) {
        for (int i = 0; i < 1024; i++) {
            if ((i >> pos) & 1) {
                implicstate_set_bit(IMPLICSTATE_CELL_ON_MASKS[pos], i, 1);
            } else {
                implicstate_set_bit(IMPLICSTATE_CELL_OFF_MASKS[pos], i, 1);
            }
        }
    }
    for (int pos1 = 0; pos1 < 10; pos1++) {
        for (int pos2 = 0; pos2 < 10; pos2++) {
            for (int i = 0; i < 1024; i++) {
                if ((i >> pos1) == (i >> pos2)) {
                    implicstate_set_bit(IMPLICSTATE_PAIR_SAME_MASKS[pos1][pos2], i, 1);
                } else {
                    implicstate_set_bit(IMPLICSTATE_PAIR_DIFFERENT_MASKS[pos1][pos2], i, 1);
                }
            }
        }
    }
}

static inline bool check_one_cell_implications(CAClause* clause, int pos, Cell* cell) {
    ImplicState* initial_state = clause->state;
    bool can_be_0 = implicstate_satisfies_mask(clause->state, IMPLICSTATE_CELL_ON_MASKS[pos]);
}

static bool check_implications(CAClause* clause) {
    check_one_cell_implications(clause, 9, clause->nw);
    check_one_cell_implications(clause, 8, clause->w);
    check_one_cell_implications(clause, 7, clause->sw);
    check_one_cell_implications(clause, 6, clause->n);
    check_one_cell_implications(clause, 5, clause->center);
    check_one_cell_implications(clause, 4, clause->s);
    check_one_cell_implications(clause, 3, clause->ne);
    check_one_cell_implications(clause, 2, clause->e);
    check_one_cell_implications(clause, 1, clause->se);
    check_one_cell_implications(clause, 0, clause->next);
}


static void internal_update_clauses(Cell* cell, CellValue value) {
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
}

static bool set_cell(Cell* cell, CellValue value) {
    if (cell->alias) {
        if (cell->invert_alias) {
            if (value == OFF) {
                value = ON;
            } else if (value == ON) {
                value = OFF;
            }
        }
        set_cell(cell->alias, value);
    }
    if (cell->value != value) {
        internal_update_clauses(cell, value);
    }
    return true;
}

static bool alias(Cell* cell, Cell* alias_to, bool invert) {
    Cell* original_cell = cell;
    if (alias_to->alias) {
        invert = invert != alias_to->invert_alias;
        alias_to = alias_to->alias;
    }
    cell->alias = alias_to;
    if (cell->value != alias_to->value) {
        internal_update_clauses(cell);
    }
}

static uint32_t compute_implication_tr(CAClause* clause) {
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
CAClause** clause_stack;
// stack pointer for `clause_stack`
CAClause** clause_sp;
// stack pointer for the done entries of clause_stack
CAClause** clause_done_sp;

static void init_clause_stack(void) {
    clause_stack = safe_malloc(16384 * sizeof(CAClause*));
}

static void destroy_clause_stack(void) {
    safe_free(clause_stack);
}

static bool internal_clause_set_cell(Cell* cell, CellValue value, bool is_explicit) {
    // maybe make its own function and manually inline and optimize the set_cell_and_push?
    // could be faster? depends on how clever the compiler is
    if (!set_cell_and_push(cell, value, is_explicit)) {
        return false;
    }
    for (size_t i = 0; i < cell->use_count; i++) {
        CAClauseData* data = &(cell->uses[i]);
        #define add(clause) \
            if ((clause) != NULL) { \
                *clause_sp = (clause); \
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

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(Cell* cell, CellValue value, bool is_explicit) {
    DPRINTF3("Setting cell and propagating: var_number = %zu\n", cell->var_number);
    clause_sp = &(clause_stack[0]);
    clause_done_sp = &(clause_stack[0]);
    if (!internal_clause_set_cell(cell, value, is_explicit)) {
        return false;
    }
    DPRINTF3("Propagating: clause_sp = %ti, clause_done_sp = %ti\n", clause_sp - &(clause_stack[0]), clause_done_sp - &(clause_stack[0]));
    while (clause_done_sp < clause_sp) {
        if (!check_implications(*clause_done_sp)) {
            return false;
        }
        clause_done_sp++;
        DPRINTF3("Propagating: clause_sp = %ti, clause_done_sp = %ti\n", clause_sp - &(clause_stack[0]), clause_done_sp - &(clause_stack[0]));
    }
    return true;
}
