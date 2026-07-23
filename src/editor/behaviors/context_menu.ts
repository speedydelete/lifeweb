
import {path, RPFPattern} from '../rpf.js';
import {addHook} from '../base.js';


let contextMenuShown = false;

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
        contextMenuPathElt.textContent = q.key ? path.join(q.file.path, q.key) : `anonymous pattern in ${q.file.path}`;
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

addHook('load-pattern', () => {
    contextMenuShown = false;
    contextMenuElt.style.display = 'none';
});
