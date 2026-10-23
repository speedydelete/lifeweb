
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "base.c"
#include "implications.c"
#include "output.c"
#include "params2.h"


[[noreturn]] static void pre_contradiction(const char* func) {
    printf("Contradiction found in preprocessing (in step %s)\n", func + 4);
    debug(1, print_grid(stdout));
    exit(EXIT_SUCCESS);
}

bool pre_changes_made = false;

#define pre_start_step() do { debug(2, printf("Running step %s\n", __func__ + 4)); inc_debug_depth(); debug(2, print_grid(stdout)); } while (0)
#define pre_end_step() dec_debug_depth()


static void pre_set_cell(const char* called_from, Cell* cell, CellValue value) {
    debug(2, printf("Setting variable %zu to %i\n", cell->var_number, value));
    Cell* set_to = value == OFF ? &off_cell : &on_cell;
    if (cell->value != UNKNOWN) {
        if (cell->value != value) {
            pre_contradiction(called_from);
        }
    }
    pre_changes_made = true;
    for (size_t i = 0; i < state.total_size; i++) {
        if (state.grid[i] == cell) {
            state.grid[i] = set_to;
        }
    }
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        if (clause->removed) {
            continue;
        }
        for (int i = 0; i < MAX_IMPLIC_FUNC_LENGTH; i++) {
            if (clause->cells[i] == cell) {
                clause->cells[i] = set_to;
            }
        }
        init_clause_implication_tr(clause);
    }
    for (size_t i = cell->var_number; i <= state.var_count - 1; i++) {
        state.vars[i] = state.vars[i + 1];
        state.vars[i]->var_number--;
    }
    state.var_count--;
    safe_free(cell);
}

static void pre_alias_cell(const char* called_from, Cell* cell, Cell* alias_to) {
    debug(2, printf("Aliasing variable %zu to %zu\n", cell->var_number, alias_to->var_number));
    if (cell->value != UNKNOWN) {
        if (alias_to->value != UNKNOWN) {
            if (cell->value != alias_to->value) {
                pre_contradiction(called_from);
            }
            return;
        } else {
            pre_set_cell(called_from, alias_to, cell->value);
            return;
        }
    } else if (alias_to->value != UNKNOWN) {
        pre_set_cell(called_from, cell, alias_to->value);
        return;
    }
    pre_changes_made = true;
    // this isn't required but it keeps variable numbers down
    if (cell->var_number > alias_to->var_number) {
        Cell* temp = cell;
        cell = alias_to;
        alias_to = temp;
    }
    Cell* new = safe_malloc(sizeof(Cell) + (cell->use_count + alias_to->use_count) * sizeof(CellUseData));
    new->value = UNKNOWN;
    new->var_number = cell->var_number;
    new->use_count = cell->use_count + alias_to->use_count;
    memcpy(new->uses, &(cell->uses), cell->use_count * sizeof(CellUseData));
    memcpy(new->uses + cell->use_count, &(alias_to->uses), alias_to->use_count * sizeof(CellUseData));
    for (size_t i = 0; i < state.total_size; i++) {
        if (state.grid[i] == cell || state.grid[i] == alias_to) {
            state.grid[i] = new;
        }
    }
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        if (clause->removed) {
            continue;
        }
        for (int i = 0; i < MAX_IMPLIC_FUNC_LENGTH; i++) {
            if (clause->cells[i] == cell) {
                clause->cells[i] = alias_to;
            }
        }
        init_clause_implication_tr(clause);
    }
    state.vars[cell->var_number] = new;
    safe_free(cell);
    for (size_t i = alias_to->var_number; i <= state.var_count - 1; i++) {
        state.vars[i] = state.vars[i + 1];
        state.vars[i]->var_number--;
    }
    state.var_count--;
    safe_free(alias_to);
}

typedef struct PreClause {
    Cell* next;
    Cell* se;
    Cell* e;
    Cell* ne;
    Cell* s;
    Cell* c;
    Cell* n;
    Cell* sw;
    Cell* w;
    Cell* nw;
} PreClause;

static void pre_create_pre_clause(PreClause* out, const Clause* clause) {
    out->next = clause->cells[0];
    out->se = clause->cells[1];
    out->e = clause->cells[2];
    out->ne = clause->cells[3];
    out->s = clause->cells[4];
    out->c = clause->cells[5];
    out->n = clause->cells[6];
    out->sw = clause->cells[7];
    out->w = clause->cells[8];
    out->nw = clause->cells[9];
}

static bool pre_clause_eq(const PreClause* x, const PreClause* y) {
    return true
        && x->nw == y->nw
        && x->n == y->n
        && x->ne == y->ne
        && x->w == y->w
        && x->c == y->c
        && x->e == y->e
        && x->sw == y->sw
        && x->s == y->s
        && x->se == y->se
        && x->next == y->next
    ;
}

static bool pre_clause_eq_except_for_next(const PreClause* x, const PreClause* y) {
    return true
        && x->nw == y->nw
        && x->n == y->n
        && x->ne == y->ne
        && x->w == y->w
        && x->c == y->c
        && x->e == y->e
        && x->sw == y->sw
        && x->s == y->s
        && x->se == y->se
        && x->next != y->next
    ;
}

#define pre_create_clause_transformer(name, map_nw, map_n, map_ne, map_w, map_c, map_e, map_sw, map_s, map_se, map_next) \
    static void pre_clause_##name(PreClause* out, PreClause* value) { \
        out->map_nw = value->nw; \
        out->map_n = value->n; \
        out->map_ne = value->ne; \
        out->map_w = value->w; \
        out->map_c = value->c; \
        out->map_e = value->e; \
        out->map_sw = value->sw; \
        out->map_s = value->s; \
        out->map_se = value->se; \
        out->map_next = value->next; \
    }
pre_create_clause_transformer(copy, nw, n, ne, w, c, e, sw, s, se, next)
pre_create_clause_transformer(flip_horizontal, ne, n, nw, e, c, w, se, s, sw, next)
pre_create_clause_transformer(flip_vertical, sw, s, se, w, c, e, nw, n, ne, next)
pre_create_clause_transformer(rotate_left, sw, w, nw, s, c, n, se, e, ne, next)
pre_create_clause_transformer(rotate_right, ne, e, se, n, c, s, nw, w, sw, next)
pre_create_clause_transformer(rotate_180, se, s, sw, e, c, w, ne, n, nw, next)
pre_create_clause_transformer(flip_diagonal, nw, w, sw, n, c, s, ne, e, se, next)
pre_create_clause_transformer(flip_anti_diagonal, se, e, ne, s, c, n, sw, w, nw, next)
#undef pre_create_clause_transformer

static void pre_remove_clause(Clause* clause) {
    pre_changes_made = true;
    debug(2, printf("Removing clause %zu\n", clause->number));
    for (int i = 0; i < MAX_IMPLIC_FUNC_LENGTH; i++) {
        Cell* cell = clause->cells[i];
        for (size_t i = 0; i < cell->use_count; i++) {
            CellUseData* data = &(cell->uses[i]);
            for (int i = 0; i < MAX_IMPLIC_FUNC_LENGTH; i++) {
                if (clause->cells[i] == cell) {
                    clause->cells[i] = NULL;
                }
            }
        }
    }
    clause->removed = true;
}


static void pre_normalize_cells(void) {
    pre_start_step();
    // runs several normalization steps
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        // if the cell has a known value then set it to the corresponding static cell
        if (cell->value != UNKNOWN) {
            pre_set_cell(__func__, cell, cell->value);
            continue;
        }
        // check if the clause pointers can be moved back in the uses list
        // and move them back, possibly also decrementing the use count if possible
        for (int pos = 0; pos < MAX_IMPLIC_FUNC_LENGTH; pos++) {
            for (size_t j = 0; j < cell->use_count; j++) {
                if (cell->uses[j][pos] == NULL) {
                    for (size_t k = j + 1; k < cell->use_count; k++) {
                        if (cell->uses[k][pos] != NULL) {
                            pre_changes_made = true;
                            cell->uses[j][pos] = cell->uses[k][pos];
                            cell->uses[k][pos] = NULL;
                            break; \
                        } \
                    } \
                } \
            }
        }
        // see if we're able to decrement the use count
        size_t dec_by = 0;
        for (intmax_t j = cell->use_count - 1; j >= 0; j--) {
            CellUseData* data = &(cell->uses[j]);
            bool found = false;
            for (int pos = 0; pos < MAX_IMPLIC_FUNC_LENGTH; pos++) {
                if (data[pos] != NULL) {
                    found = true;
                    break;
                }
            }
            if (!found) {
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

// todo: custom set_cell_and_propagate here that also looks for aliasing???

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
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        if (cell->value != UNKNOWN) {
            continue;
        }
        bool can_be_0 = pre_internal_check_implications(cell, OFF);
        bool can_be_1 = pre_internal_check_implications(cell, ON);
        debug(2, printf("Implications for variable %zu: can_be_0 = %i, can_be_1 = %i\n", cell->var_number, can_be_0, can_be_1));
        if (!can_be_0 && !can_be_1) {
            pre_contradiction(__func__);
        } else if (!can_be_0 && can_be_1) {
            pre_changes_made = true;
            set_cell_and_propagate(cell, ON, true);
            // reset the stack length to fix dangling pointers caused by pre_set_cell and save space
            current_stack.len = 0;
            debug(3, print_grid(stdout));
        } else if (can_be_0 && !can_be_1) {
            pre_changes_made = true;
            set_cell_and_propagate(cell, OFF, true);
            // reset the stack length to fix dangling pointers caused by pre_set_cell and save space
            current_stack.len = 0;
            debug(3, print_grid(stdout));
        } else {
            // do nothing
        }
    }
    pre_end_step();
}


static void pre_normalize_clauses(void) {
    pre_start_step();
    // so what this is gonna do is
    // reorder the cells inside clauses to keep the implication trs
    // closer to 0
    pre_end_step();
}

static void pre_remove_known_clauses(void) {
    pre_start_step();
    // removes all clauses that are fully made of known cells
    for (size_t i = 0; i < state.clause_count; i++) {
        Clause* clause = &(state.clauses[i]);
        if (clause->removed) {
            continue;
        }
        bool found = false;
        for (int i = 0; i < MAX_IMPLIC_FUNC_LENGTH; i++) {
            if (clause->cells[i] != NULL && clause->cells[i]->value != UNKNOWN) {
                found = true;
                break;
            }
        }
        if (!found) {
            pre_remove_clause(clause);
        }
    }
    pre_end_step();
}

static void pre_merge_duplicate_or_similar_clauses(void) {
    pre_start_step();
    // looks for clauses that are exactly the same and merges them
    // also looks for clauses where they are the same except for the next value
    // which means that the next cells can be aliased together!
    // when this happens the next pass will take care of merging the clauses
    Transformations valid = get_rule_identity_transforms();
    for (size_t i = 0; i < state.clause_count; i++) {
        if (state.clauses[i].removed) {
            continue;
        }
        PreClause x;
        pre_create_pre_clause(&x, &(state.clauses[i]));
        for (size_t j = 0; j < i; j++) {
            if (state.clauses[j].removed) {
                continue;
            }
            PreClause y;
            pre_create_pre_clause(&y, &(state.clauses[i]));
            PreClause y2;
            // no transformation
            pre_clause_copy(&y2, &y);
            if (pre_clause_eq(&x, &y2)) {
                debug(2, printf("Match found: clause %zu is equal to clause %zu with no transformation\n", state.clauses[i].number, state.clauses[j].number));
                pre_remove_clause(&(state.clauses[j]));
                continue;
            } else if (pre_clause_eq_except_for_next(&x, &y2)) {
                debug(2, printf("Match found: clause %zu has same next as clause %zu with no transformation\n", state.clauses[i].number, state.clauses[j].number));
                pre_alias_cell(__func__, x.next, y.next);
                continue;
            }
            // macro for the rest of the transformations
            #define check(name) \
                if (valid.name) { \
                    pre_clause_##name(&y2, &y); \
                    if (pre_clause_eq(&x, &y2)) { \
                        debug(2, printf("Match found: clause %zu is equal to clause %zu with transformation "#name"\n", state.clauses[i].number, state.clauses[j].number)); \
                        pre_remove_clause(&(state.clauses[j])); \
                        continue; \
                    } else if (pre_clause_eq_except_for_next(&x, &y2)) { \
                        debug(2, printf("Match found: clause %zu has same next as clause %zu with transformation "#name"\n", state.clauses[i].number, state.clauses[j].number)); \
                        pre_alias_cell(__func__, x.next, y.next); \
                        continue; \
                    } \
                }
            check(flip_horizontal);
            check(flip_vertical);
            check(rotate_left);
            check(rotate_right);
            check(rotate_180);
            check(flip_diagonal);
            check(flip_anti_diagonal);
            #undef check
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
        pre_changes_made = false;
        inc_debug_depth();
        pre_normalize_cells();
        pre_normalize_clauses();
        pre_check_cell_implications();
        pre_normalize_cells();
        pre_normalize_clauses();
        pre_normalize_cells();
        pre_normalize_clauses();
        pre_remove_known_clauses();
        pre_normalize_cells();
        pre_normalize_clauses();
        pre_merge_duplicate_or_similar_clauses();
        pre_normalize_cells();
        pre_normalize_clauses();
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
    // move back the stack pointer to save space
    current_stack.len = 0;
    size_t real_clause_count = 0;
    for (size_t i = 0; i < state.clause_count; i++) {
        if (!state.clauses[i].removed) {
            real_clause_count++;
        }
    }
    printf("Preprocessing complete: %zu variables, %zu clauses\n", state.var_count, real_clause_count);
    return false;
}
