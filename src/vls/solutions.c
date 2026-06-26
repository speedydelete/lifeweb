
// defines functions to report solutions

#pragma once

#include <stdlib.h>
#include <time.h>

#include "params2.h"
#include "base.c"


uint64_t solutions_found;

uint64_t branches;


typedef struct bb_t {
    index_t height;
    index_t width;
    index_t x_offset;
    index_t y_offset;
} bb_t;

static inline void get_true_bb(bb_t* bb, cell_value_t t) {
    bb->height = HEIGHT;
    bb->width = WIDTH;
    bb->x_offset = 0;
    bb->y_offset = 0;
    // top
    index_t shrink_top = 0;
    for (int y = 0; y < HEIGHT; y++) {
        bool found = false;
        for (int x = 0; x < WIDTH; x++) {
            if (grid[t][y][x].value != 0) {
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
    index_t shrink_bottom = 0;
    for (int y = HEIGHT - 1; y >= 0; y--) {
        bool found = false;
        for (int x = 0; x < WIDTH; x++) {
            if (grid[t][y][x].value != 0) {
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
    index_t shrink_left = 0;
    for (int x = 0; x < WIDTH; x++) {
        bool found = false;
        for (int y = 0; y < HEIGHT; y++) {
            if (grid[t][y][x].value != 0) {
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
    index_t shrink_right = 0;
    for (int x = WIDTH - 1; x >= 0; x--) {
        bool found = false;
        for (int y = 0; y < HEIGHT; y++) {
            if (grid[t][y][x].value != 0) {
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

static inline void transform_coords(const bb_t* bb, int x, int y, axis_trans_t x_trans, axis_trans_t y_trans, int* x_out, int* y_out) {
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

static inline hash_t hash_at_time(int t, axis_trans_t x_trans, axis_trans_t y_trans) {
    bb_t bb;
    get_true_bb(&bb, t);
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    index_t height = bb.height;
    index_t width = bb.width;
    // printf("height = %i, width = %i, x_offset = %i, y_offset = %i\n", height, width, bb.x_offset, bb.y_offset);
    if (transpose) {
        index_t temp = height;
        height = width;
        width = temp;
    }
    hash_t out = HASH_OFFSET;
    out ^= height;
    out *= HASH_PRIME;
    out ^= width;
    out *= HASH_PRIME;
    for (index_t y = 0; y < height; y++) {
        for (index_t x = 0; x < width; x++) {
            int real_x = 0;
            int real_y = 0;
            transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
            out ^= grid[t][real_y][real_x].value;
            out *= HASH_PRIME;
        }
    }
    return out;
}

#if TIME_WRAP

#define NO_OFFSET (HEIGHT + WIDTH + 1)

static inline hash_t hash_with_offset(index_t offset, axis_trans_t x_trans, axis_trans_t y_trans) {
    // printf("    hashing with offset %i (x_trans = %i, y_trans = %i)\n", offset, x_trans, y_trans);
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    hash_t out = HASH_OFFSET;
    int x_offset_0 = NO_OFFSET;
    int y_offset_0 = NO_OFFSET;
    for (index_t fake_t = 0; fake_t < GENS; fake_t++) {
        index_t t = (fake_t + offset) % GENS;
        bb_t bb;
        get_true_bb(&bb, t);
        // printf("        fake_t = %i, t = %i, height = %i, width = %i, x_offset = %i, y_offset = %i\n", fake_t, t, bb.height, bb.width, bb.x_offset, bb.y_offset);
        index_t height = bb.height;
        index_t width = bb.width;
        int x_offset = bb.x_offset;
        int y_offset = bb.y_offset;
        if (transpose) {
            index_t temp = height;
            height = width;
            width = temp;
            temp = x_offset;
            x_offset = y_offset;
            y_offset = temp;
        }
        if (x_offset_0 == NO_OFFSET) {
            x_offset_0 = x_offset;
            y_offset_0 = y_offset;
            x_offset = 0;
            y_offset = 0;
        } else {
            x_offset -= x_offset_0;
            y_offset -= y_offset_0;
        }
        if (fake_t > t) {
            x_offset += TIME_WRAP_DX;
            y_offset += TIME_WRAP_DY;
        }
        // printf("        x_offset = %i, y_offset = %i\n", x_offset, y_offset);
        out ^= height;
        out *= HASH_PRIME;
        out ^= width;
        out *= HASH_PRIME;
        // int dx = 0;
        // int dy = 0;
        // int x_offset_2 = bb.y_offset;
        // int y_offset_2 = bb.y_offset;
        // bb.x_offset = 0;
        // bb.y_offset = 0;
        // transform_coords(&bb, x_offset, y_offset, x_trans, y_trans, &dx, &dy);
        // bb.x_offset = x_offset_2;
        // bb.y_offset = y_offset_2;
        // printf("        resolved coords: dx = %i, dy = %i\n", dx, dy);
        out ^= x_offset;
        out *= HASH_PRIME;
        out ^= y_offset;
        out *= HASH_PRIME;
        for (index_t y = 0; y < height; y++) {
            for (index_t x = 0; x < width; x++) {
                int real_x = 0;
                int real_y = 0;
                transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
                out ^= grid[t][real_y][real_x].value;
                out *= HASH_PRIME;
            }
        }
    }
    // printf("    value: %"PRIu64"\n", out);
    return out;
}

static inline hash_t hash(axis_trans_t x_trans, axis_trans_t y_trans) {
    // printf("hashing: x_trans = %i, y_trans = %i, offset = %i:\n", x_trans, y_trans, 0);
    hash_t out = hash_with_offset(0, x_trans, y_trans);
    #if TIME_WRAP
    for (index_t offset = 1; offset < GENS; offset++) {
        out = min_hash(out, hash_with_offset(offset, x_trans, y_trans));
    }
    #endif
    return out;
}

#else

static inline hash_t hash(axis_trans_t x_trans, axis_trans_t y_trans) {
    return hash_at_time(0, x_trans, y_trans);
}

#endif

static inline hash_t hash_full() {
    #if MULTI_RULE
    get_rule_symmetry();
    #endif
    // printf("rule symmetry: flip_x = %i, flip_y = %i, rotate_left = %i, rotate_right = %i, rotate_180 = %i, flip_diagonal = %i, flip_anti_diagonal = %i\n", rule_symmetry.flip_x, rule_symmetry.flip_y, rule_symmetry.rotate_left, rule_symmetry.rotate_right, rule_symmetry.rotate_180, rule_symmetry.flip_diagonal, rule_symmetry.flip_anti_diagonal);
    // print_grid(stdout);
    hash_t out = hash(POS_X, POS_Y);
    if (rule_symmetry.flip_y) {
        out = min_hash(out, hash(POS_X, NEG_Y));
    }
    if (rule_symmetry.flip_x) {
        out = min_hash(out, hash(NEG_X, POS_Y));
    }
    if (rule_symmetry.rotate_180) {
        out = min_hash(out, hash(NEG_X, NEG_Y));
    }
    if (rule_symmetry.flip_diagonal) {
        out = min_hash(out, hash(POS_Y, POS_X));
    }
    if (rule_symmetry.flip_anti_diagonal) {
        out = min_hash(out, hash(NEG_Y, NEG_X));
    }
    if (rule_symmetry.rotate_left) {
        out = min_hash(out, hash(POS_Y, NEG_X));
    }
    if (rule_symmetry.rotate_right) {
        out = min_hash(out, hash(NEG_Y, POS_X));
    }
    return out;
}


hash_t known_solutions[1048576];

static inline void init_known_solutions(void) {
    #if !MULTI_RULE
    get_rule_symmetry();
    #endif
    for (size_t i = 0; i < sizeof(known_solutions) / sizeof(hash_t); i++) {
        known_solutions[i] = 0;
    }
}


static inline void print_progress(FILE* stream, int depth);

static inline double get_time() {
    return (double)(clock()) / CLOCKS_PER_SEC;
}

double start;


#if STATES > 2
const char* dying_state_chars[254] = {"B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "pA", "pB", "pC", "pD", "pE", "pF", "pG", "pH", "pI", "pJ", "pK", "pL", "pM", "pN", "pO", "pP", "pQ", "pR", "pS", "pT", "pU", "pV", "pW", "pX", "qA", "qB", "qC", "qD", "qE", "qF", "qG", "qH", "qI", "qJ", "qK", "qL", "qM", "qN", "qO", "qP", "qQ", "qR", "qS", "qT", "qU", "qV", "qW", "qX", "rA", "rB", "rC", "rD", "rE", "rF", "rG", "rH", "rI", "rJ", "rK", "rL", "rM", "rN", "rO", "rP", "rQ", "rR", "rS", "rT", "rU", "rV", "rW", "rX", "sA", "sB", "sC", "sD", "sE", "sF", "sG", "sH", "sI", "sJ", "sK", "sL", "sM", "sN", "sO", "sP", "sQ", "sR", "sS", "sT", "sU", "sV", "sW", "sX", "tA", "tB", "tC", "tD", "tE", "tF", "tG", "tH", "tI", "tJ", "tK", "tL", "tM", "tN", "tO", "tP", "tQ", "tR", "tS", "tT", "tU", "tV", "tW", "tX", "uA", "uB", "uC", "uD", "uE", "uF", "uG", "uH", "uI", "uJ", "uK", "uL", "uM", "uN", "uO", "uP", "uQ", "uR", "uS", "uT", "uU", "uV", "uW", "uX", "vA", "vB", "vC", "vD", "vE", "vF", "vG", "vH", "vI", "vJ", "vK", "vL", "vM", "vN", "vO", "vP", "vQ", "vR", "vS", "vT", "vU", "vV", "vW", "vX", "wA", "wB", "wC", "wD", "wE", "wF", "wG", "wH", "wI", "wJ", "wK", "wL", "wM", "wN", "wO", "wP", "wQ", "wR", "wS", "wT", "wU", "wV", "wW", "wX", "xA", "xB", "xC", "xD", "xE", "xF", "xG", "xH", "xI", "xJ", "xK", "xL", "xM", "xN", "xO", "xP", "xQ", "xR", "xS", "xT", "xU", "xV", "xW", "xX", "yA", "yB", "yC", "yD", "yE", "yF", "yG", "yH", "yI", "yJ", "yK", "yL", "yM", "yN", "yO"};
#endif

static inline void print_grid_2(cell grid[GENS][HEIGHT][WIDTH], int depth, bool is_solution) {
    char rule[256];
    for (int i = 0; i < 256; i++) {
        rule[i] = 0;
    }
    get_rule(rule);
    printf("x = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE"\n", rule);
    index_t last_y = HEIGHT - (BOTTOM == NONE ? 2 : 1);
    for (index_t y = (TOP == NONE ? 2 : 1); y < last_y; y++) {
        DPRINTLINEPADDING();
        for (index_t x = (LEFT == NONE ? 2 : 1); x < WIDTH - (RIGHT == NONE ? 2 : 1); x++) {
            cell_value_t value = grid[0][y][x].value;
            if (value == UNKNOWN) {
                if (is_solution) {
                    fprintf(stderr, "\n");
                    print_grid(stderr);
                    fprintf(stderr, "\nStatus: ");
                    // print_progress(stderr, depth, 70);
                    print_progress(stderr, depth);
                    fprintf(stderr, "\nError: This error should not occur (unknown cell in solution)\nPlease report this error along with the debug information printed above\n");
                    exit(1);
                } else {
                    printf(".");
                }
            } else {
                #if STATES > 2
                if (value == DYING) {
                    int value = 0;
                    cell* cell = grid[0][y][x].prev;
                    while (cell != NULL && cell->value != 1) {
                        value++;
                        cell = cell->prev;
                    }
                    printf("%s", dying_state_chars[value]);
                } else {
                    real_printf("%c", value ? 'A' : '.');
                }
                #else
                real_printf("%c", value ? 'o' : '.');
                #endif
            }
        }
        if (y == last_y - 1) {
            real_printf("!\n");
        } else {
            real_printf("$\n");
        }
    }
}

static inline void print_solution(bool preprocessing, int depth) {
    DPRINTF2("Checking solution:\n");
    DPRINTGRID2();
    // apply empty pattern filter
    #if CHECK_EMPTY
    bool found = false;
    for (index_t y = 0; y < HEIGHT; y++) {
        for (index_t x = 0; x < WIDTH; x++) {
            if (grid[0][y][x].value != 0) {
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
    // apply subperiod filter
    #if TIME_WRAP && FILTER_SUBPERIOD
    hash_t hashes[GENS];
    for (int i = 0; i < GENS; i++) {
        hash_t hash = hash_at_time(i, POS_X, POS_Y);
        for (int j = 0; j < i; j++) {
            if (hash == hashes[j]) {
                return;
            }
        }
        hashes[i] = hash;
    }
    #endif
    // apply solution filter
    #if CUSTOM_SOLUTION_FILTERING
    if (!custom_solution_filter()) {
        DPRINTF2("Dropping solution (filtered)\n");
        return;
    }
    #endif
    // apply duplicate filter
    #if FILTER_DUPLICATES
    hash_t hash = hash_full();
    for (size_t i = 0; i < solutions_found; i++) {
        hash_t value = known_solutions[i];
        if (value == 0) {
            break;
        }
        if (hash == value) {
            DPRINTF2("Dropping solution (equal to solution %zu)\n", i);
            return;
        }
    }
    if (solutions_found < sizeof(known_solutions) / sizeof(hash_t)) {
        known_solutions[solutions_found] = hash;
    }
    #endif
    // show the solution
    solutions_found++;
    #if SHOW_SOLUTIONS
    if (preprocessing) {
        printf("Solved in preprocessing, 1 solution:\n");
    } else {
        printf("Solution found:\n");
    }
    print_grid_2(grid, depth, true);
    #endif
    #ifdef MAX_SOLUTIONS
    if (solutions_found > MAX_SOLUTIONS) {
        printf("Search complete, found %"PRIu64" solutions in %.3f seconds, %"PRIu64" branches (exited early, max solution count reached)\n", solutions_found, get_time() - start, branches);
        exit(0);
    }
    #endif
}
