
// defines main searching

#include "implications.c"
#undef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200809L

#include <errno.h>
#include <ctype.h>
#include <inttypes.h>
#include <sys/types.h>
#include <stdlib.h>
#include <stdio.h>
#include <stdarg.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "output.c"
#include "preprocess.c"
#include "search.c"
#ifdef CUSTOM
    #include CUSTOM
#endif


#define check_ferror(file) \
    do { \
        if (ferror(file)) { \
            fclose(file); \
            error("Could not read problem file (possibly corrupted)"); \
        } \
    } while (0)

long problem_file_error_pos;
#define problem_file_error(format, ...) (problem_file_error_pos = ftell(file), fclose(file), error("Invalid pattern file (near position %li): "format, problem_file_error_pos, ##__VA_ARGS__))

static __attribute__((format(scanf, 2, 3))) bool check_line(FILE* file, const char* format, ...) {
    // run vfscanf
    long start_pos = ftell(file);
    if (start_pos == -1) {
        fclose(file);
        error("Could not read problem file (ftell returned -1)");
    }
    va_list args;
    va_start(args, format);
    int value = vfscanf(file, format, args);
    va_end(args);
    if (value == EOF) {
        check_ferror(file);
        fseek(file, start_pos, SEEK_SET);
        return false;
    }
    // get number of format args
    int format_args = 0;
    for (size_t i = 0; format[i] != '\0'; i++) {
        if (format[i] == '%') {
            char next = format[i + 1];
            if (next == '%' || next == '*' || next == 'n') {
                i++;
                continue;
            } else {
                format_args++;
            }
        }
    }
    // printf("Testing '%s': %i out of %i\n", format, value, format_args);
    if (value == format_args) {
        // eat trailing whitespace on the line
        // it must find a newline or EOF!
        bool found = false;
        while (true) {
            // long pos = ftell(file);
            int c = fgetc(file);
            // printf("fgetc at pos %li: %i\n", pos, c);
            if (c == EOF) {
                check_ferror(file);
                found = true;
                break;
            } else if (c == '\n') {
                ungetc(c, file);
                found = true;
                break;
            } else if (isspace(c)) {
                continue;
            } else {
                ungetc(c, file);
                break;
            }
        }
        if (found) {
            return true;
        } else {
            fseek(file, start_pos, SEEK_SET);
            return false;
        }
    } else {
        fseek(file, start_pos, SEEK_SET);
        return false;
    }
}

static inline bool parse_part_of_file(FILE* file, InitFromState* data) {
    // eat leading whitespace
    while (true) {
        int c = fgetc(file);
        if (c == EOF) {
            check_ferror(file);
            // we've reached the end of the file
            return false;
        } else if (isspace(c)) {
            continue;
        } else {
            ungetc(c, file);
            break;
        }
    }
    size_t v_size;
    size_t v_size_2;
    size_t v_size_3;
    int v_int;
    double v_double;
    char v_str[256];
    if (check_line(file, "width = %zu", &v_size)) {
        data->width = v_size;
    } else if (check_line(file, "height = %zu", &v_size)) {
        data->height = v_size;
    } else if (check_line(file, "gens = %zu", &v_size)) {
        data->gens = v_size;
    } else if (check_line(file, "var_count = %zu", &v_size)) {
        data->var_count = v_size;
    } else if (check_line(file, "grid:")) {
        size_t total_size = data->width * data->height * data->gens;
        data->grid = safe_malloc(total_size * sizeof(InitFromCell));
        for (size_t i = 0; i < total_size; i++) {
            InitFromCell cell;
            cell.var = NO_VAR;
            cell.no_clause = false;
            int64_t value;
            if (fscanf(file, " %"SCNi64, &value) != 1) {
                check_ferror(file);
                problem_file_error("Missing grid element");
            }
            if (value == 0) {
                problem_file_error("Grid element is 0");
            } else if (value == 1) {
                cell.value = ON;
            } else if (value == -1) {
                cell.value = OFF;
            } else {
                cell.value = UNKNOWN;
                if (value < 0) {
                    value = -value;
                    cell.invert = true;
                }
                value -= 1;
                cell.var = value;
            }
            memcpy(&(data->grid[i]), &cell, sizeof(InitFromCell));
        }
    } else if (check_line(file, "transitions:")) {
        for (size_t i = 0; i < 512; i++) {
            int value;
            if (fscanf(file, " %i", &value) != 1) {
                check_ferror(file);
                problem_file_error("Missing transition");
            }
            state.trs[i] = value;
        }
    } else if (check_line(file, "search_order ( length = %zu ):", &v_size)) {
        config.search_order_len = v_size;
        config.search_order = safe_malloc(config.search_order_len * sizeof(size_t[3]));
        for (size_t i = 0; i < config.search_order_len; i++) {
            size_t t;
            size_t x;
            size_t y;
            if (fscanf(file, " %zu %zu %zu", &t, &x, &y) != 3) {
                check_ferror(file);
                problem_file_error("Missing search order item");
            }
            config.search_order[i][0] = t;
            config.search_order[i][1] = x;
            config.search_order[i][2] = y;
        }
    } else if (check_line(file, "initial_value = %i", &v_int)) {
        config.initial_value = v_int;
    } else if (check_line(file, "periodic = %zu %zu %zu", &v_size, &v_size_2, &v_size_3)) {
        config.periodic = true;
        config.periodic_dx = v_size;
        config.periodic_dy = v_size_2;
        config.periodic_period = v_size_3;
    } else if (check_line(file, "reporting_interval = %lf", &v_double)) {
        config.reporting_interval = v_double;
    } else if (check_line(file, "after_rule_text = %255s", v_str)) {
        config.after_rule_text = safe_malloc((strlen(v_str) + 1) * sizeof(char));
        strncpy(config.after_rule_text, v_str, 255);
    } else if (check_line(file, "show_solutions = %i", &v_int)) {
        config.show_solutions = v_int;
    } else if (check_line(file, "max_solutions = %zu", &v_size)) {
        config.max_solutions = v_size;
    } else if (check_line(file, "filter_empty_solutions = %i", &v_int)) {
        config.filter_empty_solutions = v_int;
    } else if (check_line(file, "filter_duplicate_solutions = %i", &v_int)) {
        config.filter_duplicate_solutions = v_int;
    } else if (check_line(file, "cell_period_filter ( length = %zu ) =", &v_size)) {
        config.cell_period_filter_length = v_size;
        config.cell_period_filter = safe_malloc(config.cell_period_filter_length * sizeof(int));
        for (size_t i = 0; i < config.cell_period_filter_length; i++) {
            size_t value;
            if (fscanf(file, " %zu", &value) != 1) {
                check_ferror(file);
                problem_file_error("Missing cell period filter item");
            }
            config.cell_period_filter[i] = value;
        }
    } else if (check_line(file, "max_partials = %i", &v_int)) {
        config.max_partials = v_int;
    } else if (check_line(file, "max_partial_scoring = %i", &v_int)) {
        config.max_partial_scoring = v_int;
    } else if (check_line(file, "max_partial_reporting_interval = %lf", &v_double)) {
        config.max_partial_reporting_interval = v_double;
    } else {
        if (feof(file)) {
            return false;
        } else {
            problem_file_error("Unrecognized line");
        }
    }
    return true;
}

static inline void load_state_from_file(char* path) {
    errno = 0;
    FILE* file = fopen(path, "r");
    if (file == NULL) {
        perror("Error: Cannot read problem file: ");
        exit(EXIT_FAILURE);
    }
    InitFromState data = {
        .height = 0,
        .width = 0,
        .gens = 0,
        .var_count = 0,
        .grid = NULL,
    };
    while (true) {
        if (!parse_part_of_file(file, &data)) {
            break;
        }
    }
    fclose(file);
    init_state(&data);
}


#ifdef FOR_PROFILE
#include <signal.h>
static void handle_sigterm(int signum) {
    (void)signum;
    extern int __llvm_profile_write_file(void);
    __llvm_profile_write_file(); 
    exit(EXIT_SUCCESS);
}
#endif

int main(int argc, char** argv) {
    if (argc != 2) {
        fprintf(stderr, "Expected exactly 1 command line argument");
        exit(EXIT_FAILURE);
    }
    #ifdef IMPLICATION_CHECK_TR
        init_implications();
        printf("%i -> %i\n", IMPLICATION_CHECK_TR, implication_table[IMPLICATION_CHECK_TR]);
        destroy_implications();
        exit(EXIT_SUCCESS);
    #endif
    calibrate_time();
    #ifdef FOR_PROFILE
        signal(SIGTERM, handle_sigterm);
    #endif
    init_implications();
    load_state_from_file(argv[1]);
    init_solutions();
    current_stack = create_stack();
    preprocess();
    init_progress();
    #if CUSTOM_INIT
        custom_init();
    #endif
    run_search();
    #if CUSTOM_DESTROY
        custom_destroy();
    #endif
    destroy_progress();
    destroy_stack(current_stack);
    destroy_solutions();
    destroy_state();
    destroy_config();
    destroy_implications();
    return 0;
}
