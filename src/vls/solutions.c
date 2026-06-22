
// defines functions to report solutions

#pragma once

#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include <time.h>



#ifndef BENCHMARK
static uint64_t solutions_found;
#endif

static uint64_t branches;

#if FILTER_DUPLICATES

typedef struct bb_t {
    int height;
    int width;
    int x_offset;
    int y_offset;
} bb_t;

static inline void get_true_bb(bb_t* bb, grid_item_t* grid) {
    bb->height = HEIGHT - 4;
    bb->width = WIDTH - 4;
    bb->x_offset = 2;
    bb->y_offset = 2;
    #define get(x, y) (grid[(y) + bb->y_offset][(x) + bb->x_offset])
    // top
    int shrink_top = 0;
    for (int y = 0; y < bb->height; y++) {
        bool found = false;
        for (int x = 0; x < bb->width; x++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_top++;
        }
    }
    bb->height -= shrink_top;
    bb->y_offset += shrink_top;
    // bottom
    int shrink_bottom = 0;
    for (int y = bb->height - 1; y >= 0; y--) {
        bool found = false;
        for (int x = 0; x < bb->width; x++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_bottom++;
        }
    }
    bb->height -= shrink_bottom;
    // left
    int shrink_left = 0;
    for (int x = 0; x < bb->width; x++) {
        bool found = false;
        for (int y = 0; y < bb->height; y++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_left++;
        }
    }
    bb->width -= shrink_left;
    bb->x_offset += shrink_left;
    // right
    int shrink_right = 0;
    for (int x = bb->width - 1; x >= 0; x--) {
        bool found = false;
        for (int y = 0; y < bb->height; y++) {
            if (get(x, y) != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        } else {
            shrink_right++;
        }
    }
    bb->width -= shrink_right;
    #undef get
}

typedef uint64_t hash_t;

static inline hash_t min_hash(hash_t a, hash_t b) {
    return a < b ? a : b;
}

typedef enum axis_trans_t {
    POS_X,
    POS_Y,
    NEG_X,
    NEG_Y,
} axis_trans_t;

static inline void transform_coords(bb_t* bb, int x, int y, axis_trans_t x_trans, axis_trans_t y_trans, int* x_out, int* y_out) {
    if (x_trans == POS_X) {
        *x_out = x;
    } else if (x_trans == POS_Y) {
        *x_out = y;
    } else if (x_trans == NEG_X) {
        *x_out = bb->width - x - 1;
    } else if (x_trans == NEG_Y) {
        *x_out = bb->width - y - 1;
    }
    if (y_trans == POS_X) {
        *y_out = x;
    } else if (y_trans == POS_Y) {
        *y_out = y;
    } else if (y_trans == NEG_X) {
        *y_out = bb->height - x - 1;
    } else if (y_trans == NEG_Y) {
        *y_out = bb->height - y - 1;
    }
    *x_out += bb->x_offset;
    *y_out += bb->y_offset;
}

#define HASH_OFFSET (0xcbf29ce484222325ULL)
#define HASH_PRIME (0x00000100000001b3ULL)

#if MULTI_RULE

static bb_t zero_bb = {0, 0, 0, 0};

static inline hash_t hash_with_offset(int offset, axis_trans_t x_trans, axis_trans_t y_trans) {
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    hash_t out = HASH_OFFSET;
    bb_t bb;
    get_true_bb(&bb, grid[GENS - offset]);
    int x_offset_0 = bb.x_offset;
    int y_offset_0 = bb.y_offset;
    for (int fake_t = 0; fake_t < GENS; fake_t++) {
        int t = (fake_t + offset) % GENS;
        get_true_bb(&bb, grid[t]);
        // printf("t = %i, height = %i, width = %i, x_offset = %i, y_offset = %i\n", t, bb.height, bb.width, bb.x_offset, bb.y_offset);
        int height = bb.height;
        int width = bb.width;
        int x_offset = bb.x_offset;
        int y_offset = bb.y_offset;
        if (transpose) {
            int temp = height;
            height = width;
            width = temp;
            temp = x_offset;
            x_offset = y_offset;
            y_offset = temp;
        }
        out ^= height;
        out *= HASH_PRIME;
        out ^= width;
        out *= HASH_PRIME;
        int dx = x_offset - x_offset_0;
        int dy = y_offset - y_offset_0;
        int dx2 = 0;
        int dy2 = 0;
        transform_coords(&zero_bb, dx, dy, x_trans, y_trans, &dx2, &dy2);
        out ^= dx2;
        out *= HASH_PRIME;
        out ^= dy2;
        out *= HASH_PRIME;
        for (int y = 0; y < height; y++) {
            for (int x = 0; x < width; x++) {
                int real_x = 0;
                int real_y = 0;
                transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
                out ^= grid[t][real_y][real_x];
                out *= HASH_PRIME;
            }
        }
    }
    // printf("value: %"PRIu64"\n", out);
    return out;
}

static inline hash_t hash(axis_trans_t x_trans, axis_trans_t y_trans) {
    // printf("x_trans = %i, y_trans = %i, offset = %i:\n", x_trans, y_trans, 0);
    hash_t out = hash_with_offset(0, x_trans, y_trans);
    #if FILTER_EVERY_PHASE
    for (int offset = 1; offset < GENS; offset++) {
        // printf("x_trans = %i, y_trans = %i, offset = %i:\n", x_trans, y_trans, offset);
        out = min_hash(out, hash_with_offset(offset, x_trans, y_trans));
    }
    #endif
    return out;
}

static inline hash_t hash_state() {
    hash_t out = hash(POS_X, POS_Y);
    out = min_hash(out, hash(POS_X, NEG_Y));
    out = min_hash(out, hash(NEG_X, POS_Y));
    out = min_hash(out, hash(NEG_X, NEG_Y));
    out = min_hash(out, hash(POS_Y, POS_X));
    out = min_hash(out, hash(POS_Y, NEG_X));
    out = min_hash(out, hash(NEG_Y, POS_X));
    out = min_hash(out, hash(NEG_Y, NEG_X));
    return out;
}

#else

static inline hash_t hash(grid_item_t* grid, bb_t* bb, axis_trans_t x_trans, axis_trans_t y_trans) {
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    int height = bb->height;
    int width = bb->width;
    if (transpose) {
        int temp = height;
        height = width;
        width = temp;
    }
    hash_t out = HASH_OFFSET;
    out ^= bb->height;
    out *= HASH_PRIME;
    out ^= bb->width;
    out *= HASH_PRIME;
    for (int y = 0; y < height; y++) {
        for (int x = 0; x < width; x++) {
            int real_x = 0;
            int real_y = 0;
            transform_coords(bb, x, y, x_trans, y_trans, &real_x, &real_y);
            out ^= grid[real_y][real_x];
            out *= HASH_PRIME;
        }
    }
    return out;
}

static inline hash_t octohash(grid_item_t* grid) {
    bb_t bb;
    get_true_bb(&bb, grid);
    hash_t out = hash(grid, &bb, POS_X, POS_Y);
    out = min_hash(out, hash(grid, &bb, POS_X, NEG_Y));
    out = min_hash(out, hash(grid, &bb, NEG_X, POS_Y));
    out = min_hash(out, hash(grid, &bb, NEG_X, NEG_Y));
    out = min_hash(out, hash(grid, &bb, POS_Y, POS_X));
    out = min_hash(out, hash(grid, &bb, POS_Y, NEG_X));
    out = min_hash(out, hash(grid, &bb, NEG_Y, POS_X));
    out = min_hash(out, hash(grid, &bb, NEG_Y, NEG_X));
    return out;
}

static inline hash_t hash_state() {
    hash_t out = octohash(grid[0]);
    #if FILTER_EVERY_PHASE
    for (int i = 1; i < GENS; i++) {
        out = min_hash(out, octohash(grid[i]));
    }
    #endif
    return out;
}

#endif

static hash_t known_solutions[1048576];

static inline void init_known_solutions(void) {
    for (int i = 0; i < sizeof(known_solutions) / sizeof(hash_t); i++) {
        known_solutions[i] = 0;
    }
}

#endif

static inline void print_progress(FILE* stream, int depth);

static inline void print_solution(bool preprocessing, int depth) {
    #ifndef BENCHMARK
    DPRINTF2("Checking solution:\n");
    DPRINTGRID2();
    #if CHECK_EMPTY
    bool found = false;
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            if (grid[0][y][x] != 0) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        DPRINTF2("Dropping solution (empty)\n");
        if (preprocessing) {
            printf("Solved in preprocessing, 0 solutions\n");
        }
        return;
    }
    #endif
    #if SOLUTION_FILTERING
    if (!solution_filter()) {
        DPRINTF2("Dropping solution (filtered)\n");
        return;
    }
    #endif
    #if FILTER_DUPLICATES
    hash_t hash = hash_state();
    for (int i = 0; i < solutions_found; i++) {
        hash_t value = known_solutions[i];
        if (value == 0) {
            break;
        }
        if (hash == value) {
            DPRINTF2("Dropping solution (equal to solution %i)\n", i);
            return;
        }
    }
    if (solutions_found < sizeof(known_solutions) / sizeof(hash_t)) {
        known_solutions[solutions_found] = hash;
    }
    #endif
    solutions_found++;
    #if SHOW_SOLUTIONS
    #if MULTI_RULE
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = 0;
    }
    get_rule(rule);
    #else
    char* rule = RULE;
    #endif
    if (preprocessing) {
        printf("Solved in preprocessing, 1 solution:\nx = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE"\n", rule);
    } else {
        printf("Solution found:\n");
        printf("x = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE"\n", rule);
    }
    int last_y = HEIGHT - (BOTTOM == NONE ? 2 : 1);
    for (int y = (TOP == NONE ? 2 : 1); y < last_y; y++) {
        DPRINTLINEPADDING();
        for (int x = (LEFT == NONE ? 2 : 1); x < WIDTH - (RIGHT == NONE ? 2 : 1); x++) {
            cell_t value = grid[0][y][x];
            if (value > 1) {
                fprintf(stderr, "\n");
                print_grid(stderr);
                fprintf(stderr, "\nStatus: ");
                // print_progress(stderr, depth, 70);
                print_progress(stderr, depth);
                fprintf(stderr, "\nError: This error should not occur (unknown cell in solution)\nPlease report this error along with the debug information printed above\n");
                exit(1);
            }
            real_printf("%c", value ? 'o' : '.');
        }
        if (y == last_y - 1) {
            real_printf("!\n");
        } else {
            real_printf("$\n");
        }
    }
    #endif
    #endif
    #ifdef MAX_SOLUTIONS
    if (solutions_found > MAX_SOLUTIONS) {
        printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches (exited early, max solution count reached)\n", solutions_found, get_time() - start, branches);
        exit(0);
    }
    #endif
}

