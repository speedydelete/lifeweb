
// defines configuration

#pragma once

#undef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 200809L

// stdbool.h is for compatibility with old compilers
#include <stdbool.h>
#include <stddef.h>
#include <inttypes.h>


// basic settings

// debug level
#define DEBUG 4

// custom file to load stuff from
// #define CUSTOM
