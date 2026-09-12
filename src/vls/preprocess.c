
// defines a preprocessor for restricting the search state

#pragma once

#include <string.h>

#include "params2.h"
#include "base.c"
#include "implications.c"
#include "output.c"


// runs implications
static inline void preprocess_implications(void) {
    DPRINTF3("Running implications\n");
    DPRINTGRID3();
    #if TIME_WRAP
    for (Index t = 0; t < GENS; t++)
    #else
    for (Index t = 0; t < GENS - 1; t++)
    #endif
    {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                push_frame();
                Cell* cell = &grid[t][y][x];
                if (cell == NULL) {
                    printf("WHY, t = %i, x = %i, y = %i\n", t, x, y);
                    exit(1);
                }
                if (!check_implication_handles_edges(cell)) {
                    #if MULTI_RULE
                    if (rule_dependent_tr != -1) {
                        rule_dependent_tr = -1;
                        pop_frame();
                        continue;
                    }
                    #endif
                    printf("Contradiction found in preprocessing (in implication step, cell at t = %i, x = %i, y = %i)\n", t, x - PADDING, y - PADDING);
                    exit(0);
                }
            }
        }
    }
}


#if VARIABLES

typedef struct CaseCell {
    CellValue value;
    Variable var;
} CaseCell;

typedef CaseCell Case[10];

static inline void reassign_variable(Variable old, Variable new, CaseCell* cases, size_t cases_size) {
    if (old == new) {
        return;
    }
    DPRINTF2("Reassigning %i to %i\n", old, new);
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
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

static inline void print_case(Case* cells) {
    for (int i = 0; i < 10; i++) {
        print_cell(stdout, (*cells)[i].value, (*cells)[i].var);
        if (i == 2 || i == 5 || i == 8) {
            real_printf(" ");
        }
    }
}

// check for duplicates of cases including variables
// and reassign those variables to be equal
static inline void preprocess_cases(void) {
    DPRINTF3("Running cases\n");
    DPRINTGRID3();
    Case* cases = malloc(TOTAL_SIZE * 8 * sizeof(Case));
    int case_count = 0;
    // first compute the cases
    for (Index t = 0; t < GENS - 1; t++) {
        for (Index y = 1; y < HEIGHT - 1; y++) {
            for (Index x = 1; x < WIDTH - 1; x++) {
                Cell* cell = &grid[t][y][x];
                // filter out where the cell value is unknown
                if (cell->value == UNKNOWN && cell->var == 0) {
                    continue;
                }
                Case cells;
                bool found = false;
                bool found2 = false;
                int i = 0;
                for (int y2 = -1; y2 <= 1; y2++) {
                    for (int x2 = -1; x2 <= 1; x2++) {
                        Cell* cell2 = &grid[t][y + y2][x + x2];
                        cells[i].value = cell2->value;
                        if (cell2->value == UNKNOWN && cell2->var == 0) {
                            found2 = true;
                            break;
                        }
                        cells[i].var = cell2->var;
                        i++;
                        if (cell2->var > 0) {
                            found = true;
                        }
                    }
                }
                if (found2) {
                    continue;
                }
                Cell* next_cell = &grid[t + 1][y][x];
                if (!found && !(next_cell->var > 0)) {
                    continue;
                }
                cells[9].value = next_cell->value;
                cells[9].var = next_cell->var;
                // check for duplicate cases
                found = false;
                for (int i = 0; i < case_count; i++) {
                    if (memcmp(cells, cases[i], sizeof(Case)) == 0) {
                        found = true;
                        break;
                    }
                }
                #if DEBUG >= 3
                printf("New case (%i): ", case_count);
                print_case(&cells);
                real_printf("\n");
                #endif
                int start_case = case_count;
                memcpy(cases[case_count], cells, sizeof(Case));
                case_count++;
                // assign all rotations and reflections of the case too
                for (int i = 0; i < 2; i++) {
                    for (int j = 0; j < 4; j++) {
                        Case temp = {
                            cells[6], cells[3], cells[0],
                            cells[7], cells[4], cells[1],
                            cells[8], cells[5], cells[2],
                            cells[9],
                        };
                        memcpy(cells, temp, sizeof(Case));
                        // check for symmetric cases
                        bool found = false;
                        for (int i = start_case; i < case_count; i++) {
                            if (memcmp(cells, cases[i], sizeof(Case)) == 0) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            memcpy(cases[case_count], cells, sizeof(Case));
                            case_count++;
                        }
                    }
                    Case temp = {
                        cells[2], cells[1], cells[0],
                        cells[5], cells[4], cells[3],
                        cells[8], cells[7], cells[6],
                        cells[9],
                    };
                    memcpy(cells, temp, sizeof(Case));
                }
            }
        }
    }
    // now apply the cases
    for (Index t = 0; t < GENS - 1; t++) {
        for (Index y = 1; y < HEIGHT - 1; y++) {
            for (Index x = 1; x < WIDTH - 1; x++) {
                Case cells;
                bool found = false;
                int i = 0;
                for (int y2 = -1; y2 <= 1; y2++) {
                    for (int x2 = -1; x2 <= 1; x2++) {
                        Cell* cell2 = &grid[t][y + y2][x + x2];
                        cells[i].value = cell2->value;
                        cells[i].var = cell2->var;
                        i++;
                        if (cell2->var > 0) {
                            found = true;
                        }
                    }
                }
                Cell* next_cell = &grid[t + 1][y][x];
                cells[9].value = next_cell->value;
                cells[9].var = next_cell->var;
                if (next_cell->var > 0) {
                    found = true;
                }
                if (!found) {
                    continue;
                }
                for (int i = 0; i < case_count; i++) {
                    if (memcmp(cases[i], &cells, sizeof(CaseCell) * 9) == 0) {
                        #if DEBUG >= 3
                        printf("Cell at t = %i, x = %i, y = %i matches case %i: ", t, x, y, i);
                        print_case(&cells);
                        real_printf("\n");
                        #endif
                        CaseCell new_cell = cases[i][9];
                        if (next_cell->value != UNKNOWN) {
                            if (new_cell.value != UNKNOWN) {
                                // if both are unknown, check for contradiction
                                if (next_cell->value != new_cell.value) {
                                    printf("Contradiction found in preprocessing (in case step, cell at t = %i, x = %i, y = %i)\n", t, x - PADDING, y - PADDING);
                                    exit(0);
                                }
                            } else {
                                // no point setting a known cell to an unknown cell
                                continue;
                            }
                        } else {
                            if (new_cell.value != UNKNOWN) {
                                // if we are setting it to a known cell, that's easy!
                                actual_set_cell_value(next_cell, new_cell.value);
                            } else if (new_cell.var == 0) {
                                // this seriously should not be happening
                                continue;
                            } else if (next_cell->var == 0) {
                                // it was unknown, now we know it must be a certain variable
                                Variable var = new_cell.var;
                                next_cell->var = var;
                                var_uses[var][num_var_uses[var]++] = next_cell;
                            } else {
                                // we reassign all uses of the variable
                                reassign_variable(next_cell->var, new_cell.var, (CaseCell*)cases, case_count * 10);
                            }
                        }
                    }
                }
            }
        }
    }
    free(cases);
}

#endif


static inline void preprocess(void) {
    DPRINTGRID2();
    printf("Preprocessing\n");
    CellValue old_grid[TOTAL_SIZE];
    CellValue new_grid[TOTAL_SIZE];
    for (Index i = 0; i < TOTAL_SIZE; i++) {
        old_grid[i] = ((Cell*)grid)[i].value;
    }
    bool found = false;
    for (int i = 0; i < 4096; i++) {
        preprocess_implications();
        #if VARIABLES
        preprocess_cases();
        #endif
        for (Index i = 0; i < TOTAL_SIZE; i++) {
            new_grid[i] = ((Cell*)grid)[i].value;
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
    // remove trivial cells
    for (Index i = 0; i < unknown_cells; i++) {
        Index* coords = search_order[i];
        Cell* cell = &grid[coords[0]][coords[2]][coords[1]];
        if (cell->value != UNKNOWN) {
            for (Index j = i; j < unknown_cells - 1; j++) {
                memcpy(search_order[j], search_order[j + 1], sizeof(Index) * 3);
            }
            i--;
            unknown_cells--;
        }
    }
    int trivial = set_cells;
    set_cells = 0;
    if (unknown_cells == 0) {
        check_solution(true);
        exit(0);
    }
    sp = 0;
    printf("%i unknown cells (%i total, %i trivial cells found)\n", unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
}
