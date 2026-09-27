
// defines the dynamic grid type

#pragma once

#include <inttypes.h>

#include "params2.h"
#include "base.c"


// dynamic grid index
typedef uint64_t size_t;
#define PRIdindex PRIu64


typedef struct DynamicCell {
    CellValue value;
    size_t var;
} DynamicCell;

static inline __attribute__((always_inline)) bool dc_eq(DynamicCell x, DynamicCell y) {
    return x.value == y.value && x.var == y.var;
}

typedef struct DynamicGrid {
    bool used;
    size_t width;
    size_t height;
    size_t gens;
    DynamicCell* data;
} DynamicGrid;

const DynamicGrid empty_dynamic_grid = {
    .used = false,
    .width = 0,
    .height = 0,
    .gens = 0,
    .data = NULL,
};

#define dg_index(grid, t, x, y) (((grid)->data)[((((t) * (grid)->height) + (y)) * (grid)->width) + (x)])
#define direct_dg_index(grid, t, x, y) (((grid).data)[((((t) * (grid).height) + (y)) * (grid).width) + (x)])

static inline void dg_destroy(DynamicGrid* grid) {
    if (grid->used) {
        safe_free(grid->data);
        grid->used = false;
    }
}

static inline void dg_init(DynamicGrid* grid, size_t width, size_t height, size_t gens) {
    if (grid->used && grid->width == width && grid->height == height && grid->gens == gens) {
        return;
    }
    dg_destroy(grid);
    grid->used = true;
    grid->width = width;
    grid->height = height;
    grid->gens = gens;
    grid->data = safe_malloc(width * height * gens * sizeof(DynamicCell));
}

static inline __attribute__((always_inline)) CellValue dg_get(DynamicGrid* grid, size_t t, size_t x, size_t y) {
    return dg_index(grid, t, x, y).value;
}

static inline __attribute__((always_inline)) void dg_set(DynamicGrid* grid, size_t t, size_t x, size_t y, CellValue value) {
    dg_index(grid, t, x, y).value = value;
    dg_index(grid, t, x, y).var = NO_VAR;
}

static inline __attribute__((always_inline)) void dg_set_from_cell(DynamicGrid* grid, size_t t, size_t x, size_t y, Cell* cell) {
    dg_index(grid, t, x, y).value = cell->value;
    dg_index(grid, t, x, y).var = cell->var_number;
}

static inline __attribute__((always_inline)) size_t dg_get_var(DynamicGrid* grid, size_t t, size_t x, size_t y) {
    return dg_index(grid, t, x, y).var;
}

static inline __attribute__((always_inline)) void dg_set_var(DynamicGrid* grid, size_t t, size_t x, size_t y, CellValue value, size_t var) {
    dg_index(grid, t, x, y).value = value;
    dg_index(grid, t, x, y).var = var;
}

static inline void dg_init_from_search_grid(DynamicGrid* out) {
    dg_init(out, state.width, state.height, state.gens);
    for (size_t t = 0; t < state.gens; t++) {
        for (size_t y = 0; y < state.height; y++) {
            for (size_t x = 0; x < state.width; x++) {
                dg_set_from_cell(out, t, x, y, state_get_cell(t, x, y));
            }
        }
    }
}


static inline bool dg_eq(DynamicGrid* x, DynamicGrid* y) {
    if (x->width != y->width || x->height != y->height || x->gens != y->gens) {
        return false;
    }
    for (size_t t = 0; t < x->gens; t++) {
        for (size_t yi = 0; yi < x->height; yi++) {
            for (size_t xi = 0; xi < x->width; xi++) {
                if (!dc_eq(dg_index(x, t, xi, yi), dg_index(y, t, xi, yi))) {
                    return false;
                }
            }
        }
    }
    return true;
}

static inline void dg_copy(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, x, y) = dg_index(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_horizontal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, grid->width - x - 1, y) = dg_index(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_vertical(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, x, grid->height - y - 1) = dg_index(grid, t, x, y);
            }
        }
    }
}

static inline void dg_rotate_left(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, grid->height - y - 1, x) = dg_index(grid, t, x, y);
            }
        }
    }
}


static inline void dg_rotate_right(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, y, grid->width - x - 1) = dg_index(grid, t, x, y);
            }
        }
    }
}


static inline void dg_rotate_180(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, grid->width - x - 1, grid->height - y - 1) = dg_index(grid, t, x, y);
            }
        }
    }
}


static inline void dg_flip_diagonal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, y, x) = dg_index(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_anti_diagonal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (size_t t = 0; t < grid->gens; t++) {
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t x = 0; x < grid->width; x++) {
                dg_index(out, t, grid->height - y - 1, grid->width - x - 1) = dg_index(grid, t, x, y);
            }
        }
    }
}

static inline void dg_extract_gen(DynamicGrid* out, DynamicGrid* grid, size_t t) {
    dg_init(out, grid->width, grid->height, 1);
    for (size_t y = 0; y < grid->height; y++) {
        for (size_t x = 0; x < grid->width; x++) {
            dg_index(out, 0, x, y) = dg_index(grid, t, x, y);
        }
    }
}

typedef struct DGShrinkToFitOffsets {
    size_t x;
    size_t y;
} DGShrinkToFitOffsets;

static inline DGShrinkToFitOffsets dg_shrink_to_fit(DynamicGrid* out, DynamicGrid* grid) {
    size_t shrink_top = 0;
    for (size_t y = 0; y < grid->height; y++) {
        bool found = false;
        for (size_t x = 0; x < grid->width; x++) {
            for (size_t t = 0; t < grid->gens; t++) {
                if (dg_get(grid, t, x, y) != OFF) {
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
        } else {
            shrink_top++;
        }
    }
    size_t shrink_bottom = 0;
    for (size_t y = grid->height; y > 0; y--) {
        bool found = false;
        for (size_t x = 0; x < grid->width; x++) {
            for (size_t t = 0; t < grid->gens; t++) {
                if (dg_get(grid, t, x, y - 1) != OFF) {
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
        } else {
            shrink_bottom++;
        }
    }
    size_t shrink_left = 0;
    for (size_t x = 0; x < grid->width; x++) {
        bool found = false;
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t t = 0; t < grid->gens; t++) {
                if (dg_get(grid, t, x, y) != OFF) {
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
        } else {
            shrink_left++;
        }
    }
    size_t shrink_right = 0;
    for (size_t x = grid->width; x > 0; x--) {
        bool found = false;
        for (size_t y = 0; y < grid->height; y++) {
            for (size_t t = 0; t < grid->gens; t++) {
                if (dg_get(grid, t, x - 1, y) != OFF) {
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
        } else {
            shrink_right++;
        }
    }
    size_t width = grid->width - shrink_left - shrink_right;
    size_t height = grid->height - shrink_top - shrink_bottom;
    size_t x_offset = shrink_left;
    size_t y_offset = shrink_top;
    dg_init(out, width, height, grid->gens);
    for (size_t t = 0; t < out->gens; t++) {
        for (size_t y = 0; y < out->height; y++) {
            for (size_t x = 0; x < out->width; x++) {
                dg_index(out, t, x, y) = dg_index(grid, t, x + x_offset, y + y_offset);
            }
        }
    }
    return (DGShrinkToFitOffsets){.x = x_offset, .y = y_offset};
}


static inline Transformations dg_get_identity_transforms(DynamicGrid* grid) {
    Transformations out;
    DynamicGrid temp = empty_dynamic_grid;
    dg_flip_horizontal(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.flip_horizontal = true;
    }
    dg_flip_vertical(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.flip_vertical = true;
    }
    dg_rotate_left(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.rotate_left = true;
    }
    dg_rotate_right(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.rotate_right = true;
    }
    dg_rotate_180(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.rotate_180 = true;
    }
    dg_flip_diagonal(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.flip_diagonal = true;
    }
    dg_flip_anti_diagonal(&temp, grid);
    if (dg_eq(grid, &temp)) {
        out.flip_anti_diagonal = true;
    }
    dg_destroy(&temp);
    return out;
}

static inline StaticSymmetry dg_get_symmetry(DynamicGrid* grid) {
    return transforms_to_sts(dg_get_identity_transforms(grid));
}

static inline void internal_init_state_symmetry(void) {
    DynamicGrid grid;
    dg_init_from_search_grid(&grid);
    state.symmetry = dg_get_symmetry(&grid);
    dg_destroy(&grid);
}
