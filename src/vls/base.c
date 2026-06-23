
// defines basic utilities and search state setup

#pragma once

#include <stdio.h>

#include "params2.h"


#define SIZE (HEIGHT * WIDTH)
#define TOTAL_SIZE (GENS * SIZE)

#define UNKNOWN (2)
#define IS_KNOWN(x) ((x) < UNKNOWN)

#define MAX_VAR_USES TOTAL_UNKNOWN_CELLS

#define MAX_STACK_DEPTH TOTAL_SIZE

#if MULTI_RULE

#define TOTAL_MAX_DEPTH (TOTAL_UNKNOWN_CELLS + MAX_RULE_CHANGES)

#define TR_TO_BIG_TR(x) ((x) & 1) | (((x) & 2) << 1) | (((x) & 4) << 2) | (((x) & 8) << 3) | (((x) & 16) << 4) | (((x) & 32) << 5) | (((x) & 64) << 6) | (((x) & 128) << 7) | (((x) & 256) << 8)
#define BIG_TR_TO_TR(x) ((x) & 1) | (((x) >> 1) & 2) | (((x) >> 2) & 4) | (((x) >> 3) & 8) | (((x) >> 4) & 16) | (((x) >> 5) & 32) | (((x) >> 6) & 64) | (((x) >> 7) & 128) | (((x) >> 8) & 256)

#define INT_TRANSITION_COUNT 102
#define MAX_MAP_TRS_PER_INT_TR 8
#define INT_NUMBER_COUNT 9
#define MAX_LETTERS_PER_INT_NUM 13

static const uint16_t int_transitions[INT_TRANSITION_COUNT][MAX_MAP_TRS_PER_INT_TR + 1] = {
    {0, -1, -1, -1, -1, -1, -1, -1, -1},
    {4, 256, 1, 64, -1, -1, -1, -1, -1},
    {2, 128, 8, 32, -1, -1, -1, -1, -1},
    {6, 384, 3, 9, 72, 36, 192, 288, -1},
    {5, 320, 65, 260, -1, -1, -1, -1, -1},
    {34, 160, 10, 136, -1, -1, -1, -1, -1},
    {130, 40, -1, -1, -1, -1, -1, -1, -1},
    {66, 129, 258, 264, 12, 96, 132, 33, -1},
    {68, 257, -1, -1, -1, -1, -1, -1, -1},
    {38, 416, 11, 200, -1, -1, -1, -1, -1},
    {69, 321, 261, 324, -1, -1, -1, -1, -1},
    {42, 168, 138, 162, -1, -1, -1, -1, -1},
    {292, 73, 7, 448, -1, -1, -1, -1, -1},
    {137, 74, 164, 224, 35, 392, 290, 14, -1},
    {98, 161, 266, 140, -1, -1, -1, -1, -1},
    {37, 352, 13, 67, 193, 262, 328, 388, -1},
    {100, 289, 265, 259, 196, 70, 76, 385, -1},
    {131, 194, 134, 104, 41, 296, 386, 44, -1},
    {133, 322, 97, 268, -1, -1, -1, -1, -1},
    {420, 294, 201, 39, 480, 15, 75, 456, -1},
    {325, -1, -1, -1, -1, -1, -1, -1, -1},
    {170, -1, -1, -1, -1, -1, -1, -1, -1},
    {45, 360, 195, 390, -1, -1, -1, -1, -1},
    {169, 106, 172, 226, 163, 394, 298, 142, -1},
    {99, 225, 270, 330, 141, 354, 396, 165, -1},
    {356, 293, 329, 263, 452, 71, 77, 449, -1},
    {102, 417, 267, 204, -1, -1, -1, -1, -1},
    {139, 202, 166, 232, 43, 424, 418, 46, -1},
    {135, 450, 105, 300, -1, -1, -1, -1, -1},
    {228, 291, 393, 78, -1, -1, -1, -1, -1},
    {389, 326, 197, 101, 353, 269, 323, 332, -1},
    {198, 387, 297, 108, -1, -1, -1, -1, -1},
    {457, 79, 484, 295, -1, -1, -1, -1, -1},
    {426, 174, 234, 171, -1, -1, -1, -1, -1},
    {453, 327, 357, 333, -1, -1, -1, -1, -1},
    {203, 422, 488, 47, -1, -1, -1, -1, -1},
    {358, 421, 331, 271, 460, 103, 205, 481, -1},
    {397, 334, 229, 355, -1, -1, -1, -1, -1},
    {458, 143, 482, 428, 302, 233, 167, 107, -1},
    {395, 206, 230, 236, 299, 425, 419, 110, -1},
    {364, 301, 361, 391, 454, 199, 109, 451, -1},
    {362, 173, 398, 227, -1, -1, -1, -1, -1},
    {489, 111, 492, 486, 423, 459, 303, 207, -1},
    {490, 175, 430, 235, -1, -1, -1, -1, -1},
    {461, 335, 485, 359, -1, -1, -1, -1, -1},
    {365, 455, -1, -1, -1, -1, -1, -1, -1},
    {429, 366, 237, 231, 483, 399, 363, 462, -1},
    {427, 238, -1, -1, -1, -1, -1, -1, -1},
    {491, 239, 494, 431, -1, -1, -1, -1, -1},
    {493, 367, 487, 463, -1, -1, -1, -1, -1},
    {495, -1, -1, -1, -1, -1, -1, -1, -1},
    {16, -1, -1, -1, -1, -1, -1, -1, -1},
    {20, 272, 17, 80, -1, -1, -1, -1, -1},
    {18, 144, 24, 48, -1, -1, -1, -1, -1},
    {22, 400, 19, 25, 88, 52, 208, 304, -1},
    {21, 336, 81, 276, -1, -1, -1, -1, -1},
    {50, 176, 26, 152, -1, -1, -1, -1, -1},
    {146, 56, -1, -1, -1, -1, -1, -1, -1},
    {82, 145, 274, 280, 28, 112, 148, 49, -1},
    {84, 273, -1, -1, -1, -1, -1, -1, -1},
    {54, 432, 27, 216, -1, -1, -1, -1, -1},
    {85, 337, 277, 340, -1, -1, -1, -1, -1},
    {58, 184, 154, 178, -1, -1, -1, -1, -1},
    {308, 89, 23, 464, -1, -1, -1, -1, -1},
    {153, 90, 180, 240, 51, 408, 306, 30, -1},
    {114, 177, 282, 156, -1, -1, -1, -1, -1},
    {53, 368, 29, 83, 209, 278, 344, 404, -1},
    {116, 305, 281, 275, 212, 86, 92, 401, -1},
    {147, 210, 150, 120, 57, 312, 402, 60, -1},
    {149, 338, 113, 284, -1, -1, -1, -1, -1},
    {436, 310, 217, 55, 496, 31, 91, 472, -1},
    {341, -1, -1, -1, -1, -1, -1, -1, -1},
    {186, -1, -1, -1, -1, -1, -1, -1, -1},
    {61, 376, 211, 406, -1, -1, -1, -1, -1},
    {185, 122, 188, 242, 179, 410, 314, 158, -1},
    {115, 241, 286, 346, 157, 370, 412, 181, -1},
    {372, 309, 345, 279, 468, 87, 93, 465, -1},
    {118, 433, 283, 220, -1, -1, -1, -1, -1},
    {155, 218, 182, 248, 59, 440, 434, 62, -1},
    {151, 466, 121, 316, -1, -1, -1, -1, -1},
    {244, 307, 409, 94, -1, -1, -1, -1, -1},
    {405, 342, 213, 117, 369, 285, 339, 348, -1},
    {214, 403, 313, 124, -1, -1, -1, -1, -1},
    {473, 95, 500, 311, -1, -1, -1, -1, -1},
    {442, 190, 250, 187, -1, -1, -1, -1, -1},
    {469, 343, 373, 349, -1, -1, -1, -1, -1},
    {219, 438, 504, 63, -1, -1, -1, -1, -1},
    {374, 437, 347, 287, 476, 119, 221, 497, -1},
    {413, 350, 245, 371, -1, -1, -1, -1, -1},
    {474, 159, 498, 444, 318, 249, 183, 123, -1},
    {411, 222, 246, 252, 315, 441, 435, 126, -1},
    {380, 317, 377, 407, 470, 215, 125, 467, -1},
    {378, 189, 414, 243, -1, -1, -1, -1, -1},
    {505, 127, 508, 502, 439, 475, 319, 223, -1},
    {506, 191, 446, 251, -1, -1, -1, -1, -1},
    {477, 351, 501, 375, -1, -1, -1, -1, -1},
    {381, 471, -1, -1, -1, -1, -1, -1, -1},
    {445, 382, 253, 247, 499, 415, 379, 478, -1},
    {443, 254, -1, -1, -1, -1, -1, -1, -1},
    {507, 255, 510, 447, -1, -1, -1, -1, -1},
    {509, 383, 503, 479, -1, -1, -1, -1, -1},
    {511, -1, -1, -1, -1, -1, -1, -1, -1},
};

static const char int_letters[INT_NUMBER_COUNT][MAX_LETTERS_PER_INT_NUM + 1] = {
    {'c', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 'e', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'k', 'n', 0, 0, 0, 0, 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 't', 'w', 'y', 'z', 0},
    {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', 0, 0, 0, 0},
    {'a', 'c', 'e', 'i', 'k', 'n', 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 'e', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
    {'c', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
};

#else

#define TOTAL_MAX_DEPTH (TOTAL_UNKNOWN_CELLS)

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
#define INDENT ("    ")
int current_depth = 0;
#define DPRINTLINEPADDING() { \
    for (int i = 0; i < current_depth; i++) { \
        real_printf(INDENT); \
    } \
}
#define DFPRINTLINEPADDING(stream) { \
    for (int i = 0; i < current_depth; i++) { \
        real_fprintf(stream, INDENT); \
    } \
}
#define printf(...) { \
    for (int i = 0; i < current_depth; i++) { \
        real_printf(INDENT); \
    } \
    real_printf(__VA_ARGS__); \
}
#define fprintf(stream, ...) { \
    for (int i = 0; i < current_depth; i++) { \
        real_fprintf(stream, INDENT); \
    } \
    real_fprintf(stream, __VA_ARGS__); \
}
#else
#define DPRINTLINEPADDING()
#define DFPRINTLINEPADDING(stream)
#endif

int unknown_cells = TOTAL_UNKNOWN_CELLS;
int max_depth = TOTAL_MAX_DEPTH;


#if MULTI_RULE

static inline int unparse_transitions(char* out, int next_char, bool s) {
    int or = s ? (1 << 4) : 0;
    char seen_letters[MAX_LETTERS_PER_INT_NUM + 1];
    int trs_index = 0;
    for (int number = 0; number < 9; number++) {
        int num_letters = 0;
        for (int i = 0; i < MAX_LETTERS_PER_INT_NUM + 1; i++) {
            seen_letters[i] = 0;
        }
        int total_letters = 0;
        for (int i = 0; i < MAX_LETTERS_PER_INT_NUM + 1; i++) {
            char letter = int_letters[number][i];
            if (letter == 0) {
                break;
            }
            total_letters++;
            int tr = int_transitions[trs_index][0] | or;
            if (trs[tr] == 1) {
                seen_letters[num_letters++] = letter;
            }
            trs_index++;
        }
        if (num_letters == 0) {
            continue;
        }
        out[next_char++] = number + '0';
        if (num_letters == total_letters) {
            continue;
        } else if (num_letters > (total_letters % 2 == 0 ? (total_letters / 2) : (total_letters / 2 + 1))) {
            out[next_char++] = '-';
            for (int i = 0; i < total_letters; i++) {
                char letter = int_letters[number][i];
                if (!strchr(seen_letters, letter)) {
                    out[next_char++] = letter;
                }
            }
        } else {
            for (int i = 0; i < num_letters; i++) {
                out[next_char++] = seen_letters[i];
            }
        }
    }
    return next_char;
}

static inline void get_rule(char* out) {
    int next_char = 0;
    out[next_char++] = 'B';
    next_char = unparse_transitions(out, next_char, false);
    out[next_char++] = '/';
    out[next_char++] = 'S';
    next_char = unparse_transitions(out, next_char, true);
}

#endif


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
                cell->var = initial_vars[t][y][x];
                #if TIME_WRAP
                if (t == 0) {
                    if (y + TIME_WRAP_DY < 0 || y + TIME_WRAP_DY >= HEIGHT || x + TIME_WRAP_DX < 0 || x + TIME_WRAP_DX >= WIDTH) {
                        cell->value = 0;
                        cell->var = 0;
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
                        cell->var = 0;
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

// sets the next_in_search_order fields in all the cells
// returns the first cell in the search order
static inline cell* add_search_orders(void) {
    index_t* coords = search_order[0];
    index_t t = coords[0];
    index_t x = coords[1];
    index_t y = coords[2];
    cell* prev = &grid[t][y][x];
    cell* out = prev;
    for (int i = 1; i < unknown_cells; i++) {
        index_t* coords = search_order[i];
        index_t t = coords[0];
        index_t x = coords[1];
        index_t y = coords[2];
        // printf("i = %i, t = %i, x = %i, y = %i\n", i, t, x, y);
        cell* cell = &grid[t][y][x];
        prev->next_in_search_order = cell;
        prev = cell;
    }
    prev->next_in_search_order = NULL;
    return out;
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
        cell->value = value;
        set_cells--;
        #ifdef SPECIAL_PHASE_0_POP
        if (t == 0 && value == 1) {
            phase_0_pop--;
            if (phase_0_pop > MAXPOP) {
                return false;
            }
        }
        #endif
        #if TRACK_PHASE_POPS
        if (value == 1) {
            phase_pops[t]++;
        }
        #endif
        sp--;
        if (stack[sp].is_first_in_frame) {
            break;
        }
    }
    DPRINTF4("Pop complete\n");
}

// set a cell to a value, taking care of edges and filters but not propagating implications
// returns true if no contradiction, false if contradiction
// also pushes an entry to the stack
static inline bool set_cell(cell* cell, cell_value_t value) {
    if (IS_KNOWN(cell->value) && cell->value != value) {
        DPRINTF4("Contradiction (previous value mismatch, both known and unequal, t = %i, x = %i, y = %i, value = %i, prev_value = %i)\n", cell->t, cell->x, cell->y, value, cell->value);
        return false;
    } else if (cell->value == value) {
        return true;
    }
    #ifdef SPECIAL_PHASE_0_POP
    if (t == 0 && value == 1) {
        phase_0_pop++;
        if (phase_0_pop > MAXPOP) {
            return false;
        }
    }
    #endif
    #if TRACK_PHASE_POPS
    if (value == 1) {
        phase_pops[t]++;
    }
    #endif
    stack[sp].is_first_in_frame = next_stack_entry_is_first_in_frame;
    next_stack_entry_is_first_in_frame = false;
    DPRINTF4("Setting cell: t = %i, x = %i, y = %i, index = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, cell->index, value, cell->value);
    stack[sp].cell = cell;
    sp++;
    set_cells++;
    cell->value = value;
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


static const char* letters = ".o*ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz123456789";

static inline void print_cell(FILE* stream, cell_value_t value, var_t var) {
    if (value == 2) {
        if (var > 0) {
            value = 2 + var;
        }
    }
    if (value < 64) {
        real_fprintf(stream, "%c", letters[value]);
    } else {
        real_fprintf(stream, "(%i)", value);
    }
}

static inline void print_grid(FILE* stream) {
    #if MULTI_RULE
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = '\0';
    }
    get_rule(rule);
    fprintf(stream, "Grid (rule = %s, set_cells = %i):\n", rule, set_cells);
    #else
    fprintf(stream, "Grid (set_cells = %i):\n", set_cells);
    #endif
    for (index_t t = 0; t < GENS; t++) {
        for (index_t y = 0; y < HEIGHT; y++) {
            DFPRINTLINEPADDING(stream);
            for (index_t x = 0; x < WIDTH; x++) {
                cell* cell = &grid[t][y][x];
                print_cell(stream, cell->value, cell->var);
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
