
// defines basic utilities and search state setup

#pragma once

#include <errno.h>
#include <limits.h>
#include <inttypes.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <stdarg.h>

#include "params2.h"


// debug definitions

#define PRINT_GRID_ALWAYS_SHOW_VARS false

#define HASH_DEBUG false

#define debug(level, code) if (DEBUG_LEVEL >= (level)) { code ; }

#define INDENT "    "

#define real_printf (printf)
#define real_fprintf (fprintf)
#if DEBUG_LEVEL >= 2 || HASH_DEBUG
    static int debug_depth = 0;
    #define inc_debug_depth() do { debug_depth++; } while(0)
    #define dec_debug_depth() do { debug_depth--; } while(0)
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
    #define inc_debug_depth()
    #define dec_debug_depth()
    #define print_line_padding()
    #define fprint_line_padding(stream)
#endif

// [[noreturn]] [[gnu::format(printf, 1, 2)]] static void error(const char* format, ...) {
//     real_fprintf(stderr, "\nError: ");
//     va_list args;
//     va_start(args, format);
//     vfprintf(stderr, format, args);
//     va_end(args);
//     real_fprintf(stderr, "\n");
//     exit(EXIT_FAILURE);
// }

// [[noreturn]] [[gnu::format(printf, 1, 2)]] static void unexpected_error(const char* format, ...) {
//     real_fprintf(stderr, "\nUnexpected error: ");
//     va_list args;
//     va_start(args, format);
//     vfprintf(stderr, format, args);
//     va_end(args);
//     real_fprintf(stderr, "\n");
//     exit(EXIT_FAILURE);
// }

#define error(format, ...) \
    do { \
        real_fprintf(stderr, "Error: "format"\n    at %s:%i\n" __VA_OPT__(,) __VA_ARGS__, __FILE__, __LINE__); \
        exit(EXIT_FAILURE); \
    } while (0)

#define unexpected_error(format, ...) \
    do { \
        real_fprintf(stderr, "Unexpected error: "format"\n    at %s:%i\n" __VA_OPT__(,) __VA_ARGS__, __FILE__, __LINE__); \
        exit(EXIT_FAILURE); \
    } while (0)



// better allocation functions

static void* safe_malloc(size_t size) {
    void* out = malloc(size);
    if (out == NULL) {
        error("In malloc(): %s", strerror(errno));
        exit(EXIT_FAILURE);
    }
    return out;
}

static void* safe_realloc(void* ptr, size_t size) {
    void* out = realloc(ptr, size);
    if (out == NULL) {
        error("In realloc(): %s", strerror(errno));
        exit(EXIT_FAILURE);
    }
    return out;
}

static void safe_free(void* ptr) {
    free(ptr);
}

// utility macros for printf

#define plural(value, str) (value), (value == 1 ? "" : str)


// core type definitions

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

// the type of cell values
typedef uint8_t CellValue;
#define UNKNOWN 0
#define OFF 1
#define ON 2
#define convert_12_to_01(value) ((value) - 1)
#define convert_01_to_12(value) ((value) + 1)

typedef struct Cell Cell;

typedef struct Clause {
    Cell* next;
    Cell* se;
    Cell* e;
    Cell* ne;
    Cell* s;
    Cell* c;
    Cell* n;
    Cell* sw;
    Cell* w;
    Cell* nw;
    size_t number;
    bool removed;
    uint32_t implication_tr;
} Clause;

typedef struct CellUseData {
    // CAN BE A NULL POINTER
    Clause* c;
    // CAN BE A NULL POINTER
    Clause* prev;
    // CAN BE A NULL POINTER
    Clause* nw;
    // CAN BE A NULL POINTER
    Clause* n;
    // CAN BE A NULL POINTER
    Clause* ne;
    // CAN BE A NULL POINTER
    Clause* w;
    // CAN BE A NULL POINTER
    Clause* e;
    // CAN BE A NULL POINTER
    Clause* sw;
    // CAN BE A NULL POINTER
    Clause* s;
    // CAN BE A NULL POINTER
    Clause* se;
} CellUseData;

struct Cell {
    // the next entry in the search order, CAN BE A NULL POINTER
    Cell* next_in_search_order;
    // the actual value of the cell
    CellValue value;
    // the variable number from INITIAL_VARS, numbering starts at 1
    size_t var_number;
    // the length of the `uses` flexible array member
    size_t use_count;
    // the clauses it is used in
    CellUseData uses[];
};

static Cell off_cell = {
    .next_in_search_order = NULL,
    .value = OFF,
    .var_number = 0,
    .use_count = 0,
    // no need to initialize the flexible array member
};

static Cell on_cell = {
    .next_in_search_order = NULL,
    .value = ON,
    .var_number = 0,
    .use_count = 0,
    // no need to initialize the flexible array member
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
    // the symmetry of the rule
    StaticSymmetry rule_symmetry;
    // the cells, indexed by their variable number
    // numbering starts at 1, so entry 0 is a null pointer
    Cell** vars;
    // `total_size`-long array of pointers to cells
    Cell** grid;
    // the number of CA clauses
    size_t clause_count;
    // the CA clauses that encode the problem
    Clause* clauses;
    // the number of unknown cells at the start of the search
    size_t start_unknown_vars;
    // the current number of set unknown cells
    size_t set_unknown_vars;
    // the current number of branches
    uintmax_t branches;
    // the current number of solutions
    uintmax_t solutions_found;
} state;

static Cell* state_get_cell(size_t t, size_t x, size_t y) {
    return state.grid[(((t * state.height) + y) * state.width) + x];
}

static CellValue state_get_cell_value(size_t t, size_t x, size_t y) {
    return state_get_cell(t, x, y)->value;
}

// CAN RETURN A NULL POINTER
static Cell* state_get_cell_allow_oob(intmax_t t, intmax_t x, intmax_t y) {
    if (t < 0 || t >= (intmax_t)state.gens) {
        return NULL;
    }
    if (x < 0 || x >= (intmax_t)state.width) {
        return &off_cell;
    }
    if (y < 0 || y >= (intmax_t)state.height) {
        return &off_cell;
    }
    return state_get_cell(t, x, y);
}


// sets a cell to a value, propagating transitions but doing nothing else
static bool set_cell(Cell* cell, CellValue value);

static void unset_cell(Cell* cell);


// configuration options

typedef enum MaxPartialScoring {
    MAX_PARTIAL_SCORING_CELL,
    MAX_PARTIAL_SCORING_DEPTH,
} MaxPartialScoring;

typedef struct Config {

    // the rule being used
    char* rule;

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
    bool check_early_exhaustion;

    // whether benchmarking is enabled at all
    bool benchmarking;
    // number of benchmarking iterations to run
    uintmax_t benchmarking_iterations;

    // the interval used for reporting progress
    double reporting_interval;

    // top padding for the grid
    size_t top_padding;
    // bottom padding for the grid
    size_t bottom_padding;
    // left padding for the grid
    size_t left_padding;
    // right padding for the grid
    size_t right_padding;
    // start (in time) padding for the grid
    size_t start_padding;
    // end (in time) padding for the grid
    size_t end_padding;

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
    .rule = "B3/S23",
    .search_order_len = 0,
    .search_order = NULL,
    .initial_value = OFF,
    .periodic = false,
    .periodic_dx = 0,
    .periodic_dy = 0,
    .periodic_period = 0,
    .check_early_exhaustion = false,
    .benchmarking = false,
    .benchmarking_iterations = 0,
    .reporting_interval = 1.0,
    .top_padding = 0,
    .bottom_padding = 0,
    .left_padding = 0,
    .right_padding = 0,
    .start_padding = 0,
    .end_padding = 0,
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
    if (config.rule != NULL) {
        safe_free(config.rule);
    }
    if (config.search_order != NULL) {
        safe_free(config.search_order);
    }
    if (config.cell_period_filter != NULL) {
        safe_free(config.cell_period_filter);
    }
}


// the out buffer should be filled with zeros
static void internal_cell_to_string(char* out, Cell* cell) {
    CellValue value = cell->value;
    if (value == UNKNOWN) {
        size_t use_count = 0;
        for (size_t i = 0; i < state.total_size; i++) {
            if (state.grid[i] == cell) {
                use_count++;
                if (use_count > 1) {
                    break;
                }
            }
        }
        #if PRINT_GRID_ALWAYS_SHOW_VARS
            sprintf(out, "%zu", cell->var_number);
        #else
            if (use_count > 1) {
                sprintf(out, "%zu", cell->var_number);
            } else {
                out[0] = '*';
            }
        #endif
    } else if (value == OFF) {
        out[0] = '.';
    } else if (value == ON) {
        out[0] = 'o';
    } else {
        out[0] = 'C';
    }
}

// print the grid for debugging purposes
[[maybe_unused]] static void print_grid(FILE* stream) {
    char str[256];
    int max_len = 1;
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                memset(str, '\0', 256);
                internal_cell_to_string(str, state_get_cell(t, x, y));
                int len = strlen(str);
                if (len > max_len) {
                    max_len = len;
                }
            }
        }
    }
    int field_size = max_len + 1;
    fprintf(stream, "Grid (rule = %s, set_unknown_vars = %zu out of %zu):\n", config.rule, state.set_unknown_vars, state.start_unknown_vars);
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            fprint_line_padding(stream);
            for (size_t x = 0; x < state.width; x++) {
                memset(str, '\0', 256);
                internal_cell_to_string(str, state_get_cell(t, x, y));
                real_fprintf(stream, "%-*s", field_size, str);
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


// free the current state
static void destroy_state(void) {
    for (size_t i = 1; i <= state.var_count; i++) {
        safe_free(state.vars[i]);
    }
    safe_free(state.vars);
    safe_free(state.grid);
    safe_free(state.clauses);
}


typedef struct StackEntry {
    bool is_first_in_frame;
    Cell* cell;
    CellValue value;
} StackEntry;

static void print_stack_entry(StackEntry* entry) {
    if (entry == NULL) {
        real_printf("<null pointer>");
        return;
    } else {
        real_printf("cell set: variable %zu = %i", entry->cell->var_number, entry->value);
    }
    if (entry->is_first_in_frame) {
        real_printf(", first in frame");
    }
    real_printf("\n");
}

// returns false if contradiction, true if no contradiction
// static bool apply_stack_entry(StackEntry* entry) {
//     #if DEBUG >= 4
//         printf("Applying stack entry: ");
//         print_stack_entry(entry);
//     #endif
//     set_cell(entry->cell, entry->value);
//     state.set_unknown_vars++;
//     return true;
// }

// returns false if contradiction, true if no contradiction
static bool undo_stack_entry(StackEntry* entry) {
    debug(4, 
        printf("Undoing stack entry: ");
        print_stack_entry(entry);
    );
    unset_cell(entry->cell);
    state.set_unknown_vars--;
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
    bool is_big;
    bool is_at_top_of_frame;
} Stack;

Stack current_stack;

static void init_stack(Stack* stack) {
    stack->len = 0;
    stack->is_at_top_of_frame = true;
    stack->is_big = false;
}

static void destroy_stack(Stack* stack) {
    if (stack->is_big) {
        safe_free(stack->big_data.data);
    }
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

[[maybe_unused]] static void print_stack(Stack* stack) {
    printf("Stack:\n");
    for (size_t i = 0; i < stack->len; i++) {
        printf(INDENT "Entry: ");
        print_stack_entry(get_stack_entry(stack, i));
    }
}

// no dedicated "push" function because that functionality
// is provided by set_cell_and_push

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
    debug(4, printf("Pushing frame\n"));
    stack->is_at_top_of_frame = true;
}

static void pop_stack_frame(Stack* stack) {
    debug(4, printf("Popping frame\n"));
    if (stack->is_at_top_of_frame) {
        debug(4, printf("Stack holds 0-length frame at top, doing nothing\n"));
        stack->is_at_top_of_frame = false;
    } else {
        while (stack->len > 0) {
            bool done = get_stack_entry(stack, stack->len - 1)->is_first_in_frame;
            pop_stack(stack);
            if (done) {
                break;
            }
        }
    }
    debug(4, printf("Pop complete\n"));
    debug(5, print_grid(stdout));
}


// set a cell to a value, not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static bool set_cell_and_push(Cell* cell, CellValue value, bool is_explicit) {
    debug(4, printf("Setting cell and pushing: variable = %zu, value = %i, prev_value = %i\n", cell->var_number, value, cell->value));
    debug(5, print_grid(stdout));
    if (!set_cell(cell, value)) {
        return false;
    }
    state.set_unknown_vars++;
    StackEntry* entry = create_new_stack_entry(&current_stack, is_explicit);
    entry->cell = cell;
    entry->value = value;
    debug(4, print_stack(&current_stack));
    return true;
}


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

static bool static_symmetry_contains(StaticSymmetry container, StaticSymmetry value) {
    return STATIC_SYMMETRY_JOIN[container][value] == container;
}

typedef struct Transformations {
    bool flip_horizontal: 1;
    bool flip_vertical: 1;
    bool rotate_left: 1;
    bool rotate_right: 1;
    bool rotate_180: 1;
    bool flip_diagonal: 1;
    bool flip_anti_diagonal: 1;
} Transformations;

static Transformations static_symmetry_to_transforms(StaticSymmetry symmetry) {
    Transformations out;
    out.flip_horizontal = static_symmetry_contains(symmetry, D2h);
    out.flip_vertical = static_symmetry_contains(symmetry, D2v);
    out.rotate_left = static_symmetry_contains(symmetry, C4);
    out.rotate_right = static_symmetry_contains(symmetry, C4);
    out.rotate_180 = static_symmetry_contains(symmetry, C2);
    out.flip_diagonal = static_symmetry_contains(symmetry, D2b);
    out.flip_anti_diagonal = static_symmetry_contains(symmetry, D2s);
    return out;
}

static StaticSymmetry transforms_to_static_symmetry(Transformations t) {
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

static Transformations get_rule_identity_transforms(void) {
    Transformations out;
    // rotation symmetries
    bool C2 = true;
    bool C4 = true;
    for (int i = 0; i < 512; i++) {
        int j = ((i << 6) & 448) | (i & 56) | (i >> 6);
        j = ((j & 73) << 2) | (j & 146) | ((j & 292) >> 2);
        if (state.trs[i] != state.trs[j]) {
            C2 = false;
            C4 = false;
            break;
        }
    }
    if (C2) {
        for (int i = 0; i < 512; i++) {
            if (state.trs[i] != state.trs[((i >> 2) & 66) | ((i >> 4) & 8) | ((i >> 6) & 1) | ((i << 2) & 132) | ((i << 6) & 256) | ((i << 4) & 32) | (i & 16)]) {
                C4 = false;
                break;
            }
        }
    }
    out.rotate_180 = C2;
    out.rotate_left = C4;
    out.rotate_right = C4;
    // flip symmetries
    out.flip_horizontal = true;
    out.flip_vertical = true;
    out.flip_diagonal = true;
    out.flip_anti_diagonal = true;
    for (int i = 0; i < 512; i++) {
        if (state.trs[i] != state.trs[((i & 73) << 2) | (i & 146) | ((i & 292) >> 2)]) {
            out.flip_horizontal = false;
        }
        if (state.trs[i] != state.trs[((i << 6) & 448) | (i & 56) | (i >> 6)]) {
            out.flip_vertical = false;
        }
        if (state.trs[i] != state.trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            out.flip_diagonal = false;
        }
        if (state.trs[i] != state.trs[(i & 84) | ((i << 8) & 256) | ((i >> 8) & 1) | ((i >> 4) & 10) | ((i << 4) & 160)]) {
            out.flip_anti_diagonal = false;
        }
    }
    return out;
}

static StaticSymmetry get_rule_symmetry(void) {
    return transforms_to_static_symmetry(get_rule_identity_transforms());
}


#ifdef CUSTOM
    #include CUSTOM
#endif
