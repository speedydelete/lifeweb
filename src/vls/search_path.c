
// path-based search method

#pragma once

#include "params2.h"
#if METHOD == METHOD_PATH

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"


typedef struct path_implic {
    index_t index;
    cell_value_t value;
} path_implic;

typedef struct path_cell {
    cell* cell;
    cell_value_t value;
    path_implic implics[2][SIZE];
    int implics_count[2];
} path_cell;

typedef struct path {
    int length;
    path_cell cells[SIZE];
    int current[SIZE];
    // bool run_before;
    // int prev_run[SIZE];
} path;

path paths[TOTAL_MAX_DEPTH];


// fills in the given path
// returns false if contradiction, true if no contradiction
static inline bool get_path(path* path) {
    // figure out what cells to put in
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            cell* cell = &grid[INITIAL_CELL_T][y][x];
            if (cell->value != UNKNOWN) {
                continue;
            }
            if (cell->nw->value == UNKNOWN && cell->n->value == UNKNOWN && cell->ne->value == UNKNOWN && cell->w->value == UNKNOWN && cell->e->value == UNKNOWN && cell->sw->value == UNKNOWN && cell->s->value == UNKNOWN && cell->se->value == UNKNOWN) {
                continue;
            }
            path_cell* value = &path->cells[path->length];
            value->cell = cell;
            path->length++;
        }
    }
    // get the implications
    for (int i = 0; i < path->length; i++) {
        path_cell* cell = &path->cells[i];
        cell->implics_count[0] = 0;
        cell->implics_count[1] = 0;
        bool zero_possible = true;
        bool one_possible = true;
        for (int value = 0; value <= 1; value++) {
            push_frame();
            int start_sp = sp;
            if (!set_cell_and_propagate(cell->cell, value)) {
                if (i == 0) {
                    zero_possible = false;
                } else {
                    one_possible = false;
                }
            } else {
                for (int j = start_sp; j < sp; i++) {
                    stack_entry* entry = &stack[i];
                    for (int k = 0; k < path->length; k++) {
                        if (entry->cell == path->cells[k].cell) {
                            path_implic* implic = &cell->implics[value][cell->implics_count[value]++];
                            implic->index = k;
                            implic->value = entry->cell->value;
                            break;
                        }
                    }
                }
            }
            pop_frame();
        }
        // if it has to be a value (or can't be any value), do that
        if (!zero_possible && !one_possible) {
            return false;
        } else if (zero_possible && !one_possible) {
            cell->value = 0;
        } else if (one_possible && !zero_possible) {
            cell->value = 1;
        } else {
            cell->value = UNKNOWN;
        }
    }
    return true;
}

static void run_depth(int depth);

int solve_path_prev[TOTAL_MAX_DEPTH][SIZE];

int progress_pos = 0;

static void solve_path(int depth, path* path, int index) {
    if (path->current[index] != UNKNOWN) {
        solve_path(depth, path, index + 1);
        return;
    }
    path_cell* cell = &path->cells[index];
    int* prev = solve_path_prev[depth];
    #if INITIAL_VALUE == 0
    for (int value = 0; value < 2; value++)
    #else
    for (int value = 1; value >= 0; value--)
    #endif
    {
        memcpy(prev, path->current, path->length * sizeof(int));
        path->current[index] = value;
        bool contradiction = false;
        for (int i = 0; i < cell->implics_count[value]; i++) {
            path_implic implic = cell->implics[value][i];
            int prev_value = path->current[implic.index];
            if (prev_value != UNKNOWN && prev_value != implic.value) {
                contradiction = true;
                break;
            }
            path->current[implic.index] = implic.value;
        }
        if (!contradiction) {
            if (index == path->length - 1) {
                // apply the solved path and run it
                int start_sp = sp;
                int start_progress_pos = progress_pos;
                push_frame();
                for (int i = 0; i < path->length; i++) {
                    progress[]
                    if (!set_cell_and_propagate(path->cells[i].cell, path->current[i])) {
                        contradiction = true;
                        break;
                    }
                }
                progress_pos = start_progress_pos;
                if (!contradiction) {
                    run_depth();
                }
                while (sp > start_sp) {
                    pop_frame();
                }
            } else {
                solve_path(depth, path, index + 1);
            }
        }
        memcpy(path->current, prev, path->length * sizeof(int));
    }
}

static inline void actual_run_depth(int depth) {
    path* path = &paths[depth];
    push_frame();
    if (!get_path(path)) {
        return;
    }
    for (int i = 0; i < path->length; i++) {
        int value = path->cells[i].value;
        if (value != UNKNOWN) {
            set_cell(path->cells[i].cell, value);
            for (int j = i + 1; j < path->length; j++) {
                memcpy(&path[j - 1], &path[j], sizeof(path_cell));
            }
            path->length--;
        }
    }
    for (int i = 0; i < path->length; i++) {
        path->current[i] = UNKNOWN;
    }
    // path->run_before = false;
    int start_sp = sp;
    solve_path(depth, path, 0);
    while (sp > start_sp) {
        pop_frame();
    }
}

static void run_depth(int depth) {
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
    if (set_cells == unknown_cells) {
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
    actual_run_depth(depth);
}


#endif
