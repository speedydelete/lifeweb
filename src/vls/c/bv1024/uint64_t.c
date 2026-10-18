
#pragma once

#include <inttypes.h>

#include "../base.c"
#include "index.c" // IWYU pragma: keep

#if BITVEC1024_BACKEND == BITVEC1024_BACKEND_UINT64_T


static inline int bv1024_get_bit(BitVec1024 state, int bit) {
    return (state[bit >> 6] >> (bit & 63)) & 1;
}

static inline void bv1024_set_bit(BitVec1024 state, int bit, int value) {
    if (value == 0) {
        state[bit >> 6] &= ~((uint64_t)1 << (bit & 63));
    } else {
        state[bit >> 6] |= ((uint64_t)1 << (bit & 63));
    }
}

static inline bool bv1024_is_contradiction(BitVec1024 state) {
    for (int i = 0; i < 16; i++) {
        if (state[i] != 0) {
            return false;
        }
    }
    return true;
}


static inline bool check_single_cell_implications(CAClause* clause, int pos, Cell* cell) {
    if (cell->value != UNKNOWN) {
        return true;
    }
    uint64_t* mask_0 = IMPLICSTATE_CELL_MASKS[0][pos];
    uint64_t* mask_1 = IMPLICSTATE_CELL_MASKS[1][pos];
    uint64_t any_can_be_0 = 0;
    uint64_t any_can_be_1 = 0;
    for (int i = 0; i < 16; i++) {
        uint64_t state = clause_state(clause)[i];
        any_can_be_0 |= (state & mask_0[i]);
        any_can_be_1 |= (state & mask_1[i]);
    }
    bool can_be_0 = any_can_be_0 != 0;
    bool can_be_1 = any_can_be_1 != 0;
    debug_printf_4("Implication for clause %zu: pos = %i, variable = %zu, can_be_0 = %i, can_be_1 = %i\n", clause->number, pos, cell->var_number, can_be_0, can_be_1);
    #if DEBUG >= 5
        print_bv1024(clause_state(clause));
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

#define undo_last_clause_operation(clause) \
    do { \
        clause->history_len--; \
        int bit = bv1024_get_bit(clause->history, clause->history_len); \
        if (bit != 0) { \
            clause->state_number--; \
        } \
        debug_printf_4("Performing unset on clause %zu, history_len = %i -> %i, bit = %i, state_number = %i\n", clause->number, clause->history_len + 1, clause->history_len, bit, clause->state_number); \
    } while (0)

static bool set_cell(Cell* cell, CellValue value) {
    // TODO: HANDLE ALIASES HERE
    inc_debug_depth();
    CAClause* changed_clauses[cell->use_count * 10];
    size_t changed_clause_count = 0;
    BitVec1024 temp;
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #if DEBUG >= 5
            #define hi print_bv1024
        #else
            #define hi(...)
        #endif
        #define update(real_clause, pos) \
            if ((real_clause) != NULL) { \
                CAClause* clause = (real_clause); \
                debug_printf_4("Setting cell in clause %zu: pos = %i (aka "#real_clause"), value = %i, history_len = %i, state_number = %i\n", clause->number, pos, value, clause->history_len, clause->state_number); \
                uint64_t* state = clause_state(clause); \
                hi(state); \
                uint64_t* mask = IMPLICSTATE_CELL_MASKS[value - 1][pos]; \
                bool contradiction = true; \
                bool is_same = true; \
                for (int i = 0; i < 16; i++) { \
                    uint64_t result = state[i] & mask[i]; \
                    if (result != 0) { \
                        contradiction = false; \
                    } \
                    if (result != state[i]) { \
                        is_same = false; \
                    } \
                    temp[i] = result; \
                } \
                if (contradiction) { \
                    debug_printf_3("Contradiction in set_cell, unwinding\n"); \
                    for (size_t i = 0; i < changed_clause_count; i++) { \
                        undo_last_clause_operation(changed_clauses[i]); \
                    } \
                    dec_debug_depth(); \
                    return false; \
                } \
                changed_clauses[changed_clause_count] = clause; \
                changed_clause_count++; \
                int bit; \
                if (is_same) { \
                    bit = 0; \
                } else { \
                    bit = 1; \
                    clause->state_number++; \
                    memcpy(clause_state(clause), temp, sizeof(BitVec1024)); \
                } \
                bv1024_set_bit(clause->history, clause->history_len, bit); \
                clause->history_len++; \
                debug_printf_4("Adding history item to clause %zu: history_len = %i -> %i, bit = %i, state_number = %i\n", clause->number, clause->history_len - 1, clause->history_len, bit, clause->state_number); \
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
    cell->value = value;
    dec_debug_depth();
    return true;
}

static void unset_cell(Cell* cell) {
    inc_debug_depth();
    debug_printf_4("Unsetting variable %zu\n", cell->var_number);
    // TODO: HANDLE ALIASES HERE
    cell->value = UNKNOWN;
    for (size_t i = 0; i < cell->use_count; i++) {
        CellUseData* data = &(cell->uses[i]);
        #if DEBUG >= 5
            #define hi print_bv1024
        #else
            #define hi(...)
        #endif
        #define update(clause, pos) \
            if ((clause) != NULL) { \
                debug_printf_4("Unsetting cell in clause %zu: pos = %i (aka "#clause"), state_number = %i\n", (clause)->number, pos, (clause)->state_number); \
                hi(clause_state(clause)); \
                undo_last_clause_operation(clause); \
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
    if (alias_to->alias) {
        invert = invert != alias_to->invert_alias;
        alias_to = alias_to->alias;
    }
    cell->alias = alias_to;
    cell->invert_alias = invert;
    // maybe more stuff to do here?
    return true;
}

static void unalias(Cell* cell) {
    cell->alias = NULL;
    // maybe more stuff to do here?
}

static void reset_clause_state(CAClause* clause) {
    clause->state_number = 0;
    uint64_t* state = clause_state(clause);
    memcpy(state, full_implic_state, sizeof(BitVec1024));
    #define add(cell, pos) \
        if ((cell)->value != UNKNOWN) { \
            for (int i = 0; i < 16; i++) { \
                state[i] &= IMPLICSTATE_CELL_MASKS[(cell)->value - 1][pos][i]; \
            } \
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
        print_bv1024(state);
    #endif
    clause->history_len = 0;
}


#endif
