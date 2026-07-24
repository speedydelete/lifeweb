
import {RPFReference} from '../rpf.js';
import {run, addHook} from '../base.js';
import {pushUndo} from './undo_redo.js';


declare global {
    var editing: RPFReference | undefined;
    var drawState: number;
    var drawDeleteMode: boolean;
    var prevEditX: number | undefined;
    var prevEditY: number | undefined;
}

editing = undefined;
drawState = 1;
drawDeleteMode = false;
prevEditX = undefined;
prevEditY = undefined;


export function editCell(isStart: boolean): void {
    if (!editing) {
        throw new Error(`editCell called with no editing`);
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
        editCell(true);
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
            editCell(false);
        }
    }
});

addHook('unclick-canvas', () => {
    prevEditX = undefined;
    prevEditY = undefined;
    drawDeleteMode = false;
});


let cursorMainButton = getElement('cursor-main');
let cursorEditButton = getElement('cursor-edit');

addHook('set-cursor-to-main', () => {
    if (cursorMode === 'edit' && editing) {
        sel.delete(editing);
        if (editing.p.population === 0) {
            p.remove(editing);
        }
    }
    cursorMode = 'main';
    cursorMainButton.classList.add('selected');
    cursorEditButton.classList.remove('selected');
    canvas.style.cursor = 'default';
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
    cursorMode = 'edit';
    cursorMainButton.classList.remove('selected');
    cursorEditButton.classList.add('selected');
    canvas.style.cursor = 'default';
    prevEditX = undefined;
    prevEditY = undefined;
});

addHook('load-pattern', () => {
    cursorMode = 'main';
    cursorMainButton.classList.add('selected');
    cursorEditButton.classList.remove('selected');
});
