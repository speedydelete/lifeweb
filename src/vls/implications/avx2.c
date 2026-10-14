
#pragma once

#include <inttypes.h>

#include "../base.c"
#include "base.c"  // IWYU pragma: keep

#if IMPLICATION_BACKEND == IMPLICATION_BACKEND_AVX2

#include <immintrin.h>


static inline int implicstate_get_bit(ImplicState state, int bit) {
    uint64_t word;
    memcpy(&word, (const unsigned char*)state + 8 * (bit >> 6), sizeof word);
    return (word >> (bit & 63)) & 1;
}

static inline void implicstate_set_bit(ImplicState state, int bit, int value) {
    unsigned char *p = (unsigned char*)state + 8 * (bit >> 6);
    uint64_t word;
    memcpy(&word, p, sizeof word);
    if (value == 0) {
        word &= ~((uint64_t)1 << (bit & 63));
    } else {
        word |= ((uint64_t)1 << (bit & 63));
    }
    memcpy(p, &word, sizeof word);
}

static inline bool implicstate_is_contradiction(ImplicState state) {
    __m256i any = _mm256_setzero_si256();
    for (int i = 0; i < 4; i++) {
        any = _mm256_or_si256(any, _mm256_load_si256(state + i));
    }
    return _mm256_testz_si256(any, any) != 0;
}

static void implicstate_set_cell(ImplicState state, int pos, CellValue value) {
    __m256i* mask = IMPLICSTATE_CELL_MASKS[value - 1][pos];
    for (int i = 0; i < 4; i++) {
        state[i] = _mm256_and_si256(_mm256_load_si256(state + i), _mm256_load_si256(mask + i));
    }
}

static inline bool check_single_cell_implications(CAClause* clause, int pos, Cell* cell) {
    if (cell->value != UNKNOWN) {
        return true;
    }
    // maybe uncomment and inline? idk
    // if (implicstate_is_contradiction(clause_state(clause))) {
    //     return false;
    // }
    __m256i* mask = IMPLICSTATE_CELL_MASKS[0][pos];
    __m256i any = _mm256_setzero_si256();
    for (int i = 0; i < 4; i++) {
        any = _mm256_or_si256(any, _mm256_and_si256(_mm256_load_si256(clause_state(clause) + i), _mm256_load_si256(mask + i)));
    }
    bool can_be_0 = _mm256_testz_si256(any, any) == 0;
    mask = IMPLICSTATE_CELL_MASKS[1][pos];
    any = _mm256_setzero_si256();
    for (int i = 0; i < 4; i++) {
        any = _mm256_or_si256(any, _mm256_and_si256(_mm256_load_si256(clause_state(clause) + i), _mm256_load_si256(mask + i)));
    }
    bool can_be_1 = _mm256_testz_si256(any, any) == 0;
    debug_printf_4("Implication for clause %zu: pos = %i, variable = %zu, can_be_0 = %i, can_be_1 = %i\n", clause->number, pos, cell->var_number, can_be_0, can_be_1);
    #if DEBUG >= 5
        print_implicstate(clause_state(clause));
    #endif
    if (!can_be_0 && !can_be_1) {
        // it can't be anything, so contradiction!
        return false;
    } else if (!can_be_0 && can_be_1) {
        return internal_clause_set_cell(cell, ON, false);
    } else if (can_be_0 && !can_be_1) {
        return internal_clause_set_cell(cell, OFF, false);
    } else {
        // can't do anything with it
        return true;
    }
}

static bool set_cell(Cell* cell, CellValue value) {
    // TODO: HANDLE ALIASES HERE
    cell->value = value;
    inc_debug_depth();
    CAClause* changed_clauses[cell->use_count * 10];
    size_t changed_clause_count = 0;
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #if DEBUG >= 5
            #define hi print_implicstate
        #else
            #define hi(...)
        #endif
        #define update(clause, pos) \
            if ((clause) != NULL) { \
                debug_printf_4("Setting cell in clause %zu: pos = %i (aka "#clause"), value = %i, state_number = %i\n", (clause)->number, pos, value, (clause)->state_number); \
                hi(clause_state(clause)); \
                clause->state_number++; \
                __m256i* mask = IMPLICSTATE_CELL_MASKS[value - 1][pos]; \
                bool contradiction = true; \
                for (int i = 0; i < 4; i++) { \
                    __m256i result = _mm256_and_si256(_mm256_load_si256(clause->states[clause->state_number - 1] + i), _mm256_load_si256(mask + i)); \
                    if (_mm256_testz_si256(result, result) == 0) { \
                        contradiction = false; \
                    } \
                    clause_state(clause)[i] = result; \
                } \
                if (contradiction) { \
                    hi(clause_state(clause)); \
                    debug_printf_3("Contradiction in set_cell, unwinding\n"); \
                    cell->value = UNKNOWN; \
                    clause->state_number--; \
                    for (size_t i = 0; i < changed_clause_count; i++) { \
                        changed_clauses[i]->state_number--; \
                    } \
                    dec_debug_depth(); \
                    return false; \
                } \
                changed_clauses[changed_clause_count] = clause; \
                changed_clause_count++; \
            }
        update(data->prev, 0);
        update(data->nw, 1);
        update(data->w, 2);
        update(data->sw, 3);
        update(data->n, 4);
        update(data->c, 5);
        update(data->s, 6);
        update(data->ne, 7);
        update(data->e, 8);
        update(data->se, 9);
        #undef update
        #undef hi
    }
    dec_debug_depth();
    return true;
}

static void unset_cell(Cell* cell) {
    // TODO: HANDLE ALIASES HERE
    cell->value = UNKNOWN;
    inc_debug_depth();
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #if DEBUG >= 5
            #define hi print_implicstate
        #else
            #define hi(...)
        #endif
        #define update(clause, pos) \
            if ((clause) != NULL) { \
                debug_printf_4("Unsetting cell in clause %zu: pos = %i (aka "#clause"), state_number = %i\n", (clause)->number, pos, (clause)->state_number); \
                hi(clause_state(clause)); \
                clause->state_number--; \
                hi(clause_state(clause)); \
            }
        update(data->prev, 0);
        update(data->nw, 1);
        update(data->w, 2);
        update(data->sw, 3);
        update(data->n, 4);
        update(data->c, 5);
        update(data->s, 6);
        update(data->ne, 7);
        update(data->e, 8);
        update(data->se, 9);
        #undef update
        #undef hi
    }
    dec_debug_depth();
}

static bool alias(Cell* cell, Cell* alias_to, bool invert) {
    // Cell* original_cell = cell;
    if (alias_to->alias) {
        invert = invert != alias_to->invert_alias;
        alias_to = alias_to->alias;
    }
    cell->alias = alias_to;
    cell->invert_alias = invert;
    // we have to do even more stuff now...
    // that is not yet implemented
    if (cell->value != alias_to->value) {
        unexpected_error("No aliasing yet");
    }
    return true;
}

static void unalias(Cell* cell) {
    cell->alias = NULL;
    // we have to do even more stuff here
    unexpected_error("No unaliasing yet");
}

static void compute_implication_state(CAClause* clause) {
    for (int i = 0; i < 4; i++) {
        _mm256_store_si256(clause_state(clause) + i, _mm256_load_si256(full_implic_state + i));
    }
    #define add(cell, pos) \
        if ((cell)->value != UNKNOWN) { \
            implicstate_set_cell(clause_state(clause), (pos), (cell)->value); \
        }
    add(clause->nw, 9);
    add(clause->w, 8);
    add(clause->sw, 7);
    add(clause->n, 6);
    add(clause->c, 5);
    add(clause->s, 4);
    add(clause->ne, 3);
    add(clause->e, 2);
    add(clause->se, 1);
    add(clause->next, 0);
    #undef add
    #if DEBUG >= 5
        printf("Initial state for clause %zu\n", clause->number);
        print_implicstate(clause_state(clause));
    #endif
}


#endif
