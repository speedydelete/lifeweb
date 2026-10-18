
# Stuff to do

Speedups:
* Aliasing
* Aliasing during preprocessing
* `set_cells` mask in `struct CAClause`
* Make `state.ca_clauses` of type `CAClause*` and bulk allocate it
* Bulk allocate `state.vars`
* Add CDCL

Features:
* Input file variable groups
* Input file Turing-completeness

Bug fixes:
* Fix `noclause` in search file creation and loading

Other:
* Better document input files
