
#pragma once

#include "../params2.h" // IWYU pragma: keep
#include "../base.c" // IWYU pragma: keep
#include "../dynamic_grid.c" // IWYU pragma: keep


const Index drifter_cells[][2] = {
    {9, 9},
    {9, 10},
    {9, 11},
    {10, 9},
    {10, 10},
    {10, 11},
    {11, 9},
    {11, 10},
    {11, 11},
};


#define CUSTOM_INIT true
#define CUSTOM_SOLUTION_FILTERING false
#define CUSTOM_PRUNING true
#define CUSTOM_PRUNING_ON_CELL_SET false


#if CUSTOM_INIT
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
    for (size_t i = 0; i < sizeof(drifter_cells) / sizeof(drifter_cells[0]); i++) {
        Index x = drifter_cells[i][0] + 2;
        Index y = drifter_cells[i][1] + 2;
        CellValue value1 = get_cell(0, x, y)->value;
        CellValue value2 = get_cell(1, x, y)->value;
        if (!(is_known(value1) && is_known(value2) && value1 == value2)) {
            return true;
        }
    }
    return false;
}
#endif


#if CUSTOM_PRUNING_ON_CELL_SET
static inline bool custom_prune_on_cell_set([[maybe_unused]] Cell* cell) {
    for (size_t i = 0; i < sizeof(drifter_cells) / sizeof(drifter_cells[0]); i++) {
        Index x = drifter_cells[i][0] + 2;
        Index y = drifter_cells[i][1] + 2;
        CellValue value1 = get_cell(0, x, y)->value;
        CellValue value2 = get_cell(1, x, y)->value;
        if (is_known(value1) && is_known(value2) && value1 != value2) {
            return true;
        }
    }
    return false;
}
#endif
