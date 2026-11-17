
#pragma once

#include <stddef.h>
#include <stdint.h>
#include <concepts>
#include <array>

namespace lifeweb {


template<typename T, typename Cell>
concept AbstractTransition = 
    std::unsigned_integral<Cell>
    && std::constructible_from<T, size_t, const Cell*, Cell>
    && std::equality_comparable<T>
    && requires(const T t) {
        { t.next() } -> std::same_as<Cell>;
    };


template<typename Cell, size_t States, size_t NHLen>
    requires std::unsigned_integral<Cell>
class MAPTransition {

public:

    static constexpr size_t states = States;
    static constexpr size_t nh_len = NHLen;
    static constexpr size_t len = NHLen + 1;

private:

    class ValueProxy {
    public:
        uint64_t& value;
        uint64_t power;
        ValueProxy(uint64_t& value, uint64_t power) :
            value(value),
            power(power) {}
        ValueProxy& operator=(Cell cell) {
            value -= ((value / power) % states) * power;
            value += cell * power;
            return *this;
        }
        operator Cell() const {
            return (value / power) % states;
        }
    };

    static constexpr auto compute_powers() {
        std::array<uint64_t, len> out;
        out[0] = 1;
        for (size_t i = 1; i < len; ++i) {
            out[i] = out[i - 1] * states;
        }
        return out;
    }

public:

    static constexpr uint64_t POWERS[len] = compute_powers();

    uint64_t value;

    constexpr MAPTransition(size_t, const Cell* nh, Cell next) {
        value = 0;
        for (size_t i = 0; i < nh_len; ++i) {
            value = (value * states) + nh[i];
        }
        value = (value * states) + next;
    }

    constexpr inline MAPTransition() {
        value = 0;
    }

    constexpr inline bool operator==(const MAPTransition& other) const = default;

    constexpr inline Cell next() const {
        return value % states;
    }

    constexpr inline Cell operator[](size_t i) const {
        return (value / POWERS[i]) % states;
    }

    constexpr inline ValueProxy operator[](size_t i) {
        return ValueProxy(value, POWERS[i]);
    }

};

static_assert(AbstractTransition<MAPTransition<uint8_t, 2, 9>, uint8_t>);


}
