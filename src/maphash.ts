
export function createHashTransitions(trs: Uint8Array): Uint8Array {

}


export interface Chunk {
    a: number;
    b: number;
    top: Chunk | null;
    bottom: Chunk | null;
    left: Chunk | null;
    right: Chunk | null;
}

function runGeneration(c: Chunk, trs: Uint8Array): Chunk {
    let a = trs[c.a & 0xffff] | (trs[(c.a >> 8) & 0xffff] << 8) | (trs[c.a >> 16] << 16);
    let b = trs[c.b & 0xffff] | (trs[(c.b >> 8) & 0xffff] << 8) | (trs[c.b >> 16] << 16);
    let m = trs[((c.a & 0x3333) << 2) | ((c.b & 0xcccc) >> 2)];
    m |= trs[(((c.a >> 8) & 0x3333) << 2) | (((c.b >> 8) & 0xcccc) >> 2)] << 8;
    m |= trs[(((c.a >> 8) & 0x3333) << 2) | (((c.b >> 8) & 0xcccc) >> 2)] << 16;
    a |= (m & 0x4444) >> 2;
    b |= (m & 0x2222) << 2;
}
