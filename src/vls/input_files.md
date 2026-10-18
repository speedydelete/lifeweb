
# VLS Input File Format

A VLS input file specifies a problem for the search program to solve.

## Basics

An input file consists of a list of statements.

Any two lines can be joined, separated by a semicolon.

All cells are initialized to unknown by default.

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
<state> = <full state specifier expression>
<start state> to <end state> = <full state specifier expression>
```

Defines or changes the meaning of a state or range of states. States are used by RLE statements to add things to the problem.

See the [full state specifier section](#full-state-specifiers) for details and examples.

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

## Expressions

An expression is allowed in a state set statement and in the future other places as well. They consist of literals and operators being applied to them. Parentheses can be used for grouping.

### Literals

#### State specifier

Creates a new state specifier.

```
off - The cell's value is off
```

### Operators

#### Unary operators

```

```

### Full state specifiers

```
<full state specifier range>: <state specifier expression>
<full state specifier>, <full state specifier>
```

A full state specifier consists of a comma-separated list of mappings of ranges to state specifiers. For example: `all: on, 0: off, 1 to 2: unknown, $ 10 to 20: unsearchable unknown, $13: noclause var`. Ranges are inclusive on both ends. This syntactic construct has lower precedence than all operators.

The character `$` before a range indicates that it is absolute, when it is used it will always be applied to those generations. If `$` isn't present, it is a relative one, this means that the ranges are added to the current generation to determine the real generation when it is used.

If no range is specified it is assumed to be `0`.

`all` can also be used to automatically apply it to all generations.

Here are many useful state specifiers:
* `off` - the cell's value must be off
* `on` - the cell's value must be on
* `unknown` - the cell's value can be anything and is searched for
* `var` - all uses of the cell are bound together
* `period <period>` - creates new variables for every use and does that period
* `unsearchable <specifier>` - specifies that that cell is not to be searched for
* `noclause <specifier` - that specifier does not have to follow the evolution rules
