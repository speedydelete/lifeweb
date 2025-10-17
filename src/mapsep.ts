
/*

Implements xp2's algorithm for object seperation:
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
*/

import {Pattern} from './pattern.js';


let knotCache: {[key: string]: Uint8Array} = {};

// to detect whether there are more than 2 islands quickly, this function never returns 1 when given a knot with more than 2 islands
// the complicated cases are currently unimplemented!

export function getKnots(transitions: Uint8Array): Uint8Array {
    let trs = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        let j = (i & 273) | ((i & 32) << 2) | ((i & 4) << 4) | ((i & 128) >> 2) | ((i & 2) << 2) | ((i & 64) >> 4) | ((i & 8) >> 2);
        trs[j] = transitions[i];
    }
    let out = new Uint8Array(512);
    // A2c
    if (!trs[0b101000000]) {
        out[0b101000000] = trs[0b100000000] || trs[0b001000000];
    }
    if (!trs[0b10000100]) {
        out[0b101000000] = trs[0b100000000] || trs[0b000000100];
    }
    if (!trs[0b000000101]) {
        out[0b000000101] = trs[0b000000100] || trs[0b000000001];
    }
    if (!trs[0b001000001]) {
        out[0b001000001] = trs[0b001000000] || trs[0b000000100];
    }
    // A2i
    if (!trs[0b010000010]) {
        out[0b010000010] = trs[0b010000000] || trs[0b000000010];
    }
    if (!trs[0b000101000]) {
        out[0b000101000] = trs[0b000100000] || trs[0b000001000];
    }
    // A2k
    if (!trs[0b100001000]) {
        out[0b100001000] = trs[0b100000000] || trs[0b000001000];
    }
    if (!trs[0b000001100]) {
        out[0b000001100] = trs[0b000001000] || trs[0b000001000];
    }
    if (!trs[0b001000010]) {
        out[0b001000010] = trs[0b001000000] || trs[0b000000010];
    }
    if (!trs[0b100000010]) {
        out[0b100000010] = trs[0b100000000] || trs[0b000000010];
    }
    if (!trs[0b000100001]) {
        out[0b000100001] = trs[0b000100000] || trs[0b000000001];
    }
    if (!trs[0b001100000]) {
        out[0b001100000] = trs[0b000100000] || trs[0b001000000];
    }
    if (!trs[0b010000100]) {
        out[0b010000100] = trs[0b010000000] || trs[0b000000100];
    }
    if (!trs[0b010000001]) {
        out[0b010000001] = trs[0b010000000] || trs[0b000000001];
    }
    // A2n
    if (!trs[0b100000001]) {
        out[0b100000001] = trs[0b100000000] || trs[0b000000001];
    }
    if (!trs[0b001000100]) {
        out[0b001000100] = trs[0b001000000] || trs[0b000000100];
    }
    // A3c
    if (!trs[0b101000100]) {
        out[0b101000100]
    }
    // not implemented
    // A3k
    if (!trs[0b010100001]) {
        out[0b001100010] = trs[0b010100000] || trs[0b000000001];
    }
    if (!trs[0b010001100]) {
        out[0b010001100] = trs[0b010001000] || trs[0b000000100];
    }
    if (!trs[0b100001010]) {
        out[0b100001010] = trs[0b000001010] || trs[0b100000000];
    }
    if (!trs[0b001100010]) {
        out[0b001100010] = trs[0b000100010] || trs[0b001000000];
    }
    // A3n
    if (!trs[0b101100000]) {
        out[0b101100000] = trs[0b100100000] || trs[0b001000000];
    }
    if (!trs[0b101001000]) {
        out[0b101001000] = trs[0b001001000] || trs[0b100000000];
    }
    if (!trs[0b011000001]) {
        out[0b011000001] = trs[0b011000000] || trs[0b000000001];
    }
    if (!trs[0b011000001]) {
        out[0b001000011] = trs[0b000000011] || trs[0b001000000];
    }
    if (!trs[0b000001101]) {
        out[0b000001101] = trs[0b000001001] || trs[0b000000100];
    }
    if (!trs[0b000100101]) {
        out[0b000100101] = trs[0b000100100] || trs[0b000000001];
    }
    if (!trs[0b100000110]) {
        out[0b100000110] = trs[0b000000110] || trs[0b100000000];
    }
    if (!trs[0b110000100]) {
        out[0b110000100] = trs[0b110000000] || trs[0b000000100];
    }
    // A3q
    if (!trs[0b100100001]) {
        out[0b100100001] = trs[0b100100000] || trs[0b000000001]
    }
    if (!trs[0b001001100]) {
        out[0b001001100] = trs[0b001001000] || trs[0b000000100];
    }
    if (!trs[0b011000100]) {
        out[0b011000100] = trs[0b011000000] || trs[0b000000100];
    }
    if (!trs[0b100000011]) {
        out[0b100000011] = trs[0b000000011] || trs[0b100000000];
    }
    if (!trs[0b001100100]) {
        out[0b001100100] = trs[0b001000100] || trs[0b000100000];
    }
    if (!trs[0b100001001]) {
        out[0b100001001] = trs[0b000001001] || trs[0b100000000];
    }
    if (!trs[0b001000110]) {
        out[0b001000110] = trs[0b000000110] || trs[0b001000000];
    }
    if (!trs[0b110000001]) {
        out[0b110000001] = trs[0b110000000] || trs[0b000000001];
    }
    // A3r
    if (!trs[0b101100000]) {
        out[0b100101000] = trs[0b100100000] || trs[0b000001000];
    }
    if (!trs[0b100101000]) {
        out[0b100101000] = trs[0b100100000] || trs[0b000001000];
    }
    if (!trs[0b011000001]) {
        out[0b011000001] = trs[0b011000000] || trs[0b000000001];
    }
    if (!trs[0b001000011]) {
        out[0b001000011] = trs[0b000000011] || trs[0b001000000];
    }
    if (!trs[0b000001101]) {
        out[0b000001101] = trs[0b000001001] || trs[0b000000100];
    }
    if (!trs[0b000100101]) {
        out[0b000100101] = trs[0b000100100] || trs[0b000000001];
    }
    if (!trs[0b110000100]) {
        out[0b110000100] = trs[0b110000000] || trs[0b000000100];
    }
    if (!trs[0b100000110]) {
        out[0b100000110] = trs[0b000000110] || trs[0b100000000];
    }
    // A3y
    // not implemented
    // A4c
    // not implemented
    // A4i
    if (!trs[0b101101000]) {
        out[0b101101000] = trs[0b100100000] || trs[0b001001000];
    }
    if (!trs[0b000101101]) {
        out[0b000101101] = trs[0b000100100] || trs[0b000001001];
    }
    if (!trs[0b110000110]) {
        out[0b110000110] = trs[0b110000000] || trs[0b000000110];
    }
    if (!trs[0b011000011]) {
        out[0b011000011] = trs[0b011000000] || trs[0b000000011];
    }
    // A4k
    if (!trs[0b011100001]) {
        out[0b011100001] = trs[0b011100000] || trs[0b000000001];
    }
    if (!trs[0b110001100]) {
        out[0b110001100] = trs[0b110001000] || trs[0b000000100];
    }
    if (!trs[0b010001101]) {
        out[0b010001101] = trs[0b010001001] || trs[0b000000100];
    }
    if (!trs[0b101001010]) {
        out[0b101001010] = trs[0b001001010] || trs[0b100000000];
    }
    if (!trs[0b100001110]) {
        out[0b100001110] = trs[0b000001110] || trs[0b100000000];
    }
    if (!trs[0b001100011]) {
        out[0b001100011] = trs[0b000100011] || trs[0b001000000];
    }
    if (!trs[0b101100010]) {
        out[0b101100010] = trs[0b100100010] || trs[0b001000000];
    }
    if (!trs[0b010100101]) {
        out[0b010100101] = trs[0b010100100] || trs[0b000000001];
    }
    // A4q
    if (!trs[0b110100001]) {
        out[0b110100001] = trs[0b110100000] || trs[0b000000001];
    }
    if (!trs[0b011001100]) {
        out[0b011001100] = trs[0b011001000] || trs[0b000000100];
    }
    if (!trs[0b100001011]) {
        out[0b100001011] = trs[0b000001011] || trs[0b100000000];
    }
    if (!trs[0b001100110]) {
        out[0b001100110] = trs[0b000100110] || trs[0b001000000];
    }
    // A4t
    if (!trs[0b111000010]) {
        out[0b111000010] = trs[0b111000000] || trs[0b000000010];
    }
    if (!trs[0b001101001]) {
        out[0b001101001] = trs[0b001001001] || trs[0b000100000];
    }
    if (!trs[0b010000111]) {
        out[0b010000111] = trs[0b000000111] || trs[0b010000000];
    }
    if (!trs[0b100101100]) {
        out[0b100101100] = trs[0b100100100] || trs[0b000001000];
    }
    // A4y
    // not implemented
    // A4z
    if (!trs[0b110000011]) {
        out[0b110000011] = trs[0b110000000] || trs[0b000000011];
    }
    if (!trs[0b001101100]) {
        out[0b001101100] = trs[0b000100100] || trs[0b001001000];
    }
    if (!trs[0b011000110]) {
        out[0b011000110] = trs[0b011000000] || trs[0b000000110];
    }
    if (!trs[0b100101001]) {
        out[0b100101001] = trs[0b100100000] || trs[0b000001001];
    }
    // A5e
    // not implemented
    // A5j
    if (!trs[0b110100101]) {
        out[0b110100101] = trs[0b110100100] || trs[0b000000001];
    }
    if (!trs[0b011001101]) {
        out[0b011001101] = trs[0b011001001] || trs[0b000000100];
    }
    if (!trs[0b111001100]) {
        out[0b111001100] = trs[0b111001100] || trs[0b111001100];
    }
    if (!trs[0b100001111]) {
        out[0b100001111] = trs[0b000001111] || trs[0b100000000];
    }
    if (!trs[0b101001011]) {
        out[0b101001011] = trs[0b001001011] || trs[0b100000000];
    }
    if (!trs[0b101100110]) {
        out[0b101100110] = trs[0b100100110] || trs[0b001000000];
    }
    if (!trs[0b001100111]) {
        out[0b001100111] = trs[0b000100111] || trs[0b001000000];
    }
    if (!trs[0b111100001]) {
        out[0b111100001] = trs[0b111100000] || trs[0b000000001];
    }
    // A5k
    if (!trs[0b101001110]) {
        out[0b101001110] = trs[0b001001110] || trs[0b100000000];
    }
    if (!trs[0b101100110]) {
        out[0b101100110] = trs[0b100100110] || trs[0b001000000];
    }
    if (!trs[0b110100101]) {
        out[0b110100101] = trs[0b110100100] || trs[0b000000001];
    }
    if (!trs[0b110001101]) {
        out[0b110001101] = trs[0b110001001] || trs[0b000000100];
    }
    // A5r
    if (!trs[0b100101101]) {
        out[0b100101101] = trs[0b100100100] || trs[0b000001001];
    }
    if (!trs[0b101101100]) {
        out[0b101101100] = trs[0b100100100] || trs[0b001001000];
    }
    if (!trs[0b111000110]) {
        out[0b111000110] = trs[0b111000000] || trs[0b000000110];
    }
    if (!trs[0b111000011]) {
        out[0b111000011] = trs[0b111000000] || trs[0b000000011];
    }
    if (!trs[0b001101101]) {
        out[0b001101101] = trs[0b001101101] || trs[0b001101101];
    }
    if (!trs[0b101101001]) {
        out[0b101101001] = trs[0b001001001] || trs[0b100100000];
    }
    if (!trs[0b011000111]) {
        out[0b011000111] = trs[0b000000111] || trs[0b011000000];
    }
    if (!trs[0b110000111]) {
        out[0b110000111] = trs[0b000000111] || trs[0b110000000];
    }
    // A6e
    if (!trs[0b101001111]) {
        out[0b101001111] = trs[0b001001111] || trs[0b100000000];
    }
    if (!trs[0b101100111]) {
        out[0b101100111] = trs[0b101000111] || trs[0b000100000];
    }
    if (!trs[0b111100101]) {
        out[0b111100101] = trs[0b111100100] || trs[0b000000001];
    }
    if (!trs[0b111001101]) {
        out[0b111001101] = trs[0b111001001] || trs[0b000000100];
    }
    // A6i
    if (!trs[0b101101101]) {
        out[0b101101101] = trs[0b100100100] || trs[0b001001001];
    }
    if (!trs[0b111000111]) {
        out[0b111000111] = trs[0b111000000] || trs[0b000000111];
    }
    let actualOut = new Uint8Array(512);
    for (let i = 0; i < 512; i++) {
        let j = (i & 273) | ((i & 32) << 2) | ((i & 4) << 4) | ((i & 128) >> 2) | ((i & 2) << 2) | ((i & 64) >> 4) | ((i & 8) >> 2);
        actualOut[j] = out[i];
    }
    return out;
}


export class MAPSeperator {

    data: Uint16Array;
    aliases: Uint16Array;
    height: number;
    width: number;
    size: number;
    trs: Uint8Array;
    knots: Uint8Array;

    constructor(p: Pattern) {
        this.setFrom(p);
    }

    setFrom(p: Pattern) {
        let {height, width, size} = p;
        this.height = height;
        this.width = width;
        this.size = size;
        if (!p.extra.every((x, i) => x === this.trs[i])) {
            this.knots = getKnots(p.extra);
        }
        this.trs = p.extra;
        this.data = new Uint16Array(this.size);
        this.aliases.fill(0);
        
    }

}
