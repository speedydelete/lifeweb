
// defines basic utilities and search state setup

#pragma once

#include <limits.h>
#include <inttypes.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>

#include "params2.h"
#if MULTI_RULE
    #include "rulespaces.c"
#endif


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


#define PADDING 2


typedef uint64_t Depth;
#define PRIdepth PRIu64
// add 2 because off-by-1 errors
#if MULTI_RULE
    #define MAX_DEPTH (VAR_COUNT + 512 + 2)
#else
    #define MAX_DEPTH (VAR_COUNT + 2)
#endif


#if IS_OT
    #define DO_NOTHING 0
    typedef uint16_t ImplicationTransition;
    typedef int16_t SignedImplicationTransition;
#else
    #define DO_NOTHING 0
    typedef uint32_t ImplicationTransition;
    typedef int32_t SignedImplicationTransition;
#endif

#if (MAX_PARTIAL_TYPE != MAX_PARTIAL_TYPE_NONE) && !defined(BENCHMARK)
    #define MAX_PARTIALS true
#else
    #define MAX_PARTIALS false
#endif

typedef uint16_t Transition;
typedef int16_t SignedTransition;
typedef uint16_t BoundTransition;

#define MAX_UNPARSED_RULE_LENGTH 256


static inline __attribute__((always_inline)) int min(int x, int y) {
    return x < y ? x : y;
}

static inline __attribute__((always_inline)) int max(int x, int y) {
    return x > y ? x : y;
}


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


typedef struct Cell Cell;
typedef struct CAClause CAClause;

struct CAClause {
    ImplicationTransition tr;
    bool invert_prev : 1;
    bool invert_next : 1;
    bool invert_nw : 1;
    bool invert_n : 1;
    bool invert_ne : 1;
    bool invert_w : 1;
    bool invert_e : 1;
    bool invert_sw : 1;
    bool invert_s : 1;
    bool invert_se : 1;
    Cell* prev;
    Cell* next;
    Cell* nw;
    Cell* n;
    Cell* ne;
    Cell* w;
    Cell* e;
    Cell* sw;
    Cell* s;
    Cell* se;
};

typedef struct CAClauseList {
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
    // the settability value
    Settability settable;
    // the variable number from INITIAL_VARS
    uint64_t variable_number;
    // the length of the used_in flexible array member
    size_t uses;
    // the clauses it is used in
    CAClauseList used_in[];
};

Cell off_cell = {
    .value = OFF,
    .settable = NOT_SEARCHABLE,
    .uses = 0,
    // no need to initialize the flexible array member
};

Cell on_cell = {
    .value = ON,
    .settable = NOT_SEARCHABLE,
    .uses = 0,
    // no need to initialize the flexible array member
};

struct {
    // the width of the grid
    const Index width;
    // the height of the grid
    const Index height;
    // the number of generations of the grid
    const Index gens;
    // the size of each layer, aka width * height
    const Index layer_size;
    // the total number of cells in the grid
    const Index total_size;
    // `total_size`-long array of pointers to cells
    Cell** grid;
    // the number of CA clauses
    size_t ca_clause_count;
    // the CA clauses that encode the problem
    CAClause* ca_clauses;
    // the number of unknown cells at the start of the search
    Index start_unknown_cells;
    // the current number of set unknown cells
    Index set_unknown_cells;
    // the last time a cell was set
    #if KEEP_LAST_CHECKED_TIME
        uint32_t current_time;
    #endif
    // the first cell to be searched
    Cell* initial_cell;
    #ifdef MAXPOP
        // the number of alive cells in phase 0
        Index phase_0_pop;
    #endif
    #if MULTI_RULE
        // the transition that caused the most recent rule-dependent "contradiction"
        // or -1 if it wasn't rule-dependent
        SignedTransition rule_dependent_tr;
    #endif
} state = {
    .width = INITIAL_WIDTH,
    .height = INITIAL_HEIGHT,
    .gens = INITIAL_GENS,
    .layer_size = INITIAL_WIDTH * INITIAL_HEIGHT,
    .total_size = INITIAL_WIDTH * INITIAL_HEIGHT * INITIAL_GENS,
    .grid = NULL,
    .
    .start_unknown_cells = VAR_COUNT,
    .set_unknown_cells = 0,
    #if KEEP_LAST_CHECKED_TIME
        .current_time = 0,
    #endif
    .initial_cell = NULL,
    #ifdef MAXPOP
        .phase_0_pop = 0,
    #endif
    #if MULTI_RULE
        .rule_dependent_tr = DO_NOTHING,
    #endif
};

static inline __attribute__((always_inline)) Cell* get_cell(Index t, Index x, Index y) {
    return state.grid[(((t * state.height) + y) * state.width) + x];
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

#if CACHE_IMPLICATION_TRS
    static inline __attribute__((always_inline)) void unsafe_set_cell_value(Cell* cell, CellValue value);
    static inline uint32_t safe_compute_implication_tr(Cell* cell);
#else
    static inline __attribute__((always_inline)) void unsafe_set_cell_value(Cell* cell, CellValue value) {
        #if KEEP_LAST_CHECKED_TIME
        inc_current_time();
        #endif
        cell->value = value;
    }
#endif

#if MULTI_RULE
    static inline void unsafe_set_tr(BoundTransition bound_tr, CellValue value);
#endif


static const char* CELL_LETTERS = "*.o'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static inline void print_cell(FILE* stream, Cell* cell) {
    CellValue value = cell->value;
    #if VARIABLES
        if (value == UNKNOWN) {
            if (cell->var > 0) {
                value = 3 + cell->var;
            }
        }
    #endif
    if (value < 65) {
        real_fprintf(stream, "%c", CELL_LETTERS[value]);
    } else {
        real_fprintf(stream, "(%i)", value);
    }
}

static inline int get_rule(char* out, bool use_maxrule);

static inline void print_grid(FILE* stream) {
    char rule[MAX_UNPARSED_RULE_LENGTH];
    memset(rule, '\0', 256 * sizeof(char));
    get_rule(rule, false);
    fprintf(stream, "Grid (rule = %s, set_unknown_cells = %i out of %i):\n", rule, state.set_unknown_cells, state.start_unknown_cells);
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            DFPRINTLINEPADDING(stream);
            for (Index x = 0; x < state.width; x++) {
                Cell* cell = get_cell(t, x, y);
                #if VARIABLES
                    print_cell(stream, cell);
                #else
                    print_cell(stream, cell);
                #endif
            }
            real_fprintf(stream, " $\n");
        }
        if (t == state.gens - 1) {
            fprintf(stream, "!\n");
        } else {
            fprintf(stream, "$ %ib\n", t + 1);
        }
    }
}


static inline void init_state(void) {
    state.grid = safe_malloc(state.total_size * sizeof(Cell*));
    state.ca_clause_count = (state.height - 2) * (state.width - 2) * state.gens;
    state.ca_clauses = safe_malloc(state.ca_clause_count * sizeof(CAClause));
    // first we have to determine how many times each variable is used
    Index* var_uses = safe_malloc(VAR_COUNT * sizeof(Index));
    memset(var_uses, 0, VAR_COUNT * sizeof(Index));
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                Variable var = initial_vars[t][y][x];
                if (var != NO_VAR) {
                    var_uses[var]++;
                }
            }
        }
    }
    for (Index i = 0; i < VAR_COUNT; i++) {
        Cell* cell = malloc(sizeof(Cell) + sizeof(CAClauseList) * var_uses[i]);
        cell.value = initial_states[i];
        cell.settable = initial_settable[i];
        cell.variable_number = i;
    }
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                Cell* cell = 
                // Cell* cell = get_cell(t, x, y);
                // cell->t = t;
                // cell->x = x;
                // cell->y = y;
                // cell->index = index++;
                // #if VARIABLES
                //     cell->var = INITIAL_VARS[t][y][x];
                //     if (cell->var > 0) {
                //         state.var_uses[cell->var][state.num_var_uses[cell->var]++] = cell;
                //     }
                // #endif
                // cell->settable = INITIAL_SETTABLE[t][y][x];
                // #if CACHE_IMPLICATION_TRS
                //     cell->tr = DO_NOTHING;
                // #endif
                // #if CACHE_TIMES
                //     cell->last_update = 0;
                // #endif
                // const int32_t* next_coords = INITIAL_NEXTS[t][y][x];
                // int32_t next_t = next_coords[0];
                // int32_t next_x = next_coords[1];
                // int32_t next_y = next_coords[2];
                // if (next_t == -1 && next_x == -1 && next_y == -1) {
                //     cell->next = NULL;
                // } else if (next_t == -2 && next_x == -2 && next_y == -2) {
                //     cell->next = &forced_off_cell;
                // } else {
                //     cell->next = get_cell(next_t, next_x, next_y);
                //     cell->next->prev = cell;
                // }
                // cell->nw = x == 0 || y == 0 ? NULL : get_cell(t, x - 1, y - 1);
                // cell->n = y == 0 ? NULL : get_cell(t, x, y - 1);
                // cell->ne = x == state.width - 1 || y == 0 ? NULL : get_cell(t, x + 1, y - 1);
                // cell->w = x == 0 ? NULL : get_cell(t, x - 1, y);
                // cell->e = x == state.width - 1 ? NULL : get_cell(t, x + 1, y);
                // cell->sw = x == 0 || y == state.height - 1 ? NULL : get_cell(t, x - 1, y + 1);
                // cell->s = y == state.height - 1 ? NULL : get_cell(t, x, y + 1);
                // cell->se = x == state.width - 1 || y == state.height - 1 ? NULL : get_cell(t, x + 1, y + 1);
                // // finally set the value AFTER the pointers are set
                // cell->value = INITIAL_STATES[t][y][x];
            }
        }
    }
    // set the transitions
    #if CACHE_IMPLICATION_TRS
        for (Index t = 0; t < state.gens; t++) {
            for (Index y = 0; y < state.height; y++) {
                for (Index x = 0; x < state.width; x++) {
                    Cell* cell = get_cell(t, x, y);
                    cell->tr = safe_compute_implication_tr(cell);
                }
            }
        }
    #endif
}

static inline void destroy_state(void) {
    free(state.grid);
}


#define STACKENTRY_TYPE_CELL_SET 0
#if MULTI_RULE
    #define STACKENTRY_TYPE_RULE_CHANGE 1
#endif
typedef struct StackEntry {
    bool is_first_in_frame : 1;
    // bool is_explicit : 1;
    unsigned int type : 1;
    union {
        Index cell_set;
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
    } else if (entry->type == STACKENTRY_TYPE_CELL_SET) {
        Cell* cell = &(state.grid[entry->data.cell_set]);
        real_printf("cell set: t = %i, x = %i, y = %i", cell->t, cell->x, cell->y);
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
        Cell* cell = &(state.grid[entry->data.cell_set]);
        CellValue value = ((CellValue*)INITIAL_STATES)[cell->index];
        unsafe_set_cell_value(cell, value);
        state.set_unknown_cells++;
        #ifdef MAXPOP
        if (cell->t == 0) {
            if (value == ON && cell->value != ON) {
                state.phase_0_pop++;
                if (state.phase_0_pop > MAXPOP) {
                    return false;
                }
            } else if (value != ON && cell->value == ON) {
                state.phase_0_pop--;
            }
        }
        #endif
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
        Cell* cell = &(state.grid[entry->data.cell_set]);
        CellValue value = ((CellValue*)INITIAL_STATES)[cell->index];
        unsafe_set_cell_value(cell, value);
        state.set_unknown_cells--;
        #ifdef MAXPOP
        if (cell->t == 0) {
            if (value == ON && cell->value != ON) {
                state.phase_0_pop++;
                if (state.phase_0_pop > MAXPOP) {
                    return false;
                }
            } else if (value != ON && cell->value == ON) {
                state.phase_0_pop--;
            }
        }
        #endif
    #if MULTI_RULE
    } else {
        BoundTransition value = entry->data.rule_change;
        unsafe_set_tr(value >> 4, (value >> 2) & 3);
    }
    #endif
    return true;
}


typedef PrefixIndex StackIndex;

typedef struct BigStackData {
    StackIndex capacity;
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
    StackIndex len;
    bool is_big : 1;
    bool next_entry_is_first_in_frame : 1;
} Stack;

Stack* current_stack;

static inline Stack* create_stack(void) {
    Stack* out = malloc(sizeof(Stack));
    out->len = 0;
    out->next_entry_is_first_in_frame = true;
    out->is_big = false;
    return out;
}

static inline void destroy_stack(Stack* stack) {
    if (stack->is_big) {
        free(stack->big_data.data);
    }
    free(stack);
}

// RETURNS NULL POINTER if the entry does not exist
static inline StackEntry* get_stack_entry(Stack* stack, StackIndex i) {
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
    for (Index i = 0; i < stack->len; i++) {
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
        StackIndex capacity = ((StackIndex)1) << (sizeof(unsigned int) * CHAR_BIT - __builtin_clz(STACK_INLINE_SIZE - 1) + 1);
        StackEntry* data_ptr = malloc(capacity * sizeof(StackEntry));
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
    if (cell->value != UNKNOWN && cell->value != value) {
        DPRINTF4("Contradiction (previous value mismatch, both known and unequal, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    } else if (cell->settable == NOT_SETTABLE) {
        return true;
    } else if (cell->value == value) {
        return true;
    } else if (cell->x < PADDING
            || cell->x > state.width - PADDING - 1
            || cell->y < PADDING
            || cell->y > state.height - PADDING - 1) {
        DPRINTF4("Contradiction (out of bounds, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    }
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, index = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, cell->index, value, cell->value);
    unsafe_set_cell_value(cell, value);
    state.set_unknown_cells++;
    #ifdef MAXPOP
        if (cell->t == 0) {
            if (value == ON && cell->value != ON) {
                state.phase_0_pop++;
                if (state.phase_0_pop > MAXPOP) {
                    return false;
                }
            } else if (value != ON && cell->value == ON) {
                state.phase_0_pop--;
            }
        }
    #endif
    StackEntry* entry = create_new_stack_entry(current_stack, is_explicit);
    entry->type = STACKENTRY_TYPE_CELL_SET;
    entry->data.cell_set = cell->index;
    #if DEBUG >= 4
        print_stack(current_stack);
    #endif
    return true;
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
