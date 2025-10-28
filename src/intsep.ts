
/*

Implements xp2's algorithm for object seperation for INT rules:
1. Give each group of kingwise-connected cells a number
2. Run it for some number of generations, combining objects that birth cells
3. After each generation, resolve knots
4. After a sufficient number of generations, the objects should be seperated

A knot is a dead cell surrounded by 2+ groups of live cells that won't come alive in the next generation
Knots cause the merger of objects if a birth would happen if the groups were seperated. If it is ambiguous, the current behavior is to just merge them.


Full analysis of knots for INT rules:

A2c: merge if B1c
A2i: merge if B1e
A2k: merge if B1c or B1e
A2n: merge if B1c
A3c: complicated
A3k: merge if B1c or B2e
A3n: merge if B1c or B2a
A3q: merge if B1c or B2a
A3r: merge if B1e or B2a
A3y: complicated
A4c: complicated
A4i: merge if B2a
A4k: merge if B1c or B3j
A4n: merge if B1c or B3i
A4q: merge if B1c or B3a
A4t: merge if B1e or B3i
A4y: complicated
A4z: merge if B2a
A5e: complicated
A5j: merge if B1c or B4a
A5k: merge if B1c or B4w
A5r: merge if B2a or B3i
A6e: merge if B1c or B5a
A6i: merge if B3i

A3c:

A

B C

B1c: merge
!B1c, !B2c, !B2n: nothing
!B1c, !B2c, B2n: merge all if A = C
!B1c, B2c, !B2n: merge all if A = B or B = C
!B1c, B2c, B2n: merge all if A = B, B = C, or A = C

A3y:

A
  C
B

B1e, !B2k: ambiguous
B1e, B2k: merge all
!B1e, B1c, !B2c: merge AB
!B1e, B1c, B2c: merge all
!B1e, !B1c, !B2k, !B2c: nothing
!B1e, !B1c, !B2k, B2c: mege all if A = B
!B1e, !B1c, B2k, !B2c: merge all if A = C || B = C
!B1e, !B1c, B2k, B2c: merge all if A = B || B = C || A = C

A4c:

A B

C D

B1c, !B2c: ambiguous
B1c, B2c, !B2n: merge AD and BC
B1c, B2c, B2n: merge all
!B1c, !B3c, !B2c, !B2n: nothing
!B1c, !B3c, B2c || B2n: ambiguous
!B1c, B3c, !B2c, !B2n: merge all if (A = B && (B = C || B = D)) || (C = D && (A = C || B = C))
!B1c, B3c, !B2c, B2n: merge all if A = D || B = C
!B1c, B3c, B2c, !B2n: merge all if A = B || A = C || B = D || C = D
!B1c, B3c, B2c, B2n: merge all if any of them are the same

A4y:

AA

B C

B1c, !B2a, !B2c: merge all if !(A != B && B = C)
B1c, B2a || B2c: merge all
!B1c, B2a, !B3q, !B3n: ambiguous
!B1c, B2a, !B3q, B3n: merge AB
!B1c, B2a, B3q, !B3n: merge AC
!B1c, B2a, B3q, B3n: merge all
!B1c, !B2a, !B2c, !B3n, !B3q: nothing
!B1c, !B2a, !B2c, !B3n, B3q: merge all if A = C
!B1c, !B2a, !B2c, B3n, !B3q: merge all if A = B
!B1c, !B2a, !B2c, B3n, B3q: merge all
!B1c, !B2a, B2c, !B3n, !B3q: merge if B = C
!B1c, !B2a, B2c, !B3n, B3q: merge all if A = B || B = C
!B1c, !B2a, B2c, B3n, !B3q: merge all if A = C || B = C
!B1c, !B2a, B2c, B3n, B3q: merge all if A = B || A = C || B = C

A5e:

AAA

B C

B1c, !B2c, !B3i: merge BC
B1c, B2c || B3i: merge all
!B1c, B3i, !B4n: ambiguous
!B1c, B3i, B4n: merge all
!B1c, !B3i, !B2c, !B4n: nothing
!B1c, !B3i, !B2c, B4n: merge all if A = B
!B1c, !B3i, B2c, !B4n: merge all if B = C
!B1c, !B3i, B2c, B4n: merge all if A = B || B = C


For optimization, we don't implement B1c.

Full analysis for !B1c rules:

A2i: merge if B1e
A2k: merge if B1e
A3c: complicated
A3k: merge if B2e
A3n: merge if B2a
A3q: merge if B2a
A3r: merge if B2a
A3y: complicated
A4c: complicated
A4i: merge if B2a
A4k: merge if B3j
A4n: merge if B3i
A4q: merge if B3a
A4t: merge if B3i
A4y: complicated
A4z: merge if B2a
A5e: complicated
A5j: merge if B4a
A5k: merge if B4w
A5r: merge if B2a or B3i
A6e: merge if B5a
A6i: merge if B3i

A3c:

A

B C

!B2c, !B2n: nothing
!B2c, B2n: merge all if A = C
B2c, !B2n: merge all if A = B or B = C
B2c, B2n: merge all if A = B, B = C, or A = C

A3y:

A
  C
B

B1e, !B2k: ambiguous
B1e, B2k: merge all
!B1e, !B2k, !B2c: nothing
!B1e, !B2k, B2c: mege all if A = B
!B1e, B2k, !B2c: merge all if A = C || B = C
!B1e, B2k, B2c: merge all if A = B || B = C || A = C

A4c:

A B

C D

!B3c, !B2c, !B2n: nothing
!B3c, B2c || B2n: ambiguous
B3c, !B2c, !B2n: merge all if (A = B && (B = C || B = D)) || (C = D && (A = C || B = C))
B3c, !B2c, B2n: merge all if A = D || B = C
B3c, B2c, !B2n: merge all if A = B || A = C || B = D || C = D
B3c, B2c, B2n: merge all if any of them are the same

A4y:

AA

B C

B2a, !B3q, !B3n: ambiguous
B2a, !B3q, B3n: merge AB
B2a, B3q, !B3n: merge AC
B2a, B3q, B3n: merge all
!B2a, !B2c, !B3n, !B3q: nothing
!B2a, !B2c, !B3n, B3q: merge all if A = C
!B2a, !B2c, B3n, !B3q: merge all if A = B
!B2a, !B2c, B3n, B3q: merge all
!B2a, B2c, !B3n, !B3q: merge if B = C
!B2a, B2c, !B3n, B3q: merge all if A = B || B = C
!B2a, B2c, B3n, !B3q: merge all if A = C || B = C
!B2a, B2c, B3n, B3q: merge all if A = B || A = C || B = C

A5e:

AAA

B C

B3i, !B4n: ambiguous
B3i, B4n: merge all
!B3i, !B2c, !B4n: nothing
!B3i, !B2c, B4n: merge all if A = B
!B3i, B2c, !B4n: merge all if B = C
!B3i, B2c, B4n: merge all if A = B || B = C

*/


const A3C = 0x10;
const A3C_B2N = 1;
const A3C_B2C = 2;

const A3Y = 0x20;
const A3Y_B2C = 1;
const A3Y_B2K = 2;
const A3Y_MERGE_ALL = 0x2F;

const A4C = 0x30;
const A4C_B2N = 1;
const A4C_B2C = 2;

const A4Y = 0x40;
const A4Y_B2A = 1;
const A4Y_B3Q = 2;
const A4Y_B3N = 4;
const A4Y_B2C = 8;
const A4Y_MERGE_ALL = 0x4F;

const A5E = 0x50;
const A5E_B2C = 1;
const A5E_B2N = 2;


export function getKnots(trs: Uint8Array): Uint8Array {
    let out = new Uint8Array(512);
    let B1e = trs[0b010000000];
    let B2a = trs[0b110000000];
    let B2c = trs[0b101000000];
    let B2e = trs[0b010100000];
    let B2i = trs[0b000101000];
    let B2k = trs[0b001100000];
    let B2n = trs[0b100000001];
    let B3a = trs[0b110100000];
    let B3c = trs[0b101000100];
    let B3i = trs[0b111000000];
    let B3j = trs[0b011100000];
    let B3k = trs[0b010100001];
    let B3n = trs[0b110000100];
    let B3q = trs[0b110000001];
    let B3r = trs[0b110000010];
    let B3y = trs[0b100001100];
    let B4a = trs[0b111100000];
    let B4c = trs[0b101000101];
    let B4i = trs[0b110000110];
    let B4k = trs[0b010100101];
    let B4n = trs[0b111000001];
    let B4q = trs[0b110100001];
    let B4r = trs[0b000101110];
    let B4t = trs[0b111000010];
    let B4w = trs[0b110001001];
    let B4y = trs[0b101001100];
    let B4z = trs[0b110000011];
    let B5a = trs[0b111100100];
    let B5e = trs[0b101001101];
    let B5j = trs[0b111100001];
    let B5k = trs[0b101001110];
    let B5r = trs[0b111000011];
    let B6e = trs[0b101001111];
    let B6i = trs[0b111000111];
    if (!B2i && B1e) {
        out[0b010000010] = 1;
        out[0b000101000] = 1;
    }
    if (!B2k && B1e) {
        out[0b100001000] = 1;
        out[0b000001100] = 1;
        out[0b001000010] = 1;
        out[0b100000010] = 1;
        out[0b000100001] = 1;
        out[0b001100000] = 1;
        out[0b010000100] = 1;
        out[0b010000001] = 1;
    }
    if (!B3c) {
        let value = A3C;
        if (B2n) {
            value |= A3C_B2N;
        }
        if (B2c) {
            value |= A3C_B2C;
        }
        out[0b101000100] = 1;
        out[0b101000001] = 1;
        out[0b100000101] = 1;
        out[0b001000101] = 1;
    }
    if (!B3k && B2e) {
        out[0b010100001] = 1;
        out[0b001100010] = 1;
        out[0b010001100] = 1;
        out[0b100001010] = 1;
    }
    if (!B3n && B2a) {
        out[0b101100000] = 1;
        out[0b101001000] = 1;
        out[0b011000001] = 1;
        out[0b001000011] = 1;
        out[0b000001101] = 1;
        out[0b000100101] = 1;
        out[0b100000110] = 1;
        out[0b110000100] = 1;
    }
    if (!B3q && B2a) {
        out[0b100100001] = 1;
        out[0b001001100] = 1;
        out[0b011000100] = 1;
        out[0b100000011] = 1;
        out[0b001100100] = 1;
        out[0b100001001] = 1;
        out[0b001000110] = 1;
        out[0b110000001] = 1;
    }
    if (!B3r && B2a) {
        out[0b100101000] = 1;
        out[0b001101000] = 1;
        out[0b011000001] = 1;
        out[0b001000011] = 1;
        out[0b000001101] = 1;
        out[0b000100101] = 1;
        out[0b110000100] = 1;
        out[0b100000110] = 1;
    }
    if (!B3y) {
        let value: number;
        if (B1e) {
            value = A3Y_MERGE_ALL;
        } else {
            value = A3Y;
            if (B2c) {
                value |= A3Y_B2C;
            }
            if (B2k) {
                value |= A3Y_B2K;
            }
        }
        out[0b101000010] = value;
        out[0b001100001] = value;
        out[0b010000101] = value;
        out[0b100001100] = value;
    }
    if (B4c) [

    ]
    return out;
}
