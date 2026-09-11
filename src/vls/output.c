
// defines functions to report solutions

#pragma once

#include <stdlib.h>
#include <string.h>
#include <time.h>
// sometimes it's not defined, so we have to do this
extern int nanosleep(const struct timespec *__requested_time, struct timespec *__remaining);

#include "params2.h"
#include "base.c"
#if MULTI_RULE || MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_START
#include "implications.c"
#endif
#ifdef CUSTOM
#include CUSTOM
#endif


uint64_t branches;


#if SHOW_SOLUTIONS

uint64_t solutions_found;

typedef struct BoundingBox {
    Index width;
    Index height;
    Index x_offset;
    Index y_offset;
} BoundingBox;

DynamicGrid hash_grid;

static inline bool get_true_bb(BoundingBox* bb, CellValue t) {
    // check for empty pattern
    // this breaks the rest of the function turns out
    bool found = false;
    for (Index y = 0; y < HEIGHT; y++) {
        for (Index x = 0; x < WIDTH; x++) {
            if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        bb->width = 0;
        bb->height = 0;
        bb->x_offset = 0;
        bb->y_offset = 0;
        return false;
    }
    bb->width = WIDTH;
    bb->height = HEIGHT;
    bb->x_offset = 0;
    bb->y_offset = 0;
    // top
    Index shrink_top = 0;
    for (Index y = 0; y < HEIGHT; y++) {
        bool found = false;
        for (Index x = 0; x < WIDTH; x++) {
            if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
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
    Index shrink_bottom = 0;
    for (int y = HEIGHT - 1; y >= 0; y--) {
        bool found = false;
        for (Index x = 0; x < WIDTH; x++) {
            if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
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
    Index shrink_left = 0;
    for (Index x = 0; x < WIDTH; x++) {
        bool found = false;
        for (Index y = 0; y < HEIGHT; y++) {
            if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
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
    Index shrink_right = 0;
    for (int x = WIDTH - 1; x >= 0; x--) {
        bool found = false;
        for (Index y = 0; y < HEIGHT; y++) {
            if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
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
    return true;
}

typedef uint64_t Hash;
#define PRIhash PRIu64
#define HASH_OFFSET (0xcbf29ce484222325ULL)
#define HASH_PRIME (0x00000100000001b3ULL)

static inline Hash min_hash(Hash a, Hash b) {
    return a < b ? a : b;
}

typedef enum AxisTransform {
    POS_X,
    POS_Y,
    NEG_X,
    NEG_Y,
} AxisTransform;

static inline void transform_coords(const BoundingBox* bb, Index x, Index y, AxisTransform x_trans, AxisTransform y_trans, Index* x_out, Index* y_out) {
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


#if false
#include <stdio.h>
#define HASHDPRINTF printf
#else
#define HASHDPRINTF(...)
#endif

static inline Hash hash_at_time(Index t, AxisTransform x_trans, AxisTransform y_trans) {
    BoundingBox bb;
    get_true_bb(&bb, t);
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    Index width = bb.width;
    Index height = bb.height;
    HASHDPRINTF("width = %i, height = %i, x_offset = %i, y_offset = %i\n", width, height, bb.x_offset, bb.y_offset);
    if (transpose) {
        Index temp = width;
        width = height;
        height = temp;
    }
    Hash out = HASH_OFFSET;
    out ^= width;
    out *= HASH_PRIME;
    out ^= height;
    out *= HASH_PRIME;
    for (Index y = 0; y < height; y++) {
        for (Index x = 0; x < width; x++) {
            Index real_x = 0;
            Index real_y = 0;
            transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
            out ^= dynamic_grid_index(hash_grid, t, real_x, real_y);
            out *= HASH_PRIME;
        }
    }
    return out;
}

#if TIME_WRAP

#define NO_OFFSET (WIDTH + HEIGHT + 1)

static inline Hash hash_with_offset(Index offset, AxisTransform x_trans, AxisTransform y_trans) {
    HASHDPRINTF("    hashing with offset %i (x_trans = %i, y_trans = %i)\n", offset, x_trans, y_trans);
    bool transpose = x_trans != POS_X && x_trans != NEG_X;
    Hash out = HASH_OFFSET;
    // determine x_offset_0 and y_offset_0
    BoundingBox bb;
    for (int i = 0; i < GENS; i++) {
        if (get_true_bb(&bb, offset)) {
            break;
        }
        offset = (offset + 1) % GENS;
        if (i == GENS - 1) {
            real_fprintf(stderr, "Error: This error should not occur (no non-blank offset for hashing found)\nPlease report this error\n");
            exit(1);
        }
    }
    HASHDPRINTF("    resolved offset = %i\n", offset);
    Index x_offset_0 = bb.x_offset;
    Index y_offset_0 = bb.y_offset;
    if (transpose) {
        Index temp = x_offset_0;
        x_offset_0 = y_offset_0;
        y_offset_0 = temp;
    }
    HASHDPRINTF("        offset = %i, width = %i, height = %i, x_offset_0 = %i, y_offset_0 = %i\n", offset, bb.width, bb.height, x_offset_0, y_offset_0);
    for (Index fake_t = 0; fake_t < GENS; fake_t++) {
        Index t = (fake_t + offset) % GENS;
        bool is_not_empty = get_true_bb(&bb, t);
        HASHDPRINTF("        fake_t = %i, t = %i, width = %i, height = %i, x_offset = %i, y_offset = %i\n", fake_t, t, bb.width, bb.height, bb.x_offset, bb.y_offset);
        Index width = bb.width;
        Index height = bb.height;
        int x_offset = bb.x_offset;
        int y_offset = bb.y_offset;
        if (transpose) {
            int temp = width;
            width = height;
            height = temp;
            temp = x_offset;
            x_offset = y_offset;
            y_offset = temp;
        }
        x_offset -= x_offset_0;
        y_offset -= y_offset_0;
        HASHDPRINTF("        x_offset = %i, y_offset = %i\n", x_offset, y_offset);
        if (fake_t > t) {
            if (transpose) {
                x_offset += TIME_WRAP_DY;
                y_offset += TIME_WRAP_DX;
            } else {
                x_offset += TIME_WRAP_DX;
                y_offset += TIME_WRAP_DY;
            }
        }
        HASHDPRINTF("        x_offset = %i, y_offset = %i\n", x_offset, y_offset);
        out ^= width;
        out *= HASH_PRIME;
        out ^= height;
        out *= HASH_PRIME;
        if (is_not_empty) {
            out ^= x_offset;
            out *= HASH_PRIME;
            out ^= y_offset;
            out *= HASH_PRIME;
        }
        for (Index y = 0; y < height; y++) {
            for (Index x = 0; x < width; x++) {
                Index real_x = 0;
                Index real_y = 0;
                transform_coords(&bb, x, y, x_trans, y_trans, &real_x, &real_y);
                out ^= dynamic_grid_index(hash_grid, t, real_x, real_y);
                out *= HASH_PRIME;
            }
        }
    }
    HASHDPRINTF("    value: %"PRIhash"\n", out);
    return out;
}

static inline Hash hash(AxisTransform x_trans, AxisTransform y_trans) {
    HASHDPRINTF("hashing: x_trans = %i, y_trans = %i, offset = %i:\n", x_trans, y_trans, 0);
    Hash out = hash_with_offset(0, x_trans, y_trans);
    #if TIME_WRAP
    for (int offset = 1; offset < GENS; offset++) {
        out = min_hash(out, hash_with_offset(offset, x_trans, y_trans));
    }
    #endif
    HASHDPRINTF("Final hash: %"PRIhash"\n\n", out);
    return out;
}

#else

static inline Hash hash(AxisTransform x_trans, AxisTransform y_trans) {
    return hash_at_time(0, x_trans, y_trans);
}

#endif

static inline Hash hash_full() {
    #if MULTI_RULE
    get_rule_symmetry();
    #endif
    // printf("rule symmetry: flip_x = %i, flip_y = %i, rotate_left = %i, rotate_right = %i, rotate_180 = %i, flip_diagonal = %i, flip_anti_diagonal = %i\n", rule_symmetry.flip_x, rule_symmetry.flip_y, rule_symmetry.rotate_left, rule_symmetry.rotate_right, rule_symmetry.rotate_180, rule_symmetry.flip_diagonal, rule_symmetry.flip_anti_diagonal);
    // print_grid(stdout);
    Hash out = hash(POS_X, POS_Y);
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
    HASHDPRINTF("Final final hash: %"PRIhash"\n", out);
    return out;
}

Hash known_solutions[1048576];

static inline void init_known_solutions(void) {
    #if !MULTI_RULE
    get_rule_symmetry();
    #endif
    for (size_t i = 0; i < sizeof(known_solutions) / sizeof(Hash); i++) {
        known_solutions[i] = 0;
    }
}


#endif


static inline void print_progress(FILE* stream);


#if defined(__x86_64__) || defined(_M_X64) || defined(__i386__)
#include <x86intrin.h>
#else
#define __rdtsc __builtin_readcyclecounter
#endif

double cycles_per_second;

static void calibrate_time(void) {
    struct timespec request;
    struct timespec remainder;
    // 0.01 seconds
    request.tv_sec = 0;
    request.tv_nsec = 10000000L;
    uint64_t start = __rdtsc();
    nanosleep(&request, &remainder);
    uint64_t end = __rdtsc();
    cycles_per_second = (end - start) * 100;
}

static inline double get_time(void) {
    return (double)(__rdtsc()) / cycles_per_second;
}

double start;


static inline void print_grid_pretty(DynamicGrid grid, bool is_solution) {
    char rule[256];
    memset(rule, '\0', 256);
    get_rule(rule, false);
    #if MULTI_RULE
    char maxrule[256];
    memset(maxrule, '\0', 256);
    get_rule(maxrule, true);
    if (strcmp(rule, maxrule) != 0) {
        printf("#C %s to %s\n", rule, maxrule);
    }
    #endif
    printf("x = 0, y = 0, rule = %s"SPECIAL_AFTER_RULE, rule);
    // check for alternate printing method
    if (is_solution) {
        bool found = false;
        for (int t = 0; t < GENS; t++) {
            for (int y = PADDING; y < HEIGHT - PADDING; y++) {
                for (int x = PADDING; x < WIDTH - PADDING; x++) {
                    CellValue value = dynamic_grid_index(grid, t, x, y);
                    if (value == UNKNOWN) {
                        found = true;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        if (!found) {
            // finish the RLE header
            real_printf("\n");
            for (int y = PADDING; y < HEIGHT - PADDING; y++) {
                DPRINTLINEPADDING();
                for (int x = PADDING; x < WIDTH - PADDING; x++) {
                    CellValue value = dynamic_grid_index(grid, 0, x, y);
                    if (value == ON) {
                        real_printf("o");
                    } else {
                        real_printf(".");
                    }
                }
                if (y == HEIGHT - PADDING - 1) {
                    real_printf("!\n");
                } else {
                    real_printf("$\n");
                }
            }
            return;
        }
    }
    // finish the RLE header
    real_printf("History\n");
    for (int y = PADDING; y < HEIGHT - PADDING; y++) {
        DPRINTLINEPADDING();
        for (int t = 0; t < GENS; t++) {
            for (int x = PADDING; x < WIDTH - PADDING; x++) {
                CellValue value = dynamic_grid_index(grid, t, x, y);
                if (value == UNKNOWN) {
                    if (is_solution) {
                        real_printf("\n\n");
                        fprintf(stderr, "\n");
                        print_grid(stderr);
                        fprintf(stderr, "\nStatus: ");
                        print_progress(stderr);
                        fprintf(stderr, "\nError: This error should not occur (unknown cell in solution)\nPlease report this error along with the debug information printed above\n");
                        exit(1);
                    } else {
                        real_printf("B");
                    }
                } else if (value == OFF) {
                    real_printf(".");
                } else if (value == ON) {
                    real_printf("o");
                } else if (value == DONT_CARE) {
                    // real_printf("C");
                } else {
                    real_printf("\n\n");
                    fprintf(stderr, "\n");
                    print_grid(stderr);
                    fprintf(stderr, "\nStatus: ");
                    print_progress(stderr);
                    fprintf(stderr, "\nError: This error should not occur (invalid grid state)\nPlease report this error along with the debug information printed above\n");
                    exit(1);
                }
            }
            if (t != GENS - 1) {
                real_printf(" .|. ");
            }
        }
        if (y == HEIGHT - PADDING - 1) {
            real_printf("!\n");
        } else {
            real_printf("$\n");
        }
    }
}

#ifdef CELL_PERIOD_FILTER
const int cell_period_filter[] = CELL_PERIOD_FILTER;
#endif

static inline void print_solution(bool preprocessing) {
    #if SHOW_SOLUTIONS
    DPRINTF2("Checking solution:\n");
    DPRINTGRID2();
    // apply empty pattern filter
    #if CHECK_EMPTY
    bool found = false;
    for (int y = 0; y < HEIGHT; y++) {
        for (int x = 0; x < WIDTH; x++) {
            CellValue value = grid[0][y][x].value;
            if (value == ON) {
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
    #define real_return(msg, ...) \
        DPRINTF2("Dropping solution ("msg")\n" __VA_OPT__(,) __VA_ARGS__); \
        if (preprocessing) { \
            printf("Solved in preprocessing, 0 solutions\n"); \
        } \
        free(hash_grid); \
        return;
    // put it into the hash grid
    hash_grid = malloc(DYNAMIC_GRID_SIZE);
    copy_to_dynamic_grid(hash_grid);
    // apply subperiod filter
    #if TIME_WRAP && FILTER_SUBPERIOD
    Hash hashes[GENS];
    for (int i = 0; i < GENS; i++) {
        Hash hash = hash_at_time(i, POS_X, POS_Y);
        for (int j = 0; j < i; j++) {
            if (hash == hashes[j]) {
                real_return("subperiod");
            }
        }
        hashes[i] = hash;
    }
    #endif
    #ifndef CELL_PERIOD_FILTER
    #define solution_grid hash_grid
    #else
    #undef real_return
    #define real_return(msg, ...) \
        DPRINTF2("Dropping solution ("msg")\n" __VA_OPT__(,) __VA_ARGS__); \
        if (preprocessing) { \
            printf("Solved in preprocessing, 0 solutions\n"); \
        } \
        free(hash_grid); \
        free(solution_grid); \
        return;
    // before applying the cell period filter we need to copy it into the solution grid
    DynamicGrid solution_grid = malloc(DYNAMIC_GRID_SIZE);
    memcpy(solution_grid, hash_grid, DYNAMIC_GRID_SIZE);
    // apply cell period filter
    for (Index y = 0; y < HEIGHT; y++) {
        for (Index x = 0; x < WIDTH; x++) {
            CellValue data[GENS];
            for (Index t = 0; t < GENS; t++) {
                data[t] = dynamic_grid_index(hash_grid, t, x, y);
            }
            bool found = false;
            for (size_t period_index = 0; period_index < (sizeof(cell_period_filter) / sizeof(int)); period_index++) {
                int period = cell_period_filter[period_index];
                for (Index i = 0; i < period; i++) {
                    for (Index t = i; t < GENS; t += period) {
                        if (data[t] != data[(t + period) % GENS]) {
                            found = true;
                            break;
                        }
                    }
                    if (found) {
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            // printf("x = %i, y = %i, data = ", x, y);
            // for (Index t = 0; t < GENS; t++) {
            //     printf("%i", data[t]);
            // }
            // printf(": %i\n", found);
            if (!found) {
                for (Index t = 0; t < GENS; t++) {
                    dynamic_grid_index(hash_grid, t, x, y) = OFF;
                }
            }
        }
    }
    // here we also need to apply an empty pattern filter to the hash grid
    // to remove solutions which are all subperiod
    found = false;
    for (Index t = 0; t < GENS; t++) {
        for (Index y = 0; y < HEIGHT; y++) {
            for (Index x = 0; x < WIDTH; x++) {
                if (dynamic_grid_index(hash_grid, t, x, y) != OFF) {
                    found = true;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        real_return("all subperiod");
    }
    #endif
    // apply custom solution filter
    #if CUSTOM_SOLUTION_FILTERING
    if (!custom_solution_filter()) {
        real_return("custom filtered");
    }
    #endif
    // apply duplicate filter
    #if FILTER_DUPLICATES
    Hash hash = hash_full();
    for (size_t i = 0; i < solutions_found; i++) {
        Hash value = known_solutions[i];
        if (value == 0) {
            break;
        }
        if (hash == value) {
            real_return("equal to solution %zu", i);
        }
    }
    if (solutions_found < sizeof(known_solutions) / sizeof(Hash)) {
        known_solutions[solutions_found] = hash;
    }
    #endif
    // show the solution
    solutions_found++;
    if (preprocessing) {
        printf("Solved in preprocessing, 1 solution:\n");
    } else {
        printf("Solution found:\n");
    }
    print_grid_pretty(solution_grid, true);
    #ifdef MAX_SOLUTIONS
    if (solutions_found >= MAX_SOLUTIONS) {
        printf("Search complete, found %"PRIu64" solution%s in %.6f seconds, %"PRIu64" branches (exited early, max solution count reached)\n", solutions_found, solutions_found == 1 ? "" : "s", get_time() - start, branches);
        exit(0);
    }
    #endif
    #endif
    free(hash_grid);
    #ifndef solution_grid
    free(solution_grid);
    #endif
}


int progress_pos = 0;

#if MULTI_RULE

typedef struct ProgressEntry {
    bool tr_is_set;
    int tr;
    int value;
} ProgressEntry;

ProgressEntry progress[TOTAL_MAX_DEPTH];

static inline void print_progress(FILE* stream) {
    for (int i = 0; i < progress_pos; i++) {
        if (progress[i].tr_is_set) {
            int tr = progress[i].tr;
            int value = progress[i].value;
            char first = bound_trs_names[tr_to_bound_tr[tr]][0];
            real_fprintf(stream, "[%c%s]", (value == 1 ? first : (first == 'B' ? 'A' : 'D')), bound_trs_names[tr_to_bound_tr[tr]] + 1);
        } else {
            int value = progress[i].value;
            real_fprintf(stream, "%c", value == 0 ? '0' : '1');
        }
    }
}

#else

int progress[TOTAL_MAX_DEPTH];

static inline void print_progress(FILE* stream) {
    for (int i = 0; i < progress_pos; i++) {
        int value = progress[i];
        real_fprintf(stream, "%c", value == 0 ? '0' : '1');
    }
}

#endif

#define CHECK_TIME_EVERY 1000

double last_progress_shown;
#if MAX_PARTIAL_TYPE != MAX_PARTIAL_TYPE_NONE
#define MAX_PARTIALS true
double last_max_partial_shown;
DynamicGrid max_partial;
int max_partial_size = 0;
#if MULTI_RULE
uint8_t max_partial_trs[512];
#endif
int last_printed_max_partial_size = 0;
#else
#define MAX_PARTIALS false
#endif

Cell* initial_cell;

static inline void init_max_partial(void) {
    max_partial = malloc(DYNAMIC_GRID_SIZE);
}

static inline void free_max_partial(void) {
    free(max_partial);
}

static inline void print_info_if_needed(void) {
    #ifndef BENCHMARK
    #if MAX_PARTIALS
    if (solutions_found == 0) {
        int partial_size;
        #if MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_CELL
        partial_size = set_cells;
        #elif MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_START
        Cell* cell = initial_cell;
        for (partial_size = 0; partial_size < TOTAL_SIZE && cell != NULL; partial_size++) {
            if (cell->value == UNKNOWN) {
                break;
            }
            Cell* prev = cell->prev;
            if (prev == NULL) {
                break;
            }
            #define null_check(x) ((x) == NULL ? 0 : (x)->value)
            uint32_t tr = 
                    (null_check(prev->nw) << 16)
                | (null_check(prev->w) << 14)
                | (null_check(prev->sw) << 12)
                | (null_check(prev->n) << 10)
                | (prev->value << 8)
                | (null_check(prev->s) << 6)
                | (null_check(prev->ne) << 4)
                | (null_check(prev->e) << 2)
                | (null_check(prev->se) << 0);
            #undef null_check
            if (cell->value != big_trs[tr]) {
                break;
            }
            cell = cell->next_in_search_order;
        }
        #endif
        if (partial_size > max_partial_size) {
            copy_to_dynamic_grid(max_partial);
            max_partial_size = partial_size;
            #if MULTI_RULE
            memcpy(max_partial_trs, trs, sizeof(trs));
            #endif
        }
    }
    #endif
    if (branches % CHECK_TIME_EVERY == 0) {
        double time = get_time();
        if (time - last_progress_shown > REPORTING_INTERVAL) {
            last_progress_shown = time;
            printf("%i seconds, %"PRIu64" branches, %"PRIu64" solutions, progress: ", (int)(time - start), branches, solutions_found);
            print_progress(stdout);
            real_printf("\n");
        }
        #if MAX_PARTIALS
        if (solutions_found == 0 && time - last_max_partial_shown > MAX_PARTIAL_REPORTING_INTERVAL && max_partial_size > last_printed_max_partial_size) {
            last_max_partial_shown = time;
            last_printed_max_partial_size = max_partial_size;
            #if MULTI_RULE
            CellValue* temp_trs = malloc(sizeof(trs));
            memcpy(temp_trs, trs, sizeof(trs));
            memcpy(trs, max_partial_trs, sizeof(trs));
            #endif
            printf("New max partial (size = %i):\n", max_partial_size);
            print_grid_pretty(max_partial, false);
            #if MULTI_RULE
            memcpy(trs, temp_trs, sizeof(trs));
            free(temp_trs);
            #endif
        }
        #endif
    }
    #endif
}
