
// defines the core searching algorithm

#pragma once

#include "params2.h"
#include "base.c"

#if MULTI_RULE
#include <stdio.h>
#endif


#if MULTI_RULE

#if BINDS == BINDS_INT

#define BOUND_TRANSITION_COUNT 102
#define MAX_MAP_TRS_PER_BOUND_TR 8
#define bound_trs int_transitions
static const char* bound_trs_names[BOUND_TRANSITION_COUNT] = {"B0", "B1c", "B1e", "B2a", "B2c", "B2e", "B2i", "B2k", "B2n", "B3a", "B3c", "B3e", "B3i", "B3j", "B3k", "B3n", "B3q", "B3r", "B3y", "B4a", "B4c", "B4e", "B4i", "B4j", "B4k", "B4n", "B4q", "B4r", "B4t", "B4w", "B4y", "B4z", "B5a", "B5c", "B5e", "B5i", "B5j", "B5k", "B5n", "B5q", "B5r", "B5y", "B6a", "B6c", "B6e", "B6i", "B6k", "B6n", "B7c", "B7e", "B8", "S0", "S1c", "S1e", "S2a", "S2c", "S2e", "S2i", "S2k", "S2n", "S3a", "S3c", "S3e", "S3i", "S3j", "S3k", "S3n", "S3q", "S3r", "S3y", "S4a", "S4c", "S4e", "S4i", "S4j", "S4k", "S4n", "S4q", "S4r", "S4t", "S4w", "S4y", "S4z", "S5a", "S5c", "S5e", "S5i", "S5j", "S5k", "S5n", "S5q", "S5r", "S5y", "S6a", "S6c", "S6e", "S6i", "S6k", "S6n", "S7c", "S7e", "S8"};

#elif BINDS == BINDS_OT

#define BOUND_TRANSITION_COUNT 18
#define MAX_MAP_TRS_PER_BOUND_TR 70
static const int16_t bound_trs[BOUND_TRANSITION_COUNT][MAX_MAP_TRS_PER_BOUND_TR + 1] = {
    {0, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {4, 256, 1, 64, 2, 128, 8, 32, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {6, 384, 3, 9, 72, 36, 192, 288, 5, 320, 65, 260, 34, 160, 10, 136, 130, 40, 66, 129, 258, 264, 12, 96, 132, 33, 68, 257, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {38, 416, 11, 200, 69, 321, 261, 324, 42, 168, 138, 162, 292, 73, 7, 448, 137, 74, 164, 224, 35, 392, 290, 14, 98, 161, 266, 140, 37, 352, 13, 67, 193, 262, 328, 388, 100, 289, 265, 259, 196, 70, 76, 385, 131, 194, 134, 104, 41, 296, 386, 44, 133, 322, 97, 268, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {420, 294, 201, 39, 480, 15, 75, 456, 325, 170, 45, 360, 195, 390, 169, 106, 172, 226, 163, 394, 298, 142, 99, 225, 270, 330, 141, 354, 396, 165, 356, 293, 329, 263, 452, 71, 77, 449, 102, 417, 267, 204, 139, 202, 166, 232, 43, 424, 418, 46, 135, 450, 105, 300, 228, 291, 393, 78, 389, 326, 197, 101, 353, 269, 323, 332, 198, 387, 297, 108, -1},
    {457, 79, 484, 295, 426, 174, 234, 171, 453, 327, 357, 333, 203, 422, 488, 47, 358, 421, 331, 271, 460, 103, 205, 481, 397, 334, 229, 355, 458, 143, 482, 428, 302, 233, 167, 107, 395, 206, 230, 236, 299, 425, 419, 110, 364, 301, 361, 391, 454, 199, 109, 451, 362, 173, 398, 227, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {489, 111, 492, 486, 423, 459, 303, 207, 490, 175, 430, 235, 461, 335, 485, 359, 365, 455, 429, 366, 237, 231, 483, 399, 363, 462, 427, 238, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {491, 239, 494, 431, 493, 367, 487, 463, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {495, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {16, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {20, 272, 17, 80, 18, 144, 24, 48, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {22, 400, 19, 25, 88, 52, 208, 304, 21, 336, 81, 276, 50, 176, 26, 152, 146, 56, 82, 145, 274, 280, 28, 112, 148, 49, 84, 273, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {54, 432, 27, 216, 85, 337, 277, 340, 58, 184, 154, 178, 308, 89, 23, 464, 153, 90, 180, 240, 51, 408, 306, 30, 114, 177, 282, 156, 53, 368, 29, 83, 209, 278, 344, 404, 116, 305, 281, 275, 212, 86, 92, 401, 147, 210, 150, 120, 57, 312, 402, 60, 149, 338, 113, 284, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {436, 310, 217, 55, 496, 31, 91, 472, 341, 186, 61, 376, 211, 406, 185, 122, 188, 242, 179, 410, 314, 158, 115, 241, 286, 346, 157, 370, 412, 181, 372, 309, 345, 279, 468, 87, 93, 465, 118, 433, 283, 220, 155, 218, 182, 248, 59, 440, 434, 62, 151, 466, 121, 316, 244, 307, 409, 94, 405, 342, 213, 117, 369, 285, 339, 348, 214, 403, 313, 124, -1},
    {473, 95, 500, 311, 442, 190, 250, 187, 469, 343, 373, 349, 219, 438, 504, 63, 374, 437, 347, 287, 476, 119, 221, 497, 413, 350, 245, 371, 474, 159, 498, 444, 318, 249, 183, 123, 411, 222, 246, 252, 315, 441, 435, 126, 380, 317, 377, 407, 470, 215, 125, 467, 378, 189, 414, 243, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {505, 127, 508, 502, 439, 475, 319, 223, 506, 191, 446, 251, 477, 351, 501, 375, 381, 471, 445, 382, 253, 247, 499, 415, 379, 478, 443, 254, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {507, 255, 510, 447, 509, 383, 503, 479, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
    {511, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1},
};
static const char* bound_trs_names[BOUND_TRANSITION_COUNT] = {"B0", "B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8", "S0", "S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"};

#elif BINDS == BINDS_CUSTOM

#define BOUND_TRANSITION_COUNT

#endif

#endif


// implication table
// tells us what values of unknown cells we can set
// index format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// 01 67 cd
// 23 89 ef -> ij
// 45 ab gh
// return value is a uint32_t of the same format as the index
// do nothing = 0 = UNKNOWN, set off = 1 = OFF, set on = 2 = ON
// (this is disabled actually) but with an optional 21st bit that represents whether any neighbors are set or only the result is
// and special CONTRADICTION and IMPLICATION_RULE_DEPENDENT values
int32_t implications[1048576];

#define DO_NOTHING 0
#define CONTRADICTION -1
#define IMPLICATION_RULE_DEPENDENT -3

static inline uint32_t tr_to_implication_tr(uint32_t tr) {
    uint32_t out = 0;
    out |= ((tr & 1) ? ON : OFF) << 2;
    out |= ((tr & 2) ? ON : OFF) << 4;
    out |= ((tr & 4) ? ON : OFF) << 6;
    out |= ((tr & 8) ? ON : OFF) << 8;
    out |= ((tr & 16) ? ON : OFF) << 10;
    out |= ((tr & 32) ? ON : OFF) << 12;
    out |= ((tr & 64) ? ON : OFF) << 14;
    out |= ((tr & 128) ? ON : OFF) << 16;
    out |= ((tr & 256) ? ON : OFF) << 18;
    return out;
}

#if false
#include <stdio.h>
#define IMPLICATIONSPECIALVALUE 349524
#define IMPLICATIONDPRINTF(...) if (tr == IMPLICATIONSPECIALVALUE) {printf(__VA_ARGS__);}
#define IMPLICATIONDPRINTF2(value, ...) if ((value) == IMPLICATIONSPECIALVALUE) {printf(__VA_ARGS__);}
#else
#define IMPLICATIONDPRINTF(...)
#define IMPLICATIONDPRINTF2(...)
#endif

static inline int32_t get_implication(uint32_t tr) {
    int next = tr & 3;
    IMPLICATIONDPRINTF("tr = %i, next = %i\n", tr, next);
    int32_t out = DO_NOTHING;
    // find the value for the next generation
    if (next == UNKNOWN) {
        bool zero_possible = implications[(tr & ~3) | OFF] != CONTRADICTION;
        bool one_possible = implications[(tr & ~3) | ON] != CONTRADICTION;
        IMPLICATIONDPRINTF("checking next, (zero: %i -> %i -> %s, one: %i -> %i -> %s\n", (tr & ~3) | OFF, implications[(tr & ~3) | OFF], zero_possible ? "true" : "false", (tr & ~3) | ON, implications[(tr & ~3) | ON], one_possible ? "true" : "false");
        if (!zero_possible && !one_possible) {
            // the cell cannot be any value in the next generation
            IMPLICATIONDPRINTF("early contradiction, next cell cannot be any value, returning CONTRADICTION\n");
        } else if (zero_possible && !one_possible) {
            // must be off
            IMPLICATIONDPRINTF("next cell must be off\n");
            out = (out & ~3) | OFF;
            tr = (tr & ~3) | OFF;
            next = OFF;
        } else if (!zero_possible && one_possible) {
            // must be on
            IMPLICATIONDPRINTF("next cell must be on\n");
            out = (out & ~3) | ON;
            tr = (tr & ~3) | ON;
            next = ON;
        } else if (zero_possible && one_possible) {
            // if we can't infer the correct cell value in the next generation, nothing can be implied
            IMPLICATIONDPRINTF("no implication possible, next cell can be any value, returning DO_NOTHING\n");
            return DO_NOTHING;
        }
    }
    IMPLICATIONDPRINTF("resolved next = %i\n", next);
    for (int i = 2; i < 20; i += 2) {
        if (((tr >> i) & 3) != UNKNOWN) {
            continue;
        }
        uint32_t tr2 = tr & ~(3 << i);
        int32_t forward_0 = implications[tr2 | (OFF << i)];
        bool zero_possible = (forward_0 != CONTRADICTION) && ((forward_0 & 3) == next || (forward_0 & 3) == UNKNOWN);
        int32_t forward_1 = implications[tr2 | (ON << i)];
        bool one_possible = (forward_1 != CONTRADICTION) && ((forward_1 & 3) == next || (forward_1 & 3) == UNKNOWN);
        IMPLICATIONDPRINTF("i = %i, tr2 = %i, zero: %i -> %i -> %s, one: %i -> %i -> %s, tr & 3 = %i\n", i, tr2, tr2 | (OFF << i), forward_0, zero_possible ? "true" : "false", tr2 | (ON << i), forward_1, one_possible ? "true" : "false", tr & 3);
        if (one_possible && !zero_possible) {
            // must be on
            IMPLICATIONDPRINTF("must be on\n");
            out = (out & ~(3 << i)) | (ON << i);
        } else if (zero_possible && !one_possible) {
            // must be off
            IMPLICATIONDPRINTF("must be off\n");
            out = (out & ~(3 << i)) | (OFF << i);
        } else if (!zero_possible && !one_possible) {
            // contradiction
            IMPLICATIONDPRINTF("contradiction detected, returning CONTRADICTION\n");
            return CONTRADICTION;
        }
    }
    IMPLICATIONDPRINTF("result: %i -> %i\n", tr, out);
    return out;
}

static inline void generate_big_trs(void) {
    // fill in the values with 0 unknown cells
    for (int tr = 0; tr < 512; tr++) {
        int value = trs[tr] ? ON : OFF;
        int tr2 = tr_to_implication_tr(tr);
        implications[tr2 | OFF] = value == OFF ? 0 : CONTRADICTION;
        IMPLICATIONDPRINTF2(tr2 | OFF, "tr = %i, value = %i, result = %i\n", tr2 | OFF, value, implications[tr2 | OFF]);
        implications[tr2 | ON] = value == ON ? 0 : CONTRADICTION;
        IMPLICATIONDPRINTF2(tr2 | ON, "tr = %i, value = %i, result = %i\n", tr2 | ON, value, implications[tr2 | ON]);
    }
    // fill in the rest
    for (int unknown = 1; unknown < 8; unknown++) {
        for (uint32_t tr = 0; tr < 1048576; tr++) {
            int tr_unknown = 0;
            bool found = false;
            for (int i = 0; i < 20; i += 2) {
                int part = (tr >> i) & 3;
                if (part == 3) {
                    found = true;
                    break;
                } else if (part == UNKNOWN) {
                    tr_unknown++;
                    if (tr_unknown > unknown) {
                        break;
                    }
                }
            }
            if (found) {
                implications[tr] = CONTRADICTION;
            } else if (tr_unknown != unknown) {
                continue;
            }
            implications[tr] = get_implication(tr);
        }
    }
    #if MULTI_RULE
    for (uint32_t tr = 0; tr < 512; tr++) {
        if (trs[tr] == 3) {
            uint32_t tr2 = tr_to_big_tr(tr) << 2;
            implications[tr2 | OFF] = IMPLICATION_RULE_DEPENDENT;
            implications[tr2 | ON] = IMPLICATION_RULE_DEPENDENT;
        }
    }
    #endif
}


static bool set_cell_and_propagate(cell* cell, cell_value_t value);

#if MULTI_RULE
// the transition that caused the most recent rule-dependent "contradiction"
// or -1 if it wasn't rule-dependent
int32_t rule_dependent_tr = -1;
#endif

// returns false if contradiction, true if no contradiction
static inline __attribute__((always_inline)) bool check_implication(cell* cell) {
    if (cell == NULL) {
        DPRINTF4("Contradiction (implication, cell == NULL)\n");
        return false;
    }
    #if !TIME_WRAP
    if (cell->next == NULL) {
        DPRINTF4("Contradiction (implication, cell->next == NULL)\n");
        return false;
    }
    #endif
    if (cell->x == 0 || cell->y == 0 || cell->x == WIDTH - 1 || cell->y == HEIGHT - 1) {
        if (cell->next == NULL) {
            return true;
        }
        if (cell->next->value == UNKNOWN) {
            set_cell_and_propagate(cell->next, 0);
        } else if (cell->next->value == OFF) {
            return true;
        } else {
            return false;
        }
    }
    uint32_t tr = 
            (cell->nw->value << 18)
          | (cell->w->value << 16)
          | (cell->sw->value << 14)
          | (cell->n->value << 12)
          | (cell->value << 10)
          | (cell->s->value << 8)
          | (cell->ne->value << 6)
          | (cell->e->value << 4)
          | (cell->se->value << 2)
          | (cell->next->value << 0);
    int32_t value = implications[tr];
    DPRINTF4("Implication: t = %i, x = %i, y = %i, tr = %i, value = %i\n", cell->t, cell->x, cell->y, tr, (int)value);
    if (value == DO_NOTHING) {
        return true;
    } else if (value == CONTRADICTION) {
        DPRINTGRID4();
        DPRINTF4("Contradiction (implication, value = CONTRADICTION, tr = %i, t = %i, x = %i, y = %i)\n", tr, cell->t, cell->x, cell->y);
        return false;
    }
    #if MULTI_RULE
    if (value == IMPLICATION_RULE_DEPENDENT) {
        rule_dependent_tr =
                ((cell->nw->value == ON ? 1 : 0) << 8)
              | ((cell->w->value == ON ? 1 : 0) << 7)
              | ((cell->sw->value == ON ? 1 : 0) << 6)
              | ((cell->n->value == ON ? 1 : 0) << 5)
              | ((cell->value == ON ? 1 : 0) << 4)
              | ((cell->s->value == ON ? 1 : 0) << 3)
              | ((cell->ne->value == ON ? 1 : 0) << 2)
              | ((cell->e->value == ON ? 1 : 0) << 1)
              | ((cell->se->value == ON ? 1 : 0) << 0);
        return false;
    }
    #endif
    #define check(cell, place) \
        if (value & (3 << place)) { \
            if (!set_cell_and_propagate((cell), ((value >> (place)) & 3))) { \
                return false; \
            } \
        }
    check(cell, 10);
    check(cell->next, 0);
    if ((value & 0b11111111001111111100) == 0) {
        return true;
    }
    check(cell->se, 2);
    check(cell->e, 4);
    check(cell->ne, 6);
    check(cell->s, 8);
    check(cell->n, 12);
    check(cell->sw, 14);
    check(cell->w, 16);
    check(cell->nw, 18);
    #undef check
    return true;
}

static inline bool check_implications(cell* cell) {
    return check_implication((cell))
        && check_implication((cell)->prev)
        && check_implication((cell)->nw)
        && check_implication((cell)->n)
        && check_implication((cell)->ne)
        && check_implication((cell)->w)
        && check_implication((cell)->e)
        && check_implication((cell)->sw)
        && check_implication((cell)->s)
        && check_implication((cell)->se);
}


#if VARIABLES
cell_value_t prev_values[MAX_VAR_USES];
#endif

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(cell* cell, cell_value_t value) {
    DPRINTF4("Setting cell and propagating: t = %i, x = %i, y = %i, value = %i, prev_value = %i\n", cell->t, cell->x, cell->y, value, cell->value);
    DPRINTGRID4();
    if (cell->value != UNKNOWN) {
        #if DEBUG >= 4
        if (cell->value != value) {
            DPRINTF4("Contradiction (previous value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
        }
        #endif
        return cell->value == value;
    }
    #if VARIABLES
    else if (cell->var == 0) {
        if (!set_cell(cell, value)) {
            return false;
        }
        return check_implications(cell);
    }
    var_t var = cell->var;
    DPRINTF3("Setting variable %i to %i (t = %i, x = %i, y = %i)\n", var, value, cell->t, cell->x, cell->y);
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        prev_values[use] = cell->value;
        if (cell->value != UNKNOWN) {
            if (cell->value != value) {
                DPRINTF4("Contradiction (previous variable value mismatch, value = %i, prev_value = %i)\n", value, cell->value);
                return false;
            }
        } else {
            if (!set_cell(cell, value)) {
                return false;
            }
        }
    }
    DPRINTF4("Checking variable set implications\n");
    for (index_t use = 0; use < num_var_uses[var]; use++) {
        struct cell* cell = var_uses[var][use];
        DPRINTF4("Read variable data: t = %i, x = %i, y = %i\n", cell->t, cell->x, cell->y);
        if (prev_values[use] == UNKNOWN) {
            if (!check_implications(cell)) {
                return false;
            }
        }
    }
    return true;
    #else
    if (!set_cell(cell, value)) {
        return false;
    }
    return check_implications(cell);
    #endif
}


#if MULTI_RULE

#include <stdlib.h>

int tr_to_bound_tr[512];

static inline void init_tr_to_bound_tr() {
    for (int tr = 0; tr < 512; tr++) {
        bool found = false;
        for (int i = 0; i < BOUND_TRANSITION_COUNT; i++) {
            for (int j = 0; j < MAX_MAP_TRS_PER_BOUND_TR; j++) {
                int value = bound_trs[i][j];
                if (value == -1) {
                    break;
                } else if (value == tr) {
                    found = true;
                    break;
                }
            }
            if (found) {
                tr_to_bound_tr[tr] = i;
                break;
            }
        }
        if (!found) {
            fprintf(stderr, "Error: This error should not occur (nonexistent transition in init_multi_rule: %i)\nPlease report this error\n", tr);
            exit(1);
        }
    }
}

static inline void set_tr(int tr, int value) {
    DPRINTF3("Setting transition %i to %i\n", tr, value);
    for (int i = 0; i < MAX_MAP_TRS_PER_BOUND_TR + 1; i++) {
        int tr2 = bound_trs[tr_to_bound_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        trs[tr2] = value;
        big_trs[tr_to_big_tr(tr2)] = value;
    }
    // i'm not sure if you need to do this
    // so i hope you don't
    // for (int i = 0; i < 262144; i++) {
    //     if (IS_BIG_TRS_RULE_DEPENDENT(big_trs[i])) {
    //         big_trs[i] = get_big_tr(0, i, 0);
    //     }
    // }
    for (int i = 0; i < MAX_MAP_TRS_PER_BOUND_TR + 1; i++) {
        int tr2 = bound_trs[tr_to_bound_tr[tr]][i];
        if (tr2 == -1) {
            break;
        }
        if (tr & (1 << 4)) {
            tr2 |= (1 << 4);
        }
        uint32_t tr3 = tr_to_big_tr((uint32_t)tr2) << 2;
        if (value == 3) {
            implications[tr3 | OFF] = IMPLICATION_RULE_DEPENDENT;
            implications[tr3 | ON] = IMPLICATION_RULE_DEPENDENT;
        } else {
            implications[tr3 | OFF] = get_implication(tr3 | OFF);
            implications[tr3 | ON] = get_implication(tr3 | ON);
        }
    }
}

#endif
