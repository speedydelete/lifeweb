
// main search algorithm

#pragma once

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"
#ifdef CUSTOM
    #include CUSTOM
#endif


// sets the next_in_search_order fields in all the cells
static inline void add_search_orders(void) {
    Index* coords = search_order[0];
    Index t = coords[0];
    Index x = coords[1];
    Index y = coords[2];
    Cell* prev = get_cell(t, x, y);
    state.initial_cell = prev;
    DPRINTF2("Search order:\n");
    DPRINTF2("t = %i, x = %i, y = %i, value = %i", t, x, y, prev->value);
    for (Index i = 1; i < state.start_unknown_cells; i++) {
        Index* coords = search_order[i];
        Index t = coords[0];
        Index x = coords[1];
        Index y = coords[2];
        Cell* cell = get_cell(t, x, y);
        if (cell->value == DONT_CARE || cell->settable == NOT_SEARCHABLE || cell->settable == NOT_SETTABLE) {
            continue;
        }
        #if DEBUG >= 2
            printf("t = %i, x = %i, y = %i, value = ", t, x, y);
        #if VARIABLES
            print_cell(stdout, cell->value, cell->var);
        #else
            print_cell(stdout, cell->value);
        #endif
        printf("\n");
        #endif
        prev->next_in_search_order = cell;
        prev = cell;
    }
    prev->next_in_search_order = NULL;
}


#if CHECK_EARLY_EXHAUSTION

bool all_zeros = true;

static inline bool check_early_exhaustion(void) {
    #if PERIODIC_DX == 0 || PERIODIC_DY == 0
    bool found;
    #endif
    // check columns
    #if PERIODIC_DX < 0
        for (Index x = PADDING; x < PADDING - PERIODIC_DX + 1; x++) {
            for (Index y = PADDING; y < state.height - PADDING; y++) {
                if (get_cell(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    #elif PERIODIC_DX > 0
        for (Index x = state.width - PADDING - PERIODIC_DX - 1; x < state.width - PADDING; x++) {
            for (Index y = PADDING; y < state.height - PADDING; y++) {
                if (get_cell(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    #else
    // check left column and right column
    found = false;
    for (Index y = PADDING; y < state.height - PADDING; y++) {
        if (get_cell(0, PADDING, y)->value != OFF) {
            found = true;
            break;
        }
    }
    if (!found) {
        return true;
    }
    found = false;
    for (Index y = PADDING; y < state.height - PADDING; y++) {
        if (get_cell(0, state.width - PADDING - 1, y)->value != OFF) {
            found = true;
            break;
        }
    }
    if (!found) {
        return true;
    }
    #endif
    // check rows
    #if PERIODIC_DY < 0
        for (Index y = PADDING; y < PADDING - PERIODIC_DY + 1; y++) {
            for (Index x = PADDING; x < state.width - PADDING; x++) {
                if (get_cell(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    return true;
    #elif PERIODIC_DY > 0
        for (Index y = state.height - PADDING - PERIODIC_DY - 1; y < state.width - PADDING; y++) {
            for (Index x = PADDING; x < state.width - PADDING; x++) {
                if (get_cell(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    return true;
    #else
    // check top row and bottom row
    found = false;
    for (Index x = PADDING; x < state.width - PADDING; x++) {
        if (get_cell(0, x, PADDING)->value != OFF) {
            return false;
        }
    }
    if (!found) {
        return true;
    }
    found = false;
    for (Index x = PADDING; x < state.width - PADDING; x++) {
        if (get_cell(0, x, state.height - PADDING - 1)->value != OFF) {
            return false;
        }
    }
    if (!found) {
        return true;
    }
    return false;
    #endif
}

#endif

// returns number of iterations to backjump
static Depth run_depth(Depth depth, Cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    );

// returns number of iterations to backjump
static inline Depth actual_run_depth(Depth depth, Cell* cell, CellValue value) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_stack_frame(current_stack);
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    Depth out = 0;
    if (set_cell_and_propagate(cell, value, true)) {
        #if CUSTOM_PRUNING
            if (!custom_prune(depth, cell)) {
                #if DEBUG >= 3
                    debug_depth--;
                #endif
                return 0;
            }
        #endif
        // check for early exhaustion
        #if CHECK_EARLY_EXHAUSTION
            if (all_zeros) {
                if (check_early_exhaustion()) {
                    DPRINTGRID3();
                    DPRINTF3("Early exhausted");
                    pop_stack_frame(current_stack);
                    return 0;
                }
            }
        #endif
        #if MULTI_RULE
            out = run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
            out = run_depth(depth + 1, cell->next_in_search_order);
        #endif
    #if MULTI_RULE
    } else if (state.rule_dependent_tr != -1) {
        pop_stack_frame(current_stack);
        BoundTransition tr = tr_to_bound_tr[state.rule_dependent_tr];
        state.rule_dependent_tr = -1;
        // progress_pos++;
        progress[progress_pos].tr_is_set = true;
        progress[progress_pos].tr = tr;
        DPRINTF3("Branching rule on transition %i (aka %s), depth = %"PRIdepth"\n", tr, bound_trs_names[tr], depth);
        push_stack_frame(current_stack);
        progress[progress_pos].value = 0;
        progress_pos++;
        set_tr(tr, OFF, true);
        run_depth(depth + 1, cell, value);
        progress_pos--;
        pop_stack_frame(current_stack);
        progress[progress_pos].value = 1;
        progress_pos++;
        push_stack_frame(current_stack);
        set_tr(tr, ON, true);
        run_depth(depth + 1, cell, value);
        progress_pos--;
        pop_stack_frame(current_stack);
        progress[progress_pos].tr_is_set = false;
        // progress_pos--;
        return out;
    #endif
    }
    pop_stack_frame(current_stack);
    return out;
}


#if INITIAL_VALUE != IV_0 && INITIAL_VALUE != IV_1
CellValue get_same_for_iv(Cell* cell_to_use) {
    Cell* cell = &get_cell(0, cell_to_use->x, cell_to_use->y);
    for (Index i = 0; i < state.gens; i++) {
        if (cell->value != UNKNOWN) {
            return cell->value;
        }
        cell = cell->next;
    }
    return (INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_DIFFERENT_1) ? 0 : 1;
}
#endif

// returns number of iterations to backjump
static Depth run_depth(Depth depth, Cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    ) {
    #if DEBUG >= 3
        debug_depth++;
        printf("Running depth %"PRIu64": ", depth);
        print_progress(stdout);
        real_printf("\n");
        printf("Cell: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
    #endif
    branches++;
    if (depth > MAX_DEPTH) {
        real_fprintf(stderr, "Error: This error should not occur, please report it (the dwarves delved too greedily and too deep)\n");
        exit(1);
    }
    if (state.set_unknown_cells >= state.start_unknown_cells) {
        #ifndef BENCHMARK
            check_solution(false);
        #endif
        #if DEBUG >= 3
            debug_depth--;
        #endif
        return 0;
    }
    DPRINTGRID3();
    print_info_if_needed(depth);
    if (cell->value != UNKNOWN) {
        DPRINTF3("Cell is known, continuing\n");
        #if MULTI_RULE
            Depth out = run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
            Depth out = run_depth(depth + 1, cell->next_in_search_order);
        #endif
        #if DEBUG >= 3
            debug_depth--;
        #endif
        return out == 0 ? 0 : out - 1;
    }
    #if MULTI_RULE
    if (force_value == -1) {
    #endif
        // somehow this makes it not exhaustive
        // idk why
        // #ifdef MAXPOP
        // if (phase_0_pop == MAXPOP) {
        //     Depth out = actual_run_depth(depth, cell, OFF);
        //     #if DEBUG >= 3
        //     debug_depth--;
        //     #endif
        //     if (out != 0) {
        //         return out - 1;
        //     } else {
        //         return 0;
        //     }
        // }
        // #endif
        CellValue value;
        #if INITIAL_VALUE == IV_0
        value = OFF;
        for (int i = 0; i < 2; value++, i++)
        #elif INITIAL_VALUE == IV_1
        value = ON;
        for (int i = 0; i < 2; value--, i++)
        #elif INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_SAME_1
        value = get_same_for_iv(cell);
        for (int i = 0; i < 2; i++, value = (value + 1) % 2)
        #elif INITIAL_VALUE == IV_DIFFERENT_0 || INITIAL_VALUE == IV_DIFFERENT_1
        value = get_same_for_iv(cell) == 0 ? 1 : 0;
        for (int i = 0; i < 2; i++, value = (value + 1) % 2)
        #else
        #error "This error should not occur, please report it (invalid initial value)"
        #endif
        {
            #if CHECK_EARLY_EXHAUSTION
                bool prev_all_zeros = all_zeros;
                if (value == ON) {
                    all_zeros = false;
                }
            #endif
            #if MULTI_RULE
                progress[progress_pos].value = i;
                progress_pos++;
                actual_run_depth(depth, cell, value);
                progress_pos--;
            #else
                progress[progress_pos] = i;
                progress_pos++;
                Depth out = actual_run_depth(depth, cell, value);
                progress_pos--;
                if (out != 0) {
                    return out - 1;
                }
            #endif
            #if CHECK_EARLY_EXHAUSTION
                all_zeros = prev_all_zeros;
            #endif
        }
    #if MULTI_RULE
    } else {
        actual_run_depth(depth, cell, force_value);
    }
    #endif
    #if DEBUG >= 3
        debug_depth--;
    #endif
    return 0;
}


static inline void actual_run_search(void) {
    start = get_time();
    last_progress_shown = start;
    #if MAX_PARTIALS
        last_max_partial_shown = start;
    #endif
    #if CHECK_EARLY_EXHAUSTION
        all_zeros = true;
    #endif
    #if MULTI_RULE
        run_depth(0, state.initial_cell, -1);
    #else
        run_depth(0, state.initial_cell);
    #endif
}

static inline void run_search(void) {
    add_search_orders();
    DPRINTGRID1();
    printf("Running search\n");
    #ifndef BENCHMARK
        actual_run_search();
        printf("Search complete, found %"PRIu64" solutions in %.6f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #if MAX_PARTIALS
        max_partials_end();
    #endif
    #else
        double full_start = get_time();
        for (uintmax_t i = 0; i < BENCHMARK; i++) {
            double start = get_time();
            actual_run_search();
            printf("Iteration %ju/%ju complete in %.6f seconds\n", i + 1, BENCHMARK, get_time() - start);
        }
        double seconds = get_time() - full_start;
        printf("%ju iterations complete in %.6f seconds, average %.6f seconds/iteration\n", BENCHMARK, seconds, seconds / BENCHMARK);
    #endif
}
