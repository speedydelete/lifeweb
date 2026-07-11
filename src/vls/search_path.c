
// path-based search method

#pragma once

#include "params2.h"
#if METHOD == METHOD_PATH

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"


// pls work
#define MAX_PATH_LENGTH (2 * (HEIGHT + WIDTH + 1))

typedef struct path_implic {
    index_t index;
    cell_value_t value;
} path_implic;

typedef struct path_cell {
    cell* cell;
    cell_value_t value;
    path_implic implics[2][MAX_PATH_LENGTH];
    int implics_count[2];
} path_cell;

typedef struct path {
    int length;
    path_cell cells[MAX_PATH_LENGTH];
    int current[MAX_PATH_LENGTH];
    // bool run_before;
    // int prev_run[SIZE];
} path;

path paths[TOTAL_MAX_DEPTH];


// fills in the given path
// returns false if contradiction, true if no contradiction
static inline bool get_path(path* path, bool is_initial) {
    DPRINTF3("Getting path\n");
    path->length = 0;
    if (is_initial) {
        // grab the initial path
        for (int i = 0; i < INITIAL_PATH_LENGTH; i++) {
            const index_t* value = initial_path[i];
            cell* cell = &grid[value[0]][value[2]][value[1]];
            if (cell->value != UNKNOWN) {
                continue;
            }
            path->cells[path->length++].cell = cell;
        }
    }
    if (!is_initial) {
        // figure out what cells the path consists of
        for (int y = TOP_OFFSET; y < HEIGHT - BOTTOM_OFFSET; y++) {
            for (int x = LEFT_OFFSET; x < WIDTH - RIGHT_OFFSET; x++) {
                cell* cell = &grid[SEARCH_T][y][x];
                if (cell->value != UNKNOWN) {
                    continue;
                }
                if (
                        (cell->y == TOP_OFFSET || cell->x == LEFT_OFFSET ? true : cell->nw->value == UNKNOWN)
                     && (cell->y == TOP_OFFSET ? true : cell->n->value == UNKNOWN)
                     && (cell->y == TOP_OFFSET || cell->x == WIDTH - RIGHT_OFFSET - 1 ? true : cell->ne->value == UNKNOWN)
                     && (cell->x == LEFT_OFFSET ? true : cell->w->value == UNKNOWN)
                     && (cell->x == WIDTH - RIGHT_OFFSET - 1 ? true : cell->e->value == UNKNOWN)
                     && (cell->y == HEIGHT - BOTTOM_OFFSET - 1 || cell->x == LEFT_OFFSET ? true : cell->sw->value == UNKNOWN)
                     && (cell->y == HEIGHT - BOTTOM_OFFSET - 1 ? true : cell->s->value == UNKNOWN)
                     && (cell->y == HEIGHT - BOTTOM_OFFSET - 1 || cell->x == WIDTH - RIGHT_OFFSET - 1 ? true : cell->se->value == UNKNOWN)
                    ) {
                    continue;
                }
                path->cells[path->length].cell = cell;
                path->length++;
            }
        }
    }
    // seriously
    if (path->length == 0) {
        print_solution(false);
        return false;
    }
    // get the implications
    for (int i = 0; i < path->length; i++) {
        DPRINTF3("Getting implications for path cell %i\n", i);
        #if DEBUG >= 3
        debug_depth++;
        #endif
        path_cell* cell = &path->cells[i];
        cell->implics_count[0] = 0;
        cell->implics_count[1] = 0;
        bool zero_possible = true;
        bool one_possible = true;
        for (int value = 0; value <= 1; value++) {
            DPRINTF3("Trying value of %i\n", value);
            push_frame();
            int start_sp = sp;
            if (!set_cell_and_propagate(cell->cell, value)) {
                DPRINTF3("Contradiction\n");
                DPRINTGRID3();
                if (value == 0) {
                    zero_possible = false;
                } else {
                    one_possible = false;
                }
            } else {
                DPRINTGRID3();
                for (int j = start_sp; j < sp; j++) {
                    stack_entry* entry = &stack[j];
                    for (int k = 0; k < path->length; k++) {
                        if (entry->cell == path->cells[k].cell) {
                            // check for own cell
                            if (cell->cell == entry->cell) {
                                continue;
                            }
                            // check for duplicate
                            bool found = false;
                            for (int m = 0; m < cell->implics_count[value]; m++) {
                                path_implic* implic = &cell->implics[value][m];
                                if (implic->index == k && implic->value == entry->cell->value) {
                                    found = true;
                                    break;
                                }
                            }
                            if (found) {
                                break;
                            }
                            // no duplicate, put it in
                            path_implic* implic = &cell->implics[value][cell->implics_count[value]++];
                            implic->index = k;
                            implic->value = entry->cell->value;
                            DPRINTF3("Implication found: %i = %i\n", k, entry->cell->value);
                            break;
                        }
                    }
                }
            }
            pop_frame();
        }
        DPRINTF3("zero_possible = %s, one_possible = %s\n", zero_possible ? "true" : "false", one_possible ? "true" : "false");
        // if it has to be a value (or can't be any value), do that
        if (!zero_possible && !one_possible) {
            DPRINTF3("Contradiction, returning\n");
            #if DEBUG >= 3
            debug_depth--;
            #endif
            return false;
        } else if (zero_possible && !one_possible) {
            cell->value = 0;
        } else if (one_possible && !zero_possible) {
            cell->value = 1;
        } else {
            cell->value = UNKNOWN;
        }
        #if DEBUG >= 3
        debug_depth--;
        #endif
    }
    #if DEBUG >= 3
    printf("Path (length %i):\n", path->length);
    for (int i = 0; i < path->length; i++) {
        path_cell* cell = &path->cells[i];
        printf("    %i: (%i, %i, %i): value = %i", i, cell->cell->x, cell->cell->y, cell->cell->t, cell->value);
        for (int value = 0; value <= 1; value++) {
            real_printf(", implications for %i: ", value);
            for (int j = 0; j < cell->implics_count[value]; j++) {
                path_implic* implic = &cell->implics[value][j];
                real_printf("%i = %i", implic->index, implic->value);
                if (j != cell->implics_count[value] - 1) {
                    real_printf(", ");
                }
            }
        }
        real_printf("\n");
    }
    printf("End path\n");
    #endif
    return true;
}

static void run_depth(int depth);

// apply a solved path and run it
static inline void run_solved_path(int depth, path* path) {
    bool contradiction = false;
    int start_sp = sp;
    int start_progress_pos = progress_pos;
    push_frame();
    for (int i = 0; i < path->length; i++) {
        int value = path->current[i];
        progress[progress_pos++] = value;
        if (!set_cell_and_propagate(path->cells[i].cell, value)) {
            #if DEBUG >= 3
            printf("Path solution failed while setting cell %i: ", i);
            for (int i = 0; i < path->length; i++) {
                real_printf("%c", path->current[i] ? '1' : '0');
            }
            real_printf("\n");
            #endif
            contradiction = true;
            break;
        }
    }
    progress_pos = start_progress_pos;
    if (!contradiction) {
        #if DEBUG >= 3
        printf("Path solution found: ");
        for (int i = 0; i < path->length; i++) {
            real_printf("%c", path->current[i] ? '1' : '0');
        }
        real_printf("\n");
        #endif
        run_depth(depth + 1);
    }
    while (sp > start_sp) {
        pop_frame();
    }
}

static void solve_path(int depth, path* path, int index) {
    #if DEBUG >= 3
    printf("Solving path (index = %i): ", index);
    for (int i = 0; i < path->length; i++) {
        real_printf("%c", path->current[i] == UNKNOWN ? '*' : (path->current[i] == 1 ? '1' : '0'));
    }
    real_printf("\n");
    debug_depth++;
    #endif
    if (path->current[index] != UNKNOWN) {
        if (index == path->length - 1) {
            run_solved_path(depth, path);
        } else {
            solve_path(depth, path, index + 1);
        }
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return;
    }
    path_cell* cell = &path->cells[index];
    int* prev = malloc(path->length * sizeof(int));
    INITIAL_VALUE_LOOP {
        memcpy(prev, path->current, path->length * sizeof(int));
        path->current[index] = value;
        bool contradiction = false;
        for (int i = 0; i < cell->implics_count[value]; i++) {
            path_implic* implic = &cell->implics[value][i];
            int prev_value = path->current[implic->index];
            if (prev_value != UNKNOWN && prev_value != implic->value) {
                contradiction = true;
                break;
            }
            path->current[implic->index] = implic->value;
        }
        if (!contradiction) {
            if (index == path->length - 1) {
                run_solved_path(depth, path);
            } else {
                solve_path(depth, path, index + 1);
            }
        }
        memcpy(path->current, prev, path->length * sizeof(int));
    }
    free(prev);
    #if DEBUG >= 3
    debug_depth--;
    #endif
}

static inline void actual_run_depth(int depth) {
    #if DEBUG >= 3
    debug_depth++;
    #endif
    path* path = &paths[depth];
    if (!get_path(path, depth == 0)) {
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return;
    }
    for (int i = 0; i < path->length; i++) {
        int value = path->cells[i].value;
        if (value != UNKNOWN) {
            DPRINTF3("Removing cell from path: i = %i, path->length = %i, value = %i\n", i, path->length, value);
            if (!set_cell_and_propagate(path->cells[i].cell, value)) {
                DPRINTF3("Contradiction\n");
                DPRINTGRID3();
                #if DEBUG >= 3
                debug_depth--;
                #endif
                return;
            }
            for (int j = i + 1; j < path->length; j++) {
                memcpy(&path->cells[j - 1], &path->cells[j], sizeof(path_cell));
            }
            i--;
            path->length--;
        }
    }
    // shortcut
    if (path->length <= 0) {
        DPRINTF3("Path solved in preprocessing\n");
        run_depth(depth + 1);
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return;
    }
    for (int i = 0; i < path->length; i++) {
        path->current[i] = UNKNOWN;
    }
    // path->run_before = false;
    solve_path(depth, path, 0);
    #if DEBUG >= 3
    debug_depth--;
    #endif
}

static void run_depth(int depth) {
    branches++;
    #if DEBUG >= 3
    debug_depth++;
    printf("Running depth %i: ", depth);
    print_progress(stdout);
    real_printf("\n");
    #endif
    branches++;
    if (depth > max_depth) {
        fprintf(stderr, "Error: This error should not occur (infinite recursion detected)\nPlease report this error\n");
        exit(1);
    }
    if (set_cells >= unknown_cells) {
        #ifndef BENCHMARK
        print_solution(false);
        #endif
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return;
    }
    #if CUSTOM_PRUNING
    if (!custom_prune()) {
        #if DEBUG >= 3
        debug_depth--;
        #endif
        return;
    }
    #endif
    DPRINTGRID3();
    print_state_if_needed();
    actual_run_depth(depth);
    #if DEBUG >= 3
    debug_depth--;
    #endif
}


#endif
