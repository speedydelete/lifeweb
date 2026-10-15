
# VLS Input File Format

A VLS input file specifies a problem for the search program to solve.

## Basics

An input file consists of a list of patterns. Each pattern is preceded by a pattern declaration and consists of a list of statements.

Any two lines can be joined, separated by a semicolon.

All cells are initialized to unknown by default.

This prefix is applied on every file:

```
0 = off
1 = on
2 = unknown
3 = dont_care
4 = all: p1
5 = off
```

## Statements

### Pattern

```
pattern [wxh] <number> gens
```

Creates a new pattern with the given generations and optionally the given width and height (default 0x0).

### State Set

```
<number> = <state specifier>
```

Defines or changes the meaning of a state. States are used by RLE statements to add things to the problem.

A state specifier consists of a comma-separated list of mappings of ranges to state specifiers. For example: `0: off, 1-2: unknown, $10-20: unchecked unknown`. Ranges are inclusive on both ends.

The character `$` before a range indicates that it is absolute, when it is used it will always be applied to those generations. If `$` isn't present, it is a relative one, this means that the ranges are added to the current generation to determine the real generation when it is used.

If no range is specified it is assumed to be `0`.

`all` can also be used to automatically apply it to all generations.

A bounded state specifier consists of an arbitrary number of these words, they are applied right-to-left:
* `nop` - do absolutely nothing
* `off` - the cell's state is forced to be off
* `on` - the cell's state is forced to be on
* `unknown` - the cell's state is indeterminate
* `dont_care` - the cell's state is indeterminate and not set by the search program, it does not have to follow the transition rules and can do literally anything
* `unchecked` - it will not try to explicitly set the cell, but it can still "inherit" a value from nearby cells
* `unset` - the cell cannot be set in any way
* `var` - the cell is a variable that is shared across every instance of the state
* `p<period>` - the cell is a periodic cell, new variables are automatically created every time it is used to force it to be of the given period

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
