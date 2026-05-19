
import {Rotation, ROTATION_COMBINE, RPFObjectData, RPFPattern, File} from './rpf.js';
import {run, addHook, pushUndo, parse} from './base.js';
import {drawPattern} from './normal_actions.js';


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

interface RPFDrawStateData {
    normal: string[];
    selected: string[];
    hover: string[];
}

function drawRPF(p: RPFPattern, states: RPFDrawStateData, xPos: number, yPos: number, startRotation: Rotation, mode: 'normal' | 'selected' | 'hover'): void {
    for (let value of p.data) {
        let p = value.p;
        let mode2: typeof mode;
        if (mode === 'selected' || rpfSel.has(value)) {
            mode2 = 'selected';
        } else if (mode === 'hover' || value === rpfHover) {
            mode2 = 'hover';
        } else {
            mode2 = 'normal';
        }
        let rotation = ROTATION_COMBINE[startRotation][value.rotation];
        let xOffset = xPos + value.x;
        let yOffset = yPos + value.y;
        let [minX, minY] = p.getFullOffset();
        minX += xOffset;
        minY += yOffset;
        if (minX + p.width < -topLeftX || minY + p.height < -topLeftY || minX > -topLeftX + pixelWidth || minY > -topLeftY + pixelHeight) {
            continue;
        }
        if (p instanceof RPFPattern) {
            drawRPF(p, states, xOffset, yOffset, rotation, mode2);
        } else {
            drawPattern(p, states[mode2], xOffset, yOffset, rotation);
        }
    }
}


addHook(rpfActions, 'click-canvas', () => {
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
        rpfHover = rpfP.getObjectAt(mouseX, mouseY, interactionLevel);
    }
});

addHook(rpfActions, 'unclick-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`unclick-canvas called with non-MouseEvent value`);
    }
    if (cursorMode === 'main' && dragStart[0] === event.clientX && dragStart[1] === event.clientY) {
        let value = rpfP.getObjectAt(mouseX, mouseY, interactionLevel);
        if (value) {
            if (rpfSel.has(value)) {
                rpfSel.delete(value);
            } else {
                rpfSel.add(value);
            }
        }
        rpfP.recomputeSizes();
    }
});

let interactionLevelElt = getElement('interaction-level');
let selectMenuElt = getElement('select-menu');

addHook(rpfActions, 'frame', () => {
    interactionLevelElt.textContent = String(interactionLevel);
    let normal = [theme.empty];
    if (p.rule.states === 2) {
        normal.push(theme.twoState);
    } else {
        normal.push(...theme.multiState(p.rule.states));
    }
    let selected = normal.slice();
    selected[1] = theme.rpfSelection;
    let hover = normal.slice();
    hover[1] = theme.rpfHover;
    let states = {normal, selected, hover};
    ctx.fillStyle = normal[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawRPF(rpfP, states, 0, 0, 'F', 'normal');
    if (rpfSel.size > 0) {
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
    }
    if (rpfPasting) {
        let q = rpfPasting[0];
        drawRPF(q, states, mouseX, mouseY, rpfPasting[1], 'normal');
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
});

addHook(rpfActions, 'set-cursor-to-main', () => {
    if (cursorMode === 'edit' && rpfEditing) {
        rpfSel.delete(rpfEditing);
        if (rpfEditing.p.population === 0) {
            rpfP.removeObject(rpfEditing);
        }
    }
});

addHook(rpfActions, 'set-cursor-to-edit', () => {
    if (rpfSel.size === 0) {
        rpfEditing = {
            p: rpfP.base.clearedCopy(),
            x: 0,
            y: 0,
            rotation: 'F',
            time: 0,
        };
        rpfP.addObject(rpfEditing);
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
        q.addObject(value);
    }
    let minX = Infinity;
    let minY = Infinity;
    for (let obj of q.data) {
        minX = Math.min(minX, obj.x);
        minY = Math.min(minY, obj.y);
    }
    for (let obj of q.data) {
        obj.x -= minX;
        obj.y -= minY;
    }
    for (let value of rpfSel) {
        rpfP.data.delete(value);
    }
    rpfP.recomputeSizes();
    let obj: RPFObjectData = {
        p: q,
        x: minX,
        y: minY,
        rotation: 'F',
        time: 0,
    };
    rpfP.addObject(obj);
    rpfSel.clear();
    rpfSel.add(obj);
    rpfFile.data[q.key] = q;
});

addHook(rpfActions, 'sel-ungroup', () => {
    if (rpfSel.size === 0) {
        return;
    }
    pushUndo();
    let objs: RPFObjectData[] = [];
    for (let value of rpfSel) {
        objs.push(value);
        rpfP.data.delete(value);
    }
    objs = objs.map(x => x.p instanceof RPFPattern ? Array.from(x.p.data).map(y => ({p: y.p, x: y.x + x.x, y: y.y + x.y, rotation: y.rotation, time : y.time})) : x).flat();
    rpfSel.clear();
    for (let obj of objs) {
        rpfP.addObject(obj);
        rpfSel.add(obj);
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
        value.rotation = ROTATION_COMBINE[value.rotation]['Bx'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-vertical', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['Fx'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-left', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['L'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-right', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['R'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-rotate-180', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['B'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-diagonal', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['Lx'];
    }
    rpfP.recomputeSizes();
});

addHook(rpfActions, 'sel-flip-anti-diagonal', () => {
    pushUndo();
    for (let value of rpfSel) {
        value.rotation = ROTATION_COMBINE[value.rotation]['Rx'];
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
            q.data.add({p: value.p, x: value.x, y: value.y, rotation: value.rotation, time: value.time});
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
        for (let value of q.data) {
            value.x += mouseX;
            value.y += mouseY;
            toAddTo.addObject(value);
        }
    } else {
        toAddTo.addObject({p: q, x: mouseX, y: mouseY, rotation: rpfPasting[1], time: 0});
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


addHook(rpfActions, 'inc-interaction-level', () => { 
    interactionLevel++;
});

addHook(rpfActions, 'dec-interaction-level', () => {
    interactionLevel--;
    if (interactionLevel < 0) {
        interactionLevel = 0;
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
