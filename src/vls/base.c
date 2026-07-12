
// defines basic utilities and search state setup

#pragma once

#include <stdio.h>

#include "params2.h"
#include "rules.c"

#if MULTI_RULE
#include <string.h>
#endif


#define SIZE (HEIGHT * WIDTH)
#define TOTAL_SIZE (GENS * SIZE)

#define UNKNOWN (2)

#if VARIABLES
#define MAX_VAR_USES TOTAL_UNKNOWN_CELLS
#endif

#define MAX_STACK_DEPTH TOTAL_SIZE

#if MULTI_RULE

#define TOTAL_MAX_DEPTH (TOTAL_UNKNOWN_CELLS + 512 + 2)

#define TR_TO_BIG_TR(x) (((x) & 1) | (((x) & 2) << 1) | (((x) & 4) << 2) | (((x) & 8) << 3) | (((x) & 16) << 4) | (((x) & 32) << 5) | (((x) & 64) << 6) | (((x) & 128) << 7) | (((x) & 256) << 8))
#define BIG_TR_TO_TR(x) (((x) & 1) | (((x) >> 1) & 2) | (((x) >> 2) & 4) | (((x) >> 3) & 8) | (((x) >> 4) & 16) | (((x) >> 5) & 32) | (((x) >> 6) & 64) | (((x) >> 7) & 128) | (((x) >> 8) & 256))

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

index_t unknown_cells = TOTAL_UNKNOWN_CELLS;
int max_depth = TOTAL_MAX_DEPTH;


static inline void init_state(void) {
    index_t index = 0;
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = 0; y < HEIGHT; y++) {
            for (index_t x = 0; x < WIDTH; x++) {
                cell* cell = &grid[t][y][x];
                cell->x = x;
                cell->y = y;
                cell->t = t;
                cell->index = index++;
                cell->value = initial_grid[t][y][x];
                #if VARIABLES
                cell->var = initial_vars[t][y][x];
                #endif
                // cell->last_update = 0;
                #if TIME_WRAP
                if (t == 0) {
                    if (y + TIME_WRAP_DY < 0 || y + TIME_WRAP_DY >= HEIGHT || x + TIME_WRAP_DX < 0 || x + TIME_WRAP_DX >= WIDTH) {
                        cell->value = 0;
                        #if VARIABLES
                        cell->var = 0;
                        #endif
                        cell->prev = &grid[0][0][0];
                    } else {
                        cell->prev = &grid[GENS - 1][y + TIME_WRAP_DY][x + TIME_WRAP_DX];
                    }
                } else {
                    cell->prev = &grid[t - 1][y][x];
                }
                if (t == GENS - 1) {
                    if (y - TIME_WRAP_DY < 0 || y - TIME_WRAP_DY >= HEIGHT || x - TIME_WRAP_DX < 0 || x - TIME_WRAP_DX >= WIDTH) {
                        cell->value = 0;
                        #if VARIABLES
                        cell->var = 0;
                        #endif
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
    set_cells = 0;
    #ifdef SPECIAL_PHASE_0_POP
    phase_0_pop = 0;
    #endif
    #if TRACK_PHASE_POPS
    for (index_t i = 0; i < GENS; i++) {
        phase_pops[i] = 0;
    }
    #endif
}


bool next_stack_entry_is_first_in_frame = true;

typedef struct stack_entry {
    bool is_first_in_frame;
    cell* cell;
} stack_entry;

stack_entry stack[MAX_STACK_DEPTH];

int sp = 0;

static inline void print_frame(int i) {
    cell* cell = stack[i].cell;
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
        cell* cell = stack[sp - 1].cell;
        cell_value_t value = ((cell_value_t*)initial_grid)[cell->index];
        #ifdef SPECIAL_PHASE_0_POP
        if (cell->t == 0 && cell->value == 1) {
            phase_0_pop--;
        }
        #endif
        #if TRACK_PHASE_POPS
        if (value == 1) {
            phase_pops[cell->t]--;
        }
        #endif
        if (value == UNKNOWN) {
            set_cells--;
        } else if (cell->value == UNKNOWN && value != UNKNOWN) {
            set_cells++;
        }
        cell->value = value;
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
#if STATES > 2
static inline bool internal_set_cell(cell* cell, cell_value_t value)
#else
static inline bool set_cell(cell* cell, cell_value_t value)
#endif
{
    if (cell->value != UNKNOWN && cell->value != value) {
        DPRINTF4("Contradiction (previous value mismatch, both known and unequal, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    } else if (cell->value == value) {
        return true;
    } else if (cell->x < (LEFT == NONE ? 2 : 0)
            || cell->x > (RIGHT == NONE ? WIDTH - 3 : WIDTH - 1)
            || cell->y < (TOP == NONE ? 2 : 0)
            || cell->y > (BOTTOM == NONE ? HEIGHT - 3 : HEIGHT - 1)) {
        DPRINTF4("Contradiction (out of bounds, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    }
    stack[sp].is_first_in_frame = next_stack_entry_is_first_in_frame;
    next_stack_entry_is_first_in_frame = false;
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, index = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, cell->index, value, cell->value);
    stack[sp].cell = cell;
    sp++;
    set_cells++;
    cell->value = value;
    // cell_update_count++;
    #ifdef SPECIAL_PHASE_0_POP
    if (cell->t == 0 && value == 1) {
        phase_0_pop++;
        if (phase_0_pop > MAXPOP) {
            return false;
        }
    }
    #endif
    #if TRACK_PHASE_POPS
    if (value == 1) {
        phase_pops[cell->t]++;
        #ifdef MAXPOP
        if (cell->t == 0 && phase_pops[0] > MAXPOP) {
            return false;
        }
        #endif
    }
    #endif
    #if TOP != NONE
    if (y == TOP) {
        grid[t][0][x] = value;
        #if LEFT != NONE
        if (x == LEFT) {
            grid[t][0][0] = value;
        }
        #endif
        #if RIGHT != NONE
        if (x == WIDTH - 1 - RIGHT) {
            grid[t][0][WIDTH - 1] = value;
        }
        #endif
    }
    #endif
    #if BOTTOM != NONE
    if (y == HEIGHT - 1 - LEFT) {
        grid[t][HEIGHT - 1][x] = value;
        #if LEFT != NONE
        if (x == LEFT) {
            grid[t][HEIGHT - 1][0] = value;
        }
        #endif
        #if RIGHT != NONE
        if (x == WIDTH - 1 - RIGHT) {
            grid[t][HEIGHT - 1][WIDTH - 1] = value;
        }
        #endif
    }
    #endif
    #if LEFT != NONE
    if (x == LEFT) {
        grid[t][y][0] = value;
    }
    #endif
    #if RIGHT != NONE
    if (x == WIDTH - 1 - RIGHT) {
        grid[t][y][WIDTH - 1] = value;
    }
    #endif
    return true;
}

#if STATES > 2
// set a cell to a value, taking care of edges and filters but not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static inline bool set_cell(cell* cell, cell_value_t value) {
    if (value == 0 && cell->prev != NULL && cell->prev->value == 1) {
        if (!internal_set_cell(cell, DYING)) {
            return false;
        }
        // #if !TIME_WRAP
        // if (cell->t + STATES - 2 > GENS) {
        //     return false;
        // }
        // #endif
        for (int i = 0; i < STATES - 3; i++) {
            cell = cell->next;
            // #if !TIME_WRAP
            // if (cell == NULL) {
            //     return false;
            // }
            // #endif
            if (!internal_set_cell(cell, DYING)) {
                return false;
            }
        }
        return true;
    } else if (value == 1 && cell->next != NULL && cell->next->value == 0) {
        if (!internal_set_cell(cell, 1)) {
            return false;
        }
        // #if !TIME_WRAP
        // if (cell->t + STATES - 2 > GENS) {
        //     return false;
        // }
        // #endif
        for (int i = 0; i < STATES - 2; i++) {
            cell = cell->next;
            // #if !TIME_WRAP
            // if (cell == NULL) {
            //     return false;
            // }
            // #endif
            if (!internal_set_cell(cell, DYING)) {
                return false;
            }
        }
        return true;
    } else {
        return internal_set_cell(cell, value);
    }
}
#endif


static const char* letters = ".o*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static inline void print_cell(FILE* stream, int value
    #if VARIABLES
    , var_t var
    #endif
) {
    #if VARIABLES
    #if STATES > 2
    if (value == 2) {
        if (var > 0) {
            value = 3 + var;
        }
    }
    #else
    if (value == 2) {
        if (var > 0) {
            value = 2 + var;
        }
    }
    #endif
    #else
    #if STATES > 2
    if (value == 4) {
        value = 3;
    }
    #endif
    #endif
    if (value < 64) {
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
    get_rule(rule);
    fprintf(stream, "Grid (rule = %s, set_cells = %i):\n", rule, set_cells);
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = 0; y < HEIGHT; y++) {
            DFPRINTLINEPADDING(stream);
            for (index_t x = 0; x < WIDTH; x++) {
                cell* cell = &grid[t][y][x];
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
            fprintf(stream, "$\n");
        }
    }
}


#if VARIABLES

// a list of where variables are used in
cell* var_uses[VAR_COUNT][MAX_VAR_USES];
index_t num_var_uses[VAR_COUNT];

static inline void init_var_uses(void) {
    for (index_t i = 0; i < VAR_COUNT; i++) {
        num_var_uses[i] = 0;
        for (index_t j = 0; j < MAX_VAR_USES; j++) {
            var_uses[i][j] = NULL;
        }
    }
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = (TOP == NONE ? 0 : 1); y < HEIGHT - (BOTTOM == NONE ? 0 : 1); y++) {
            for (index_t x = (LEFT == NONE ? 0 : 1); x < WIDTH - (RIGHT == NONE ? 0 : 1); x++) {
                cell* cell = &grid[t][y][x];
                if (cell->var > 0) {
                    var_uses[cell->var][num_var_uses[cell->var]++] = cell;
                }
            }
        }
    }
}

#endif


#if INITIAL_VALUE != IV_0 && INITIAL_VALUE != IV_1
int get_same_for_iv(cell* cell_to_use) {
    cell* cell = &grid[0][cell_to_use->y][cell_to_use->x];
    for (int i = 0; i < GENS; i++) {
        if (cell->value != UNKNOWN) {
            return cell->value;
        }
        cell = cell->next;
    }
    return (INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_DIFFERENT_1) ? 0 : 1;
}
#endif

#if INITIAL_VALUE == IV_0
#define INITIAL_VALUE_LOOP for (int value = 0, i = 0; value < 2; value++, i++)
#elif INITIAL_VALUE == IV_1
#define INITIAL_VALUE_LOOP for (int value = 1, i = 0; value >= 0; value--, i++)
#elif INITIAL_VALUE == IV_SAME_0 || INITIAL_VALUE == IV_SAME_1
#define INITIAL_VALUE_LOOP int value = get_same_for_iv(cell); for (int i = 0; i < 2; i++, value = (value + 1) % 2)
#elif INITIAL_VALUE == IV_DIFFERENT_0 || INITIAL_VALUE == IV_DIFFERENT_1
#define INITIAL_VALUE_LOOP int value = get_same_for_iv(cell) == 0 ? 1 : 0; for (int i = 0; i < 2; i++, value = (value + 1) % 2)
#endif
