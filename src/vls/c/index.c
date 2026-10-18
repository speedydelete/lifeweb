
// defines main searching

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


typedef struct InitFromCell {
    CellValue value;
    size_t var;
    bool invert;
    bool no_clause;
} InitFromCell;

typedef struct InitFromState {
    size_t height;
    size_t width;
    size_t gens;
    size_t var_count;
    InitFromCell* grid;
} InitFromState;

// initialize the current state
static void init_state(InitFromState* from) {
    state.width = from->width;
    state.height = from->height;
    state.gens = from->gens;
    state.var_count = from->var_count;
    state.layer_size = state.width * state.height;
    state.total_size = state.layer_size * state.gens;
    state.start_unknown_vars = state.var_count;
    state.set_unknown_vars = 0;
    // first we have to determine how many times each variable is used
    // we add 1 in the allocations because variable 0 is unused
    size_t* var_uses = safe_malloc((state.var_count + 1) * sizeof(size_t));
    memset(var_uses, 0, (state.var_count + 1) * sizeof(size_t));
    for (size_t i = 0; i < state.total_size; i++) {
        InitFromCell* cell = &(from->grid[i]);
        size_t var = cell->var;
        if (var != 0) {
            var_uses[var]++;
        }
    }
    // create the cells
    state.vars = safe_malloc((state.var_count + 1) * sizeof(Cell*));
    state.vars[0] = NULL;
    for (size_t i = 1; i <= state.var_count; i++) {
        Cell* cell = safe_malloc(sizeof(Cell) + var_uses[i] * sizeof(CellUseData));
        cell->value = UNKNOWN;
        cell->var_number = i;
        cell->alias = NULL;
        cell->invert_alias = false;
        cell->use_count = var_uses[i];
        // fill the uses with null pointers
        for (size_t j = 0; j < cell->use_count; j++) {
            CellUseData* data = &(cell->uses[j]);
            data->c = NULL;
            data->prev = NULL;
            data->nw = NULL;
            data->n = NULL;
            data->ne = NULL;
            data->w = NULL;
            data->e = NULL;
            data->sw = NULL;
            data->s = NULL;
            data->se = NULL;
        }
        state.vars[i] = cell;
    }
    safe_free(var_uses);
    // now do the grid
    state.grid = safe_malloc(state.total_size * sizeof(GridCell));
    size_t i = 0;
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                InitFromCell* init_cell = &(from->grid[i]);
                CellValue value = init_cell->value;
                Cell* cell;
                if (value == UNKNOWN) {
                    cell = state.vars[init_cell->var];
                } else if (value == OFF) {
                    cell = &off_cell;
                } else if (value == ON) {
                    cell = &on_cell;
                } else {
                    unexpected_error("Invalid cell state at t = %zu, x = %zu, y = %zu: %i", t, x, y, value);
                }
                state.grid[i].cell = cell;
                state.grid[i].invert = init_cell->invert;
                i++;
            }
        }
    }
    // now the clauses
    state.ca_clause_count = state.width * state.height * (state.gens - 1);
    // don't allocate space for the clauses marked as no_clause
    for (size_t i = 0; i < state.total_size; i++) {
        if (from->grid[i].no_clause) {
            state.ca_clause_count--;
        }
    }
    state.ca_clauses = safe_malloc(state.ca_clause_count * sizeof(CAClause*));
    i = 0;
    size_t init_index = 0;
    for (size_t t = 0; t < state.gens - 1; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                if (state_coords_in_bounds(t, x, y)) {
                    InitFromCell* init_cell = &(from->grid[init_index]);
                    init_index++;
                    if (init_cell->no_clause) {
                        continue;
                    }
                }
                CAClause* clause = safe_aligned_alloc(alignof(CAClause), sizeof(CAClause));
                clause->number = i;
                clause->state_number = 0;
                // fill the clause's pointers
                GridCell* cell = state_get_grid_cell_allow_oob(t, x, y);
                clause->c = cell->cell;
                clause->invert_c = cell->invert;
                cell = state_get_grid_cell_allow_oob(t + 1, x, y);
                clause->next = cell->cell;
                clause->invert_next = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y - 1);
                clause->nw = cell->cell;
                clause->invert_nw = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x, y - 1);
                clause->n = cell->cell;
                clause->invert_n = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y - 1);
                clause->ne = cell->cell;
                clause->invert_ne = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y);
                clause->w = cell->cell;
                clause->invert_w = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y);
                clause->e = cell->cell;
                clause->invert_e = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x - 1, y + 1);
                clause->sw = cell->cell;
                clause->invert_sw = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x, y + 1);
                clause->s = cell->cell;
                clause->invert_s = cell->invert;
                cell = state_get_grid_cell_allow_oob(t, x + 1, y + 1);
                clause->se = cell->cell;
                clause->invert_se = cell->invert;
                reset_clause_state(clause);
                // fill all the clause pointers inside the cells
                #define add(cell_to_use, name_to_set) \
                    do { \
                        if (cell_to_use->value != UNKNOWN) { \
                            break; \
                        } \
                        Cell* cell = (cell_to_use); \
                        bool found = false; \
                        for (size_t j = 0; j < cell->use_count; j++) { \
                            if (cell->uses[j].name_to_set == NULL) { \
                                cell->uses[j].name_to_set = clause; \
                                found = true; \
                                break; \
                            } \
                        } \
                        if (!found) { \
                            unexpected_error("Cell use count too small: %zu (for variable %zu)", cell->use_count, cell->var_number); \
                        } \
                    } while (false)
                add(clause->c, c);
                add(clause->next, prev);
                add(clause->nw, se);
                add(clause->n, s);
                add(clause->ne, sw);
                add(clause->w, e);
                add(clause->e, w);
                add(clause->sw, ne);
                add(clause->s, n);
                add(clause->se, nw);
                #undef add
                state.ca_clauses[i] = clause;
                i++;
            }
        }
    }
    internal_init_state_symmetry();
}

#define check_ferror(file) \
    do { \
        if (ferror(file)) { \
            fclose(file); \
            error("Could not read search file (possibly corrupted)"); \
        } \
    } while (0)

long search_file_error_pos;
#define search_file_error(format, ...) (search_file_error_pos = ftell(file), fclose(file), error("Invalid pattern file (near position %li): "format, search_file_error_pos, ##__VA_ARGS__))

[[gnu::format(scanf, 2, 3)]] static bool check_line(FILE* file, const char* format, ...) {
    // run vfscanf
    long start_pos = ftell(file);
    if (start_pos == -1) {
        fclose(file);
        error("Could not read search file (ftell returned -1)");
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
    int v_int;
    double v_double;
    size_t v_size;
    intmax_t v_intmax;
    intmax_t v_intmax_2;
    uintmax_t v_uintmax;
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
            cell.var = 0;
            cell.invert = false;
            cell.no_clause = false;
            int64_t value;
            if (fscanf(file, " %"SCNi64, &value) != 1) {
                check_ferror(file);
                search_file_error("Missing grid element");
            }
            if (value == 0) {
                search_file_error("Grid element is 0");
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
                search_file_error("Missing transition");
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
                search_file_error("Missing search order item");
            }
            config.search_order[i][0] = t;
            config.search_order[i][1] = x;
            config.search_order[i][2] = y;
        }
    } else if (check_line(file, "initial_value = %i", &v_int)) {
        config.initial_value = v_int == 0 ? OFF : ON;
    } else if (check_line(file, "periodic = ( %ji , %ji ) c / %zu", &v_intmax, &v_intmax_2, &v_size)) {
        config.periodic = true;
        config.periodic_dx = v_intmax;
        config.periodic_dy = v_intmax_2;
        config.periodic_period = v_size;
    } else if (check_line(file, "check_early_exhaustion = %i", &v_int)) {
        config.check_early_exhaustion = v_int;
    } else if (check_line(file, "benchmarking_iterations = %ju", &v_uintmax)) {
        config.benchmarking = true;
        config.benchmarking_iterations = v_uintmax;
    } else if (check_line(file, "reporting_interval = %lf", &v_double)) {
        config.reporting_interval = v_double;
    } else if (check_line(file, "top_padding = %zu", &v_size)) {
        config.top_padding = v_size;
    } else if (check_line(file, "bottom_padding = %zu", &v_size)) {
        config.bottom_padding = v_size;
    } else if (check_line(file, "left_padding = %zu", &v_size)) {
        config.left_padding = v_size;
    } else if (check_line(file, "right_padding = %zu", &v_size)) {
        config.right_padding = v_size;
    } else if (check_line(file, "start_padding = %zu", &v_size)) {
        config.start_padding = v_size;
    } else if (check_line(file, "end_padding = %zu", &v_size)) {
        config.end_padding = v_size;
    } else if (check_line(file, "after_rule_text = %255s", v_str)) {
        size_t len = strnlen(v_str, 255) + 1;
        config.after_rule_text = safe_malloc(len * sizeof(char));
        strncpy(config.after_rule_text, v_str, len);
    } else if (check_line(file, "show_solutions = %i", &v_int)) {
        config.show_solutions = v_int;
    } else if (check_line(file, "max_solutions = %ju", &v_uintmax)) {
        config.max_solutions = v_uintmax;
    } else if (check_line(file, "filter_empty_solutions = %i", &v_int)) {
        config.filter_empty_solutions = v_int;
    } else if (check_line(file, "filter_duplicate_solutions = %i", &v_int)) {
        config.filter_duplicate_solutions = v_int;
    } else if (check_line(file, "filter_subperiod_solutions = %i", &v_int)) {
        config.filter_subperiod_solutions = v_int;
    } else if (check_line(file, "cell_period_filter ( length = %zu ) =", &v_size)) {
        config.cell_period_filter_length = v_size;
        config.cell_period_filter = safe_malloc(config.cell_period_filter_length * sizeof(int));
        for (size_t i = 0; i < config.cell_period_filter_length; i++) {
            size_t value;
            if (fscanf(file, " %zu", &value) != 1) {
                check_ferror(file);
                search_file_error("Missing cell period filter item");
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
            search_file_error("Unrecognized line");
        }
    }
    return true;
}

#if IN_BROWSER
char search_file[] = SEARCH_FILE_GOES_HERE;
#endif
static inline void init_state_and_config_from_file([[maybe_unused]] char* path) {
    errno = 0;
    #if IN_BROWSER
        FILE* file = fmemopen(search_file, sizeof(search_file) - 1, "r");
    #else
        FILE* file = fopen(path, "r");
    #endif
    if (file == NULL) {
        perror("Error: Cannot read search file");
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
    // call this here rather than in the main function
    // so that the clause manipulation in init_state works fine
    init_bv1024();
    init_state(&data);
    if (data.grid != NULL) {
        safe_free(data.grid);
    }
    printf("Loaded search: %zu variables, %zu clauses\n", state.var_count, state.ca_clause_count);
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

static void destroy_all(void) {
    destroy_clause_stack();
    destroy_stack(&current_stack);
    destroy_solutions();
    destroy_state();
    destroy_config();
    destroy_progress();
}

int main(int argc, char** argv) {
    if (argc != 2) {
        fprintf(stderr, "Expected exactly 1 command line argument");
        exit(EXIT_FAILURE);
    }
    calibrate_time();
    #ifdef FOR_PROFILE
        signal(SIGTERM, handle_sigterm);
    #endif
    init_state_and_config_from_file(argv[1]);
    debug_print_grid_1();
    init_solutions();
    init_stack(&current_stack);
    init_clause_stack();
    init_progress();
    bool solved_in_preprocessing = preprocess();
    if (!solved_in_preprocessing) {
        debug_print_grid_1();
        run_search();
    }
    destroy_all();
    return 0;
}
