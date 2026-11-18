#pragma once

#include <stddef.h>
#include <type_traits>
#include <concepts>
#include <span>

#include "vector.cpp"
#include "transition.cpp"
#include "tiling.cpp"

namespace lifeweb {


template<typename T>
concept RuleFamily = requires {

    { T::name } -> std::convertible_to<const char * const>;
    typename std::integral_constant<const char * const, T::name>;

    typename T::Tiling;
    requires AbstractTiling<typename T::Tiling>;

    typename T::Cell;
    requires std::integral<typename T::Cell>;

    typename T::Transition;
    requires AbstractTransition<typename T::Transition, typename T::Cell>;
    { T::transitions } -> std::convertible_to<std::span<typename T::Transition>>;

    // copied over from the tiling

    { T::dim } -> std::convertible_to<size_t>;
    typename std::integral_constant<size_t, T::dim>;
    requires (T::Tiling::dim == T::dim);

    requires std::same_as<typename T::template Vector<int>, Vector<int, T::dim>>;
    typename T::Coord;
    requires std::same_as<typename T::Coord, Coord<T::dim>>;
    typename T::Size;
    requires std::same_as<typename T::Size, Size<T::dim>>;

};


}
