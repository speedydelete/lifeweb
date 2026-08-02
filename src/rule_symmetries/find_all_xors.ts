
import {INT} from '../core/index.js';
import {TRANSITION_CLASSES, TRANSITION_CLASS_ORS, basisSorter, findBasis, basisToString, parseSymmetry, xorTransitionsToString} from './index.js';


// function resolveXORTransitions(trs: Set<number>): Set<number> {
//     trs = new Set(trs);
//     let prevSize: number | undefined = undefined;
//     while (trs.size !== prevSize) {
//         prevSize = trs.size;
//         let copy = new Set(trs);
//         for (let tr1 of copy) {
//             for (let tr2 of copy) {
//                 trs.add(tr1 ^ tr2);
//             }
//         }
//     }
//     return trs;
// }

// let done = new Set<string>();
// let prevLevel: Set<number>[] = [new Set()];
// let foundBasises = new Map<string, [Set<number>, string]>();
// let currentLevel: Set<number>[] = [];

// function checkTransitions(trs: Set<number>): Set<number> | undefined {
//     trs = resolveXORTransitions(trs);
//     let key = xorTransitionsToString(trs).join(', ');
//     if (key.length === 0 || done.has(key)) {
//         return;
//     }
//     done.add(key);
//     let basis = findBasis(parseSymmetry(`INT, ${key}`));
//     if (typeof basis === 'string') {
//         return;
//     }
//     let basisText = basisToString(basis);
//     let value = foundBasises.get(basisText);
//     if (value !== undefined) {
//         let trs2 = value[0];
//         let oldSize = trs2.size;
//         for (let tr of trs) {
//             trs2.add(tr);
//         }
//         if (trs2.size > oldSize) {
//             trs2 = resolveXORTransitions(trs2);
//             console.log(`Update: ${value[1]} to ${xorTransitionsToString(trs2).join(', ')}`);
//             value[1] = key;
//         }
//     } else {
//         console.log(key);
//         foundBasises.set(basisText, [trs, key]);
//         currentLevel.push(trs);
//     }
// }

// let levelCount = 1;
// while (prevLevel.length > 0) {
//     console.log(`// level ${levelCount} (${prevLevel.length} symmetries) (${foundBasises.size} found in total)`);
//     currentLevel = [];
//     let i = 0;
//     for (let trs of prevLevel) {
//         console.log(`// checking ${i}/${prevLevel.length} (${foundBasises.size} found in total, ${currentLevel.length} queued for next level)`);
//         for (let or of Object.values(TRANSITION_CLASS_ORS)) {
//             for (let toAdd of Object.values(INT.trs)) {
//                 let trs2 = new Set(trs);
//                 for (let tr of toAdd) {
//                     trs2.add((tr << 1) | or);
//                 }
//                 checkTransitions(trs2);
//             }
//         }
//         i++;
//     }
//     prevLevel = currentLevel;
//     levelCount++;
// }
// console.log('\nFull:');
// let symmetries = Array.from(foundBasises.values()).map(x => Array.from(x[0]));
// for (let trs of symmetries.sort(basisSorter)) {
//     console.log(xorTransitionsToString(new Set(trs)).join(', '));
// }


let priority: string[] = [];
for (let letter of TRANSITION_CLASSES) {
    for (let trName of Object.keys(INT.trs)) {
        if (trName === '0c' || trName === '8c') {
            trName = trName[0];
        }
        priority.push(`^${letter}${trName}`);
    }
}

console.log(`^B1e, ^B3e, ^A2e, ^A2i, ^A4e
^B1e, ^B2a, ^B2k, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B4j, ^B4n, ^B4r, ^B4y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B6a, ^B6k, ^B7e, ^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8
^B1e, ^B2a, ^B2k, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B4j, ^B4n, ^B4r, ^B4y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B6a, ^B6k, ^B7e, ^S0, ^S1c, ^S2c, ^S2e, ^S2i, ^S2n, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S6c, ^S6e, ^S6i, ^S6n, ^S7c, ^S8, ^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8, ^D1e, ^D2a, ^D2k, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D4j, ^D4n, ^D4r, ^D4y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D6a, ^D6k, ^D7e
^B1e, ^B2a, ^B2k, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B4j, ^B4n, ^B4r, ^B4y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B6a, ^B6k, ^B7e, ^S1e, ^S2a, ^S2k, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S4j, ^S4n, ^S4r, ^S4y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S6a, ^S6k, ^S7e, ^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8, ^D0, ^D1c, ^D2c, ^D2e, ^D2i, ^D2n, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D6c, ^D6e, ^D6i, ^D6n, ^D7c, ^D8
^B1e, ^B3e, ^B3q, ^B5e, ^B5q, ^B7e, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^B1e, ^B3e, ^B3q, ^B5e, ^B5q, ^B7e, ^S0, ^S2e, ^S2i, ^S2n, ^S4c, ^S4e, ^S4q, ^S4w, ^S4z, ^S6e, ^S6i, ^S6n, ^S8, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3q, ^D5e, ^D5q, ^D7e
^B1e, ^B3e, ^B3q, ^B5e, ^B5q, ^B7e, ^S1e, ^S3e, ^S3q, ^S5e, ^S5q, ^S7e, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2e, ^D2i, ^D2n, ^D4c, ^D4e, ^D4q, ^D4w, ^D4z, ^D6e, ^D6i, ^D6n, ^D8
^B1e, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B7e, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^B1e, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B7e, ^S0, ^S2c, ^S2e, ^S2i, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S6c, ^S6e, ^S6i, ^S6n, ^S8, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D7e
^B1e, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B7e, ^S1e, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S7e, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2e, ^D2i, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D6c, ^D6e, ^D6i, ^D6n, ^D8
^B1e, ^B3e, ^B5e, ^B7e, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^B1e, ^B3e, ^B5e, ^B7e, ^S0, ^S2e, ^S2i, ^S4c, ^S4e, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D1e, ^D3e, ^D5e, ^D7e
^B1e, ^B3e, ^B5e, ^B7e, ^S1e, ^S3e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D0, ^D2e, ^D2i, ^D4c, ^D4e, ^D6e, ^D6i, ^D8
^B1e, ^B3e, ^S0, ^S2e, ^S2i, ^S4e, ^A2e, ^A2i, ^A4e, ^D1e, ^D3e
^B1e, ^B3e, ^S1e, ^S3e, ^A2e, ^A2i, ^A4e, ^D0, ^D2e, ^D2i, ^D4e
^B1e, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B7e, ^S1c, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S7c, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D2a, ^D2k, ^D4j, ^D4n, ^D4r, ^D4y, ^D6a, ^D6k
^B1e, ^B3e, ^B3q, ^B5e, ^B5q, ^B7e, ^S2c, ^S4a, ^S4i, ^S4k, ^S4t, ^S6c, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D3i, ^D3n, ^D3y, ^D5i, ^D5n, ^D5y
^B1e, ^B3e, ^B3i, ^B3n, ^B3q, ^B3y, ^B5e, ^B5i, ^B5n, ^B5q, ^B5y, ^B7e, ^S2a, ^S2k, ^S4j, ^S4n, ^S4r, ^S4y, ^S6a, ^S6k, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1c, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D7c
^B1e, ^B3e, ^B5e, ^B7e, ^S2n, ^S4q, ^S4w, ^S4z, ^S6n, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D3q, ^D5q
^B1e, ^B3e, ^B5e, ^B7e, ^S3q, ^S5q, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D2n, ^D4q, ^D4w, ^D4z, ^D6n
^B1e, ^B3e, ^B3q, ^B5e, ^B5q, ^B7e, ^S3i, ^S3n, ^S3y, ^S5i, ^S5n, ^S5y, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D2c, ^D4a, ^D4i, ^D4k, ^D4t, ^D6c
^B1e, ^B3e, ^S4c, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4e, ^D5e, ^D7e
^B1e, ^B3e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4e, ^D4c, ^D6e, ^D6i, ^D8
^B1c, ^B3c, ^A2c, ^A2n, ^A4c
^B1c, ^B1e, ^B3a, ^B3c, ^B3e, ^B3i, ^B3j, ^B3k, ^B3n, ^B3q, ^B3r, ^B3y, ^B5a, ^B5c, ^B5e, ^B5i, ^B5j, ^B5k, ^B5n, ^B5q, ^B5r, ^B5y, ^B7c, ^B7e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8
^B1c, ^B1e, ^B3a, ^B3c, ^B3e, ^B3i, ^B3j, ^B3k, ^B3n, ^B3q, ^B3r, ^B3y, ^B5a, ^B5c, ^B5e, ^B5i, ^B5j, ^B5k, ^B5n, ^B5q, ^B5r, ^B5y, ^B7c, ^B7e, ^S0, ^S2a, ^S2c, ^S2e, ^S2i, ^S2k, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4j, ^S4k, ^S4n, ^S4q, ^S4r, ^S4t, ^S4w, ^S4y, ^S4z, ^S6a, ^S6c, ^S6e, ^S6i, ^S6k, ^S6n, ^S8, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8, ^D1c, ^D1e, ^D3a, ^D3c, ^D3e, ^D3i, ^D3j, ^D3k, ^D3n, ^D3q, ^D3r, ^D3y, ^D5a, ^D5c, ^D5e, ^D5i, ^D5j, ^D5k, ^D5n, ^D5q, ^D5r, ^D5y, ^D7c, ^D7e
^B1c, ^B1e, ^B3a, ^B3c, ^B3e, ^B3i, ^B3j, ^B3k, ^B3n, ^B3q, ^B3r, ^B3y, ^B5a, ^B5c, ^B5e, ^B5i, ^B5j, ^B5k, ^B5n, ^B5q, ^B5r, ^B5y, ^B7c, ^B7e, ^S1c, ^S1e, ^S3a, ^S3c, ^S3e, ^S3i, ^S3j, ^S3k, ^S3n, ^S3q, ^S3r, ^S3y, ^S5a, ^S5c, ^S5e, ^S5i, ^S5j, ^S5k, ^S5n, ^S5q, ^S5r, ^S5y, ^S7c, ^S7e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8, ^D0, ^D2a, ^D2c, ^D2e, ^D2i, ^D2k, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4j, ^D4k, ^D4n, ^D4q, ^D4r, ^D4t, ^D4w, ^D4y, ^D4z, ^D6a, ^D6c, ^D6e, ^D6i, ^D6k, ^D6n, ^D8
^B1c, ^B2a, ^B2k, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B4j, ^B4n, ^B4r, ^B4y, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B6a, ^B6k, ^B7c, ^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^B1c, ^B2a, ^B2k, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B4j, ^B4n, ^B4r, ^B4y, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B6a, ^B6k, ^B7c, ^S0, ^S1e, ^S2c, ^S2e, ^S2i, ^S2n, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S6c, ^S6e, ^S6i, ^S6n, ^S7e, ^S8, ^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D1c, ^D2a, ^D2k, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D4j, ^D4n, ^D4r, ^D4y, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D6a, ^D6k, ^D7c
^B1c, ^B2a, ^B2k, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B4j, ^B4n, ^B4r, ^B4y, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B6a, ^B6k, ^B7c, ^S1c, ^S2a, ^S2k, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S4j, ^S4n, ^S4r, ^S4y, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S6a, ^S6k, ^S7c, ^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D0, ^D1e, ^D2c, ^D2e, ^D2i, ^D2n, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D6c, ^D6e, ^D6i, ^D6n, ^D7e, ^D8
^B1c, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B7c, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^B1c, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B7c, ^S0, ^S2c, ^S2e, ^S2i, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S6c, ^S6e, ^S6i, ^S6n, ^S8, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1c, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D7c
^B1c, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B7c, ^S1c, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S7c, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2e, ^D2i, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D6c, ^D6e, ^D6i, ^D6n, ^D8
^B1c, ^B3c, ^B3r, ^B5c, ^B5r, ^B7c, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^B1c, ^B3c, ^B3r, ^B5c, ^B5r, ^B7c, ^S0, ^S2c, ^S2i, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S4z, ^S6c, ^S6i, ^S6n, ^S8, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D1c, ^D3c, ^D3r, ^D5c, ^D5r, ^D7c
^B1c, ^B3c, ^B3r, ^B5c, ^B5r, ^B7c, ^S1c, ^S3c, ^S3r, ^S5c, ^S5r, ^S7c, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2i, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D4z, ^D6c, ^D6i, ^D6n, ^D8
^B1c, ^B3c, ^B5c, ^B7c, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^B1c, ^B3c, ^B5c, ^B7c, ^S0, ^S2c, ^S2n, ^S4c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D1c, ^D3c, ^D5c, ^D7c
^B1c, ^B3c, ^B5c, ^B7c, ^S1c, ^S3c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D0, ^D2c, ^D2n, ^D4c, ^D4e, ^D6c, ^D6n, ^D8
^B1c, ^B3c, ^S0, ^S2c, ^S2n, ^S4c, ^A2c, ^A2n, ^A4c, ^D1c, ^D3c
^B1c, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B7c, ^S1e, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S7e, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D2a, ^D2k, ^D4j, ^D4n, ^D4r, ^D4y, ^D6a, ^D6k
^B1c, ^B3c, ^S1c, ^S3c, ^A2c, ^A2n, ^A4c, ^D0, ^D2c, ^D2n, ^D4c
^B1c, ^B3a, ^B3c, ^B3j, ^B3k, ^B3r, ^B5a, ^B5c, ^B5j, ^B5k, ^B5r, ^B7c, ^S2a, ^S2k, ^S4j, ^S4n, ^S4r, ^S4y, ^S6a, ^S6k, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D7e
^B1c, ^B3c, ^B3r, ^B5c, ^B5r, ^B7c, ^S2e, ^S4a, ^S4k, ^S4q, ^S4w, ^S6e, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D3a, ^D3j, ^D3k, ^D5a, ^D5j, ^D5k
^B1c, ^B3c, ^B3r, ^B5c, ^B5r, ^B7c, ^S3a, ^S3j, ^S3k, ^S5a, ^S5j, ^S5k, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D2e, ^D4a, ^D4k, ^D4q, ^D4w, ^D6e
^B1c, ^B3c, ^B5c, ^B7c, ^S2i, ^S4i, ^S4t, ^S4z, ^S6i, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D3r, ^D5r
^B1c, ^B3c, ^B5c, ^B7c, ^S3r, ^S5r, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D2i, ^D4i, ^D4t, ^D4z, ^D6i
^B1c, ^B3c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^D5c, ^D7c
^B1c, ^B3c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^D4e, ^D6c, ^D6n, ^D8
^B2a, ^B2k, ^B4j, ^B4n, ^B4r, ^B4y, ^B6a, ^B6k, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^B2a, ^B2k, ^B4j, ^B4n, ^B4r, ^B4y, ^B6a, ^B6k, ^S0, ^S2c, ^S2e, ^S2i, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S6c, ^S6e, ^S6i, ^S6n, ^S8, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D2a, ^D2k, ^D4j, ^D4n, ^D4r, ^D4y, ^D6a, ^D6k
^B2a, ^B2k, ^B4j, ^B4n, ^B4r, ^B4y, ^B6a, ^B6k, ^S1e, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S7e, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1c, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D7c
^B2a, ^B2k, ^B4j, ^B4n, ^B4r, ^B4y, ^B6a, ^B6k, ^S1c, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S7c, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D7e
^B2a, ^B2k, ^B4j, ^B4n, ^B4r, ^B4y, ^B6a, ^B6k, ^S2a, ^S2k, ^S4j, ^S4n, ^S4r, ^S4y, ^S6a, ^S6k, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2e, ^D2i, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D6c, ^D6e, ^D6i, ^D6n, ^D8
^B3n, ^B5n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^B3n, ^B5n, ^S0, ^S2i, ^S4c, ^S4e, ^S4q, ^S4w, ^S6i, ^S8, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3n, ^D5n
^B3n, ^B5n, ^S2e, ^S2n, ^S4z, ^S6e, ^S6n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3i, ^D3y, ^D5i, ^D5y
^B3n, ^B5n, ^S3n, ^S5n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D0, ^D2i, ^D4c, ^D4e, ^D4q, ^D4w, ^D6i, ^D8
^B3n, ^B5n, ^S3i, ^S3y, ^S5i, ^S5y, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D2e, ^D2n, ^D4z, ^D6e, ^D6n
^B3a, ^B5k, ^A4c, ^A4i, ^A6n
^B3a, ^B3k, ^B5a, ^B5k, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^B3a, ^B3k, ^B5a, ^B5k, ^S0, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S6n, ^S8, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3a, ^D3k, ^D5a, ^D5k
^B3a, ^B3k, ^B5a, ^B5k, ^S3a, ^S3k, ^S5a, ^S5k, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D0, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D6n, ^D8
^B3a, ^B3j, ^B3k, ^B5a, ^B5j, ^B5k, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^B3a, ^B3j, ^B3k, ^B5a, ^B5j, ^B5k, ^S0, ^S2c, ^S2i, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S4z, ^S6c, ^S6i, ^S6n, ^S8, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D3a, ^D3j, ^D3k, ^D5a, ^D5j, ^D5k
^B3a, ^B3j, ^B3k, ^B5a, ^B5j, ^B5k, ^S3a, ^S3j, ^S3k, ^S5a, ^S5j, ^S5k, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2i, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D4z, ^D6c, ^D6i, ^D6n, ^D8
^B3a, ^B5k, ^S0, ^S4c, ^S4i, ^S6n, ^A4c, ^A4i, ^A6n, ^D3a, ^D5k
^B3a, ^B3j, ^B3k, ^B5a, ^B5j, ^B5k, ^S1c, ^S3c, ^S3r, ^S5c, ^S5r, ^S7c, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D2e, ^D4a, ^D4k, ^D4q, ^D4w, ^D6e
^B3a, ^B3k, ^B5a, ^B5k, ^S2c, ^S2i, ^S4z, ^S6c, ^S6i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3j, ^D5j
^B3a, ^B3j, ^B3k, ^B5a, ^B5j, ^B5k, ^S2e, ^S4a, ^S4k, ^S4q, ^S4w, ^S6e, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D1c, ^D3c, ^D3r, ^D5c, ^D5r, ^D7c
^B3a, ^B5k, ^S3a, ^S5k, ^A4c, ^A4i, ^A6n, ^D0, ^D4c, ^D4i, ^D6n
^B3a, ^B5k, ^S2n, ^S4e, ^S4t, ^S8, ^A4c, ^A4i, ^A6n, ^D3k, ^D5a
^B3a, ^B5k, ^S3k, ^S5a, ^A4c, ^A4i, ^A6n, ^D2n, ^D4e, ^D4t, ^D8
^B3a, ^B3k, ^B5a, ^B5k, ^S3j, ^S5j, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D2c, ^D2i, ^D4z, ^D6c, ^D6i
^B3k, ^B5a, ^A4c, ^A4i, ^A6n
^B3k, ^B5a, ^S0, ^S4c, ^S4i, ^S6n, ^A4c, ^A4i, ^A6n, ^D3k, ^D5a
^B3k, ^B5a, ^S3a, ^S5k, ^A4c, ^A4i, ^A6n, ^D2n, ^D4e, ^D4t, ^D8
^B3k, ^B5a, ^S2n, ^S4e, ^S4t, ^S8, ^A4c, ^A4i, ^A6n, ^D3a, ^D5k
^B3k, ^B5a, ^S3k, ^S5a, ^A4c, ^A4i, ^A6n, ^D0, ^D4c, ^D4i, ^D6n
^B3q, ^B5q, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^B3q, ^B5q, ^S0, ^S2e, ^S2i, ^S4c, ^S4e, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D3q, ^D5q
^B3q, ^B5q, ^S1e, ^S3e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D2n, ^D4q, ^D4w, ^D4z, ^D6n
^B3q, ^B5q, ^S2n, ^S4q, ^S4w, ^S4z, ^S6n, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D1e, ^D3e, ^D5e, ^D7e
^B3q, ^B5q, ^S3q, ^S5q, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D0, ^D2e, ^D2i, ^D4c, ^D4e, ^D6e, ^D6i, ^D8
^B3r, ^B5r, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^B3r, ^B5r, ^S0, ^S2c, ^S2n, ^S4c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D3r, ^D5r
^B3r, ^B5r, ^S1c, ^S3c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D2i, ^D4i, ^D4t, ^D4z, ^D6i
^B3r, ^B5r, ^S2i, ^S4i, ^S4t, ^S4z, ^S6i, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D1c, ^D3c, ^D5c, ^D7c
^B3r, ^B5r, ^S3r, ^S5r, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D0, ^D2c, ^D2n, ^D4c, ^D4e, ^D6c, ^D6n, ^D8
^B3y, ^B5i, ^A4e, ^A4w, ^A6i
^B3y, ^B5i, ^S0, ^S4e, ^S4w, ^S6i, ^A4e, ^A4w, ^A6i, ^D3y, ^D5i
^B3y, ^B5i, ^S2i, ^S4c, ^S4q, ^S8, ^A4e, ^A4w, ^A6i, ^D3i, ^D5y
^B3y, ^B5i, ^S3y, ^S5i, ^A4e, ^A4w, ^A6i, ^D0, ^D4e, ^D4w, ^D6i
^B3y, ^B5i, ^S3i, ^S5y, ^A4e, ^A4w, ^A6i, ^D2i, ^D4c, ^D4q, ^D8
^B3j, ^B5j, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^B3j, ^B5j, ^S0, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S6n, ^S8, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3j, ^D5j
^B3j, ^B5j, ^S2c, ^S2i, ^S4z, ^S6c, ^S6i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3a, ^D3k, ^D5a, ^D5k
^B3j, ^B5j, ^S3a, ^S3k, ^S5a, ^S5k, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D2c, ^D2i, ^D4z, ^D6c, ^D6i
^B3j, ^B5j, ^S3j, ^S5j, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D0, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D6n, ^D8
^B3i, ^B5y, ^A4e, ^A4w, ^A6i
^B3i, ^B3n, ^B3y, ^B5i, ^B5n, ^B5y, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^B3i, ^B3n, ^B3y, ^B5i, ^B5n, ^B5y, ^S0, ^S2e, ^S2i, ^S2n, ^S4c, ^S4e, ^S4q, ^S4w, ^S4z, ^S6e, ^S6i, ^S6n, ^S8, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D3i, ^D3n, ^D3y, ^D5i, ^D5n, ^D5y
^B3i, ^B3n, ^B3y, ^B5i, ^B5n, ^B5y, ^S3i, ^S3n, ^S3y, ^S5i, ^S5n, ^S5y, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2e, ^D2i, ^D2n, ^D4c, ^D4e, ^D4q, ^D4w, ^D4z, ^D6e, ^D6i, ^D6n, ^D8
^B3i, ^B3y, ^B5i, ^B5y, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^B3i, ^B3y, ^B5i, ^B5y, ^S0, ^S2i, ^S4c, ^S4e, ^S4q, ^S4w, ^S6i, ^S8, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3i, ^D3y, ^D5i, ^D5y
^B3i, ^B3y, ^B5i, ^B5y, ^S3i, ^S3y, ^S5i, ^S5y, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D0, ^D2i, ^D4c, ^D4e, ^D4q, ^D4w, ^D6i, ^D8
^B3i, ^B5y, ^S0, ^S4e, ^S4w, ^S6i, ^A4e, ^A4w, ^A6i, ^D3i, ^D5y
^B3i, ^B3n, ^B3y, ^B5i, ^B5n, ^B5y, ^S1e, ^S3e, ^S3q, ^S5e, ^S5q, ^S7e, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D2c, ^D4a, ^D4i, ^D4k, ^D4t, ^D6c
^B3i, ^B3n, ^B3y, ^B5i, ^B5n, ^B5y, ^S2c, ^S4a, ^S4i, ^S4k, ^S4t, ^S6c, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3q, ^D5e, ^D5q, ^D7e
^B3i, ^B3y, ^B5i, ^B5y, ^S2e, ^S2n, ^S4z, ^S6e, ^S6n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3n, ^D5n
^B3i, ^B3y, ^B5i, ^B5y, ^S3n, ^S5n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D2e, ^D2n, ^D4z, ^D6e, ^D6n
^B3i, ^B5y, ^S2i, ^S4c, ^S4q, ^S8, ^A4e, ^A4w, ^A6i, ^D3y, ^D5i
^B3i, ^B5y, ^S3y, ^S5i, ^A4e, ^A4w, ^A6i, ^D2i, ^D4c, ^D4q, ^D8
^B3i, ^B5y, ^S3i, ^S5y, ^A4e, ^A4w, ^A6i, ^D0, ^D4e, ^D4w, ^D6i
^B5c, ^B7c, ^A2c, ^A2n, ^A4c
^B5c, ^B7c, ^S0, ^S2c, ^S2n, ^S4c, ^A2c, ^A2n, ^A4c, ^D5c, ^D7c
^B5c, ^B7c, ^S1c, ^S3c, ^A2c, ^A2n, ^A4c, ^D4e, ^D6c, ^D6n, ^D8
^B5c, ^B7c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^D1c, ^D3c
^B5c, ^B7c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^D0, ^D2c, ^D2n, ^D4c
^B5e, ^B7e, ^A2e, ^A2i, ^A4e
^B5e, ^B7e, ^S0, ^S2e, ^S2i, ^S4e, ^A2e, ^A2i, ^A4e, ^D5e, ^D7e
^B5e, ^B7e, ^S1e, ^S3e, ^A2e, ^A2i, ^A4e, ^D4c, ^D6e, ^D6i, ^D8
^B5e, ^B7e, ^S4c, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4e, ^D1e, ^D3e
^B5e, ^B7e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4e, ^D0, ^D2e, ^D2i, ^D4e
^S0
^S0, ^S1e, ^S2e, ^S2i, ^S3e, ^S4e, ^A1e, ^A2e, ^A2i, ^A3e, ^A4e
^S0, ^S1e, ^S2c, ^S2e, ^S2i, ^S2n, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S6c, ^S6e, ^S6i, ^S6n, ^S7e, ^S8, ^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^S0, ^S1e, ^S2e, ^S2i, ^S2n, ^S3e, ^S3q, ^S4c, ^S4e, ^S4q, ^S4w, ^S4z, ^S5e, ^S5q, ^S6e, ^S6i, ^S6n, ^S7e, ^S8, ^A1e, ^A2e, ^A2i, ^A2n, ^A3e, ^A3q, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5e, ^A5q, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^S0, ^S1e, ^S2e, ^S2i, ^S3e, ^S4c, ^S4e, ^S5e, ^S6e, ^S6i, ^S7e, ^S8, ^A1e, ^A2e, ^A2i, ^A3e, ^A4c, ^A4e, ^A5e, ^A6e, ^A6i, ^A7e, ^A8
^S0, ^S1c, ^S2c, ^S2n, ^S3c, ^S4c, ^A1c, ^A2c, ^A2n, ^A3c, ^A4c
^S0, ^S1c, ^S1e, ^S2a, ^S2c, ^S2e, ^S2i, ^S2k, ^S2n, ^S3a, ^S3c, ^S3e, ^S3i, ^S3j, ^S3k, ^S3n, ^S3q, ^S3r, ^S3y, ^S4a, ^S4c, ^S4e, ^S4i, ^S4j, ^S4k, ^S4n, ^S4q, ^S4r, ^S4t, ^S4w, ^S4y, ^S4z, ^S5a, ^S5c, ^S5e, ^S5i, ^S5j, ^S5k, ^S5n, ^S5q, ^S5r, ^S5y, ^S6a, ^S6c, ^S6e, ^S6i, ^S6k, ^S6n, ^S7c, ^S7e, ^S8, ^A1c, ^A1e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A3a, ^A3c, ^A3e, ^A3i, ^A3j, ^A3k, ^A3n, ^A3q, ^A3r, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A5a, ^A5c, ^A5e, ^A5i, ^A5j, ^A5k, ^A5n, ^A5q, ^A5r, ^A5y, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A7c, ^A7e, ^A8
^S0, ^S1c, ^S2c, ^S2e, ^S2i, ^S2n, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S6c, ^S6e, ^S6i, ^S6n, ^S7c, ^S8, ^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8
^S0, ^S1c, ^S2c, ^S2i, ^S2n, ^S3c, ^S3r, ^S4c, ^S4e, ^S4i, ^S4t, ^S4z, ^S5c, ^S5r, ^S6c, ^S6i, ^S6n, ^S7c, ^S8, ^A1c, ^A2c, ^A2i, ^A2n, ^A3c, ^A3r, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5c, ^A5r, ^A6c, ^A6i, ^A6n, ^A7c, ^A8
^S0, ^S1c, ^S2c, ^S2n, ^S3c, ^S4c, ^S4e, ^S5c, ^S6c, ^S6n, ^S7c, ^S8, ^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^A4e, ^A5c, ^A6c, ^A6n, ^A7c, ^A8
^S0, ^S2c, ^S2n, ^S4c, ^A2c, ^A2n, ^A4c
^S0, ^S2c, ^S2e, ^S2i, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4k, ^S4q, ^S4t, ^S4w, ^S4z, ^S6c, ^S6e, ^S6i, ^S6n, ^S8, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^S0, ^S2c, ^S2i, ^S2n, ^S3a, ^S3j, ^S3k, ^S4c, ^S4e, ^S4i, ^S4t, ^S4z, ^S5a, ^S5j, ^S5k, ^S6c, ^S6i, ^S6n, ^S8, ^A2c, ^A2i, ^A2n, ^A3a, ^A3j, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5a, ^A5j, ^A5k, ^A6c, ^A6i, ^A6n, ^A8
^S0, ^S2c, ^S2i, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S4z, ^S6c, ^S6i, ^S6n, ^S8, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^S0, ^S2c, ^S2n, ^S4c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^S0, ^S2a, ^S2c, ^S2e, ^S2i, ^S2k, ^S2n, ^S4a, ^S4c, ^S4e, ^S4i, ^S4j, ^S4k, ^S4n, ^S4q, ^S4r, ^S4t, ^S4w, ^S4y, ^S4z, ^S6a, ^S6c, ^S6e, ^S6i, ^S6k, ^S6n, ^S8, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8
^S0, ^S2e, ^S2i, ^S4e, ^A2e, ^A2i, ^A4e
^S0, ^S2e, ^S2i, ^S2n, ^S4c, ^S4e, ^S4q, ^S4w, ^S4z, ^S6e, ^S6i, ^S6n, ^S8, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^S0, ^S2e, ^S2i, ^S2n, ^S3i, ^S3n, ^S3y, ^S4c, ^S4e, ^S4q, ^S4w, ^S4z, ^S5i, ^S5n, ^S5y, ^S6e, ^S6i, ^S6n, ^S8, ^A2e, ^A2i, ^A2n, ^A3i, ^A3n, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5i, ^A5n, ^A5y, ^A6e, ^A6i, ^A6n, ^A8
^S0, ^S2e, ^S2i, ^S4c, ^S4e, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^S0, ^S2i, ^S3n, ^S4c, ^S4e, ^S4q, ^S4w, ^S5n, ^S6i, ^S8, ^A2i, ^A3n, ^A4c, ^A4e, ^A4q, ^A4w, ^A5n, ^A6i, ^A8
^S0, ^S3a, ^S4c, ^S4i, ^S5k, ^S6n, ^A3a, ^A4c, ^A4i, ^A5k, ^A6n
^S0, ^S4c, ^S4i, ^S6n, ^A4c, ^A4i, ^A6n
^S0, ^S2n, ^S4c, ^A2n, ^A4c
^S0, ^S2n, ^S3a, ^S3k, ^S4c, ^S4e, ^S4i, ^S4t, ^S5a, ^S5k, ^S6n, ^S8, ^A2n, ^A3a, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A5a, ^A5k, ^A6n, ^A8
^S0, ^S2n, ^S4c, ^S4e, ^S4i, ^S4t, ^S6n, ^S8, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^S0, ^S2n, ^S4c, ^S4e, ^S6n, ^S8, ^A2n, ^A4c, ^A4e, ^A6n, ^A8
^S0, ^S3k, ^S4c, ^S4i, ^S5a, ^S6n, ^A3k, ^A4c, ^A4i, ^A5a, ^A6n
^S0, ^S2e, ^S2i, ^S3q, ^S4c, ^S4e, ^S5q, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A3q, ^A4c, ^A4e, ^A5q, ^A6e, ^A6i, ^A8
^S0, ^S4e, ^S4q, ^S6i, ^A4e, ^A4q, ^A6i
^S0, ^S2i, ^S4e, ^A2i, ^A4e
^S0, ^S2i, ^S2n, ^S4c, ^S4e, ^S4z, ^S6i, ^S6n, ^S8, ^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8
^S0, ^S2i, ^S4c, ^S4e, ^S4q, ^S4w, ^S6i, ^S8, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^S0, ^S2i, ^S3i, ^S3y, ^S4c, ^S4e, ^S4q, ^S4w, ^S5i, ^S5y, ^S6i, ^S8, ^A2i, ^A3i, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A5i, ^A5y, ^A6i, ^A8
^S0, ^S2i, ^S4c, ^S4e, ^S6i, ^S8, ^A2i, ^A4c, ^A4e, ^A6i, ^A8
^S0, ^S2c, ^S2n, ^S3r, ^S4c, ^S4e, ^S5r, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A3r, ^A4c, ^A4e, ^A5r, ^A6c, ^A6n, ^A8
^S0, ^S3y, ^S4e, ^S4w, ^S5i, ^S6i, ^A3y, ^A4e, ^A4w, ^A5i, ^A6i
^S0, ^S4c, ^S4t, ^S6n, ^A4c, ^A4t, ^A6n
^S0, ^S2n, ^S3j, ^S4c, ^S4e, ^S4i, ^S4t, ^S5j, ^S6n, ^S8, ^A2n, ^A3j, ^A4c, ^A4e, ^A4i, ^A4t, ^A5j, ^A6n, ^A8
^S0, ^S4e, ^A4e
^S0, ^S4c, ^S4e, ^S4z, ^S8, ^A4c, ^A4e, ^A4z, ^A8
^S0, ^S4e, ^S4w, ^S6i, ^A4e, ^A4w, ^A6i
^S0, ^S3i, ^S4e, ^S4w, ^S5y, ^S6i, ^A3i, ^A4e, ^A4w, ^A5y, ^A6i
^S0, ^S4c, ^A4c
^S0, ^S4c, ^S4e, ^S8, ^A4c, ^A4e, ^A8
^S0, ^S4e, ^S6i, ^A4e, ^A6i
^S0, ^S2i, ^S2n, ^S4a, ^S4c, ^S4e, ^S4k, ^S4z, ^S6i, ^S6n, ^S8, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4k, ^A4z, ^A6i, ^A6n, ^A8
^S0, ^S2c, ^S2n, ^S4c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^A5c, ^A7c
^S0, ^S4c, ^S6n, ^A4c, ^A6n
^S0, ^S2e, ^S2i, ^S4e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4e, ^A5e, ^A7e
^S0, ^S2i, ^S4e, ^S6e, ^A2i, ^A4e, ^A6e
^S0, ^S2n, ^S4c, ^S6c, ^A2n, ^A4c, ^A6c
^S0, ^S8, ^A8
^S1e, ^S3e, ^A2e, ^A2i, ^A4e
^S1e, ^S2c, ^S3e, ^S3q, ^S4a, ^S4i, ^S4k, ^S4t, ^S5e, ^S5q, ^S6c, ^S7e, ^A2e, ^A2i, ^A2n, ^A3i, ^A3n, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5i, ^A5n, ^A5y, ^A6e, ^A6i, ^A6n, ^A8
^S1e, ^S2a, ^S2k, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S4j, ^S4n, ^S4r, ^S4y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S6a, ^S6k, ^S7e, ^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8
^S1e, ^S2n, ^S3e, ^S4q, ^S4w, ^S4z, ^S5e, ^S6n, ^S7e, ^A2e, ^A2i, ^A3q, ^A4c, ^A4e, ^A5q, ^A6e, ^A6i, ^A8
^S1e, ^S3e, ^S3q, ^S5e, ^S5q, ^S7e, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^S1e, ^S3e, ^S3i, ^S3n, ^S3q, ^S3y, ^S5e, ^S5i, ^S5n, ^S5q, ^S5y, ^S7e, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^S1e, ^S3e, ^S4c, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4e, ^A5e, ^A7e
^S1e, ^S3e, ^S5e, ^S7e, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^S1c, ^S3c, ^A2c, ^A2n, ^A4c
^S1c, ^S1e, ^S3a, ^S3c, ^S3e, ^S3i, ^S3j, ^S3k, ^S3n, ^S3q, ^S3r, ^S3y, ^S5a, ^S5c, ^S5e, ^S5i, ^S5j, ^S5k, ^S5n, ^S5q, ^S5r, ^S5y, ^S7c, ^S7e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8
^S1c, ^S2a, ^S2k, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S4j, ^S4n, ^S4r, ^S4y, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S6a, ^S6k, ^S7c, ^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^S1c, ^S2e, ^S3c, ^S3r, ^S4a, ^S4k, ^S4q, ^S4w, ^S5c, ^S5r, ^S6e, ^S7c, ^A2c, ^A2i, ^A2n, ^A3a, ^A3j, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5a, ^A5j, ^A5k, ^A6c, ^A6i, ^A6n, ^A8
^S1c, ^S3a, ^S3c, ^S3j, ^S3k, ^S3r, ^S5a, ^S5c, ^S5j, ^S5k, ^S5r, ^S7c, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^S1c, ^S2i, ^S3c, ^S4i, ^S4t, ^S4z, ^S5c, ^S6i, ^S7c, ^A2c, ^A2n, ^A3r, ^A4c, ^A4e, ^A5r, ^A6c, ^A6n, ^A8
^S1c, ^S3c, ^S3r, ^S5c, ^S5r, ^S7c, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^S1c, ^S3c, ^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c, ^A5c, ^A7c
^S1c, ^S3c, ^S5c, ^S7c, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^S2c, ^A2n, ^A4c
^S2c, ^S2e, ^S4i, ^S4q, ^S4t, ^S4w, ^S6c, ^S6e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4k, ^A4z, ^A6i, ^A6n, ^A8
^S2c, ^S2i, ^S3a, ^S3k, ^S4z, ^S5a, ^S5k, ^S6c, ^S6i, ^A2n, ^A3j, ^A4c, ^A4e, ^A4i, ^A4t, ^A5j, ^A6n, ^A8
^S2c, ^S4i, ^S4t, ^S6c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8
^S2c, ^S2i, ^S4z, ^S6c, ^S6i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^S2c, ^S2i, ^S3j, ^S4z, ^S5j, ^S6c, ^S6i, ^A2n, ^A3a, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A5a, ^A5k, ^A6n, ^A8
^S2c, ^S4e, ^S6n, ^S8, ^A2n, ^A4c, ^A6c
^S2c, ^S3i, ^S3n, ^S3y, ^S4a, ^S4i, ^S4k, ^S4t, ^S5i, ^S5n, ^S5y, ^S6c, ^A1e, ^A2e, ^A2i, ^A2n, ^A3e, ^A3q, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5e, ^A5q, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^S2c, ^S4a, ^S4i, ^S4k, ^S4t, ^S6c, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^S2c, ^S6c, ^A2n, ^A4c, ^A4e, ^A6n, ^A8
^S2a, ^S2k, ^S4j, ^S4n, ^S4r, ^S4y, ^S6a, ^S6k, ^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^S2e, ^A2i, ^A4e
^S2e, ^S2n, ^S3n, ^S4z, ^S5n, ^S6e, ^S6n, ^A2i, ^A3i, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A5i, ^A5y, ^A6i, ^A8
^S2e, ^S3a, ^S3j, ^S3k, ^S4a, ^S4k, ^S4q, ^S4w, ^S5a, ^S5j, ^S5k, ^S6e, ^A1c, ^A2c, ^A2i, ^A2n, ^A3c, ^A3r, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5c, ^A5r, ^A6c, ^A6i, ^A6n, ^A7c, ^A8
^S2e, ^S2n, ^S4z, ^S6e, ^S6n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^S2e, ^S4q, ^S4w, ^S6e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8
^S2e, ^S2n, ^S3i, ^S3y, ^S4z, ^S5i, ^S5y, ^S6e, ^S6n, ^A2i, ^A3n, ^A4c, ^A4e, ^A4q, ^A4w, ^A5n, ^A6i, ^A8
^S2e, ^S4c, ^S6i, ^S8, ^A2i, ^A4e, ^A6e
^S2e, ^S4a, ^S4k, ^S4q, ^S4w, ^S6e, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^S2e, ^S6e, ^A2i, ^A4c, ^A4e, ^A6i, ^A8
^S3n, ^S5n, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^S3a, ^S5k, ^A4c, ^A4i, ^A6n
^S3a, ^S3k, ^S5a, ^S5k, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^S3a, ^S3j, ^S3k, ^S5a, ^S5j, ^S5k, ^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^S4i, ^A4c, ^A6n
^S4i, ^S4t, ^A2n, ^A4c, ^A4e, ^A6n, ^A8
^S2n, ^A4c
^S2n, ^S3a, ^S4e, ^S4t, ^S5k, ^S8, ^A3k, ^A4c, ^A4i, ^A5a, ^A6n
^S2n, ^S4e, ^S4i, ^S8, ^A4c, ^A4t, ^A6n
^S2n, ^S3k, ^S4e, ^S4t, ^S5a, ^S8, ^A3a, ^A4c, ^A4i, ^A5k, ^A6n
^S2n, ^S3q, ^S4q, ^S4w, ^S4z, ^S5q, ^S6n, ^A1e, ^A2e, ^A2i, ^A3e, ^A4c, ^A4e, ^A5e, ^A6e, ^A6i, ^A7e, ^A8
^S2n, ^S4q, ^S4w, ^S4z, ^S6n, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^S2n, ^S4e, ^S4t, ^S8, ^A4c, ^A4i, ^A6n
^S2n, ^S4e, ^S8, ^A4c, ^A6n
^S2n, ^S4z, ^S6n, ^A2i, ^A4c, ^A4e, ^A6i, ^A8
^S2n, ^S6n, ^A4c, ^A4e, ^A8
^S3k, ^S5a, ^A4c, ^A4i, ^A6n
^S3q, ^S5q, ^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^S4q, ^A4e, ^A6i
^S4q, ^S4w, ^A2i, ^A4c, ^A4e, ^A6i, ^A8
^S2i, ^A4e
^S2i, ^S4i, ^S4t, ^S4z, ^S6i, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^S2i, ^S2n, ^S6i, ^S6n, ^A4c, ^A4e, ^A4z, ^A8
^S2i, ^S4c, ^S4q, ^S8, ^A4e, ^A4w, ^A6i
^S2i, ^S3r, ^S4i, ^S4t, ^S4z, ^S5r, ^S6i, ^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^A4e, ^A5c, ^A6c, ^A6n, ^A7c, ^A8
^S2i, ^S3y, ^S4c, ^S4q, ^S5i, ^S8, ^A3i, ^A4e, ^A4w, ^A5y, ^A6i
^S2i, ^S4z, ^S6i, ^A2n, ^A4c, ^A4e, ^A6n, ^A8
^S2i, ^S4c, ^S4w, ^S8, ^A4e, ^A4q, ^A6i
^S2i, ^S3i, ^S4c, ^S4q, ^S5y, ^S8, ^A3y, ^A4e, ^A4w, ^A5i, ^A6i
^S2i, ^S4c, ^S8, ^A4e, ^A6i
^S2i, ^S6i, ^A4c, ^A4e, ^A8
^S3r, ^S5r, ^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^S3y, ^S5i, ^A4e, ^A4w, ^A6i
^S4t, ^A4c, ^A6n
^S3j, ^S5j, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^S4e
^S4e, ^S5c, ^S6c, ^S6n, ^S7c, ^S8, ^A1c, ^A2c, ^A2n, ^A3c, ^A4c
^S4e, ^S6n, ^S8, ^A2n, ^A4c
^S4e, ^S6c, ^S6n, ^S8, ^A2c, ^A2n, ^A4c
^S4e, ^S8, ^A4c
^S4z, ^A4c, ^A4e, ^A8
^S4w, ^A4e, ^A6i
^S3i, ^S5y, ^A4e, ^A4w, ^A6i
^S3i, ^S3n, ^S3y, ^S5i, ^S5n, ^S5y, ^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^S3i, ^S3y, ^S5i, ^S5y, ^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^S4c
^S4c, ^S4e, ^A8
^S4c, ^S6i, ^S8, ^A2i, ^A4e
^S4c, ^S5e, ^S6e, ^S6i, ^S7e, ^S8, ^A1e, ^A2e, ^A2i, ^A3e, ^A4e
^S4c, ^S6e, ^S6i, ^S8, ^A2e, ^A2i, ^A4e
^S4c, ^S8, ^A4e
^S6i, ^A4e
^S4a, ^S4k, ^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8
^S5c, ^S7c, ^A2c, ^A2n, ^A4c
^S6n, ^A4c
^S5e, ^S7e, ^A2e, ^A2i, ^A4e
^S6e, ^A2i, ^A4e
^S6c, ^A2n, ^A4c
^S8
^A1e, ^A2e, ^A2i, ^A3e, ^A4e
^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D0, ^D1e, ^D2c, ^D2e, ^D2i, ^D2n, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D6c, ^D6e, ^D6i, ^D6n, ^D7e, ^D8
^A1e, ^A2e, ^A2i, ^A2n, ^A3e, ^A3q, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5e, ^A5q, ^A6e, ^A6i, ^A6n, ^A7e, ^A8
^A1e, ^A2e, ^A2i, ^A2n, ^A3e, ^A3q, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5e, ^A5q, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D0, ^D1e, ^D2e, ^D2i, ^D2n, ^D3e, ^D3q, ^D4c, ^D4e, ^D4q, ^D4w, ^D4z, ^D5e, ^D5q, ^D6e, ^D6i, ^D6n, ^D7e, ^D8
^A1e, ^A2e, ^A2i, ^A3e, ^A4c, ^A4e, ^A5e, ^A6e, ^A6i, ^A7e, ^A8
^A1e, ^A2e, ^A2i, ^A3e, ^A4c, ^A4e, ^A5e, ^A6e, ^A6i, ^A7e, ^A8, ^D0, ^D1e, ^D2e, ^D2i, ^D3e, ^D4c, ^D4e, ^D5e, ^D6e, ^D6i, ^D7e, ^D8
^A1e, ^A2e, ^A2i, ^A3e, ^A4e, ^D0, ^D1e, ^D2e, ^D2i, ^D3e, ^D4e
^A1e, ^A2c, ^A2e, ^A2i, ^A2n, ^A3e, ^A3i, ^A3n, ^A3q, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5e, ^A5i, ^A5n, ^A5q, ^A5y, ^A6c, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D1c, ^D2a, ^D2k, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D4j, ^D4n, ^D4r, ^D4y, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D6a, ^D6k, ^D7c
^A1e, ^A2e, ^A2i, ^A2n, ^A3e, ^A3q, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5e, ^A5q, ^A6e, ^A6i, ^A6n, ^A7e, ^A8, ^D2c, ^D3i, ^D3n, ^D3y, ^D4a, ^D4i, ^D4k, ^D4t, ^D5i, ^D5n, ^D5y, ^D6c
^A1e, ^A2e, ^A2i, ^A3e, ^A4c, ^A4e, ^A5e, ^A6e, ^A6i, ^A7e, ^A8, ^D2n, ^D3q, ^D4q, ^D4w, ^D4z, ^D5q, ^D6n
^A1e, ^A2e, ^A2i, ^A3e, ^A4e, ^D4c, ^D5e, ^D6e, ^D6i, ^D7e, ^D8
^A1c, ^A2c, ^A2n, ^A3c, ^A4c
^A1c, ^A1e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A3a, ^A3c, ^A3e, ^A3i, ^A3j, ^A3k, ^A3n, ^A3q, ^A3r, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A5a, ^A5c, ^A5e, ^A5i, ^A5j, ^A5k, ^A5n, ^A5q, ^A5r, ^A5y, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A7c, ^A7e, ^A8
^A1c, ^A1e, ^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A3a, ^A3c, ^A3e, ^A3i, ^A3j, ^A3k, ^A3n, ^A3q, ^A3r, ^A3y, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A5a, ^A5c, ^A5e, ^A5i, ^A5j, ^A5k, ^A5n, ^A5q, ^A5r, ^A5y, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A7c, ^A7e, ^A8, ^D0, ^D1c, ^D1e, ^D2a, ^D2c, ^D2e, ^D2i, ^D2k, ^D2n, ^D3a, ^D3c, ^D3e, ^D3i, ^D3j, ^D3k, ^D3n, ^D3q, ^D3r, ^D3y, ^D4a, ^D4c, ^D4e, ^D4i, ^D4j, ^D4k, ^D4n, ^D4q, ^D4r, ^D4t, ^D4w, ^D4y, ^D4z, ^D5a, ^D5c, ^D5e, ^D5i, ^D5j, ^D5k, ^D5n, ^D5q, ^D5r, ^D5y, ^D6a, ^D6c, ^D6e, ^D6i, ^D6k, ^D6n, ^D7c, ^D7e, ^D8
^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8
^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8, ^D0, ^D1c, ^D2c, ^D2e, ^D2i, ^D2n, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D6c, ^D6e, ^D6i, ^D6n, ^D7c, ^D8
^A1c, ^A2c, ^A2i, ^A2n, ^A3c, ^A3r, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5c, ^A5r, ^A6c, ^A6i, ^A6n, ^A7c, ^A8
^A1c, ^A2c, ^A2i, ^A2n, ^A3c, ^A3r, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5c, ^A5r, ^A6c, ^A6i, ^A6n, ^A7c, ^A8, ^D0, ^D1c, ^D2c, ^D2i, ^D2n, ^D3c, ^D3r, ^D4c, ^D4e, ^D4i, ^D4t, ^D4z, ^D5c, ^D5r, ^D6c, ^D6i, ^D6n, ^D7c, ^D8
^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^A4e, ^A5c, ^A6c, ^A6n, ^A7c, ^A8
^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^A4e, ^A5c, ^A6c, ^A6n, ^A7c, ^A8, ^D0, ^D1c, ^D2c, ^D2n, ^D3c, ^D4c, ^D4e, ^D5c, ^D6c, ^D6n, ^D7c, ^D8
^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^D0, ^D1c, ^D2c, ^D2n, ^D3c, ^D4c
^A1c, ^A2c, ^A2e, ^A2i, ^A2n, ^A3a, ^A3c, ^A3j, ^A3k, ^A3r, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A5a, ^A5c, ^A5j, ^A5k, ^A5r, ^A6c, ^A6e, ^A6i, ^A6n, ^A7c, ^A8, ^D1e, ^D2a, ^D2k, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D4j, ^D4n, ^D4r, ^D4y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D6a, ^D6k, ^D7e
^A1c, ^A2c, ^A2i, ^A2n, ^A3c, ^A3r, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5c, ^A5r, ^A6c, ^A6i, ^A6n, ^A7c, ^A8, ^D2e, ^D3a, ^D3j, ^D3k, ^D4a, ^D4k, ^D4q, ^D4w, ^D5a, ^D5j, ^D5k, ^D6e
^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^A4e, ^A5c, ^A6c, ^A6n, ^A7c, ^A8, ^D2i, ^D3r, ^D4i, ^D4t, ^D4z, ^D5r, ^D6i
^A1c, ^A2c, ^A2n, ^A3c, ^A4c, ^D4e, ^D5c, ^D6c, ^D6n, ^D7c, ^D8
^A2c, ^A2n, ^A4c
^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8
^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2e, ^D2i, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4k, ^D4q, ^D4t, ^D4w, ^D4z, ^D6c, ^D6e, ^D6i, ^D6n, ^D8
^A2c, ^A2i, ^A2n, ^A3a, ^A3j, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5a, ^A5j, ^A5k, ^A6c, ^A6i, ^A6n, ^A8
^A2c, ^A2i, ^A2n, ^A3a, ^A3j, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5a, ^A5j, ^A5k, ^A6c, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2i, ^D2n, ^D3a, ^D3j, ^D3k, ^D4c, ^D4e, ^D4i, ^D4t, ^D4z, ^D5a, ^D5j, ^D5k, ^D6c, ^D6i, ^D6n, ^D8
^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8
^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D0, ^D2c, ^D2i, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D4z, ^D6c, ^D6i, ^D6n, ^D8
^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8
^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D0, ^D2c, ^D2n, ^D4c, ^D4e, ^D6c, ^D6n, ^D8
^A2c, ^A2n, ^A4c, ^D0, ^D2c, ^D2n, ^D4c
^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3i, ^D3n, ^D3q, ^D3y, ^D5e, ^D5i, ^D5n, ^D5q, ^D5y, ^D7e
^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D2e, ^D4a, ^D4k, ^D4q, ^D4w, ^D6e
^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D3a, ^D3j, ^D3k, ^D5a, ^D5j, ^D5k
^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D2i, ^D4i, ^D4t, ^D4z, ^D6i
^A2c, ^A2n, ^A4c, ^D4e, ^D6c, ^D6n, ^D8
^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8
^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8, ^D0, ^D2a, ^D2c, ^D2e, ^D2i, ^D2k, ^D2n, ^D4a, ^D4c, ^D4e, ^D4i, ^D4j, ^D4k, ^D4n, ^D4q, ^D4r, ^D4t, ^D4w, ^D4y, ^D4z, ^D6a, ^D6c, ^D6e, ^D6i, ^D6k, ^D6n, ^D8
^A2a, ^A2c, ^A2e, ^A2i, ^A2k, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4j, ^A4k, ^A4n, ^A4q, ^A4r, ^A4t, ^A4w, ^A4y, ^A4z, ^A6a, ^A6c, ^A6e, ^A6i, ^A6k, ^A6n, ^A8, ^D1c, ^D1e, ^D3a, ^D3c, ^D3e, ^D3i, ^D3j, ^D3k, ^D3n, ^D3q, ^D3r, ^D3y, ^D5a, ^D5c, ^D5e, ^D5i, ^D5j, ^D5k, ^D5n, ^D5q, ^D5r, ^D5y, ^D7c, ^D7e
^A2e, ^A2i, ^A4e
^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8
^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2e, ^D2i, ^D2n, ^D4c, ^D4e, ^D4q, ^D4w, ^D4z, ^D6e, ^D6i, ^D6n, ^D8
^A2e, ^A2i, ^A2n, ^A3i, ^A3n, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5i, ^A5n, ^A5y, ^A6e, ^A6i, ^A6n, ^A8
^A2e, ^A2i, ^A2n, ^A3i, ^A3n, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5i, ^A5n, ^A5y, ^A6e, ^A6i, ^A6n, ^A8, ^D0, ^D2e, ^D2i, ^D2n, ^D3i, ^D3n, ^D3y, ^D4c, ^D4e, ^D4q, ^D4w, ^D4z, ^D5i, ^D5n, ^D5y, ^D6e, ^D6i, ^D6n, ^D8
^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8
^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D0, ^D2e, ^D2i, ^D4c, ^D4e, ^D6e, ^D6i, ^D8
^A2e, ^A2i, ^A4e, ^D0, ^D2e, ^D2i, ^D4e
^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D1c, ^D3a, ^D3c, ^D3j, ^D3k, ^D3r, ^D5a, ^D5c, ^D5j, ^D5k, ^D5r, ^D7c
^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D2c, ^D4a, ^D4i, ^D4k, ^D4t, ^D6c
^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D2n, ^D4q, ^D4w, ^D4z, ^D6n
^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D3i, ^D3n, ^D3y, ^D5i, ^D5n, ^D5y
^A2e, ^A2i, ^A4e, ^D4c, ^D6e, ^D6i, ^D8
^A2i, ^A3n, ^A4c, ^A4e, ^A4q, ^A4w, ^A5n, ^A6i, ^A8
^A2i, ^A3n, ^A4c, ^A4e, ^A4q, ^A4w, ^A5n, ^A6i, ^A8, ^D0, ^D2i, ^D3n, ^D4c, ^D4e, ^D4q, ^D4w, ^D5n, ^D6i, ^D8
^A2i, ^A3n, ^A4c, ^A4e, ^A4q, ^A4w, ^A5n, ^A6i, ^A8, ^D2e, ^D2n, ^D3i, ^D3y, ^D4z, ^D5i, ^D5y, ^D6e, ^D6n
^A3a, ^A4c, ^A4i, ^A5k, ^A6n
^A3a, ^A4c, ^A4i, ^A5k, ^A6n, ^D0, ^D3a, ^D4c, ^D4i, ^D5k, ^D6n
^A2c, ^A2i, ^A2n, ^A3a, ^A3j, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A5a, ^A5j, ^A5k, ^A6c, ^A6i, ^A6n, ^A8, ^D1c, ^D2e, ^D3c, ^D3r, ^D4a, ^D4k, ^D4q, ^D4w, ^D5c, ^D5r, ^D6e, ^D7c
^A2n, ^A3a, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A5a, ^A5k, ^A6n, ^A8, ^D2c, ^D2i, ^D3j, ^D4z, ^D5j, ^D6c, ^D6i
^A3a, ^A4c, ^A4i, ^A5k, ^A6n, ^D2n, ^D3k, ^D4e, ^D4t, ^D5a, ^D8
^A4c, ^A4i, ^A6n
^A4c, ^A4i, ^A6n, ^D0, ^D4c, ^D4i, ^D6n
^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D2c, ^D2i, ^D4z, ^D6c, ^D6i
^A4c, ^A4i, ^A6n, ^D2n, ^D4e, ^D4t, ^D8
^A2n, ^A4c
^A2n, ^A3a, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A5a, ^A5k, ^A6n, ^A8
^A2n, ^A3a, ^A3k, ^A4c, ^A4e, ^A4i, ^A4t, ^A5a, ^A5k, ^A6n, ^A8, ^D0, ^D2n, ^D3a, ^D3k, ^D4c, ^D4e, ^D4i, ^D4t, ^D5a, ^D5k, ^D6n, ^D8
^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8
^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D0, ^D2n, ^D4c, ^D4e, ^D4i, ^D4t, ^D6n, ^D8
^A2n, ^A4c, ^A4e, ^A6n, ^A8
^A2n, ^A4c, ^A4e, ^A6n, ^A8, ^D0, ^D2n, ^D4c, ^D4e, ^D6n, ^D8
^A2n, ^A4c, ^D0, ^D2n, ^D4c
^A2e, ^A2i, ^A2n, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D3e, ^D3q, ^D5e, ^D5q, ^D7e
^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8, ^D2e, ^D4q, ^D4w, ^D6e
^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3a, ^D3k, ^D5a, ^D5k
^A2n, ^A4c, ^A4e, ^A6n, ^A8, ^D4i, ^D4t
^A2n, ^A4c, ^A4e, ^A6n, ^A8, ^D2i, ^D4z, ^D6i
^A2n, ^A4c, ^D4e, ^D6n, ^D8
^A3k, ^A4c, ^A4i, ^A5a, ^A6n
^A3k, ^A4c, ^A4i, ^A5a, ^A6n, ^D0, ^D3k, ^D4c, ^D4i, ^D5a, ^D6n
^A3k, ^A4c, ^A4i, ^A5a, ^A6n, ^D2n, ^D3a, ^D4e, ^D4t, ^D5k, ^D8
^A2e, ^A2i, ^A3q, ^A4c, ^A4e, ^A5q, ^A6e, ^A6i, ^A8
^A2e, ^A2i, ^A3q, ^A4c, ^A4e, ^A5q, ^A6e, ^A6i, ^A8, ^D0, ^D2e, ^D2i, ^D3q, ^D4c, ^D4e, ^D5q, ^D6e, ^D6i, ^D8
^A2e, ^A2i, ^A3q, ^A4c, ^A4e, ^A5q, ^A6e, ^A6i, ^A8, ^D1e, ^D2n, ^D3e, ^D4q, ^D4w, ^D4z, ^D5e, ^D6n, ^D7e
^A4e, ^A4q, ^A6i
^A4e, ^A4q, ^A6i, ^D0, ^D4e, ^D4q, ^D6i
^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D2e, ^D2n, ^D4z, ^D6e, ^D6n
^A4e, ^A4q, ^A6i, ^D2i, ^D4c, ^D4w, ^D8
^A2i, ^A4e
^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8
^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8, ^D0, ^D2i, ^D2n, ^D4c, ^D4e, ^D4z, ^D6i, ^D6n, ^D8
^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8
^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D0, ^D2i, ^D4c, ^D4e, ^D4q, ^D4w, ^D6i, ^D8
^A2i, ^A3i, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A5i, ^A5y, ^A6i, ^A8
^A2i, ^A3i, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A5i, ^A5y, ^A6i, ^A8, ^D0, ^D2i, ^D3i, ^D3y, ^D4c, ^D4e, ^D4q, ^D4w, ^D5i, ^D5y, ^D6i, ^D8
^A2i, ^A4c, ^A4e, ^A6i, ^A8
^A2i, ^A4c, ^A4e, ^A6i, ^A8, ^D0, ^D2i, ^D4c, ^D4e, ^D6i, ^D8
^A2i, ^A4e, ^D0, ^D2i, ^D4e
^A2c, ^A2i, ^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A4z, ^A6c, ^A6i, ^A6n, ^A8, ^D1c, ^D3c, ^D3r, ^D5c, ^D5r, ^D7c
^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8, ^D2c, ^D4i, ^D4t, ^D6c
^A2i, ^A4c, ^A4e, ^A6i, ^A8, ^D2n, ^D4z, ^D6n
^A2i, ^A4c, ^A4e, ^A6i, ^A8, ^D4q, ^D4w
^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3i, ^D3y, ^D5i, ^D5y
^A2i, ^A4e, ^D4c, ^D6i, ^D8
^A2c, ^A2n, ^A3r, ^A4c, ^A4e, ^A5r, ^A6c, ^A6n, ^A8
^A2c, ^A2n, ^A3r, ^A4c, ^A4e, ^A5r, ^A6c, ^A6n, ^A8, ^D0, ^D2c, ^D2n, ^D3r, ^D4c, ^D4e, ^D5r, ^D6c, ^D6n, ^D8
^A2c, ^A2n, ^A3r, ^A4c, ^A4e, ^A5r, ^A6c, ^A6n, ^A8, ^D1c, ^D2i, ^D3c, ^D4i, ^D4t, ^D4z, ^D5c, ^D6i, ^D7c
^A3y, ^A4e, ^A4w, ^A5i, ^A6i
^A3y, ^A4e, ^A4w, ^A5i, ^A6i, ^D0, ^D3y, ^D4e, ^D4w, ^D5i, ^D6i
^A3y, ^A4e, ^A4w, ^A5i, ^A6i, ^D2i, ^D3i, ^D4c, ^D4q, ^D5y, ^D8
^A4c, ^A4t, ^A6n
^A4c, ^A4t, ^A6n, ^D0, ^D4c, ^D4t, ^D6n
^A4c, ^A4t, ^A6n, ^D2n, ^D4e, ^D4i, ^D8
^A2n, ^A3j, ^A4c, ^A4e, ^A4i, ^A4t, ^A5j, ^A6n, ^A8
^A2n, ^A3j, ^A4c, ^A4e, ^A4i, ^A4t, ^A5j, ^A6n, ^A8, ^D0, ^D2n, ^D3j, ^D4c, ^D4e, ^D4i, ^D4t, ^D5j, ^D6n, ^D8
^A2n, ^A3j, ^A4c, ^A4e, ^A4i, ^A4t, ^A5j, ^A6n, ^A8, ^D2c, ^D2i, ^D3a, ^D3k, ^D4z, ^D5a, ^D5k, ^D6c, ^D6i
^A4e
^A4e, ^D0, ^D4e
^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D1c, ^D3c, ^D5c, ^D7c
^A2n, ^A4c, ^A4e, ^A6n, ^A8, ^D2c, ^D6c
^A4c, ^A4e, ^A8, ^D2n, ^D6n
^A4e, ^D4c, ^D8
^A4c, ^A4e, ^A4z, ^A8
^A4c, ^A4e, ^A4z, ^A8, ^D0, ^D4c, ^D4e, ^D4z, ^D8
^A4c, ^A4e, ^A4z, ^A8, ^D2i, ^D2n, ^D6i, ^D6n
^A4e, ^A4w, ^A6i
^A4e, ^A4w, ^A6i, ^D0, ^D4e, ^D4w, ^D6i
^A4e, ^A4w, ^A6i, ^D2i, ^D4c, ^D4q, ^D8
^A3i, ^A4e, ^A4w, ^A5y, ^A6i
^A3i, ^A4e, ^A4w, ^A5y, ^A6i, ^D0, ^D3i, ^D4e, ^D4w, ^D5y, ^D6i
^A2e, ^A2i, ^A2n, ^A3i, ^A3n, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A4z, ^A5i, ^A5n, ^A5y, ^A6e, ^A6i, ^A6n, ^A8, ^D1e, ^D2c, ^D3e, ^D3q, ^D4a, ^D4i, ^D4k, ^D4t, ^D5e, ^D5q, ^D6c, ^D7e
^A2i, ^A3i, ^A3y, ^A4c, ^A4e, ^A4q, ^A4w, ^A5i, ^A5y, ^A6i, ^A8, ^D2e, ^D2n, ^D3n, ^D4z, ^D5n, ^D6e, ^D6n
^A3i, ^A4e, ^A4w, ^A5y, ^A6i, ^D2i, ^D3y, ^D4c, ^D4q, ^D5i, ^D8
^A4c
^A4c, ^A4e, ^A8
^A4c, ^A4e, ^A8, ^D0, ^D4c, ^D4e, ^D8
^A4c, ^D0, ^D4c
^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D1e, ^D3e, ^D5e, ^D7e
^A2i, ^A4c, ^A4e, ^A6i, ^A8, ^D2e, ^D6e
^A4c, ^A4e, ^A8, ^D2i, ^D6i
^A4c, ^D4e, ^D8
^A4e, ^A6i
^A4e, ^A6i, ^D0, ^D4e, ^D6i
^A4e, ^A6i, ^D2i, ^D4c, ^D8
^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4k, ^A4z, ^A6i, ^A6n, ^A8
^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4k, ^A4z, ^A6i, ^A6n, ^A8, ^D0, ^D2i, ^D2n, ^D4a, ^D4c, ^D4e, ^D4k, ^D4z, ^D6i, ^D6n, ^D8
^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4k, ^A4z, ^A6i, ^A6n, ^A8, ^D2c, ^D2e, ^D4i, ^D4q, ^D4t, ^D4w, ^D6c, ^D6e
^A2c, ^A2n, ^A4c, ^A5c, ^A7c
^A2c, ^A2n, ^A4c, ^A5c, ^A7c, ^D0, ^D2c, ^D2n, ^D4c, ^D5c, ^D7c
^A2c, ^A2n, ^A4c, ^A5c, ^A7c, ^D1c, ^D3c, ^D4e, ^D6c, ^D6n, ^D8
^A4c, ^A6n
^A4c, ^A6n, ^D0, ^D4c, ^D6n
^A4c, ^A6n, ^D2n, ^D4e, ^D8
^A2e, ^A2i, ^A4e, ^A5e, ^A7e
^A2e, ^A2i, ^A4e, ^A5e, ^A7e, ^D0, ^D2e, ^D2i, ^D4e, ^D5e, ^D7e
^A2e, ^A2i, ^A4e, ^A5e, ^A7e, ^D1e, ^D3e, ^D4c, ^D6e, ^D6i, ^D8
^A2i, ^A4e, ^A6e
^A2i, ^A4e, ^A6e, ^D0, ^D2i, ^D4e, ^D6e
^A2i, ^A4e, ^A6e, ^D2e, ^D4c, ^D6i, ^D8
^A2n, ^A4c, ^A6c
^A2n, ^A4c, ^A6c, ^D0, ^D2n, ^D4c, ^D6c
^A2n, ^A4c, ^A6c, ^D2c, ^D4e, ^D6n, ^D8
^A8
^A8, ^D0, ^D8
^A8, ^D4c, ^D4e
^D0
^A2e, ^A2i, ^A4e, ^D1e, ^D3e
^A2c, ^A2n, ^A4c, ^D1c, ^D3c
^A2n, ^A4c, ^D2c
^A2c, ^A2e, ^A2i, ^A2n, ^A4a, ^A4c, ^A4e, ^A4i, ^A4k, ^A4q, ^A4t, ^A4w, ^A4z, ^A6c, ^A6e, ^A6i, ^A6n, ^A8, ^D2a, ^D2k, ^D4j, ^D4n, ^D4r, ^D4y, ^D6a, ^D6k
^A2i, ^A4e, ^D2e
^A2i, ^A4c, ^A4e, ^A4q, ^A4w, ^A6i, ^A8, ^D3n, ^D5n
^A4c, ^A4i, ^A6n, ^D3a, ^D5k
^A4c, ^A6n, ^D4i
^A4c, ^D2n
^A4c, ^A4i, ^A6n, ^D3k, ^D5a
^A2e, ^A2i, ^A4c, ^A4e, ^A6e, ^A6i, ^A8, ^D3q, ^D5q
^A4e, ^A6i, ^D4q
^A4e, ^D2i
^A2c, ^A2n, ^A4c, ^A4e, ^A6c, ^A6n, ^A8, ^D3r, ^D5r
^A4e, ^A4w, ^A6i, ^D3y, ^D5i
^A4c, ^A6n, ^D4t
^A2n, ^A4c, ^A4e, ^A4i, ^A4t, ^A6n, ^A8, ^D3j, ^D5j
^D4e
^A4c, ^A4e, ^A8, ^D4z
^A4e, ^A6i, ^D4w
^A4e, ^A4w, ^A6i, ^D3i, ^D5y
^D4c
^A4e, ^D6i
^A2i, ^A2n, ^A4c, ^A4e, ^A4z, ^A6i, ^A6n, ^A8, ^D4a, ^D4k
^A2c, ^A2n, ^A4c, ^D5c, ^D7c
^A4c, ^D6n
^A2e, ^A2i, ^A4e, ^D5e, ^D7e
^A2i, ^A4e, ^D6e
^A2n, ^A4c, ^D6c
^D8`.split('\n').map(str => str.split(', ').sort((x, y) => priority.indexOf(x) - priority.indexOf(y))).sort((x, y) => {
    if (x.length !== y.length) {
        return x.length - y.length;
    }
    for (let i = 0; i < x.length; i++) {
        let value = priority.indexOf(x[i]) - priority.indexOf(y[i]);
        if (value !== 0) {
            return value;
        }
    }
    return 0;
}).map(x => x.join(', ')).join('\n'));
