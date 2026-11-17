
#pragma once

#include <stddef.h>
#include <stdint.h>
#include <concepts>
#include <vector>

#include "vector.cpp"
#include "transition.cpp"

namespace lifeweb {


// it's like CNF
// positive values are groups
// negative value are the NOT of groups
// 1 means it's set to ON
// -1 means it's set to OFF
// 0 means it's not set at all
using Bind = int64_t;
constexpr Bind BIND_UNSET = 0;
constexpr Bind BIND_OFF = -1;
constexpr Bind BIND_ON = 1;


// OLD

// template<size_t Dim, typename Cell, typename Transition>
//     requires std::unsigned_integral<Cell>
//     && AbstractTransition<Transition, Cell>
// class Rulespace {

// public:

//     static constexpr size_t dim = Dim;

//     template<typename T>
//     using Vector = Vector<T, Dim>;
//     using Coord = Coord<Dim>;
//     using Size = Size<Dim>;

//     const char* name = nullptr;

//     Cell states;
//     size_t range;
//     std::vector<Coord> nh;
//     std::vector<Transition> transitions;

//     std::vector<Bind> binds;

//     Rulespace* root;
//     Rulespace* parent;

//     Rulespace(std::vector<Transition> transitions) :
//         transitions(transitions),
//         binds(transitions.size()) {
//         root = this;
//         current = this; 
//     }

//     Rulespace(Rulespace* parent) :
//         root(parent->root),
//         parent(parent) {}

// };


}
