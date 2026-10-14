
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "base.c"
#include "dynamic_grid.c"
#include "implications.c"
#include "output.c"


static __attribute__((noreturn)) void pre_unsat(const char* func) {
    printf("Contradiction found in preprocessing (in step %s)\n", func + 4);
    debug_print_grid_1();
    exit(1);
}

bool pre_changes_made = false;

static void pre_set_cell(const char* func, Cell* cell, CellValue value) {
    pre_changes_made = true;
    if (!set_cell(cell, value)) {
        pre_unsat(func);
    }
}

static void pre_internal_replace_clause_in_cell(Cell* cell, CAClause* old_clause, CAClause* new_clause) {
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #define check(pos) if (data->pos == old_clause) { data->pos = new_clause; }
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

static void pre_alias_clause(CAClause* clause, CAClause* new_clause) {
    if (new_clause == NULL) {
        debug_printf_2("Removing clause %zu\n", clause->number);
    } else {
        debug_printf_2("Aliasing clause %zu to %zu\n", clause->number, new_clause->number);
    }
    pre_changes_made = true;
    pre_internal_replace_clause_in_cell(clause->nw, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->n, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->ne, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->w, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->c, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->e, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->sw, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->s, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->se, clause, new_clause);
    pre_internal_replace_clause_in_cell(clause->next, clause, new_clause);
    for (size_t i = clause->number; i < state.ca_clause_count - 1; i++) {
        state.ca_clauses[i] = state.ca_clauses[i + 1];
        state.ca_clauses[i]->number--;
    }
    state.ca_clause_count--;
    safe_free(clause);
}

static void pre_remove_clause(CAClause* clause) {
    pre_alias_clause(clause, NULL);
}

static void pre_alias_cell(Cell* cell, Cell* alias_to, bool invert) {
    debug_printf_2("Aliasing variable %zu to %zu\n", cell->var_number, alias_to->var_number);
    for (size_t i = 0; i < state.total_size; i++) {
        GridCell* grid_cell = &(state.grid[i]);
        if (grid_cell->cell == cell) {
            grid_cell->cell = alias_to;
            grid_cell->invert = grid_cell->invert != invert;
        }
    }
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        CAClause* clause = state.ca_clauses[i];
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
    for (size_t i = cell->var_number; i < state.var_count - 1; i++) {
        state.vars[i] = state.vars[i + 1];
        state.vars[i]->var_number--;
    }
    state.var_count--;
    safe_free(cell);
}


static void pre_check_unsat_clauses(void) {
    // look for basic unsatisfiable clauses
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        if (implicstate_is_contradiction(state.ca_clauses[i]->state)) {
            pre_unsat(__func__);
        }
    }
}

static void pre_remove_known_clauses(void) {
    // removes all clauses that are fully made of known cells
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        CAClause* clause = state.ca_clauses[i];
        if (clause->nw->value != UNKNOWN && clause->n->value != UNKNOWN && clause->ne->value != UNKNOWN && clause->w->value != UNKNOWN && clause->c->value != UNKNOWN && clause->e->value != UNKNOWN && clause->sw->value != UNKNOWN && clause->s->value != UNKNOWN && clause->se->value != UNKNOWN && clause->next->value != UNKNOWN) {
            pre_remove_clause(clause);
            // subtract 1 here because pre_alias_clause remapping
            i--;
        }
    }
}

static bool pre_internal_check_implications(Cell* cell, CellValue value) {
    push_stack_frame(current_stack);
    bool out = set_cell_and_propagate(cell, value, true);
    pop_stack_frame(current_stack);
    return out;
}

static void pre_check_cell_implications(void) {
    // go through each cell and try setting it to a value
    // if it's a contradiction, then it must be the OTHER value
    // so we can set it to that!
    // also when runtime aliasing is implemented cell aliasing checks should go here
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        if (cell->value != UNKNOWN) {
            continue;
        }
        bool can_be_0 = pre_internal_check_implications(cell, OFF);
        bool can_be_1 = pre_internal_check_implications(cell, ON);
        debug_printf_2("Checking cell implications for variable %zu: can_be_0 = %i, can_be_1 = %i\n", cell->var_number, can_be_0, can_be_1);
        if (!can_be_0 && !can_be_1) {
            pre_unsat(__func__);
        } else if (!can_be_0 && can_be_1) {
            pre_changes_made = true;
            if (!set_cell_and_propagate(cell, ON, true)) {
                unexpected_error("Stack inconsistency detected in pre_check_cell_implications");
            }
        } else if (can_be_0 && !can_be_1) {
            pre_changes_made = true;
            if (!set_cell_and_propagate(cell, OFF, true)) {
                unexpected_error("Stack inconsistency detected in pre_check_cell_implications");
            }
        } else {
            // do nothing
        }
    }
}

static void pre_check_unsat_duplicate_clauses(void) {
    // look for a clause and its negation occuring
    // is the same as the next function but with the invert_next comparison changed in the check_mapping() macro
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        CAClause* x = state.ca_clauses[i];
        for (size_t j = 0; j < i; j++) {
            CAClause* y = state.ca_clauses[j];
            if (false
                #define check_mapping(NW, N, NE, W, C, E, SW, S, SE) \
                    (true \
                        && x->nw == y->NW && x->invert_nw == y->invert_##NW \
                        && x->n == y->N && x->invert_n == y->invert_##N \
                        && x->ne == y->NE && x->invert_ne == y->invert_##NE \
                        && x->w == y->W && x->invert_w == y->invert_##W \
                        && x->c == y->C && x->invert_c == y->invert_##C \
                        && x->e == y->E && x->invert_e == y->invert_##E \
                        && x->sw == y->SW && x->invert_sw == y->invert_##SW \
                        && x->s == y->S && x->invert_s == y->invert_##S \
                        && x->se == y->SE && x->invert_se == y->invert_##SE \
                        && x->next == y->next && x->invert_next != y->invert_next \
                    ) \
                // no transformation
                || check_mapping(nw, n, ne, w, c, e, sw, s, se)
                // flip horizontal
                || check_mapping(ne, n, nw, e, c, w, se, s, sw)
                // flip vertical
                || check_mapping(sw, s, se, w, c, e, nw, n, ne)
                // rotate right
                || check_mapping(ne, e, se, n, c, s, nw, w, sw)
                // rotate left
                || check_mapping(sw, w, nw, s, c, n, se, e, ne)
                // rotate 180
                || check_mapping(se, s, sw, e, c, w, ne, n, nw)
                // flip diagonal
                || check_mapping(nw, w, sw, n, c, s, ne, e, se)
                // flip anti diagonal
                || check_mapping(se, e, ne, s, c, n, sw, w, nw)
                #undef check_mapping
            ) {
                pre_unsat(__func__);
            }
        }
    }
}

static void pre_alias_duplicate_clauses(void) {
    // looks for clauses that contain the same cells
    // in the same positions, or rotations/reflections
    // and merges them together
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        CAClause* x = state.ca_clauses[i];
        for (size_t j = 0; j < i; j++) {
            CAClause* y = state.ca_clauses[j];
            if (false
                #define check_mapping(NW, N, NE, W, C, E, SW, S, SE) \
                    (true \
                        && x->nw == y->NW && x->invert_nw == y->invert_##NW \
                        && x->n == y->N && x->invert_n == y->invert_##N \
                        && x->ne == y->NE && x->invert_ne == y->invert_##NE \
                        && x->w == y->W && x->invert_w == y->invert_##W \
                        && x->c == y->C && x->invert_c == y->invert_##C \
                        && x->e == y->E && x->invert_e == y->invert_##E \
                        && x->sw == y->SW && x->invert_sw == y->invert_##SW \
                        && x->s == y->S && x->invert_s == y->invert_##S \
                        && x->se == y->SE && x->invert_se == y->invert_##SE \
                        && x->next == y->next && x->invert_next == y->invert_next \
                    ) \
                // no transformation
                || check_mapping(nw, n, ne, w, c, e, sw, s, se)
                // flip horizontal
                || check_mapping(ne, n, nw, e, c, w, se, s, sw)
                // flip vertical
                || check_mapping(sw, s, se, w, c, e, nw, n, ne)
                // rotate right
                || check_mapping(ne, e, se, n, c, s, nw, w, sw)
                // rotate left
                || check_mapping(sw, w, nw, s, c, n, se, e, ne)
                // rotate 180
                || check_mapping(se, s, sw, e, c, w, ne, n, nw)
                // flip diagonal
                || check_mapping(nw, w, sw, n, c, s, ne, e, se)
                // flip anti diagonal
                || check_mapping(se, e, ne, s, c, n, sw, w, nw)
                #undef check_mapping
            ) {
                pre_alias_clause(x, y);
                // subtract 1 here because pre_alias_clause remapping
                i--;
                break;
            }
        }
    }
}

static void pre_alias_duplicate_cells(void) {
    // so what this is gonna do is
    // if 2 variables have exactly the same arrangement of clauses
    // then alias them together
    // also it should look for inverted aliases too, not sure how that should work
}

static void pre_pack_cells(void) {
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
        // remove the cell if possible
        // this really should not be possible to occur but i'm checking for it anyway
        if (cell->use_count == 0) {
            state.var_count--;
            for (size_t i = cell->var_number; i < state.var_count; i++) {
                Cell* value = state.vars[i + 1];
                value->var_number--;
                state.vars[i] = value;
            }
            // subtract 1 from i because we decremented state.var_count and removed the cell
            // so now we don't skip the cell immediately after this one
            i--;
        }
    }
}


#define MAX_PREPROCESSING_ITERATIONS 4096

static void preprocess(void) {
    debug_printf_1("Preprocessing\n");
    debug_print_grid_2();
    bool found = false;
    for (size_t i = 0; i < MAX_PREPROCESSING_ITERATIONS; i++) {
        pre_changes_made = false;
        pre_check_unsat_clauses();
        pre_remove_known_clauses();
        pre_check_cell_implications();
        pre_check_unsat_duplicate_clauses();
        pre_alias_duplicate_clauses();
        pre_alias_duplicate_cells();
        pre_pack_cells();
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
        return;
    }
    printf("Preprocessing complete: %zu variables, %zu clauses\n", state.var_count, state.ca_clause_count);
}
