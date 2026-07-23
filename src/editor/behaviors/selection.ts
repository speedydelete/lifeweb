
import {RPFPattern} from '../rpf.js';
import {addHook, pushUndo} from '../base.js';


let selectMenuElt = getElement('select-menu');

addHook('frame', () => {
    if (sel.size > 0) {
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
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

addHook('select-all', event => {
    if (event) {
        event.preventDefault();
    }
    for (let value of p.data) {
        sel.add(value);
    }
});

addHook('load-pattern', () => {
    sel.clear();
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
    let ref = p.createRef(q, minX, minY);
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
