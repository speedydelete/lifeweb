
// defines a preprocessor for restricting the search state

#pragma once

#include <stdlib.h>
#include <string.h>

#include "params2.h"
#include "base.c"
#include "search.c"


// runs implications
static inline void preprocess_implications(void) {
    DPRINTF3("Running implications\n");
    DPRINTGRID3();
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = 1; y < HEIGHT - 1; y++) {
            for (index_t x = 1; x < WIDTH - 1; x++) {
                cell* cell = &grid[t][y][x];
                if (!check_forward_implication(cell)) {
                    #if MULTI_RULE
                    if (rule_dependent_tr != -1) {
                        rule_dependent_tr = 0;
                        continue;
                    }
                    #endif
                    printf("Contradiction found in preprocessing (in forward step, cell at t = %i, x = %i, y = %i)\n", t, x - (LEFT == NONE ? 2 : 1), y - (TOP == NONE ? 2 : 1));
                    exit(0);
                }
                #if CHECK_BACKWARDS_IMPLICATIONS
                if (!check_backward_implication(cell)) {
                    printf("Contradiction found in preprocessing (in backward step, cell at t = %i, x = %i, y = %i)\n", t, x - (LEFT == NONE ? 2 : 1), y - (TOP == NONE ? 2 : 1));
                    exit(0);
                }
                #endif
            }
        }
    }
}


typedef struct case_cell_t {
    cell_value_t value;
    var_t var;
} case_cell_t;

static inline void reassign_variable(var_t old, var_t new, case_cell_t* cases, size_t cases_size) {
    if (old == new) {
        return;
    }
    DPRINTF2("Reassigning %i to %i\n", old, new);
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = 0; y < HEIGHT; y++) {
            for (index_t x = 0; x < WIDTH; x++) {
                cell* cell = &grid[t][y][x];
                if (cell->var == old) {
                    cell->var = new;
                    var_uses[new][num_var_uses[new]++] = cell;
                }
            }
        }
    }
    for (size_t i = 0; i < cases_size; i++) {
        if (cases[i].var == old) {
            cases[i].var = new;
        }
    }
}

// check for duplicates of cases including variables
// and reassign those variables to be equal
static inline void preprocess_cases(void) {
    DPRINTF3("Running cases\n");
    DPRINTGRID3();
    case_cell_t cases[TOTAL_SIZE * 8][10];
    int case_count = 0;
    // first compute the cases
    for (index_t t = 0; t < GENS - 1; t++) {
        for (index_t y = 1; y < HEIGHT - 1; y++) {
            for (index_t x = 1; x < WIDTH - 1; x++) {
                cell* cell = &grid[t][y][x];
                // filter out where the cell value is unknown
                if (cell->value == UNKNOWN && cell->var == 0) {
                    continue;
                }
                case_cell_t cells[10];
                bool found = false;
                int i = 0;
                for (int y2 = -1; y2 <= 1; y2++) {
                    for (int x2 = -1; x2 <= 1; x2++) {
                        struct cell* cell2 = &grid[t][y + y2][x + x2];
                        cells[i].value = cell2->value;
                        cells[i].var = cell2->var;
                        i++;
                        if (cell2->var > 0) {
                            found = true;
                        }
                    }
                }
                struct cell* next_cell = &grid[t + 1][y][x];
                cells[9].value = next_cell->value;
                cells[9].var = next_cell->var;
                if (next_cell->var > 0) {
                    found = true;
                }
                if (!found) {
                    return;
                }
                // assign all rotations and reflections of the case too
                for (int i = 0; i < 2; i++) {
                    for (int j = 0; j < 4; j++) {
                        memcpy(cases[case_count], cells, sizeof(cells));
                        case_count++;
                        case_cell_t temp[10] = {
                            cells[6], cells[3], cells[0],
                            cells[7], cells[4], cells[1],
                            cells[8], cells[5], cells[2],
                            cells[9],
                        };
                        memcpy(cells, temp, sizeof(cells));
                    }
                    case_cell_t temp[10] = {
                        cells[2], cells[1], cells[0],
                        cells[5], cells[4], cells[3],
                        cells[8], cells[7], cells[6],
                        cells[9],
                    };
                    memcpy(cells, temp, sizeof(cells));
                }
            }
        }
    }
    // now apply the cases
    for (index_t t = 0; t < GENS - 1; t++) {
        for (index_t y = 1; y < HEIGHT - 1; y++) {
            for (index_t x = 1; x < WIDTH - 1; x++) {
                case_cell_t cells[10];
                bool found = false;
                int i = 0;
                for (int y2 = -1; y2 <= 1; y2++) {
                    for (int x2 = -1; x2 <= 1; x2++) {
                        struct cell* cell2 = &grid[t][y + y2][x + x2];
                        cells[i].value = cell2->value;
                        cells[i].var = cell2->var;
                        i++;
                        if (cell2->var > 0) {
                            found = true;
                        }
                    }
                }
                struct cell* next_cell = &grid[t + 1][y][x];
                cells[9].value = next_cell->value;
                cells[9].var = next_cell->var;
                if (next_cell->var > 0) {
                    found = true;
                }
                if (!found) {
                    return;
                }
                for (int i = 0; i < case_count; i++) {
                    if (memcmp(cases[i], cells, sizeof(cell_value_t) * 9) == 0) {
                        case_cell_t new_cell = cases[i][9];
                        if (IS_KNOWN(next_cell->value)) {
                            if (IS_KNOWN(new_cell.value)) {
                                if (next_cell->value != new_cell.value) {
                                    printf("Contradiction found in preprocessing (in case step, cell at t = %i, x = %i, y = %i)\n", t, x - (LEFT == NONE ? 2 : 1), y - (TOP == NONE ? 2 : 1));
                                }
                            } else {
                                continue;
                            }
                        } else {
                            // sanity check
                            if (new_cell.var == 0) {
                                fprintf(stderr, "\nError: This error should not occur (new_cell.var == 0 but new_cell.value == UNKNOWN)\nPlease report this error\n");
                                exit(1);
                            }
                            if (next_cell->var == 0) {
                                // it was unknown, now we know it must be a certain variable
                                var_t var = new_cell.var;
                                next_cell->var = var;
                                var_uses[var][num_var_uses[var]++] = next_cell;
                            } else {
                                // now we reassign all uses of the variable!
                                reassign_variable(next_cell->var, new_cell.var, (case_cell_t*)cases, case_count);
                            }
                        }
                    }
                }
            }
        }
    }
}

static inline void preprocess(void) {
    DPRINTGRID2();
    printf("Preprocessing\n");
    cell_value_t old_grid[TOTAL_SIZE];
    cell_value_t new_grid[TOTAL_SIZE];
    for (index_t i = 0; i < TOTAL_SIZE; i++) {
        old_grid[i] = ((cell*)grid)[i].value;
    }
    bool found = false;
    for (int i = 0; i < 4096; i++) {
        preprocess_implications();
        preprocess_cases();
        for (index_t i = 0; i < TOTAL_SIZE; i++) {
            new_grid[i] = ((cell*)grid)[i].value;
        }
        if (memcmp(old_grid, new_grid, sizeof(old_grid)) == 0) {
            found = true;
            break;
        }
        memcpy(old_grid, new_grid, sizeof(old_grid));
    }
    if (!found) {
        fprintf(stderr, "Error: Preprocessing did not finish\n");
        exit(1);
    }
    // remove trivial cells from search order
    for (index_t i = 0; i < unknown_cells; i++) {
        index_t* cell = search_order[i];
        if (IS_KNOWN(grid[cell[0]][cell[2]][cell[1]].value)) {
            for (index_t j = i; j < unknown_cells - 1; j++) {
                memcpy(search_order[j], search_order[j + 1], sizeof(int) * 3);
            }
            i--;
            unknown_cells--;
        }
    }
    int trivial = set_cells;
    set_cells = 0;
    if (unknown_cells == 0) {
        print_solution(true, 1);
        exit(0);
    }
    printf("%i unknown cells (%i total, %i trivial cells found)\n", unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
}
