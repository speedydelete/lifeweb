
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "base.c"
#include "dynamic_grid.c"
#include "implications.c"
#include "output.c"


bool pre_changes_made = false;


#define MAX_PREPROCESSING_ITERATIONS 4096

static inline void preprocess(void) {
    DPRINTGRID2();
    printf("Preprocessing\n");
    bool found = false;
    for (size_t i = 0; i < MAX_PREPROCESSING_ITERATIONS; i++) {
        pre_changes_made = false;
        // PREPROCESSING STUFF HERE
        if (!pre_changes_made) {
            found = true;
            break;
        }
    }
    if (!found) {
        unexpected_error("Preprocessing did not finish");
    }
    // DO PRINTF STATUS THING HERE
}
