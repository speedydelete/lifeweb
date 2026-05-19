
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
glider 0 0
`;

window.addEventListener('load', () => setTimeout(async () => {
    // @ts-ignore
    if (typeof showDirectoryPicker === 'undefined') {
        // @ts-ignore
        globalThis.showDirectoryPicker = (await import('https://esm.sh/file-system-access')).showDirectoryPicker;
    }
    stdlib = RPFFile.fromString(/*await (await fetch('stdlib.rpf')).text()*/`
B3/S23


// the most common objects

block:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*33

blinker:
#periodic 0 0 2
#manualverified speedydelete 2025-05-12
*111

beehive:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*2552

glider:
#periodic 1 1 4
#manualverified speedydelete 2025-05-12
*456

loaf:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*4a96

boat:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*256

ship:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*356

tub:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*252

pond:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*6996


// small still lifes

// 6 cells

barge:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*25a4

snake:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*3213

aircraft_carrier:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*39c

// 7 cells

eater_1:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31e8

long_boat:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*25ac

long_snake:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31246

// 8 cells

canoe:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*312ko

hook_with_tail:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*321e8

long_barge:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*25ak8

long_ship:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*35ac

mango:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*69ic

shillelagh:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*3pm

tub_with_tail:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*178k8

very_long_snake:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31248c

// 9 cells

trans_boat_with_tail:
#name trans-boat with tail
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*352sg

cis_boat_with_tail:
#name cis-boat with tail
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*652sg

hat:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*8e1e8

integral_sign:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31ego

long_canoe:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31248gzy011

long_hook_with_tail:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*6421e8

long_shillelagh:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*312453

long_3_snake:
#name long^3 snake
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*31248go

tub_with_long_tail:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*25iczw11

very_long_boat:
#periodic 0 0 1
#manualverified speedydelete 2025-05-12
*25ako


// small oscillators

toad:
#periodic 0 0 2
#manualverified speedydelete 2025-05-12
*7e

beacon:
#periodic 0 0 2
#manualverified speedydelete 2025-05-12
*318c

clock:
#periodic 0 0 2
#manualverified speedydelete 2025-05-12
*2a54

caterer:
#periodic 0 0 3
#manualverified speedydelete 2025-05-12
*4hh186z07

figure_eight:
#periodic 0 0 8
#manualverified speedydelete 2025-05-12

pentadecathlon:
#periodic 0 0 15
#manualverified speedydelete 2025-05-12
*2252222522

blocker:
#periodic 0 0 8
#manualverified speedydelete 2025-05-12
*66wba4666

unix:
#periodic 0 0 6
#manualverified speedydelete 2025-05-12
*66w7bcczy166


// xWSS's

lwss:
#name LWSS
#periodic 2 0 4
#manualverified speedydelete 2025-05-12
*5889e

mwss:
#name MWSS
#periodic 2 0 4
#manualverified speedydelete 2025-05-12
*aghgis

hwss:
#name HWSS
#periodic 2 0 4
#manualverified speedydelete 2025-05-12
*aghhgis
`, '/stdlib.rpf', fs);
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
