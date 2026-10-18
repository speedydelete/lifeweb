
#pragma once

#include "../params2.h" // IWYU pragma: keep
#include "../base.c" // IWYU pragma: keep
#include "../dynamic_grid.c" // IWYU pragma: keep


#define CUSTOM_INIT true
#define CUSTOM_DESTROY false
#define CUSTOM_SOLUTION_FILTERING false
#define CUSTOM_PRUNING false
#define CUSTOM_PRUNING_ON_CELL_SET false


#if CUSTOM_INIT
static inline void custom_init(void) {

}
#endif

#if CUSTOM_DESTROY
static inline void custom_init(void) {

}
#endif

#if CUSTOM_SOLUTION_FILTERING
static inline bool custom_solution_filter([[maybe_unused]] DynamicGrid grid) {
    return true;
}
#endif

#if CUSTOM_PRUNING
static inline bool custom_prune([[maybe_unused]] Depth depth, [[maybe_unused]] Cell* cell) {
    return true;
}
#endif


#if CUSTOM_PRUNING_ON_CELL_SET
static inline bool custom_prune_on_cell_set([[maybe_unused]] Cell* cell) {
    return true;
}
#endif
