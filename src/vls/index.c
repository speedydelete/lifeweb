
// defines main searching

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


int main(void) {
    // for (int tr = 0; tr < 262144; tr++) {
    //     big_trs[tr] = get_big_tr(0, tr, 0);
    // }
    // // long value = strtol(
    // //     "00" "10" "10"
    // //     "00" "00" "00"
    // //     "00" "00" "00"
    // //     "10"
    // // , NULL, 2);
    // long value = 167702;
    // printf("%ld -> %i\n", value, get_implication(value));
    // exit(0);
    init_state();
    #if VARIABLES
    init_var_uses();
    #endif
    generate_big_trs();
    #if MULTI_RULE
    init_tr_to_bound_tr();
    #endif
    init_known_solutions();
    preprocess();
    #if CUSTOM_INIT
    custom_init();
    #endif
    #if METHOD == CELL
    cell* initial_cell = add_search_orders();
    #endif
    DPRINTGRID1();
    #ifdef LLS
    #ifndef RULE
    #error LLS mode is not supported with multi-rule searching yet
    #else
    #if VARIABLES
    static const char* lls_letters = "abcdefghikjlmnopqrstuvwxyz0123456";
    #endif
    FILE* input_file;
    input_file = fopen(".lls_input_file.csv", "w");
    if (input_file == NULL) {
        perror("Error opening LLS input file");
    }
    for (index_t t = 0; t < GENS; t++) {
        fputs("0,", input_file);
        for (index_t x = LEFT == NONE ? 2 : 0; x < WIDTH - (RIGHT == NONE ? 2 : 0); x++) {
            fputs("0,", input_file);
        }
        fputs("0\n", input_file);
        for (index_t y = TOP == NONE ? 2 : 0; y < HEIGHT - (BOTTOM == NONE ? 2 : 0); y++) {
            fputs("0,", input_file);
            for (index_t x = LEFT == NONE ? 2 : 0; x < WIDTH - (RIGHT == NONE ? 2 : 0); x++) {
                cell_value_t value = grid[t][y][x].value;
                if (value == 0) {
                    putc('0', input_file);
                } else if (value == 1) {
                    putc('1', input_file);
                } else {
                    #if VARIABLES
                    var_t var = grid[t][y][x].var;
                    if (var == 0) {
                        putc('*', input_file);
                    } else {
                        while (var > 32) {
                            putc(lls_letters[var & 31], input_file);
                            var >>= 5;
                        }
                        putc(lls_letters[var], input_file);
                    }
                    #else
                    putc('*', input_file);
                    #endif
                }
                putc(',', input_file);
            }
            fputs("0\n", input_file);
        }
        fputs("0,", input_file);
        for (index_t x = LEFT == NONE ? 2 : 0; x < WIDTH - (RIGHT == NONE ? 2 : 0); x++) {
            fputs("0,", input_file);
        }
        fputs("0\n", input_file);
        putc('\n', input_file);
    }
    fclose(input_file);
    char* command = LLS
        #if CHECK_EMPTY
        " -c"
        #endif
        " -r '"RULE"'"
        " .lls_input_file.csv"
        #ifdef MAX_SOLUTIONS
        " -n '"MAX_SOLUTIONS"'"
        #else
        " -n"
        #endif
    ;
    printf("%s\n", command);
    return system(command);
    #endif
    #endif
    printf("Running search\n");
    #if DEBUG >= 2
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
    start = get_time();
    last_progress_shown = start;
    last_max_partial_shown = start;
    #ifdef BENCHMARK
    for (int i = 0; i < BENCHMARK; i++) {
        double start = get_time();
        #if MULTI_RULE
        run_depth(1, initial_cell, -1);
        #else
        run_depth(1, initial_cell);
        #endif
        printf("Iteration %i/%i complete in %.6f seconds\n", i + 1, BENCHMARK, get_time() - start);
    }
    double time = get_time() - start;
    printf("%i iterations complete in %.6f seconds, average %.6f seconds/iteration\n", BENCHMARK, time, time / BENCHMARK);
    #else
    #if MULTI_RULE
    run_depth(1, initial_cell, -1);
    #else
    run_depth(1, initial_cell);
    #endif
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    if (solutions_found == 0) {
        #if MULTI_RULE
        memcpy(trs, max_partial_trs, sizeof(trs));
        #endif
        printf("Max partial (%i known cells):\n", max_partial_set_cells);
        print_grid_2(max_partial, 0, false);
    }
    #endif
    return 0;
}
