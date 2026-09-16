
// defines basic utilities and search state setup

#pragma once

#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>

#include "params2.h"

#if MULTI_RULE
#include <string.h>
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

#define real_printf (printf)
#define real_fprintf (fprintf)
#if DEBUG >= 3 || HASH_DEBUG
#define INDENT "    "
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



#define MAX_STACK_DEPTH (INITIAL_WIDTH * INITIAL_HEIGHT * INITIAL_GENS)

typedef uint64_t Depth;
#if MULTI_RULE
#define MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 512 + 2)
#else
#define MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 2)
#endif

#if (MAX_PARTIAL_TYPE != MAX_PARTIAL_TYPE_NONE) && !defined(BENCHMARK)
#define MAX_PARTIALS true
#else
#define MAX_PARTIALS false
#endif

#if IS_OT
#define EMPTY_TRANSITION 0
typedef uint16_t Transition;
typedef int16_t SignedTransition;
#else
#define EMPTY_TRANSITION 0
typedef uint32_t Transition;
typedef int32_t SignedTransition;
#endif

static inline __attribute__((always_inline)) bool is_known(CellValue value) {
    return value == OFF || value == ON;
}

#if VARIABLES
#define NO_VAR 0
#define MAX_VAR_USES TOTAL_UNKNOWN_CELLS
#endif

static inline __attribute__((always_inline)) int min(int x, int y) {
    return x < y ? x : y;
}

static inline __attribute__((always_inline)) int max(int x, int y) {
    return x > y ? x : y;
}

static inline __attribute__((always_inline)) void* safe_malloc(size_t size) {
    void* out = malloc(size);
    if (out == NULL) {
        perror("Error with malloc");
        exit(1);
    }
    return out;
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
    Transition tr;
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
    // the current number of set cells
    Index set_cells;
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
} state = {
    .width = INITIAL_WIDTH,
    .height = INITIAL_HEIGHT,
    .gens = INITIAL_GENS,
    .layer_size = INITIAL_WIDTH * INITIAL_HEIGHT,
    .total_size = INITIAL_WIDTH * INITIAL_HEIGHT * INITIAL_GENS,
    .start_unknown_cells = TOTAL_UNKNOWN_CELLS,
    .set_cells = 0,
    #if KEEP_LAST_CHECKED_TIME
    .current_time = 0,
    #endif
    .initial_cell = NULL,
    #if VARIABLES
    // a list of where variables are used in
    Cell* var_uses[VAR_COUNT][MAX_VAR_USES],
    Index num_var_uses[VAR_COUNT],
    #endif
    #ifdef MAXPOP
    .phase_0_pop = 0,
    #endif
};

static inline __attribute__((always_inline)) Cell* get(Index t, Index x, Index y) {
    return &state.grid[(((t * state.height) + y) * state.width) + x];
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
static inline __attribute__((always_inline)) void actual_set_cell_value(Cell* cell, CellValue value);
static inline __attribute__((always_inline)) void actual_set_cell_value_handles_edges(Cell* cell, CellValue value);
static inline __attribute__((always_inline)) uint32_t safe_compute_implication_tr(Cell* cell);
#else
static inline __attribute__((always_inline)) void actual_set_cell_value(Cell* cell, CellValue value) {
    #if KEEP_LAST_CHECKED_TIME
    inc_current_time();
    #endif
    cell->value = value;
}
static inline __attribute__((always_inline)) void actual_set_cell_value_handles_edges(Cell* cell, CellValue value) {
    #if KEEP_LAST_CHECKED_TIME
    inc_current_time();
    #endif
    cell->value = value;
}
#endif


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

static inline void init_state(void) {
    state.grid = safe_malloc(state.total_size * sizeof(Cell));
    // clear set the prev pointers
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            for (Index x = 0; x < state.width; x++) {
                get(t, x, y)->prev = NULL;
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
                Cell* cell = get(t, x, y);
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
                cell->tr = EMPTY_TRANSITION;
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
                    cell->next = get(next_t, next_x, next_y);
                    cell->next->prev = cell;
                }
                cell->nw = x == 0 || y == 0 ? NULL : get(t, x - 1, y - 1);
                cell->n = y == 0 ? NULL : get(t, x, y - 1);
                cell->ne = x == state.width - 1 || y == 0 ? NULL : get(t, x + 1, y - 1);
                cell->w = x == 0 ? NULL : get(t, x - 1, y);
                cell->e = x == state.width - 1 ? NULL : get(t, x + 1, y);
                cell->sw = x == 0 || y == state.height - 1 ? NULL : get(t, x - 1, y + 1);
                cell->s = y == state.height - 1 ? NULL : get(t, x, y + 1);
                cell->se = x == state.width - 1 || y == state.height - 1 ? NULL : get(t, x + 1, y + 1);
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
                Cell* cell = get(t, x, y);
                cell->tr = safe_compute_implication_tr(cell);
            }
        }
    }
    #endif
}

static inline void destroy_state(void) {
    free(state.grid);
}


bool next_stack_entry_is_first_in_frame = true;

typedef struct StackEntry {
    bool is_first_in_frame;
    Cell* cell;
} StackEntry;

StackEntry stack[MAX_STACK_DEPTH];

int sp = 0;

static inline void print_frame(int i) {
    Cell* cell = stack[i].cell;
    printf("x = %i, y = %i, t = %i, is_first = %s\n", cell->x, cell->y, cell->t, stack[i].is_first_in_frame ? "true" : "false");
}

static inline void print_stack(void) {
    printf("Stack:\n");
    for (int i = 0; i < sp; i++) {
        print_frame(i);
    }
}

static inline void push_frame(void) {
    next_stack_entry_is_first_in_frame = true;
}

static inline void pop_frame(void) {
    DPRINTF4("Popping frame\n");
    while (sp > 0) {
        #if DEBUG >= 4
        print_frame(sp - 1);
        #endif
        Cell* cell = stack[sp - 1].cell;
        CellValue value = ((CellValue*)INITIAL_STATES)[cell->index];
        #ifdef MAXPOP
        if (cell->t == 0 && cell->value == ON) {
            phase_0_pop--;
        }
        #endif
        if (value == UNKNOWN) {
            state.set_cells--;
        } else if (cell->value == UNKNOWN && value != UNKNOWN) {
            state.set_cells++;
        }
        actual_set_cell_value(cell, value);
        sp--;
        if (stack[sp].is_first_in_frame) {
            break;
        }
    }
    DPRINTF4("Pop complete\n");
}

// uint64_t cell_update_count = 0;

// set a cell to a value, taking care of edges and filters but not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static inline bool set_cell(Cell* cell, CellValue value) {
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
    stack[sp].is_first_in_frame = next_stack_entry_is_first_in_frame;
    next_stack_entry_is_first_in_frame = false;
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, index = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, cell->index, value, cell->value);
    stack[sp].cell = cell;
    sp++;
    state.set_cells++;
    actual_set_cell_value(cell, value);
    // cell_update_count++;
    #ifdef MAXPOP
    if (cell->t == 0 && value == ON) {
        phase_0_pop++;
        if (phase_0_pop > MAXPOP) {
            return false;
        }
    }
    #endif
    return true;
}


static const char* letters = "*.o'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static inline void print_cell(FILE* stream, int value
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
        real_fprintf(stream, "%c", letters[value]);
    } else {
        real_fprintf(stream, "(%i)", value);
    }
}

static inline int get_rule(char* out, bool use_maxrule);

static inline void print_grid(FILE* stream) {
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = '\0';
    }
    get_rule(rule, false);
    fprintf(stream, "Grid (rule = %s, set_cells = %i):\n", rule, state.set_cells);
    for (Index t = 0; t < state.gens; t++) {
        for (Index y = 0; y < state.height; y++) {
            DFPRINTLINEPADDING(stream);
            for (Index x = 0; x < state.width; x++) {
                Cell* cell = get(t, x, y);
                #if VARIABLES
                print_cell(stream, cell->value, cell->var);
                #else
                print_cell(stream, cell->value);
                #endif
            }
            // real_fprintf(stream, "$\n");
        }
        if (t == state.gens - 1) {
            fprintf(stream, "!\n");
        } else {
            // fprintf(stream, "$%ib\n", t + 1);
        }
    }
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
