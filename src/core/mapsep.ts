
/*

Implements xp2's algorithm for object seperation for MAP rules:
1. Give each group of kingwise-connected cells a number
2. Run it for some number of generations, combining objects that birth cells
3. After each generation, resolve knots
4. After a sufficient number of generations, the objects should be seperated

A knot is a dead cell surrounded by 2+ groups of live cells that won't come alive in the next generation
Knots cause the merger of objects if a birth would happen if the groups were seperated.
If it is ambiguous, the current behavior is to just merge them.

The current implementation does NOT account for neighborhood restrictions, perhaps this should be changed in the future.

*/

import {LifewebError, gcd} from './util.js';
import {INT, MAPPattern} from './map.js';
import {findType, PatternType} from './identify.js';


/*

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

// we precompute a 512-element knot lookup table indicating what to do for each knot

// when writing this i translated the grid to make it simpler
// so instead of
// 0 3 6
// 1 4 7
// 2 5 8
// i did
// 0 1 2
// 3 4 5
// 6 7 8
// this works because i also did it while ordering the transitions
// it's bitmasking, so we choose the merges

const KNOT_MERGE_02 = 1;
const KNOT_MERGE_05 = 2;
const KNOT_MERGE_06 = 3;
const KNOT_MERGE_07 = 4;
const KNOT_MERGE_08 = 5;
const KNOT_MERGE_16 = 6;
const KNOT_MERGE_17 = 7;
const KNOT_MERGE_18 = 8;
const KNOT_MERGE_23 = 9;
const KNOT_MERGE_26 = 10;
const KNOT_MERGE_27 = 11;
const KNOT_MERGE_28 = 12;
const KNOT_MERGE_35 = 13;
const KNOT_MERGE_38 = 14;
const KNOT_MERGE_56 = 15;
const KNOT_MERGE_68 = 16;

const KNOT_MULTI_ISLAND = 17;

// for the two-island cases we can do the analysis automatically
// this is slightly slower in startup but saves a lot of room for human error

const IS_TWO_ISLAND_KNOT = new Uint8Array(512);
for (let tr of ['2c', '2i', '2k', '2n', '3k', '3n', '3q', '3r', '4i', '4k', '4n', '4q', '4t', '4z', '5j', '5k', '5r', '6e', '6i']) {
    for (let i of INT.trs[tr]) {
        IS_TWO_ISLAND_KNOT[i] = 1;
    }
}

const IS_MULTI_ISLAND_KNOT = new Uint8Array(512);
for (let tr of ['3c', '3y', '4c', '4y', '5e']) {
    for (let i of INT.trs[tr]) {
        IS_MULTI_ISLAND_KNOT[i] = 1;
    }
}

// format: [mask, transition]
// if ((tr & mask) === transition) then we have it
const KNOT_ISLANDS = [
    // 1c
    [0b110_110_000, 0b100_000_000],
    [0b011_011_000, 0b001_000_000],
    [0b000_110_110, 0b000_000_100],
    [0b000_011_011, 0b000_000_001],
    // 1e
    [0b111_111_000, 0b010_000_000],
    [0b110_110_110, 0b000_100_000],
    [0b011_011_011, 0b000_001_000],
    [0b000_111_111, 0b000_000_010],
    // 2a
    [0b111_111_000, 0b110_000_000],
    [0b111_111_000, 0b011_000_000],
    [0b110_110_110, 0b100_100_000],
    [0b110_110_110, 0b000_100_100],
    [0b011_011_011, 0b001_001_000],
    [0b011_011_011, 0b000_001_001],
    [0b000_111_111, 0b000_000_110],
    [0b000_111_111, 0b000_000_011],
    // 2c
    [0b111_111_000, 0b101_000_000],
    [0b110_110_110, 0b100_000_100],
    [0b011_011_011, 0b001_000_001],
    [0b000_111_111, 0b000_000_101],
    // 2e
    [0b111_111_110, 0b010_100_000],
    [0b111_111_011, 0b010_001_000],
    [0b110_111_111, 0b000_100_010],
    [0b011_111_111, 0b000_001_010],
    // 2k
    [0b111_111_110, 0b001_100_000],
    [0b111_111_110, 0b010_000_100],
    [0b111_111_011, 0b100_001_000],
    [0b111_111_011, 0b010_000_001],
    [0b110_111_111, 0b100_000_010],
    [0b110_111_111, 0b000_100_001],
    [0b011_111_111, 0b001_000_010],
    [0b011_111_111, 0b000_001_100],
    // 3a
    [0b111_111_110, 0b110_100_000],
    [0b111_111_011, 0b011_001_000],
    [0b110_111_111, 0b000_100_110],
    [0b011_111_111, 0b000_001_011],
    // 3i
    [0b111_111_000, 0b111_000_000],
    [0b110_110_110, 0b100_100_100],
    [0b011_011_011, 0b001_001_001],
    [0b000_111_111, 0b000_000_111],
    // 4a
    [0b111_111_110, 0b111_100_000],
    [0b111_111_110, 0b110_100_100],
    [0b111_111_011, 0b111_001_000],
    [0b111_111_011, 0b011_001_001],
    [0b110_111_111, 0b100_100_110],
    [0b110_111_111, 0b000_100_111],
    [0b011_111_111, 0b001_001_011],
    [0b011_111_111, 0b000_001_111],
];

const BASIC_KNOT_MERGES: {[key: string]: number} = {
    '02': KNOT_MERGE_02,
    '05': KNOT_MERGE_05,
    '06': KNOT_MERGE_06,
    '07': KNOT_MERGE_07,
    '08': KNOT_MERGE_08,
    '16': KNOT_MERGE_16,
    '17': KNOT_MERGE_17,
    '18': KNOT_MERGE_18,
    '23': KNOT_MERGE_23,
    '26': KNOT_MERGE_26,
    '27': KNOT_MERGE_27,
    '28': KNOT_MERGE_28,
    '35': KNOT_MERGE_35,
    '38': KNOT_MERGE_38,
    '56': KNOT_MERGE_56,
    '68': KNOT_MERGE_68,
};

/** Gets precomputed knot lists for `MAPSeparator`, but only for the basic cases. */
export function getKnots(trs: Uint8Array): Uint8Array {
    let out = new Uint8Array(512);
    // first the simple cases
    for (let tr = 0; tr < 512; tr++) {
        if (trs[tr] || (tr & (1 << 4))) {
            continue;
        } else if (IS_TWO_ISLAND_KNOT[tr]) {
            let found = false;
            let tr2 = tr;
            let islands: number[] = [];
            for (let [mask, testTr] of KNOT_ISLANDS) {
                if (((tr2 & mask) === testTr) && trs[testTr]) {
                    found = true;
                    tr &= ~mask;
                    let mask2 = 256;
                    for (let i = 0; i < 9; i++) {
                        if ((tr & mask2) === 1) {
                            islands.push(i);
                            break;
                        }
                        mask2 >>= 1;
                    }
                }
            }
            if (found) {
                let key = islands.sort().join('');
                if (!(key in BASIC_KNOT_MERGES)) {
                    throw new LifewebError(`Merge not present for transition ${tr}: ${key}`);
                }
                out[tr] = BASIC_KNOT_MERGES[key];
            }
        } else if (IS_MULTI_ISLAND_KNOT[tr]) {
            out[tr] = KNOT_MULTI_ISLAND;   
        }
    }
    return out;
}


/** Separates objects in INT rules using a colorizing algorithm. May have bugs.
 * @param knots The precomputed knot data (which helps with disconnected strict objects), call `getKnots` to use it.
*/
export class MAPSeparator extends MAPPattern {

    /** Contains precomputed data to help with disconnected strict objects, for more information see the comments at the top of lifeweb/src/2d/intsep.ts. */
    knots: Uint8Array;
    /** The group number of each live cell. */
    groups: Uint32Array;
    /** The list of reassigned group numbers */
    reassignedGroups: {[key: number]: number} = {};

    constructor(p: MAPPattern | MAPSeparator, knots: Uint8Array) {
        let height = p.height;
        let width = p.width;
        let data = p.data.slice();
        super(height, width, data, p.rule, p.trs);
        this.xOffset = p.xOffset;
        this.yOffset = p.yOffset;
        this.generation = p.generation;
        this.trs = p.trs;
        this.knots = knots;
        if (p instanceof MAPSeparator) {
            this.groups = p.groups;
            return;
        }
        // we need to assign the initial group numbers
        // we do this for every contiguous group of cells, as described above
        let groups = new Uint32Array(this.size);
        this.groups = groups;
        let nextGroup = 1;
        // top-left cell
        if (data[0]) {
            groups[0] = nextGroup++;
        }
        let i = 1;
        for (; i < width; i++) {
            // top row
            if (data[i]) {
                if (groups[i - 1]) {
                    groups[i] = groups[i - 1];
                } else {
                    groups[i] = nextGroup++;
                }
            }
        }
        for (let y = 1; y < height; y++) {
            // left column
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
                // middle
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
            // right column
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

    /** Reassigns a group to another one, replacing all members and adding it to `reassignedGroups`. */
    reassign(a: number, b: number): boolean {
        if (a === b) {
            return false;
        }
        while (a in this.reassignedGroups) {
            a = this.reassignedGroups[a];
        }
        while (b in this.reassignedGroups) {
            b = this.reassignedGroups[b];
        }
        if (a === b) {
            return false;
        }
        this.reassignedGroups[a] = b;
        for (let i = 0; i < this.groups.length; i++) {
            if (this.groups[i] === a) {
                this.groups[i] = b;
            }
        }
        return true;
    }

    runGeneration(): boolean {
        // this does not implement knot resolution, just the birth rule
        // very similar to `MAPPattern.runGeneration`, but has additional birth checks
        // there are probably some bugs in this function
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
                if (tr2 & 64) {
                    if (tr2 === 0b101000000) {
                        reassignments.push([groups[i - width - 1], groups[i + width - 1]]);
                    }
                    newGroups[loc2] = groups[i + width - 1];
                } else if (tr2 & 128) {
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
                    out[loc] = 1;
                    if (tr & 16) {
                        newGroups[loc] = groups[i - 1];
                    } else {
                        newGroups[loc] = groups[i - 2];
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
                    if (IS_TWO_ISLAND_KNOT[tr1]) {
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
                    if (IS_TWO_ISLAND_KNOT[tr2]) {
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
                    if (IS_TWO_ISLAND_KNOT[tr]) {
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
                        if (IS_TWO_ISLAND_KNOT[tr]) {
                            let a = 0;
                            for (let x of [i - width, i, i + width, i - width - 1, i + width - 1, i - width - 2, i, i + width - 2]) {
                                let y = groups[x];
                                if (y) {
                                    if (!a) {
                                        a = y;
                                    } else if (a !== y) {
                                        reassignments.push([y, a]);
                                        if (!IS_MULTI_ISLAND_KNOT[tr]) {
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
                    if (IS_TWO_ISLAND_KNOT[tr]) {
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
        this.xOffset--;
        this.yOffset--;
        this.generation++;
        let out2 = false;
        for (let [a, b] of reassignments) {
            if (this.reassign(a, b)) {
                out2 = true;
            }
        }
        return out2;
    }

    /** Merges disconnected strict objects. */
    resolveKnots(): boolean {
        let height = this.height;
        let width = this.width;
        let data = this.data;
        let groups = this.groups;
        let i = width + 1;
        let reassignments: [number, number][] = [];
        // we only have to do it for the middle cells, because knots can only exist there
        // this considerably simplifies the code compared to `MAPPAttern.runGeneration`
        for (let y = 1; y < height - 1; y++) {
            let tr = (data[i - width - 1] << 5) | (data[i - 1] << 4) | (data[i + width - 1] << 3) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
            i++;
            for (let x = 1; x < width - 1; x++) {
                tr = ((tr << 3) & 511) | (data[i - width] << 2) | (data[i] << 1) | data[i + width];
                let value = this.knots[tr];
                if (value === 0) {
                    i++;
                    continue;
                } else if (value === KNOT_MULTI_ISLAND) {
                    // this is the complicated part...
                    // we need to figure out if any births of a group are being suppressed
                    // but if there are multiple ways to group it together, it's ambiguous
                    // currently if it's ambiguous we just merge it all
                    // so first we need to get a list of groups and the bits they represent
                    let groupLookup: {[key: string]: number} = {};
                    let loc = 8;
                    for (let index of [i - width - 2, i - width - 1, i - width, i - 2, i - 1, i, i + width - 2, i + width - 1, i + width]) {
                        let group = groups[index];
                        if (group) {
                            if (group in groupLookup) {
                                groupLookup[group] |= 1 << loc;
                            } else {
                                groupLookup[group] = 1 << loc;
                            }
                        }
                        loc--;
                    }
                    let currentGroups = Object.entries(groupLookup);
                    // ok now we have to figure out which combinations of groups lead to a birth
                    let maxMask = 1 << currentGroups.length;
                    let births: Set<number> = new Set();
                    for (let groupMask = 0; groupMask < maxMask; groupMask++) {
                        let tr = 0;
                        for (let i = 0; i < currentGroups.length; i++) {
                            if (groupMask & (1 << i)) {
                                tr |= currentGroups[i][1];
                            }
                        }
                        if (this.trs[tr]) {
                            births.add(tr);
                        }
                    }
                    // shortcut case for when there is no birth occurring
                    if (births.size === 0) {
                        i++;
                        continue;
                    }
                } else {
                    // binary search
                    if (value < KNOT_MERGE_23) {
                        if (value < KNOT_MERGE_08) {
                            if (value < KNOT_MERGE_06) {
                                if (value === KNOT_MERGE_02) {
                                    reassignments.push([groups[i - width - 2], groups[i - width]]);
                                } else {
                                    reassignments.push([groups[i - width - 2], groups[i]]);
                                }
                            } else {
                                if (value === KNOT_MERGE_06) {
                                    reassignments.push([groups[i - width - 2], groups[i + width - 2]]);
                                } else {
                                    reassignments.push([groups[i - width - 2], groups[i + width - 1]]);
                                }
                            }
                        } else {
                            if (value < KNOT_MERGE_17) {
                                if (value === KNOT_MERGE_08) {
                                    reassignments.push([groups[i - width - 2], groups[i + width]]);
                                } else {
                                    reassignments.push([groups[i - width - 1], groups[i + width - 2]]);
                                }
                            } else {
                                if (value === KNOT_MERGE_17) {
                                    reassignments.push([groups[i - width - 1], groups[i + width - 1]]);
                                } else {
                                    reassignments.push([groups[i - width - 1], groups[i + width]]);
                                }
                            }
                        }
                    } else {
                        if (value < KNOT_MERGE_35) {
                            if (value < KNOT_MERGE_27) {
                                if (value === KNOT_MERGE_23) {
                                    reassignments.push([groups[i - width], groups[i - 2]]);
                                } else {
                                    reassignments.push([groups[i - width], groups[i + width - 2]]);
                                }
                            } else {
                                if (value === KNOT_MERGE_27) {
                                    reassignments.push([groups[i - width], groups[i + width - 1]]);
                                } else {
                                    reassignments.push([groups[i - width], groups[i + width]]);
                                }
                            }
                        } else {
                            if (value < KNOT_MERGE_56) {
                                if (value === KNOT_MERGE_35) {
                                    reassignments.push([groups[i - 2], groups[i]]);
                                } else {
                                    reassignments.push([groups[i - 2], groups[i + width]]);
                                }
                            } else {
                                if (value === KNOT_MERGE_56) {
                                    reassignments.push([groups[i], groups[i + width - 2]]);
                                } else {
                                    reassignments.push([groups[i + width - 2], groups[i + width]]);
                                }
                            }
                        }
                    }
                }
                i++;
            }
            i++;
        }
        let out = false;
        for (let [a, b] of reassignments) {
            if (a === b) {
                continue;
            }
            if (this.reassign(a, b)) {
                out = true;
            }
        }
        return out;
    }

    /** Gets all the groups as individual objects. Does not set the generation property, so if you want that, you should set it yourself. */
    getObjects(): MAPPattern[] {
        let groups = this.groups;
        let data: {[key: number]: [number, number][]} = {};
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
            let p = new MAPPattern(height, width, data, this.rule, this.trs);
            p.xOffset = minX + this.xOffset;
            p.yOffset = minY + this.yOffset;
            out.push(p);
        }
        return out;
    }

    /** Performs complete object separation.
     * @param limit The maximum number of generations to identify for.
     * @param max The maximum number of object separation generations to run.
     * @param recurseEveryTime I honestly forget what this thing actually does.
     * @param depth The recursion depth. I think this is internal, but I'm not sure.
     */
    separate(limit: number, max: number, recurseEveryTime: boolean = false, depth: number = 1): [[MAPPattern, PatternType][], boolean] | null {
        if (this.isEmpty()) {
            return [[], false];
        }
        let i = 0;
        let totalI = 0;
        let maxPeriod = max;
        let objs: [MAPPattern, PatternType][] = [];
        let failed = false;
        while (totalI < max) {
            let reassigned = this.runGeneration();
            let reassigned2 = this.resolveKnots();
            // if (totalI === 0) {
            //     let data = this.getObjects().map(x => identify(x, limit));
            //     // @ts-ignore
            //     data = data.map(x => Object.assign({}, x, {phases: x.phases.map(y => '#C ' + y.xOffset + ' ' + y.yOffset + '\n' + y.toRLE())}));
            //     let q = new MAPPattern(this.height, this.width, new Uint8Array(this.groups), this.trs, this.ruleStr, this.ruleSymmetry);
            //     // @ts-ignore
            //     q.states = 256;
            //     this.ruleStr = 'B2-ak5j/S12-k';
            //     q.ruleStr = 'B2-ak5j/S12-kSuper';
            //     console.log(i, maxPeriod, totalI, max);
            //     console.log('\n\n' + this.toRLE() + '\n\n' + q.toRLE() + '\n\n'/* + Object.entries(this.reassignedGroups).map(x => x[0] + ' ' + x[1]).join('\n') + '\n\n' + JSON.stringify(data, undefined, 4).replaceAll('\\n', '\n') + '\n\n'*/);
            //     process.exit();
            // }
            if (reassigned || reassigned2) {
                i = 0;
                totalI++;
                continue;
            }
            let found = true;
            if (recurseEveryTime && depth > 0) {
                objs = [];
                for (let p of this.getObjects()) {
                    let single = true;
                    let i = 1;
                    for (; i < p.width; i++) {
                        if (p.data[i] && !p.data[i - 1]) {
                            single = false;
                            break;
                        }
                    }
                    if (single) {
                        for (let y = 0; y < p.height; y++) {
                            if (p.data[i] && !(p.data[i - p.width] || p.data[i - p.width + 1])) {
                                single = false;
                                break;
                            }
                            i++;
                            for (let x = 1; x < p.width - 1; x++) {
                                if (p.data[i] && !(p.data[i - 1] || p.data[i - p.width - 1] || p.data[i - p.width] || p.data[i - p.width + 1])) {
                                    single = false;
                                    break;
                                }
                                i++;
                            }
                            if (!single) {
                                break;
                            }
                            if (p.data[i] && !(p.data[i - 1] || p.data[i - p.width - 1] || p.data[i - p.width])) {
                                single = false;
                                break;
                            }
                            i++;
                        }
                    }
                    if (single) {
                        let x = findType(p, limit);
                        if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                            found = false;
                            break;
                        }
                        objs.push([p.copy(), x]);
                    } else {
                        let sep = new MAPSeparator(p, this.knots);
                        let data = sep.separate(limit, max, recurseEveryTime, depth - 1);
                        if (data === null) {
                            failed = true;
                            let x = findType(p, limit);
                            if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                                found = false;
                                break;
                            }
                            objs.push([p.copy(), x]);
                        } else {
                            if (data[1] === true) {
                                failed = true;
                            }
                            for (let [p, x] of data[0]) {
                                if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                                    found = false;
                                    break;
                                }
                                objs.push([p, x]);
                            }
                            if (!found) {
                                break;
                            }
                        }
                    }
                }
            } else {
                objs = this.getObjects().map(x => [x, findType(x, limit)]);
            }
            if (!objs.every(([_, x]) => x.stabilizedAt === 0 && x.phases[x.phases.length - 1].isEmpty())) {
                i = 0;
            } else if (i === 0) {
                i = 1;
                let periods = objs.map(([_, x]) => x.linear ? x.period * 8 : x.period);
                maxPeriod = periods[0];
                for (let period of periods.slice(1)) {
                    maxPeriod = maxPeriod * period / gcd(maxPeriod, period);
                }
            } else {
                i++;
            }
            if (i === maxPeriod) {
                if (recurseEveryTime) {
                    return [objs, failed];
                }
                if (depth > 0) {
                    objs = [];
                    for (let p of this.getObjects()) {
                        let single = true;
                        let i = 1;
                        for (; i < p.width; i++) {
                            if (p.data[i] && !p.data[i - 1]) {
                                single = false;
                                break;
                            }
                        }
                        if (single) {
                            for (let y = 0; y < p.height; y++) {
                                if (p.data[i] && !(p.data[i - p.width] || p.data[i - p.width + 1])) {
                                    single = false;
                                    break;
                                }
                                i++;
                                for (let x = 1; x < p.width - 1; x++) {
                                    if (p.data[i] && !(p.data[i - 1] || p.data[i - p.width - 1] || p.data[i - p.width] || p.data[i - p.width + 1])) {
                                        single = false;
                                        break;
                                    }
                                    i++;
                                }
                                if (!single) {
                                    break;
                                }
                                if (p.data[i] && !(p.data[i - 1] || p.data[i - p.width - 1] || p.data[i - p.width])) {
                                    single = false;
                                    break;
                                }
                                i++;
                            }
                        }
                        if (single) {
                            let x = findType(p, limit);
                            if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                                found = false;
                                break;
                            }
                            objs.push([p.copy(), x]);
                        } else {
                            let sep = new MAPSeparator(p, this.knots);
                            let data = sep.separate(limit, max, recurseEveryTime, depth - 1);
                            if (data === null) {
                                failed = true;
                                let x = findType(p, limit);
                                if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                                    found = false;
                                    break;
                                }
                                objs.push([p.copy(), x]);
                            } else {
                                if (data[1] === true) {
                                    failed = true;
                                }
                                for (let [p, x] of data[0]) {
                                    if (x.stabilizedAt !== 0 || x.phases[x.phases.length - 1].isEmpty()) {
                                        found = false;
                                        break;
                                    }
                                    objs.push([p, x]);
                                }
                                if (!found) {
                                    break;
                                }
                            }
                        }
                    }
                } else {
                    objs = this.getObjects().map(x => [x, findType(x, limit)]);
                    failed = !objs.every(([_, x]) => x.stabilizedAt === 0 && x.phases[x.phases.length - 1].isEmpty());
                }
                return [objs, failed];
            }
            totalI++;
        }
        if (!recurseEveryTime) {
            return this.separate(limit, max, true, depth);
        } else {
            return null;
        }
    }

    copy(): MAPSeparator {
        return new MAPSeparator(this, this.knots);
    }

    clearedCopy(): MAPSeparator {
        return new MAPSeparator(new MAPPattern(0, 0, new Uint8Array(0), this.rule, this.trs), this.knots);
    }

    copyPart(x: number, y: number, height: number, width: number): MAPSeparator {
        let data = new Uint8Array(width * height);
        let groups = new Uint32Array(width * height);
        let loc = 0;
        for (let row = y; row < y + height; row++) {
            data.set(this.data.slice(row * this.width + x, row * this.width + x + width), loc);
            groups.set(this.groups.slice(row * this.width + x, row * this.width + x + width), loc);
            loc += width;
        }
        let out = new MAPSeparator(this, this.knots);
        out.data = data;
        out.groups = groups;
        return out;
    }

    loadApgcode(code: string): MAPSeparator {
        return new MAPSeparator(new MAPPattern(0, 0, new Uint8Array(0), this.rule, this.trs).loadApgcode(code), this.knots);
    }

}
