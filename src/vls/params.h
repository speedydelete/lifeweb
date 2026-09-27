
// defines configuration

#pragma once

// stdbool.h is for compatibility with old compilers
#include <stdbool.h>
#include <stddef.h>
#include <inttypes.h>


// basic settings

// whether to do multi-rule searching
#define MULTI_RULE false


// speed settings

// prevents computing the implication for a cell twice
#define KEEP_LAST_CHECKED_TIME true
