
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


typedef uint16_t Transition;
typedef int16_t SignedTransition;

typedef uint16_t BoundTransition;


typedef uint64_t Depth;
#define PRIdepth PRIu64
#if MULTI_RULE
#define MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 512 + 2)
#else
#define MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 2)
#endif

static inline __attribute__((always_inline)) bool is_known(CellValue value) {
    return value == OFF || value == ON;
}

#if VARIABLES
#define NO_VAR 0
#define MAX_VAR_USES TOTAL_UNKNOWN_CELLS
#endif

#define MAX_UNPARSED_RULE_LENGTH 256

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


typedef struct Cell {
    // the generation
    Index t;
    // the x coordinate
    Index x;
    // the y coordinate
    Index y;
    // (t * state.layer_size) + (y * state.width) + x
    Index index;
    // the value of the cell
    CellValue value;
    #if VARIABLES
    // the variable stored in the cell
    Variable var;
    #endif
    // the settability
    Settability settable;
    // the next cell in the search order
    struct Cell* next_in_search_order;
    #if CACHE_IMPLICATION_TRS
    // the cached transition
    ImplicationTransition tr;
    #endif
    #if KEEP_LAST_CHECKED_TIME
    // the last time the implication was checked
    uint32_t last_checked_time;
    #endif
    // the previous cell (in time)
    struct Cell* prev;
    // the next cell (in time)
    struct Cell* next;
    // the northwest neighbor
    struct Cell* nw;
    // the north neighbor
    struct Cell* n;
    // the northeast neighbor
    struct Cell* ne;
    // the west neighbor
    struct Cell* w;
    // the east neighbor
    struct Cell* e;
    // the southwest neighbor
    struct Cell* sw;
    // the south neighbor
    struct Cell* s;
    // the southeast neighbor
    struct Cell* se;
} Cell;

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
    // the actual cell data
    Cell* grid;
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
    #if VARIABLES
    // a list of where variables are used in
    Cell* var_uses[VAR_COUNT][MAX_VAR_USES];
    Index num_var_uses[VAR_COUNT];
    #endif
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
    .start_unknown_cells = TOTAL_UNKNOWN_CELLS,
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
    return &(state.grid[(((t * state.height) + y) * state.width) + x]);
}

Cell forced_off_cell = {
    .t = 0,
    .x = 0,
    .y = 0,
    .index = 0,
    .value = OFF,
    #if VARIABLES
    .var = 0,
    #endif
    .settable = NOT_SETTABLE,
    .next_in_search_order = NULL,
    #if CACHE_IMPLICATION_TRS
    .tr = 0,
    #endif
    #if KEEP_LAST_CHECKED_TIME
    .last_checked_time = 0,
    #endif
    .prev = NULL,
    .next = NULL,
    .nw = NULL,
    .n = NULL,
    .ne = NULL,
    .w = NULL,
    .e = NULL,
    .sw = NULL,
    .s = NULL,
    .se = NULL,
};


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

static inline void print_cell(FILE* stream, CellValue value
    #if VARIABLES
    , Variable var
    #endif
) {
    #if VARIABLES
    if (value == UNKNOWN) {
        if (var > 0) {
            value = 3 + var;
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
                print_cell(stream, cell->value, cell->var);
                #else
                print_cell(stream, cell->value);
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
    state.grid = safe_malloc(state.total_size * sizeof(Cell));
    // clear set the prev pointers
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                get_cell(t, x, y)->prev = NULL;
            }
        }
    }
    // initialize the variable uses
    #if VARIABLES
    for (Index i = 0; i < VAR_COUNT; i++) {
        state.num_var_uses[i] = 0;
        for (Index j = 0; j < MAX_VAR_USES; j++) {
            state.var_uses[i][j] = NULL;
        }
    }
    #endif
    // main initialization
    Index index = 0;
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                Cell* cell = get_cell(t, x, y);
                cell->t = t;
                cell->x = x;
                cell->y = y;
                cell->index = index++;
                #if VARIABLES
                cell->var = INITIAL_VARS[t][y][x];
                if (cell->var > 0) {
                    state.var_uses[cell->var][state.num_var_uses[cell->var]++] = cell;
                }
                #endif
                cell->settable = INITIAL_SETTABLE[t][y][x];
                #if CACHE_IMPLICATION_TRS
                cell->tr = DO_NOTHING;
                #endif
                #if CACHE_TIMES
                cell->last_update = 0;
                #endif
                const int32_t* next_coords = INITIAL_NEXTS[t][y][x];
                int32_t next_t = next_coords[0];
                int32_t next_x = next_coords[1];
                int32_t next_y = next_coords[2];
                if (next_t == -1 && next_x == -1 && next_y == -1) {
                    cell->next = NULL;
                } else if (next_t == -2 && next_x == -2 && next_y == -2) {
                    cell->next = &forced_off_cell;
                } else {
                    cell->next = get_cell(next_t, next_x, next_y);
                    cell->next->prev = cell;
                }
                cell->nw = x == 0 || y == 0 ? NULL : get_cell(t, x - 1, y - 1);
                cell->n = y == 0 ? NULL : get_cell(t, x, y - 1);
                cell->ne = x == state.width - 1 || y == 0 ? NULL : get_cell(t, x + 1, y - 1);
                cell->w = x == 0 ? NULL : get_cell(t, x - 1, y);
                cell->e = x == state.width - 1 ? NULL : get_cell(t, x + 1, y);
                cell->sw = x == 0 || y == state.height - 1 ? NULL : get_cell(t, x - 1, y + 1);
                cell->s = y == state.height - 1 ? NULL : get_cell(t, x, y + 1);
                cell->se = x == state.width - 1 || y == state.height - 1 ? NULL : get_cell(t, x + 1, y + 1);
                // finally set the value AFTER the pointers are set
                cell->value = INITIAL_STATES[t][y][x];
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
// todo: test performance of the packing
typedef struct /*__attribute__((packed))*/ StackEntry {
    bool is_first_in_frame : 1;
    bool is_explicit : 1;
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
    if (entry->is_explicit) {
        real_printf(", explicit");
    } else {
        real_printf(", not explicit");
    }
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
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
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
    } else if (entry->type == STACKENTRY_TYPE_RULE_CHANGE) {
        BoundTransition value = entry->data.rule_change;
        unsafe_set_tr(value >> 4, value & 3);
    #endif
    } else {
        fprintf(stderr, "This error should not occur, please report it (invalid stack entry)\n");
        exit(1);
    }
    return true;
}

// returns false if contradiction, true if no contradiction
static inline bool undo_stack_entry(StackEntry* entry) {
    #if DEBUG >= 4
    printf("Popping stack entry: ");
    print_stack_entry(entry);
    #endif
    if (entry->type == STACKENTRY_TYPE_CELL_SET) {
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
    } else if (entry->type == STACKENTRY_TYPE_RULE_CHANGE) {
        BoundTransition value = entry->data.rule_change;
        unsafe_set_tr(value >> 4, (value >> 2) & 3);
    #endif
    } else {
        fprintf(stderr, "This error should not occur, please report it (invalid stack entry)\n");
        exit(1);
    }
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

static inline StackEntry* create_new_stack_entry(Stack* stack, bool is_explicit) {
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
    out->is_explicit = is_explicit;
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
