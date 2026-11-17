
#pragma once

#include <stddef.h>
#include <concepts>

namespace lifeweb {


template<typename T, size_t Dim>
struct _internal_VectorStorage {
    T data[Dim];
    template<typename... Args>
        requires (sizeof...(Args) == Dim) && (std::convertible_to<Args, T> && ...)
    constexpr inline _internal_VectorStorage(Args... args) : 
        data(static_cast<T>(args)...) {}
};

// yes i know it's undefined behavior
// but since arrays can't have padding it's almost always fine
// i hope

template<typename T>
struct _internal_VectorStorage<T, 2> {
    union {
        T data[2];
        struct [[gnu::packed]] {
            T x;
            T y;
        };
    };
};

template<typename T>
struct _internal_VectorStorage<T, 3> {
    union {
        T data[2];
        struct [[gnu::packed]] {
            T x;
            T y;
            T z;
        };
    };
};

template<typename T, size_t Dim>
class Vector : public _internal_VectorStorage<T, Dim> {

public:

    static constexpr size_t dim = Dim;
    static constexpr size_t len = Dim;

    using _internal_VectorStorage<T, Dim>::data;

    template<typename... Args>
        requires (sizeof...(Args) == dim) && (std::convertible_to<Args, T> && ...)
    constexpr inline Vector(Args... args) :
        _internal_VectorStorage<T, Dim>(static_cast<T>(args)...) {}

    constexpr inline Vector() requires std::integral<T> {
        for (size_t i = 0; i < dim; ++i) {
            data[i] = 0;
        }
    }

    constexpr inline T operator[](size_t i) const {
        return data[i];
    }

    constexpr inline T& operator[](size_t i) {
        return data[i];
    }

    constexpr inline bool operator==(const Vector<T, Dim>& other) const requires std::equality_comparable<T> = default;

    constexpr inline Vector<T, Dim> operator+(Vector<T, Dim> other) const requires std::integral<T> {
        Vector<T, Dim> out;
        for (size_t i = 0; i < dim; ++i) {
            out[i] = (*this)[i] + other[i];
        }
        return out;
    }

    constexpr inline Vector<T, Dim> operator-(Vector<T, Dim> other) const requires std::integral<T> {
        Vector<T, Dim> out;
        for (size_t i = 0; i < dim; ++i) {
            out[i] = (*this)[i] - other[i];
        }
        return out;
    }

    constexpr inline Vector<T, Dim> operator+() const requires std::integral<T> {
        return Vector(*this);
    }

    constexpr inline Vector<T, Dim> operator-() const requires std::integral<T> {
        Vector<T, Dim> out;
        for (size_t i = 0; i < dim; ++i) {
            out[i] = -(*this)[i];
        }
        return out;
    }

    constexpr inline Vector<T, Dim> abs() const requires std::integral<T> {
        Vector<T, Dim> out;
        for (size_t i = 0; i < dim; ++i) {
            out[i] = -(*this)[i];
        }
        return out;
    }

};


template<size_t Dim>
using Coord = Vector<ptrdiff_t, Dim>;
using Coord1 = Coord<1>;
using Coord2 = Coord<2>;
using Coord3 = Coord<3>;

template<size_t Dim>
using Size = Vector<size_t, Dim>;
using Size1 = Size<1>;
using Size2 = Size<2>;
using Size3 = Size<3>;


template<size_t Dim>
using Transformation = Coord<Dim>(*)(Coord<Dim> value);


}
