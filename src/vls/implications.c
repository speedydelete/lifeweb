
// defines the core searching algorithm

#pragma once

#include <inttypes.h>

#include "base.c"
#ifdef CUSTOM
    #include CUSTOM
#endif


// THIS IS ALL OLD STUFF!!!!!!!

// // implication table
// // tells us what values of unknown cells we can set
// // or what unknown cells we can alias to each other

// // transition format: 0b_01_23_45_67_89_ab_cd_ef_gh_ij
// // 01 67 cd
// // 23 89 ef -> ij
// // 45 ab gh

// // output format for `implication_table`: 0b_012_345_678_9ab_cde_fgh_ijk_lmn_opq_rst_uv
// // if uv = 0, it's a normal implication:
//     // 012 9ab ijk
//     // 345 cde lmn -> rst
//     // 678 fgh opq
//     // each 3-bit value represents something to do with the corresponding cell
//     // alias groups: the variables are aliased with each other, or with their NOTs
//     // 0 - do nothing, for all known cells this must be the value
//     // 1 - must be off
//     // 2 - must be on
//     // 3 - undefined behavior
//     // 4 - alias group 0
//     // 5 - NOT alias group 0
//     // 6 - alias group 1
//     // 7 - NOT alias group 1
// // if uv = 1, it's a contradiction
// // if uv = 2, it's to be looked up in `big_implication_table`

// uint32_t* implication_table;

// // big implication table
// // does the same thing but supports more than 2 alias groups
// // we only need 5 alias groups to have all combinations, because there are only 10 cells
// // not always used
// // output format is a series of 10 4-bit values and then a 2-bit value
// // the 2-bit value: 0 = normal, 1 = contradiction
// // the 4-bit values correspond to cells in the same way as in `implication_table`
// // 1 - must be off
// // 2 - must be on
// // 3 - undefined behavior
// // 4 - alias group 0
// // 5 - NOT alias group 0
// // 6 - alias group 1
// // 7 - NOT alias group 1
// // 8 - alias group 2
// // 9 - NOT alias group 2
// // 10 - alias group 3
// // 11 - NOT alias group 3
// // 12 - alias group 4
// // 13 - NOT alias group 4

// uint64_t* big_implication_table;

// #define DO_NOTHING 0
// #define CONTRADICTION 1
// #define USE_BIG_IMPLICATION_TABLE 2

// static uint32_t tr_to_implication_tr(int16_t tr) {
//     uint32_t out = 0;
//     out |= ((tr & 1) ? ON : OFF) << 2;
//     out |= ((tr & 2) ? ON : OFF) << 4;
//     out |= ((tr & 4) ? ON : OFF) << 6;
//     out |= ((tr & 8) ? ON : OFF) << 8;
//     out |= ((tr & 16) ? ON : OFF) << 10;
//     out |= ((tr & 32) ? ON : OFF) << 12;
//     out |= ((tr & 64) ? ON : OFF) << 14;
//     out |= ((tr & 128) ? ON : OFF) << 16;
//     out |= ((tr & 256) ? ON : OFF) << 18;
//     return out;
// }

// // #define IMPLICATION_CHECK_TR 350550

// #ifdef IMPLICATION_CHECK_TR
//     #include <stdio.h>
//     #define IMPLICATIONDPRINTF(value, ...) if ((value) == IMPLICATION_CHECK_TR) {printf(__VA_ARGS__);}
// #else
//     #define IMPLICATIONDPRINTF(...)
// #endif

// static bool set_alias_in_implication_result(int out[10], int alias, int value) {
//     if (value > 3) {
//         if (alias == value) {
//             return true;
//         }
//         // handle setting an alias to the NOT of its value
//         if (alias % 2 == 1 && value == alias - 1) {
//             return false;
//         } else if (value % 2 == 1 && alias == value - 1) {
//             return false;
//         }
//     }
//     for (int i = 0; i < 10; i++) {
//         if (out[i] == alias) {
//             out[i] = value;
//         } else if (out[i] == alias + 1) {
//             if (value == OFF) {
//                 out[i] = ON;
//             } else if (value == ON) {
//                 out[i] = OFF;
//             } else if (value % 2 == 1) {
//                 out[i] = value - 1;
//             } else {
//                 out[i] = value + 1;
//             }
//         }
//     }
// }

// // helper function for get_implication
// // sets a transition to a value, handling transition aliases
// // returns true if no contradiction, false if contradiction
// static bool set_tr_in_implication_result(int out[10], int index, int value) {
//     int prev_value = out[index];
//     if (prev_value == UNKNOWN) {
//         // if it's not an alias we can just do it
//         out[index] = value;
//         return true;
//     } else if (is_known(prev_value)) {
//         if (value == UNKNOWN) {
//             // don't set a known cell to an unknown value!
//             return true;
//         } else if (is_known(value)) {
//             // both are known
//             return value == prev_value;
//         } else {
//             // setting a known cell to an alias is just setting the alias
//             return set_alias_in_implication_result(out, value, prev_value);
//         }
//     } else {
//         // it's an alias
//         if (value == UNKNOWN) {
//             // it's already aliased, so don't set it to unknown
//             return true;
//         } else if (is_known(value)) {
//             // set the alias to the known value
//             return set_alias_in_implication_result(out, prev_value, value);
//         } else {
//             // they're both aliases, reassign one to the other
//             return set_alias_in_implication_result(out, prev_value, value);
//         }
//     }
// }

// static uint64_t get_implication(uint32_t packed_tr, bool* possible_table, bool* can_make_small) {
//     // unpack the transition
//     int tr[10];
//     for (int i = 0; i < 10; i++) {
//         tr[i] = (packed_tr >> (2 * i)) & 3;
//     }
//     // figure out what unknown cells there are in the transition
//     int unknown_count = 0;
//     int unknown_indices[10];
//     for (int i = 0; i < 10; i++) {
//         if (tr[i] == UNKNOWN) {
//             unknown_indices[unknown_count] = i;
//             unknown_count++;
//         }
//     }
//     // special case for when there are no unknown cells
//     if (unknown_count == 0) {
//         CellValue value = trs[0
//             | ((tr[1] == ON ? 1 : 0) << 0)
//             | ((tr[2] == ON ? 1 : 0) << 1)
//             | ((tr[3] == ON ? 1 : 0) << 2)
//             | ((tr[4] == ON ? 1 : 0) << 3)
//             | ((tr[5] == ON ? 1 : 0) << 4)
//             | ((tr[6] == ON ? 1 : 0) << 5)
//             | ((tr[7] == ON ? 1 : 0) << 6)
//             | ((tr[8] == ON ? 1 : 0) << 7)
//             | ((tr[9] == ON ? 1 : 0) << 8)
//         ];
//         // if it matches with the next field of the
//         // implication tr, it's good, otherwise contradiction
//         if (value == tr[0]) {
//             return DO_NOTHING;
//         } else {
//             return CONTRADICTION;
//         }
//     }
//     // build the table of possible satisfactions of the formula
//     // false = contradiction, true = no contradiction
//     size_t possible_table_len = (size_t)1 << unknown_count;
//     memset(possible_table, 0, possible_table_len);
//     for (size_t i = 0; i < possible_table_len; i++) {
//         int trs_tr = 0;
//         int set_unknowns = 0;
//         int loc = 0;
//         for (int j = 0; j < 10; j++) {
//             CellValue value = tr[j];
//             if (value == UNKNOWN) {
//                 value = ((i >> set_unknowns) & 1);
//                 set_unknowns++;
//             } else {
//                 value = value == ON ? 1 : 0;
//             }
//             trs_tr |= value << loc;
//             loc++;
//         }
//         possible_table[i] = trs[trs_tr >> 1] == (trs_tr & 1);
//     }

//     // look for aliases, which is when a cell can be proven
//     // to be equal to another or the logical NOT of another
//     // we know this is true when, no matter the values of the other cells,
//     // their equality leads to a contradiction or their inequality does
//     for (int var1 = 0; var1 < unknown_count; var1++) {
//         for (int var2 = 0; var2 < unknown_count; var2++) {
//             if (var1 == var2) {
//                 continue;
//             }
//             // whether it is the case that they must be unequal
//             // see below for reasoning on why this works
//             bool is_unequal = table[0] == false;
//             bool found = false;
//             for (size_t j = 0; j < possible_table_len; j++) {
//                 bool value = ((j >> var1) & 1) == ((j >> var2) & 1);
//                 bool expected = table[j];
//                 if (is_unequal) {
//                     expected = !expected;
//                 }
//                 if (value != expected) {
//                     found = true;
//                     break;
//                 }
//             }
//             if (!found) {
//                 int group = next_alias_group;
//                 next_alias_group += 2;
//                 if (!set_tr_in_implication_result(out, unknown_indices[var1], group)) {
//                     return CONTRADICTION;
//                 }
//                 if (!set_tr_in_implication_result(out, unknown_indices[var2], is_unequal ? group + 1 : group)) {
//                     return CONTRADICTION;
//                 }
//             }
//         }
//     }
//     // look for cases where we can imply a variable value directly, this is when the unknown
//     // cell is always equal or unequal to the table lookup, disregarding all the other cells
//     for (int i = 0; i < unknown_count; i++) {
//         bool found = false;
//         // is true if we are checking for ON, is false if we are checking for OFF
//         // this works because for index 0, the value of the unknown cell is always 0,
//         // no matter which cell it is, so if it is a contradiction we know it must be ON
//         bool checking_for_on = table[0] == false;
//         for (size_t j = 0; j < possible_table_len; j++) {
//             bool value = (j >> i) & 1;
//             bool expected = table[j];
//             if (checking_for_on) {
//                 expected = !expected;
//             }
//             if (value != expected) {
//                 found = true;
//                 break;
//             }
//         }
//         if (!found) {
//             if (!set_tr_in_implication_result(out, unknown_indices[i], invert ? ON : OFF)) {
//                 return CONTRADICTION;
//             }
//         }
//     }
//     // remove unused alias groups
//     next_alias_group = 4;
//     // 30 is probably too many but better to be safe
//     int alias_group_mapping[30];
//     memset(alias_group_mapping, 30, 0);
//     for (int i = 0; i < 10; i++) {
//         int value = out[i];
//         if (value < 4) {
//             continue;
//         }
//         bool flip = false;
//         if (value % 2 == 1) {
//             flip = true;
//             value -= 1;
//         }
//         int group;
//         if (alias_group_mapping[value] != 0) {
//             group = alias_group_mapping[value];
//         } else {
//             group = next_alias_group;
//             next_alias_group += 2;
//             alias_group_mapping[value] = next_alias_group;
//         }
//         if (flip) {
//             group = group + 1;
//         }
//         out[i] = group;
//     }
//     *can_make_small = next_alias_group < 8;
//     // pack the output
//     uint64_t real_out;
//     int loc = 0;
//     for (int i = 0; i < 10; i++) {
//         real_out |= (out[i] << loc);
//         loc += 4;
//     }
//     return real_out;
// }

// static uint64_t get_implication(uint32_t packed_tr, int* possible_table) {
//     // unpack the transition
//     int tr[10];
//     for (int i = 0; i < 10; i++) {
//         tr[i] = (packed_tr >> (2 * i)) & 3;
//     }
//     // figure out what unknown cells there are in the transition
//     int unknown_count = 0;
//     int unknown_indices[10];
//     for (int i = 0; i < 10; i++) {
//         if (tr[i] == UNKNOWN) {
//             unknown_indices[unknown_count] = i;
//             unknown_count++;
//         }
//     }
//     // special case for when there are no unknown cells
//     if (unknown_count == 0) {
//         CellValue value = trs[0
//             | ((tr[1] == ON ? 1 : 0) << 0)
//             | ((tr[2] == ON ? 1 : 0) << 1)
//             | ((tr[3] == ON ? 1 : 0) << 2)
//             | ((tr[4] == ON ? 1 : 0) << 3)
//             | ((tr[5] == ON ? 1 : 0) << 4)
//             | ((tr[6] == ON ? 1 : 0) << 5)
//             | ((tr[7] == ON ? 1 : 0) << 6)
//             | ((tr[8] == ON ? 1 : 0) << 7)
//             | ((tr[9] == ON ? 1 : 0) << 8)
//         ];
//         // if it matches with the next field of the
//         // implication tr, it's good, otherwise contradiction
//         if (value == tr[0]) {
//             return DO_NOTHING;
//         } else {
//             return CONTRADICTION;
//         }
//     }
//     // build the table of possible satisfactions of the formula
//     // false = contradiction, true = no contradiction
//     int possible_table_len = 0;
//     for (int i = 0; i < 1 << unknown_count; i++) {
//         // pack it into a 10-bit transition
//         int trs_tr = 0;
//         int set_unknowns = 0;
//         int loc = 0;
//         for (int j = 0; j < 10; j++) {
//             CellValue value = tr[j];
//             if (value == UNKNOWN) {
//                 value = ((i >> set_unknowns) & 1);
//                 set_unknowns++;
//             } else {
//                 value = value == ON ? 1 : 0;
//             }
//             trs_tr |= value << loc;
//             loc++;
//         }
//         if (trs[trs_tr >> 1] == (trs_tr & 1)) {
//             possible_table[possible_table_len] = i; 
//             possible_table_len++;
//         }
//     }
//     if (possible_table_len == 0) {
//         return CONTRADICTION;
//     }
//     // we build the output in unpacked form
//     int out[10];
//     memcpy(out, tr, sizeof(out));
//     int next_alias_group = 4;
//     // look for cells that must be a certain value
//     for (int i = 0; i < unknown_count; i++) {
//         int index = unknown_indices[i];
//         int value = (possible_table[0] >> index) & 1;
//         bool found = false;
//         for (int j = 1; j < possible_table_len; j++) {
//             if (possible_table[j] != value) {
//                 found = true;
//                 break;
//             }
//         }
//         if (!found) {
//             return;
//         }
//     }
// }

// static void init_implications(void) {
//     small_implication_table = safe_malloc(1048576UL * sizeof(uint32_t));
//     big_implication_table = safe_malloc(1048576UL * sizeof(uint64_t));
//     bool* possible = safe_malloc(1048576UL * sizeof(bool));
//     for (uint32_t tr = 0; tr < 1048576UL; tr++) {
//         bool can_make_small;
//         uint64_t value = get_implication(tr, possible, &can_make_small);
//         big_implication_table[tr] = value << 2;
//         if (can_make_small) {
//             small_implication_table[tr] = (0
//                 | (((value >> 0) & 3) << 0)
//                 | (((value >> 4) & 3) << 2)
//                 | (((value >> 8) & 3) << 4)
//                 | (((value >> 12) & 3) << 6)
//                 | (((value >> 16) & 3) << 8)
//                 | (((value >> 20) & 3) << 10)
//                 | (((value >> 24) & 3) << 12)
//                 | (((value >> 32) & 3) << 14)
//                 | (((value >> 36) & 3) << 16)
//                 | (((value >> 40) & 3) << 18)
//             ) << 2;
//         } else {
//             small_implication_table[tr] = USE_BIG_IMPLICATION_TABLE;
//         }
//     }
//     safe_free(possible);
// }

// static void destroy_implications(void) {
//     safe_free(implication_table);
//     safe_free(big_implication_table);
// }

// static bool partial_check_small_implication(uint32_t full_value, int pos, Cell* cell) {
//     int value = full_value & (7 << pos);
//     if (value == UNKNOWN) {
//         return true;
//     } else if (is_known(value)) {

//     }
//     if (!internal_clause_set_cell(cell, ((value >> place) & 3), false)) {
//         return false;
//     }
//     return true;
// }

// static bool partial_check_big_implication(uint32_t full_value, int pos, Cell* cell) {
//     int value = full_value & (7 << pos);
//     if (value == UNKNOWN) {
//         return true;
//     } else if (is_known(value)) {

//     }
//     if (!internal_clause_set_cell(cell, ((value >> place) & 3), false)) {
//         return false;
//     }
//     return true;
// }

// // returns false if contradiction, true if no contradiction
// static bool check_implication(CAClause* clause) {
//     uint32_t value = implication_table[clause->tr];
//     DPRINTF4("Implication: tr = %i, value = %"PRIu32"\n", clause->tr, value);
//     if (value == DO_NOTHING) {
//         return true;
//     } else if (value == CONTRADICTION) {
//         DPRINTGRID4();
//         DPRINTF4("Contradiction (implication, value = CONTRADICTION)\n");
//         return false;
//     } else if (value == USE_BIG_IMPLICATION_TABLE) {
//         uint64_t value = big_implication_table[clause->tr];
//         return partial_check_big_implication(value, 2, clause->next)
//             && partial_check_big_implication(value, 6, clause->se)
//             && partial_check_big_implication(value, 10, clause->e)
//             && partial_check_big_implication(value, 14, clause->ne)
//             && partial_check_big_implication(value, 18, clause->s)
//             && partial_check_big_implication(value, 22, clause->center)
//             && partial_check_big_implication(value, 26, clause->n)
//             && partial_check_big_implication(value, 30, clause->sw)
//             && partial_check_big_implication(value, 34, clause->w)
//             && partial_check_big_implication(value, 38, clause->nw)
//         ;
//     } else {
//         return partial_check_small_implication(value, 2, clause->next)
//             && partial_check_small_implication(value, 5, clause->se)
//             && partial_check_small_implication(value, 8, clause->e)
//             && partial_check_small_implication(value, 11, clause->ne)
//             && partial_check_small_implication(value, 14, clause->s)
//             && partial_check_small_implication(value, 17, clause->center)
//             && partial_check_small_implication(value, 20, clause->n)
//             && partial_check_small_implication(value, 23, clause->sw)
//             && partial_check_small_implication(value, 26, clause->w)
//             && partial_check_small_implication(value, 29, clause->nw)
//         ;
//     }
// }


// put all the code that deals with the raw implication values
// here in the same place, to make it easier to maintain

static bool internal_clause_set_cell(Cell* cell, CellValue value, bool is_explicit);
uint64_t* implication_table;


#if IMPLICATION_BACKEND == IMPLICATION_BACKEND_CPU_INDEPENDENT


static inline bool implicstate_set_bit(ImplicState state, int bit, int value) {
    if (value == 0) {
        state[bit >> 6] &= ~((uint64_t)1 << (bit & 63));
    } else {
        state[bit >> 6] |= ((uint64_t)1 << (bit & 63));
    }
}

static inline bool implicstate_is_contradiction(ImplicState state) {
    for (int i = 0; i < 16; i++) {
        if (state[i] != 0) {
            return false;
        }
    }
    return true;
}

static inline bool implicstate_satisfies_mask(ImplicState state, ImplicState mask) {
    ImplicState value;
    memcpy(value, state, sizeof(ImplicState));
    for (int i = 0; i < 16; i++) {
        value[i] &= mask[i];
    }
    for (int i = 0; i < 16; i++) {
        if (value[i] != 0) {
            return true;
        }
    }
    return false;
}

static inline bool implicstate_set_cell(ImplicState state, int pos, int value) {
    int k = 0;
    for (int i = 0; i < 16; i++) {
        for (int j = 0; j < 64; j++) {
            if ((k >> pos) != value) {
                state[i] &= ~((uint64_t)1 << j);
            }
            k++;
        }
    }
}

static inline bool implicstate_alias_cell(ImplicState state, int pos1, int pos2, bool invert) {
    int k = 0;
    for (int i = 0; i < 16; i++) {
        for (int j = 0; j < 64; j++) {
            if (((k >> pos1) != (k >> pos2)) == invert) {
                state[i] &= ~((uint64_t)1 << j);
            }
            k++;
        }
    }
}


#endif


// these return the implic state mask for where the cell
// at position pos in the 10-bit state is on or off
ImplicState IMPLICSTATE_CELL_ON_MASKS[10];
ImplicState IMPLICSTATE_CELL_OFF_MASKS[10];

// IMPLICSTATE_PAIR_SAME_MASKS[pos1][pos2] returns the implic state mask for
// where the cells at position pos1 and pos2 have the same value
// and IMPLICSTATE_PAIR_DIFFERENT_MASKS is the same thing but the cell values must be different
ImplicState IMPLICSTATE_PAIR_SAME_MASKS[10][10];
ImplicState IMPLICSTATE_PAIR_DIFFERENT_MASKS[10][10];

static void init_implicstate(void) {
    for (int pos = 0; pos < 10; pos++) {
        for (int i = 0; i < 1024; i++) {
            if ((i >> pos) & 1) {
                implicstate_set_bit(IMPLICSTATE_CELL_ON_MASKS[pos], i, 1);
            } else {
                implicstate_set_bit(IMPLICSTATE_CELL_OFF_MASKS[pos], i, 1);
            }
        }
    }
    for (int pos1 = 0; pos1 < 10; pos1++) {
        for (int pos2 = 0; pos2 < 10; pos2++) {
            for (int i = 0; i < 1024; i++) {
                if ((i >> pos1) == (i >> pos2)) {
                    implicstate_set_bit(IMPLICSTATE_PAIR_SAME_MASKS[pos1][pos2], i, 1);
                } else {
                    implicstate_set_bit(IMPLICSTATE_PAIR_DIFFERENT_MASKS[pos1][pos2], i, 1);
                }
            }
        }
    }
}

static inline bool check_one_cell_implications(CAClause* clause, int pos, Cell* cell) {
    ImplicState* initial_state = clause->state;
    bool can_be_0 = implicstate_satisfies_mask(clause->state, IMPLICSTATE_CELL_ON_MASKS[pos]);
}

static bool check_implications(CAClause* clause) {
    check_one_cell_implications(clause, 9, clause->nw);
    check_one_cell_implications(clause, 8, clause->w);
    check_one_cell_implications(clause, 7, clause->sw);
    check_one_cell_implications(clause, 6, clause->n);
    check_one_cell_implications(clause, 5, clause->center);
    check_one_cell_implications(clause, 4, clause->s);
    check_one_cell_implications(clause, 3, clause->ne);
    check_one_cell_implications(clause, 2, clause->e);
    check_one_cell_implications(clause, 1, clause->se);
    check_one_cell_implications(clause, 0, clause->next);
}


static void internal_update_clauses(Cell* cell, CellValue value) {
    for (size_t i = 0; i < cell->use_count; i++) {
        CAClauseData* data = &(cell->uses[i]);
        #define add(clause, shift) \
            if ((clause) != NULL) { \
                (clause)->tr = ((clause)->tr & ~(3 << (shift))) | (value << (shift)); \
            }
        add(data->center, 10);
        add(data->prev, 0);
        add(data->nw, 2);
        add(data->w, 4);
        add(data->sw, 6);
        add(data->n, 8);
        add(data->s, 12);
        add(data->ne, 14);
        add(data->e, 16);
        add(data->se, 18);
        #undef add
    }
}

static bool set_cell(Cell* cell, CellValue value) {
    if (cell->alias) {
        if (cell->invert_alias) {
            if (value == OFF) {
                value = ON;
            } else if (value == ON) {
                value = OFF;
            }
        }
        set_cell(cell->alias, value);
    }
    if (cell->value != value) {
        internal_update_clauses(cell, value);
    }
    return true;
}

static bool alias(Cell* cell, Cell* alias_to, bool invert) {
    Cell* original_cell = cell;
    if (alias_to->alias) {
        invert = invert != alias_to->invert_alias;
        alias_to = alias_to->alias;
    }
    cell->alias = alias_to;
    if (cell->value != alias_to->value) {
        internal_update_clauses(cell);
    }
}

static uint32_t compute_implication_tr(CAClause* clause) {
    uint32_t tr = 
            (clause->nw->value << 18)
          | (clause->w->value << 16)
          | (clause->sw->value << 14)
          | (clause->n->value << 12)
          | (clause->center->value << 10)
          | (clause->s->value << 8)
          | (clause->ne->value << 6)
          | (clause->e->value << 4)
          | (clause->se->value << 2)
          | (clause->next->value << 0);
    return tr;
}


// stack of clauses to check in set_cell_and_propagate
CAClause** clause_stack;
// stack pointer for `clause_stack`
CAClause** clause_sp;
// stack pointer for the done entries of clause_stack
CAClause** clause_done_sp;

static void init_clause_stack(void) {
    clause_stack = safe_malloc(16384 * sizeof(CAClause*));
}

static void destroy_clause_stack(void) {
    safe_free(clause_stack);
}

static bool internal_clause_set_cell(Cell* cell, CellValue value, bool is_explicit) {
    // maybe make its own function and manually inline and optimize the set_cell_and_push?
    // could be faster? depends on how clever the compiler is
    if (!set_cell_and_push(cell, value, is_explicit)) {
        return false;
    }
    for (size_t i = 0; i < cell->use_count; i++) {
        CAClauseData* data = &(cell->uses[i]);
        #define add(clause) \
            if ((clause) != NULL) { \
                *clause_sp = (clause); \
                clause_sp++; \
            }
        add(data->center);
        add(data->prev);
        add(data->nw);
        add(data->w);
        add(data->sw);
        add(data->n);
        add(data->s);
        add(data->ne);
        add(data->e);
        add(data->se);
        #undef add
    }
    return true;
}

// set a cell in the search state, propagating checks
// returns false if contradiction, true if no contradiction
static bool set_cell_and_propagate(Cell* cell, CellValue value, bool is_explicit) {
    DPRINTF3("Setting cell and propagating: var_number = %zu\n", cell->var_number);
    clause_sp = &(clause_stack[0]);
    clause_done_sp = &(clause_stack[0]);
    if (!internal_clause_set_cell(cell, value, is_explicit)) {
        return false;
    }
    DPRINTF3("Propagating: clause_sp = %ti, clause_done_sp = %ti\n", clause_sp - &(clause_stack[0]), clause_done_sp - &(clause_stack[0]));
    while (clause_done_sp < clause_sp) {
        if (!check_implications(*clause_done_sp)) {
            return false;
        }
        clause_done_sp++;
        DPRINTF3("Propagating: clause_sp = %ti, clause_done_sp = %ti\n", clause_sp - &(clause_stack[0]), clause_done_sp - &(clause_stack[0]));
    }
    return true;
}
