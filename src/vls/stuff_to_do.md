
# Stuff to do

Speedups:
* Aliasing during preprocessing
* Bulk allocate `state.vars`
* Add CDCL maybe
* Advanced clause aliasing during preprocessing
* See if keeping last checked times is faster
* Rearrange clauses to keep implication transitions closer to 0
* Optimize progress tracker? Maybe via cursed stack stuff?
* Add a custom `set_cell_and_propagate` that also does aliasing to `pre_check_cell_implications`

Features:
* Input file variable groups
* Input file Turing-completeness

Bug fixes:

Other:
* Better document input files
