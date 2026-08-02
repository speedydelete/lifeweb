
import {INT} from '../core/index.js';
import {TRANSITION_CLASS_ORS, findBasis, basisToString, parseSymmetry, xorTransitionsToString} from './index.js';


function resolveXORTransitions(trs: Set<number>): Set<number> {
    trs = new Set(trs);
    let prevSize: number | undefined = undefined;
    while (trs.size !== prevSize) {
        let copy = new Set(trs);
        for (let tr1 of copy) {
            for (let tr2 of copy) {
                trs.add(tr1 ^ tr2);
            }
        }
        prevSize = trs.size;
    }
    return trs;
}

let done = new Set<string>();
let prevLevel: Set<number>[] = [new Set()];
let foundBasises = new Map<string, [Set<number>, string]>();
let currentLevel: Set<number>[] = [];

function checkTransitions(trs: Set<number>): Set<number> | undefined {
    trs = resolveXORTransitions(trs);
    let key = xorTransitionsToString(trs).join(', ');
    if (key.length === 0 || done.has(key)) {
        return;
    }
    done.add(key);
    let basis = findBasis(parseSymmetry(`INT, ${key}`));
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
    console.log(`// level ${levelCount} (${prevLevel.length} symmetries) (${foundBasises.size} total found)`);
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
for (let [_, str] of foundBasises.values()) {
    console.log(str);
}
