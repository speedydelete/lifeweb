
#pragma once

#include <stdlib.h>

#include "../params2.h"
#include "../base.c"


#define CUSTOM_INIT true
#define CUSTOM_SOLUTION_FILTERING true
#define CUSTOM_PRUNING false
#define CUSTOM_PRUNING_ON_CELL_SET true


bool is_subperiod[1 << GENS];

#if CUSTOM_INIT
static inline void custom_init(void) {
    for (size_t value = 0; value < (1 << GENS); value++) {
        bool bits[GENS];
        for (int i = 0; i < GENS; i++) {
            bits[i] = (value >> i) & 1;
        }
        bool found = true;
        for (int period = 0; period < GENS; period++) {
            if (GENS % period != 0) {
                continue;
            }
            bool found2 = false;
            for (Index i = 0; i < period; i++) {
                for (Index t = i; t < GENS; t += period) {
                    if (bits[t] != bits[(t + period) % GENS]) {
                        found2 = true;
                        break;
                    }
                }
                if (found2) {
                    break;
                }
            }
            if (!found2) {
                found = false;
                break;
            }
        }
        is_subperiod[value] = found;
    }
}
#endif

static inline bool is_strictly_volatile(Cell* cell) {
    if (cell->value != ON) {
        return true;
    }
    size_t value = 0;
    for (Index t = 0; t < GENS; t++) {
        cell = cell->next;
        value |= cell->value == ON ? 1 : 0;
    }
    return !is_subperiod[value];
}

#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter(DynamicGrid _) {
    for (Index y = 0; y < HEIGHT; y++) {
        for (Index x = 0; x < WIDTH; x++) {
            if (!is_strictly_volatile(&grid[0][x][y])) {
                return false;
            }
        }
    }
    return true;
}
#endif

#if CUSTOM_PRUNING
static inline bool custom_prune(int depth, Cell* cell) {
    return true;
}
#endif


#if CUSTOM_PRUNING_ON_CELL_SET
static inline bool custom_prune_on_cell_set(Cell* cell) {
    return is_strictly_volatile(cell);
}
#endif
