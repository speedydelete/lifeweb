
import {Pattern, IdentityPattern, INT} from '../core/index.js';
import {classifyTransition, findBasis, basisToString, parseSymmetry} from './index.js';


function modGet(p: Pattern, x: number, y: number) {
    x %= p.width;
    if (x < 0) {
        x += p.width;
    }
    y %= p.height;
    if (y < 0) {
        y += p.height;
    }
    return p.get(x, y);
}

let height = Number(process.argv[2]);
let width = Number(process.argv[3]);
let size = height * width;

let done = new Set<string>();
for (let i = 0n; i < 2n**BigInt(size); i++) {
    let readFrom = i;
    let data = new Uint8Array(size);
    for (let j = 0; j < size; j++) {
        data[j] = Number(readFrom & 1n);
        readFrom >>= 1n;
    }
    let p = new IdentityPattern(height, width, data);
    let code = p.toCanonicalApgcode();
    if (done.has(code)) {
        continue;
    }
    done.add(code);
    let lines: string[] = [];
    lines.push(p.toRLE().replace('Identity', `B3/S23:T${width},${height}`).replaceAll('A', 'o').replaceAll('.', 'b'));
    let xorTrs = new Set<string>();
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let tr = 0
                | (modGet(p, x - 1, y - 1) << 9)
                | (modGet(p, x, y - 1) << 8)
                | (modGet(p, x + 1, y - 1) << 7)
                | (modGet(p, x - 1, y) << 6)
                | (modGet(p, x, y) << 5)
                | (modGet(p, x + 1, y) << 4)
                | (modGet(p, x - 1, y + 1) << 3)
                | (modGet(p, x, y + 1) << 2)
                | (modGet(p, x + 1, y + 1) << 1)
                | (modGet(p, x, y) << 0)
            ;
            let letter = classifyTransition(tr);
            let trName = Object.entries(INT.trs).filter(x => x[1].includes((tr >> 1) & ~(1 << 4)))[0][0];
            xorTrs.add(letter + trName);
        }
    }
    let symmetryStr = ['INT'].concat(Array.from(xorTrs).map(tr => `^${tr}`)).join(', ');
    lines.push(symmetryStr + ':');
    let basis = findBasis(parseSymmetry(symmetryStr));
    if (typeof basis === 'string') {
        lines.push(basis);
    } else {
        lines.push(basisToString(basis));
    }
    console.log('\n' + lines.join('\n'));
}
