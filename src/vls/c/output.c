
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

#include "base.c"
#include "dynamic_grid.c"


static void print_grid_pretty(DynamicGrid* grid, bool is_solution) {
    printf("x = %zu, y = %zu, rule = %s", grid->width, grid->height, config.rule);
    // check for alternate printing method
    if (is_solution) {
        bool found = false;
        for (size_t t = 0; t < grid->gens; t++) {
            for (size_t y = 0; y < grid->height; y++) {
                for (size_t x = 0; x < grid->width; x++) {
                    CellValue value = dg_get(grid, t, x, y);
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
            for (size_t y = 0; y < grid->height; y++) {
                print_line_padding();
                for (size_t x = 0; x < grid->width; x++) {
                    CellValue value = dg_get(grid, 0, x, y);
                    if (value == ON) {
                        real_printf("o");
                    } else {
                        real_printf(".");
                    }
                }
                if (y == grid->height - 1) {
                    real_printf(" !\n");
                } else {
                    real_printf(" $\n");
                }
            }
            dg_destroy(grid);
            return;
        }
    }
    // finish the RLE header
    real_printf("History\n");
    for (size_t y = 0; y < grid->height; y++) {
        print_line_padding();
        for (size_t t = 0; t < grid->gens; t++) {
            for (size_t x = 0; x < grid->width; x++) {
                CellValue value = dg_get(grid, t, x, y);
                if (value == UNKNOWN) {
                    real_printf("B");
                } else if (value == OFF) {
                    real_printf(".");
                } else if (value == ON) {
                    real_printf("o");
                } else {
                    unexpected_error("Invalid grid state at t = %zu, x = %zu, y = %zu: %i", t, x, y, value);
                }
            }
            if (t != grid->gens - 1) {
                real_printf(" .|. ");
            }
        }
        if (y == grid->height - 1) {
            real_printf(" !\n");
        } else {
            real_printf(" $\n");
        }
    }
}


typedef uint64_t Hash;
#define PRIhash PRIu64
#define HASH_OFFSET UINT64_C(0xcbf29ce484222325)
#define HASH_PRIME UINT64_C(0x00000100000001b3)
#define MAX_HASH UINT64_MAX

#define update_hash(hash, value) \
    do { \
        (hash) = _Generic((value), \
            int8_t: update_hash_uint8((hash), (uint8_t)(value)), \
            uint8_t: update_hash_uint8((hash), (uint8_t)(value)), \
            int16_t: update_hash_uint16((hash), (uint16_t)(value)), \
            uint16_t: update_hash_uint16((hash), (uint16_t)(value)), \
            int32_t: update_hash_uint32((hash), (uint32_t)(value)), \
            uint32_t: update_hash_uint32((hash), (uint32_t)(value)), \
            int64_t: update_hash_uint64((hash), (uint64_t)(value)), \
            uint64_t: update_hash_uint64((hash), (uint64_t)(value)), \
            char*: update_hash_string((hash), (char*)(uintptr_t)(value)), \
            const char*: update_hash_string((hash), (const char*)(uintptr_t)(value)) \
        ); \
    } while (false)

static inline Hash update_hash_uint8(Hash hash, uint8_t value) {
    hash ^= value;
    hash *= HASH_PRIME;
    return hash;
}

static inline Hash update_hash_uint16(Hash hash, uint16_t value) {
    hash = update_hash_uint8(hash, value & 0xff);
    hash = update_hash_uint8(hash, value >> 8);
    return hash;
}

static inline Hash update_hash_uint32(Hash hash, uint32_t value) {
    hash = update_hash_uint8(hash, value & 0xff);
    hash = update_hash_uint8(hash, (value >> 8) & 0xff);
    hash = update_hash_uint8(hash, (value >> 16) & 0xff);
    hash = update_hash_uint8(hash, value >> 24);
    return hash;
}

static inline Hash update_hash_uint64(Hash hash, uint64_t value) {
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

static inline Hash update_hash_string(Hash hash, const char* value) {
    for (size_t i = 0; value[i] != '\0'; i++) {
        update_hash(hash, (int8_t)value[i]);
    }
    return hash;
}

static Hash min_hash(Hash x, Hash y) {
    return x < y ? x : y;
}

#if HASH_DEBUG
    #include <stdio.h>
    #define hash_debug_printf(...) printf(__VA_ARGS__)
    #define hash_debug_print_grid(grid, depth) \
        do { \
            int prev = debug_depth; \
            debug_depth = (depth); \
            print_grid_pretty((grid), false); \
            debug_depth = prev; \
        } while (false)
#else
    #define hash_debug_printf(...)
    #define hash_debug_print_grid(grid, depth)
#endif

static Hash hash_at_time(DynamicGrid* grid, size_t t) {
    Hash out = HASH_OFFSET;
    update_hash(out, grid->width);
    update_hash(out, grid->height);
    for (size_t y = 0; y < grid->height; y++) {
        for (size_t x = 0; x < grid->width; x++) {
            update_hash(out, dg_get(grid, t, x, y));
        }
    }
    return out;
}

static Hash hash_all_times(DynamicGrid* grid) {
    Hash out = HASH_OFFSET;
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                CellValue value = dg_get(grid, t, x, y);
                update_hash(out, value);
            }
        }
    }
    return out;
}

static Hash hash_all_times_periodic_with_offset(DynamicGrid* grid, size_t offset, intmax_t dx, intmax_t dy) {
    Hash out = HASH_OFFSET;
    // determine x_offset_0 and y_offset_0
    DynamicGrid full_t_grid = EMPTY_DYNAMIC_GRID;
    DynamicGrid t_grid = EMPTY_DYNAMIC_GRID;
    dg_extract_gen(&full_t_grid, grid, offset);
    DGShrinkToFitOffsets offsets = dg_shrink_to_fit(&t_grid, &full_t_grid);
    size_t x_offset_0 = offsets.x;
    size_t y_offset_0 = offsets.y;
    hash_debug_printf(INDENT "Hashing all times with offset %zu\n", offset);
    hash_debug_print_grid(grid, 2);
    hash_debug_printf(INDENT INDENT "x_offset_0 = %zu, y_offset_0 = %zu\n", x_offset_0, y_offset_0);
    for (size_t fake_t = 0; fake_t < config.periodic_period; fake_t++) {
        size_t real_t = (fake_t + offset) % config.periodic_period;
        dg_extract_gen(&full_t_grid, grid, real_t);
        DGShrinkToFitOffsets offsets = dg_shrink_to_fit(&t_grid, &full_t_grid);
        intmax_t x_offset = (intmax_t)offsets.x - (intmax_t)x_offset_0;
        intmax_t y_offset = (intmax_t)offsets.y - (intmax_t)y_offset_0;
        hash_debug_printf(INDENT INDENT INDENT "x_offset = %ji, y_offset = %ji\n", x_offset, y_offset);
        if (fake_t > real_t) {
            x_offset += dx;
            y_offset += dy;
        }
        update_hash(out, x_offset);
        update_hash(out, y_offset);
        hash_debug_printf(INDENT INDENT INDENT "resolved: x_offset = %ji, y_offset = %ji\n", x_offset, y_offset);
        hash_debug_print_grid(&t_grid, 3);
        for (size_t y = 0; y < t_grid.height; y++) {
            for (size_t x = 0; x < t_grid.width; x++) {
                CellValue value = dg_get(&t_grid, 0, x, y);
                update_hash(out, value);
            }
        }
    }
    dg_destroy(&full_t_grid);
    dg_destroy(&t_grid);
    hash_debug_printf(INDENT INDENT "Final hash: %"PRIhash"\n", out);
    return out;
}

static Hash hash_all_times_periodic(DynamicGrid* grid, size_t dx, size_t dy) {
    Hash out = MAX_HASH;
    hash_debug_printf(INDENT "Hashing all times\n");
    for (size_t offset = 0; offset < config.periodic_period; offset++) {
        out = min_hash(out, hash_all_times_periodic_with_offset(grid, offset, dx, dy));
    }
    hash_debug_printf(INDENT "Final final hash: %"PRIhash"\n", out);
    return out;
}

static Hash hash_full(DynamicGrid* grid) {
    StaticSymmetry symmetry = STATIC_SYMMETRY_MEET[dg_get_static_symmetry(grid)][state.rule_symmetry];
    Transformations transforms = static_symmetry_to_transforms(symmetry);
    hash_debug_printf("\n\nFull hashing grid:\n");
    hash_debug_print_grid(grid, 0);
    hash_debug_printf(INDENT "\nHashing (no transformation):\n");
    DynamicGrid temp = EMPTY_DYNAMIC_GRID;
    Hash out;
    if (config.periodic) {
        intmax_t dx = config.periodic_dx;
        intmax_t dy = config.periodic_dy;
        out = hash_all_times_periodic(grid, dx, dy);
        #define add_hash(transform, dx, dy) \
            hash_debug_printf(INDENT "\nHashing "#transform":\n"); \
            if (transforms.transform) { \
                dg_##transform(&temp, grid); \
                out = min_hash(out, hash_all_times_periodic(&temp, (dx), (dy))); \
            }
        add_hash(flip_horizontal, -dx, dy);
        add_hash(flip_vertical, dx, -dy);
        add_hash(rotate_left, -dy, dx);
        add_hash(rotate_right, dy, -dx);
        add_hash(rotate_180, -dx, -dy);
        add_hash(flip_diagonal, dy, dx);
        add_hash(flip_anti_diagonal, -dy, -dx);
        #undef add_hash
    } else {
        out = hash_all_times(grid);
        #define add_hash(transform) \
            hash_debug_printf(INDENT "\nHashing "#transform":\n"); \
            if (transforms.transform) { \
                dg_##transform(&temp, grid); \
                out = min_hash(out, hash_all_times(&temp)); \
            }
        add_hash(flip_horizontal);
        add_hash(flip_vertical);
        add_hash(rotate_left);
        add_hash(rotate_right);
        add_hash(rotate_180);
        add_hash(flip_diagonal);
        add_hash(flip_anti_diagonal);
        #undef add_hash
    }
    dg_destroy(&temp);
    hash_debug_printf("\nFinal final final hash: %"PRIhash"\n\n\n", out);
    return out;
}


#define MAX_SAVED_SOLUTION_HASHES 1048576ULL

Hash* known_solutions;

static void init_solutions(void) {
    known_solutions = safe_malloc(MAX_SAVED_SOLUTION_HASHES * sizeof(Hash));
    for (size_t i = 0; i < MAX_SAVED_SOLUTION_HASHES; i++) {
        known_solutions[i] = 0;
    }
}

static void destroy_solutions(void) {
    safe_free(known_solutions);
}


static void print_progress(FILE* stream);


#if defined(__x86_64__) || defined(_M_X64) || defined(__i386__) || defined(_M_IX86)
    #ifdef _MSC_VER
        #include <intrin.h>
    #else
        #include <x86intrin.h>
    #endif
    static uint64_t read_counter(void) {
        return __rdtsc();
    }
#elif defined(__aarch64__)
    static uint64_t read_counter(void) {
        uint64_t val;
        __asm__ volatile("mrs %0, cntvct_el0" : "=r" (val));
        return val;
    }
#elif defined(__riscv) && __riscv_xlen == 64
    static uint64_t read_counter(void) {
        uint64_t cycles;
        __asm__ volatile("rdcycle %0" : "=r"(cycles));
        return cycles;
    }
#elif defined(__powerpc__) || defined(__ppc__)
    static uint64_t read_counter(void) {
        uint64_t tb;
        __asm__ volatile("mfspr %0, 268" : "=r"(tb));
        return tb;
    }
#else
    static uint64_t read_counter(void) {
        return __builtin_readcyclecounter();
    }
#endif

static double cycles_per_second;

static void calibrate_time(void) {
    struct timespec request;
    struct timespec remainder;
    // 0.01 seconds
    request.tv_sec = 0;
    request.tv_nsec = 10000000L;
    uint64_t start = read_counter();
    nanosleep(&request, &remainder);
    uint64_t end = read_counter();
    cycles_per_second = (end - start) * 100;
}

static double get_time(void) {
    return (double)(read_counter()) / cycles_per_second;
}

static double start_time;


static void destroy_all(void);

static void check_solution([[maybe_unused]] bool preprocessing) {
    debug(2,
        printf("Checking solution:\n");
        print_grid(stdout);
    );
    #define drop_solution(msg) \
        debug(2, printf("Dropping solution (" msg ")\n")); \
        if (preprocessing) { \
            printf("Solved in preprocessing, 0 solutions\n"); \
        } \
        dg_destroy(&hash_grid); \
        dg_destroy(&solution_grid); \
        return;
    // put the pattern into the grids
    DynamicGrid hash_grid = EMPTY_DYNAMIC_GRID;
    dg_init_from_search_grid(&hash_grid);
    DynamicGrid solution_grid = EMPTY_DYNAMIC_GRID;
    dg_init_from_search_grid(&solution_grid);
    // apply empty pattern filter
    if (config.filter_empty_solutions) {
        bool found = false;
        for (size_t t = 0; t < hash_grid.gens; t++) {
            for (size_t y = 0; y < hash_grid.height; y++) {
                for (size_t x = 0; x < hash_grid.width; x++) {
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
    }
    // apply subperiod filter
    if (config.periodic && config.filter_subperiod_solutions) {
        Hash* hashes = safe_malloc(config.periodic_period * sizeof(Hash));
        DynamicGrid hash_grid_2 = EMPTY_DYNAMIC_GRID;
        DynamicGrid hash_grid_3 = EMPTY_DYNAMIC_GRID;
        for (size_t i = 0; i < config.periodic_period; i++) {
            dg_extract_gen(&hash_grid_2, &hash_grid, i);
            dg_shrink_to_fit(&hash_grid_3, &hash_grid_2);
            Hash hash = hash_at_time(&hash_grid_3, 0);
            for (size_t j = 0; j < i; j++) {
                if (hash == hashes[j]) {
                    safe_free(hashes);
                    dg_destroy(&hash_grid_2);
                    dg_destroy(&hash_grid_3);
                    drop_solution("subperiod");
                }
            }
            hashes[i] = hash;
        }
        dg_destroy(&hash_grid_2);
        dg_destroy(&hash_grid_3);
        safe_free(hashes);
    }
    // apply cell period filter
    if (config.cell_period_filter_length > 0) {
        for (size_t y = 0; y < hash_grid.height; y++) {
            for (size_t x = 0; x < hash_grid.width; x++) {
                CellValue* data = safe_malloc(state.gens * sizeof(CellValue));
                for (size_t t = 0; t < hash_grid.gens; t++) {
                    data[t] = dg_get(&hash_grid, t, x, y);
                }
                bool found = false;
                for (size_t period_index = 0; period_index < config.cell_period_filter_length; period_index++) {
                    size_t period = config.cell_period_filter[period_index];
                    for (size_t i = 0; i < period; i++) {
                        for (size_t t = i; t < hash_grid.gens; t += period) {
                            if (data[t] != data[(t + period) % state.gens]) {
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
                    for (size_t t = 0; t < hash_grid.gens; t++) {
                        dg_set(&hash_grid, t, x, y, OFF);
                    }
                }
                safe_free(data);
            }
        }
        // here we also need to apply an empty pattern filter to the hash grid
        // to remove solutions which are all subperiod
        bool found = false;
        for (size_t t = 0; t < hash_grid.gens; t++) {
            for (size_t y = 0; y < hash_grid.height; y++) {
                for (size_t x = 0; x < hash_grid.width; x++) {
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
    }
    // apply custom solution filter
    #if CUSTOM_SOLUTION_FILTERING
        if (!custom_solution_filter(solution_grid)) {
            drop_solution("custom filtered");
        }
    #endif
    // apply duplicate filter
    if (config.filter_duplicate_solutions) {
        Hash hash = hash_full(&hash_grid);
        for (size_t i = 0; i < state.solutions_found; i++) {
            Hash value = known_solutions[i];
            if (value == 0) {
                break;
            }
            if (hash == value) {
                drop_solution("equal to previous solution");
            }
        }
        if (state.solutions_found < MAX_SAVED_SOLUTION_HASHES) {
            known_solutions[state.solutions_found] = hash;
        }
    }
    // show the solution
    state.solutions_found++;
    if (config.show_solutions) {
        if (preprocessing) {
            printf("Solved in preprocessing, 1 solution:\n");
        } else {
            printf("Solution found:\n");
        }
        print_grid_pretty(&solution_grid, true);
    }
    dg_destroy(&hash_grid);
    dg_destroy(&solution_grid);
    if (config.max_solutions > 0) {
        if (state.solutions_found >= config.max_solutions) {
            double time = get_time() - start_time;
            printf("Search complete, found %zu solution%s in %.6f second%s, %zu branch%s (exited early, max solution count reached)\n", plural(state.solutions_found, "s"), plural(time, "s"), plural(state.branches, "es"));
            destroy_all();
            exit(EXIT_SUCCESS);
        }
    }
}


#define CHECK_TIME_EVERY_THIS_MANY_BRANCHES 1024


static double last_progress_shown;

static size_t progress_pos = 0;
static CellValue* progress;

static void init_progress(void) {
    // add 2 because off-by-1 errors
    progress = safe_malloc((config.search_order_len + 2) * sizeof(CellValue));
}

static void destroy_progress(void) {
    safe_free(progress);
}

static void print_progress(FILE* stream) {
    for (size_t i = 0; i < progress_pos; i++) {
        CellValue value = progress[i];
        real_fprintf(stream, "%c", value == 0 ? '0' : '1');
    }
}


static double last_printed_max_partial_time;
static DynamicGrid max_partial = EMPTY_DYNAMIC_GRID;
static uintmax_t max_partial_score = 0;
static uintmax_t last_printed_max_partial_score = 0;

static void max_partials_end(void) {
    if (state.solutions_found == 0 && config.max_partials) {
        printf("Max partial (score: %ju):\n", max_partial_score);
        print_grid_pretty(&max_partial, false);
    }
    dg_destroy(&max_partial);
}

static void print_info_if_needed(size_t depth) {
    if (config.max_partials) {
        if (state.solutions_found == 0) {
            uintmax_t score;
            if (config.max_partial_scoring == MAX_PARTIAL_SCORING_CELL) {
                score = state.set_unknown_vars;
            } else if (config.max_partial_scoring == MAX_PARTIAL_SCORING_DEPTH) {
                score = depth;
            } else {
                unexpected_error("Invalid max partial scoring: %i", config.max_partial_scoring);
            }
            if (score > max_partial_score) {
                dg_init_from_search_grid(&max_partial);
                max_partial_score = score;
            }
        }
    }
    if (state.branches % CHECK_TIME_EVERY_THIS_MANY_BRANCHES == 0) {
        double time = get_time();
        if (time - last_progress_shown > config.reporting_interval) {
            last_progress_shown = time;
            printf("%ju second%s, %zu branch%s, %zu solution%s, progress: ", plural((uintmax_t)(time - start_time), "s"), plural(state.branches, "es"), plural(state.solutions_found, "s"));
            print_progress(stdout);
            real_printf("\n");
        }
        if (config.max_partials) {
            if (state.solutions_found == 0 && time - last_printed_max_partial_time > config.max_partial_reporting_interval && max_partial_score > last_printed_max_partial_score) {
                last_printed_max_partial_time = time;
                last_printed_max_partial_score = max_partial_score;
                printf("New max partial (score = %"PRIu64"):\n", max_partial_score);
                print_grid_pretty(&max_partial, false);
            }
        }
    }
}
