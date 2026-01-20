
/** Implements a LLS-like SAT-solver-based search program. */


let remapping: {[key: string]: number} = {};
let nextVar = 1;

function and(...data: (number | number[][])[]): number[][] {
    let out: number[][] = [];
    for (let x of data) {
        if (typeof x === 'number') {
            let found = false;
            for (let y of out) {
                if (y.length === 1) {
                    if (y[0] === x) {
                        found = true;
                        break;
                    } else if (y[0] === -x) {
                        throw new Error('Proved unsatisfiable during preprocessing!');
                    }
                }
            }
            if (!found) {
                out.push([x]);
            }
        } else {
            for (let y of x) {
                if (!out.some(z => z.every((value, i) => value === y[i]))) {
                    out.push(y);
                }
            }
        }
    }
    return out;
}


/**
 * Negates a CNF using Tseitin encoding.
 * cnf: number[][] representing a CNF
 */
function negateCNF(cnf: number[][]): number[][] {
    const out: number[][] = [];
    const clauseVars: number[] = [];

    // Step 1: encode each clause with a fresh variable
    for (const clause of cnf) {
        const v = nextVar++;
        clauseVars.push(v);
        out.push([-v, ...clause]);  // v ↔ clause
        for (const lit of clause) out.push([v, -lit]);
    }

    // Step 2: encode AND of all clause variables
    let top: number;
    if (clauseVars.length === 1) {
        top = clauseVars[0];
    } else {
        top = nextVar++;
        for (const v of clauseVars) out.push([-top, v]);
        out.push([top, ...clauseVars.map(v => -v)]);
    }

    // Step 3: negate the CNF
    out.push([-top]);
    return out;
}

// /**
//  * ORs multiple CNFs together using Tseitin encoding.
//  * cnfs: number[][][] array of CNFs
//  */
// function orCNFs(cnfs: number[][][]): number[][] {
//     const out: number[][] = [];
//     const topVars: number[] = [];

//     // Step 1: encode each CNF independently
//     for (const cnf of cnfs) {
//         const clauseVars: number[] = [];

//         for (const clause of cnf) {
//             const v = nextVar++;
//             clauseVars.push(v);
//             out.push([-v, ...clause]);  // v ↔ clause
//             for (const lit of clause) out.push([v, -lit]);
//         }

//         // encode AND of clause variables
//         let top: number;
//         if (clauseVars.length === 1) {
//             top = clauseVars[0];
//         } else {
//             top = nextVar++;
//             for (const v of clauseVars) out.push([-top, v]);
//             out.push([top, ...clauseVars.map(v => -v)]);
//         }

//         topVars.push(top);
//     }

//     // Step 2: encode OR of CNFs
//     if (topVars.length === 1) return out;

//     const top = nextVar++;
//     out.push([-top, ...topVars]);       // ¬top ∨ v1 ∨ v2 ∨ ...
//     for (const v of topVars) out.push([top, -v]); // top ∨ ¬vi

//     return out;
// }

// // ------------------------
// // Example usage:

// const cnfA = [[1, 2], [-3]];      // (1 ∨ 2) ∧ ¬3
// const cnfB = [[-1, 4], [5]];      // (¬1 ∨ 4) ∧ 5

// console.log("Negate CNF:", negateCNF(cnfA));
// console.log("OR CNFs:", orCNFs([cnfA, cnfB]));

// function or(x: number | number[][], y: number | number[][]): number[][] {
//     if (typeof x === 'number') {
//         x = remap(x);
//         if (typeof y === 'number') {
//             return [[x, remap(y)]];
//         } else {
//             return y.map(z => z.includes(x as number) ? z : z.concat(x as number));
//         }
//     } else {
//         if (typeof y === 'number') {
//             y = remap(y);
//             return x.map(z => z.includes(y as number) ? z : z.concat(y as number));
//         } else {
//             let out: number[][] = [];
//             const v1 = tseitinCNF(cnf1, out);
//             const v2 = tseitinCNF(cnf2, out);
//             const top = nextVar++;
//             // top ↔ (v1 ∨ v2)
//             out.push([-top, v1, v2]); // ¬top ∨ v1 ∨ v2
//             out.push([top, -v1]);     // top ∨ ¬v1
//             out.push([top, -v2]);     // top ∨ ¬v2
//             return out;
//         }
//     }
// }

function not(x: number | number[][]): number[][] {
    if (typeof x === 'number') {
        return [[-x]];
    } else {
        let out: number[][] = [];
        let ys: number[] = [];
        let top = nextVar++;
        for (let clause of x) {
            let y = nextVar++;
            ys.push(y);
            out.push([-top, y]);
            out.push([-y, ...clause]);
            for (let value of clause) {
                out.push([y, -value]);
            }
        }
        out.push([top, ...ys.map(y => -y)]);
        return out;
    }
}


interface Generation {
    height: number;
    width: number;
    data: Uint32Array;
}


// function cellToCNF(cells: [number, number, number, number, number, number, number, number, number], result: number, trs: Uint32Array): number[][] {
//     let out: number[][] = [];
//     for (let i = 0; i < 511; i++) {

//     }
// }

// function getCNF(data: Generation[], trs: Uint32Array): number[][] {
//     let vars = 0;
//     for (let gen of data) {

//     }
// }
