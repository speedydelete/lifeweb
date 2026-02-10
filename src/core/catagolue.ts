
/** Implements an apgsearch-style soup searcher. */

import {RuleError, RLE_CHARS} from './pattern.js';
import {createPattern} from './index.js';


/** Get an apgsearch/Catagolue hashsoup. */
export async function getHashsoup(soup: string, symmetry: string): Promise<{height: number, width: number, data: Uint8Array}> {
    let hash = new Uint8Array(await crypto.subtle.digest('SHA-256', (new TextEncoder()).encode(soup)));
    let height = 16;
    let width = 16;
    let out: Uint8Array;
    let base = new Uint8Array(256);
    for (let i = 0; i < 32; i++) {
        let loc = 8 * (2 * Math.floor(i / 2) + (1 - (i % 2)));
        base[loc++] = hash[i] & 1;
        base[loc++] = (hash[i] >> 1) & 1;
        base[loc++] = (hash[i] >> 2) & 1;
        base[loc++] = (hash[i] >> 3) & 1;
        base[loc++] = (hash[i] >> 4) & 1;
        base[loc++] = (hash[i] >> 5) & 1;
        base[loc++] = (hash[i] >> 6) & 1;
        base[loc++] = (hash[i] >> 7) & 1;
    }
    if (symmetry === 'C1') {
        return {height, width, data: base};
    } else if (symmetry === 'C2_1' || symmetry === 'C2_2' || symmetry === 'C2_4') {
        height = symmetry === 'C2_1' ? 31 : 32;
        width = symmetry === 'C2_4' ? 32 : 31;
        out = new Uint8Array(height * width);
        let loc1 = 480;
        let loc2 = 465;
        if (width === 32) {
            loc1 = 496;
            loc2 = 512;
        } else if (height === 32) {
            loc2 = 496;
        }
        for (let i = 0; i < 256; i += 16) {
            for (let j = 0; j < 16; j++) {
                let value = base[i + j];
                out[loc1 + 15 - j] = value;
                out[loc2 + j] = value;
            }
            loc1 -= width;
            loc2 += width;
        }
    } else if (symmetry === 'C4_1' || symmetry === 'C4_4') {
        height = 31;
        width = 31;
        let loc1 = 15;
        let loc2 = 480;
        let loc3 = 465;
        let loc4 = 480;
        if (symmetry === 'C4_4') {
            height = 32;
            width = 32;
            loc2 = 496;
            loc3 = 512;
            loc4 = 528;
        }
        out = new Uint8Array(height * width);
        for (let i = 0; i < 256; i += 16) {
            for (let j = 0; j < 15; j++) {
                let value = base[i + j];
                out[loc1 + width * j] = value;
                out[loc2 + 15 - j] = value;
                out[loc3 + j] = value;
                out[loc4 + width * (15 - j)] = value;
            }
            let value = base[i + 15];
            out[loc1 + width * 15] |= value;
            out[loc2] |= value;
            out[loc3 + 15] |= value;
            out[loc4] |= value;
            loc1--;
            loc2 -= width;
            loc3 += width;
            loc4++;
        }
    } else if (symmetry === 'D2_+1' || symmetry === 'D2_+2') {
        height = 31;
        width = 16;
        let loc1 = 240;
        let loc2 = loc1;
        if (symmetry === 'D2_+2') {
            height = 32;
            loc2 = 256;
        }
        out = new Uint8Array(height * width);
        for (let i = 0; i < 256; i += 16) {
            for (let j = 0; j < 16; j++) {
                let value = base[i + j];
                out[loc1 + j] = value;
                out[loc2 + j] = value; 
            }
            loc1 -= width;
            loc2 += width;
        }
    } else if (symmetry === 'D2_x') {
        out = base;
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < y; x++) {
                out[y * width + 15 - x] = out[x * width + 15 - y];
            }
        }
    } else if (symmetry === 'D4_+1' || symmetry === 'D4_+2' || symmetry === 'D4_+4' || symmetry === 'D8_1' || symmetry === 'D8_4') {
        if (symmetry.startsWith('D8')) {
            for (let y = 0; y < 16; y++) {
                for (let x = 0; x < y; x++) {
                    base[y * width + 15 - x] = base[x * width + 15 - y];
                }
            }
        }
        height = 31;
        width = 31;
        let loc1 = 465;
        let loc2 = 480;
        let loc3 = 465;
        let loc4 = 480;
        if (symmetry === 'D4_+2') {
            width = 32;
            loc1 = 480;
            loc2 = 496;
            loc3 = 480;
            loc4 = 496;
        } else if (symmetry === 'D4_+4' || symmetry === 'D8_4') {
            height = 32;
            width = 32;
            loc1 = 480;
            loc2 = 496;
            loc3 = 512;
            loc4 = 528;
        }
        out = new Uint8Array(height * width);
        for (let i = 0; i < 256; i += 16) {
            for (let j = 0; j < 16; j++) {
                let value = base[i + j];
                out[loc1 + j] = value;
                out[loc2 + 15 - j] = value;
                out[loc3 + j] = value;
                out[loc4 + 15 - j] = value;
            }
            loc1 -= width;
            loc2 -= width;
            loc3 += width;
            loc4 += width;
        }
    } else if (symmetry === 'D4_x1' || symmetry === 'D4_x4') {
        let base2 = new Uint8Array(256);
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < y; x++) {
                let value = base[(15 - x) * width + y];
                base2[y * width + x] = value;
                base2[x * width + y] = value;
            }
            base2[y * width + y] = base[(15 - y) * width + y];
        }
        for (let y = 0; y < 16; y++) {
            for (let x = 0; x < y; x++) {
                base[y * width + 15 - x] = base[x * width + 15 - y];
            }
        }
        height = 31;
        width = 31;
        let loc1 = 0;
        let loc2 = 480;
        let loc3 = 465;
        let loc4 = 945;
        if (symmetry === 'D4_x4') {
            height = 32;
            width = 32;
            loc2 = 496;
            loc3 = 512;
            loc4 = 1008;
        }
        out = new Uint8Array(height * width);
        for (let i = 0; i < 256; i += 16) {
            for (let j = 0; j < 16; j++) {
                out[loc1 + j] |= base2[i + j];
                out[loc2 + 15 - j] |= base[i + j];
                out[loc3 + j] |= base[i + j];
                out[loc4 + 15 - j] |= base2[i + j];
            }
            loc1 += width;
            loc2 -= width;
            loc3 += width;
            loc4 -= width;
        }
    } else if (symmetry === '1x256') {
        height = 1;
        width = 256;
        out = base;
        for (let i = 0; i < 128; i += 16) {
            for (let j = 0; j < 16; j++) {
                let temp = out[i + j];
                out[i + j] = out[240 - i + j];
                out[240 - i + j] = temp;
            }
        }
    } else if (symmetry === '2x128') {
        height = 2;
        width = 128;
        out = base;
        for (let i = 0; i < 256; i += 128) {
            for (let j = 0; j < 64; j += 16) {
                for (let k = 0; k < 16; k++) {
                    let temp = out[i + j + k];
                    out[i + j + k] = out[i + 112 - j + k];
                    out[i + 112 - j + k] = temp;
                }
            }
        }
    } else if (symmetry === '4x64') {
        height = 4;
        width = 64;
        out = base;
        for (let i = 0; i < 256; i += 64) {
            for (let j = 0; j < 16; j++) {
                let temp = out[i + j];
                out[i + j] = out[i + 48 + j];
                out[i + 48 + j] = temp;
                temp = out[i + 16 + j];
                out[i + 16 + j] = out[i + 32 + j];
                out[i + 32 + j] = temp;
            }
        }
    } else if (symmetry === '8x32') {
        height = 8;
        width = 32;
        out = base;
        for (let i = 0; i < 256; i += 32) {
            for (let j = 0; j < 16; j++) {
                let temp = out[i + j];
                out[i + j] = out[i + 16 + j];
                out[i + 16 + j] = temp;
            }
        }
    } else if (symmetry.endsWith('stdin')) {
        let data = symmetry.slice(1);
        let raw: number[][] = [];
        let num = '';
        let prefix = '';
        let currentLine: number[] = [];
        for (let i = 0; i < data.length; i++) {
            let char = data[i];
            if (char === 'b' || char === 'o') {
                let value = char === 'o' ? 1 : 0;
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('0123456789'.includes(char)) {
                num += char;
            } else if (char === '\u0024') {
                raw.push(currentLine);
                currentLine = [];
                if (num !== '') {
                    let count = parseInt(num);
                    for (let i = 1; i < count; i++) {
                        raw.push([]);
                    }
                    num = '';
                }
            } else if (char === '.') {
                if (num === '') {
                    currentLine.push(0);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(0);
                    }
                    num = '';
                }
            } else if ('ABCDEFGHIJKLMNOPQRSTUVWX'.includes(char)) {
                if (prefix) {
                    char = prefix + char;
                }
                let value = RLE_CHARS.indexOf(char);
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('pqrstuvwxy'.includes(char)) {
                prefix = char;
            }
        }
        raw.push(currentLine);
        height = raw.length;
        width = Math.max(...raw.map(x => x.length));
        for (let row of raw) {
            while (row.length < width) {
                row.push(0);
            }
        }
        out = new Uint8Array(raw.flat());
    } else if (symmetry.endsWith('_')) {
        return await getHashsoup(soup, symmetry.slice(0, -1));
    } else if (symmetry.endsWith('test') || symmetry.endsWith('Test')) {
        return await getHashsoup(soup, symmetry.slice(0, -4));
    } else if (symmetry.endsWith('spaceinvaders')) {
        return await getHashsoup(soup, symmetry.slice(0, -13));
    } else if (symmetry.startsWith('G')) {
        return await getHashsoup(soup, 'C' + symmetry.slice(1));
    } else if (symmetry.startsWith('H')) {
        return await getHashsoup(soup, 'D' + symmetry.slice(1));
    } else if (symmetry.startsWith('i')) {
        let data = await getHashsoup(soup, symmetry.slice(1));
        height = data.height * 2;
        width = data.width * 2;
        out = new Uint8Array(height * width);
        let i = 0;
        for (let y = 0; y < height; y += 2) {
            for (let x = 0; x < width; x += 2) {
                let value = data.data[i++];
                out[y * width + x] = value;
                out[y * width + x + 1] = value;
                out[(y + 1) * width + x] = value;
                out[(y + 1) * width + x + 1] = value;
            }
        }
    } else {
        throw new Error(`Invalid symmetry: ${symmetry}`);
    }
    return {height, width, data: out};
}


const HASHSOUP_LETTERS = 'abcdefghijkmnpqrstuvwxyzZ0123456789';

/** Get a random apgsearch/Catagolue hashsoup. */
export function randomHashsoup(): string {
    let data = crypto.getRandomValues(new Uint8Array(16));
    let out = 'k_';
    let i = 0;
    for (let loc = 0; loc < 12; loc++) {
        let value = 0;
        do {
            value = data[i++] & 63;
            if (i === data.length) {
                crypto.getRandomValues(data);
                i = 0;
            }
        } while (value >= 56);
        out += HASHSOUP_LETTERS[value];
    }
    return out;
}


const HEX_CHARS = '0123456789abcdef';

/** Turns a rule into its Catagolue equivalent
 * @param namedRules An object mapping aliases to rules.
 */
export function toCatagolueRule(rule: string, customRules?: {[key: string]: string}): string {
    if (rule.includes('|')) {
        return 'xalternating_' + rule.split('|').map(x => toCatagolueRule(x, customRules)).join('_');
    }
    let ruleStr = createPattern(rule, customRules).ruleStr;
    if (ruleStr.includes('/')) {
        let parts = ruleStr.split('/');
        parts[0] = parts[0];
        parts[1] = parts[1];
        if (parts.length === 2) {
            if (parts[1].endsWith('H')) {
                return `b${parts[0].slice(1)}s${parts[1].slice(1, -1)}h`;
            } else {
                return `b${parts[0].slice(1)}s${parts[1].slice(1)}`;
            }
        } else {
            let isHex = false;
            if (parts[2].endsWith('H')) {
                isHex = true;
                parts[2] = parts[2].slice(-1);
            }
            let out = `g${parts[2]}b${parts[1]}s${parts[0]}`;
            if (isHex) {
                return out + 'h';
            } else {
                return out;
            }
        }
    } else if (ruleStr.startsWith('R')) {
        let parts = ruleStr.split(',');
        let r = parseInt(parts[0].slice(1));
        let c = parseInt(parts[1].slice(1));
        if (parts[2].startsWith('W')) {
            let w = parts[2].slice(1);
            if (c > 2) {
                return `xg${c}r${r}w${w}`;
            } else {
                return `xr${r}w${w}`;
            }
        }
        let s: number[] = [];
        let b: number[] = [];
        let parsingB = false;
        parts[2] = parts[2].slice(1);
        let n: string | null = null;
        for (let part of parts.slice(2)) {
            if (part.length === 0) {
                continue;
            } else if (part.startsWith('B')) {
                parsingB = true;
                part = part.slice(1);
            } else if (part.startsWith('N')) {
                n = part.slice(1);
                continue;
            }
            if (parsingB) {
                b.push(parseInt(part));
            } else {
                s.push(parseInt(part));
            }
        }
        let out = 'r' + r + 'b';
        if (c > 2) {
            out = 'g' + c + out;
        }
        for (let x of [b, s]) {
            for (let i = (2*r + 1)**2 - 1; i > 0; i -= 4) {
                let value = 0;
                if (b.includes(i)) {
                    value |= 8;
                }
                if (b.includes(i - 1)) {
                    value |= 4;
                }
                if (b.includes(i - 2)) {
                    value |= 2;
                }
                if (b.includes(i - 3)) {
                    value |= 1;
                }
                out += HEX_CHARS[value];
            }
            if (x === b) {
                out += 's';
            }
        }
        if (n !== null) {
            out = 'x' + out + 'n';
            if (n === '*') {
                out += 'star';
            } else if (n === '+') {
                out += 'plus';
            } else if (n === '#') {
                out += 'hash';
            } else if (n.startsWith('@')) {
                out += 'at' + n.slice(1);
            } else {
                out += n.toLowerCase();
            }
        }
        if (out.endsWith('h')) {
            out += 'x';
        }
        return out;
    } else if (ruleStr.startsWith('MAP')) {
        if (ruleStr.length < 89) {
            // @ts-ignore
            if (typeof alert === 'function') {
                // @ts-ignore
                alert('bruh');
            }
            throw new RuleError('bruh');
        }
        let out = 'map' + ruleStr.slice(3, 88);
        if (ruleStr.length > 89 && ruleStr[89] === '/') {
            out = 'g' + parseInt(ruleStr.slice(90)) + out;
        }
        if (out.endsWith('h')) {
            out += 'x';
        }
        return 'x' + out;
    } else if (ruleStr.startsWith('W')) {
        return 'xw' + ruleStr.slice(1);
    } else {
        let out = 'x';
        let end = ruleStr[0];
        for (let i = 1; i < ruleStr.length; i++) {
            let char = ruleStr[i];
            if ('ABCDEFGHJKLMNPQRSTUVWXY'.includes(char)) {
                char = char.toLowerCase();
                out += i + 'x';
            }
            end += char;
        }
        return out + end;
    }
}
