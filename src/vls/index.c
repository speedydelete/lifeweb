
// defines main searching

// for checking static:
// \n(?!#|//|static|\n|    |\}|typedef)
// for checking inline:
// (?<=\n)static [^ (]+ (?!main|run_depth|set_cell|get_forward_big_tr|_get_possible_trs)[a-zA-Z_]+\(

#include <inttypes.h>
#include <stdio.h>
#include <sys/types.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "search.c"
#include "solutions.c"
#include "preprocess.c"


#if MULTI_RULE

typedef struct progress_entry {
    bool tr_is_set;
    int tr;
    int value;
} progress_entry;

progress_entry progress[TOTAL_MAX_DEPTH];

int tr_to_int_tr[512];

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < MAX_MAP_TRS_PER_INT_TR + 1; i++) {
        int16_t tr2 = int_transitions[tr_to_int_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        trs[tr2] = value;
        big_trs[TR_TO_BIG_TR(tr2)] = value;
    }
    for (int i = 0; i < MAX_MAP_TRS_PER_INT_TR + 1; i++) {
        int16_t tr2 = int_transitions[tr_to_int_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        uint32_t tr3 = TR_TO_BIG_TR((uint32_t)tr2) << 2;
        if (value == 3) {
            implications[tr3] = IMPLICATION_RULE_DEPENDANT;
            implications[tr3 | 1] = IMPLICATION_RULE_DEPENDANT;
        } else {
            implications[tr3] = get_implication(tr3);
            implications[tr3 | 1] = get_implication(tr3 | 1);
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
            fprintf(stderr, "\nError: This error should not occur (nonexistent transition in init_multi_rule: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
    for (int i = 0; i < TOTAL_MAX_DEPTH; i++) {
        progress[i].tr_is_set = false;
    }
}

static inline void print_progress(FILE* stream, int depth) {
    for (int i = 1; i < depth; i++) {
        if (progress[i].tr_is_set) {
            int tr = progress[i].tr;
            int value = progress[i].value;
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
                fprintf(stderr, "\nError: This error should not occur (nonexistent transition in print_progress: %i)\nPlease report this error\n", tr);
                exit(1);
            }
            real_fprintf(stream, "[%s=%i]", tr_str, value);
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
        #if SPECIAL_PHASE_0_POP
        if (!pop_frame()) {
            return;
        }
        #else
        pop_frame();
        #endif
        int32_t tr = rule_dependent_tr;
        rule_dependent_tr = -1;
        progress[depth].tr_is_set = true;
        progress[depth].tr = tr;
        DPRINTF3("Branching rule on transition %i (depth = %i)\n", tr, depth);
        progress[depth].value = 0;
        set_tr(tr, 0);
        run_depth(depth + 1, cell, value);
        progress[depth].value = 1;
        set_tr(tr, 1);
        run_depth(depth + 1, cell, value);
        set_tr(tr, 3);
        progress[depth].tr_is_set = false;
        return;
    #endif
    }
    #if SPECIAL_PHASE_0_POP
    if (!pop_frame()) {
        return;
    }
    #else
    pop_frame();
    #endif
}

static double last_progress_shown;
static double last_partial_shown;

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
    if (time - last_partial_shown > PARTIAL_REPORTING_INTERVAL) {
        last_partial_shown = time;
        printf("Current partial:\n");
        print_grid_2(depth, false);
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
        progress[depth].value = -1;
        actual_run_depth(depth, cell, force_value);
    }
    #endif
    #if DEBUG >= 3
    current_depth--;
    #endif
}


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
    // long value = 165378;
    // printf("%ld -> %i\n", value, get_implication(value));
    // exit(0);
    init_state();
    #if VARIABLES
    init_var_uses();
    #endif
    generate_big_trs();
    #if MULTI_RULE
    init_multi_rule();
    #endif
    init_known_solutions();
    preprocess();
    #if CUSTOM_INIT
    custom_init();
    #endif
    cell* initial_cell = add_search_orders();
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
    last_partial_shown = start;
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
    #endif
    return 0;
}
