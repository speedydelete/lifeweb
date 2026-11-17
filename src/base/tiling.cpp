#pragma once

#include <stddef.h>
#include <type_traits>
#include <concepts>
#include <span>

#include "vector.cpp"

namespace lifeweb {


template<typename T>
concept AbstractSymmetry = requires(T x, const T y) {

    { x.to_string() } -> std::same_as<char*>;

    { x | y } -> std::same_as<T>;

    { x & y } -> std::same_as<T>;

};


template<typename T>
concept AbstractTiling = requires {

    { T::name } -> std::convertible_to<const char * const>;
    typename std::integral_constant<const char * const, T::name>;

    { T::dim } -> std::convertible_to<size_t>;
    typename std::integral_constant<size_t, T::dim>;

    requires std::same_as<typename T::template Vector<int>, Vector<int, T::dim>>;
    typename T::Coord;
    requires std::same_as<typename T::Coord, Coord<T::dim>>;
    typename T::Size;
    requires std::same_as<typename T::Size, Size<T::dim>>;

    typename T::StaticSymmetry;
    requires AbstractSymmetry<typename T::StaticSymmetry>;
    { T::static_symmetries } -> std::convertible_to<std::span<const typename T::StaticSymmetry>>;
    typename std::bool_constant<(std::span<typename T::StaticSymmetry>(T::static_symmetries), true)>;

    typename T::KineticSymmetry;
    requires AbstractSymmetry<typename T::KineticSymmetry>;
    { T::kinetic_symmetries } -> std::convertible_to<std::span<const typename T::KineticSymmetry>>;
    typename std::bool_constant<(std::span<typename T::KineticSymmetry>(T::kinetic_symmetries), true)>;

};


}