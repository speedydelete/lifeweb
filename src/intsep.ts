
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

*/


import {MAPPattern, TRANSITIONS} from './map.js';


const MULTI_ISLAND = ['2c', '2i', '2k', '2n', '3c', '3k', '3n', '3q', '3r', '3y', '4c', '4i', '4k', '4n', '4q', '4t', '4y', '4z', '5e', '5j', '5k', '5r', '6e', '6i'].flatMap(x => TRANSITIONS[x]);
const THREE_OR_MORE_ISLANDS = ['3c', '3y', '4c', '4y', '5e'].flatMap(x => TRANSITIONS[x]);
let isMultiIsland = new Uint8Array(512);
let isThreeOrMoreIslands = new Uint8Array(512);
for (let i = 0; i < 512; i++) {
    if (MULTI_ISLAND.includes(i)) {
        isMultiIsland[i] = 1;
    }
    if (THREE_OR_MORE_ISLANDS.includes(i)) {
        isThreeOrMoreIslands[i] = 1;
    }
}

const KNOT_TYPE = 0xF0;

const A3C = 0x10;
const A3C_B2N = 1;
const A3C_B2C = 2;

const A3Y = 0x20;
const A3Y_B2C = 1;
const A3Y_B2K = 2;
const A3Y_MERGE_ALL = 8;

const A4C = 0x30;
const A4C_B2N = 1;
const A4C_B2C = 2;
const A4C_MERGE_ALL = 8;

const A4Y = 0x40;
const A4Y_B2A = 1;
const A4Y_B3Q = 2;
const A4Y_B3N = 4;
const A4Y_B2C = 8;
const A4Y_MERGE_ALL = 0x47;

const A5E = 0x50;
const A5E_B2C = 1;
const A5E_B4N = 2;
const A5E_MERGE_ALL = 8;


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
        out[0b101000100] = value;
        out[0b101000001] = value;
        out[0b100000101] = value;
        out[0b001000101] = value;
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
        out[0b011000010] = 1;
        out[0b010000011] = 1;
        out[0b000101100] = 1;
        out[0b000101100] = 1;
        out[0b110000010] = 1;
        out[0b010000110] = 1;
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
    if (!B4c) {
        let value: number;
        if (!B3c) {
            if (B2c || B2n) {
                value = A4C_MERGE_ALL;
            } else {
                value = 0;
            }
        } else {
            value = A4C;
            if (B2c) {
                value |= A4C_B2C;
            }
            if (B2n) {
                value |= A4C_B2N;
            }
        }
        out[0b101000101] = value;
    }
    if (!B4i && B2a) {
        out[0b101101000] = 1;
        out[0b000101101] = 1;
        out[0b110000110] = 1;
        out[0b011000011] = 1;
    }
    if (!B4k && B3j) {
        out[0b011100001] = 1;
        out[0b110001100] = 1;
        out[0b010001101] = 1;
        out[0b101001010] = 1;
        out[0b100001110] = 1;
        out[0b001100011] = 1;
        out[0b101100010] = 1;
        out[0b010100101] = 1;
    }
    if (!B4q && B3a) {
        out[0b110100001] = 1;
        out[0b011001100] = 1;
        out[0b100001011] = 1;
        out[0b001100110] = 1;
    }
    if (!B4t && (B1e || B3i)) {
        out[0b111000010] = 1;
        out[0b001101001] = 1;
        out[0b010000111] = 1;
        out[0b100101100] = 1;
    }
    if (!B4y) {
        let value: number;
        if (B2a) {
            if (!B3q && !B3n) {
                value = A4Y_MERGE_ALL;
            } else {
                value = A4Y_B2A;
                if (B3q) {
                    value |= A4Y_B3Q;
                }
                if (B3n) {
                    value |= A4Y_B3N;
                }
            }
        } else {
            value = A4Y;
            if (B3q) {
                value |= A4Y_B3Q;
            }
            if (B3n) {
                value |= A4Y_B3N;
            }
            if (B2c) {
                value |= A4Y_B2C;
            } else if (B3q && B2n) {
                value = A4Y_MERGE_ALL;
            }
        }
        out[0b101000110] = value;
        out[0b101000011] = value;
        out[0b101100001] = value;
        out[0b001100101] = value;
        out[0b110000101] = value;
        out[0b011000101] = value;
        out[0b100001101] = value;
        out[0b101001100] = value;
    }
    if (!B4z && B2a) {
        out[0b110000011] = 1;
        out[0b001101100] = 1;
        out[0b011000110] = 1;
        out[0b100101001] = 1;
    }
    if (!B5e) {
        let value: number;
        if (B3i) {
            value = A5E_MERGE_ALL;
        } else {
            value = A5E;
            if (B2c) {
                value |= A5E_B2C;
            }
            if (B4n) {
                value |= A5E_B4N;
            }
        }
        out[0b101000111] = value;
        out[0b111000101] = value;
        out[0b101100101] = value;
        out[0b101001101] = value;
    }
    if (!B5j && B4a) {
        out[0b110100101] = 1;
        out[0b011001101] = 1;
        out[0b111001100] = 1;
        out[0b100001111] = 1;
        out[0b101001011] = 1;
        out[0b101100110] = 1;
        out[0b001100111] = 1;
        out[0b111100001] = 1;
    }
    if (!B5k && B4w) {
        out[0b101001110] = 1;
        out[0b101100110] = 1;
        out[0b110100101] = 1;
        out[0b110001101] = 1;
    }
    if (!B5r && (B2a || B3i)) {
        out[0b100101101] = 1;
        out[0b101101100] = 1;
        out[0b111000110] = 1;
        out[0b111000011] = 1;
        out[0b001101101] = 1;
        out[0b101101001] = 1;
        out[0b011000111] = 1;
        out[0b110000111] = 1;
    }
    if (!B6e && B5a) {
        out[0b101001111] = 1;
        out[0b101100111] = 1;
        out[0b111100101] = 1;
        out[0b111001101] = 1;
    }
    if (!B6i && B3i) {
        out[0b101101101] = 1;
        out[0b111000111] = 1;
    }
    return out;
}


export class INTSeperator extends MAPPattern {

    knots: Uint8Array;
    groups: Uint32Array;
    reassignedGroups: {[key: number]: number} = {};

    constructor(p: MAPPattern | INTSeperator, knots: Uint8Array) {
        let height = p.height;
        let width = p.width;
        let data = p.data.slice();
        super(height, width, data, p.trs, p.ruleStr, 'D8');
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
        this.generation = p.generation;
        this.ruleStr = p.ruleStr;
        this.trs = p.trs;
        this.knots = knots;
        if (p instanceof INTSeperator) {
            this.groups = p.groups;
            return;
        }
        let groups = new Uint32Array(this.size);
        this.groups = groups;
        let nextGroup = 1;
        if (data[0]) {
            groups[0] = nextGroup++;
        }
        let i = 1;
        for (; i < width; i++) {
            if (data[i]) {
                if (groups[i - 1]) {
                    groups[i] = groups[i - 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
        }
        for (let y = 1; y < height; y++) {
            if (data[i]) {
                if (groups[i - width]) {
                    groups[i] = groups[i - width];
                } else if (groups[i - width + 1]) {
                    groups[i] = groups[i - width + 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
            i++;
            for (let x = 1; x < width - 1; x++) {
                if (data[i]) {
                    let g0 = groups[i - width - 1];
                    let g1 = groups[i - width];
                    let g2 = groups[i - width + 1];
                    let g3 = groups[i - 1];
                    if (g0) {
                        groups[i] = g0;
                        if (g2 && g2 !== g0) {
                            this.reassign(g2, g0);
                        }
                    } else if (g1) {
                        groups[i] = g1;
                        if (g3 && g3 !== g1) {
                            this.reassign(g3, g1);
                        }
                    } else if (g2) {
                        groups[i] = g2;
                        if (g3 && g3 !== g2) {
                            this.reassign(g3, g2);
                        }
                    } else if (g3) {
                        groups[i] = g3;
                    } else {
                        groups[i] = nextGroup++;
                    }
                }
                i++;
            }
            if (data[i]) {
                if (groups[i - width - 1]) {
                    groups[i] = groups[i - width - 1];
                } else if (groups[i - width]) {
                    groups[i] = groups[i - width];
                } else if (groups[i - 1]) {
                    groups[i] = groups[i - 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
            i++;
        }
    }

    reassign(a: number, b: number): void {
        if (a === b) {
            return;
        }
        if (a in this.reassignedGroups) {
            a = this.reassignedGroups[a];
        }
        if (b in this.reassignedGroups) {
            b = this.reassignedGroups[b];
        }
        this.reassignedGroups[a] = b;
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i] === a) {
                this.groups[i] = b;
            }
        }
    }

    runGeneration(): this {
        let width = this.width;
        let height = this.height;
        let size = this.size;
        let data = this.data;
        let groups = this.groups;
        let trs = this.trs;
        let width2 = width << 1;
        let lastRow = size - width;
        let secondLastRow = size - width2;
        let oStart = width + 3;
        let out = new Uint8Array((width + 2) * (height + 2));
        let newGroups = new Uint32Array((width + 2) * (height + 2));
        let reassignments: [number, number][] = []
        let i = 1;
        let j = lastRow + 1;
        let loc1 = 1;
        let loc2 = size + oStart + 2 * height;
        let tr1 = (data[0] << 3) | data[1];
        let tr2 = (data[lastRow] << 5) | (data[lastRow + 1] << 2);
        if (trs[tr1]) {
            out[loc1] = 1;
            newGroups[loc1] = groups[0];
        }
        if (trs[tr2]) {
            out[loc2] = 1;
            newGroups[loc2] = groups[lastRow];
        }
        for (loc1 = 2; loc1 < width; loc1++) {
            i++;
            j++;
            loc2++;
            tr1 = ((tr1 << 3) & 511) | data[i];
            tr2 = ((tr2 << 3) & 511) | (data[j] << 2);
            if (trs[tr1]) {
                out[loc1] = 1;
                if (tr1 === 0b001000001) {
                    reassignments.push([groups[i - 2], groups[i]]);
                    newGroups[loc1] = groups[i];
                } else {
                    newGroups[loc1] = groups[i - 2] || groups[i - 1] || groups[i];
                }
            }
            if (trs[tr2]) {
                out[loc2] = 1;
                if (tr2 === 0b100000100) {
                    reassignments.push([groups[j - 2], groups[j]]);
                    newGroups[loc2] = groups[j];
                } else {
                    newGroups[loc2] = groups[j - 2] || groups[j - 1] || groups[j];
                }
            }
        }
        if (trs[(tr1 << 3) & 511]) {
            out[loc1 + 1] = 1;
            newGroups[loc1 + 1] = groups[i];
        }
        if (trs[(tr2 << 3) & 511]) {
            out[loc2 + 1] = 1;
            newGroups[loc2 + 1] = groups[j];
        }
        tr1 = (data[0] << 1) | data[width];
        tr2 = (data[width - 1] << 7) | (data[width2 - 1] << 6);
        loc1 = width + 2;
        loc2 = oStart + width;
        if (trs[tr1]) {
            out[loc1] = 1;
            newGroups[loc1] = groups[0];
        }
        if (trs[tr2]) {
            out[loc2] = 1;
            newGroups[loc2] = groups[width - 1];
        }
        for (i = width2; i < size; i += width) {
            loc1 += width + 2;
            loc2 += width + 2;
            tr1 = ((tr1 << 1) & 7) | data[i];
            tr2 = ((tr2 << 1) & 511) | (data[i + width - 1] << 6);
            if (trs[tr1]) {
                out[loc1] = 1;
                if (tr1 & 1) {
                    if (tr1 === 0b000000101) {
                        reassignments.push([groups[i - width2], groups[i]]);
                    }
                    newGroups[loc1] = groups[i];
                } else if (tr1 & 2) {
                    newGroups[loc1] = groups[i - width];
                } else {
                    newGroups[loc1] = groups[i - width2];
                }
            }
            if (trs[tr2]) {
                out[loc2] = 1;
                if (tr2 & 1) {
                    if (tr2 === 0b101000000) {
                        reassignments.push([groups[i - width - 1], groups[i + width - 1]]);
                    }
                    newGroups[loc2] = groups[i + width - 1];
                } else if (tr2 & 2) {
                    newGroups[loc2] = groups[i - 1];
                } else {
                    newGroups[loc2] = groups[i - width - 1];
                }
            }
        }
        i -= width;
        if (trs[(tr1 << 1) & 7]) {
            out[loc1 + width + 2] = 1;
            newGroups[loc1 + width + 2] = groups[i - width];
        }
        if (trs[(tr2 << 1) & 511]) {
            out[loc2 + width + 2] = 1;
            newGroups[loc2 + width + 2] = groups[i - 1];
        }
        if (width <= 1) {
            if (width === 1) {
                let tr = (data[0] << 4) | (data[1] << 3);
                let loc = oStart;
                if (trs[tr]) {
                    out[loc] = 1;
                    if (tr & 16) {
                        newGroups[loc] = groups[0];
                    } else {
                        newGroups[loc] = groups[1];
                    }
                }
                loc += 3;
                for (i = 2; i < height; i++) {
                    tr = ((tr << 1) & 63) | (data[i] << 3);
                    if (trs[tr]) {
                        out[loc] = 1;
                        if (tr & 16) {
                            newGroups[loc] = groups[i - 1];   
                        } else if (tr & 8) {
                            if (tr === 0b000101000) {
                                reassignments.push([groups[i - 2], groups[i]]);
                            }
                            newGroups[loc] = groups[i];
                        } else {
                            newGroups[loc] = groups[i - 2];
                        }
                    }
                    loc += 3;
                }
                if (trs[(tr << 1) & 63]) {
                    out[loc + 4] = 1;
                    if (tr & 16) {
                        newGroups[loc + 4] = groups[i - 1];
                    } else {
                        newGroups[loc + 4] = groups[i - 2];
                    }
                }
            }
        } else {
            loc1 = oStart;
            loc2 = lastRow + oStart + 2 * height - 2;
            j = lastRow + 1;
            tr1 = (data[0] << 4) | (data[width] << 3) | (data[1] << 1) | data[width + 1];
            tr2 = (data[secondLastRow] << 5) | (data[lastRow] << 4) | (data[secondLastRow + 1] << 2) | (data[lastRow + 1] << 1);
            if (trs[tr1]) {
                out[loc1] = 1;
                if (tr1 & 16) {
                    newGroups[loc1] = groups[0];
                } else if (tr1 & 8) {
                    newGroups[loc1] = groups[width];
                } else if (tr1 & 2) {
                    newGroups[loc1] = groups[1];
                } else {
                    newGroups[loc1] = groups[width + 1];
                }
            }
            if (trs[tr2]) {
                out[loc2] = 1;
                if (tr2 & 16) {
                    newGroups[loc2] = groups[lastRow];
                } else if (tr2 & 32) {
                    newGroups[loc2] = groups[secondLastRow];
                } else if (tr1 & 4) {
                    newGroups[loc2] = groups[secondLastRow + 1];
                } else {
                    newGroups[loc2] = groups[lastRow + 1];
                }
            }
            for (i = 2; i < width; i++) {
                j++;
                loc1++;
                loc2++;
                tr1 = ((tr1 << 3) & 511) | (data[i] << 1) | data[i + width];
                if (trs[tr1]) {
                    out[loc1] = 1;
                    if (tr1 & 16) {
                        newGroups[loc1] = groups[i - 1];
                    } else if (tr1 & 128) {
                        newGroups[loc1] = groups[i - 2];
                    } else if (tr1 & 64) {
                        newGroups[loc1] = groups[i + width - 2];
                    } else if (tr1 & 8) {
                        newGroups[loc1] = groups[i + width - 1];
                    } else if (tr1 & 2) {
                        newGroups[loc1] = groups[i];
                    } else {
                        newGroups[loc1] = groups[i + width];
                    }
                    if (isMultiIsland[tr1]) {
                        let a = 0;
                        for (let x of [i - 2, i, i + width - 2, i + width - 1, i + width]) {
                            let y = groups[x];
                            if (y) {
                                if (!a) {
                                    a = y;
                                } else if (a !== y) {
                                    reassignments.push([y, a]);
                                    break;
                                }
                            }
                        }
                    }
                }
                tr2 = ((tr2 << 3) & 511) | (data[j - width] << 2) | (data[j] << 1);
                if (trs[tr2]) {
                    out[loc2] = 1;
                    if (tr2 & 16) {
                        newGroups[loc2] = groups[j - 1];
                    } else if (tr2 & 256) {
                        newGroups[loc2] = groups[j - width - 2];
                    } else if (tr2 & 128) {
                        newGroups[loc2] = groups[j - 2];
                    } else if (tr2 & 32) {
                        newGroups[loc2] = groups[j - width - 1];
                    } else if (tr2 & 4) {
                        newGroups[loc2] = groups[j - width];
                    } else {
                        newGroups[loc2] = groups[j];
                    }
                    if (isMultiIsland[tr2]) {
                        let a = 0;
                        for (let x of [j - 2, j, j - width - 2, j - width - 1, j - width]) {
                            let y = groups[x];
                            if (y) {
                                if (!a) {
                                    a = y;
                                } else if (a !== y) {
                                    reassignments.push([y, a]);
                                    break;
                                }
                            }
                        }
                    }
                }
            }
            if (trs[(tr1 << 3) & 511]) {
                loc1++;
                out[loc1] = 1;
                if (tr1 & 2) {
                    newGroups[loc1] = groups[i - 1];
                } else if (tr1 & 16) {
                    newGroups[loc1] = groups[i - 2];
                } else if (tr1 & 8) {
                    newGroups[loc1] = groups[i + width - 2];
                } else {
                    newGroups[loc1] = groups[i + width - 1];
                }
            }
            if (trs[(tr2 << 3) & 511]) {
                loc2++;
                out[loc2] = 1;
                if (tr2 & 2) {
                    newGroups[loc2] = groups[j];
                } else if (tr2 & 32) {
                    newGroups[loc2] = groups[j - width - 1];
                } else if (tr2 & 16) {
                    newGroups[loc2] = groups[j - 1];
                } else if (tr2 & 4) {
                    newGroups[loc2] = groups[j - width];
                }
            }
            i = width + 1;
            let loc = oStart + width;
            for (let y = 1; y < height - 1; y++) {
                loc += 2;
                let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                if (trs[tr]) {
                    out[loc] = 1;
                    if (tr & 16) {
                        newGroups[loc] = groups[i - 1];
                    } else if (tr & 32) {
                        newGroups[loc] = groups[i - width - 1];
                    } else if (tr & 8) {
                        newGroups[loc] = groups[i + width - 1];
                    } else if (tr & 4) {
                        newGroups[loc] = groups[i - width];
                    } else if (tr & 2) {
                        newGroups[loc] = groups[i];
                    } else {
                        newGroups[loc] = groups[i + width];
                    }
                    if (isMultiIsland[tr]) {
                        let a = 0;
                        for (let x of [i - width, i, i + width, i - width - 1, i + width - 1]) {
                            let y = groups[x];
                            if (y) {
                                if (!a) {
                                    a = y;
                                } else if (a !== y) {
                                    reassignments.push([y, a]);
                                    break;
                                }
                            }
                        }
                    }
                }
                i++;
                loc++;
                for (let x = 1; x < width - 1; x++) {
                    tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                    if (trs[tr]) {
                        out[loc] = 1;
                        if (tr & 16) {
                            newGroups[loc] = groups[i - 1];
                        } else if (tr & 256) {
                            newGroups[loc] = groups[i - width - 2];
                        } else if (tr & 128) {
                            newGroups[loc] = groups[i - 2];
                        } else if (tr & 64) {
                            newGroups[loc] = groups[i + width - 2];
                        } else if (tr & 32) {
                            newGroups[loc] = groups[i - width - 1];
                        } else if (tr & 8) {
                            newGroups[loc] = groups[i + width - 1];
                        } else if (tr & 4) {
                            newGroups[loc] = groups[i - width];
                        } else if (tr & 2) {
                            newGroups[loc] = groups[i];
                        } else {
                            newGroups[loc] = groups[i + width];
                        }
                        if (isMultiIsland[tr]) {
                            let a = 0;
                            for (let x of [i - width, i, i + width, i - width - 1, i + width - 1, i - width - 2, i, i + width - 2]) {
                                let y = groups[x];
                                if (y) {
                                    if (!a) {
                                        a = y;
                                    } else if (a !== y) {
                                        reassignments.push([y, a]);
                                        if (!isThreeOrMoreIslands[tr]) {
                                            break;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    i++;
                    loc++;
                }
                tr = (tr << 3) & 511;
                if (trs[tr]) {
                    out[loc] = 1;
                    if (tr & 16) {
                        newGroups[loc] = groups[i - 1];
                    } else if (tr & 256) {
                        newGroups[loc] = groups[i - width - 2];
                    } else if (tr & 128) {
                        newGroups[loc] = groups[i - 2];
                    } else if (tr & 64) {
                        newGroups[loc] = groups[i + width - 2];
                    } else if (tr & 32) {
                        newGroups[loc] = groups[i - width - 1];
                    } else {
                        newGroups[loc] = groups[i + width - 1];
                    }
                    if (isMultiIsland[tr]) {
                        let a = 0;
                        for (let x of [i - width - 1, i + width - 1, i - width - 2, i - 2, i + width - 2]) {
                            let y = groups[x];
                            if (y) {
                                if (!a) {
                                    a = y;
                                } else if (a !== y) {
                                    reassignments.push([y, a]);
                                    break;
                                }
                            }
                        }
                    }
                }
                i++;
                loc++;
            }
        }
        this.height += 2;
        this.width += 2;
        this.size = this.height * this.width;
        this.data = out;
        this.groups = newGroups;
        // alert(reassignments.map(x => x[0] + ' ' + x[1]).join('\n'));
        for (let [a, b] of reassignments) {
            this.reassign(a, b);
        }
        this.xOffset--;
        this.yOffset--;
        this.generation++;
        return this;
    }

    resolveKnots(): this {
        let height = this.height;
        let width = this.width;
        let data = this.data;
        let groups = this.groups;
        let i = width + 1;
        let reassignments: [number, number][] = [];
        for (let y = 1; y < height - 1; y++) {
            let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
            i++;
            for (let x = 1; x < width - 1; x++) {
                tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                let value = this.knots[tr];
                // if (value > 0) {
                //     alert(tr.toString(2).padStart(9, '0'));
                // }
                if (value === 1) {
                    let a = 0;
                    let x = groups[i - width - 2];
                    if (x) {
                        a = x;
                    }
                    x = groups[i - width - 1];
                    if (x) {
                        if (!a) {
                            a = x;
                        }
                    }
                    x = groups[i - width];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                            i++;
                            continue;
                        }
                    }
                    x = groups[i - 2];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                            i++;
                            continue;
                        }
                    }
                    x = groups[i];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                            i++;
                            continue;
                        }
                    }
                    x = groups[i + width - 2];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                            i++;
                            continue;
                        }
                    }
                    x = groups[i + width - 1];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                        }
                    }
                    x = groups[i + width];
                    if (x) {
                        if (!a) {
                            a = x;
                        } else if (a !== x) {
                            reassignments.push([x, a]);
                        }
                    }
                } else if (value > 0) {
                    let type = value & KNOT_TYPE;
                    if (type === A3C) {
                        if (value === A3C) {
                            i++;
                            continue;
                        }
                        let a = groups[i - width - 2];
                        let b: number;
                        let c: number;
                        if (a === 0) {
                            a = groups[i - width];
                            b = groups[i + width];
                            c = groups[i + width - 2];
                        } else {
                            b = groups[i - width];
                            if (b === 0) {
                                b = groups[i + width - 2];
                                c = groups[i + width];
                            } else {
                                c = groups[i + width - 2];
                                if (c === 0) {
                                    c = groups[i + width];
                                } else {
                                    let temp = a;
                                    a = b;
                                    b = temp;
                                }
                            }
                        }
                        if (value & A3C_B2C) {
                            if (a === b) {
                                reassignments.push([c, b]);
                            } else if (b === c) {
                                reassignments.push([a, b]);
                            } else if ((value & A3C_B2N) && a === c) {
                                reassignments.push([b, a]);
                            }
                        } else if ((value & A3C_B2N) && a === c) {
                            reassignments.push([b, a]);
                        }
                    } else if (type === A3Y) {
                        let a: number;
                        let b: number;
                        let c = groups[i - width - 1];
                        if (c) {
                            a = groups[i + width - 2];
                            b = groups[i + width];
                        } else {
                            c = groups[i];
                            if (c) {
                                a = groups[i - width - 2];
                                b = groups[i + width - 2];
                            } else {
                                c = groups[i - 2];
                                if (c) {
                                    a = groups[i - width];
                                    b = groups[i + width];
                                } else {
                                    a = groups[i - width - 2];
                                    b = groups[i - width];
                                    c = groups[i + width - 1];
                                }
                            }
                        }
                        if (value & A3Y_MERGE_ALL) {
                            reassignments.push([b, a]);
                            reassignments.push([c, a]);
                        } else {
                            if (value & A3Y_B2K) {
                                if (a === c) {
                                    reassignments.push([b, a]);
                                } else if (b === c) {
                                    reassignments.push([a, b]);
                                } else if ((value & A3Y_B2C) && a === b) {
                                    reassignments.push([c, a]);
                                }
                            } else if ((value & A3Y_B2C) && a === b) {
                                reassignments.push([c, a]);
                            }
                        }
                    } else if (type === A4C) {
                        let a = groups[i - width - 2];
                        let b = groups[i - width];
                        let c = groups[i + width - 2];
                        let d = groups[i + width];
                        if (value & A4C_MERGE_ALL) {
                            reassignments.push([b, a]);
                            reassignments.push([c, a]);
                            reassignments.push([d, a]);
                        } else {
                            if (value & A4C_B2C) {
                                if (a === b) {
                                    reassignments.push([c, a]);
                                    reassignments.push([d, a]);
                                } else if (a === c) {
                                    reassignments.push([b, a]);
                                    reassignments.push([d, a]);
                                } else if (b === d) {
                                    reassignments.push([a, b]);
                                    reassignments.push([c, b]);
                                } else if (c === d) {
                                    reassignments.push([a, c]);
                                    reassignments.push([b, c]);
                                } else if (value & A4C_B2N) {
                                    if (a === d) {
                                        reassignments.push([b, a]);
                                        reassignments.push([c, a]);
                                    } else if (b === c) {
                                        reassignments.push([a, b]);
                                        reassignments.push([d, b]);
                                    }
                                }
                            } else if (value & A4C_B2N) {
                                if (a === d) {
                                    reassignments.push([b, a]);
                                    reassignments.push([c, a]);
                                } else if (b === c) {
                                    reassignments.push([a, b]);
                                    reassignments.push([d, b]);
                                }
                            }
                        }
                    } else if (type === A4Y) {
                        let a: number;
                        let b: number;
                        let c: number;
                        let swap: number;
                        if (!groups[i - width - 2]) {
                            a = groups[i + width - 2];
                            b = groups[i + width];
                            c = groups[i - width];
                            swap = groups[i - width - 1];
                        } else if (!groups[i - width]) {
                            a = groups[i + width];
                            b = groups[i + width - 2];
                            c = groups[i - width - 2];
                            swap = groups[i - width - 1];
                        } else if (!groups[i + width - 2]) {
                            a = groups[i + width];
                            b = groups[i - width];
                            c = groups[i - width - 2];
                            swap = groups[i - 2];
                        } else {
                            a = groups[i + width - 2];
                            b = groups[i - width - 2];
                            c = groups[i - width];
                            swap = groups[i];
                        }
                        if (swap) {
                            let temp = c;
                            c = a;
                            a = temp;
                        }
                        // alert(a + ' ' + b + ' ' + c);
                        if (value & A4Y_B2A) {
                            if (value & A4Y_B3N) {
                                reassignments.push([b, a]);
                            }
                            if (value & A4Y_B3Q) {
                                reassignments.push([c, a]);
                            }
                        } else {
                            if ((value & A4Y_B3N) && (a === b)) {
                                reassignments.push([c, a]);
                            } else if ((value & A4Y_B3Q) && (a === c)) {
                                reassignments.push([b, a]);
                            } else if ((value & A4Y_B2C) && (b === c)) {
                                reassignments.push([a, b]);
                            }
                        }
                    } else {
                        let a = groups[i - width - 2];
                        let b = groups[i - width];
                        let c = groups[i + width - 2];
                        let d = groups[i + width];
                        if (a === c) {
                            c = d;
                        } else if (c === d) {
                            c = a;
                            a = d;
                        } else if (b === d) {
                            b = a;
                            a = d;
                        }
                        if (value === A5E_MERGE_ALL) {
                            reassignments.push([b, a]);
                            reassignments.push([c, a]);
                        } else {
                            if ((value & A5E_B2C) && (b === c)) {
                                reassignments.push([c, a]);
                            } else if ((value & A5E_B4N) && (a === b)) {
                                reassignments.push([b, a]);
                            }
                        }
                    }
                }
                i++;
            }
            i++;
        }
        for (let [a, b] of reassignments) {
            this.reassign(a, b);
        }
        return this;
    }

    getObjects(): MAPPattern[] {
        let groups = this.groups;
        let data: {[key: number]: [number, number][]} = [];
        let i = 0;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                let value = groups[i++];
                if (value) {
                    if (data[value]) {
                        data[value].push([x, y]);
                    } else {
                        data[value] = [[x, y]];
                    }
                }
            }
        }
        let out: MAPPattern[] = [];
        for (let cells of Object.values(data)) {
            let minX = Infinity;
            let minY = Infinity;
            let maxX = -Infinity;
            let maxY = -Infinity;
            for (let [x, y] of cells) {
                if (x < minX) {
                    minX = x;
                }
                if (x > maxX) {
                    maxX = x;
                }
                if (y < minY) {
                    minY = y;
                }
                if (y > maxY) {
                    maxY = y;
                }
            }
            let height = maxY - minY + 1;
            let width = maxX - minX + 1;
            let data = new Uint8Array(height * width);
            for (let [x, y] of cells) {
                data[(y - minY) * width + x - minX] = 1;
            }
            let p = new MAPPattern(height, width, data, this.trs, this.ruleStr, 'D8');
            p.xOffset = minX;
            p.yOffset = minY;
            out.push(p);
        }
        return out;
    }

    copy(): INTSeperator {
        return new INTSeperator(this, this.knots);
    }

    clearedCopy(): INTSeperator {
        return new INTSeperator(new MAPPattern(0, 0, new Uint8Array(0), this.trs, this.ruleStr, 'D8'), this.knots);
    }

    copyPart(x: number, y: number, width: number, height: number): INTSeperator {
        x -= this.xOffset;
        y -= this.yOffset;
        let data = new Uint8Array(width * height);
        let groups = new Uint32Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row, row + width), loc);
            groups.set(this.groups.slice(row, row + width), loc);
            loc += width;
        }
        let oldData = this.data;
        let oldGroups = this.groups;
        this.data = data;
        this.groups = groups;
        let out = new INTSeperator(this, this.knots);
        this.data = oldData;
        this.groups = oldGroups;
        return out;
    }

    loadApgcode(code: string): INTSeperator {
        return new INTSeperator(new MAPPattern(0, 0, new Uint8Array(0), this.trs, this.ruleStr, 'D8').loadApgcode(code), this.knots);
    }

}
