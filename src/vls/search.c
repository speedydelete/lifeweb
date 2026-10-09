
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
// returns the initial cell to search
static inline Cell* add_search_orders(void) {
    size_t* coords = config.search_order[0];
    size_t t = coords[0];
    size_t x = coords[1];
    size_t y = coords[2];
    Cell* prev = state_get_cell(t, x, y)->cell;
    Cell* initial_cell = prev;
    for (size_t i = 1; i < config.search_order_len; i++) {
        size_t* coords = config.search_order[i];
        size_t t = coords[0];
        size_t x = coords[1];
        size_t y = coords[2];
        Cell* cell = state_get_cell(t, x, y)->cell;
        prev->next_in_search_order = cell;
        prev = cell;
    }
    prev->next_in_search_order = NULL;
    return initial_cell;
}


#if CHECK_EARLY_EXHAUSTION

bool all_zeros = true;

static inline bool check_early_exhaustion(void) {
    #if PERIODIC_DX == 0 || PERIODIC_DY == 0
    bool found;
    #endif
    // check columns
    #if PERIODIC_DX < 0
        for (Index x = 0; x < -PERIODIC_DX + 1; x++) {
            for (Index y = 0; y < state.height; y++) {
                if (state_get_cell_value(0, x, y) != OFF) {
                    return false;
                }
            }
        }
    #elif PERIODIC_DX > 0
        for (Index x = state.width - PERIODIC_DX - 1; x < state.width; x++) {
            for (Index y = 0; y < state.height; y++) {
                if (state_get_cell_value(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    #else
    // check left column and right column
    found = false;
    for (Index y = 0; y < state.height; y++) {
        if (state_get_cell_value(0, 0, y)->value != OFF) {
            found = true;
            break;
        }
    }
    if (!found) {
        return true;
    }
    found = false;
    for (Index y = 0; y < state.height; y++) {
        if (state_get_cell_value(0, state.width - 1, y)->value != OFF) {
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
        for (Index y = 0; y < -PERIODIC_DY + 1; y++) {
            for (Index x = 0; x < state.width; x++) {
                if (state_get_cell_value(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    return true;
    #elif PERIODIC_DY > 0
        for (Index y = state.height - PERIODIC_DY - 1; y < state.width; y++) {
            for (Index x = 0; x < state.width; x++) {
                if (state_get_cell_value(0, x, y)->value != OFF) {
                    return false;
                }
            }
        }
    return true;
    #else
    // check top row and bottom row
    found = false;
    for (Index x = 0; x < state.width; x++) {
        if (state_get_cell_value(0, x, 0)->value != OFF) {
            return false;
        }
    }
    if (!found) {
        return true;
    }
    found = false;
    for (Index x = 0; x < state.width; x++) {
        if (state_get_cell_value(0, x, state.height - 1)->value != OFF) {
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
static size_t run_depth(size_t depth, Cell* cell);

// returns number of iterations to backjump
static inline size_t actual_run_depth(size_t depth, Cell* cell, CellValue value) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_stack_frame(current_stack);
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    size_t out = 0;
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
        out = run_depth(depth + 1, cell->next_in_search_order);
    }
    pop_stack_frame(current_stack);
    return out;
}

// returns number of iterations to backjump
static size_t run_depth(size_t depth, Cell* cell) {
    #if DEBUG >= 3
        debug_depth++;
        printf("Running depth %zu: ", depth);
        print_progress(stdout);
        real_printf("\n");
        printf("Cell: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
    #endif
    branches++;
    // add 2 to account for off-by-one errors
    if (depth > config.search_order_len + 2) {
        unexpected_error("The dwarves delved too greedily and too deep");
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
        size_t out = run_depth(depth + 1, cell->next_in_search_order);
        #if DEBUG >= 3
            debug_depth--;
        #endif
        return out == 0 ? 0 : out - 1;
    }
    CellValue value = config.initial_value;
    for (int i = 0; i < 2; i++) {
        #if CHECK_EARLY_EXHAUSTION
            bool prev_all_zeros = all_zeros;
            if (value == ON) {
                all_zeros = false;
            }
        #endif
        progress[progress_pos] = i;
        progress_pos++;
        size_t out = actual_run_depth(depth, cell, value);
        progress_pos--;
        if (out != 0) {
            return out - 1;
        }
        #if CHECK_EARLY_EXHAUSTION
            all_zeros = prev_all_zeros;
        #endif
        value = value == OFF ? ON : OFF;
    }
    #if DEBUG >= 3
        debug_depth--;
    #endif
    return 0;
}


static inline void actual_run_search(Cell* initial_cell) {
    start = get_time();
    last_progress_shown = start;
    #if MAX_PARTIALS
        last_max_partial_shown = start;
    #endif
    #if CHECK_EARLY_EXHAUSTION
        all_zeros = true;
    #endif
    run_depth(0, initial_cell);
}

static inline void run_search(void) {
    Cell* initial_cell = add_search_orders();
    DPRINTGRID1();
    printf("Running search\n");
    #ifndef BENCHMARK
        actual_run_search(initial_cell);
        printf("Search complete, found %"PRIu64" solutions in %.6f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #if MAX_PARTIALS
        max_partials_end();
    #endif
    #else
        double full_start = get_time();
        for (uintmax_t i = 0; i < BENCHMARK; i++) {
            double start = get_time();
            actual_run_search(initial_cell);
            printf("Iteration %ju/%ju complete in %.6f seconds\n", i + 1, BENCHMARK, get_time() - start);
        }
        double seconds = get_time() - full_start;
        printf("%ju iterations complete in %.6f seconds, average %.6f seconds/iteration\n", BENCHMARK, seconds, seconds / BENCHMARK);
    #endif
}
