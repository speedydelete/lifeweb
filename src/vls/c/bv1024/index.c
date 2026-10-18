
#pragma once

#include <inttypes.h>

#include "../base.c"
#include "uint64_t.c" // IWYU pragma: keep
#include "avx2.c" // IWYU pragma: keep


[[maybe_unused]] static void print_bv1024(BitVec1024 state) {
    printf("BitVec1024:\n");
    int k = 0;
    for (int i = 0; i < 16; i++) {
        print_line_padding();
        for (int j = 0; j < 64; j++) {
            real_printf("%i", bv1024_get_bit(state, k));
            k++;
        }
        real_printf("\n");
    }
}

static void init_bv1024(void) {
    for (int i = 0; i < 512; i++) {
        if (state.trs[i]) {
            bv1024_set_bit(full_implic_state, i << 1, 0);
            bv1024_set_bit(full_implic_state, (i << 1) | 1, 1);
        } else {
            bv1024_set_bit(full_implic_state, i << 1, 1);
            bv1024_set_bit(full_implic_state, (i << 1) | 1, 0);
        }
    }
    #if DEBUG >= 2
        print_bv1024(full_implic_state);
    #endif
    for (int pos = 0; pos < 10; pos++) {
        for (int i = 0; i < 1024; i++) {
            bv1024_set_bit(IMPLICSTATE_CELL_MASKS[(i >> pos) & 1][pos], i, 1);
        }
    }
    for (int pos1 = 0; pos1 < 10; pos1++) {
        for (int pos2 = 0; pos2 < 10; pos2++) {
            for (int i = 0; i < 1024; i++) {
                if ((i >> pos1) == (i >> pos2)) {
                    bv1024_set_bit(IMPLICSTATE_PAIR_SAME_MASKS[pos1][pos2], i, 1);
                } else {
                    bv1024_set_bit(IMPLICSTATE_PAIR_DIFFERENT_MASKS[pos1][pos2], i, 1);
                }
            }
        }
    }
}

static bool check_implications(CAClause* clause) {
    return check_single_cell_implications(clause, 9, clause->nw)
        && check_single_cell_implications(clause, 8, clause->w)
        && check_single_cell_implications(clause, 7, clause->sw)
        && check_single_cell_implications(clause, 6, clause->n)
        && check_single_cell_implications(clause, 5, clause->c)
        && check_single_cell_implications(clause, 4, clause->s)
        && check_single_cell_implications(clause, 3, clause->ne)
        && check_single_cell_implications(clause, 2, clause->e)
        && check_single_cell_implications(clause, 1, clause->se)
        && check_single_cell_implications(clause, 0, clause->next)
    ;
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
        CellUseData* data = &(cell->uses[i]);
        #define add(clause) \
            if ((clause) != NULL) { \
                *clause_sp = (clause); \
                clause_sp++; \
            }
        add(data->c);
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
    debug_printf_3("Setting cell and propagating: var_number = %zu\n", cell->var_number);
    clause_sp = &(clause_stack[0]);
    clause_done_sp = &(clause_stack[0]);
    if (!internal_clause_set_cell(cell, value, is_explicit)) {
        return false;
    }
    while (clause_done_sp < clause_sp) {
        debug_printf_3("Propagating: clause_sp = %ti, clause_done_sp = %ti\n", clause_sp - &(clause_stack[0]), clause_done_sp - &(clause_stack[0]));
        debug_print_grid_5();
        if (!check_implications(*clause_done_sp)) {
            return false;
        }
        clause_done_sp++;
    }
    return true;
}
