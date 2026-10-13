
// defines basic utilities and search state setup

#pragma once

#include <limits.h>
#include <inttypes.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>
#include <math.h>

#include "params2.h"


// debug definitions

#define HASH_DEBUG false

#if DEBUG >= 1
    #define debug_printf_1 printf
    #define debug_print_grid_1() print_grid(stdout)
#else
    #define debug_printf_1(...)
    #define debug_print_grid_1()
#endif

#if DEBUG >= 2
    #define debug_printf_2 printf
    #define debug_print_grid_2() print_grid(stdout)
#else
    #define debug_printf_2(...)
    #define debug_print_grid_2()
#endif

#if DEBUG >= 3
    #define debug_printf_3 printf
    #define debug_print_grid_3() print_grid(stdout)
#else
    #define debug_printf_3(...)
    #define debug_print_grid_3()
#endif

#if DEBUG >= 4
    #define debug_printf_4 printf
    #define debug_print_grid_4() print_grid(stdout)
#else
    #define debug_printf_4(...)
    #define debug_print_grid_4()
#endif

#if DEBUG >= 5
    #define debug_printf_5 printf
    #define debug_print_grid_5() print_grid(stdout)
#else
    #define debug_printf_5(...)
    #define debug_print_grid_5()
#endif

#if DEBUG >= 6
    #define debug_printf_6 printf
    #define debug_print_grid_6() print_grid(stdout)
#else
    #define debug_printf_6(...)
    #define debug_print_grid_6()
#endif

#define INDENT "    "

#define real_printf (printf)
#define real_fprintf (fprintf)
#if DEBUG >= 3 || HASH_DEBUG
    #define HAS_DEBUG_DEPTH true
    static int debug_depth = 0;
    #define print_line_padding() { \
        for (int i = 0; i < debug_depth; i++) { \
            real_printf(INDENT); \
        } \
    }
    #define fprint_line_padding(stream) { \
        for (int i = 0; i < debug_depth; i++) { \
            real_fprintf(stream, INDENT); \
        } \
    }
    #define printf(...) { \
        for (int i = 0; i < debug_depth; i++) { \
            real_printf(INDENT); \
        } \
        real_printf(__VA_ARGS__); \
    }
    #define fprintf(stream, ...) { \
        for (int i = 0; i < debug_depth; i++) { \
            real_fprintf(stream, INDENT); \
        } \
        real_fprintf(stream, __VA_ARGS__); \
    }
#else
    #define HAS_DEBUG_DEPTH false
    #define print_line_padding()
    #define fprint_line_padding(stream)
#endif

static __attribute__((noreturn)) __attribute__((format(printf, 1, 2))) void error(const char* format, ...) {
    real_fprintf(stderr, "\nError: ");
    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    real_fprintf(stderr, "\n");
    exit(EXIT_FAILURE);
}

static __attribute__((noreturn)) __attribute__((format(printf, 1, 2))) void unexpected_error(const char* format, ...) {
    real_fprintf(stderr, "\nUnexpected error: ");
    va_list args;
    va_start(args, format);
    vfprintf(stderr, format, args);
    va_end(args);
    real_fprintf(stderr, "\n");
    exit(EXIT_FAILURE);
}


// core type definitions

// the type of cell values
typedef int CellValue;
#define UNKNOWN 0
#define OFF 1
#define ON 2
#define convert_12_to_01(value) ((value) - 1)

typedef uint32_t ImplicationTransition;

// special value for indexes in `state.trs` when it is rule-dependent
#define TRS_RULE_DEPENDENT 4

#define MAX_UNPARSED_RULE_LENGTH 256
static ptrdiff_t get_rule(char* out, bool use_maxrule);


static void* safe_malloc(size_t size) {
    void* out = malloc(size);
    if (out == NULL) {
        perror("Error: This error should not occur, please report it: Error in malloc");
        exit(EXIT_FAILURE);
    }
    return out;
}

static void* safe_realloc(void* ptr, size_t size) {
    void* out = realloc(ptr, size);
    if (out == NULL) {
        perror("Error: This error should not occur, please report it: Error in realloc");
        exit(EXIT_FAILURE);
    }
    return out;
}

static void safe_free(void* ptr) {
    free(ptr);
}


typedef enum StaticSymmetry {
    C1,
    C2,
    C4,
    D2h,
    D2v,
    D2b,
    D2s,
    D4p,
    D4x,
    D8,
} StaticSymmetry;

typedef struct Transformations {
    bool flip_horizontal: 1;
    bool flip_vertical: 1;
    bool rotate_left: 1;
    bool rotate_right: 1;
    bool rotate_180: 1;
    bool flip_diagonal: 1;
    bool flip_anti_diagonal: 1;
} Transformations;

static const StaticSymmetry STATIC_SYMMETRY_JOIN[10][10] = {
    [C1 ] = {C1 , C2 , C4 , D2h, D2v, D2b, D2s, D4p, D4x, D8 },
    [C2 ] = {C2 , C2 , C4 , D4p, D4p, D4x, D4x, D4p, D4x, D8 },
    [C4 ] = {C4 , C4 , C4 , D8 , D8 , D8 , D8 , D8 , D8 , D8 },
    [D2h] = {D2h, D4p, D8 , D2h, D4p, D8 , D8 , D4p, D8 , D8 },
    [D2v] = {D2v, D4p, D8 , D4p, D2v, D8 , D8 , D4p, D8 , D8 },
    [D2b] = {D2b, D4x, D8 , D8 , D8 , D2b, D4x, D8 , D4x, D8 },
    [D2s] = {D2s, D4x, D8 , D8 , D8 , D4x, D2s, D8 , D4x, D8 },
    [D4p] = {D4p, D4p, D8 , D4p, D4p, D8 , D8 , D4p, D8 , D8 },
    [D4x] = {D4x, D4x, D8 , D8 , D8 , D4x, D4x, D8 , D4x, D8 },
    [D8 ] = {D8 , D8 , D8 , D8 , D8 , D8 , D8 , D8 , D8 , D8 },
};

static const StaticSymmetry STATIC_SYMMETRY_MEET[10][10] = {
    [C1 ] = {C1 , C1 , C1 , C1 , C1 , C1 , C1 , C1 , C1 , C1 },
    [C2 ] = {C1 , C2 , C2 , C1 , C1 , C1 , C1 , C2 , C2 , C2 },
    [C4 ] = {C1 , C2 , C4 , C1 , C1 , C1 , C1 , C2 , C2 , C4 },
    [D2h] = {C1 , C1 , C1 , D2h, C1 , C1 , C1 , D2h, C1 , D2h},
    [D2v] = {C1 , C1 , C1 , C1 , D2v, C1 , C1 , D2v, C1 , D2v},
    [D2b] = {C1 , C1 , C1 , C1 , C1 , D2b, C1 , C1 , D2b, D2b},
    [D2s] = {C1 , C1 , C1 , C1 , C1 , C1 , D2s, C1 , D2s, D2s},
    [D4p] = {C1 , C2 , C2 , D2h, D2v, C1 , C1 , D4p, C2 , D4p},
    [D4x] = {C1 , C2 , C2 , C1 , C1 , D2b, D2s, C2 , D4x, D4x},
    [D8 ] = {C1 , C2 , C4 , D2h, D2v, D2b, D2s, D4p, D4x, D8 },
};

static bool sts_contains(StaticSymmetry container, StaticSymmetry value) {
    return STATIC_SYMMETRY_JOIN[container][value] == container;
}

static Transformations sts_to_transforms(StaticSymmetry symmetry) {
    Transformations out;
    out.flip_horizontal = sts_contains(symmetry, D2h);
    out.flip_vertical = sts_contains(symmetry, D2v);
    out.rotate_left = sts_contains(symmetry, C4);
    out.rotate_right = sts_contains(symmetry, C4);
    out.rotate_180 = sts_contains(symmetry, C2);
    out.flip_diagonal = sts_contains(symmetry, D2b);
    out.flip_anti_diagonal = sts_contains(symmetry, D2s);
    return out;
}

static StaticSymmetry transforms_to_sts(Transformations t) {
    bool iC2 = t.rotate_180;
    bool iC4 = t.rotate_left || t.rotate_right;
    bool iD2h = t.flip_horizontal;
    bool iD2v = t.flip_vertical;
    bool iD2b = t.flip_diagonal;
    bool iD2s = t.flip_anti_diagonal;
    if ((iD2h || iD2v) && (iD2b || iD2s)) {
        return D8;
    } else if (iC2) {
        if (iC4) {
            if (iD2h || iD2v || iD2s || iD2b) {
                return D8;
            } else {
                return C4;
            }
        } else {
            if (iD2h || iD2v) {
                return D4p;
            } else if (iD2b || iD2s) {
                return D4x;
            } else {
                return C2;
            }
        }
    } else {
        if (iD2h && iD2v) {
            return D4p;
        } else if (iD2b && iD2s) {
            return D4x;
        } else if (iD2h) {
            return D2h;
        } else if (iD2v) {
            return D2v;
        } else if (iD2s) {
            return D2s;
        } else if (iD2b) {
            return D2b;
        } else {
            return C1;
        }
    }
}


#define IMPLICATION_BACKEND_UINT64_T 0
#define IMPLICATION_BACKEND_AVX2 1

#define IMPLICATION_BACKEND IMPLICATION_BACKEND_AVX2

#if IMPLICATION_BACKEND == IMPLICATION_BACKEND_UINT64_T

typedef uint64_t ImplicState[16];

#elif IMPLICATION_BACKEND == IMPLICATION_BACKEND_AVX2

typedef uint64_t ImplicState[16];

#else

#error "Unexpected error: Invalid implication backend"

#endif


typedef struct Cell Cell;

typedef struct CAClause {
    size_t number;
    int state_number;
    ImplicState states[128];
    Cell* c;
    bool invert_c;
    Cell* next;
    bool invert_next;
    Cell* nw;
    bool invert_nw;
    Cell* n;
    bool invert_n;
    Cell* ne;
    bool invert_ne;
    Cell* w;
    bool invert_w;
    Cell* e;
    bool invert_e;
    Cell* sw;
    bool invert_sw;
    Cell* s;
    bool invert_s;
    Cell* se;
    bool invert_se;
} CAClause;

#define clause_state(clause) ((clause)->states[(clause)->state_number])

typedef struct CellUseData {
    // CAN BE A NULL POINTER
    CAClause* c;
    // CAN BE A NULL POINTER
    CAClause* prev;
    // CAN BE A NULL POINTER
    CAClause* nw;
    // CAN BE A NULL POINTER
    CAClause* n;
    // CAN BE A NULL POINTER
    CAClause* ne;
    // CAN BE A NULL POINTER
    CAClause* w;
    // CAN BE A NULL POINTER
    CAClause* e;
    // CAN BE A NULL POINTER
    CAClause* sw;
    // CAN BE A NULL POINTER
    CAClause* s;
    // CAN BE A NULL POINTER
    CAClause* se;
} CellUseData;

struct Cell {
    // the next entry in the search order, CAN BE A NULL POINTER
    Cell* next_in_search_order;
    // the actual value of the cell
    CellValue value;
    // the variable number from INITIAL_VARS, numbering starts at 1
    size_t var_number;
    // whether it is aliased
    // the variable it is aliased to, A NULL POINTER if it isn't aliased
    Cell* alias;
    // whether the alias is inverted
    bool invert_alias;
    // the length of the `uses` flexible array member
    size_t use_count;
    // the clauses it is used in
    CellUseData uses[];
};

static Cell off_cell = {
    .next_in_search_order = NULL,
    .value = OFF,
    .var_number = 0,
    .alias = NULL,
    .invert_alias = false,
    .use_count = 0,
    // no need to initialize the flexible array member
};

static Cell on_cell = {
    .next_in_search_order = NULL,
    .value = ON,
    .var_number = 0,
    .alias = NULL,
    .invert_alias = false,
    .use_count = 0,
    // no need to initialize the flexible array member
};

typedef struct GridCell {
    Cell* cell;
    bool invert;
} GridCell;

static GridCell off_grid_cell = {
    .cell = &off_cell,
    .invert = false,
};

static GridCell on_grid_cell = {
    .cell = &on_cell,
    .invert = false,
};

static GridCell null_grid_cell = {
    .cell = NULL,
    .invert = false,
};

static struct {
    // the width of the grid
    size_t width;
    // the height of the grid
    size_t height;
    // the number of generations of the grid
    size_t gens;
    // the size of each layer, aka width * height
    size_t layer_size;
    // the total number of cells in the grid
    size_t total_size;
    // the number of variables
    size_t var_count;
    // the transitions that make up the rule
    CellValue trs[512];
    // the cells, indexed by their variable number
    // numbering starts at 1, so entry 0 is a null pointer
    Cell** vars;
    // `total_size`-long array of grid cells
    GridCell* grid;
    // the symmetry of the grid
    StaticSymmetry symmetry;
    // the number of CA clauses
    size_t ca_clause_count;
    // the CA clauses that encode the problem
    CAClause** ca_clauses;
    // the number of unknown cells at the start of the search
    size_t start_unknown_vars;
    // the current number of set unknown cells
    size_t set_unknown_vars;
    // the current number of branches
    uintmax_t branches;
    // the current number of solutions
    uintmax_t solutions_found;
} state;

static GridCell* state_get_grid_cell(size_t t, size_t x, size_t y) {
    return &(state.grid[(((t * state.height) + y) * state.width) + x]);
}

static CellValue state_get_cell_value(size_t t, size_t x, size_t y) {
    GridCell* grid_cell = state_get_grid_cell(t, x, y);
    Cell* cell = grid_cell->cell;
    bool invert = grid_cell->invert;
    if (cell->alias) {
        invert = invert != cell->invert_alias;
        cell = cell->alias;
    }
    CellValue out = cell->value;
    if (invert) {
        if (out == OFF) {
            return ON;
        } else if (out == ON) {
            return OFF;
        } else {
            return out;
        }
    } else {
        return out;
    }
}

static GridCell* state_get_grid_cell_allow_oob(size_t t, size_t x, size_t y) {
    // if it would be less than 0, then it underflows
    // and gets Very Big, so we don't need to check for that!
    if (t >= state.gens) {
        return &null_grid_cell;
    }
    if (x >= state.width) {
        return &off_grid_cell;
    }
    if (y >= state.height) {
        return &off_grid_cell;
    }
    return state_get_grid_cell(t, x, y);
}

// sets a cell to a value, propagating transitions but doing nothing else
static bool set_cell(Cell* cell, CellValue value);
static void unset_cell(Cell* cell);
// aliases a cell to another, propagating transitions but doing nothing else
static bool alias(Cell* cell, Cell* alias_to, bool invert);
// undoes an alias, propagating transitions but doing nothing else
static void unalias(Cell* cell);

// computes the initial implication state for a clause
static void compute_implication_state(CAClause* clause);

static CellValue get_cell_value(Cell* cell) {
    if (cell->alias) {
        CellValue out = cell->alias->value;
        if (cell->invert_alias) {
            if (out == OFF) {
                return ON;
            } else {
                return OFF;
            }
        }
        return out;
    } else {
        return cell->value;
    }
}


// configuration options

typedef enum MaxPartialScoring {
    MAX_PARTIAL_SCORING_CELL,
    MAX_PARTIAL_SCORING_DEPTH,
} MaxPartialScoring;

typedef struct Config {

    // the search order
    size_t search_order_len;
    size_t (*search_order)[3];

    // the initial value of unknown cells, should be OFF or ON
    CellValue initial_value;

    // whether you are searching for periodic patterns, and the corresponding speed
    bool periodic;
    intmax_t periodic_dx;
    intmax_t periodic_dy;
    size_t periodic_period;

    // the interval used for reporting progress
    double reporting_interval;

    // text to put after the rule, such as :T64,64
    char* after_rule_text;

    // solution printing options
    // whether to show solutions at all
    bool show_solutions;
    // maximum number of solutions to show, 0 to disable
    uintmax_t max_solutions;
    // whether to filter empty solutions
    bool filter_empty_solutions;
    // whether to filter duplicate solutions
    bool filter_duplicate_solutions;
    // whether to filter subperiod solutions
    bool filter_subperiod_solutions;
    // the length of the cell period filter
    size_t cell_period_filter_length;
    // cell period filter: ignore cells of those periods when checking for duplicates
    size_t* cell_period_filter;

    // max partials options
    // whether to show max partials at all
    bool max_partials;
    // the scoring used for max partials
    MaxPartialScoring max_partial_scoring;
    // the minimum interval to report new max partials
    double max_partial_reporting_interval;

} Config;

static Config config = {
    .search_order_len = 0,
    .search_order = NULL,
    .initial_value = OFF,
    .periodic = false,
    .periodic_dx = 0,
    .periodic_dy = 0,
    .periodic_period = 0,
    .reporting_interval = 1.0,
    .after_rule_text = NULL,
    .show_solutions = true,
    .max_solutions = 0,
    .filter_empty_solutions = true,
    .filter_duplicate_solutions = true,
    .filter_subperiod_solutions = true,
    .cell_period_filter_length = 0,
    .cell_period_filter = NULL,
    .max_partials = true,
    .max_partial_scoring = MAX_PARTIAL_SCORING_CELL,
    .max_partial_reporting_interval = 1.0,
};

static void destroy_config(void) {
    if (config.search_order != NULL) {
        safe_free(config.search_order);
    }
    if (config.after_rule_text != NULL) {
        safe_free(config.after_rule_text);
    }
    if (config.cell_period_filter != NULL) {
        safe_free(config.cell_period_filter);
    }
}


// print a single cell for debugging purposes
static void print_grid_cell(FILE* stream, int field_size, GridCell* grid_cell) {
    Cell* cell = grid_cell->cell;
    CellValue value = cell->value;
    if (value == UNKNOWN) {
        size_t use_count = 0;
        for (size_t i = 0; i < state.total_size; i++) {
            if (state.grid[i].cell == cell) {
                use_count++;
                if (use_count > 1) {
                    break;
                }
            }
        }
        if (use_count > 1) {
            int64_t value = cell->var_number;
            if (grid_cell->invert) {
                value = -value;
            }
            real_fprintf(stream, "%-*"PRIi64, field_size, value);
        } else {
            real_fprintf(stream, "%-*c", field_size, '*');
        }
    } else if (value == OFF) {
        real_fprintf(stream, "%-*c", field_size, '.');
    } else if (value == ON) {
        real_fprintf(stream, "%-*c", field_size, 'o');
    } else {
        real_fprintf(stream, "%-*c", field_size, 'C');
    }
}

// print the grid for debugging purposes
static void print_grid(FILE* stream) {
    bool found_multi_use_cell = false;
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = state.vars[i];
        size_t use_count = 0;
        for (size_t j = 0; j < state.total_size; j++) {
            if (state.grid[j].cell == cell) {
                use_count++;
                if (use_count > 1) {
                    found_multi_use_cell = true;
                    break;
                }
            }
        }
        if (found_multi_use_cell) {
            break;
        }
    }
    int field_size;
    if (found_multi_use_cell) {
        field_size = (int)floor(log10(state.var_count)) + 2;
    } else {
        field_size = 2;
    }
    // if there's an invert we have to make it bigger to fit the minus sign
    for (size_t i = 0; i < state.total_size; i++) {
        if (state.grid[i].invert) {
            field_size += 1;
            break;
        }
    }
    char rule[MAX_UNPARSED_RULE_LENGTH];
    memset(rule, '\0', 256 * sizeof(char));
    get_rule(rule, false);
    fprintf(stream, "Grid (rule = %s, set_unknown_vars = %zu out of %zu):\n", rule, state.set_unknown_vars, state.start_unknown_vars);
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            fprint_line_padding(stream);
            for (size_t x = 0; x < state.width; x++) {
                print_grid_cell(stream, field_size, state_get_grid_cell(t, x, y));
            }
            real_fprintf(stream, "$\n");
        }
        if (t == state.gens - 1) {
            fprintf(stream, "!\n");
        } else {
            fprintf(stream, "$ %zub\n", t + 1);
        }
    }
}


typedef struct InitFromCell {
    CellValue value;
    size_t var;
    bool invert;
    bool no_clause;
} InitFromCell;

typedef struct InitFromState {
    size_t height;
    size_t width;
    size_t gens;
    size_t var_count;
    InitFromCell* grid;
} InitFromState;

static void internal_init_state_symmetry(void);

// initialize the current state
static void init_state(InitFromState* from) {
    state.width = from->width;
    state.height = from->height;
    state.gens = from->gens;
    state.var_count = from->var_count;
    state.layer_size = state.width * state.height;
    state.total_size = state.layer_size * state.gens;
    state.start_unknown_vars = state.var_count;
    state.set_unknown_vars = 0;
    // first we have to determine how many times each variable is used
    // we add 1 in the allocations because variable 0 is unused
    size_t* var_uses = safe_malloc((state.var_count + 1) * sizeof(size_t));
    memset(var_uses, 0, (state.var_count + 1) * sizeof(size_t));
    for (size_t i = 0; i < state.total_size; i++) {
        InitFromCell* cell = &(from->grid[i]);
        size_t var = cell->var;
        if (var != 0) {
            var_uses[var]++;
        }
    }
    // create the cells
    state.vars = safe_malloc((state.var_count + 1) * sizeof(Cell*));
    state.vars[0] = NULL;
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = safe_malloc(sizeof(Cell) + var_uses[i] * sizeof(CellUseData));
        cell->value = UNKNOWN;
        cell->var_number = i;
        cell->alias = NULL;
        cell->invert_alias = false;
        cell->use_count = var_uses[i];
        // fill the uses with null pointers
        for (size_t j = 0; j < cell->use_count; j++) {
            CellUseData* data = &(cell->uses[j]);
            data->c = NULL;
            data->prev = NULL;
            data->nw = NULL;
            data->n = NULL;
            data->ne = NULL;
            data->w = NULL;
            data->e = NULL;
            data->sw = NULL;
            data->s = NULL;
            data->se = NULL;
        }
        state.vars[i] = cell;
    }
    safe_free(var_uses);
    // now do the grid
    state.grid = safe_malloc(state.total_size * sizeof(GridCell));
    size_t i = 0;
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                InitFromCell* init_cell = &(from->grid[i]);
                CellValue value = init_cell->value;
                Cell* cell;
                if (value == UNKNOWN) {
                    cell = state.vars[init_cell->var];
                } else if (value == OFF) {
                    cell = &off_cell;
                } else if (value == ON) {
                    cell = &on_cell;
                } else {
                    unexpected_error("Invalid cell state at t = %zu, x = %zu, y = %zu: %i", t, x, y, value);
                }
                state.grid[i].cell = cell;
                state.grid[i].invert = init_cell->invert;
                i++;
            }
        }
    }
    // now the clauses
    state.ca_clause_count = state.width * state.height * (state.gens - 1);
    state.ca_clauses = safe_malloc(state.ca_clause_count * sizeof(CAClause*));
    i = 0;
    for (size_t t = 0; t < state.gens - 1; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                InitFromCell* init_cell = &(from->grid[i]);
                if (init_cell->no_clause) {
                    continue;
                }
                CAClause* clause = malloc(sizeof(CAClause));
                clause->number = i;
                clause->state_number = 0;
                // fill the clause's pointers
                GridCell* cell = state_get_grid_cell_allow_oob(t, x, y);
                clause->c = cell->cell;
                clause->invert_c = cell->invert;
                cell = state_get_grid_cell_allow_oob(t + 1, x, y);
                clause->next = cell->cell;
                clause->invert_next = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y - 1);
                clause->nw = cell->cell;
                clause->invert_nw = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x, y - 1);
                clause->n = cell->cell;
                clause->invert_n = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y - 1);
                clause->ne = cell->cell;
                clause->invert_ne = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y);
                clause->w = cell->cell;
                clause->invert_w = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y);
                clause->e = cell->cell;
                clause->invert_e = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y + 1);
                clause->sw = cell->cell;
                clause->invert_sw = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x, y + 1);
                clause->s = cell->cell;
                clause->invert_s = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y + 1);
                clause->se = cell->cell;
                clause->invert_se = cell->invert;
                compute_implication_state(clause);
                // fill all the clause pointers inside the cells
                #define add(cell_to_use, name_to_set) \
                    do { \
                        if (cell_to_use->value != UNKNOWN) { \
                            break; \
                        } \
                        Cell* cell = (cell_to_use); \
                        bool found = false; \
                        for (size_t j = 0; j < cell->use_count; j++) { \
                            if (cell->uses[j].name_to_set == NULL) { \
                                cell->uses[j].name_to_set = clause; \
                                found = true; \
                                break; \
                            } \
                        } \
                        if (!found) { \
                            unexpected_error("Cell use count too small: %zu (for variable %zu)", cell->use_count, cell->var_number); \
                        } \
                    } while (false)
                add(clause->c, c);
                add(clause->next, prev);
                add(clause->nw, se);
                add(clause->n, s);
                add(clause->ne, sw);
                add(clause->w, e);
                add(clause->e, w);
                add(clause->sw, ne);
                add(clause->s, n);
                add(clause->se, nw);
                #undef add
                state.ca_clauses[i] = clause;
                i++;
            }
        }
    }
    internal_init_state_symmetry();
}

// free the current state
static void destroy_state(void) {
    for (size_t i = 1; i <= state.var_count; i++) {
        safe_free(state.vars[i]);
    }
    safe_free(state.vars);
    safe_free(state.grid);
    for (size_t i = 0; i < state.ca_clause_count; i++) {
        safe_free(state.ca_clauses[i]);
    }
    safe_free(state.ca_clauses);
}


#define STACKENTRY_TYPE_CELL_SET 0
#define STACKENTRY_TYPE_ALIAS 1

typedef struct CellSetStackEntry {
    Cell* cell;
    CellValue value;
} CellSetStackEntry;

typedef struct AliasStackEntry {
    Cell* cell;
    Cell* aliased_to;
    bool invert;
} AliasStackEntry;

typedef struct StackEntry {
    bool is_first_in_frame;
    int type;
    union {
        CellSetStackEntry cell_set;
        AliasStackEntry alias;
    } data;
} StackEntry;

#if MULTI_RULE
    static const char* bound_trs_names[512];
    size_t tr_to_bound_tr[512];
#endif

static void print_stack_entry(StackEntry* entry) {
    if (entry == NULL) {
        real_printf("<null pointer>");
        return;
    } else if (entry->type == STACKENTRY_TYPE_CELL_SET) {
        CellSetStackEntry* data = &(entry->data.cell_set);
        real_printf("cell set: variable %zu = %i", data->cell->var_number, data->value);
    } else if (entry->type == STACKENTRY_TYPE_ALIAS) {
        AliasStackEntry* data = &(entry->data.alias);
        real_printf("alias: variable %zu = %s%zu", data->cell->var_number, data->invert ? "NOT " : "", data->aliased_to->var_number);
    } else {
        real_printf("<invalid stack entry>\n");
        return;
    }
    // if (entry->is_explicit) {
    //     real_printf(", explicit");
    // } else {
    //     real_printf(", not explicit");
    // }
    if (entry->is_first_in_frame) {
        real_printf(", first in frame");
    }
    real_printf("\n");
}

// returns false if contradiction, true if no contradiction
static bool apply_stack_entry(StackEntry* entry) {
    #if DEBUG >= 4
        printf("Applying stack entry: ");
        print_stack_entry(entry);
    #endif
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
        set_cell(entry->data.cell_set.cell, entry->data.cell_set.value);
        state.set_unknown_vars++;
    } else if (entry->type == STACKENTRY_TYPE_ALIAS) {
        alias(entry->data.alias.cell, entry->data.alias.aliased_to, entry->data.alias.invert);
    } else {
        unexpected_error("Invalid stack entry");
    }
    return true;
}

// returns false if contradiction, true if no contradiction
static bool undo_stack_entry(StackEntry* entry) {
    #if DEBUG >= 4
        printf("Popping stack entry: ");
        print_stack_entry(entry);
    #endif
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
        unset_cell(entry->data.cell_set.cell);
        state.set_unknown_vars--;
    } else if (entry->type == STACKENTRY_TYPE_ALIAS) {
        unalias(entry->data.alias.cell);
    } else {
        unexpected_error("Invalid stack entry");
    }
    return true;
}


typedef struct BigStackData {
    size_t capacity;
    StackEntry* data;
} BigStackData;

// todo: test this for optimal performance
#define STACK_INLINE_SIZE 4
// #define STACK_INLINE_SIZE ((Index)(sizeof(BigStackData) / sizeof(StackEntry)))

typedef struct Stack {
    union {
        StackEntry small_data[STACK_INLINE_SIZE];
        BigStackData big_data;
    };
    bool is_big;
    bool is_at_top_of_frame;
    // please work
    size_t len : (sizeof(size_t) * CHAR_BIT - 2);
    // size_t len;
} Stack;

Stack* current_stack;

static Stack* create_stack(void) {
    Stack* out = safe_malloc(sizeof(Stack));
    out->len = 0;
    out->is_at_top_of_frame = true;
    out->is_big = false;
    return out;
}

static void destroy_stack(Stack* stack) {
    if (stack->is_big) {
        safe_free(stack->big_data.data);
    }
    safe_free(stack);
}

// RETURNS NULL POINTER if the entry does not exist
static inline StackEntry* get_stack_entry(Stack* stack, size_t i) {
    if (i >= stack->len) {
        return NULL;
    }
    if (stack->is_big) {
        return &(stack->big_data.data[i]);
    } else {
        return &(stack->small_data[i]);
    }
}

static __attribute__((used)) void print_stack(Stack* stack) {
    printf("Stack:\n");
    for (size_t i = 0; i < stack->len; i++) {
        printf(INDENT "Entry: ");
        print_stack_entry(get_stack_entry(stack, i));
    }
}

// no dedicated "push" function because that functionality
// is provided by set_cell_and_push and set_tr

static StackEntry* create_new_stack_entry(Stack* stack, [[maybe_unused]] bool is_explicit) {
    StackEntry* out;
    if (stack->is_big) {
        BigStackData* big_data = &(stack->big_data);
        if (stack->len == big_data->capacity) {
            big_data->capacity <<= 1;
            // check for overflow
            if (big_data->capacity == 0) {
                big_data->capacity -= 1;
            }
            big_data->data = safe_realloc(big_data->data, big_data->capacity * sizeof(StackEntry));
        }
        stack->len++;
        out = &(big_data->data[stack->len - 1]);
    } else if (stack->len == STACK_INLINE_SIZE) {
        size_t capacity = ((size_t)1) << (sizeof(unsigned int) * CHAR_BIT - __builtin_clz(STACK_INLINE_SIZE - 1) + 1);
        StackEntry* data_ptr = safe_malloc(capacity * sizeof(StackEntry));
        memcpy(data_ptr, &(stack->small_data), STACK_INLINE_SIZE * sizeof(StackEntry));
        stack->is_big = true;
        BigStackData* big_data = &(stack->big_data);
        big_data->capacity = capacity;
        big_data->data = data_ptr;
        stack->len++;
        out = &(big_data->data[stack->len - 1]);
    } else {
        stack->len++;
        out = &(stack->small_data[stack->len - 1]);
    }
    if (stack->is_at_top_of_frame) {
        out->is_first_in_frame = true;
        stack->is_at_top_of_frame = false;
    } else {
        out->is_first_in_frame = false;
    }
    // out->is_explicit = is_explicit;
    return out;
}

// RETURNS NULL POINTER if there is nothing to pop
static StackEntry* pop_stack_for_entry(Stack* stack) {
    if (stack->len == 0) {
        return NULL;
    }
    StackEntry* out;
    if (stack->is_big) {
        out = &(stack->big_data.data[stack->len - 1]);
    } else {
        out = &(stack->small_data[stack->len - 1]);
    }
    stack->len--;
    return out;
}

static bool pop_stack(Stack* stack) {
    StackEntry* entry = pop_stack_for_entry(stack);
    if (entry == NULL) {
        return false;
    }
    // maybe check for contradiction here?
    // it really shouldn't trigger the MAXPOP
    // but who knows
    undo_stack_entry(entry);
    return true;
}

static void push_stack_frame(Stack* stack) {
    debug_printf_4("Pushing frame\n");
    stack->is_at_top_of_frame = true;
}

static void pop_stack_frame(Stack* stack) {
    debug_printf_4("Popping frame\n");
    if (!stack->is_at_top_of_frame) {
        while (stack->len > 0) {
            bool done = get_stack_entry(stack, stack->len - 1)->is_first_in_frame;
            pop_stack(stack);
            if (done) {
                break;
            }
        }
    }
    debug_printf_4("Pop complete\n");
    debug_print_grid_4();
}


// set a cell to a value, not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static bool set_cell_and_push(Cell* cell, CellValue value, bool is_explicit) {
    #if SLOWER_SANITY_CHECKS
        if (cell->value != UNKNOWN) {
            unexpected_error("Setting known cell");
        }
    #endif
    debug_printf_4("Setting cell: variable = %zu, value = %i, prev_value = %i\n", cell->var_number, value, cell->value);
    if (!set_cell(cell, value)) {
        return false;
    }
    state.set_unknown_vars++;
    StackEntry* entry = create_new_stack_entry(current_stack, is_explicit);
    entry->type = STACKENTRY_TYPE_CELL_SET;
    entry->data.cell_set.cell = cell;
    entry->data.cell_set.value = value;
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    return true;
}

static bool alias_and_push(Cell* cell, Cell* alias_to, bool invert, bool is_explicit) {
    if (!alias(cell, alias_to, invert)) {
        return false;
    }
    StackEntry* entry = create_new_stack_entry(current_stack, is_explicit);
    entry->type = STACKENTRY_TYPE_ALIAS;
    entry->data.alias.cell = cell;
    entry->data.alias.aliased_to = alias_to;
    entry->data.alias.invert = invert;
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    return true;
}
