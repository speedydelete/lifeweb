
function rotateTr180(i: number): number {
    return flipTrHorizontal(flipTrVertical(i));
}

function rotateTrRight(i: number): number {
    return ((i & 0b100_001_000) >> 2) | ((i & 0b010_000_000) >> 4) | ((i & 0b001_000_000) >> 6) | ((i & 0b000_100_001) << 2) | (i & 0b000_010_000) | ((i & 0b000_000_100) << 6) | ((i & 0b000_000_010) << 4);
}

function rotateTrLeft(i: number): number {
    return rotateTrRight(rotateTr180(i));
}

function flipTrVertical(i: number): number {
    return ((i & 0b000_000_111) << 6) | (i & 0b000_111_000) | ((i & 0b111_000_000) >> 6);
}

function flipTrHorizontal(i: number): number {
    return ((i & 0b001_001_001) << 2) | (i & 0b010_010_010) | ((i & 0b100_100_100) >> 2)
}

function flipTrDiagonal(i: number): number {
    return (i & 0b100_010_001) | ((i & 0b010_001_000) >> 2) | ((i & 0b001_000_000) >> 4) | ((i & 0b000_100_010) << 2) | ((i & 0b000_000_100) << 4);
}

function flipTrAntiDiagonal(i: number): number {
    return flipTrHorizontal(rotateTrLeft(i));
}


function find(syms: ((i: number) => number)[]): number[][] {
    let out: number[][] = [];
    for (let i = 0; i < 512; i++) {
        let found = false;
        for (let sym of syms) {
            let x = sym(i);
            let array = out.find(a => a.includes(x));
            if (array !== undefined) {
                array.push(i);
                found = true;
                break;
            }
        }
        if (!found) {
            out.push([i]);
        }
    }
    return out;
}

console.log(find([rotateTr180, rotateTrRight, rotateTrLeft, flipTrVertical, flipTrHorizontal, flipTrDiagonal, flipTrAntiDiagonal]).length);
