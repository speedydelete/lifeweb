
# VLS Input File Format

A VLS input file specifies a problem for the search program to solve.

## Basics

An input file consists of a list of statements.

Any two lines can be joined, separated by a semicolon.

All cells are initialized to unknown by default.

This prefix is applied on every file:

```
state 0 = off
state 1 = on
state 2 = unknown
state 3 = all: period 1
state 4 = off
```

## Statements

### Pattern

```
pattern [wxh] <number> gens
```

Creates a new pattern with the given generations and optionally the given width and height (default 0x0).

Statements that affect the pattern must be used after a pattern is defined.

If multiple patterns are provided, they are searched together with a shared variable namespace.

### State Set

```
<state> = <full state specifier>
<start state> to <end state> = <full state specifier>
```

Defines or changes the meaning of a state or range of states. States are used by RLE statements to add things to the problem.

A full state specifier consists of a comma-separated list of mappings of ranges to state specifiers. For example: `0: off, 1-2: unknown, $10-20: unsearchable, $13: unsettable var`. Ranges are inclusive on both ends.

The character `$` before a range indicates that it is absolute, when it is used it will always be applied to those generations. If `$` isn't present, it is a relative one, this means that the ranges are added to the current generation to determine the real generation when it is used.

If no range is specified it is assumed to be `0`.

`all` can also be used to automatically apply it to all generations.

A state specifier consists of one of these values:
* `nop` - do absolutely nothing
* `off` - the cell's state is forced to be off
* `on` - the cell's state is forced to be on
* `unknown` - the cell's state is indeterminate
* `var` - the cell is a variable that is shared across every instance of the state
* `period <value>` - the cell is a periodic cell, new variables are automatically created every time it is used to force it to be of the given period
* `unsearchable` - it will not try to explicitly set the cell, but it can still "inherit" a value from nearby cells
* `unsettable` - the cell cannot be set in any way
* `unsearchable var` - the combination
* `unsettable var` - the combination
* `unsearchable period <value>` - the combination
* `unsettable period <value>` - the combination

### RLE

```
gens <gen-or-range>:
RLE
```

```
all gens [offset <x> <y>]:
RLE
```

Applies a RLE to the current pattern on the given generation(s) (values of cell states may however cause it to exceed those bounds), using the above defined meanings of states to do it.

The RLE must have a header. This header is followed, if larger x or y values are provided than the size of the RLE body then it will fill the extra space with the current meaning of state 0.

If the offset is provided, it will offset the RLE by that before applying it.

### Wrap

```
wrap <dx> <dy>
```

Sets the current pattern to follow a time wrap with the given displacement. This can be used to search for periodic patterns, for instance `wrap 0 0` would search for oscillators and `

### Expand

```
expand (<start | end | up | down | left | right> <number>)+
```

Expand the current pattern by the given amount (filling the new areas with unknown cells). Multiple movements can be provided.

### Delete

```
delete <state>
```

Undefines a state, making it error when used, just like a state that was never defined at all.
