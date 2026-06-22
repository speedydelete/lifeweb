
// defines a preprocessor for restricting the search state

#pragma once

#include <stdlib.h>
#include <string.h>

#include "params2.h"
#include "base.c"
#include "search.c"


static inline void reassign_cell(cell_value_t old, cell_value_t new, cell_value_t* cases, size_t cases_size) {
    if (old == new) {
        return;
    }
    DPRINTF2("Reassigning %i to %i\n", old, new);
    for (int t = 0; t < GENS; t++) {
        for (int y = 0; y < HEIGHT; y++) {
            for (int x = 0; x < WIDTH; x++) {
                cell* cell = &grid[t][y][x];
                if (cell->value == old) {
                    set_cell_and_propagate(cell, new);
                }
                if (IS_VAR(new)) {
                    cell_value_t var = CELL_VAR_TO_VAR(new);
                    int* data = var_uses[var][num_var_uses[var]++];
                    data[0] = t;
                    data[1] = x;
                    data[2] = y;
                }
            }
        }
    }
    for (size_t i = 0; i < cases_size; i++) {
        if (cases[i] == old) {
            cases[i] = new;
        }
    }
}

// runs implications
static inline void preprocess_implications(void) {
    DPRINTF3("Running implications\n");
    DPRINTGRID3();
    for (int t = 0; t < GENS; t++) {
        for (int y = 1; y < HEIGHT - 1; y++) {
            for (int x = 1; x < WIDTH - 1; x++) {
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

// check for duplicates of cases including variables
// and reassign those variables to be equal
static inline void preprocess_cases(void) {
    DPRINTF3("Running cases\n");
    DPRINTGRID3();
    cell_value_t cases[TOTAL_SIZE * 8][10];
    int case_count = 0;
    for (int t = 0; t < GENS - 1; t++) {
        for (int y = 1; y < HEIGHT - 1; y++) {
            for (int x = 1; x < WIDTH - 1; x++) {
                if (grid[t + 1][y][x].value == UNKNOWN) {
                    continue;
                }
                cell_value_t cells[10] = {
                    grid[t][y - 1][x - 1].value, grid[t][y - 1][x].value, grid[t][y - 1][x + 1].value,
                    grid[t][y][x - 1].value, grid[t][y][x].value, grid[t][y][x + 1].value,
                    grid[t][y + 1][x - 1].value, grid[t][y + 1][x].value, grid[t][y + 1][x + 1].value,
                    grid[t + 1][y][x].value,
                };
                bool found = false;
                for (int i = 0; i < 9; i++) {
                    if (IS_VAR(cells[i])) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    // assign all rotations and reflections of the case too
                    for (int i = 0; i < 2; i++) {
                        for (int j = 0; j < 4; j++) {
                            memcpy(cases[case_count], cells, sizeof(cells));
                            case_count++;
                            cell_value_t temp[10] = {
                                cells[6], cells[3], cells[0],
                                cells[7], cells[4], cells[1],
                                cells[8], cells[5], cells[2],
                                cells[9],
                            };
                            memcpy(cells, temp, sizeof(cells));
                        }
                        cell_value_t temp[10] = {
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
    }
    for (int t = 0; t < GENS - 1; t++) {
        for (int y = 1; y < HEIGHT - 1; y++) {
            for (int x = 1; x < WIDTH - 1; x++) {
                cell_value_t cells[10] = {
                    grid[t][y - 1][x - 1].value, grid[t][y - 1][x].value, grid[t][y - 1][x + 1].value,
                    grid[t][y][x - 1].value, grid[t][y][x].value, grid[t][y][x + 1].value,
                    grid[t][y + 1][x - 1].value, grid[t][y + 1][x].value, grid[t][y + 1][x + 1].value,
                    grid[t + 1][y][x].value,
                };
                bool found = false;
                for (int i = 0; i < 9; i++) {
                    if (IS_VAR(cells[i])) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    for (int i = 0; i < case_count; i++) {
                        if (memcmp(cases[i], cells, sizeof(cell_value_t) * 9) == 0) {
                            cell_value_t old_value = grid[t + 1][y][x].value;
                            cell_value_t new_value = cases[i][9];
                            if (IS_KNOWN(old_value) || old_value == new_value) {
                                continue;
                            } else if (IS_VAR(old_value)) {
                                reassign_cell(old_value, new_value, (cell_value_t*)cases, sizeof(cases));
                            } else {
                                set_cell_and_propagate(&grid[t][y][x], new_value);
                                if (IS_VAR(new_value)) {
                                    cell_value_t var = CELL_VAR_TO_VAR(new_value);
                                    int* data = var_uses[var][num_var_uses[var]++];
                                    data[0] = t + 1;
                                    data[1] = x;
                                    data[2] = y;
                                }
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
    for (int i = 0; i < unknown_cells; i++) {
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
