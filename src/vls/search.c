
// main search algorithm

#pragma once

#include <inttypes.h>

#include "base.c"
#include "bv1024/index.c"
#include "output.c"


// sets the next_in_search_order fields in all the cells
// returns the initial cell to search
static Cell* add_search_orders(void) {
    for (size_t i = 1; i <= state.var_count; i++) {
        state.vars[i]->next_in_search_order = NULL;
    }
    size_t* coords = config.search_order[0];
    size_t t = coords[0];
    size_t x = coords[1];
    size_t y = coords[2];
    Cell* prev = state_get_grid_cell(t, x, y)->cell;
    Cell* initial_cell = prev;
    debug_printf_2("Search order:\n");
    for (size_t i = 1; i < config.search_order_len; i++) {
        size_t* coords = config.search_order[i];
        size_t t = coords[0];
        size_t x = coords[1];
        size_t y = coords[2];
        Cell* cell = state_get_grid_cell(t, x, y)->cell;
        if (cell->value != UNKNOWN || cell->next_in_search_order != NULL) {
            continue;
        }
        // make sure it's not already in there
        bool found = false;
        Cell* prev_cell = initial_cell;
        while (prev_cell != NULL) {
            prev_cell = prev_cell->next_in_search_order;
            if (cell == prev_cell) {
                found = true;
                break;
            }
        }
        if (!found) {
            debug_printf_2(INDENT "variable = %zu\n", cell->var_number);
            prev->next_in_search_order = cell;
            prev = cell;
        }
    }
    prev->next_in_search_order = NULL;
    return initial_cell;
}


bool all_zeros = true;

static bool check_early_exhaustion(void) {
    // check columns
    if (config.periodic_dx < 0) {
        for (size_t x = 0; x < (size_t)(-config.periodic_dx + 1); x++) {
            for (size_t y = 0; y < state.height; y++) {
                if (state_get_cell_value(0, x, y) != OFF) {
                    return false;
                }
            }
        }
    } else if (config.periodic_dx > 0) {
        for (size_t x = state.width - config.periodic_dx - 1; x < state.width; x++) {
            for (size_t y = 0; y < state.height; y++) {
                if (state_get_cell_value(0, x, y) != OFF) {
                    return false;
                }
            }
        }
    } else {
        // check left column and right column
        bool found = false;
        for (size_t y = 0; y < state.height; y++) {
            if (state_get_cell_value(0, 0, y) != OFF) {
                found = true;
                break;
            }
        }
        if (!found) {
            return true;
        }
        found = false;
        for (size_t y = 0; y < state.height; y++) {
            if (state_get_cell_value(0, state.width - 1, y) != OFF) {
                found = true;
                break;
            }
        }
        if (!found) {
            return true;
        }
    }
    // check rows
    if (config.periodic_dy < 0) {
        for (size_t y = 0; y < (size_t)(-config.periodic_dy + 1); y++) {
            for (size_t x = 0; x < state.width; x++) {
                if (state_get_cell_value(0, x, y) != OFF) {
                    return false;
                }
            }
        }
        return true;
    } else if (config.periodic_dy > 0) {
        for (size_t y = state.height - config.periodic_dy - 1; y < state.width; y++) {
            for (size_t x = 0; x < state.width; x++) {
                if (state_get_cell_value(0, x, y) != OFF) {
                    return false;
                }
            }
        }
        return true;
    } else {
        // check top row and bottom row
        bool found = false;
        for (size_t x = 0; x < state.width; x++) {
            if (state_get_cell_value(0, x, 0) != OFF) {
                return false;
            }
        }
        if (!found) {
            return true;
        }
        found = false;
        for (size_t x = 0; x < state.width; x++) {
            if (state_get_cell_value(0, x, state.height - 1) != OFF) {
                return false;
            }
        }
        if (!found) {
            return true;
        }
        return false;
    }
}


// returns number of iterations to backjump
static size_t run_depth(size_t depth, Cell* cell);

// returns number of iterations to backjump
static size_t actual_run_depth(size_t depth, Cell* cell, CellValue value) {
    debug_printf_3("Attempting to set cell: variable = %zu, value = %i, prev_value = %i\n", cell->var_number, value, cell->value);
    push_stack_frame(&current_stack);
    #if DEBUG >= 4
        print_stack(&current_stack);
    #endif
    size_t out = 0;
    if (set_cell_and_propagate(cell, value, true)) {
        #if CUSTOM_PRUNING
            if (!custom_prune(depth, cell)) {
                dec_debug_depth();
                pop_stack_frame(&current_stack);
                return 0;
            }
        #endif
        // check for early exhaustion
        if (config.check_early_exhaustion && all_zeros) {
            if (check_early_exhaustion()) {
                debug_print_grid_3();
                debug_printf_3("Early exhausted");
                pop_stack_frame(&current_stack);
                return 0;
            }
        }
        out = run_depth(depth + 1, cell->next_in_search_order);
    }
    pop_stack_frame(&current_stack);
    return out;
}

// returns number of iterations to backjump
static size_t run_depth(size_t depth, Cell* cell) {
    inc_debug_depth();
    #if DEBUG >= 3
        printf("Running depth %zu: ", depth);
        print_progress(stdout);
        real_printf("\n");
        if (cell == NULL) {
            printf("Cell: <null pointer>\n");
        } else {
            printf("Cell: variable = %zu\n", cell->var_number);
        }
    #endif
    state.branches++;
    // add 2 to account for off-by-one errors
    if (depth > config.search_order_len + 2) {
        unexpected_error("The dwarves delved too greedily and too deep");
    }
    if (state.set_unknown_vars >= state.start_unknown_vars) {
        check_solution(false);
        dec_debug_depth();
        return 0;
    }
    debug_print_grid_3();
    print_info_if_needed(depth);
    if (cell->value != UNKNOWN) {
        debug_printf_3("Cell is known, continuing\n");
        size_t out = run_depth(depth + 1, cell->next_in_search_order);
        dec_debug_depth();
        return out == 0 ? 0 : out - 1;
    }
    CellValue value = config.initial_value;
    for (int i = 0; i < 2; i++) {
        bool prev_all_zeros = all_zeros;
        if (value == ON) {
            all_zeros = false;
        }
        progress[progress_pos] = i;
        progress_pos++;
        size_t out = actual_run_depth(depth, cell, value);
        progress_pos--;
        if (out != 0) {
            return out - 1;
        }
        all_zeros = prev_all_zeros;
        value = value == OFF ? ON : OFF;
    }
    dec_debug_depth();
    return 0;
}


static void actual_run_search(void) {
    Cell* initial_cell = add_search_orders();
    debug_print_grid_1();
    debug_printf_1("Running search\n");
    state.branches = 0;
    state.solutions_found = 0;
    start = get_time();
    last_progress_shown = start;
    last_max_partial_shown = start;
    all_zeros = true;
    run_depth(0, initial_cell);
    double time = get_time() - start;
    printf("Search complete, found %"PRIu64" solution%s in %.6f second%s, %"PRIu64" branch%s\n", plural(state.solutions_found, "s"), plural(time, "s"), plural(state.branches, "es"));
    max_partials_end();
}

static void run_search(void) {
    if (!config.benchmarking) {
        actual_run_search();
    } else {
        uintmax_t iterations = config.benchmarking_iterations;
        double full_start = get_time();
        for (uintmax_t i = 0; i < iterations; i++) {
            double start = get_time();
            actual_run_search();
            double time = get_time() - start;
            printf("Iteration %ju/%ju complete in %.6f second%s\n", i + 1, iterations, plural(time, "s"));
        }
        double seconds = get_time() - full_start;
        printf("%ju iterations complete in %.6f second%s, average %.6f second%s/iteration\n", iterations, plural(seconds, "s"), plural(seconds / iterations, "s"));
    }
}
