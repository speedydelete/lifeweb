
import {updateSizes} from './change_view.js';


let leftElt = getElement('left');
let rightElt = getElement('right');
let leftRightResizerElt = getElement('left-right-resizer');

let leftRightResizing = false;
let leftRightResizeOffset = 0;

leftRightResizerElt.addEventListener('mousedown', event => {
    leftRightResizing = true;
    let rect = leftRightResizerElt.getBoundingClientRect();
    leftRightResizeOffset = event.clientX - rect.left;
});

window.addEventListener('mousemove', event => {
    if (!leftRightResizing) {
        return;
    }
    let newPos = event.clientX - leftRightResizeOffset;
    leftElt.style.right = `${window.innerWidth - newPos}px`;
    leftRightResizerElt.style.left = `${newPos}px`;
    rightElt.style.left = `calc(${newPos}px + 1rem)`;
    updateSizes();
});

window.addEventListener('mouseup', () => {
    leftRightResizing = false;
});
