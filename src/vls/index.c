
// defines main searching

#define _POSIX_C_SOURCE 199309L

#include <inttypes.h>
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "output.c"
#include "preprocess.c"

#if METHOD == METHOD_CELL
#include "search_cell.c"
#elif METHOD == METHOD_PATH
#include "search_path.c"
#else
#error "Invalid method"
#endif


#ifdef FOR_PROFILE
#include <signal.h>
static void handle_sigterm(int signum) {
    (void)signum;
    extern int __llvm_profile_write_file(void);
    __llvm_profile_write_file(); 
    exit(0);
}
#endif

int main(void) {
    #ifdef IMPLICATION_CHECK_TR
    generate_implications();
    printf("%i -> %i\n", IMPLICATION_CHECK_TR, implications[IMPLICATION_CHECK_TR]);
    exit(0);
    #elifdef OT_IMPLICATION_CHECK_TR
    generate_implications();
    printf("%i -> %i\n", OT_IMPLICATION_CHECK_TR, ot_implications[OT_IMPLICATION_CHECK_TR]);
    exit(0);
    #endif
    calibrate_time();
    #ifdef FOR_PROFILE
    signal(SIGTERM, handle_sigterm);
    #endif
    init_state();
    #if VARIABLES
    init_var_uses();
    #endif
    generate_implications();
    #if MULTI_RULE
    init_tr_to_bound_tr();
    #endif
    init_known_solutions();
    preprocess();
    #if CUSTOM_INIT
    custom_init();
    #endif
    #if METHOD == CELL
    add_search_orders();
    #endif
    DPRINTGRID1();
    #if DEBUG >= 2 && METHOD == METHOD_CELL
    printf("Search order:\n");
    for (index_t i = 0; i < unknown_cells; i++) {
        int t = search_order[i][0];
        int x = search_order[i][1];
        int y = search_order[i][2];
        cell* cell = &grid[t][y][x];
        printf("t = %i, x = %i, y = %i, value = ", t, x, y);
        #if VARIABLES
        print_cell(stdout, cell->value, cell->var);
        #else
        print_cell(stdout, cell->value);
        #endif
        printf("\n");
    }
    #endif
    printf("Running search\n");
    start = get_time();
    last_progress_shown = start;
    #if MAX_PARTIALS
    last_max_partial_shown = start;
    #endif
    #ifdef BENCHMARK
    for (int i = 0; i < BENCHMARK; i++) {
        double start = get_time();
        #if METHOD == METHOD_CELL
        #if MULTI_RULE
        run_depth(0, initial_cell, -1);
        #else
        run_depth(0, initial_cell);
        #endif
        #else
        run_depth(0);
        #endif
        printf("Iteration %i/%i complete in %.6f seconds\n", i + 1, BENCHMARK, get_time() - start);
    }
    double time = get_time() - start;
    printf("%i iterations complete in %.6f seconds, average %.6f seconds/iteration\n", BENCHMARK, time, time / BENCHMARK);
    #else
    #if METHOD == METHOD_CELL
    #if MULTI_RULE
    run_depth(0, initial_cell, -1);
    #else
    run_depth(0, initial_cell);
    #endif
    #else
    run_depth(0);
    #endif
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #if MAX_PARTIALS
    if (solutions_found == 0) {
        #if MULTI_RULE
        memcpy(trs, max_partial_trs, sizeof(trs));
        #endif
        #if MAX_PARTIALS
        printf("Max partial (size: %i):\n", max_partial_size);
        print_grid_pretty(max_partial, false);
        #endif
    }
    #endif
    #endif
    return 0;
}
