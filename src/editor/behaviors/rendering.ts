
import {Pattern} from '../../core/index.js';
import {RPFPattern, Rotation, ROTATION_COMBINE, TRANSPOSE_ROTATIONS, transformCoordinates, transformCoordinatesOfPart} from '../rpf.js';
import {addHook} from '../base.js';


declare global {

    var fillOffset: number;
    var fillExpand: number;

}


interface RPFDrawStateDataPart {
    normal: string[];
    envelope: string[];
    connections: string[];
}

interface RPFDrawStateData {
    normal: RPFDrawStateDataPart;
    selected: RPFDrawStateDataPart;
    hover: RPFDrawStateDataPart;
}

// let isFirstFrame = true;
// let level = -1;

// function log(...args: unknown[]): void {
//     if (!isFirstFrame) {
//         return;
//     }
//     if (level === 0) {
//         console.log(...args);
//     } else {
//         console.log(' '.repeat(4 * level - 1), ...args);
//     }
// }

// let start = performance.now();

export function drawPattern(p: Pattern, states: string[], x: number = 0, y: number = 0, rotation?: Rotation, restore: boolean = true): false | {xOffset: number, yOffset: number, xMod: number, yMod: number} {
    ctx.save();
    let [pXOffset, pYOffset] = p.getFullOffset();
    // culling
    let minX = pXOffset + x;
    let minY = pYOffset + y;
    if (minX + p.width < -topLeftX || minY + p.height < -topLeftY || minX > -topLeftX + pixelWidth || minY > -topLeftY + pixelHeight) {
        return false;
    }
    let xOffset = -p.xOffset - topLeftX - x;
    let yOffset = -p.yOffset - topLeftY - y;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset -= xMod;
    yOffset -= yMod;
    let startY = Math.max(0, -yOffset) + (pYOffset - p.yOffset);
    let endY = p.height - Math.min(0, yOffset) - 1;
    let startX = Math.max(0, -xOffset) + (pXOffset - p.xOffset);
    let endX = p.width - Math.min(0, xOffset) - 1;
    // if (performance.now() - start < 1000) {
    //     console.log('drawing pattern', p, x, y, rotation, xOffset, yOffset, p.height, p.width, startX, endX, startY, endY);
    // }
    if (rotation && TRANSPOSE_ROTATIONS.has(rotation)) {
        let oldEndX = endX;
        let oldEndY = endY;
        endX = oldEndY - startY + startX;
        endY = oldEndX - startX + startY;
    }
    // if (performance.now() - start < 1000) {
    //     console.log(startX, endX, startY, endY, rotation);
    // }
    for (let screenY = startY; screenY <= endY; screenY++) {
        for (let screenX = startX; screenX <= endX; screenX++) {
            let x = screenX + xOffset;
            let y = screenY + yOffset;
            if (rotation && rotation !== 'F') {
                let height = p.height;
                let width = p.width;
                if (TRANSPOSE_ROTATIONS.has(rotation)) {
                    let temp = height;
                    height = width;
                    width = temp;
                }
                [x, y] = transformCoordinates(x, y, height, width, rotation);
            }
            let cell = p.get(x, y);
            // if (performance.now() - start < 1000 && states[0] !== theme.envelope) {
            //     console.log(`cell is ${cell}: oldX = ${screenX + xOffset}, oldY = ${screenY + yOffset}, x = ${x}, y = ${y}`);
            // }
            if (cell !== 0) {
                ctx.fillStyle = states[cell - 1];
                ctx.fillRect(screenX - fillOffset, screenY - fillOffset, 1 + fillExpand, 1 + fillExpand);
            }
        }
    }
    if (restore) {
        ctx.restore();
    }
    return {xOffset, yOffset, xMod, yMod};
}

export function drawRPF(p: RPFPattern, states: RPFDrawStateData, xPos: number, yPos: number, startRotation: Rotation, mode: 'normal' | 'selected' | 'hover', type: 'normal' | 'envelope' | 'connections'): boolean {
    // culling
    let [minX, minY] = p.getFullOffset();
    minX += xPos;
    minY += yPos;
    if (minX + p.width < -topLeftX || minY + p.height < -topLeftY || minX > -topLeftX + pixelWidth || minY > -topLeftY + pixelHeight) {
        return false;
    }
    // level++;
    // log('drawing RPF', p.key, xPos, yPos, startRotation, mode);
    if (p.envelope) {
        let data = p.envelope;
        let [x, y] = transformCoordinatesOfPart(data.x, data.y, p.height, p.width, data.p.height, data.p.width, startRotation);
        drawPattern(data.p, states[mode].envelope, x + xPos, y + yPos, startRotation);
    }
    // level++;
    if (p.conduit) {
        for (let ref of p.conduit.inputs.concat(p.conduit.outputs)) {
            let q = ref.p;
            if (!(q instanceof RPFPattern)) {
                continue;
            }
            let x = ref.x;
            let y = ref.y;
            // log(`drawing conduit RPF ${q.key}: x = ${x}, y = ${y}, value.rotation = ${ref.rotation}`);
            // log(`p.height = ${p.height}, p.width = ${p.width}, q.height = ${q.height}, q.width = ${q.width}, rotation = ${startRotation}`);
            [x, y] = transformCoordinatesOfPart(x, y, p.height, p.width, q.height, q.width, startRotation);
            let rotation = ROTATION_COMBINE[startRotation][ref.rotation];
            // log(`transformed: x = ${x}, y = ${y}, rotation = ${rotation}`);
            x += xPos;
            y += yPos;
            // log(`added: x = ${x}, y = ${y}`);
            if (q.periodic && (q.periodic.dx !== 0 || q.periodic.dy !== 0) && q.envelope) {
                let [dx, dy] = transformCoordinates(q.periodic.dx, q.periodic.dy, 1, 1, rotation);
                if (p.conduit.inputs.includes(ref) && !TRANSPOSE_ROTATIONS.has(rotation)) {
                    dx = -dx;
                    dy = -dy;
                }
                let x2 = x + q.envelope.x;
                let y2 = y + q.envelope.y;
                for (let i = 0; i < 65536; i++) {
                    if (!drawPattern(q.envelope.p, states[mode].envelope, x2, y2, rotation)) {
                        break;
                    }
                    x2 += dx;
                    y2 += dy;
                }
            }
            drawRPF(q, states, x, y, rotation, mode, 'connections');
        }
    }
    for (let ref of p.data) {
        let q = ref.p;
        let mode2: typeof mode;
        if (mode === 'selected' || sel.has(ref)) {
            mode2 = 'selected';
        } else if (mode === 'hover' || ref === hover) {
            mode2 = 'hover';
        } else {
            mode2 = 'normal';
        }
        let x = ref.x;
        let y = ref.y;
        // log(`drawing ${q instanceof RPFPattern ? `RPF ${q.key}` : `pattern`}: x = ${x}, y = ${y}, ref.rotation = ${ref.rotation}`);
        // log(`p.height = ${p.height}, p.width = ${p.width}, q.height = ${q.height}, q.width = ${q.width}, rotation = ${startRotation}`);
        [x, y] = transformCoordinatesOfPart(x, y, p.height, p.width, q.height, q.width, startRotation);
        let rotation = ROTATION_COMBINE[startRotation][ref.rotation];
        // log(`transformed: x = ${x}, y = ${y}, rotation = ${rotation}`);
        x += xPos;
        y += yPos;
        // log(`added: x = ${x}, y = ${y}`);
        // culling
        let [minX, minY] = q.getFullOffset();
        minX += x;
        minY += y;
        if (minX + q.width < -topLeftX || minY + q.height < -topLeftY || minX > -topLeftX + pixelWidth || minY > -topLeftY + pixelHeight) {
            continue;
        }
        if (q instanceof RPFPattern) {
            drawRPF(q, states, x, y, rotation, mode2, type);
        } else {
            drawPattern(q, states[mode2][type], x, y, rotation);
        }
    }
    // level--;
    // level--;
    return true;
}

(globalThis as any).drawPattern = drawPattern;
(globalThis as any).drawRPF = drawRPF;


let selectMenuElt = getElement('select-menu');

addHook('frame', () => {
    let states: RPFDrawStateData = {
        normal: {
            normal: p.rule.states === 2 ? [theme.twoState] : theme.multiState(p.rule.states),
            envelope: [theme.envelope],
            connections: [theme.connections],
        },
        selected: {
            normal: [theme.selection],
            envelope: [theme.selectedEnvelope],
            connections: [theme.selectedConnections],
        },
        hover: {
            normal: [theme.hover],
            envelope: [theme.hoverEnvelope],
            connections: [theme.hoverConnections],
        },
    };
    ctx.fillStyle = theme.empty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRPF(p, states, 0, 0, 'F', 'normal', 'normal');
    if (pasting) {
        let q = pasting[0];
        drawRPF(q, states, mouseX, mouseY, pasting[1], 'normal', 'normal');
        ctx.save();
        let xOffset = -topLeftX - mouseX;
        let yOffset = -topLeftY - mouseY;
        let xMod = xOffset % 1;
        let yMod = yOffset % 1;
        ctx.scale(scale, scale);
        ctx.translate(-xMod, -yMod);
        xOffset -= xMod;
        yOffset -= yMod;
        ctx.fillStyle = theme.pasting;
        ctx.fillRect(-xOffset - fillOffset, -yOffset - fillOffset, q.width + fillExpand, q.height + fillExpand);
        ctx.restore();
    }
    // isFirstFrame = false;
});
