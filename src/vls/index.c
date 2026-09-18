
// defines main searching

#undef _POSIX_C_SOURCE
#define _POSIX_C_SOURCE 199309L

#include <inttypes.h>
#include <sys/types.h>
#include <unistd.h>

#include "params2.h"
#include "base.c"
#include "output.c"
#include "preprocess.c"
#include "search.c"
#ifdef CUSTOM
#include CUSTOM
#endif


#ifdef FOR_PROFILE
#include <signal.h>
static void handle_sigterm(int signum) {
    (void)signum;
    extern int __llvm_profile_write_file(void);
    __llvm_profile_write_file(); 
    exit(0);
}
#endif

int main(void) {
    #ifdef IMPLICATION_CHECK_TR
    generate_implications();
    printf("%i -> %i\n", IMPLICATION_CHECK_TR, implications[IMPLICATION_CHECK_TR]);
    exit(0);
    #elifdef OT_IMPLICATION_CHECK_TR
    generate_implications();
    printf("%i -> %i\n", OT_IMPLICATION_CHECK_TR, ot_implications[OT_IMPLICATION_CHECK_TR]);
    exit(0);
    #endif
    calibrate_time();
    #ifdef FOR_PROFILE
    signal(SIGTERM, handle_sigterm);
    #endif
    current_stack = create_stack();
    generate_implications();
    init_state();
    #if MULTI_RULE
    init_tr_to_bound_tr();
    #endif
    #if SHOW_SOLUTIONS
    init_solutions();
    #endif
    preprocess();
    #if CUSTOM_INIT
    custom_init();
    #endif
    run_search();
    #if SHOW_SOLUTIONS
    destroy_solutions();
    #endif
    destroy_stack(current_stack);
    destroy_state();
    return 0;
}
