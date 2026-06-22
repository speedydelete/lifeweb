
// defines main searching

// for checking static:
// \n(?!#|//|static|\n|    |\}|typedef)
// for checking inline:
// (?<=\n)static [^ (]+ (?!main|run_depth|set_cell|get_forward_big_tr|_get_possible_trs)[a-zA-Z_]+\(

#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "search.c"
#include "solutions.c"
#include "preprocess.c"


static inline double get_time() {
    return (double)(clock()) / CLOCKS_PER_SEC;
}

static double start;
static double last_progress_shown;

static int progress[TOTAL_MAX_DEPTH];

#if MULTI_RULE

typedef struct set_tr_info {
    bool set;
    int cell;
    int tr;
    int value;
} set_tr_info;

static set_tr_info set_tr_info_for_depth[TOTAL_MAX_DEPTH];

static int tr_to_int_tr[512];

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < MAX_MAP_TRS_PER_INT_TR + 1; i++) {
        int tr2 = int_transitions[tr_to_int_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        trs[tr2] = value;
    }
    for (int tr = 0; tr < 262144; tr++) {
        if (big_trs_forward[tr] == 3 || big_trs_forward[tr] >= 4) {
            int value = get_forward_big_tr(0, tr, 0);
            if (value < 4) {
                value += 4;
            }
            big_trs_forward[tr] = value;
        }
    }
}

static inline void init_multi_rule() {
    for (int tr = 0; tr < 512; tr++) {
        bool found = false;
        for (int i = 0; i < INT_TRANSITION_COUNT; i++) {
            for (int j = 0; j < INT_NUMBER_COUNT; j++) {
                int value = int_transitions[i][j];
                if (value == -1) {
                    break;
                } else if (value == tr) {
                    found = true;
                    break;
                }
            }
            if (found) {
                tr_to_int_tr[tr] = i;
                break;
            }
        }
        if (!found) {
            fprintf(stderr, "\nError: This error should not occur (nonexistent transition: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
    for (int i = 0; i < TOTAL_MAX_DEPTH; i++) {
        set_tr_info_for_depth[i].set = false;
    }
}

static inline void print_progress(FILE* stream, int depth) {
    for (int i = 0; i < depth - 1; i++) {
        if (set_tr_info_for_depth[i].set) {
            int tr = set_tr_info_for_depth[i].tr;
            int value = set_tr_info_for_depth[i].value;
            char tr_str[4];
            if (tr & (1 << 4)) {
                tr &= ~(1 << 4);
                tr_str[0] = 'S';
            } else {
                tr_str[0] = 'B';
            }
            int index = 0;
            bool found = false;
            for (int i = 0; i < 9; i++) {
                for (int j = 0; j < 14; j++) {
                    char letter = int_letters[i][j];
                    if (letter == 0) {
                        break;
                    }
                    for (int k = 0; k < 9; k++) {
                        if (tr == int_transitions[index][k]) {
                            found = true;
                            tr_str[1] = i + '0';
                            tr_str[2] = letter;
                            tr_str[3] = '\0';
                            break;
                        }
                    }
                    if (found) {
                        break;
                    }
                    index++;
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                fprintf(stderr, "\nError: This error should not occur (nonexistent transition: %i)\nPlease report this error\n", tr);
                exit(1);
            }
            real_fprintf(stream, "[%s=%i]", tr_str, value);
        } else {
            int value = progress[i];
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

static void run_depth(int depth
    #if MULTI_RULE
    , int search_order_depth, int force_value
    #endif
    );

static inline void actual_run_depth(cell* cell, cell_value_t value, int depth
    #if MULTI_RULE
    , int search_order_depth
    #endif
    ) {
    DPRINTF3("Attempting to set cell: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    push_frame();
    #if DEBUG >= 6
    print_stack();
    #endif
    if (set_cell_and_propagate(cell, value)) {
        #if MULTI_RULE
        run_depth(depth + 1, search_order_depth + 1, -1);
        #else
        run_depth(depth + 1);
        #endif
    #if MULTI_RULE
    } else if (rule_dependent_tr != -1) {
        pop_frame();
        int tr = rule_dependent_tr;
        rule_dependent_tr = -1;
        // if (possible_trs_count == 0) {
        //     DPRINTF4("Skipping branching rule on transition %i (depth = %i)\n", tr, depth);
        //     continue;
        // }
        set_tr_info_for_depth[depth].set = true;
        set_tr_info_for_depth[depth].tr = tr;
        DPRINTF3("Branching rule on transition %i (depth = %i)\n", tr, depth);
        set_tr_info_for_depth[depth].value = 0;
        set_tr(tr, 0);
        run_depth(depth + 1, search_order_depth, value);
        set_tr_info_for_depth[depth].value = 1;
        set_tr(tr, 1);
        run_depth(depth + 1, search_order_depth, value);
        set_tr(tr, 3);
        set_tr_info_for_depth[depth].set = false;
        return;
    #endif
    }
    pop_frame();
}

static void run_depth(int depth
    #if MULTI_RULE
    , int search_order_depth, int force_value
    #endif
    ) {
    #if DEBUG >= 3
    current_depth++;
    printf("Running depth %i: ", depth);
    print_progress(stdout, depth);
    real_printf("\n");
    #endif
    branches++;
    if (depth > max_depth || set_cells == unknown_cells) {
        #ifndef BENCHMARK
        print_solution(false, depth);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    DPRINTGRID3();
    double time = get_time();
    if (time - last_progress_shown > REPORTING_INTERVAL) {
        last_progress_shown = time;
        #ifndef BENCHMARK
        printf("%i seconds, %"PRIu64" branches, %"PRIu64" solutions, progress: ", (int)(time - start), branches, solutions_found);
        print_progress(stdout, depth);
        real_printf("\n");
        #endif
    }
    #if MULTI_RULE
    int* cell_coords = search_order[search_order_depth];
    #else
    int* cell_coords = search_order[depth - 1];
    cell* cell = &grid[cell_coords[0]][cell_coords[2]][cell_coords[1]];
    #endif
    if (IS_KNOWN(cell->value)) {
        DPRINTF3("Cell is known, continuing\n");
        progress[depth] = -1;
        #if MULTI_RULE
        run_depth(depth + 1, search_order_depth + 1, -1);
        #else
        run_depth(depth + 1);
        #endif
        #if DEBUG >= 3
        current_depth--;
        #endif
        return;
    }
    #if MULTI_RULE
    if (force_value == -1) {
    #endif
        progress[depth] = 0;
        #if INITIAL_VALUE == 0
        for (int value = 0; value < 2; value++)
        #else
        for (int value = 1; value >= 0; value--)
        #endif
        {
            #if MULTI_RULE
            actual_run_depth(cell, value, depth, search_order_depth);
            #else
            actual_run_depth(cell, value, depth);
            #endif
            progress[depth] = 1;
        }
    #if MULTI_RULE
    } else {
        progress[depth] = -1;
        actual_run_depth(cell, force_value, depth, search_order_depth);
    }
    #endif
    #if DEBUG >= 3
    current_depth--;
    #endif
}


int main(void) {
    // for (int tr = 0; tr < 262144; tr++) {
    //     big_trs_forward[tr] = get_forward_big_tr(0, tr, 0);
    // }
    // long value = strtol(
    //     "00" "01" "10"
    //     "00" "00" "00"
    //     "00" "00" "00"
    //     "01"
    // , NULL, 2);
    // printf("%ld -> %i\n", value, get_backward_big_tr(value));
    // exit(0);
    init_state();
    init_var_uses();
    generate_big_trs();
    #if MULTI_RULE
    init_multi_rule();
    #endif
    init_known_solutions();
    preprocess();
    #ifdef LLS
    #ifndef RULE
    #error LLS mode is not supported with multi-rule searching yet
    #else
    static const char* lls_letters = "abcdefghikjlmnopqrstuvwxyz0123456";
    FILE* input_file;
    input_file = fopen(".lls_input_file.csv", "w");
    if (input_file == NULL) {
        perror("Error opening LLS input file");
    }
    for (int t = 0; t < GENS; t++) {
        for (int y = TOP == NONE ? 2 : 0; y < HEIGHT - (BOTTOM == NONE ? 2 : 0); y++) {
            for (int x = LEFT == NONE ? 2 : 0; x < WIDTH - (RIGHT == NONE ? 2 : 0); x++) {
                cell_t value = grid[t][y][x];
                if (value == 0) {
                    fprintf(input_file, "0");
                } else if (value == 1) {
                    fprintf(input_file, "1");
                } else if (value == 2) {
                    fprintf(input_file, "*");
                } else {
                    value = CELL_VAR_TO_VAR(value);
                    while (value > 32) {
                        fprintf(input_file, "%c", lls_letters[value & 31]);
                        value >>= 5;
                    }
                    fprintf(input_file, "%c", lls_letters[value]);
                }
                if (x != WIDTH - 1) {
                    fprintf(input_file, ",");
                }
            }
            fprintf(input_file, "\n");
        }
        fprintf(input_file, "\n");
    }
    fclose(input_file);
    return system(
        LLS
        " .lls_input_file.csv"
        #if CHECK_EMPTY
        " -c"
        #endif
        " -r '"RULE"'"
        #ifdef MAX_SOLUTIONS
        " -n '"MAX_SOLUTIONS"'"
        #else
        " -n"
        #endif
    );
    #endif
    #endif
    // long value = strtol(
    //     "01" "01" "01"
    //     "10" "01" "10"
    //     "10" "10" "10"
    //     "01"
    // , NULL, 2);
    // printf("%ld -> %i\n", value, big_trs_backward[value]);
    printf("Running search\n");
    DPRINTGRID1();
    #if DEBUG >= 2
    printf("Search order:\n");
    for (int i = 0; i < unknown_cells; i++) {
        int t = search_order[i][0];
        int x = search_order[i][1];
        int y = search_order[i][2];
        printf("t = %i, x = %i, y = %i, value = ", t, x, y);
        print_cell(stdout, grid[t][y][x].value);
        printf("\n");
    }
    #endif
    start = get_time();
    last_progress_shown = start;
    #ifdef BENCHMARK
    for (int i = 0; i < BENCHMARK; i++) {
        double start = get_time();
        #if MULTI_RULE
        run_depth(1, 0, -1);
        #else
        run_depth(1);
        #endif
        printf("Iteration %i/%i complete in %.6f seconds\n", i + 1, BENCHMARK, get_time() - start);
    }
    double time = get_time() - start;
    printf("%i iterations complete in %.6f seconds, average %.6f seconds/iteration\n", BENCHMARK, time, time / BENCHMARK);
    #else
    #if MULTI_RULE
    run_depth(1, 0, -1);
    #else
    run_depth(1);
    #endif
    printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches\n", solutions_found, get_time() - start, branches);
    #endif
    return 0;
}
