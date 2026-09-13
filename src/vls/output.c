
// defines functions to report solutions

#pragma once

#include <assert.h>
#include <inttypes.h>
#include <stdlib.h>
#include <string.h>
#include <stdio.h>
#include <time.h>
// sometimes it's not defined, so we have to do this
extern int nanosleep(const struct timespec *__requested_time, struct timespec *__remaining);

#include "params2.h"
#include "base.c"
#include "dynamic_grid.c"
#include "rules.c"
#if MULTI_RULE || MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_START
#include "implications.c"
#endif
#ifdef CUSTOM
#include CUSTOM
#endif


uint64_t branches;

uint64_t solutions_found;


static inline void print_grid_pretty(DynamicGrid* full_grid, bool is_solution) {
    DynamicGrid grid = empty_dynamic_grid;
    #if HASH_DEBUG
    dg_copy(&grid, full_grid);
    #else
    dg_shrink_to_fit(&grid, full_grid);
    #endif
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
        for (DIndex t = 0; t < grid.gens; t++) {
            for (DIndex y = 0; y < grid.height; y++) {
                for (DIndex x = 0; x < grid.width; x++) {
                    CellValue value = dg_get(&grid, t, x, y);
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
            for (DIndex y = 0; y < grid.height; y++) {
                DPRINTLINEPADDING();
                for (DIndex x = 0; x < grid.width; x++) {
                    CellValue value = dg_get(&grid, 0, x, y);
                    if (value == ON) {
                        real_printf("o");
                    } else {
                        real_printf(".");
                    }
                }
                if (y == grid.height - 1) {
                    real_printf("!\n");
                } else {
                    real_printf("$\n");
                }
            }
            dg_destroy(&grid);
            return;
        }
    }
    // finish the RLE header
    real_printf("History\n");
    for (DIndex y = 0; y < grid.height; y++) {
        DPRINTLINEPADDING();
        for (DIndex t = 0; t < grid.gens; t++) {
            for (DIndex x = 0; x < grid.width - 0; x++) {
                CellValue value = dg_get(&grid, t, x, y);
                if (value == UNKNOWN) {
                    if (is_solution) {
                        fprintf(stderr, "\nError: This error should not occur, please report it (unknown cell in solution)\n");
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
                    fprintf(stderr, "\nError: This error should not occur, please report (invalid grid state %i at t = %"PRIdindex", x = %"PRIdindex", y = %"PRIdindex")\n", value, t, x, y);
                    exit(1);
                }
            }
            if (t != grid.gens - 1) {
                real_printf(" .|. ");
            }
        }
        if (y == grid.height - 1) {
            real_printf(" !\n");
        } else {
            real_printf(" $\n");
        }
    }
    dg_destroy(&grid);
}


#if SHOW_SOLUTIONS


typedef uint64_t Hash;
#define PRIhash PRIu64
#define HASH_OFFSET UINT64_C(0xcbf29ce484222325)
#define HASH_PRIME UINT64_C(0x00000100000001b3)
#define MAX_HASH UINT64_MAX

#define update_hash(hash, value) \
    do { \
        (hash) = _Generic((value), \
            int8_t: update_hash_int8((hash), (int8_t)(intptr_t)(value)), \
            uint8_t: update_hash_uint8((hash), (uint8_t)(uintptr_t)(value)), \
            int16_t: update_hash_int8((hash), (int16_t)(intptr_t)(value)), \
            uint16_t: update_hash_uint16((hash), (uint16_t)(uintptr_t)(value)), \
            int32_t: update_hash_int8((hash), (int32_t)(intptr_t)(value)), \
            uint32_t: update_hash_uint32((hash), (uint32_t)(uintptr_t)(value)), \
            int64_t: update_hash_int8((hash), (int64_t)(intptr_t)(value)), \
            uint64_t: update_hash_uint64((hash), (uint64_t)(uintptr_t)(value)), \
            char*: update_hash_string((hash), (char*)(uintptr_t)(value)), \
            const char*: update_hash_string((hash), (const char*)(uintptr_t)(value)) \
        ); \
    } while (0)

static inline __attribute__((always_inline)) Hash update_hash_uint8(Hash hash, uint8_t value) {
    hash ^= value;
    hash *= HASH_PRIME;
    return hash;
}

static inline __attribute__((always_inline)) Hash update_hash_uint16(Hash hash, uint16_t value) {
    hash = update_hash_uint8(hash, value & 0xff);
    hash = update_hash_uint8(hash, value >> 8);
    return hash;
}

static inline __attribute__((always_inline)) Hash update_hash_uint32(Hash hash, uint32_t value) {
    hash = update_hash_uint8(hash, value & 0xff);
    hash = update_hash_uint8(hash, (value >> 8) & 0xff);
    hash = update_hash_uint8(hash, (value >> 16) & 0xff);
    hash = update_hash_uint8(hash, value >> 24);
    return hash;
}

static inline __attribute__((always_inline)) Hash update_hash_uint64(Hash hash, uint64_t value) {
    hash = update_hash_uint8(hash, value & 0xff);
    hash = update_hash_uint8(hash, (value >> 8) & 0xff);
    hash = update_hash_uint8(hash, (value >> 16) & 0xff);
    hash = update_hash_uint8(hash, (value >> 24) & 0xff);
    hash = update_hash_uint8(hash, (value >> 32) & 0xff);
    hash = update_hash_uint8(hash, (value >> 40) & 0xff);
    hash = update_hash_uint8(hash, (value >> 48) & 0xff);
    hash = update_hash_uint8(hash, value >> 56);
    return hash;
}

static inline __attribute__((always_inline)) Hash update_hash_int8(Hash hash, int8_t value) {
    return update_hash_uint8(hash, (uint8_t)value);
}

static inline __attribute__((always_inline)) Hash update_hash_int16(Hash hash, int16_t value) {
    return update_hash_uint8(hash, (uint16_t)value);
}

static inline __attribute__((always_inline)) Hash update_hash_int32(Hash hash, int32_t value) {
    return update_hash_uint8(hash, (uint32_t)value);
}

static inline __attribute__((always_inline)) Hash update_hash_int64(Hash hash, int64_t value) {
    return update_hash_uint8(hash, (uint64_t)value);
}

static inline __attribute__((always_inline)) Hash update_hash_string(Hash hash, const char* value) {
    for (size_t i = 0; value[i] != '\0'; i++) {
        update_hash(hash, (int8_t)value[i]);
    }
    return hash;
}

static inline Hash min_hash(Hash x, Hash y) {
    return x < y ? x : y;
}

#if HASH_DEBUG
#include <stdio.h>
#define HASHDPRINTF(...) printf(__VA_ARGS__)
#define HASHDPRINTGRID(grid, depth) \
    do { \
        int prev = debug_depth; \
        debug_depth = (depth); \
        print_grid_pretty((grid), false); \
        debug_depth = prev; \
    } while (0)
#else
#define HASHDPRINTF(...)
#define HASHDPRINTGRID(grid, depth)
#endif

static inline Hash hash_at_time(DynamicGrid* grid, DIndex t) {
    Hash out = HASH_OFFSET;
    update_hash(out, "at time");
    update_hash(out, grid->width);
    update_hash(out, grid->height);
    for (DIndex y = 0; y < grid->height; y++) {
        for (DIndex x = 0; x < grid->width; x++) {
            update_hash(out, dg_get(grid, t, x, y));
        }
    }
    return out;
}

#if TIME_WRAP

static inline Hash hash_all_times_with_offset(DynamicGrid* grid, DIndex offset, intmax_t dx, intmax_t dy) {
    Hash out = HASH_OFFSET;
    // determine x_offset_0 and y_offset_0
    DynamicGrid full_t_grid = empty_dynamic_grid;
    DynamicGrid t_grid = empty_dynamic_grid;
    dg_extract_gen(&full_t_grid, grid, offset);
    DGShrinkToFitOffset offsets = dg_shrink_to_fit(&t_grid, &full_t_grid);
    DIndex x_offset_0 = offsets.x;
    DIndex y_offset_0 = offsets.y;
    HASHDPRINTF(INDENT "Hashing all times with offset %"PRIdindex"\n", offset);
    HASHDPRINTGRID(grid, 2);
    HASHDPRINTF(INDENT INDENT "x_offset_0 = %"PRIdindex", y_offset_0 = %"PRIdindex"\n", x_offset_0, y_offset_0);
    for (DIndex fake_t = 0; fake_t < grid->gens; fake_t++) {
        DIndex real_t = (fake_t + offset) % grid->gens;
        DynamicGrid full_t_grid = empty_dynamic_grid;
        DynamicGrid t_grid = empty_dynamic_grid;
        dg_extract_gen(&full_t_grid, grid, real_t);
        DGShrinkToFitOffset offsets = dg_shrink_to_fit(&t_grid, &full_t_grid);
        intmax_t x_offset = (intmax_t)offsets.x - (intmax_t)x_offset_0;
        intmax_t y_offset = (intmax_t)offsets.y - (intmax_t)y_offset_0;
        HASHDPRINTF(INDENT INDENT INDENT "x_offset = %ji, y_offset = %ji\n", x_offset, y_offset);
        if (fake_t > real_t) {
            x_offset += dx;
            y_offset += dy;
        }
        update_hash(out, x_offset);
        update_hash(out, y_offset);
        HASHDPRINTF(INDENT INDENT INDENT "resolved: x_offset = %ji, y_offset = %ji\n", x_offset, y_offset);
        HASHDPRINTGRID(&t_grid, 3);
        for (DIndex y = 0; y < t_grid.height; y++) {
            for (DIndex x = 0; x < t_grid.width; x++) {
                CellValue value = dg_get(&t_grid, 0, x, y);
                update_hash(out, value);
            }
        }
    }
    HASHDPRINTF(INDENT INDENT "Final hash: %"PRIhash"\n", out);
    return out;
}

static inline Hash hash_all_times(DynamicGrid* grid, intmax_t dx, intmax_t dy) {
    Hash out = MAX_HASH;
    HASHDPRINTF(INDENT "Hashing all times\n");
    for (DIndex offset = 0; offset < grid->gens; offset++) {
        out = min_hash(out, hash_all_times_with_offset(grid, offset, dx, dy));
    }
    HASHDPRINTF(INDENT "Final final hash: %"PRIhash"\n", out);
    return out;
}

#else

static inline Hash hash_all_times(DynamicGrid* grid) {
    Hash out = HASH_OFFSET;
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                CellValue value = di(grid, t, x, y);
                update_hash(out, value);
            }
        }
    }
    return out;
}

#endif

StaticSymmetry problem_symmetry;

static inline void hash_init(void) {
    DynamicGrid grid = empty_dynamic_grid;
    dg_init_from_search_grid(&grid);
    problem_symmetry = dg_get_symmetry(&grid);
    dg_destroy(&grid);
}

static inline Hash hash_full(DynamicGrid* grid) {
    StaticSymmetry symmetry = STATIC_SYMMETRY_MEET[get_rule_symmetry()][problem_symmetry];
    Transformations transforms = sts_to_transforms(symmetry);
    HASHDPRINTF("\n\nFull hashing grid:\n");
    HASHDPRINTGRID(grid, 0);
    HASHDPRINTF(INDENT "\nHashing (no transformation):\n");
    #if TIME_WRAP
    Hash out = hash_all_times(grid, TIME_WRAP_DX, TIME_WRAP_DY);
    DynamicGrid temp = empty_dynamic_grid;
    #define add_hash(transform, dx, dy) \
        HASHDPRINTF(INDENT "\nHashing "#transform":\n"); \
        if (transforms.transform) { \
            dg_##transform(&temp, grid); \
            out = min_hash(out, hash_all_times(&temp, (dx), (dy))); \
        }
    add_hash(flip_horizontal, -TIME_WRAP_DX, TIME_WRAP_DY);
    add_hash(flip_vertical, TIME_WRAP_DX, -TIME_WRAP_DY);
    add_hash(rotate_left, -TIME_WRAP_DY, TIME_WRAP_DX);
    add_hash(rotate_right, TIME_WRAP_DY, -TIME_WRAP_DX);
    add_hash(rotate_180, -TIME_WRAP_DX, -TIME_WRAP_DY);
    add_hash(flip_diagonal, TIME_WRAP_DY, TIME_WRAP_DX);
    add_hash(flip_anti_diagonal, -TIME_WRAP_DY, -TIME_WRAP_DX);
    #else
    Hash out = hash_all_times(grid);
    DynamicGrid temp = empty_dynamic_grid;
    #define add_hash(transform) \
        HASHDPRINTF(INDENT "\nHashing "#transform":\n"); \
        if (transforms.transform) { \
            dg_##transform(&temp, grid); \
            out = min_hash(out, hash_all_times(&temp); \
        }
    add_hash(flip_horizontal);
    add_hash(flip_vertical);
    add_hash(rotate_left);
    add_hash(rotate_right);
    add_hash(rotate_180);
    add_hash(flip_diagonal);
    add_hash(flip_anti_diagonal);
    #endif
    dg_destroy(&temp);
    HASHDPRINTF("\nFinal final final hash: %"PRIhash"\n\n\n", out);
    return out;
}


Hash known_solutions[1048576];

static inline void init_known_solutions(void) {
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


#if SHOW_SOLUTIONS

#ifdef CELL_PERIOD_FILTER
const int cell_period_filter[] = CELL_PERIOD_FILTER;
#endif

static inline void check_solution(bool preprocessing) {
    DPRINTF2("Checking solution:\n");
    DPRINTGRID2();
    #define drop_solution(msg, ...) \
        DPRINTF2("Dropping solution ("msg")\n" __VA_OPT__(,) __VA_ARGS__); \
        if (preprocessing) { \
            printf("Solved in preprocessing, 0 solutions\n"); \
        } \
        dg_destroy(&hash_grid); \
        return;
    // put it into the hash grid
    DynamicGrid hash_grid = empty_dynamic_grid;
    dg_init_from_search_grid(&hash_grid);
    // apply empty pattern filter
    #if CHECK_EMPTY
    bool found = false;
    for (Index t = 0; t < hash_grid.gens; t++) {
        for (Index y = 0; y < hash_grid.height; y++) {
            for (Index x = 0; x < hash_grid.width; x++) {
                if (dg_get(&hash_grid, t, x, y) != OFF) {
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
        drop_solution("empty");
    }
    #endif
    // apply subperiod filter
    #if TIME_WRAP && FILTER_SUBPERIOD
    Hash hashes[GENS];
    for (int i = 0; i < GENS; i++) {
        Hash hash = hash_at_time(&hash_grid, i);
        for (int j = 0; j < i; j++) {
            if (hash == hashes[j]) {
                drop_solution("subperiod");
            }
        }
        hashes[i] = hash;
    }
    #endif
    #ifndef CELL_PERIOD_FILTER
    #define solution_grid hash_grid
    #else
    #undef drop_solution
    #define drop_solution(msg, ...) \
        DPRINTF2("Dropping solution ("msg")\n" __VA_OPT__(,) __VA_ARGS__); \
        if (preprocessing) { \
            printf("Solved in preprocessing, 0 solutions\n"); \
        } \
        dg_destroy(&hash_grid); \
        dg_destroy(&solution_grid); \
        return;
    // before applying the cell period filter we need to copy it into the solution grid
    DynamicGrid solution_grid =  = empty_dynamic_grid;
    dg_copy(&solution_grid, &hash_grid);
    // apply cell period filter
    for (DIndex y = 0; y < hash_grid.height; y++) {
        for (DIndex x = 0; x < hash_grid.width; x++) {
            CellValue data[GENS];
            for (DIndex t = 0; t < hash_grid.gens; t++) {
                data[t] = dg_get(&hash_grid, t, x, y);
            }
            bool found = false;
            for (size_t period_index = 0; period_index < (sizeof(cell_period_filter) / sizeof(int)); period_index++) {
                DIndex period = cell_period_filter[period_index];
                for (DIndex i = 0; i < period; i++) {
                    for (DIndex t = i; t < hash_grid.gens; t += period) {
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
            if (!found) {
                for (DIndex t = 0; t < hash_grid.gens; t++) {
                    dg_set(&hash_grid, t, x, y, OFF);
                }
            }
        }
    }
    // here we also need to apply an empty pattern filter to the hash grid
    // to remove solutions which are all subperiod
    found = false;
    for (DIndex t = 0; t < hash_grid.gens; t++) {
        for (DIndex y = 0; y < hash_grid.height; y++) {
            for (DIndex x = 0; x < hash_grid.width; x++) {
                if (dg_get(&hash_grid, t, x, y) != OFF) {
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
        drop_solution("all subperiod");
    }
    #endif
    // apply custom solution filter
    #if CUSTOM_SOLUTION_FILTERING
    if (!custom_solution_filter(solution_grid)) {
        drop_solution("custom filtered");
    }
    #endif
    // apply duplicate filter
    #if FILTER_DUPLICATES
    Hash hash = hash_full(&hash_grid);
    for (size_t i = 0; i < solutions_found; i++) {
        Hash value = known_solutions[i];
        if (value == 0) {
            break;
        }
        if (hash == value) {
            drop_solution("equal to solution %zu", i);
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
    print_grid_pretty(&solution_grid, true);
    #ifdef MAX_SOLUTIONS
    if (solutions_found >= MAX_SOLUTIONS) {
        printf("Search complete, found %"PRIdindex" solution%s in %.6f seconds, %"PRIdindex" branches (exited early, max solution count reached)\n", solutions_found, solutions_found == 1 ? "" : "s", get_time() - start, branches);
        exit(0);
    }
    #endif
    dg_destroy(&hash_grid);
    #ifndef solution_grid
    dg_destroy(&solution_grid);
    #endif
}

#endif



#define CHECK_TIME_EVERY 1000

double last_progress_shown;

size_t progress_pos = 0;

#if MULTI_RULE

typedef struct ProgressEntry {
    bool tr_is_set;
    uint8_t tr;
    uint8_t value;
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

CellValue progress[TOTAL_MAX_DEPTH];

static inline void print_progress(FILE* stream) {
    for (size_t i = 0; i < progress_pos; i++) {
        CellValue value = progress[i];
        real_fprintf(stream, "%c", value == 0 ? '0' : '1');
    }
}

#endif


#if MAX_PARTIALS

double last_max_partial_shown;
DynamicGrid max_partial = empty_dynamic_grid;
int max_partial_size = 0;
#if MULTI_RULE
uint8_t max_partial_trs[512];
#endif
int last_printed_max_partial_size = 0;

static inline void max_partials_end(void) {
    if (solutions_found == 0) {
        #if MULTI_RULE
        memcpy(trs, max_partial_trs, sizeof(trs));
        #endif
        #if MAX_PARTIALS
        printf("Max partial (size: %i):\n", max_partial_size);
        print_grid_pretty(&max_partial, false);
        #endif
    }
    dg_destroy(&max_partial);
}

#endif

#ifdef BENCHMARK

static inline void print_info_if_needed(void) {}

#else

static inline void print_info_if_needed([[maybe_unused]] Depth depth) {
    #if MAX_PARTIALS
    if (solutions_found == 0) {
        int partial_size;
        #if MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_CELL
        partial_size = set_cells;
        #elif MAX_PARTIAL_TYPE == MAX_PARTIAL_TYPE_DEPTH
        partial_size = depth;
        #endif
        if (partial_size > max_partial_size) {
            dg_init_from_search_grid(&max_partial);
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
            printf("%i seconds, %"PRIdindex" branches, %"PRIdindex" solutions, progress: ", (int)(time - start), branches, solutions_found);
            print_progress(stdout);
            real_printf("\n");
        }
        #if MAX_PARTIALS
        if (solutions_found == 0 && time - last_max_partial_shown > MAX_PARTIAL_REPORTING_INTERVAL && max_partial_size > last_printed_max_partial_size) {
            last_max_partial_shown = time;
            last_printed_max_partial_size = max_partial_size;
            #if MULTI_RULE
            CellValue* temp_trs = safe_malloc(sizeof(trs));
            memcpy(temp_trs, trs, sizeof(trs));
            memcpy(trs, max_partial_trs, sizeof(trs));
            #endif
            printf("New max partial (size = %i):\n", max_partial_size);
            print_grid_pretty(&max_partial, false);
            #if MULTI_RULE
            memcpy(trs, temp_trs, sizeof(trs));
            free(temp_trs);
            #endif
        }
        #endif
    }
}

#endif
