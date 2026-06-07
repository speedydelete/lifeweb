
import {Pattern} from '../core/index.js';
import {base, StableObject, Oscillator, xyCompare} from './base.js';


interface Search {
    type: string;
    validLanes?: number[];
    start: string;
    end: undefined | 'destroy' | ({code: string, x?: undefined, y?: undefined} | {code: string, x: number, y: number})[];
}

export {Search as SalvoSearch};

interface State {
    key: string;
    p: Pattern;
    objs: StableObject[];
    score: number;
    salvo: [number, number][];
}

let oscillatorMinpopCache = new Map<string, number>();
function getOscillatorMinpop(obj: Oscillator): number {
    let value = oscillatorMinpopCache.get(obj.code);
    if (value !== undefined) {
        return value;
    }
    let p = base.loadApgcode(obj.code.slice(obj.code.indexOf('_') + 1));
    let out = p.population;
    for (let i = 1; i < obj.period; i++) {
        p.runGeneration();
        out = Math.min(out, p.population);
    }
    oscillatorMinpopCache.set(obj.code, out);
    return out;
}

// function getScore(search: Search, objs: StableObject[]): number {
//     if (search.end === 'destroy') {
//         let out = 0;
//         for (let obj of objs) {
//             if (obj.type === 'sl') {
//                 out += parseInt(obj.code.slice(2));
//             } else {
//                 out += getOscillatorMinpop(obj);
//             }
//         }
//         return out;
//     } else if (search.end === undefined) {
//         return 0;
//     }
//     let best: (StableObject | undefined)[] = [];
//     for (let i = 0; i < search.end.length; i++) {
//         best.push(undefined);
//     }
//     for (let obj of objs) {
//         for (let i = 0; i < search.end.length; i++) {
//             let end = search.end[i];
//             if (end.x === undefined) {
//                 if (obj.code === end.code) {
//                     if (best[i]) {

//                     }
//                     best[i] = obj;
//                 }
//             }
//         }
//         let end = search.end[i];
//         if (end.x === undefined) {
//             for (let obj of objs) {
//                 if (obj.code === end.code) {

//                 }
//             }
//         }
//         for (let obj of objs) {

//         }
//     }
// }

// export function searchForSalvo(type: string, search: Search) {
//     if (Array.isArray(search.end)) {
//         search.end = search.end.sort((a, b) => {
//             if (a.x !== undefined) {
//                 if (b.x !== undefined) {
//                     if (a.x === b.x) {
//                         return a.y - b.y;
//                     } else {
//                         return a.x - b.x;
//                     }
//                 } else {
//                     return -1;
//                 }
//             }
//         });
//     }
// }

