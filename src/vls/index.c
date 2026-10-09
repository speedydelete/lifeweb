
// defines main searching


#include <stdlib.h>
#undef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 199309L

#include <inttypes.h>
#include <sys/types.h>
#include <stdio.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "output.c"
#include "preprocess.c"
#include "search.c"
#ifdef CUSTOM
    #include CUSTOM
#endif


static inline void load_state_from_file(char* path) {
    FILE* file = fopen(path, "r");
    if (file == NULL) {
        fprintf(stderr, "Error while reading file '%s'\n", path);
        exit(EXIT_FAILURE);
    }
    InitFromState data;
    // FSCANF SPAM HERE
    fclose(file);
    init_state(&data);
}


#ifdef FOR_PROFILE
#include <signal.h>
static void handle_sigterm(int signum) {
    (void)signum;
    extern int __llvm_profile_write_file(void);
    __llvm_profile_write_file(); 
    exit(EXIT_SUCCESS);
}
#endif

int main(int argc, char** argv) {
    if (argc != 2) {
        fprintf(stderr, "Expected exactly 1 command line argument");
        exit(EXIT_FAILURE);
    }
    #ifdef IMPLICATION_CHECK_TR
        init_implications();
        printf("%i -> %i\n", IMPLICATION_CHECK_TR, implication_table[IMPLICATION_CHECK_TR]);
        destroy_implications();
        exit(EXIT_SUCCESS);
    #endif
    calibrate_time();
    #ifdef FOR_PROFILE
        signal(SIGTERM, handle_sigterm);
    #endif
    current_stack = create_stack();
    init_implications();
    init_solutions();
    load_state_from_file(argv[0]);
    preprocess();
    #if CUSTOM_INIT
        custom_init();
    #endif
    run_search();
    #if CUSTOM_DESTROY
        custom_destroy();
    #endif
    destroy_solutions();
    destroy_stack(current_stack);
    destroy_state();
    destroy_implications();
    return 0;
}
