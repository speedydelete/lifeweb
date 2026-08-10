
import {INT} from '../core/index.js';
import {TRANSITION_CLASS_ORS, SymmetryTable, Vector, basisSorter, basisToString, findBasis, PREDEFINED_SYMMETRY_NAMESPACE, xorTransitionsToString} from './index.js';


function resolveXORTransitions(trs: Set<number>): Set<number> {
    if (trs.size === 0) {
        return new Set();
    }
    // trs = new Set(trs);
    // let prevSize: number | undefined = undefined;
    // while (trs.size !== prevSize) {
    //     prevSize = trs.size;
    //     let copy = new Set(trs);
    //     for (let tr1 of copy) {
    //         for (let tr2 of copy) {
    //             trs.add(tr1 ^ tr2);
    //         }
    //     }
    // }
    // return trs;
    let basis = new Uint16Array(10);
    for (let tr of trs) {
        for (let bit = 9; bit >= 0; bit--) {
            if ((tr >> bit) & 1) {
                if (!basis[bit]) {
                    basis[bit] = tr;
                    break;
                }
                tr ^= basis[bit];
            }
        }
    }
    let out = new Set<number>();
    out.add(0);
    for (let bit = 0; bit < 10; bit++) {
        if (basis[bit]) {
            for (let value of Array.from(out)) {
                out.add(value ^ basis[bit]);
            }
        }
    }
    return out;
}

let done = new Set<string>();
let prevLevel: Set<number>[] = [new Set()];
let foundBasises = new Map<string, [Set<number>, string]>();
let currentLevel: Set<number>[] = [];

const XOR_SYMMETRIES: SymmetryTable[] = [];
for (let xor = 0; xor < 1024; xor++) {
    let table = new Uint16Array(1024);
    for (let tr = 0; tr < 1024; tr++) {
        table[tr] = tr ^ xor;
    }
    XOR_SYMMETRIES.push(table);
}

function checkTransitions(trs: Set<number>): Set<number> | undefined {
    trs = resolveXORTransitions(trs);
    let key = xorTransitionsToString(trs).join(', ');
    if (key.length === 0 || done.has(key)) {
        return;
    }
    done.add(key);
    let symmetry = PREDEFINED_SYMMETRY_NAMESPACE['INT'].slice();
    for (let tr of trs) {
        symmetry.push(XOR_SYMMETRIES[tr]);
    }
    let basis = findBasis(symmetry);
    if (typeof basis === 'string') {
        return;
    }
    let basisText = basisToString(basis);
    let value = foundBasises.get(basisText);
    if (value !== undefined) {
        let trs2 = value[0];
        let oldSize = trs2.size;
        for (let tr of trs) {
            trs2.add(tr);
        }
        if (trs2.size > oldSize) {
            trs2 = resolveXORTransitions(trs2);
            console.log(`Update: ${value[1]} to ${xorTransitionsToString(trs2).join(', ')}`);
            value[1] = key;
        }
    } else {
        console.log(key);
        foundBasises.set(basisText, [trs, key]);
        currentLevel.push(trs);
    }
}


let levelCount = 1;
while (prevLevel.length > 0) {
    console.log(`// level ${levelCount} (${prevLevel.length} symmetries) (${foundBasises.size} found in total)`);
    currentLevel = [];
    let i = 0;
    for (let trs of prevLevel) {
        console.log(`// checking ${i}/${prevLevel.length} (${foundBasises.size} found in total, ${currentLevel.length} queued for next level)`);
        for (let or of Object.values(TRANSITION_CLASS_ORS)) {
            for (let toAdd of Object.values(INT.trs)) {
                let trs2 = new Set(trs);
                for (let tr of toAdd) {
                    trs2.add((tr << 1) | or);
                }
                checkTransitions(trs2);
            }
        }
        i++;
    }
    prevLevel = currentLevel;
    levelCount++;
}

console.log('\nFull:');
let symmetries = Array.from(foundBasises.entries()).map<[Vector, string]>(x => [Array.from(x[1][0]), x[0]]);
for (let [trs, basis] of symmetries.sort((x, y) => {
    let xLength = x[1].split('\n').length;
    let yLength = y[1].split('\n').length;
    if (xLength !== yLength) {
        return yLength - xLength;
    }
    return basisSorter(x[0], y[0]);
})) {
    console.log(`${xorTransitionsToString(new Set(trs)).join(', ')}: 2^${basis.split('\n').length}\n${basis.split('\n').map(x => '    ' + x).join('\n')}`);
}
