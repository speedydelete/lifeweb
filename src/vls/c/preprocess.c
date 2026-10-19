
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "base.c"
#include "implications.c"
#include "output.c"


[[noreturn]] static void pre_unsat(const char* func) {
    printf("Contradiction found in preprocessing (in step %s)\n", func + 4);
    debug(1, print_grid(stdout));
    exit(1);
}

bool pre_changes_made = false;

#define pre_start_step() do { debug(2, printf("Running step %s\n", __func__ + 4)); inc_debug_depth(); debug(2, print_grid(stdout)); } while (0)
#define pre_end_step() dec_debug_depth()


static void pre_alias_cell(Cell* cell, Cell* alias_to) {
    pre_changes_made = true;
    debug(2, printf("Aliasing variable %zu to %zu\n", cell->var_number, alias_to->var_number));
    for (size_t i = 0; i < state.total_size; i++) {
        if (state.grid[i] == cell) {
            state.grid[i] = alias_to;
        }
    }
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        #define check(pos) if (clause->pos == cell) { clause->pos = alias_to; }
        check(nw);
        check(n);
        check(ne);
        check(w);
        check(c);
        check(e);
        check(sw);
        check(s);
        check(se);
        check(next);
        #undef check
    }
    for (size_t i = cell->var_number; i <= state.var_count - 1; i++) {
        state.vars[i] = state.vars[i + 1];
        state.vars[i]->var_number--;
    }
    state.var_count--;
    safe_free(cell);
    // we need to reset the clauses too
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        if (!clause->removed) {
            init_clause_implication_tr(clause);
        }
    }
}

static void pre_set_cell(Cell* cell, CellValue value) {
    pre_changes_made = true;
    debug(2, printf("Setting variable %zu to %i\n", cell->var_number, value));
    pre_alias_cell(cell, value == OFF ? &off_cell : &on_cell);
}

static void pre_remove_known_cells(void) {
    pre_start_step();
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        if (cell->value != UNKNOWN) {
            pre_set_cell(cell, cell->value);
        }
    }
    pre_end_step();
}

static bool pre_internal_check_implications(Cell* cell, CellValue value) {
    debug(2, printf("Checking cell set implications for variable %zu = %i\n", cell->var_number, value));
    inc_debug_depth();
    push_stack_frame(&current_stack);
    bool out = set_cell_and_propagate(cell, value, true);
    pop_stack_frame(&current_stack);
    dec_debug_depth();
    return out;
}

static void pre_check_cell_implications(void) {
    pre_start_step();
    // go through each cell and try setting it to a value
    // if it's a contradiction, then it must be the OTHER value
    // so we can set it to that!
    // also put cell aliasing checks here
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        if (cell->value != UNKNOWN) {
            continue;
        }
        bool can_be_0 = pre_internal_check_implications(cell, OFF);
        bool can_be_1 = pre_internal_check_implications(cell, ON);
        debug(2, printf("Implications for variable %zu: can_be_0 = %i, can_be_1 = %i\n", cell->var_number, can_be_0, can_be_1));
        if (!can_be_0 && !can_be_1) {
            pre_unsat(__func__);
        } else if (!can_be_0 && can_be_1) {
            pre_changes_made = true;
            set_cell_and_propagate(cell, ON, true);
        } else if (can_be_0 && !can_be_1) {
            pre_changes_made = true;
            set_cell_and_propagate(cell, OFF, true);
        } else {
            // do nothing
        }
    }
    pre_end_step();
}

static void pre_alias_duplicate_cells(void) {
    pre_start_step();
    // so what this is gonna do is
    // if 2 variables have exactly the same arrangement of clauses
    // then alias them together
    pre_end_step();
}


static void pre_internal_remove_clause_in_cell(Cell* cell, Clause* clause) {
    pre_changes_made = true;
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #define check(pos) if (data->pos == clause) { data->pos = NULL; }
        check(nw);
        check(n);
        check(ne);
        check(w);
        check(c);
        check(e);
        check(sw);
        check(s);
        check(se);
        check(prev);
        #undef check
    }
}

static void pre_remove_clause(Clause* clause) {
    pre_changes_made = true;
    debug(2, printf("Removing clause %zu\n", clause->number));
    pre_internal_remove_clause_in_cell(clause->nw, clause);
    pre_internal_remove_clause_in_cell(clause->n, clause);
    pre_internal_remove_clause_in_cell(clause->ne, clause);
    pre_internal_remove_clause_in_cell(clause->w, clause);
    pre_internal_remove_clause_in_cell(clause->c, clause);
    pre_internal_remove_clause_in_cell(clause->e, clause);
    pre_internal_remove_clause_in_cell(clause->sw, clause);
    pre_internal_remove_clause_in_cell(clause->s, clause);
    pre_internal_remove_clause_in_cell(clause->se, clause);
    pre_internal_remove_clause_in_cell(clause->next, clause);
    clause->removed = true;
}

static void pre_remove_known_clauses(void) {
    pre_start_step();
    // removes all clauses that are fully made of known cells
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        if (!clause->removed && clause->nw->value != UNKNOWN && clause->n->value != UNKNOWN && clause->ne->value != UNKNOWN && clause->w->value != UNKNOWN && clause->c->value != UNKNOWN && clause->e->value != UNKNOWN && clause->sw->value != UNKNOWN && clause->s->value != UNKNOWN && clause->se->value != UNKNOWN && clause->next->value != UNKNOWN) {
            pre_remove_clause(clause);
        }
    }
    pre_end_step();
}

static void pre_check_unsat_clauses(void) {
    pre_start_step();

    // look for basic unsatisfiable clauses
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        uint64_t code = implication_table[clause->implication_tr];
        if (code == 1) {
            debug(2, printf("Implication for clause %zu: transition = %"PRIu32", code = %"PRIu64"\n", clause->number, clause->implication_tr, code));
            pre_unsat(__func__);
        }
    }
    pre_end_step();
}

static void pre_remove_duplicate_clauses(void) {
    pre_start_step();
    // looks for clauses that contain the same cells
    // in the same positions, or rotations/reflections
    // and merges them together
    // for (size_t i = 0; i < state.clause_count; i++) {
    //     Clause* x = &(state.clauses[i]);
    //     if (x->removed) {
    //         continue;
    //     }
    //     for (size_t j = 0; j < i; j++) {
    //         Clause* y = &(state.clauses[j]);
    //         if (y->removed) {
    //             continue;
    //         }
    //         if (false
    //             #define check_mapping(NW, N, NE, W, C, E, SW, S, SE) \x
    //                 (true \x
    //                     && x->nw == y->NW && x->invert_nw == y->invert_##NW \x
    //                     && x->n == y->N && x->invert_n == y->invert_##N \x
    //                     && x->ne == y->NE && x->invert_ne == y->invert_##NE \x
    //                     && x->w == y->W && x->invert_w == y->invert_##W \x
    //                     && x->c == y->C && x->invert_c == y->invert_##C \x
    //                     && x->e == y->E && x->invert_e == y->invert_##E \x
    //                     && x->sw == y->SW && x->invert_sw == y->invert_##SW \x
    //                     && x->s == y->S && x->invert_s == y->invert_##S \x
    //                     && x->se == y->SE && x->invert_se == y->invert_##SE \x
    //                     && x->next == y->next && x->invert_next == y->invert_next \x
    //                 ) \x
    //             // no transformation
    //             || check_mapping(nw, n, ne, w, c, e, sw, s, se)
    //             // flip horizontal
    //             || check_mapping(ne, n, nw, e, c, w, se, s, sw)
    //             // flip vertical
    //             || check_mapping(sw, s, se, w, c, e, nw, n, ne)
    //             // rotate right
    //             || check_mapping(ne, e, se, n, c, s, nw, w, sw)
    //             // rotate left
    //             || check_mapping(sw, w, nw, s, c, n, se, e, ne)
    //             // rotate 180
    //             || check_mapping(se, s, sw, e, c, w, ne, n, nw)
    //             // flip diagonal
    //             || check_mapping(nw, w, sw, n, c, s, ne, e, se)
    //             // flip anti diagonal
    //             || check_mapping(se, e, ne, s, c, n, sw, w, nw)
    //             #undef check_mapping
    //         ) {
    //             pre_remove_clause(y);
    //             break;
    //         }
    //     }
    // }
    pre_end_step();
}

static void pre_merge_similar_clauses(void) {
    pre_start_step();
    // looks for clauses that contain one cell off
    // from each other, or rotations/reflections
    // and merges them together
    pre_end_step();
}

static void pre_pack_cells(void) {
    pre_start_step();
    // look for cells where the clause pointers can be moved back in the uses list
    // and move them back, possibly also decrementing the use count if possible
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        #define check(pos) \
            for (size_t j = 0; j < cell->use_count; j++) { \
                if (cell->uses[j].pos == NULL) { \
                    for (size_t k = j + 1; k < cell->use_count; k++) { \
                        if (cell->uses[k].pos != NULL) { \
                            pre_changes_made = true; \
                            cell->uses[j].pos = cell->uses[k].pos; \
                            break; \
                        } \
                    } \
                } \
            }
        check(nw);
        check(n);
        check(ne);
        check(w);
        check(c);
        check(e);
        check(sw);
        check(s);
        check(se);
        check(prev);
        #undef check
        // see if we're able to decrement the use count
        size_t dec_by = 0;
        for (intmax_t j = cell->use_count - 1; j >= 0; j--) {
            CellUseData* data = &(cell->uses[j]);
            if (data->nw == NULL && data->n == NULL && data->ne == NULL && data->w == NULL && data->c == NULL && data->e == NULL && data->sw == NULL && data->s == NULL && data->se == NULL && data->prev == NULL) {
                dec_by++;
            } else {
                break;
            }
        }
        if (dec_by > 0) {
            pre_changes_made = true;
            cell->use_count -= dec_by;
        }
    }
    pre_end_step();
}


#define MAX_PREPROCESSING_ITERATIONS 4096

// returns whether it was solved in preprocessing
static bool preprocess(void) {
    debug(2,
        printf("Preprocessing\n");
        print_grid(stdout);
    );
    bool found = false;
    for (size_t i = 0; i < MAX_PREPROCESSING_ITERATIONS; i++) {
        debug(2, printf("Running preprocessing iteration %zu\n", i));
        inc_debug_depth();
        pre_changes_made = false;
        pre_remove_known_cells();
        pre_check_cell_implications();
        pre_alias_duplicate_cells();
        pre_remove_known_clauses();
        pre_check_unsat_clauses();
        pre_remove_duplicate_clauses();
        pre_merge_similar_clauses();
        pre_pack_cells();
        dec_debug_depth();
        if (!pre_changes_made) {
            found = true;
            break;
        }
    }
    if (!found) {
        unexpected_error("Preprocessing did not finish");
    }
    if (state.var_count == 0) {
        check_solution(true);
        return true;
    }
    state.start_unknown_vars -= state.set_unknown_vars;
    state.set_unknown_vars = 0;
    // move back the stack to use all that space
    current_stack.len = 0;
    printf("Preprocessing complete: %zu variables, %zu clauses\n", state.var_count, state.clause_count);
    return false;
}
