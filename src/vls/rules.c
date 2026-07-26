
// defines utilities for working with rules

#pragma once

#include <inttypes.h>
#include <string.h>

#include "params2.h"


typedef struct int_spec {
    const int trs_count;
    const int max_map_per_tr;
    const int number_count;
    const int max_letters_per_num;
    const signed char letters[9][14];
    const int16_t trs[102][49];
} int_spec;

const int_spec normal_int = {
    .trs_count = 102,
    .max_map_per_tr = 8,
    .number_count = 9,
    .max_letters_per_num = 13,
    .letters = {
        {'c', -1},
        {'c', 'e', -1},
        {'a', 'c', 'e', 'i', 'k', 'n', -1},
        {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', -1},
        {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 't', 'w', 'y', 'z', -1},
        {'a', 'c', 'e', 'i', 'j', 'k', 'n', 'q', 'r', 'y', -1},
        {'a', 'c', 'e', 'i', 'k', 'n', -1},
        {'c', 'e', -1},
        {'c', -1},
    },
    .trs = {
        {0, -1},
        {4, 256, 1, 64, -1},
        {2, 128, 8, 32, -1},
        {6, 384, 3, 9, 72, 36, 192, 288, -1},
        {5, 320, 65, 260, -1},
        {34, 160, 10, 136, -1},
        {130, 40, -1},
        {66, 129, 258, 264, 12, 96, 132, 33, -1},
        {68, 257, -1},
        {38, 416, 11, 200, -1},
        {69, 321, 261, 324, -1},
        {42, 168, 138, 162, -1},
        {292, 73, 7, 448, -1},
        {137, 74, 164, 224, 35, 392, 290, 14, -1},
        {98, 161, 266, 140, -1},
        {37, 352, 13, 67, 193, 262, 328, 388, -1},
        {100, 289, 265, 259, 196, 70, 76, 385, -1},
        {131, 194, 134, 104, 41, 296, 386, 44, -1},
        {133, 322, 97, 268, -1},
        {420, 294, 201, 39, 480, 15, 75, 456, -1},
        {325, -1},
        {170, -1},
        {45, 360, 195, 390, -1},
        {169, 106, 172, 226, 163, 394, 298, 142, -1},
        {99, 225, 270, 330, 141, 354, 396, 165, -1},
        {356, 293, 329, 263, 452, 71, 77, 449, -1},
        {102, 417, 267, 204, -1},
        {139, 202, 166, 232, 43, 424, 418, 46, -1},
        {135, 450, 105, 300, -1},
        {228, 291, 393, 78, -1},
        {389, 326, 197, 101, 353, 269, 323, 332, -1},
        {198, 387, 297, 108, -1},
        {457, 79, 484, 295, -1},
        {426, 174, 234, 171, -1},
        {453, 327, 357, 333, -1},
        {203, 422, 488, 47, -1},
        {358, 421, 331, 271, 460, 103, 205, 481, -1},
        {397, 334, 229, 355, -1},
        {458, 143, 482, 428, 302, 233, 167, 107, -1},
        {395, 206, 230, 236, 299, 425, 419, 110, -1},
        {364, 301, 361, 391, 454, 199, 109, 451, -1},
        {362, 173, 398, 227, -1},
        {489, 111, 492, 486, 423, 459, 303, 207, -1},
        {490, 175, 430, 235, -1},
        {461, 335, 485, 359, -1},
        {365, 455, -1},
        {429, 366, 237, 231, 483, 399, 363, 462, -1},
        {427, 238, -1},
        {491, 239, 494, 431, -1},
        {493, 367, 487, 463, -1},
        {495, -1},
        {16, -1},
        {20, 272, 17, 80, -1},
        {18, 144, 24, 48, -1},
        {22, 400, 19, 25, 88, 52, 208, 304, -1},
        {21, 336, 81, 276, -1},
        {50, 176, 26, 152, -1},
        {146, 56, -1},
        {82, 145, 274, 280, 28, 112, 148, 49, -1},
        {84, 273, -1},
        {54, 432, 27, 216, -1},
        {85, 337, 277, 340, -1},
        {58, 184, 154, 178, -1},
        {308, 89, 23, 464, -1},
        {153, 90, 180, 240, 51, 408, 306, 30, -1},
        {114, 177, 282, 156, -1},
        {53, 368, 29, 83, 209, 278, 344, 404, -1},
        {116, 305, 281, 275, 212, 86, 92, 401, -1},
        {147, 210, 150, 120, 57, 312, 402, 60, -1},
        {149, 338, 113, 284, -1},
        {436, 310, 217, 55, 496, 31, 91, 472, -1},
        {341, -1},
        {186, -1},
        {61, 376, 211, 406, -1},
        {185, 122, 188, 242, 179, 410, 314, 158, -1},
        {115, 241, 286, 346, 157, 370, 412, 181, -1},
        {372, 309, 345, 279, 468, 87, 93, 465, -1},
        {118, 433, 283, 220, -1},
        {155, 218, 182, 248, 59, 440, 434, 62, -1},
        {151, 466, 121, 316, -1},
        {244, 307, 409, 94, -1},
        {405, 342, 213, 117, 369, 285, 339, 348, -1},
        {214, 403, 313, 124, -1},
        {473, 95, 500, 311, -1},
        {442, 190, 250, 187, -1},
        {469, 343, 373, 349, -1},
        {219, 438, 504, 63, -1},
        {374, 437, 347, 287, 476, 119, 221, 497, -1},
        {413, 350, 245, 371, -1},
        {474, 159, 498, 444, 318, 249, 183, 123, -1},
        {411, 222, 246, 252, 315, 441, 435, 126, -1},
        {380, 317, 377, 407, 470, 215, 125, 467, -1},
        {378, 189, 414, 243, -1},
        {505, 127, 508, 502, 439, 475, 319, 223, -1},
        {506, 191, 446, 251, -1},
        {477, 351, 501, 375, -1},
        {381, 471, -1},
        {445, 382, 253, 247, 499, 415, 379, 478, -1},
        {443, 254, -1},
        {507, 255, 510, 447, -1},
        {509, 383, 503, 479, -1},
        {511, -1},
    },
};

const int_spec hex_int = {
    .trs_count = 13,
    .max_map_per_tr = 48,
    .number_count = 7,
    .max_letters_per_num = 3,
    .letters = {
        {'o', -1},
        {'o', -1},
        {'o', 'm', 'p', -1},
        {'o', 'm', 'p', -1},
        {'o', 'm', 'p', -1},
        {'o', -1},
        {'o', -1},
    },
    .trs = {
        {0, 4, 64, 68, -1},
        {32, 36, 96, 100, 2, 6, 66, 70, 1, 5, 65, 69, 8, 12, 72, 76, 128, 132, 192, 196, 256, 260, 320, 324, -1},
        {34, 38, 98, 102, 3, 7, 67, 71, 9, 13, 73, 77, 136, 140, 200, 204, 384, 388, 448, 452, 288, 292, 352, 356, -1},
        {33, 37, 97, 101, 10, 14, 74, 78, 129, 133, 193, 197, 264, 268, 328, 332, 160, 164, 224, 228, 258, 262, 322, 326, -1},
        {40, 44, 104, 108, 130, 134, 194, 198, 257, 261, 321, 325, -1},
        {35, 39, 99, 103, 11, 15, 75, 79, 137, 141, 201, 205, 392, 396, 456, 460, 416, 420, 480, 484, 290, 294, 354, 358, -1},
        {42, 46, 106, 110, 41, 45, 105, 109, 162, 166, 226, 230, 131, 135, 195, 199, 168, 172, 232, 236, 138, 142, 202, 206, 289, 293, 353, 357, 259, 263, 323, 327, 296, 300, 360, 364, 265, 269, 329, 333, 386, 390, 450, 454, 385, 389, 449, 453, -1},
        {161, 165, 225, 229, 266, 270, 330, 334, -1},
        {393, 397, 457, 461, 424, 428, 488, 492, 418, 422, 482, 486, 291, 295, 355, 359, 43, 47, 107, 111, 139, 143, 203, 207, -1},
        {394, 398, 458, 462, 417, 421, 481, 485, 298, 302, 362, 366, 163, 167, 227, 231, 267, 271, 331, 335, 169, 173, 233, 237, -1},
        {387, 391, 451, 455, 297, 301, 361, 365, 170, 174, 234, 238, -1},
        {395, 399, 459, 463, 425, 429, 489, 493, 426, 430, 490, 494, 419, 423, 483, 487, 299, 303, 363, 367, 171, 175, 235, 239, -1},
        {427, 431, 491, 495, -1},
    },
};


// attempt to unparse transitions
// returns -1 if it fails, the proper (positive) next_char if it succeeds
static inline int unparse_transitions(const int_spec* spec, char* out, int next_char, const bool s) {
    int or = s ? (1 << 4) : 0;
    // array to hold the letters that we've seen
    char seen_letters[spec->max_letters_per_num + 1];
    int trs_index = 0;
    // iterate through each number
    for (int number = 0; number < spec->number_count; number++) {
        // clear the letters array
        for (int i = 0; i < spec->max_letters_per_num + 1; i++) {
            seen_letters[i] = 0;
        }
        // check to see what letters we have
        int num_letters = 0;
        int total_letters = 0;
        for (int i = 0; i < spec->max_letters_per_num + 1; i++) {
            signed char letter = spec->letters[number][i];
            // -1 means that the letters have ran out
            if (letter == -1) {
                break;
            }
            total_letters++;
            // figure out which of the MAP transitions we have
            int count = 0;
            int total = 0;
            for (int i = 0; i < spec->max_map_per_tr; i++) {
                int16_t value = spec->trs[trs_index][i];
                // -1 means that the MAP transitions have ran out
                if (value == -1) {
                    break;
                }
                if (trs[value | or] == 1) {
                    count++;
                }
                total++;
            }
            // printf("%c%c%c: %i/%i\n", s ? 'S' : 'B', '0' + number, letter, count, total);
            // increment transitions index
            // we can do this before processing because it isn't used
            trs_index++;
            if (count == 0) {
                continue;
            } else if (count == total) {
                seen_letters[num_letters++] = letter;
            } else {
                // it's not in the rulespace
                return -1;
            }
        }
        // skip if we don't have any of the letters
        if (num_letters == 0) {
            continue;
        }
        // now unparse it
        out[next_char++] = '0' + number;
        if (num_letters == total_letters) {
            continue;
        } else if (num_letters > (total_letters % 2 == 0 ? (total_letters / 2) : (total_letters / 2 + 1))) {
            out[next_char++] = '-';
            for (int i = 0; i < total_letters; i++) {
                char letter = spec->letters[number][i];
                if (!strchr(seen_letters, letter)) {
                    out[next_char++] = letter;
                }
            }
        } else {
            for (int i = 0; i < num_letters; i++) {
                out[next_char++] = seen_letters[i];
            }
        }
    }
    return next_char;
}

// attempts to get the full rule using the given spec
static inline int _get_rule(const int_spec* spec, char* out) {
    int next_char = 0;
    out[next_char++] = 'B';
    int value = unparse_transitions(spec, out, next_char, false);
    if (value == -1) {
        return -1;
    }
    next_char = value;
    out[next_char++] = '/';
    out[next_char++] = 'S';
    return unparse_transitions(spec, out, next_char, true);
}


// format: (x, y)
const int neighborhood_indexing[9][2] = {
    {1, 1},
    {0, 1},
    {-1, 1},
    {1, 0},
    {0, 0},
    {-1, 0},
    {1, -1},
    {0, -1},
    {-1, -1},
};

static inline void get_trs_neighborhood(cell_value_t trs[512], bool out[9]) {
    for (int i = 0; i < 9; i++) {
        bool found = false;
        for (int tr = 0; tr < 512; tr++) {
            if (trs[(tr & ~(1 << i)) | (0 << i)] != trs[(tr & ~(1 << i)) | (1 << i)]) {
                found = true;
                break;
            }
        }
        out[i] = found;
    }
}

const char base64_table[65] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// unparse a general MAP rule
static inline int unparse_map(char* out) {
    int next_char = 0;
    out[next_char++] = 'M';
    out[next_char++] = 'A';
    out[next_char++] = 'P';
    // unflip the rule diagonally
    cell_value_t trs2[512];
    for (int i = 0; i < 512; i++) {
        // in multi-rule mode, select the minrule
        int value = trs[i] == 3 ? 0 : trs[i];
        trs2[(i & 0b100010001) | ((i & 0b010001000) >> 2) | ((i & 0b001000000) >> 4) | ((i & 0b000100010) << 2) | ((i & 0b000000100) << 4)] = value;
    }
    #define trs trs2
    // get the list of cells that matter
    bool neighborhood[9];
    get_trs_neighborhood(trs, neighborhood);
    // figure out the compactified trs for the right neighborhood
    int type_trs_length;
    cell_value_t type_trs[512];
    if (neighborhood[0] == false && neighborhood[2] == false && neighborhood[6] == false && neighborhood[8] == false) {
        // von neumann
        type_trs_length = 32;
        for (int i = 0; i < 32; i++) {
            type_trs[i] = trs[((i & 0b10000) << 3) | ((i & 0b1110) << 2) | ((i & 0b1) << 1)];
        }
    } else if (neighborhood[2] == false && neighborhood[6] == false) {
        // hexagonal
        type_trs_length = 128;
        for (int i = 0; i < 128; i++) {
            type_trs[i] = trs[((i & 0b1100000) << 2) | ((i & 0b11100) << 1) | ((i & 0b11) << 0)];
        }
    } else {
        // normal
        type_trs_length = 512;
        memcpy(type_trs, trs, sizeof(cell_value_t) * 512);
    }
    // pack the transitions into bytes
    // we use 66 because it evenly divides into 3
    int unparsed_length = (type_trs_length + 8 - 1) / 8;
    cell_value_t unparsed[66];
    for (int i = 0; i < 66; i++) {
        unparsed[i] = 0;
    }
    for (int i = 0; i < type_trs_length; i++) {
        if (type_trs[i]) {
            unparsed[i / 8] |= (1 << (7 - (i % 8)));
        }
    }
    // pack the bytes into base64
    #define break_early(used) if (unparsed_length <= i + used) {break;}
    for (int i = 0; i < 66; i += 3) {
        uint32_t value = (unparsed[i] << 16) | (unparsed[i + 1] << 8) | (unparsed[i + 2]);
        out[next_char++] = base64_table[(value >> 18) & 0x3f];
        out[next_char++] = base64_table[(value >> 12) & 0x3f];
        break_early(1);
        out[next_char++] = base64_table[(value >> 6) & 0x3f];
        break_early(2);
        out[next_char++] = base64_table[(value >> 0) & 0x3f];
        break_early(3);
    }
    #undef break_early
    #undef trs
    return next_char;
}


// unparse the rule
// returns the number of characters printed
static inline int get_rule(char* out) {
    // normal
    int value = _get_rule(&normal_int, out);
    if (value != -1) {
        return value;
    }
    // hex
    value = _get_rule(&hex_int, out);
    if (value != -1) {
        out[value++] = 'H';
        return value;
    }
    // MAP
    return unparse_map(out);
}


struct {
    bool flip_x;
    bool flip_y;
    bool rotate_left;
    bool rotate_right;
    bool rotate_180;
    bool flip_diagonal;
    bool flip_anti_diagonal;
} rule_symmetry;

static inline void get_rule_symmetry(void) {
    bool C2 = true;
    bool C4 = true;
    bool D2h = true;
    bool D2v = true;
    bool D2s = true;
    bool D2b = true;
    for (int i = 0; i < 512; i++) {
        int j = ((i << 6) & 448) | (i & 56) | (i >> 6);
        j = ((j & 73) << 2) | (j & 146) | ((j & 292) >> 2);
        if (trs[i] != trs[j]) {
            C2 = false;
            C4 = false;
            break;
        }
    }
    if (C2) {
        for (int i = 0; i < 512; i++) {
            if (trs[i] != trs[((i >> 2) & 66) | ((i >> 4) & 8) | ((i >> 6) & 1) | ((i << 2) & 132) | ((i << 6) & 256) | ((i << 4) & 32) | (i & 16)]) {
                C4 = false;
                break;
            }
        }
    }
    for (int i = 0; i < 512; i++) {
        if (trs[i] != trs[((i & 73) << 2) | (i & 146) | ((i & 292) >> 2)]) {
            D2h = false;
        }
        if (trs[i] != trs[((i << 6) & 448) | (i & 56) | (i >> 6)]) {
            D2v = false;
        }
        if (trs[i] != trs[(i & 84) | ((i << 8) & 256) | ((i >> 8) & 1) | ((i >> 4) & 10) | ((i << 4) & 160)]) {
            D2s = false;
        }
        if (trs[i] != trs[(i & 273) | ((i >> 2) & 34) | ((i >> 4) & 4) | ((i << 2) & 136) | ((i << 4) & 64)]) {
            D2b = false;
        }
    }
    rule_symmetry.flip_x = D2h;
    rule_symmetry.flip_y = D2v;
    rule_symmetry.rotate_left = C4;
    rule_symmetry.rotate_right = C4;
    rule_symmetry.rotate_180 = C2;
    rule_symmetry.flip_diagonal = D2b;
    rule_symmetry.flip_anti_diagonal = D2s;
}
