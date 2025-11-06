
import {Pattern, RLE_CHARS} from './pattern.js';
import {MAPPattern} from './map.js';
import {identify} from './identify.js';
import {INTSeperator} from './intsep.js';


export function stabilize(p: Pattern, print?: ((data: string) => void) | undefined): number {
    p.run(60);
    let maxPeriod = 6;
    let pops: number[] = [];
    for (let i = 0; i < 6000; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pop === 0) {
            return 1;
        }
        for (let period = 1; period < Math.min(maxPeriod, Math.floor(pops.length / 15)); period++) {
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return period;
            }
        }
        if (i > 500 && i % 50 === 0) {
            for (let period = 1; period < Math.floor(i / 20); period++) {
                let diff = pop - pops[pops.length - period];
                let found = true;
                for (let j = 1; j < 16; j++) {
                    if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return period;
                }
            }
        }
        pops.push(pop);
        if (i === 60) {
            maxPeriod = 12;
        } else if (i === 120) {
            maxPeriod = 24;
        } else if (i === 240) {
            maxPeriod = 60;
        }
    }
    if (print) {
        print('Failed to detect periodic behavior!');
    }
    return 0;
}


// let i = 0;

function attemptCensus(sep: INTSeperator, limit: number, ignorePathologicals: boolean, print: ((data: string) => void) | undefined): null | {[key: string]: number} {
    let data = sep.getObjects().map(x => identify(x, limit, false));
    // data.forEach(x => delete x.hashes);
    // data = data.map(x => Object.assign({}, x, {phases: x.phases.map(y => '#C ' + y.xOffset + ' ' + y.yOffset + '\n' + y.toRLE())}));
    // let q = new MAPPattern(sep.height, sep.width, new Uint8Array(sep.groups), sep.trs, sep.ruleStr, sep.ruleSymmetry);
    // q.states = 256;
    // sep.ruleStr = 'B3/S23';
    // q.ruleStr = 'B3/S23Super';
    // if (i === 42) {
    //     throw new Error('\n\n' + sep.groups.join(' ') + '\n\n' + sep.toRLE() + '\n\n' + JSON.stringify(data, undefined, 4).replaceAll('\\n', '\n') + '\n\n' + q.toRLE());
    // } else {
    //     i++;
    // }
    let out: {[key: string]: number} = {};
    for (let {apgcode} of data) {
        if ((apgcode[0] === 'P' || apgcode === 'xs0_0') && !ignorePathologicals) {
            return null;
        }
        if (apgcode in out) {
            out[apgcode]++;
        } else {
            out[apgcode] = 1;
        }
        if (print) {
            if (apgcode[0] === 'x') {
                if (sep.ruleStr === 'B3/S23') {
                    if (apgcode[1] === 'p') {
                        if ((apgcode[2] !== '2' || apgcode[3] !== '_') && apgcode !== 'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401' && apgcode !== 'xp15_4r4z4r4') {
                            print('Rare oscillator detected: \x1b[1;31m' + apgcode + '\x1b[0m');
                        }
                    } else if (apgcode[1] === 'q' && apgcode !== 'xq4_153' && apgcode !== 'xq4_6frc' && apgcode !== 'xq4_27dee6' && apgcode !== 'xq4_27deee6') {
                        print('Rare spaceship detected: \x1b[1;34m' + apgcode + '\x1b[0m');
                    }
                }
            } else if (apgcode[0] === 'y') {
                print('Linear-growth pattern detected: \x1b[1;32m' + apgcode + '\x1b[0m');
            } else if (apgcode[0] === 'z') {
                print('Chaotic-growth pattern detected: \x1b[1;32m' + apgcode + '\x1b[0m');
            }
        }
    }
    return out;
}

export function censusINT(p: MAPPattern, knots: Uint8Array, print?: (data: string) => void): {[key: string]: number} {
    let period = stabilize(p, print);
    let step = period * 2;
    for (let i = 0; i < 5; i++) {
        let sep = new INTSeperator(p, knots);
        let data = attemptCensus(sep, step, false, print);
        if (data) {
            return data;
        }
        for (let i = 0; i < period * 8; i++) {
            sep.runGeneration();
            sep.resolveKnots();
            data = attemptCensus(sep, step, false, print);
            if (data) {
                return data;
            }
        }
        if (i === 4) {
            return attemptCensus(sep, step, true, print) as {[key: string]: number};
        }
        p.run(step);
        step *= 4;
    }
    if (print) {
        print('Unable to seperate objects!');
    }
    return {'PATHOLOGICAL': 1};
}


export async function getHashsoup(soup: string, symmetry: string, stdin?: string): Promise<{height: number, width: number, data: Uint8Array}> {
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
    } else if (symmetry.endsWith('stdin')) {
        if (!stdin) {
            return await getHashsoup(soup, symmetry.slice(0, -5));
        }
        let raw: number[][] = [];
        let num = '';
        let prefix = '';
        let currentLine: number[] = [];
        for (let i = 0; i < stdin.length; i++) {
            let char = stdin[i];
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
        return await getHashsoup(soup, symmetry.slice(0, -1), stdin);
    } else if (symmetry.endsWith('test') || symmetry.endsWith('Test')) {
        return await getHashsoup(soup, symmetry.slice(0, -4), stdin);
    } else if (symmetry.endsWith('spaceinvaders')) {
        return await getHashsoup(soup, symmetry.slice(0, -13), stdin);
    } else if (symmetry.startsWith('G')) {
        return await getHashsoup(soup, 'C' + symmetry.slice(1), stdin);
    } else if (symmetry.startsWith('H')) {
        return await getHashsoup(soup, 'D' + symmetry.slice(1), stdin);
    } else {
        throw new Error(`Invalid symmetry: ${symmetry}`);
    }
    return {height, width, data: out};
}


const LETTERS = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ0123456789';

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
        out += LETTERS[value];
    }
    return out;
}
