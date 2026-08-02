
import {INT} from '../core/index.js';
import {TRANSITION_CLASS_ORS, TRANSITION_CLASSES, findBasis, basisToString, parseSymmetry, xorTransitionsToString} from './index.js';


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
let prevLevel: [Set<number>, string][] = [[new Set(), 'INT']]
let currentLevel: [Set<number>, string][] = [];

function checkTransitions(trs: Set<number>): Set<number> | undefined {
    trs = resolveXORTransitions(trs);
    let key = xorTransitionsToString(trs).join(', ');
    if (key.length === 0 || done.has(key)) {
        return;
    }
    done.add(key);
    for (let [trs2, str] of prevLevel) {
        if (trs.isSupersetOf(trs2)) {
            console.log(`    "${str}" -> "${key}"`);
        }
    }
    let basis = findBasis(parseSymmetry(`INT, ${key}`));
    if (typeof basis === 'string') {
        console.log(`    "${key}" [label="${key} (contradiction)"]`);
    } else {
        basis = basisToString(basis);
        if (basis.includes('\n')) {
            currentLevel.push([trs, key]);
        } else {
            console.log(`    "${key}" [label="${basis}"]`);
        }
    }
}

console.log('digraph G {\n\n    // level 0 (0 symmetries)\n    "INT"');
let levelCount = 1;
while (prevLevel.length > 0) {
    console.log(`\n    // level ${levelCount} (${prevLevel.length} symmetries)`);
    currentLevel = [];
    for (let [trs] of prevLevel) {
        for (let or of Object.values(TRANSITION_CLASS_ORS)) {
            for (let toAdd of Object.values(INT.trs)) {
                let trs2 = new Set(trs);
                for (let tr of toAdd) {
                    trs2.add((tr << 1) | or);
                }
                checkTransitions(trs2);
            }
        }
    }
    prevLevel = currentLevel;
    levelCount++;
}
console.log('\n}');
