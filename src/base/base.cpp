
#pragma once

#include <stddef.h>
#include <errno.h>
#include <string.h>
#include <stdlib.h>
#include <stdio.h>


namespace lifeweb {


// core error macro

#define unexpected_error(format, ...) \
    do { \
        fprintf(stderr, "Unexpected error: " format "\n    at %s:%i\nPlease report this error.\n" __VA_OPT__(,) __VA_ARGS__ , __FILE__ , __LINE__); \
        exit(EXIT_FAILURE); \
    } while (0)


// better allocation functions

template <typename T>
T* safe_malloc() {
    void* out = malloc(sizeof(T));
    if (out == nullptr) {
        unexpected_error("In malloc(): %s", strerror(errno));
    }
    return (T*)out;
}

template <typename T>
T* safe_malloc(size_t len) {
    void* out = malloc(sizeof(T) * len);
    if (out == nullptr) {
        unexpected_error("In malloc(): %s", strerror(errno));
    }
    return (T*)out;
}

template <typename T>
T* safe_realloc(T* ptr, size_t len) {
    void* out = realloc(ptr, len * sizeof(T));
    if (out == nullptr) {
        unexpected_error("In realloc(): %s", strerror(errno));
    }
    return (T*)out;
}

void safe_free(void* ptr) {
    free(ptr);
}


}
