
#pragma once

#include <stddef.h>
#include <concepts>


namespace lifeweb {


template <size_t len>
struct _internal_VectorStorage {
public:
    ptrdiff_t data[len];
    template<typename... Args>
        requires (sizeof...(Args) == len) && (std::convertible_to<Args, ptrdiff_t> && ...)
    constexpr inline _internal_VectorStorage(Args... args) : data(static_cast<ptrdiff_t>(args)...) {
        // do nothing
    }
};

template <>
struct _internal_VectorStorage<2> {
public:
    union {
        ptrdiff_t data[2];
        struct {
            ptrdiff_t x;
            ptrdiff_t y;
        };
    };
};

template <typename T, size_t Len>
class Vector : public _internal_VectorStorage<Len> {

public:

    static constexpr size_t len = Len;

    using _internal_VectorStorage<Len>::data;

    template <typename... Args>
        requires (sizeof...(Args) == len) && (std::convertible_to<Args, ptrdiff_t> && ...)
    constexpr inline Vector(Args... args) : _internal_VectorStorage<Len>(static_cast<ptrdiff_t>(args)...) {
        // do nothing
    }

    constexpr inline Vector() {
        for (size_t i = 0; i < len; i++) {
            data[i] = 0;
        }
    }

    constexpr inline ptrdiff_t operator[](size_t i) const {
        return data[i];
    }

    constexpr inline ptrdiff_t& operator[](size_t i) {
        return data[i];
    }

    constexpr inline Vector<T, Len> operator+(Vector<T, Len> other) const {
        Vector<T, Len> out;
        for (size_t i = 0; i < len; i++) {
            out[i] = (*this)[i] + other[i];
        }
        return out;
    }

    constexpr inline Vector<T, Len> operator-(Vector<T, Len> other) const {
        Vector<T, Len> out;
        for (size_t i = 0; i < len; i++) {
            out[i] = (*this)[i] - other[i];
        }
        return out;
    }

    constexpr inline Vector<T, Len> abs() const {
        Vector<T, Len> out;
        for (size_t i = 0; i < len; i++) {
            out[i] = -(*this)[i];
        }
        return out;
    }

};


template<size_t Len>
using Coord = Vector<ptrdiff_t, Len>;

template<size_t Len>
using Size = Vector<size_t, Len>;


Coord<2> x;
Coord<2> y;

auto a = x + y;


}
