
#include <inttypes.h>
#include <stdlib.h>

#include "params2.h"
#include "base.c"


// dynamic grid index
typedef uint64_t DIndex;
#define PRIdindex PRIu64

#if VARIABLES

typedef struct DynamicCell {
    CellValue value;
    Variable var;
}

static inline __attribute__((always_inline)) bool dc_eq(DynamicCell x, DynamicCell y) {
    return x.value == y.value && x.var == y.var;
}

#else

typedef struct DynamicCell {
    CellValue value;
} DynamicCell;

static inline __attribute__((always_inline)) bool dc_eq(DynamicCell x, DynamicCell y) {
    return x.value == y.value;
}

#endif

typedef struct DynamicGrid {
    bool used;
    DIndex width;
    DIndex height;
    DIndex gens;
    DynamicCell* data;
} DynamicGrid;

const DynamicGrid empty_dynamic_grid = {
    .used = false,
    .width = 0,
    .height = 0,
    .gens = 0,
    .data = NULL,
};

#define di(grid, t, x, y) (((grid)->data)[((((t) * (grid)->height) + (y)) * (grid)->width) + (x)])
#define ddi(grid, t, x, y) (((grid).data)[((((t) * (grid).height) + (y)) * (grid).width) + (x)])

static inline void dg_destroy(DynamicGrid* grid) {
    if (grid->used) {
        free(grid->data);
        grid->used = false;
    }
}

static inline void dg_init(DynamicGrid* grid, DIndex width, DIndex height, DIndex gens) {
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

static inline __attribute__((always_inline)) CellValue dg_get(DynamicGrid* grid, DIndex t, DIndex x, DIndex y) {
    return di(grid, t, x, y).value;
}

static inline __attribute__((always_inline)) void dg_set(DynamicGrid* grid, DIndex t, DIndex x, DIndex y, CellValue value) {
    di(grid, t, x, y).value = value;
    #if VARIABLES
    di(grid, t, x, y).var = NO_VAR;
    #endif
}

static inline __attribute__((always_inline)) void dg_set_from_cell(DynamicGrid* grid, DIndex t, DIndex x, DIndex y, Cell* cell) {
    di(grid, t, x, y).value = cell->value;
    #if VARIABLES
    di(grid, t, x, y).var = cell->var;
    #endif
}

#if VARIABLES

static inline __attribute__((always_inline)) CellValue dg_get_var(DynamicGrid* grid, DIndex t, DIndex x, DIndex y) {
    return di(grid, t, x, y).var;
}

static inline __attribute__((always_inline)) void dg_set_var(DynamicGrid* grid, DIndex t, DIndex x, DIndex y, CellValue value, Variable var) {
    di(grid, t, x, y).value = value;
    di(grid, t, x, y).var = var;
}

#endif

static inline void dg_init_from_search_grid(DynamicGrid* out) {
    dg_init(out, WIDTH, HEIGHT, GENS);
    for (DIndex t = 0; t < GENS; t++) {
        for (DIndex y = 0; y < HEIGHT; y++) {
            for (DIndex x = 0; x < WIDTH; x++) {
                dg_set_from_cell(out, t, x, y, &grid[t][y][x]);
            }
        }
    }
}


static inline bool dg_eq(DynamicGrid* x, DynamicGrid* y) {
    if (x->width != y->width || x->height != y->height || x->gens != y->gens) {
        return false;
    }
    for (DIndex t = 0; t < x->gens; t++) {
        for (DIndex yi = 0; yi < x->height; yi++) {
            for (DIndex xi = 0; xi < x->width; xi++) {
                if (!dc_eq(di(x, t, xi, yi), di(y, t, xi, yi))) {
                    return false;
                }
            }
        }
    }
    return true;
}

static inline void dg_copy(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, x, y) = di(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_horizontal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, grid->width - x - 1, y) = di(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_vertical(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, x, grid->height - y - 1) = di(grid, t, x, y);
            }
        }
    }
}

static inline void dg_rotate_left(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, grid->height - y - 1, x) = di(grid, t, x, y);
            }
        }
    }
}


static inline void dg_rotate_right(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, y, grid->width - x - 1) = di(grid, t, x, y);
            }
        }
    }
}


static inline void dg_rotate_180(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->width, grid->height, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, grid->width - x - 1, grid->height - y - 1) = di(grid, t, x, y);
            }
        }
    }
}


static inline void dg_flip_diagonal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, y, x) = di(grid, t, x, y);
            }
        }
    }
}

static inline void dg_flip_anti_diagonal(DynamicGrid* out, DynamicGrid* grid) {
    dg_init(out, grid->height, grid->width, grid->gens);
    for (DIndex t = 0; t < grid->gens; t++) {
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex x = 0; x < grid->width; x++) {
                di(out, t, grid->height - y - 1, grid->width - x - 1) = di(grid, t, x, y);
            }
        }
    }
}

static inline void dg_extract_gen(DynamicGrid* out, DynamicGrid* grid, DIndex t) {
    dg_init(out, grid->width, grid->height, 1);
    for (DIndex y = 0; y < grid->height; y++) {
        for (DIndex x = 0; x < grid->width; x++) {
            di(out, 0, x, y) = di(grid, t, x, y);
        }
    }
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

typedef struct DGShrinkToFitOffset {
    DIndex x;
    DIndex y;
} DGShrinkToFitOffset;

static inline DGShrinkToFitOffset dg_shrink_to_fit(DynamicGrid* out, DynamicGrid* grid) {
    DIndex shrink_top = 0;
    for (DIndex y = 0; y < grid->height; y++) {
        bool found = false;
        for (DIndex x = 0; x < grid->width; x++) {
            for (DIndex t = 0; t < grid->gens; t++) {
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
    DIndex shrink_bottom = 0;
    for (DIndex y = grid->height; y > 0; y--) {
        bool found = false;
        for (DIndex x = 0; x < grid->width; x++) {
            for (DIndex t = 0; t < grid->gens; t++) {
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
    DIndex shrink_left = 0;
    for (DIndex x = 0; x < grid->width; x++) {
        bool found = false;
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex t = 0; t < grid->gens; t++) {
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
    DIndex shrink_right = 0;
    for (DIndex x = grid->width; x > 0; x--) {
        bool found = false;
        for (DIndex y = 0; y < grid->height; y++) {
            for (DIndex t = 0; t < grid->gens; t++) {
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
    DIndex width = grid->width - shrink_left - shrink_right;
    DIndex height = grid->height - shrink_top - shrink_bottom;
    DIndex x_offset = shrink_left;
    DIndex y_offset = shrink_top;
    dg_init(out, width, height, grid->gens);
    for (DIndex t = 0; t < out->gens; t++) {
        for (DIndex y = 0; y < out->height; y++) {
            for (DIndex x = 0; x < out->width; x++) {
                di(out, t, x, y) = di(grid, t, x + x_offset, y + y_offset);
            }
        }
    }
    return (DGShrinkToFitOffset){.x = x_offset, .y = y_offset};
}
