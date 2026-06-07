
import {INSERT_OR, INSERT_COPY, INSERT_AND, INSERT_XOR, Pattern} from '../core/index.js';
import {Rotation, transformCoordinates} from './rpf.js';
import {run, addHook, pushUndo, parse} from './base.js';


function editCell(isStart: boolean): void {
    let x = mouseX - p.xOffset;
    let y = mouseY - p.yOffset;
    if (!isStart && x === prevEditX && y === prevEditY) {
        return;
    }
    prevEditX = x;
    prevEditY = y;
    if (x < 0 || y < 0) {
        let x2 = -Math.min(x, 0);
        let y2 = -Math.min(y, 0);
        p.offsetBy(x2, y2);
        x = Math.max(x, 0);
        y = Math.max(y, 0);
    }
    let cell = p.get(x, y);
    if (isStart) {
        drawDeleteMode = cell === drawState;
    }
    p.ensure(x + 1, y + 1);
    p.set(x, y, drawDeleteMode ? 0 : drawState);
}

addHook(normalActions, 'click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`click-canvas called with non-MouseEvent value`);
    }
    if (event.buttons !== 1) {
        return;
    }
    if (cursorMode === 'edit') {
        pushUndo();
        editCell(true);
    } else if (cursorMode === 'select') {
        if (pasting) {
            run('end-paste');
        } else {
            dragSelectStart = [mouseX, mouseY];
            sel = undefined;
        }
    }
});

addHook(normalActions, 'move-mouse-over-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
    }
    if (isDragging) {
        if (cursorMode === 'main') {
            topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
            topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
        } else if (cursorMode === 'edit') {
            editCell(false);
        } else if (cursorMode === 'select') {
            if (!pasting) {
                let minX = Math.min(mouseX, dragSelectStart[0]);
                let minY = Math.min(mouseY, dragSelectStart[1]);
                let maxX = Math.max(mouseX, dragSelectStart[0]);
                let maxY = Math.max(mouseY, dragSelectStart[1]);
                sel = {x: minX, y: minY, height: maxY - minY + 1, width: maxX - minX + 1};
            }
        }
    }
});

addHook(normalActions, 'unclick-canvas', () => {
    if (cursorMode === 'select' && sel !== undefined) {
        pushUndo();
    }
});

export function drawPattern(p: Pattern, states: string[], x: number = 0, y: number = 0, rotation?: Rotation, restore: boolean = true): {xOffset: number, yOffset: number, xMod: number, yMod: number} {
    ctx.save();
    let [pXOffset, pYOffset] = p.getFullOffset();
    let xOffset = -p.xOffset - topLeftX - x;
    let yOffset = -p.yOffset - topLeftY - y;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset -= xMod;
    yOffset -= yMod;
    let startY = Math.max(0, -yOffset) + (pYOffset - p.yOffset);
    let endY = Math.max(pixelHeight, p.height - yOffset);
    let startX = Math.max(0, -xOffset) + (pXOffset - p.xOffset);
    let endX = Math.max(pixelWidth, p.width - xOffset);
    for (let screenY = startY; screenY <= endY; screenY++) {
        for (let screenX = startX; screenX <= endX; screenX++) {
            let x = screenX + xOffset;
            let y = screenY + yOffset;
            if (rotation && rotation !== 'F') {
                [x, y] = transformCoordinates(x, y, p.width, p.height, rotation);
            }
            let cell = p.get(x, y);
            if (cell !== 0) {
                ctx.fillStyle = states[cell];
                ctx.fillRect(screenX - fillOffset, screenY - fillOffset, 1 + fillExpand, 1 + fillExpand);
            }
        }
    }
    if (restore) {
        ctx.restore();
    }
    return {xOffset, yOffset, xMod, yMod};
}

(globalThis as any).drawPattern = drawPattern;

let selectMenuElt = getElement('select-menu');

addHook(normalActions, 'frame', () => {
    let states = [theme.empty];
    if (p.rule.states === 2) {
        states.push(theme.twoState);
    } else {
        states.push(...theme.multiState(p.rule.states));
    }
    ctx.fillStyle = states[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let {xMod, yMod} = drawPattern(p, states, undefined, undefined, undefined, false);
    if (sel) {
        ctx.fillStyle = theme.selection;
        ctx.fillRect(sel.x + topLeftX + xMod - fillOffset, sel.y + topLeftY + yMod - fillOffset, sel.width + fillExpand, sel.height + fillExpand);
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
    }
    ctx.restore();
    if (pasting) {
        pasting.xOffset = mouseX;
        pasting.yOffset = mouseY;
        let {xOffset, yOffset} = drawPattern(pasting, states, undefined, undefined, undefined, false);
        ctx.fillStyle = theme.pasting;
        ctx.fillRect(-xOffset - fillOffset, -yOffset - fillOffset, pasting.width + fillExpand, pasting.height + fillExpand);
        ctx.restore();
    }
});


addHook(normalActions, 'sel-cancel', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    sel = undefined;
});

addHook(normalActions, 'sel-move-up', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset - 1);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y - 1, sel.height + 1, sel.width);
    p.insert(q, x, y - 1, INSERT_COPY);
    sel.y--;
});

addHook(normalActions, 'sel-move-down', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height + 1);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height + 1, sel.width);
    p.insert(q, x, y + 1, INSERT_COPY);
    sel.y++;
});

addHook(normalActions, 'sel-move-left', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset - 1, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x - 1, y, sel.height, sel.width + 1);
    p.insert(q, x - 1, y, INSERT_COPY);
    sel.x--;
});

addHook(normalActions, 'sel-move-right', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset + 1, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width + 1, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height + 1, sel.width);
    p.insert(q, x + 1, y, INSERT_COPY);
    sel.x++;
});

addHook(normalActions, 'sel-clear', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    p.clearPart(x, y, sel.height, sel.width);
});

addHook(normalActions, 'sel-flip-horizontal', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.flipHorizontal(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-flip-vertical', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.flipVertical(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-rotate-left', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.rotateLeft(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-rotate-right', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.rotateRight(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-rotate-180', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.rotate180(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-flip-diagonal', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.flipDiagonal(), x, y, INSERT_COPY);
});

addHook(normalActions, 'sel-flip-anti-diagonal', () => {
    if (!sel) {
        return;
    }
    pushUndo();
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    let q = p.copyPart(x, y, sel.height, sel.width);
    p.clearPart(x, y, sel.height, sel.width);
    p.insert(q.flipAntiDiagonal(), x, y, INSERT_COPY);
});

addHook(normalActions, 'copy', () => {
    if (!sel) {
        return;
    }
    p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
    let x = sel.x - p.xOffset;
    let y = sel.y - p.yOffset;
    p.ensure(x + sel.width, y + sel.height);
    navigator.clipboard.writeText(p.copyPart(x, y, sel.height, sel.width).toRLE());
});

addHook(normalActions, 'start-paste', async event => {
    if (event) {
        event.preventDefault();
    }
    let text = await navigator.clipboard.readText();
    let q = parse(text, true);
    if (Array.isArray(q)) {
        throw new Error(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}\n\n${q[2]}`);
    }
    pasting = q;
    run('set-cursor-to-select');
});

addHook(normalActions, 'end-paste', () => {
    if (!pasting) {
        return;
    }
    pushUndo();
    p.ensure(mouseX - p.xOffset, mouseY - p.yOffset);
    let x = mouseX - p.xOffset;
    let y = mouseY - p.yOffset;
    p.ensure(x + pasting.width, y + pasting.height);
    let mode: number;
    if (pasteMode === 'or') {
        mode = INSERT_OR;
    } else if (pasteMode === 'copy') {
        mode = INSERT_COPY;
    } else if (pasteMode === 'and') {
        mode = INSERT_AND;
    } else {
        mode = INSERT_XOR;
    }
    p.insert(pasting, x, y, mode);
    pasting = undefined;
});

addHook(normalActions, 'select-all', event => {
    if (event) {
        event.preventDefault();
    }
    cursorMode = 'select';
    sel = {x: p.xOffset, y: p.yOffset, height: p.height, width: p.width};
});
