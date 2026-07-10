
import {Rotation, ROTATION_COMBINE, TRANSPOSE_ROTATIONS, RPFReference, RPFPattern, File, transformCoordinates, transformCoordinatesOfPart} from './rpf.js';
import {run, addHook, pushUndo, parse} from './base.js';
import {drawPattern} from './normal_actions.js';


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
        if (mode === 'selected' || rpfSel.has(ref)) {
            mode2 = 'selected';
        } else if (mode === 'hover' || ref === rpfHover) {
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

(globalThis as any).drawRPF = drawRPF;

let interactionLevelElt = getElement('interaction-level');
let selectMenuElt = getElement('select-menu');

addHook(rpfActions, 'frame', () => {
    interactionLevelElt.textContent = String(interactionLevel);
    let states: RPFDrawStateData = {
        normal: {
            normal: p.rule.states === 2 ? [theme.twoState] : theme.multiState(p.rule.states),
            envelope: [theme.envelope],
            connections: [theme.connections],
        },
        selected: {
            normal: [theme.rpfSelection],
            envelope: [theme.selectedEnvelope],
            connections: [theme.selectedConnections],
        },
        hover: {
            normal: [theme.rpfHover],
            envelope: [theme.hoverEnvelope],
            connections: [theme.hoverConnections],
        },
    };
    ctx.fillStyle = theme.empty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRPF(rpfP, states, 0, 0, 'F', 'normal', 'normal');
    if (rpfSel.size > 0) {
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
    }
    if (rpfPasting) {
        let q = rpfPasting[0];
        drawRPF(q, states, mouseX, mouseY, rpfPasting[1], 'normal', 'normal');
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
    if (!rpfEditing) {
        throw new Error(`editCellRPF called with no rpfEditing`);
    }
    let x = mouseX - p.xOffset;
    let y = mouseY - p.yOffset;
    if (!isStart && x === prevEditX && y === prevEditY) {
        return;
    }
    prevEditX = x;
    prevEditY = y;
    x -= rpfEditing.x;
    y -= rpfEditing.y;
    let q = rpfEditing.p;
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
    rpfEditing.x += q.xOffset;
    rpfEditing.y += q.yOffset;
    q.xOffset = 0;
    q.yOffset = 0;
}

addHook(rpfActions, 'click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`click-canvas called with non-MouseEvent value`);
    }
    if (event.buttons !== 1) {
        return;
    }
    if (rpfPasting) {
        run('end-paste');
        return;
    }
    if (cursorMode === 'edit') {
        pushUndo();
        editCellRPF(true);
    }
});

addHook(rpfActions, 'move-mouse-over-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
    }
    if (isDragging) {
        if (rpfPasting) {
            return;
        }
        if (cursorMode === 'main') {
            topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
            topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
        } else if (cursorMode === 'edit') {
            editCellRPF(false);
        }
    } else {
        rpfHover = rpfP.getRefAt(mouseX, mouseY, interactionLevel);
    }
});

addHook(rpfActions, 'unclick-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`unclick-canvas called with non-MouseEvent value`);
    }
    if (cursorMode === 'main' && dragStart[0] === event.clientX && dragStart[1] === event.clientY) {
        let value = rpfP.getRefAt(mouseX, mouseY, interactionLevel);
        if (value) {
            if (rpfSel.has(value)) {
                rpfSel.delete(value);
            } else {
                rpfSel.add(value);
            }
        } else {
            rpfSel.clear();
        }
        rpfP.recomputeSizes();
    }
});

addHook(rpfActions, 'set-cursor-to-main', () => {
    if (cursorMode === 'edit' && rpfEditing) {
        rpfSel.delete(rpfEditing);
        if (rpfEditing.p.population === 0) {
            rpfP.remove(rpfEditing);
        }
    }
});

addHook(rpfActions, 'set-cursor-to-edit', () => {
    if (rpfSel.size === 0) {
        rpfEditing = new RPFReference(rpfP, rpfP.base.clearedCopy());
        rpfP.add(rpfEditing);
        rpfSel.add(rpfEditing);
    } else if (rpfSel.size === 1) {
        rpfEditing = Array.from(rpfSel)[0];
    } else {
        throw new Error(`Cannot edit multiple objects at once!`);
    }
});

addHook(rpfActions, 'set-cursor-to-select', () => {
    throw new Error(`Cannot set cursor to select in RPF mode`);
});

addHook(rpfActions, 'inc-interaction-level', () => {
    interactionLevel++;
});

addHook(rpfActions, 'dec-interaction-level', () => {
    interactionLevel--;
    if (interactionLevel < 0) {
        interactionLevel = 0;
    }
});


addHook(rpfActions, 'sel-cancel', () => {
    if (rpfSel.size === 0) {
        return;
    }
    pushUndo();
    rpfSel.clear();
});

addHook(rpfActions, 'sel-group', () => {
    if (rpfSel.size === 0) {
        return;
    }
    let key = prompt('Enter new object ID:');
    if (!key) {
        return;
    }
    pushUndo();
    let q = rpfP.clearedCopy();
    q.setKey(key);
    for (let value of rpfSel) {
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
    for (let value of rpfSel) {
        rpfP.data.delete(value);
    }
    rpfP.recomputeSizes();
    let ref = new RPFReference(rpfP, q, minX, minY);
    rpfP.add(ref);
    rpfSel.clear();
    rpfSel.add(ref);
    rpfFile.data[q.key] = q;
});

addHook(rpfActions, 'sel-ungroup', () => {
    if (rpfSel.size === 0) {
        return;
    }
    pushUndo();
    for (let ref of rpfSel) {
        if (!(ref.p instanceof RPFPattern)) {
            continue;
        }
        let parent = ref.parent;
        parent.data.delete(ref);
        for (let ref2 of ref.p.data) {
            ref2.parent = parent;
            parent.add(ref2);
            rpfSel.add(ref2);
        }
    }
});

addHook(rpfActions, 'sel-move-up', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.y--;
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-move-down', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.y++;
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-move-left', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.x--;
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-move-right', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.x++;
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-clear', () => {
    pushUndo();
    for (let value of rpfSel) {
        rpfP.data.delete(value);
    }
    rpfSel.clear();
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-horizontal', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('Bx');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-vertical', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('Fx');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-left', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('L');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-right', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('R');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-180', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('B');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-diagonal', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('Lx');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-anti-diagonal', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.applyTransform('Rx');
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'copy', () => {
    if (rpfSel.size === 0) {
        navigator.clipboard.writeText(rpfFile.toString());
    } else if (rpfSel.size === 1) {
        navigator.clipboard.writeText(Array.from(rpfSel)[0].p.toString(rpfFile, true));
    } else {
        let q = rpfP.clearedCopy();
        q.key = '__copy__';
        q.data = new Set();
        for (let value of rpfSel) {
            q.data.add(value.copy(q));
        }
        q.recomputeSizes();
        q.offsetBy(-q.minX, -q.minY);
        navigator.clipboard.writeText(q.toString());
    }
});

addHook(rpfActions, 'start-paste', async event => {
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
        let key = prompt(`Enter key:`);
        if (key === null) {
            return;
        }
        q = rpfP.fromPattern(key, rpfFile, q);
    }
    if (!(q instanceof RPFPattern)) {
        throw new Error(`This error should not occur (please check devtools and report the traceback)`);
    }
    if (q.key === 'main') {
        q.key = '__copy__';
    }
    q.offsetBy(-q.minX, -q.minY);
    alert(q.width + ' ' + q.height);
    rpfPasting = [q, 'F'];
    run('set-cursor-to-main');
});

addHook(rpfActions, 'end-paste', () => {
    if (!rpfPasting) {
        return;
    }
    pushUndo();
    let q = rpfPasting[0];
    let toAddTo = rpfP;
    if (rpfSel.size === 1) {
        let r = Array.from(rpfSel)[0].p;
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
        toAddTo.add(new RPFReference(toAddTo, q, mouseX, mouseY, rpfPasting[1]));
    }
    rpfPasting = undefined;
});

addHook(rpfActions, 'select-all', event => {
    if (event) {
        event.preventDefault();
    }
    for (let value of rpfP.data) {
        rpfSel.add(value);
    }
});


addHook(rpfActions, 'canvas-drop', event => {
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
    rpfPasting = [rpf.data[key], 'F'];
    run('set-cursor-to-main');
});


let rightElt = getElement('right');

let rpfCMElt = getElement('rpf-context-menu');
let rpfCMNameElt = getElement('cm-name');
let rpfCMPathElt = getElement('cm-path');
let rpfCMDescElt = getElement('cm-desc');

addHook(rpfActions, 'right-click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`right-click-canvas called with non-MouseEvent value`);
    }
    if (event.shiftKey) {
        return;
    }
    event.preventDefault();
    if (rpfCMShown) {
        rpfCMShown = false;
        rpfCMElt.style.display = 'none';
    } else {
        if (!rpfHover) {
            return;
        }
        let q = rpfHover.p;
        if (!(q instanceof RPFPattern)) {
            return;
        }
        rpfCMShown = true;
        let rect = rightElt.getBoundingClientRect();
        let x = event.clientX - rect.left + 4;
        let y = event.clientY - rect.top + 4;
        rpfCMElt.style.display = 'flex';
        rpfCMElt.style.left = x + 'px';
        rpfCMElt.style.top = y + 'px';
        rpfCMNameElt.textContent = q.getName(true);
        rpfCMPathElt.textContent = q.path;
        let desc = '';
        if (q.periodic) {
            desc += q.getTypeDescription() + '\n';
        }
        if (q.desc !== undefined) {
            desc += q.desc;
        }
        rpfCMDescElt.textContent = desc;
    }
});

addHook(rpfActions, 'window-click', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`window-click called with non-MouseEvent value`);
    }
    if (rpfCMShown && event.target instanceof HTMLElement && !rpfCMElt.contains(event.target)) {
        rpfCMShown = false;
        rpfCMElt.style.display = 'none';
    }
});


addHook(rpfActions, 'save', event => {
    if (event) {
        event.preventDefault();
    }
    if (currentFile !== undefined) {
        currentFile.write(rpfFile);
        currentFile.sync();
    }
});
