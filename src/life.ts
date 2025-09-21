
import {Pattern} from './pattern.js';


/*
the idea here is that we check whether it expands in any of the 4 directions by checking for B3i
and precompute the data for bounding-box expansions while that is done
then we have to offset everything depending on the bounding-box expansion, which makes the code messy
*/

export function runLife(p: Pattern): void {
    let width = p.width;
    let height = p.height;
    let size = p.size;
    let data = p.data;
    let lastRow = size - width;
    let expandUp = 0;
    let expandDown = 0;
    let upExpands = new Uint8Array(width);
    let downExpands = new Uint8Array(width);
    for (let i = 1; i < width - 1; i++) {
        if (data[i - 1] && data[i] && data[i + 1]) {
            expandUp = 1;
            upExpands[i] = 1;
        }
        if (data[lastRow + i - 1] && data[lastRow + i] && data[lastRow + i + 1]) {
            expandDown = 1;
            downExpands[i] = 1;
        }
    }
    let expandLeft = 0;
    let expandRight = 0;
    let leftExpands = new Uint8Array(height);
    let rightExpands = new Uint8Array(width);
    for (let i = width; i < lastRow; i += width) {
        if (data[i - width] && data[i] && data[i + width]) {
            expandLeft = 1;
            leftExpands[i] = 1;
        }
        if (data[i - 1] && data[i + width - 1] && data[i + width + width - 1]) {
            expandRight = 1;
            rightExpands[i] = 1;
        }
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
    let n = data[1] + data[width] + data[width + 1];
    if (n === 3 || (n === 2 && data[0])) {
        out[oStart] = 1;
    }
    // top-right cell
    let width2 = width << 1;
    n = data[width - 2] + data[width2 - 2] + data[width2 - 1];
    if (n === 3 || (n === 2 && data[width - 1])) {
        out[oStart + oX + width - 1] = 1;
    }
    // bottom-left cell
    let secondLastRow = size - width2;
    n = data[secondLastRow] + data[secondLastRow + 1] + data[lastRow + 1];
    if (n === 3 || (n === 2 && data[lastRow])) {
        out[oLast + lastRow] = 1;
    }
    // bottom-right cell
    n = data[lastRow - 2] + data[lastRow - 1] + data[size - 2];
    if (n === 3 || (n === 2 && data[size - 1])) {
        out[oSize - 1] = 1;
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
        n = data[i - 1] + data[i + 1] + data[ipw - 1] + data[ipw] + data[ipw + 1];
        if (n === 3 || (n === 2 && data[i])) {
            out[oStart + i] = 1;
        }
        n = data[j - 1] + data[j + 1] + data[jmw - 1] + data[jmw] + data[jmw + 1];
        if (n === 3 || (n === 2 && data[i])) {
            out[oLast + i] = 1;
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
        n = data[imw] + data[imw + 1] + data[i + 1] + data[ipw] + data[ipw + 1];
        if (n === 3 || (n === 2 && data[i])) {
            out[loc1] = 1;
        }
        n = data[i - 2] + data[i - 1] + data[ipw - 2] + data[ipw2 - 2] + data[ipw2 - 1];
        if (n === 3 || (n === 2 && data[ipw - 1])) {
            out[loc2] = 1;
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
            n = data[imw - 1] + data[imw] + data[imw + 1] + data[i - 1] + data[i + 1] + data[ipw - 1] + data[ipw] + data[ipw + 1];
            if (n === 3 || (n === 2 && data[i])) {
                out[loc] = 1;
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
    p.size = size;
    p.data = out;
    p.xOffset -= expandLeft;
    p.yOffset -= expandUp;
    p.generation++;
}
