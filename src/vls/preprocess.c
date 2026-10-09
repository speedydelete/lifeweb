
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "base.c"
#include "dynamic_grid.c"
#include "implications.c"
#include "output.c"


#define MAX_PREPROCESSING_ITERATIONS 4096

static inline void preprocess(void) {
    DPRINTGRID2();
    printf("Preprocessing\n");
    DynamicGrid old_grid = EMPTY_DYNAMIC_GRID;
    DynamicGrid new_grid = EMPTY_DYNAMIC_GRID;
    bool found = false;
    for (size_t i = 0; i < MAX_PREPROCESSING_ITERATIONS; i++) {
        dg_init_from_search_grid(&old_grid);
        // PREPROCESSING STUFF HERE
        dg_init_from_search_grid(&new_grid);
        if (dg_eq(&old_grid, &new_grid)) {
            found = true;
            break;
        }
    }
    if (!found) {
        fprintf(stderr, "Error: Preprocessing did not finish\n");
        exit(1);
    }
    dg_destroy(&old_grid);
    dg_destroy(&new_grid);
    // DO PRINTF STATUS THING HERE
}
