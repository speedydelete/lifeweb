
import {Pattern} from './pattern.js';


export function run1d(p: Pattern, trs?: Uint8Array): void {
    if (!trs) {
        throw new Error('trs variable is missing');
    }
    let range = Math.round((Math.log2(trs.length) - 1) / 2);
    let width = p.width;
    let data = p.data.slice(p.size - width);
    let out = new Uint8Array(width + range * 2);
    let mask = (1 << (range * 2 + 1)) - 1;
    let key = 0;
    let i = 0;
    let j = 0;
    let expandLeft = 0;
    let expandRight = 0;
    for (; i < range; i++) {
        key = (key << 1) | (data[j] === 1 ? 1 : 0);
        out[i] = trs[key];
        if (trs[key] && expandLeft === 0) {
            expandLeft = range - i;
        }
    }
    for (; i < width; i++) {
        key = ((key << 1) & mask) | (data[j] === 1 ? 1 : 0);
        out[i] = trs[key];
    }
    for (; i < width + range; i++) {
        key = (key << 1) & mask;
        out[i] = trs[key];
        if (trs[key]) {
            expandRight = i - width;
        }
    }
    p.height++;
    p.width = width;
    let outData = new Uint8Array(p.height * width);
    if (expandLeft === 0 && expandRight === 0) {
        outData.set(p.data);
        outData.set(p.data, p.size);
    } else {
        let expand = expandLeft + expandRight;
        let i = expandLeft;
        let j = 0;
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                outData[i++] = p.data[j++];
            }
            i += expand;
        }
        outData.set(out.slice(expandLeft, out.length - expandRight), i);
    }
    p.size = p.height * p.width;
    p.data = outData;
}


export function run1dGenerations(p: Pattern, trs?: Uint8Array): void {
    if (!trs) {
        throw new Error('trs variable is missing');
    }
    let range = trs[0];
    trs = trs.slice(2);
    let width = p.width;
    let data = p.data.slice(p.size - width);
    let noCheck = data.map(x => x > 1 ? 1 : 0);
    let out = new Uint8Array(width + range * 2);
    let mask = (1 << (range * 2 + 1)) - 1;
    let key = 0;
    let i = 0;
    let j = 0;
    let expandLeft = 0;
    let expandRight = 0;
    for (; i < range; i++) {
        key = (key << 1) | (data[j] === 1 ? 1 : 0);
        if (noCheck[j]) {
            out[i] = (data[j] + 1) % p.states;
        } else {
            out[i] = trs[key];
            if (trs[key] && expandLeft === 0) {
                expandLeft = range - i;
            }
        }
    }
    for (; i < width; i++) {
        key = ((key << 1) & mask) | (data[j] === 1 ? 1 : 0);
        if (noCheck[j]) {
            out[i] = (data[j] + 1) % p.states;
        } else {
            out[i] = trs[key];
        }
    }
    for (; i < width + range; i++) {
        key = (key << 1) & mask;
        if (noCheck[j]) {
            out[i] = (data[j] + 1) % p.states;
        } else {
            out[i] = trs[key];
            if (trs[key]) {
                expandRight = i - width;
            }
        }
    }
    p.height++;
    p.width = width;
    let outData = new Uint8Array(p.height * width);
    if (expandLeft === 0 && expandRight === 0) {
        outData.set(p.data);
        outData.set(p.data, p.size);
    } else {
        let expand = expandLeft + expandRight;
        let i = expandLeft;
        let j = 0;
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                outData[i++] = p.data[j++];
            }
            i += expand;
        }
        outData.set(out.slice(expandLeft, out.length - expandRight), i);
    }
    p.size = p.height * p.width;
    p.data = outData;
}


export function parse1dRule(range: number, num: number): Uint8Array {
    let out = new Uint8Array(range * 2 + 1);
    for (let i = 0; i < out.length; i++) {
        if (num & (1 << i)) {
            out[i] = 1;
        }
    }
    return out;
}
