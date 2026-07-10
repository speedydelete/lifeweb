
// path-based search method

#pragma once

#include "params2.h"
#if METHOD == METHOD_PATH

#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"


// implications are negative if 0, positive if 1
typedef struct path_cell {
    cell* cell;
    int value;
    int implics[2][SIZE];
    int implics_count[2];
} path_cell;

typedef struct path {
    int count;
    path_cell cells[SIZE];
} path;

path paths[TOTAL_MAX_DEPTH];


// fills in the given path
// returns false if contradiction, true if no contradiction
static inline bool get_path(path* path) {
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            cell* cell = &grid[INITIAL_CELL_T][y][x];
            if (cell->value != UNKNOWN) {
                continue;
            }
            if (cell->nw->value == UNKNOWN && cell->n->value == UNKNOWN && cell->ne->value == UNKNOWN && cell->w->value == UNKNOWN && cell->e->value == UNKNOWN && cell->sw->value == UNKNOWN && cell->s->value == UNKNOWN && cell->se->value == UNKNOWN) {
                continue;
            }
            path_cell* value = &path->cells[path->count];
            value->cell = cell;
            path->count++;
        }
    }
    for (int i = 0; i < path->count; i++) {
        path_cell* cell = &path->cells[i];
        cell->implics_count[0] = 0;
        cell->implics_count[1] = 0;
        bool zero_possible = true;
        bool one_possible = true;
        // get the implications
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
                    for (int k = 0; k < path->count; k++) {
                        if (entry->cell == path->cells[k].cell) {
                            cell->implics[value][cell->implics_count[value]++] = entry->cell->value == 0 ? -k : k;
                            break;
                        }
                    }
                }
            }
            pop_frame();
        }
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

void run_depth(void) {
    
}


#endif
