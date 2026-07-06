
#include <inttypes.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "solutions.c"


#if MULTI_RULE

typedef struct progress_entry {
    bool tr_is_set;
    int tr;
    int value;
} progress_entry;

progress_entry progress[TOTAL_MAX_DEPTH];

static inline void print_progress(FILE* stream, int depth) {
    for (int i = 1; i < depth; i++) {
        if (progress[i].tr_is_set) {
            int tr = progress[i].tr;
            int value = progress[i].value;
            real_fprintf(stream, "[%s=%i]", bound_trs_names[tr_to_bound_tr[tr]], value);
        } else {
            int value = progress[i].value;
            if (value == -1) {
                continue;
            } else if (value == 0) {
                real_fprintf(stream, "0");
            } else if (value == 1) {
                real_fprintf(stream, "1");
            }
        }
    }
}

#else

int progress[TOTAL_MAX_DEPTH];

static inline void print_progress(FILE* stream, int depth) {
    for (int i = 1; i < depth; i++) {
        int value = progress[i];
        // if (i == depth - 1) {
        //     real_fprintf(stream, "%i", value);
        // } else {
        //     real_fprintf(stream, "%i ", value);
        // }
        if (value == -1) {
            continue;
        } else if (value == 0) {
            real_fprintf(stream, "0");
        } else if (value == 1) {
            real_fprintf(stream, "1");
        }
    }
}

#endif


static void run_depth(int depth, cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    );

static inline void actual_run_depth(int depth, cell* cell, cell_value_t value) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_frame();
    #if DEBUG >= 6
    print_stack();
    #endif
    if (set_cell_and_propagate(cell, value)) {
        #if MULTI_RULE
        run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        run_depth(depth + 1, cell->next_in_search_order);
        #endif
    #if MULTI_RULE
    } else if (rule_dependent_tr != -1) {
        pop_frame();
        int32_t tr = rule_dependent_tr;
        rule_dependent_tr = -1;
        progress[depth + 1].tr_is_set = true;
        progress[depth + 1].tr = tr;
        DPRINTF3("Branching rule on transition %i (aka %s), (depth = %i)\n", tr, bound_trs_names[tr_to_bound_tr[tr]], depth);
        progress[depth + 1].value = 0;
        set_tr(tr, 0);
        run_depth(depth + 1, cell, value);
        progress[depth + 1].value = 1;
        set_tr(tr, 1);
        run_depth(depth + 1, cell, value);
        set_tr(tr, 3);
        progress[depth + 1].tr_is_set = false;
        return;
    #endif
    }
    pop_frame();
}

double last_progress_shown;
double last_max_partial_shown;
cell max_partial[GENS][HEIGHT][WIDTH];
index_t max_partial_set_cells;
#if MULTI_RULE
cell_value_t max_partial_trs[512];
#endif
index_t last_printed_max_partial_set_cells;

static void run_depth(int depth, cell* cell
    #if MULTI_RULE
    , int force_value
    #endif
    ) {
    #if DEBUG >= 3
    current_depth++;
    printf("Running depth %i: ", depth);
    print_progress(stdout, depth);
    real_printf("\n");
    #endif
    branches++;
    if (depth > max_depth) {
        fprintf(stderr, "\nError: This error should not occur (infinite recursion detected)\nPlease report this error\n");
        exit(1);
    }
    if (depth > max_depth || set_cells == unknown_cells) {
        #ifndef BENCHMARK
        print_solution(false, depth);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    #if CUSTOM_PRUNING
    if (!custom_prune()) {
        return;
    }
    #endif
    DPRINTGRID3();
    #ifndef BENCHMARK
    double time = get_time();
    if (time - last_progress_shown > REPORTING_INTERVAL) {
        last_progress_shown = time;
        printf("%i seconds, %"PRIu64" branches, %"PRIu64" solutions, progress: ", (int)(time - start), branches, solutions_found);
        print_progress(stdout, depth);
        real_printf("\n");
    }
    if (set_cells > max_partial_set_cells) {
        memcpy(max_partial, grid, sizeof(grid));
        max_partial_set_cells = set_cells;
        #if MULTI_RULE
        memcpy(max_partial_trs, trs, sizeof(trs));
        #endif
    }
    if (time - last_max_partial_shown > MAX_PARTIAL_REPORTING_INTERVAL && max_partial_set_cells > last_printed_max_partial_set_cells) {
        last_max_partial_shown = time;
        last_printed_max_partial_set_cells = max_partial_set_cells;
        #if MULTI_RULE
        cell_value_t* temp_trs = malloc(sizeof(trs));
        memcpy(temp_trs, trs, sizeof(trs));
        memcpy(trs, max_partial_trs, sizeof(trs));
        #endif
        printf("New max partial (%i known cells):\n", max_partial_set_cells);
        print_grid_2(max_partial, depth, false);
        #if MULTI_RULE
        memcpy(trs, temp_trs, sizeof(trs));
        free(temp_trs);
        #endif
    }
    #endif
    if (cell->value != UNKNOWN) {
        DPRINTF3("Cell is known, continuing\n");
        #if MULTI_RULE
        progress[depth].value = -1;
        run_depth(depth + 1, cell->next_in_search_order, -1);
        #else
        progress[depth] = -1;
        run_depth(depth + 1, cell->next_in_search_order);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    #if MULTI_RULE
    if (force_value == -1) {
    #endif
        #if INITIAL_VALUE == 0
        for (int value = 0; value < 2; value++)
        #else
        for (int value = 1; value >= 0; value--)
        #endif
        {
            #if MULTI_RULE
            progress[depth].value = value;
            actual_run_depth(depth, cell, value);
            #else
            progress[depth] = value;
            actual_run_depth(depth, cell, value);
            #endif
        }
    #if MULTI_RULE
    } else {
        actual_run_depth(depth, cell, force_value);
    }
    #endif
    #if DEBUG >= 3
    current_depth--;
    #endif
}
