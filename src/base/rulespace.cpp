#pragma once

#include <stddef.h>
#include <stdint.h>
#include <vector>

#include "rule_family.cpp"

namespace lifeweb {


// it's like CNF
// positive values are groups
// negative value are the NOT of groups
// 1 means it's set to ON
// -1 means it's set to OFF
// 0 means it's not set at all
using Bind = int64_t;
[[maybe_unused]] constexpr Bind BIND_UNSET = 0;
[[maybe_unused]] constexpr Bind BIND_OFF = -1;
[[maybe_unused]] constexpr Bind BIND_ON = 1;


template<RuleFamily Family>
class Rulespace {

    const char* name = nullptr;

    using RuleFamily = Family;
    using Tiling = Family::Tiling;

    static constexpr size_t dim = Family::dim;
    template<typename T>
    using Vector = Family::template Vector<T>;
    using Coord = Family::Coord;
    using Size = Family::Size;

    std::vector<Coord> nh;

    // CAN BE A NULL POINTER
    Rulespace* parent;

};


}
