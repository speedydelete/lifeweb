
# lifeweb

This is a library for simulating [cellular automata](https://conwaylife.com/wiki/Cellular_automaton), including [Conway's Game of Life](https://conwaylife.com/wiki/Conway's_Game_of_Life).

The main interface is Pattern. Pattern is implemented by 2 abstract classes, DataPattern, which stores its data in a Uint8Array, and CoordPattern, which stores its data in a Map of coordinates to states.
