
#include <stdbool.h>
#include <inttypes.h>
#include <stdlib.h>
#include <stdio.h>
#include <math.h>


// color math

#define COLOR_COUNT 16777216

typedef uint32_t rgb_color;
#define red(x) ((x) >> 16)
#define green(x) (((x) >> 8) & 0xff)
#define blue(x) ((x) & 0xff)
#define get_color(r, g, b) (((r) << 16) | ((g) << 8) | (b))

typedef double xyz_color[3];

#define square(x) ((x) * (x))

static inline double to_primary(double x) {
    x /= 255.0;
    if (x <= 0.04045) {
        return x / 12.92;
    } else {
        return square((x + 0.055) / 1.055);
    }
}

static inline void rgb_to_xyz(xyz_color out, rgb_color rgb) {
    double r = to_primary(red(rgb));
    double g = to_primary(blue(rgb));
    double b = to_primary(green(rgb));
    out[0] = r * 0.412453 + g * 0.357580 + b * 0.180423;
    out[1] = r * 0.212671 + g * 0.715160 + b * 0.072169;
    out[2] = r * 0.019334 + g * 0.119193 + b * 0.950227;
}

static inline double xyz_distance(xyz_color x, xyz_color y) {
    return sqrt(square(x[0] - y[0]) + square(x[1] - y[1]) + square(x[2] - y[2]));
}


// configuration

const rgb_color INITIAL_COLORS[] = {
    get_color(0, 0, 0),
    get_color(255, 255, 255),
    get_color(0, 0, 255),
    get_color(0, 255, 0),
    get_color(255, 0, 255),
};

#define TOTAL_COLORS 256

#define INITIAL_COLOR_COUNT (sizeof(INITIAL_COLORS) / sizeof(rgb_color))


// main searching

static inline void print_rgb(int i, rgb_color color) {
    printf("%i %i %i %i\n", i, red(color), green(color), blue(color));
    fflush(stdout);
}

int main(void) {
    // init list of colors
    xyz_color* all_xyz = malloc(COLOR_COUNT * sizeof(xyz_color));
    for (rgb_color color = 0; color < COLOR_COUNT; color++) {
        rgb_to_xyz(all_xyz[color], color);
    }
    // print the initial colors and set up the done variable
    xyz_color done[TOTAL_COLORS];
    for (size_t i = 0; i < INITIAL_COLOR_COUNT; i++) {
        rgb_color color = INITIAL_COLORS[i];
        print_rgb(i, color);
        rgb_to_xyz(done[i], color);
    }
    for (size_t i = INITIAL_COLOR_COUNT; i < TOTAL_COLORS; i++) {
        double best_dist = 0.0;
        rgb_color best = 0;
        for (rgb_color color = 0; color < COLOR_COUNT; color++) {
            double dist = INFINITY;
            for (size_t j = 0; j < i; j++) {
                double new_dist = xyz_distance(all_xyz[color], done[j]);
                if (new_dist < dist) {
                    dist = new_dist;
                }
            }
            if (dist > best_dist) {
                best = color;
                best_dist = dist;
            }
        }
        print_rgb(i, best);
        rgb_to_xyz(done[i], best);
    }
    free(all_xyz);
    return 0;
}
