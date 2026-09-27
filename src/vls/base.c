
// defines basic utilities and search state setup

#pragma once

#include <limits.h>
#include <inttypes.h>
#include <stdatomic.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "params2.h"

#if MULTI_RULE
    #include "rulespaces.c"
#endif


// debug definitions

#define HASH_DEBUG false

#if DEBUG >= 1
    #define DPRINTF1 printf
    #define DPRINTGRID1() print_grid(stdout)
#else
    #define DPRINTF1(...)
    #define DPRINTGRID1()
#endif

#if DEBUG >= 2
    #define DPRINTF2 printf
    #define DPRINTGRID2() print_grid(stdout)
#else
    #define DPRINTF2(...)
    #define DPRINTGRID2()
#endif

#if DEBUG >= 3
    #define DPRINTF3 printf
    #define DPRINTGRID3() print_grid(stdout)
#else
    #define DPRINTF3(...)
    #define DPRINTGRID3()
#endif

#if DEBUG >= 4
    #define DPRINTF4 printf
    #define DPRINTGRID4() print_grid(stdout)
#else
    #define DPRINTF4(...)
    #define DPRINTGRID4()
#endif

#if DEBUG >= 5
    #define DPRINTF5 printf
    #define DPRINTGRID5() print_grid(stdout)
#else
    #define DPRINTF5(...)
    #define DPRINTGRID5()
#endif

#if DEBUG >= 6
    #define DPRINTF6 printf
    #define DPRINTGRID6() print_grid(stdout)
#else
    #define DPRINTF6(...)
    #define DPRINTGRID6()
#endif

#define INDENT "    "

#define real_printf (printf)
#define real_fprintf (fprintf)
#if DEBUG >= 3 || HASH_DEBUG
    int debug_depth = 0;
    #define DPRINTLINEPADDING() { \
        for (int i = 0; i < debug_depth; i++) { \
            real_printf(INDENT); \
        } \
    }
    #define DFPRINTLINEPADDING(stream) { \
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
    #define DPRINTLINEPADDING()
    #define DFPRINTLINEPADDING(stream)
#endif

[[noreturn]] static void fatal_error(char* msg) {
    real_fprintf(stderr, "\nError: This error should not occur, please report it (%s)\n", msg);
    exit(1);
}


// core type definitions

// the type of cell values
typedef uint8_t CellValue;
#define UNKNOWN 0
#define OFF 1
#define ON 2
#define DONT_CARE 3
#define is_known(value) ((value) == OFF || (value) == ON)

// special value for when there is no variable
#define NO_VAR 0

typedef uint16_t Transition;
typedef int16_t SignedTransition;
typedef uint16_t BoundTransition;
// special value for when a transition is rule dependent
#define TRS_RULE_DEPENDENT 4

#define DO_NOTHING 0
typedef uint32_t ImplicationTransition;
typedef int32_t SignedImplicationTransition;

#define MAX_UNPARSED_RULE_LENGTH 256
static inline ptrdiff_t get_rule(char* out, bool use_maxrule);


static inline void* safe_malloc(size_t size) {
    void* out = malloc(size);
    if (out == NULL) {
        perror("Error with malloc");
        exit(1);
    }
    return out;
}

static inline void* safe_realloc(void* ptr, size_t size) {
    void* out = realloc(ptr, size);
    if (out == NULL) {
        perror("Error with realloc");
        exit(1);
    }
    return out;
}

static inline void safe_free(void* ptr) {
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

const StaticSymmetry STATIC_SYMMETRY_JOIN[10][10] = {
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

const StaticSymmetry STATIC_SYMMETRY_MEET[10][10] = {
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

static inline bool sts_contains(StaticSymmetry container, StaticSymmetry value) {
    return STATIC_SYMMETRY_JOIN[container][value] == container;
}

static inline Transformations sts_to_transforms(StaticSymmetry symmetry) {
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

static inline StaticSymmetry transforms_to_sts(Transformations t) {
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


typedef struct Cell Cell;

typedef struct CAClause {
    ImplicationTransition tr;
    Cell* center;
    bool invert_center;
    Cell* prev;
    bool invert_prev;
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
    #if KEEP_LAST_CHECKED_TIME
        // the last time the clause was checked
        uint32_t last_checked_time;
    #endif
} CAClause;

typedef struct CAClauseList {
    CAClause* center;
    CAClause* prev;
    CAClause* next;
    CAClause* nw;
    CAClause* n;
    CAClause* ne;
    CAClause* w;
    CAClause* e;
    CAClause* sw;
    CAClause* s;
    CAClause* se;
} CAClauseList;

struct Cell {
    // the actual value of the cell
    CellValue value;
    // the variable number from INITIAL_VARS, numbering starts at 1
    size_t var_number;
    // whether it is aliased
    // the variable it is aliased to, 0 if it is not aliased
    size_t alias;
    // the length of the `uses` flexible array member
    size_t use_count;
    // the clauses it is used in
    CAClauseList uses[];
};

Cell off_cell = {
    .value = OFF,
    .var_number = NO_VAR,
    .alias = NO_VAR,
    .use_count = 0,
    // no need to initialize the flexible array member
};

Cell on_cell = {
    .value = ON,
    .use_count = 0,
    // no need to initialize the flexible array member
};

Cell dont_care_cell = {
    .value = DONT_CARE,
    .var_number = NO_VAR,
    .alias = NO_VAR,
    .use_count = 0,
    // no need to initialize the flexible array member
};

struct {
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
    Cell** variables;
    // `total_size`-long array of pointers to cells
    Cell** grid;
    // the symmetry of the grid
    StaticSymmetry symmetry;
    // the number of CA clauses
    size_t ca_clause_count;
    // the CA clauses that encode the problem
    CAClause* ca_clauses;
    // the number of unknown cells at the start of the search
    size_t start_unknown_cells;
    // the current number of set unknown cells
    size_t set_unknown_cells;
    // the last time a cell was set
    #if KEEP_LAST_CHECKED_TIME
        uint32_t current_time;
    #endif
    // the first cell to be searched
    Cell* initial_cell;
    #if MULTI_RULE
        // the transition that caused the most recent rule-dependent "contradiction"
        // or -1 if it wasn't rule-dependent
        SignedTransition rule_dependent_tr;
    #endif
} state;

static inline Cell* state_get_cell(size_t t, size_t x, size_t y) {
    return state.grid[(((t * state.height) + y) * state.width) + x];
}

static inline Cell* state_get_cell_allow_oob(size_t t, size_t x, size_t y) {
    if (t < 0 || t >= state.gens) {
        return &dont_care_cell;
    }
    if (x < 0 || x >= state.width) {
        return &off_cell;
    }
    if (y < 0 || y >= state.height) {
        return &off_cell;
    }
    return state_get_cell(t, x, y);
}

#if KEEP_LAST_CHECKED_TIME
    bool is_time_gt(uint32_t x, uint32_t y) {
        return x > y || (x < y && x > INT32_MAX && y < INT32_MAX);
    }
    void inc_current_time(void) {
        state.current_time++;
        if (state.current_time > INT32_MAX) {
            state.current_time = 0;
        }
    }
#endif

// sets a cell to a value, propagating transitions but doing nothing else
static inline bool unsafe_set_cell(Cell* cell, CellValue value);

static inline ImplicationTransition compute_implication_tr(CAClause* clause);


// configuration options

typedef enum MaxPartialScoring {
    MAX_PARTIAL_SCORING_CELL,
    MAX_PARTIAL_SCORING_DEPTH,
} MaxPartialScoring;

typedef struct Config {

    // the maximum achievable depth
    size_t max_depth;

    // the initial value of unknown cells, should be OFF or ON
    CellValue initial_value;

    // whether you are searching for periodic patterns
    bool periodic;
    size_t periodic_dx;
    size_t periodic_dy;
    size_t periodic_period;

    // the interval used for reporting progress
    size_t reporting_interval;

    // text to put after the rule, such as :T64,64
    char* after_rule_text;

    // solution printing options
    // whether to show solutions at all
    bool show_solutions;
    // maximum number of solutions to show, 0 to disable
    size_t max_solutions;
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
    size_t max_partial_reporting_interval;

} Config;

Config config;


static const char* CELL_LETTERS = "*.o'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

// print a single cell for debugging purposes
static inline void print_cell(FILE* stream, Cell* cell) {
    CellValue value = cell->value;
    if (value == UNKNOWN) {
        if (cell->var_number != NO_VAR) {
            value = 3 + cell->var_number;
        }
    }
    if (value < 65) {
        real_fprintf(stream, "%c", CELL_LETTERS[value]);
    } else {
        real_fprintf(stream, "(%i)", value);
    }
}

// print the grid for debugging purposes
static inline void print_grid(FILE* stream) {
    char rule[MAX_UNPARSED_RULE_LENGTH];
    memset(rule, '\0', 256 * sizeof(char));
    get_rule(rule, false);
    fprintf(stream, "Grid (rule = %s, set_unknown_cells = %zu out of %zu):\n", rule, state.set_unknown_cells, state.start_unknown_cells);
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            DFPRINTLINEPADDING(stream);
            for (size_t x = 0; x < state.width; x++) {
                print_cell(stream, state_get_cell(t, x, y));
            }
            real_fprintf(stream, " $\n");
        }
        if (t == state.gens - 1) {
            fprintf(stream, "!\n");
        } else {
            fprintf(stream, "$ %zub\n", t + 1);
        }
    }
}


typedef struct InitFromState {
    size_t height;
    size_t width;
    size_t gens;
    size_t var_count;
    CellValue* states;
    size_t* vars;
} InitFromState;

static inline void internal_init_state_symmetry(void);

// initialize the current state
static inline void init_state(InitFromState* from) {
    state.width = from->width;
    state.height = from->height;
    state.gens = from->gens;
    state.layer_size = state.width * state.height;
    state.total_size = state.layer_size * state.gens;
    state.start_unknown_cells = from->var_count;
    state.set_unknown_cells = 0;
    #if KEEP_LAST_CHECKED_TIME
        state.current_time = 0;
    #endif
    state.initial_cell = NULL;
    #if MULTI_RULE
        state.rule_dependent_tr = DO_NOTHING;
    #endif
    // first we have to determine how many times each variable is used
    size_t* var_uses = safe_malloc(state.var_count * sizeof(size_t));
    memset(var_uses, 0, state.var_count * sizeof(size_t));
    for (size_t i = 0; i < state.total_size; i++) {
        size_t var = from->vars[i];
        if (var != NO_VAR) {
            var_uses[var]++;
        }
    }
    // create the cells
    state.variables = safe_malloc(state.var_count * sizeof(Cell*));
    state.variables[0] = NULL;
    for (size_t i = 1; i < state.var_count; i++) {
        Cell* cell = safe_malloc(sizeof(Cell) + var_uses[i] * sizeof(CAClauseList));
        cell->value = UNKNOWN;
        cell->var_number = i;
        cell->use_count = var_uses[i];
        state.variables[i] = cell;
    }
    safe_free(var_uses);
    // now do the grid
    state.grid = safe_malloc(state.total_size * sizeof(Cell*));
    size_t i = 0;
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                CellValue value = from->states[i];
                Cell* cell;
                if (value == UNKNOWN) {
                    cell = state.variables[from->vars[i]];
                } else if (value == OFF) {
                    cell = &off_cell;
                } else if (value == ON) {
                    cell = &on_cell;
                } else if (value == DONT_CARE) {
                    cell = &dont_care_cell;
                } else {
                    fatal_error("invalid cell state");
                }
                state.grid[i] = cell;
                i++;
            }
        }
    }
    // now the clauses
    state.ca_clause_count = (state.height - 2) * (state.width - 2) * (state.gens - 1);
    state.ca_clauses = safe_malloc(state.ca_clause_count * sizeof(CAClause));
    i = 0;
    for (size_t t = 0; t < state.gens - 1; t++) {
        for (size_t y = 1; y < state.height - 1; y++) {
            for (size_t x = 1; x < state.width - 1; x++) {
                CAClause* clause = &(state.ca_clauses[i]);
                clause->invert_prev = false;
                clause->prev = state_get_cell_allow_oob(t - 1, x, y);
                clause->invert_next = false;
                clause->next = state_get_cell_allow_oob(t + 1, x, y);
                clause->invert_nw = false;
                clause->nw = state_get_cell_allow_oob(t, x - 1, y - 1);
                clause->invert_n = false;
                clause->n = state_get_cell_allow_oob(t, x, y - 1);
                clause->invert_ne = false;
                clause->ne = state_get_cell_allow_oob(t, x + 1, y - 1);
                clause->invert_w = false;
                clause->w = state_get_cell_allow_oob(t, x - 1, y);
                clause->invert_e = false;
                clause->e = state_get_cell_allow_oob(t, x + 1, y);
                clause->invert_sw = false;
                clause->sw = state_get_cell_allow_oob(t, x - 1, y + 1);
                clause->invert_s = false;
                clause->s = state_get_cell_allow_oob(t, x, y + 1);
                clause->invert_se = false;
                clause->se = state_get_cell_allow_oob(t, x + 1, y + 1);
                i++;
                clause->tr = compute_implication_tr(clause);
            }
        }
    }
    internal_init_state_symmetry();
}

// free the current state
static inline void destroy_state(void) {
    for (size_t i = 1; i < state.var_count; i++) {
        safe_free(state.variables[i]);
    }
    safe_free(state.variables);
    safe_free(state.grid);
    safe_free(state.ca_clauses);
}

static inline void reinit_state(void) {
    InitFromState from;
    from.width = state.width;
    from.height = state.height;
    from.gens = state.gens;
    from.states = safe_malloc(state.total_size * sizeof(CellValue));
    from.vars = safe_malloc(state.total_size * sizeof(CellValue));
    size_t i = 0;
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                Cell* cell = state_get_cell(t, x, y);
                from.states[i] = cell->value;
                from.vars[i] = cell->var_number;
                i++;
            }
        }
    }
    destroy_state();
    init_state(&from);
}


typedef struct CellSetStackEntry {
    Cell* cell;
    CellValue value;
} CellSetStackEntry;

#define STACKENTRY_TYPE_CELL_SET 0
#if MULTI_RULE
    #define STACKENTRY_TYPE_RULE_CHANGE 1
#endif
typedef struct StackEntry {
    bool is_first_in_frame : 1;
    #if MULTI_RULE
    unsigned int type : 1;
    #endif
    union {
        CellSetStackEntry cell_set;
        #if MULTI_RULE
            // left shifted by 4 bits, then it's the old cell value, then it's the new cell value
            BoundTransition rule_change;
        #endif
    } data;
} StackEntry;

#if MULTI_RULE
    static const char* bound_trs_names[512];
    size_t tr_to_bound_tr[512];
#endif

static inline void print_stack_entry(StackEntry* entry) {
    if (entry == NULL) {
        real_printf("<null pointer>");
        return;
    #if MULTI_RULE
    } else if (entry->type == STACKENTRY_TYPE_CELL_SET) {
    #else
    } else if (true) {
    #endif
        real_printf("cell set: variable %zu = %i", entry->data.cell_set.cell->var_number, entry->data.cell_set.value);
    #if MULTI_RULE
    } else if (entry->type == STACKENTRY_TYPE_RULE_CHANGE) {
        Transition tr = entry->data.rule_change;
        CellValue old_value = (tr >> 2) & 3;
        CellValue new_value = tr & 3;
        const char* name = bound_trs_names[tr >> 4];
        real_printf("rule change: %s = %i -> %i", name, old_value, new_value);
    #endif
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
static inline bool apply_stack_entry(StackEntry* entry) {
    #if DEBUG >= 4
        printf("Applying stack entry: ");
        print_stack_entry(entry);
    #endif
    #if MULTI_RULE
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
    #endif
        unsafe_set_cell(entry->data.cell_set.cell, entry->data.cell_set.value);
        state.set_unknown_cells++;
    #if MULTI_RULE
    } else {
        BoundTransition value = entry->data.rule_change;
        unsafe_set_tr(value >> 4, value & 3);
    }
    #endif
    return true;
}

// returns false if contradiction, true if no contradiction
static inline bool undo_stack_entry(StackEntry* entry) {
    #if DEBUG >= 4
        printf("Popping stack entry: ");
        print_stack_entry(entry);
    #endif
    #if MULTI_RULE
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
    #endif
        unsafe_set_cell(entry->data.cell_set.cell, UNKNOWN);
        state.set_unknown_cells--;
    #if MULTI_RULE
    } else {
        BoundTransition value = entry->data.rule_change;
        unsafe_set_tr(value >> 4, (value >> 2) & 3);
    }
    #endif
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
    size_t len;
    bool is_big : 1;
    bool next_entry_is_first_in_frame : 1;
} Stack;

Stack* current_stack;

static inline Stack* create_stack(void) {
    Stack* out = safe_malloc(sizeof(Stack));
    out->len = 0;
    out->next_entry_is_first_in_frame = true;
    out->is_big = false;
    return out;
}

static inline void destroy_stack(Stack* stack) {
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

static inline __attribute__((used)) void print_stack(Stack* stack) {
    printf("Stack:\n");
    for (size_t i = 0; i < stack->len; i++) {
        printf(INDENT "Entry: ");
        print_stack_entry(get_stack_entry(stack, i));
    }
}

// no dedicated "push" function because that functionality
// is provided by set_cell and set_tr

static inline StackEntry* create_new_stack_entry(Stack* stack, [[maybe_unused]] bool is_explicit) {
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
    if (stack->next_entry_is_first_in_frame) {
        out->is_first_in_frame = true;
        stack->next_entry_is_first_in_frame = false;
    } else {
        out->is_first_in_frame = false;
    }
    // out->is_explicit = is_explicit;
    return out;
}

// RETURNS NULL POINTER if there is nothing to pop
static inline StackEntry* pop_stack_for_entry(Stack* stack) {
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

static inline bool pop_stack(Stack* stack) {
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

static inline void push_stack_frame(Stack* stack) {
    DPRINTF4("Pushing frame\n");
    stack->next_entry_is_first_in_frame = true;
}

static inline void pop_stack_frame(Stack* stack) {
    DPRINTF4("Popping frame\n");
    while (stack->len > 0) {
        bool done = get_stack_entry(stack, stack->len - 1)->is_first_in_frame;
        pop_stack(stack);
        if (done) {
            break;
        }
    }
    DPRINTF4("Pop complete\n");
    DPRINTGRID4();
}


// set a cell to a value, taking care of edges and filters but not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static inline bool set_cell(Cell* cell, CellValue value, bool is_explicit) {
    if (cell->value != UNKNOWN) {
        fatal_error("setting known cell");
    }
    DPRINTF4("Setting cell: variable = %zu, value = %i, prev_value = %i\n", cell->var_number, value, cell->value);
    unsafe_set_cell(cell, value);
    state.set_unknown_cells++;
    StackEntry* entry = create_new_stack_entry(current_stack, is_explicit);
    #if MULTI_RULE
    entry->type = STACKENTRY_TYPE_CELL_SET;
    #endif
    entry->data.cell_set.cell = cell;
    entry->data.cell_set.value = value;
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    return true;
}
