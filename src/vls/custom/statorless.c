
#pragma once

#include "../params2.h"
#include "../base.c"


#define CUSTOM_INIT false
#define CUSTOM_SOLUTION_FILTERING true
#define CUSTOM_PRUNING false
#define CUSTOM_PRUNING_ON_CELL_SET true


#if CUSTOM_INIT
static inline void custom_init(void) {

}
#endif

static inline bool is_statorless(Cell* cell) {
    if (cell->value != ON) {
        return true;
    }
    for (Index t = 0; t < GENS - 1; t++) {
        cell = cell->next;
        if (cell->value != ON) {
            return true;
        }
    }
    return false;
}

#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter(CellValue*** _) {
    for (Index y = 0; y < HEIGHT; y++) {
        for (Index x = 0; x < WIDTH; x++) {
            if (!is_statorless(&grid[0][x][y])) {
                return false;
            }
        }
    }
    return true;
}
#endif

#if CUSTOM_PRUNING
static inline bool custom_prune(void) {
    return true;
}
#endif


#if CUSTOM_PRUNING_ON_CELL_SET
static inline bool custom_prune_on_cell_set(Cell* cell) {
    return is_statorless(cell);
}
#endif
