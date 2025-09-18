
import {Pattern} from '../pattern.js';


const B1C_NW = 256;
const B1C_NE = 64;
const B1C_SW = 4;
const B1C_SE = 1;


export function runMAPGen(p: Pattern, trs?: Uint8Array): void {
    if (!trs) {
        throw new Error('trs variable is missing');
    }
    let height = p.height;
    let width = p.width;
    let size = p.size;
    let data = p.data.map(x => x === 1 ? 1 : 0);
    let lastRow = size - width;
    let expandUp = 0;
    let expandDown = 0;
    let upExpands = new Uint8Array(width);
    let downExpands = new Uint8Array(width);
    for (let i = 1; i < width - 1; i++) {
        if (trs[(data[i - 1] << 2) | (data[i] << 1) | data[i + 1]]) {
            expandUp = 1;
            upExpands[i] = 1;
        }
        if (trs[(data[lastRow + i - 1] << 8) | (data[lastRow + i] << 7) | (data[lastRow + i + 1] << 6)]) {
            expandDown = 1;
            downExpands[i] = 1;
        }
    }
    let expandLeft = 0;
    let expandRight = 0;
    let leftExpands = new Uint8Array(height);
    let rightExpands = new Uint8Array(width);
    for (let i = width; i < lastRow; i += width) {
        if (trs[(data[i - width] << 6) | (data[i] << 3) | data[i + width]]) {
            expandLeft = 1;
            leftExpands[i] = 1;
        }
        if (trs[(data[i - 1] << 8) | (data[i + width - 1] << 5) | (data[i + width + width - 1] << 2)]) {
            expandRight = 1;
            rightExpands[i] = 1;
        }
    }
    let b1cnw = (trs[B1C_NW] && data[0]) ? 1 : 0;
    let b1cne = (trs[B1C_NE] && data[width - 1]) ? 1 : 0;
    let b1csw = (trs[B1C_SW] && data[lastRow]) ? 1 : 0;
    let b1cse = (trs[B1C_SE] && data[size - 1]) ? 1 : 0;
    if (b1cnw || b1cne) {
        expandUp = 1;
    }
    if (b1csw || b1cse) {
        expandDown = 1;
    }
    if (b1cnw || b1csw) {
        expandLeft = 1;
    }
    if (b1cne || b1cse) {
        expandRight = 1;
    }
    height += expandUp + expandDown;
    width += expandLeft + expandRight;
    size = height * width;
    lastRow = size - width;
    let oX = expandLeft + expandRight;
    let oY = expandUp ? width : 0;
    let oStart = oY + expandLeft;
    let oSize = oY + oX * height - 1;
    let oLast = oSize - oX;
    let out = new Uint8Array(size);
    out[0] = b1cnw;
    out[width] = b1cne;
    out[size - width] = b1csw;
    out[size - 1] = b1cse;
    if (expandUp) {
        out.set(upExpands, expandLeft);
    }
    if (expandDown) {
        out.set(downExpands, oSize - width - expandRight);
    }
    if (expandLeft) {
        for (let i = 0; i < height; i++) {
            out[oStart + i * (width + oX)] = leftExpands[i];
        }
    }
    if (expandRight) {
        for (let i = 0; i < height; i++) {
            out[oStart + (i + 1) * (width + oX) - 1] = rightExpands[i];
        }
    }
    // top-left cell
    if (trs[(data[0] << 4) | (data[1] << 3) | (data[width] << 1) | data[width + 1]]) {
        out[oStart] = 1;
    } else if (p.data[0]) {
        out[oStart] = (p.data[0] + 1) % p.states;
    }
    // top-right cell
    let width2 = width << 1;
    if (trs[(data[width - 2] << 5) | (data[width - 1] << 4) | (data[width2 - 2] << 2) | (data[width2 - 1] << 1)]) {
        out[oStart + oX + width - 1] = 1;
    } else if (p.data[width - 1]) {
        out[oStart + oX + width - 1] = (p.data[width - 1] + 1) % p.states;
    }
    // bottom-left cell
    let secondLastRow = size - width2;
    if (trs[(data[secondLastRow] << 7) | (data[secondLastRow + 1] << 6) | (data[lastRow] << 4) | (data[lastRow + 1] << 3)]) {
        out[oLast + lastRow] = 1;
    } else if (p.data[lastRow]) {
        out[oLast + lastRow] = (p.data[lastRow] + 1) % p.states;
    }
    // bottom-right cell
    if (trs[(data[lastRow - 2] << 8) | (data[lastRow - 1] << 7) + (data[size - 2] << 5) + (data[size - 1] << 4)]) {
        out[oSize - 1] = 1;
    } else if (p.data[0]) {
        out[oSize - 1] = (p.data[size - 1] + 1) % p.states;
    }
    // top and bottom rows
    let loc1 = oStart;
    let loc2 = oLast;
    let ipw = width;
    let j = lastRow;
    let jmw = j - width - 1;
    for (let i = 1; i < width - 1; i++) {
        ipw++;
        j++;
        jmw++;
        loc1++;
        loc2++;
        if (trs[(data[i - 1] << 5) | (data[i] << 4) | (data[i + 1] << 3) | (data[ipw - 1] << 2) | (data[ipw] << 1) | data[ipw + 1]]) {
            out[loc1] = 1;
        } else if (p.data[i]) {
            out[loc1] = (p.data[i] + 1) % p.states;
        }
        if (trs[(data[jmw - 1] << 8) | (data[jmw] << 7) | (data[jmw + 1] << 6) | (data[j - 1] << 5) | (data[j] << 4) | (data[j + 1] << 3)]) {
            out[loc2] = 1;
        } else if (p.data[j]) {
            out[loc2] = (p.data[j] + 1) % p.states;
        }
    }
    // left and right columns
    loc1 = oStart;
    loc2 = oStart + width - 1;
    let imw = 0;
    ipw = width * 2;
    let ipw2 = width * 3;
    for (let i = width; i < lastRow; i++) {
        loc1 += width + oX;
        loc2 += width + oX;
        imw++;
        ipw++;
        ipw2++;
        if (trs[(data[imw] << 7) | (data[imw + 1] << 6) | (data[i] << 4) | (data[i + 1] << 3) | (data[ipw] << 1) | data[ipw + 1]]) {
            out[loc1] = 1;
        } else if (p.data[i]) {
            out[loc1] = (p.data[i] + 1) % p.states;
        }
        if (trs[(data[i - 2] << 8) | (data[i - 1] << 7) | (data[ipw - 2] << 5) | (data[ipw - 1] << 4) | (data[ipw2 - 2] << 1) | data[ipw2 - 1]]) {
            out[loc2] = 1;
        } else if (p.data[j]) {
            out[loc2] = (p.data[j] + 1) % p.states;
        }
    }
    // middle
    let loc = oY + width + 1;
    let i = width + 1;
    imw = 1;
    ipw = i + width;
    for (let y = 1; y < height - 1; y++) {
        loc += oX;
        for (let x = 1; x < width - 1; x++) {
            if (trs[(data[imw - 1] << 8) + (data[imw] << 7) + (data[imw + 1] << 6) + (data[i - 1] << 5) + (data[i] << 4) + (data[i + 1] << 3) + (data[ipw - 1] << 2) + (data[ipw] << 1) + data[ipw + 1]]) {
                out[loc] = 1;
            } else if (p.data[i]) {
                out[loc] = (p.data[i] + 1) % p.states;
            }
            i++;
            loc++;
            imw++;
            ipw++;
        }
        i += 2;
    }
    p.height = height;
    p.width = width;
    p.data = out;
    p.xOffset -= expandLeft;
    p.yOffset -= expandUp;
    p.generation++;
}
