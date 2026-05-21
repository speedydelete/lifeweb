
import * as lifeweb from '../core/index.js';
Object.assign(globalThis, lifeweb);

import {RPFError, ROTATION_COMBINE, applyRotation, transformCoordinates, isInside, getOverlap, RPFPattern, File, Directory, RPFFile} from './rpf.js';
(globalThis as any).RPFError = RPFError;
(globalThis as any).ROTATION_COMBINE = ROTATION_COMBINE;
(globalThis as any).applyRotation = applyRotation;
(globalThis as any).transformCoordinates = transformCoordinates;
(globalThis as any).isInside = isInside;
(globalThis as any).getOverlap = getOverlap;
(globalThis as any).RPFPattern = RPFPattern;
(globalThis as any).FSFile = File;
(globalThis as any).Directory = Directory;
(globalThis as any).RPFFile = RPFFile;

import {run, addHook, removeHook, setEvent, pushUndo, applyUndo, updateSizes, parse, loadPattern, FSFolderElement, FSFileElement, FSRPFItemElement, FSRPFFileElement, loadFile, runFile} from './base.js';
(globalThis as any).run = run;
(globalThis as any).addHook = addHook;
(globalThis as any).removeHook = removeHook;
(globalThis as any).pushUndo = pushUndo;
(globalThis as any).applyUndo = applyUndo;
(globalThis as any).parse = parse;
(globalThis as any).FSFolderElement = FSFolderElement;
(globalThis as any).FSFileElement = FSFileElement;
(globalThis as any).FSRPFItemElement = FSRPFItemElement;
(globalThis as any).FSRPFFileElement = FSRPFFileElement;
(globalThis as any).loadFile = loadFile;
(globalThis as any).runFile = runFile;

import './shared_actions.js';
import './normal_actions.js';
import './rpf_actions.js';


let startEvents: {[key: string]: {[K in (keyof HTMLElementEventMap | 'visibilitychange')]?: DefaultAction}} = {
    'window': {'click': 'window-click', 'visibilitychange': 'window-visibilitychange'},
    'canvas': {'wheel': 'scroll-canvas', 'mousedown': 'click-canvas', 'mousemove': 'move-mouse-over-canvas', 'mouseup': 'unclick-canvas', 'mouseenter': 'move-mouse-onto-canvas', 'mouseleave': 'move-mouse-off-of-canvas', 'contextmenu': 'right-click-canvas', 'drop': 'canvas-drop'},
    'run': {'click': 'run'},
    'pause': {'click': 'pause'},
    'step': {'click': 'step'},
    'reset': {'click': 'reset'},
    'speed': {'click': 'set-speed'},
    'cursor-main': {'click': 'set-cursor-to-main'},
    'cursor-edit': {'click': 'set-cursor-to-edit'},
    'cursor-select': {'click': 'set-cursor-to-select'},
    'undo': {'click': 'undo'},
    'redo': {'click': 'redo'},
    'scale-wrapper': {'click': 'set-scale'},
    'paste-or': {'click': 'set-paste-mode-to-or'},
    'paste-copy': {'click': 'set-paste-mode-to-copy'},
    'paste-and': {'click': 'set-paste-mode-to-and'},
    'paste-xor': {'click': 'set-paste-mode-to-xor'},
    'sel-cancel': {'click': 'sel-cancel'},
    'sel-group': {'click': 'sel-group'},
    'sel-ungroup': {'click': 'sel-ungroup'},
    'sel-move-up': {'click': 'sel-move-up'},
    'sel-move-down': {'click': 'sel-move-down'},
    'sel-move-left': {'click': 'sel-move-left'},
    'sel-move-right': {'click': 'sel-move-right'},
    'sel-clear': {'click': 'sel-clear'},
    'sel-flip-horizontal': {'click': 'sel-flip-horizontal'},
    'sel-flip-vertical': {'click': 'sel-flip-vertical'},
    'sel-rotate-left': {'click': 'sel-rotate-left'},
    'sel-rotate-right': {'click': 'sel-rotate-right'},
    'sel-rotate-180': {'click': 'sel-rotate-180'},
    'sel-flip-diagonal': {'click': 'sel-flip-diagonal'},
    'sel-flip-anti-diagonal': {'click': 'sel-flip-anti-diagonal'},
    'dec-interaction-level': {'click': 'dec-interaction-level'},
    'inc-interaction-level': {'click': 'inc-interaction-level'},
    'command': {'keydown': 'command-keypress', 'blur': 'click-off-command'},
    'help-button': {'click': 'show-help'},
    'help-x': {'click': 'hide-help'},
    'download-rle': {'click': 'download-rle'},
    'open-folder': {'click': 'open-folder'},
    'view-rle': {'click': 'view-rle'},
};


window.onbeforeunload = event => {
    event.preventDefault();
    return `Are you sure you want to leave? Patterns may not be saved yet.`;
};

canvas.addEventListener('click', () => {
    canvas.focus();
});


document.querySelectorAll('[data-title]').forEach(elt => {
    elt.addEventListener('mouseenter', () => {
        let rect = elt.getBoundingClientRect();
        if (rect.bottom > window.innerHeight/2) {
            elt.classList.add('tooltip-top');
        } else {
            elt.classList.remove('tooltip-top');
        }
    });
});


let leftElt = getElement('left');
let rightElt = getElement('right');
let leftRightResizerElt = getElement('left-right-resizer');

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


async function frame() {
    await run('frame');
    requestAnimationFrame(frame);
}

let start = `
B3/S23

import * from stdlib.rpf

main:
BFx59H
`;

window.addEventListener('load', () => setTimeout(async () => {
    // // @ts-ignore
    // if (typeof showDirectoryPicker === 'undefined') {
    //     // @ts-ignore
    //     globalThis.showDirectoryPicker = (await import('https://esm.sh/file-system-access')).showDirectoryPicker;
    // }
    // @ts-ignore
    stdlib = RPFFile.fromString((await import('./stdlib.rpf')).default, '/stdlib.rpf', fs);
    fs.write('stdlib.rpf', stdlib);
    run('render-file-system');
    for (let [key, value] of Object.entries(startEvents)) {
        for (let [event, action] of Object.entries(value)) {
            setEvent(key, event as keyof HTMLElementEventMap, action);
        }
    }
    updateSizes();
    // loadPattern(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`);
    loadPattern(start);
    getElement('rle', 'textarea').value = start;
    requestAnimationFrame(frame);
    canvas.focus();
    setInterval(() => run('save'), 5000);
}, 100));
