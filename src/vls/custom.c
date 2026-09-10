
#pragma once

#include "params2.h"
#include "base.c"


#define CUSTOM_INIT false
#define CUSTOM_SOLUTION_FILTERING true
#define CUSTOM_PRUNING false
#define CUSTOM_PRUNING_ON_CELL_SET true


static inline bool is_statorless(cell* cell) {
    if (cell->value != ON) {
        return true;
    }
    for (index_t t = 0; t < GENS - 1; t++) {
        cell = cell->next;
        if (cell->value != ON) {
            return true;
        }
    }
    DPRINTF4("Pruned: t = %i, x = %i, y = %i, last_gen_value = %i, cell->value = %i\n", cell->t, cell->x, cell->y, cell->value, last_gen_value);
    DPRINTGRID4();
    return false;
}

#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter() {
    for (index_t y = 0; y < HEIGHT; y++) {
        for (index_t x = 0; x < WIDTH; x++) {
            if (!is_statorless(&grid[0][x][y])) {
                return false;
            }
        }
    }
    return true;
}
#endif

#if CUSTOM_PRUNING
static inline bool custom_prune() {
    return true;
}
#endif

#if CUSTOM_PRUNING_ON_CELL_SET
static inline bool custom_prune_on_cell_set(cell* cell) {
    return is_statorless(cell);
}
#endif
