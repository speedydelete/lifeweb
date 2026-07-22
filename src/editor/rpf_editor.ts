
import {Pattern} from '../core/index.js';
import {path, Rotation, ROTATION_COMBINE, TRANSPOSE_ROTATIONS, RPFReference, RPFPattern, File, transformCoordinates, transformCoordinatesOfPart} from './rpf.js';
import {run, addHook, pushUndo, parse} from './base.js';


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

function drawPattern(p: Pattern, states: string[], x: number = 0, y: number = 0, rotation?: Rotation, restore: boolean = true): false | {xOffset: number, yOffset: number, xMod: number, yMod: number} {
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

function drawRPF(p: RPFPattern, states: RPFDrawStateData, xPos: number, yPos: number, startRotation: Rotation, mode: 'normal' | 'selected' | 'hover', type: 'normal' | 'envelope' | 'connections'): boolean {
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

let interactionLevelElt = getElement('interaction-level');
let selectMenuElt = getElement('select-menu');

addHook('frame', () => {
    interactionLevelElt.textContent = String(interactionLevel);
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
    if (sel.size > 0) {
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
    }
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


export function editCellRPF(isStart: boolean): void {
    if (!editing) {
        throw new Error(`editCellRPF called with no editing`);
    }
    let x = mouseX - p.xOffset;
    let y = mouseY - p.yOffset;
    if (!isStart && x === prevEditX && y === prevEditY) {
        return;
    }
    prevEditX = x;
    prevEditY = y;
    x -= editing.x;
    y -= editing.y;
    let q = editing.p;
    if (x < 0 || y < 0) {
        let x2 = -Math.min(x, 0);
        let y2 = -Math.min(y, 0);
        q.offsetBy(x2, y2);
        x = Math.max(x, 0);
        y = Math.max(y, 0);
    }
    let cell = q.get(x, y);
    if (isStart) {
        drawDeleteMode = cell === drawState;
    }
    q.ensure(x + 1, y + 1);
    q.set(x, y, drawDeleteMode ? 0 : drawState);
    q.shrinkToFit();
    editing.x += q.xOffset;
    editing.y += q.yOffset;
    q.xOffset = 0;
    q.yOffset = 0;
}

addHook('click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`click-canvas called with non-MouseEvent value`);
    }
    if (event.buttons !== 1) {
        return;
    }
    if (pasting) {
        run('end-paste');
        return;
    }
    if (cursorMode === 'edit') {
        pushUndo();
        editCellRPF(true);
    }
});

addHook('move-mouse-over-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
    }
    if (isDragging) {
        if (pasting) {
            return;
        }
        if (cursorMode === 'main') {
            topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
            topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
        } else if (cursorMode === 'edit') {
            editCellRPF(false);
        }
    } else {
        hover = p.getRefAt(mouseX, mouseY, interactionLevel);
    }
});

addHook('unclick-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`unclick-canvas called with non-MouseEvent value`);
    }
    if (cursorMode === 'main' && dragStart[0] === event.clientX && dragStart[1] === event.clientY) {
        let value = p.getRefAt(mouseX, mouseY, interactionLevel);
        if (value) {
            if (sel.has(value)) {
                sel.delete(value);
            } else {
                sel.add(value);
            }
        } else {
            sel.clear();
        }
        p.recomputeSizes();
    }
});

addHook('set-cursor-to-main', () => {
    if (cursorMode === 'edit' && editing) {
        sel.delete(editing);
        if (editing.p.population === 0) {
            p.remove(editing);
        }
    }
});

addHook('set-cursor-to-edit', () => {
    if (sel.size === 0) {
        editing = p.createRef(p.file.base.clearedCopy());
        p.add(editing);
        sel.add(editing);
    } else if (sel.size === 1) {
        editing = Array.from(sel)[0];
    } else {
        throw new Error(`Cannot edit multiple objects at once!`);
    }
});

addHook('inc-interaction-level', () => {
    interactionLevel++;
});

addHook('dec-interaction-level', () => {
    interactionLevel--;
    if (interactionLevel < 0) {
        interactionLevel = 0;
    }
});


addHook('sel-cancel', () => {
    if (sel.size === 0) {
        return;
    }
    pushUndo();
    sel.clear();
});

addHook('sel-group', () => {
    if (sel.size === 0) {
        return;
    }
    let key = prompt('Enter new object ID:');
    if (!key) {
        return;
    }
    pushUndo();
    let q = p.clearedCopy();
    q.key = key;
    for (let value of sel) {
        q.add(value);
    }
    let minX = Infinity;
    let minY = Infinity;
    for (let ref of q.data) {
        minX = Math.min(minX, ref.x);
        minY = Math.min(minY, ref.y);
    }
    for (let ref of q.data) {
        ref.x -= minX;
        ref.y -= minY;
    }
    for (let value of sel) {
        p.data.delete(value);
    }
    p.recomputeSizes();
    let ref = new RPFReference(p, q, minX, minY);
    p.add(ref);
    sel.clear();
    sel.add(ref);
    rpfFile.data[q.key] = q;
});

addHook('sel-ungroup', () => {
    if (sel.size === 0) {
        return;
    }
    pushUndo();
    for (let ref of sel) {
        if (!(ref.p instanceof RPFPattern)) {
            continue;
        }
        let parent = ref.parent;
        parent.data.delete(ref);
        for (let ref2 of ref.p.data) {
            ref2.parent = parent;
            parent.add(ref2);
            sel.add(ref2);
        }
    }
});

addHook('sel-move-up', () => {
    pushUndo();
    for (let value of sel) {
        value.y--;
    }
    p.recomputeSizes();
});

addHook('sel-move-down', () => {
    pushUndo();
    for (let value of sel) {
        value.y++;
    }
    p.recomputeSizes();
});

addHook('sel-move-left', () => {
    pushUndo();
    for (let value of sel) {
        value.x--;
    }
    p.recomputeSizes();
});

addHook('sel-move-right', () => {
    pushUndo();
    for (let value of sel) {
        value.x++;
    }
    p.recomputeSizes();
});

addHook('sel-clear', () => {
    pushUndo();
    for (let value of sel) {
        p.data.delete(value);
    }
    sel.clear();
    p.recomputeSizes();
});

addHook('sel-flip-horizontal', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('Bx');
    }
    p.recomputeSizes();
});

addHook('sel-flip-vertical', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('Fx');
    }
    p.recomputeSizes();
});

addHook('sel-rotate-left', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('L');
    }
    p.recomputeSizes();
});

addHook('sel-rotate-right', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('R');
    }
    p.recomputeSizes();
});

addHook('sel-rotate-180', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('B');
    }
    p.recomputeSizes();
});

addHook('sel-flip-diagonal', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('Lx');
    }
    p.recomputeSizes();
});

addHook('sel-flip-anti-diagonal', () => {
    pushUndo();
    for (let value of sel) {
        value.applyTransform('Rx');
    }
    p.recomputeSizes();
});

addHook('copy', () => {
    if (sel.size === 0) {
        navigator.clipboard.writeText(rpfFile.toString());
    } else if (sel.size === 1) {
        navigator.clipboard.writeText(Array.from(sel)[0].p.toString());
    } else {
        let q = p.clearedCopy();
        q.key = '__copy__';
        q.data = new Set();
        for (let value of sel) {
            q.data.add(value.copy(q));
        }
        q.recomputeSizes();
        q.offsetBy(-q.minX, -q.minY);
        navigator.clipboard.writeText(q.toString());
    }
});

addHook('start-paste', async event => {
    if (event) {
        event.preventDefault();
    }
    let text = await navigator.clipboard.readText();
    let q = parse(text, true);
    if (Array.isArray(q)) {
        alert(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}\n\n${q[2]}`);
        return;
    }
    if (!(q instanceof RPFPattern)) {
        if (!rpfFile) {
            alert(`No rpfFile when running RPF start-paste!`);
            return;
        }
        q = p.fromPattern(q);
    }
    if (!(q instanceof RPFPattern)) {
        throw new Error(`This error should not occur (please check devtools and report the traceback)`);
    }
    if (q.key === 'main') {
        q.key = '__copy__';
    }
    q.offsetBy(-q.minX, -q.minY);
    alert(q.width + ' ' + q.height);
    pasting = [q, 'F'];
    run('set-cursor-to-main');
});

addHook('end-paste', () => {
    if (!pasting) {
        return;
    }
    pushUndo();
    let q = pasting[0];
    let toAddTo = p;
    if (sel.size === 1) {
        let r = Array.from(sel)[0].p;
        if (r instanceof RPFPattern) {
            toAddTo = r;
        }
    }
    if (q.key === '__copy__') {
        for (let ref of q.data) {
            ref.x += mouseX;
            ref.y += mouseY;
            toAddTo.add(ref);
        }
    } else {
        toAddTo.add(new RPFReference(toAddTo, q, mouseX, mouseY, pasting[1]));
    }
    pasting = undefined;
});

addHook('select-all', event => {
    if (event) {
        event.preventDefault();
    }
    for (let value of p.data) {
        sel.add(value);
    }
});


addHook('canvas-drop', event => {
    if (!(event instanceof DragEvent)) {
        throw new Error(`canvas-drop called with non-DragEvent value`);
    }
    if (!(event.dataTransfer)) {
        throw new Error(`canvas-drop called with no data transfer`);
    }
    let [path, key] = event.dataTransfer.getData('application/x-lifeweb-editor-drag').split('\n');
    let file = fs.read(path);
    if (!(file instanceof File) || !file.rpf) {
        throw new Error(`This error should not occur (please check devtools and report the traceback)`);
    }
    let rpf = file.rpf;
    if (!(file.name in rpfFile.imports)) {
        rpfFile.imports[file.name] = rpf;
    }
    if (file.name === '/stdlib.rpf' && !rpfFile.starImports.includes(stdlib)) {
        rpfFile.starImports.push(stdlib);
    }
    pasting = [rpf.data[key], 'F'];
    run('set-cursor-to-main');
});


let rightElt = getElement('right');

let contextMenuElt = getElement('rpf-context-menu');
let contextMenuNameElt = getElement('cm-name');
let contextMenuPathElt = getElement('cm-path');
let contextMenuDescElt = getElement('cm-desc');

addHook('right-click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`right-click-canvas called with non-MouseEvent value`);
    }
    if (event.shiftKey) {
        return;
    }
    event.preventDefault();
    if (contextMenuShown) {
        contextMenuShown = false;
        contextMenuElt.style.display = 'none';
    } else {
        if (!hover) {
            return;
        }
        let q = hover.p;
        if (!(q instanceof RPFPattern)) {
            return;
        }
        contextMenuShown = true;
        let rect = rightElt.getBoundingClientRect();
        let x = event.clientX - rect.left + 4;
        let y = event.clientY - rect.top + 4;
        contextMenuElt.style.display = 'flex';
        contextMenuElt.style.left = x + 'px';
        contextMenuElt.style.top = y + 'px';
        contextMenuNameElt.textContent = q.getName(true) ?? '[unnamed]';
        contextMenuPathElt.textContent = path.join(q.file.path, );
        let desc = '';
        if (q.periodic) {
            desc += q.getTypeDescription() + '\n';
        }
        if (q.desc !== undefined) {
            desc += q.desc;
        }
        contextMenuDescElt.textContent = desc;
    }
});

addHook('window-click', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`window-click called with non-MouseEvent value`);
    }
    if (contextMenuShown && event.target instanceof HTMLElement && !contextMenuElt.contains(event.target)) {
        contextMenuShown = false;
        contextMenuElt.style.display = 'none';
    }
});


addHook('save', event => {
    if (event) {
        event.preventDefault();
    }
    if (currentFile !== undefined) {
        currentFile.write(rpfFile);
        currentFile.sync();
    }
});
