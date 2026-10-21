
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
* Breadth-first search
* Inprocessing after some depth

Features:
* Input file variable groups
* Input file Turing-completeness
* Symmetry application in the file for whole or part of the grid
* Setting more config options in the input file
* Variables, if statements, loops, etc (there are already expressions but they're pretty useless)
* Super advanced search order specification in the input file
* "additional constraints"
* Ability to set "additional constraints" in the input file

Bug fixes:

Other:
* Better document input files
