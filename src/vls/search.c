
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
    Cell* prev = &grid[t][y][x];
    Cell* out = prev;
    for (Index i = 1; i < unknown_cells; i++) {
        Index* coords = search_order[i];
        Index t = coords[0];
        Index x = coords[1];
        Index y = coords[2];
        // printf("i = %i, t = %i, x = %i, y = %i\n", i, t, x, y);
        Cell* cell = &grid[t][y][x];
        if (cell->value == DONT_CARE || cell->settable == NOT_SEARCHABLE || cell->settable == NOT_SETTABLE) {
            continue;
        }
        prev->next_in_search_order = cell;
        prev = cell;
    }
    prev->next_in_search_order = NULL;
    initial_cell = out;
}


#if CHECK_EARLY_EXHAUSTION
bool all_zeros = true;
#endif

// returns number of iterations to backjump
static int run_depth(int depth, Cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    );

// returns number of iterations to backjump
static inline int actual_run_depth(int depth, Cell* cell, CellValue value) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_frame();
    #if DEBUG >= 5
    print_stack();
    #endif
    int out = 0;
    if (set_cell_and_propagate(cell, value)) {
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
            #if !TIME_WRAP
            #error "This error should not occur, please report it (CHECK_EARLY_EXHAUSTION && !TIME_WRAP)"
            #endif
            // check columns
            for (Index x = PADDING + max(0, -TIME_WRAP_DX - 1); x < WIDTH - PADDING - max(0, TIME_WRAP_DX - 1); x++) {
                bool found = false;
                for (Index y = PADDING; y < HEIGHT - PADDING; y++) {
                    if (grid[0][y][x].value != OFF) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    DPRINTGRID3();
                    DPRINTF3("All zeros at x = %i\n", x);
                    pop_frame();
                    return 0;
                }
            }
            // check rows
            for (Index y = PADDING + max(0, -TIME_WRAP_DY - 1); y < HEIGHT - PADDING - max(0, TIME_WRAP_DY - 1); y++) {
                bool found = false;
                for (Index x = PADDING; x < WIDTH - PADDING; x++) {
                    if (grid[0][y][x].value != OFF) {
                        found = true;
                        break;
                    }
                }
                if (!found) {
                    DPRINTGRID3();
                    DPRINTF3("All zeros at y = %i\n", y);
                    pop_frame();
                    return 0;
                }
            }
        }
        #endif
        #if MULTI_RULE
        out = run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        out = run_depth(depth + 1, cell->next_in_search_order);
        #endif
    #if MULTI_RULE
    } else if (rule_dependent_tr != -1) {
        pop_frame();
        int32_t tr = rule_dependent_tr;
        rule_dependent_tr = -1;
        progress_pos++;
        progress[progress_pos].tr_is_set = true;
        progress[progress_pos].tr = tr;
        DPRINTF3("Branching rule on transition %i (aka %s), depth = %i\n", tr, bound_trs_names[tr_to_bound_tr[tr]], depth);
        progress[progress_pos].value = 0;
        set_tr(tr, OFF);
        progress_pos++;
        run_depth(depth + 1, cell, value);
        progress_pos--;
        progress[progress_pos].value = 1;
        set_tr(tr, ON);
        progress_pos++;
        run_depth(depth + 1, cell, value);
        progress_pos--;
        set_tr(tr, TRS_RULE_DEPENDENT);
        progress[progress_pos].tr_is_set = false;
        progress_pos--;
        return out;
    #endif
    }
    pop_frame();
    return out;
}


#if INITIAL_VALUE != IV_0 && INITIAL_VALUE != IV_1
int get_same_for_iv(Cell* cell_to_use) {
    Cell* cell = &grid[0][cell_to_use->y][cell_to_use->x];
    for (int i = 0; i < GENS; i++) {
        if (cell->value != UNKNOWN) {
            return cell->value;
        }
        cell = cell->next;
    }
    return (INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_DIFFERENT_1) ? 0 : 1;
}
#endif

// returns number of iterations to backjump
static int run_depth(int depth, Cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    ) {
    #if DEBUG >= 3
    debug_depth++;
    printf("Running depth %i: ", depth);
    print_progress(stdout);
    real_printf("\n");
    printf("Cell: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
    #endif
    branches++;
    if (depth > max_depth) {
        real_fprintf(stderr, "Error: This error should not occur (infinite recursion detected)\nPlease report this error\n");
        exit(1);
    }
    if (set_cells >= unknown_cells) {
        #ifndef BENCHMARK
        print_solution(false);
        #endif
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return 0;
    }
    DPRINTGRID3();
    print_info_if_needed();
    if (cell->value != UNKNOWN) {
        DPRINTF3("Cell is known, continuing\n");
        #if MULTI_RULE
        int out = run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        int out = run_depth(depth + 1, cell->next_in_search_order);
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
        //     int out = actual_run_depth(depth, cell, OFF);
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
        #if INITIAL_VALUE == IV_0
        for (int value = 1, i = 0; i < 2; value++, i++)
        #elif INITIAL_VALUE == IV_1
        for (int value = 2, i = 0; i < 2; value--, i++)
        #elif INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_SAME_1
        int value = get_same_for_iv(cell); for (int i = 0; i < 2; i++, value = (value + 1) % 2)
        #elif INITIAL_VALUE == IV_DIFFERENT_0 || INITIAL_VALUE == IV_DIFFERENT_1
        int value = get_same_for_iv(cell) == 0 ? 1 : 0; for (int i = 0; i < 2; i++, value = (value + 1) % 2)
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
            int out = actual_run_depth(depth, cell, value);
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


static inline void run_search(void) {
    #if CHECK_EARLY_EXHAUSTION
    all_zeros = true;
    #endif
    #if MULTI_RULE
    run_depth(0, initial_cell, -1);
    #else
    run_depth(0, initial_cell);
    #endif
}
