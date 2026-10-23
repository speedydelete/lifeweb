
// defines configuration

#pragma once

#undef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200809L

// these are for compatibility with old compilers
#include <stdbool.h>
#include <stdalign.h>

#include <stddef.h>
#include <inttypes.h>


// basic settings

// maximum implication function length
// should be greater than or equal to 10
#define MAX_IMPLIC_FUNC_LENGTH 10

// debug level
#define DEBUG_LEVEL 6
