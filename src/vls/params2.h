
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
// #define DEBUG 6

// custom file to load stuff from
// #define CUSTOM


// speed settings

// whether to enable certain speed-reducing sanity checks
#define SLOWER_SANITY_CHECKS true
