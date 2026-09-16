
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
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                push_frame();
                Cell* cell = get(t, x, y);
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
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                Cell* cell = get(t, x, y);
                if (cell->var == old) {
                    cell->var = new;
                    state.var_uses[new][state.num_var_uses[new]++] = cell;
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
    Case* cases = safe_malloc(state.total_size * 8 * sizeof(Case));
    int case_count = 0;
    // first compute the cases
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 1; y < state.height - 1; y++) {
            for (Index x = 1; x < state.width - 1; x++) {
                Cell* cell = get(t, x, y);
                if (cell->next == NULL) {
                    continue;
                }
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
                        Cell* cell2 = get(t, x + x2, y + y2);
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
                if (!found && !(cell->next->var > 0)) {
                    continue;
                }
                cells[9].value = cell->next->value;
                cells[9].var = cell->next->var;
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
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 1; y < state.height - 1; y++) {
            for (Index x = 1; x < state.width - 1; x++) {
                Cell* next_cell = get(t, x, y)->next;
                if (next_cell == NULL) {
                    continue;
                }
                Case cells;
                bool found = false;
                int i = 0;
                for (int y2 = -1; y2 <= 1; y2++) {
                    for (int x2 = -1; x2 <= 1; x2++) {
                        Cell* cell2 = get(t, x + x2, y + y2);
                        cells[i].value = cell2->value;
                        cells[i].var = cell2->var;
                        i++;
                        if (cell2->var > 0) {
                            found = true;
                        }
                    }
                }
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
                                    safe_free(cases);
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
                                state.var_uses[var][state.num_var_uses[var]++] = next_cell;
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
    safe_free(cases);
}

#endif


static inline void preprocess(void) {
    DPRINTGRID2();
    printf("Preprocessing\n");
    CellValue old_grid[state.total_size];
    CellValue new_grid[state.total_size];
    for (Index i = 0; i < state.total_size; i++) {
        old_grid[i] = ((Cell*)(state.grid))[i].value;
    }
    bool found = false;
    for (int i = 0; i < 4096; i++) {
        preprocess_implications();
        #if VARIABLES
        preprocess_cases();
        #endif
        for (Index i = 0; i < state.total_size; i++) {
            new_grid[i] = ((Cell*)(state.grid))[i].value;
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
    for (Index i = 0; i < state.start_unknown_cells; i++) {
        Index* coords = search_order[i];
        Cell* cell = get(coords[0], coords[1], coords[2]);
        if (cell->value != UNKNOWN) {
            for (Index j = i; j < state.start_unknown_cells - 1; j++) {
                memcpy(search_order[j], search_order[j + 1], sizeof(Index) * 3);
            }
            i--;
            state.start_unknown_cells--;
        }
    }
    Index trivial = state.set_cells;
    state.set_cells = 0;
    if (state.start_unknown_cells == 0) {
        check_solution(true);
        exit(0);
    }
    sp = 0;
    printf("%i unknown cells (%i total, %i trivial cells found)\n", state.start_unknown_cells, TOTAL_UNKNOWN_CELLS, trivial);
}
