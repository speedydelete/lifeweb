
// defines basic utilities and search state setup

#pragma once

#include <inttypes.h>
#include <stdio.h>

#include "params2.h"
#include "rules.c"

#if MULTI_RULE
#include <string.h>
#endif


static inline __attribute__((always_inline)) int min(int x, int y) {
    if (x < y) {
        return x;
    } else {
        return y;
    }
}

static inline __attribute__((always_inline)) int max(int x, int y) {
    if (x > y) {
        return x;
    } else {
        return y;
    }
}


#define SIZE (WIDTH * HEIGHT)
#define TOTAL_SIZE (GENS * SIZE)

#define is_known(x) (((x) == OFF) || ((x) == ON))

#if VARIABLES
#define MAX_VAR_USES TOTAL_UNKNOWN_CELLS
#endif

#define MAX_STACK_DEPTH TOTAL_SIZE

#if MULTI_RULE

#define TOTAL_MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 512 + 2)

#else

#define TOTAL_MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 2)

#endif


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
#if DEBUG >= 3
#define INDENT ("  ")
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


typedef struct Cell {
    // the x coordinate
    Index x;
    // the y coordinate
    Index y;
    // the generation
    Index t;
    // (t * SIZE) + (y * WIDTH) + x
    Index index;
    // the value of the cell
    CellValue value;
    #if VARIABLES
    // the variable stored in the cell
    Variable var;
    #endif
    // the settability
    uint8_t settable;
    // the next cell in the search order
    struct Cell* next_in_search_order;
    #if CACHE_IMPLICATION_TRS
    // the cached transition
    uint32_t tr;
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

typedef Cell Grid[GENS][HEIGHT][WIDTH];

Grid grid;

Index set_cells;

#ifdef MAXPOP
Index phase_0_pop;
#endif

#if KEEP_LAST_CHECKED_TIME
uint32_t current_time;
bool is_time_gt(uint32_t x, uint32_t y) {
    return x > y || (x < y && x > INT32_MAX && y < INT32_MAX);
}
void inc_current_time(void) {
    current_time++;
    if (current_time > INT32_MAX) {
        current_time = 0;
    }
}
#endif

Index unknown_cells = TOTAL_UNKNOWN_CELLS;
int max_depth = TOTAL_MAX_DEPTH;

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


typedef CellValue* DynamicGrid;
#define DYNAMIC_GRID_SIZE (GENS * HEIGHT * WIDTH * sizeof(CellValue))
#define dynamic_grid_index(grid, t, x, y) ((grid)[((t) * SIZE) + ((y) * HEIGHT) + (x)])

static inline void copy_to_dynamic_grid(DynamicGrid out) {
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                dynamic_grid_index(out, t, x, y) = grid[t][y][x].value;
            }
        }
    }
}


static inline void init_state(void) {
    Index index = 0;
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
                cell->x = x;
                cell->y = y;
                cell->t = t;
                cell->index = index++;
                cell->value = initial_grid[t][y][x];
                #if VARIABLES
                cell->var = initial_vars[t][y][x];
                #endif
                cell->settable = initial_settable[t][y][x];
                #if CACHE_IMPLICATION_TRS
                cell->tr = 0;
                #endif
                // cell->last_update = 0;
                #if TIME_WRAP
                if (t == 0) {
                    if (x + TIME_WRAP_DX < 0 || x + TIME_WRAP_DX >= WIDTH || y + TIME_WRAP_DY < 0 || y + TIME_WRAP_DY >= HEIGHT) {
                        cell->value = OFF;
                        #if VARIABLES
                        cell->var = 0;
                        #endif
                        // dummy cell
                        cell->prev = &grid[0][0][0];
                    } else {
                        cell->prev = &grid[GENS - 1][y + TIME_WRAP_DY][x + TIME_WRAP_DX];
                    }
                } else {
                    cell->prev = &grid[t - 1][y][x];
                }
                if (t == GENS - 1) {
                    if (x - TIME_WRAP_DX < 0 || x - TIME_WRAP_DX >= WIDTH || y - TIME_WRAP_DY < 0 || y - TIME_WRAP_DY >= HEIGHT) {
                        cell->value = OFF;
                        #if VARIABLES
                        cell->var = 0;
                        #endif
                        // dummy cell
                        cell->next = &grid[0][0][0];
                    } else {
                        cell->next = &grid[0][y - TIME_WRAP_DY][x - TIME_WRAP_DX];
                    }
                } else {
                    cell->next = &grid[t + 1][y][x];
                }
                #else
                cell->prev = t == 0 ? NULL : &grid[t - 1][y][x];
                cell->next = t == GENS - 1 ? NULL : &grid[t + 1][y][x];
                #endif
                cell->nw = x == 0 || y == 0 ? NULL : &grid[t][y - 1][x - 1];
                cell->n = y == 0 ? NULL : &grid[t][y - 1][x];
                cell->ne = x == WIDTH - 1 || y == 0 ? NULL : &grid[t][y - 1][x + 1];
                cell->w = x == 0 ? NULL : &grid[t][y][x - 1];
                cell->e = x == WIDTH - 1 ? NULL : &grid[t][y][x + 1];
                cell->sw = x == 0 || y == HEIGHT - 1 ? NULL : &grid[t][y + 1][x - 1];
                cell->s = y == HEIGHT - 1 ? NULL : &grid[t][y + 1][x];
                cell->se = x == WIDTH - 1 || y == HEIGHT - 1 ? NULL : &grid[t][y + 1][x + 1];
            }
        }
    }
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
                CellValue value = cell->value;
                cell->value = UNKNOWN;
                actual_set_cell_value_handles_edges(cell, value);
            }
        }
    }
    #if CACHE_IMPLICATION_TRS
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
                cell->tr = safe_compute_implication_tr(cell);
            }
        }
    }
    #endif
    set_cells = 0;
    #ifdef MAXPOP
    phase_0_pop = 0;
    #endif
}


bool next_StackEntry_is_first_in_frame = true;

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
    next_StackEntry_is_first_in_frame = true;
}

static inline void pop_frame(void) {
    DPRINTF4("Popping frame\n");
    while (sp > 0) {
        #if DEBUG >= 4
        print_frame(sp - 1);
        #endif
        Cell* cell = stack[sp - 1].cell;
        CellValue value = ((CellValue*)initial_grid)[cell->index];
        #ifdef MAXPOP
        if (cell->t == 0 && cell->value == ON) {
            phase_0_pop--;
        }
        #endif
        if (value == UNKNOWN) {
            set_cells--;
        } else if (cell->value == UNKNOWN && value != UNKNOWN) {
            set_cells++;
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
            || cell->x > WIDTH - PADDING - 1
            || cell->y < PADDING
            || cell->y > HEIGHT - PADDING - 1) {
        DPRINTF4("Contradiction (out of bounds, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    }
    stack[sp].is_first_in_frame = next_StackEntry_is_first_in_frame;
    next_StackEntry_is_first_in_frame = false;
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, index = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, cell->index, value, cell->value);
    stack[sp].cell = cell;
    sp++;
    set_cells++;
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

static inline void print_grid(FILE* stream) {
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = '\0';
    }
    get_rule(rule, false);
    fprintf(stream, "Grid (rule = %s, set_cells = %i):\n", rule, set_cells);
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            DFPRINTLINEPADDING(stream);
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
                #if VARIABLES
                print_cell(stream, cell->value, cell->var);
                #else
                print_cell(stream, cell->value);
                #endif
            }
            real_fprintf(stream, "$\n");
        }
        if (t == GENS - 1) {
            fprintf(stream, "!\n");
        } else {
            fprintf(stream, "$%ib\n", t + 1);
        }
    }
}


#if VARIABLES

// a list of where variables are used in
Cell* var_uses[VAR_COUNT][MAX_VAR_USES];
Index num_var_uses[VAR_COUNT];

static inline void init_var_uses(void) {
    for (Index i = 0; i < VAR_COUNT; i++) {
        num_var_uses[i] = 0;
        for (Index j = 0; j < MAX_VAR_USES; j++) {
            var_uses[i][j] = NULL;
        }
    }
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                Cell* cell = &grid[t][y][x];
                if (cell->var > 0) {
                    var_uses[cell->var][num_var_uses[cell->var]++] = cell;
                }
            }
        }
    }
}

#endif
