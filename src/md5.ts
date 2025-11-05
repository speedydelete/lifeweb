
const CONSTANTS = [0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee, 0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501, 0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be, 0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821, 0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa, 0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8, 0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed, 0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a, 0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c, 0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70, 0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05, 0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665, 0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039, 0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1, 0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1, 0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391];

const SHIFTS = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const BLOCKS = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
    1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12,
    5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2,
    0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9,
];

export function md5(data: Uint8Array): Uint8Array {
    let out = new Uint32Array(4);
    out[0] = 0x67452301;
    out[1] = 0xefcdab89;
    out[2] = 0x98badcfe;
    out[3] = 0x10325476;
    let blockCount = Math.ceil(data.length / 64);
    if (blockCount === 0) {
        blockCount = 1;
    }
    if (data.length % 64 >= 56) {
        blockCount++;
    }
    let padded = new Uint8Array(blockCount * 64);
    padded.set(data);
    padded[data.length] = 128;
    let blocks = new DataView(padded.buffer);
    blocks.setBigUint64(padded.length - 8, BigInt(data.length * 8), true);
    for (let block = 0; block < blockCount; block++) {
        let a = out[0];
        let b = out[1];
        let c = out[2];
        let d = out[3];
        for (let i = 0; i < 64; i++) {
            let f: number;
            if (i < 16) {
                f = (b & c) | (~b & d);
            } else if (i < 32) {
                f = (b & d) | (c & ~d);
            } else if (i < 48) {
                f = b ^ c ^ d;
            } else {
                f = c ^ (b | ~d);
            }
            f = (f + a + CONSTANTS[i] + blocks.getUint32((block * 4 + BLOCKS[i]) * 4, true)) | 0;
            a = d;
            d = c;
            c = b;
            b = (b + ((f << SHIFTS[i]) | (f >>> (32 - SHIFTS[i])))) | 0;
        }
        out[0] += a;
        out[1] += b;
        out[2] += c;
        out[3] += d;
    }
    let actualOut = new Uint8Array(16);
    let view = new DataView(actualOut.buffer);
    for (let i = 0; i < 4; i++) {
        view.setUint32(i * 4, out[i], true);
    }
    return actualOut;
}

export function stringMD5(data: string): string {
    let array = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) {
        array[i] = data.charCodeAt(i);
    }
    return Array.from(md5(array)).map(x => x.toString(16).padStart(2, '0')).join('')
}
