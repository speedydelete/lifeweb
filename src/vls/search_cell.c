
// cell-based search method

#pragma once

#include "params2.h"
#if METHOD == METHOD_CELL

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"


// sets the next_in_search_order fields in all the cells
// returns the first cell in the search order
static inline cell* add_search_orders(void) {
    index_t* coords = search_order[0];
    index_t t = coords[0];
    index_t x = coords[1];
    index_t y = coords[2];
    cell* prev = &grid[t][y][x];
    cell* out = prev;
    for (index_t i = 1; i < unknown_cells; i++) {
        index_t* coords = search_order[i];
        index_t t = coords[0];
        index_t x = coords[1];
        index_t y = coords[2];
        // printf("i = %i, t = %i, x = %i, y = %i\n", i, t, x, y);
        cell* cell = &grid[t][y][x];
        prev->next_in_search_order = cell;
        prev = cell;
    }
    prev->next_in_search_order = NULL;
    return out;
}


static void run_depth(int depth, cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    );

static inline void actual_run_depth(int depth, cell* cell, cell_value_t value) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_frame();
    #if DEBUG >= 6
    print_stack();
    #endif
    if (set_cell_and_propagate(cell, value)) {
        #if MULTI_RULE
        run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        run_depth(depth + 1, cell->next_in_search_order);
        #endif
    #if MULTI_RULE
    } else if (rule_dependent_tr != -1) {
        pop_frame();
        int32_t tr = rule_dependent_tr;
        rule_dependent_tr = -1;
        progress[depth + 1].tr_is_set = true;
        progress[depth + 1].tr = tr;
        DPRINTF3("Branching rule on transition %i (aka %s), (depth = %i)\n", tr, bound_trs_names[tr_to_bound_tr[tr]], depth);
        progress[depth + 1].value = 0;
        set_tr(tr, 0);
        run_depth(depth + 1, cell, value);
        progress[depth + 1].value = 1;
        set_tr(tr, 1);
        run_depth(depth + 1, cell, value);
        set_tr(tr, 3);
        progress[depth + 1].tr_is_set = false;
        return;
    #endif
    }
    pop_frame();
}

static void run_depth(int depth, cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    ) {
    #if DEBUG >= 3
    current_depth++;
    printf("Running depth %i: ", depth);
    print_progress(stdout, depth);
    real_printf("\n");
    #endif
    branches++;
    if (depth > max_depth) {
        fprintf(stderr, "\nError: This error should not occur (infinite recursion detected)\nPlease report this error\n");
        exit(1);
    }
    if (depth > max_depth || set_cells == unknown_cells) {
        #ifndef BENCHMARK
        print_solution(false, depth);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    #if CUSTOM_PRUNING
    if (!custom_prune()) {
        return;
    }
    #endif
    DPRINTGRID3();
    print_state_if_needed(depth);
    if (cell->value != UNKNOWN) {
        DPRINTF3("Cell is known, continuing\n");
        #if MULTI_RULE
        progress[depth].value = -1;
        run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        progress[depth] = -1;
        run_depth(depth + 1, cell->next_in_search_order);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    #if MULTI_RULE
    if (force_value == -1) {
    #endif
        #if INITIAL_VALUE == 0
        for (int value = 0; value < 2; value++)
        #else
        for (int value = 1; value >= 0; value--)
        #endif
        {
            #if MULTI_RULE
            progress[depth].value = value;
            actual_run_depth(depth, cell, value);
            #else
            progress[depth] = value;
            actual_run_depth(depth, cell, value);
            #endif
        }
    #if MULTI_RULE
    } else {
        actual_run_depth(depth, cell, force_value);
    }
    #endif
    #if DEBUG >= 3
    current_depth--;
    #endif
}


#endif
