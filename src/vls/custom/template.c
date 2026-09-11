
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

#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter(CellValue*** grid) {
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
    return true;
}
#endif
