
import {Pattern, RLE_CHARS} from './pattern.js';
import {MAPPattern} from './map.js';
import {identify} from './identify.js';
import {INTSeperator} from './intsep.js';


let printElt: null | HTMLElement = null;

export function setPrintElement(elt: HTMLElement): void {
    printElt = elt;
}

function naivestab(p: Pattern): number {
    let prevPop = 0;
    let period = 12;
    let count = 0;
    let limit = 15;
    for (let i = 0; i < 1000; i++) {
        if (i === 40) {
            limit = 20;
        } else if (i === 60) {
            limit = 25;
        } else if (i === 80) {
            limit = 30;
        }
        if (i === 400) {
            period = 18;
        } else if (i === 500) {
            period = 24;
        } else if (i === 600) {
            period = 30;
        }
        p.run(period);
        let pop = p.population;
        if (pop === prevPop) {
            count++;
        } else {
            count = 0;
            period ^= 4;
        }
        if (count === limit) {
            return period;
        }
        prevPop = pop;
    }
    return 0;
}

export function stabilize(p: Pattern): number {
    let period = naivestab(p);
    if (period > 0) {
        return period;
    }
    let hashes: bigint[] = [];
    let gens: number[] = [];
    let gen = 0;
    for (let i = 0; i < 4000; i++) {
        p.run(30);
        let hash = p.hash64();
        for (let i = 0; i < hashes.length; i++) {
            if (hash < hashes[i]) {
                hashes = hashes.slice(0, i);
                gens = gens.slice(0, i);
                break;
            } else if (hash === hashes[i]) {
                let period = gen - gens[i];
                let prevPop = p.population;
                for (let j = 0; j < 20; j++) {
                    p.run(period);
                    let pop = p.population;
                    if (pop !== prevPop) {
                        if (period < 1280) {
                            period = 1280;
                        }
                        break;
                    }
                    prevPop = pop;
                }
                return period;
            }
        }
        gen += 30;
    }
    if (printElt) {
        printElt.innerHTML += '<br>Failed to detect periodic behavior!';
    } else {
        console.log('Failed to detect periodic behavior!');
    }
    p.run(1280);
    return 1280;
}


// let i = 0;
// let x = '';

function attemptCensus(sep: INTSeperator, limit: number, ignorePathologicals: boolean): null | {[key: string]: number} {
    let data = sep.getObjects().map(x => identify(x, limit, false));
    // data.forEach(x => delete x.hashes);
    // data = data.map(x => Object.assign({}, x, {phases: x.phases.map(y => '#C ' + y.xOffset + ' ' + y.yOffset + '\n' + y.toRLE())}));
    // let q = new MAPPattern(sep.height, sep.width, new Uint8Array(sep.groups), sep.trs, sep.ruleStr, sep.ruleSymmetry);
    // q.states = Math.max(...q.data);
    // let debug = sep.toRLE() + '\n\n' + JSON.stringify(data, undefined, 4) + '\n\n' + q.toRLE();
    // if (i === 1) {
    //     throw new Error('\n\n' + x + '\n\n' + debug);
    // } else {
    //     i++;
    // }
    // x = sep.toRLE();
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
        if (apgcode[0] === 'x') {
            if (sep.ruleStr === 'B3/S23') {
                if (apgcode[1] === 'p') {
                    if ((apgcode[2] !== '2' || apgcode[3] !== '_') && apgcode !== 'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401' && apgcode !== 'xp15_4r4z4r4') {
                        if (printElt) {
                            printElt.innerHTML += '<br>Rare oscillator detected: <span style="color: #ff7f7f">' + apgcode + '</span>';
                        } else {
                            console.log('Rare oscillator detected: %c' + apgcode, 'color: #ff7f7f');
                        }
                    }
                } else if (apgcode[1] === 'q' && apgcode !== 'xq4_153' && apgcode !== 'xq4_6frc' && apgcode !== 'xq4_27dee6' && apgcode !== 'xq4_27deee6') {
                    if (printElt) {
                        printElt.innerHTML += '<br>Rare spaceship detected: <span style="color: #5997ff">' + apgcode + '</span>';
                    } else {
                        console.log('Rare spaceship detected: %c' + apgcode, 'color: #5997ff');
                    }
                }
            }
        } else if (apgcode[0] === 'y') {
            if (printElt) {
                printElt.innerHTML += '<br>Linear-growth pattern detected: <span style="color: #7fff7f">' + apgcode + '</span>';
            } else {
                console.log('Linear-growth pattern detected: %c' + apgcode, 'color: #7fff7f');
            }
        } else if (apgcode[0] === 'z') {
            if (printElt) {
                printElt.innerHTML += '<br>Chaotic-growth pattern detected: <span style="color: #7fff7f">' + apgcode + '</span>';
            } else {
                console.log('Chaotic-growth pattern detected: %c' + apgcode, 'color: #7fff7f');
            }
        }
    }
    return out;
}

export function censusINT(p: MAPPattern, knots: Uint8Array): {[key: string]: number} {
    let out: {[key: string]: number} = {};
    stabilize(p);
    let step = 120;
    for (let i = 0; i < 5; i++) {
        let sep = new INTSeperator(p, knots);
        let data = attemptCensus(sep, step, false);
        if (data) {
            for (let key in data) {
                if (out[key]) {
                    out[key] += data[key];
                } else {
                    out[key] = data[key];
                }
            }
            return out;
        }
        for (let i = 0; i < step; i++) {
            sep.runGeneration();
            sep.resolveKnots();
            data = attemptCensus(sep, step, false);
            if (data) {
                for (let key in data) {
                    if (out[key]) {
                        out[key] += data[key];
                    } else {
                        out[key] = data[key];
                    }
                }
                return out;
            }
        }
        if (i === 4) {
            data = attemptCensus(sep, step, true);
        }
        p.run(step);
        step *= 4;
    }
    return out;
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

export function incHashsoup(soup: string): string {
    if (soup.endsWith('9')) {
        let data = Array.from(soup.slice(2)).map(x => LETTERS.indexOf(x));
        for (let i = data.length - 1; i >= 0; i--) {
            if (data[i] === LETTERS.length - 1) {
                data[i] = 0;
            } else {
                data[i]++;
                break;
            }
        }
        return 'k_' + data.map(x => LETTERS[x]).join('');
    } else {
        return soup.slice(0, -1) + LETTERS[LETTERS.indexOf(soup[soup.length - 1]) + 1];
    }
}

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
