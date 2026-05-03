
import {INSERT_COPY, Pattern, createPattern, parse} from './core/index.js';
import * as lifeweb from './core/index.js';


Object.assign(globalThis, lifeweb);


function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}


interface Theme {
    twoState: string[];
    multiState(states: number): string[];
    selection: string;
}

var theme: Theme = {
    twoState: ['#000000', '#ffffff'],
    multiState(states: number): string[] {
        let out: string[] = ['#000000'];
        for (let i = 1; i < states; i++) {
            out.push(`#ff` + Math.floor((states - i) * (256 / (states - 1))).toString(16).padStart(2, '0') + '00');
        }
        return out;
    },
    selection: `rgba(0, 255, 0, 0.5)`,
};


interface UndoState {
    p: Pattern;
    hasRan: boolean;
}

var p = createPattern('B3/S23');

var canvas = getElement<HTMLCanvasElement>('canvas');
var ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

var undoBuffer: UndoState[] = [];
var redoBuffer: UndoState[] = [];
var beforeRunning = p;
var hasRan = false;

var scale = 10;
var topLeftX = 0;
var topLeftY = 0;

var zoomStrength = 0.3;

var step = 1;
var stepEvery = 1;
var running = false;

var isDragging = false;
var dragStart = [0, 0];
var dragOffsetStart = [0, 0];
var dragSelectStart = [0, 0];

var cursorMode: 'main' | 'edit' | 'select' = 'main';
var drawState = 1;
var drawDeleteMode = false;
var prevEditX: number | undefined = undefined;
var prevEditY: number | undefined = undefined;

var sel: {x: number, y: number, height: number, width: number} | undefined = undefined;

var commandHistory: string[] = [];
var commandHistoryPos: number | undefined = undefined;
var beforeHistoryCommand = '/';

var frameHooks: (() => void)[] = [];


function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan});
}

let zoomElt = getElement('zoom');

function setZoom(newScale: number): void {
    scale = newScale;
    if (scale < 0.5) {
        if (scale < 0.00005) {
            zoomElt.textContent = scale.toExponential();
        } else if (scale < 0.0005) {
            zoomElt.textContent = scale.toFixed(5);
        } else if (scale < 0.005) {
            zoomElt.textContent = scale.toFixed(4);
        } else if (scale < 0.05) {
            zoomElt.textContent = scale.toFixed(3);
        } else {
            zoomElt.textContent = scale.toFixed(2);
        }
    } else if (scale < 10**10) {
        zoomElt.textContent = scale.toFixed(1);
    } else {
        zoomElt.textContent = scale.toExponential();
    }
}

function loadPattern(q: Pattern): void {
    p = q;
    setZoom(Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5));
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = '';
    resetButton.className = 'selected';
    beforeRunning = p.copy();
    hasRan = false;
    cursorMode = 'main';
    cursorMainButton.className = 'selected';
    cursorEditButton.className = '';
    cursorSelectButton.className = '';
    sel = undefined;
}

function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
    canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
    ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', updateSizes);
canvas.addEventListener('resize', updateSizes);

function getMouseXY(event: MouseEvent): [number, number] {
    let rect = canvas.getBoundingClientRect();
    return [
        Math.floor((event.clientX - rect.left - topLeftX * scale) / scale),
        Math.floor((event.clientY - rect.top - topLeftY * scale) / scale),
    ];
}

function editCell(event: MouseEvent, isStart: boolean): void {
    let [x, y] = getMouseXY(event);
    x -= p.xOffset;
    y -= p.yOffset;
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


type DefaultAction = 
    | 'click-canvas' | 'move-mouse-over-canvas' | 'unclick-canvas' | 'move-mouse-onto-canvas' | 'move-mouse-off-of-canvas'
    | 'run' | 'pause' | 'step' | 'reset' | 'set-speed'
    | 'set-cursor-to-main' | 'set-cursor-to-edit' | 'set-cursor-to-Select'
    | 'undo' | 'redo'
    | 'set-zoom'
    | 'sel-cancel' | 'sel-move-up' | 'sel-move-down' | 'sel-move-left' | 'sel-move-right' | 'sel-clear' | 'sel-flip-horizontal' | 'sel-flip-vertical' | 'sel-rotate-left' | 'sel-rotate-right' | 'sel-rotate-180' | 'sel-flip-diagonal' | 'sel-flip-anti-diagonal'
    | 'open-command' | 'command-keypress' | 'run-command'
    | 'viewRLE';

let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');
let speedElt = getElement('speed');

let cursorMainButton = getElement('cursor-main');
let cursorEditButton = getElement('cursor-edit');
let cursorSelectButton = getElement('cursor-select');

let posElt = getElement('position');
let xElt = getElement('x');
let yElt = getElement('y');
let stateElt = getElement('state');

let commandWrapperElt = getElement('command-wrapper');
let commandElt = getElement('command');

type Hook = (() => void) | ((event: Event) => void) | ((event: Event) => void);

var actions: {[K in DefaultAction]: Hook[]} = {

    'click-canvas': [(event: Event) => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        isDragging = true;
        dragStart = [event.clientX, event.clientY];
        dragOffsetStart = [topLeftX, topLeftY];
        if (cursorMode === 'edit') {
            pushUndo();
            editCell(event, true);
        } else if (cursorMode === 'select') {
            let [x, y] = getMouseXY(event);
            dragSelectStart = [x, y];
            sel = undefined;
        }
    }],

    'move-mouse-over-canvas': [(event: Event) => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
        }
        let [x, y] = getMouseXY(event);
        xElt.textContent = String(x);
        yElt.textContent = String(y);
        stateElt.textContent = String(p.get(x - p.xOffset, y - p.yOffset));
        if (isDragging) {
            if (cursorMode === 'main') {
                topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
                topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
            } else if (cursorMode === 'edit') {
                editCell(event, false);
            } else if (cursorMode === 'select') {
                let minX = Math.min(x, dragSelectStart[0]);
                let minY = Math.min(y, dragSelectStart[1]);
                let maxX = Math.max(x, dragSelectStart[0]);
                let maxY = Math.max(y, dragSelectStart[1]);
                sel = {x: minX, y: minY, height: maxY - minY + 1, width: maxX - minX + 1};
            }
        }
    }],

    'unclick-canvas': [() => {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
    }],

    'move-mouse-onto-canvas': [() => {
        posElt.style.display = 'flex';
    }],

    'move-mouse-off-of-canvas': [() => {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
        posElt.style.display = 'none';
    }],

    'run': [() => {
        pushUndo();
        if (!hasRan) {
            beforeRunning = p.copy();
            hasRan = true;
        }
        running = true;
        runButton.style.display = 'none';
        pauseButton.style.display = 'block';
        runButton.className = 'selected';
        pauseButton.className = 'selected';
        stepButton.className = '';
        resetButton.className = '';
    }],

    'pause': [() => {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
        runButton.className = 'selected';
        pauseButton.className = 'selected';
        stepButton.className = '';
        resetButton.className = '';
    }],

    'step': [() => {
        if (running) {
            running = false;
            runButton.style.display = 'block';
            pauseButton.style.display = 'none';
        }
        if (!hasRan) {
            beforeRunning = p.copy();
            hasRan = true;
        }
        pushUndo();
        p.runGeneration();
        p.shrinkToFit();
        runButton.className = '';
        pauseButton.className = '';
        stepButton.className = 'selected';
        resetButton.className = '';
    }],

    'reset': [() => {
        pushUndo();
        hasRan = false;
        running = false;
        p = beforeRunning;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
        runButton.className = '';
        pauseButton.className = '';
        stepButton.className = '';
        resetButton.className = 'selected';
    }],

    'set-speed': [() => {
        let value = prompt('Enter speed (as a positive integer n or a fraction of the form 1/n):');
        if (!value) {
            return;
        }
        if (value.match(/^\d+x?$/)) {
            step = parseInt(value);
            stepEvery = 1;
            speedElt.textContent = `${step}x`;
        } else if (value.match(/^1\/\d+x?$/)) {
            step = 1;
            stepEvery = parseInt(value.slice(2));
            speedElt.textContent = `1/${stepEvery}x`;
        } else if (value === '') {
            step = 1;
            stepEvery = 1;
        } else {
            alert(`Error: Invalid speed: ${value}`);
        }
    }],

    'set-cursor-to-main': [() => {
        cursorMode = 'main';
        cursorMainButton.className = 'selected';
        cursorEditButton.className = '';
        cursorSelectButton.className = '';
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-edit': [() => {
        cursorMode = 'edit';
        cursorMainButton.className = '';
        cursorEditButton.className = 'selected';
        cursorSelectButton.className = '';
        prevEditX = undefined;
        prevEditY = undefined;
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-Select': [() => {
        cursorMode = 'select';
        cursorMainButton.className = '';
        cursorEditButton.className = '';
        cursorSelectButton.className = 'selected';
        canvas.style.cursor = 'crosshair';
    }],

    'undo': [() => {
        redoBuffer.push({p: p.copy(), hasRan});
        let state = undoBuffer.pop();
        if (state) {
            running = false;
            p = state.p.copy();
            hasRan = state.hasRan;
        }
    }],

    'redo': [() => {
        let state = redoBuffer.pop();
        if (state) {
            pushUndo();
            running = false;
            p = state.p.copy();
            hasRan = state.hasRan;
        }
    }],

    'set-zoom': [() => {
        let value = prompt('Enter zoom:');
        if (!value) {
            return;
        }
        scale = Number(value);
    }],

    'sel-cancel': [() => {
        sel = undefined;
    }],

    'sel-move-up': [() => {
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
    }],

    'sel-move-down': [() => {
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
    }],

    'sel-move-left': [() => {
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
    }],

    'sel-move-right': [() => {
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
    }],

    'sel-clear': [() => {
        if (!sel) {
            return;
        }
        pushUndo();
        p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
        let x = sel.x - p.xOffset;
        let y = sel.y - p.yOffset;
        p.ensure(x + sel.width, y + sel.height);
        p.clearPart(x, y, sel.height, sel.width);
    }],

    'sel-flip-horizontal': [() => {
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
    }],

    'sel-flip-vertical': [() => {
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
    }],

    'sel-rotate-left': [() => {
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
    }],

    'sel-rotate-right': [() => {
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
    }],

    'sel-rotate-180': [() => {
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
    }],

    'sel-flip-diagonal': [() => {
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
    }],

    'sel-flip-anti-diagonal': [() => {
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
    }],

    'open-command': [event => {
        event.preventDefault();
        commandWrapperElt.style.display = 'flex';
        commandElt.textContent = '';
        commandElt.focus();
    }],

    'command-keypress': [(event: Event) => {
        if (!(event instanceof KeyboardEvent)) {
            throw new Error(`command-keypress called with non-MouseEvent value`);
        }
        let key = event.key;
        if (key === 'Enter') {
            event.preventDefault();
            for (let hook of actions['run-command']) {
                hook(event);
            }
        } else if (key === 'ArrowUp') {
            event.preventDefault();
            if (commandHistoryPos === undefined) {
                commandHistoryPos = 0;
                beforeHistoryCommand = commandElt.textContent;
            } else {
                commandHistoryPos++;
                if (commandHistoryPos === commandHistory.length) {
                    commandHistoryPos--;
                }
            }
            commandElt.textContent = commandHistory[commandHistoryPos];
        } else if (key === 'ArrowDown') {
            event.preventDefault();
            if (commandHistoryPos !== undefined) {
                commandHistoryPos--;
                if (commandHistoryPos === -1) {
                    commandHistoryPos = undefined;
                    commandElt.textContent = beforeHistoryCommand;
                } else {
                    commandElt.textContent = commandHistory[commandHistoryPos];
                }
            }
        }
    }],

    'run-command': [() => {
        commandWrapperElt.style.display = 'none';
        let cmd = commandElt.textContent;
        try {
            let value;
            if (cmd.includes(';')) {
                value = (new Function(cmd))()
            } else {
                value = (new Function('return ' + cmd))();
            }
            if (value !== undefined) {
                alert(value);
            }
        } catch (error) {
            if (error instanceof SyntaxError && !cmd.includes(';')) {
                try {
                    (new Function(cmd))();
                } catch (error2) {
                    error = error2;   
                }
            }
            let msg: string;
            // @ts-ignore
            if (typeof globalThis.formatError === 'function') {
                // @ts-ignore
                msg = globalThis.formatError(error);
            } else {
                msg = String(error);
            }
            alert(msg);
        }
        commandHistory.push(cmd);
    }],

    'viewRLE': [() => {
        loadPattern(parse(getElement<HTMLTextAreaElement>('rle').value));
    }],

};

function runAction(action: DefaultAction, event: Event): void {
    if (!(action in actions)) {
        return;
    }
    for (let hook of actions[action]) {
        hook(event);
    }
}

var run = runAction;


var events: {[key: string]: {[K in keyof HTMLElementEventMap]?: DefaultAction}} = {
    'canvas': {'mousedown': 'click-canvas', 'mousemove': 'move-mouse-over-canvas', 'mouseup': 'unclick-canvas', 'mouseenter': 'move-mouse-onto-canvas', 'mouseleave': 'move-mouse-off-of-canvas'},
    'run': {'click': 'run'},
    'pause': {'click': 'pause'},
    'step': {'click': 'step'},
    'reset': {'click': 'reset'},
    'speed': {'click': 'set-speed'},
    'cursor-main': {'click': 'set-cursor-to-main'},
    'cursor-edit': {'click': 'set-cursor-to-edit'},
    'cursor-select': {'click': 'set-cursor-to-Select'},
    'undo': {'click': 'undo'},
    'redo': {'click': 'redo'},
    'zoom': {'click': 'set-zoom'},
    'sel-cancel': {'click': 'sel-cancel'},
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
    'view-rle': {'click': 'viewRLE'},
};

function setEvent(id: string, event: keyof HTMLElementEventMap, action: DefaultAction): void {
    let elt = getElement(id);
    if (id in events) {
        if (event in events[id] && events[id][event] !== undefined) {
            for (let hook of actions[events[id][event]]) {
                elt.removeEventListener(event, hook);
            }
        }
        events[id][event] = action;
    } else {
        events[id] = {[event]: action};
    }
    for (let hook of actions[action]) {
        elt.addEventListener(event, hook);
    }
}


function addHook(action: DefaultAction, hook: Hook): void {
    if (!actions[action]) {
        actions[action] = [hook];
    } else {
        actions[action].push(hook);
    }
    for (let [id, value] of Object.entries(events)) {
        for (let [event, action2] of Object.entries(value)) {
            if (action === action2) {
                getElement(id).addEventListener(event, hook);
            }
        }
    }
}

function removeHook(action: DefaultAction, hook: (() => void) | ((event: Event) => void)): void {
    if (!actions[action]) {
        return;
    }
    let hooks = actions[action];
    for (let i = 0; i < hooks.length; i++) {
        if (hooks[i] === hook) {
            hooks.splice(i, 1);
            break;
        }
    }
    for (let [id, value] of Object.entries(events)) {
        for (let [event, action2] of Object.entries(value)) {
            if (action === action2) {
                getElement(id).removeEventListener(event, hook);
            }
        }
    }
}


var keybinds: {[key: string]: DefaultAction} = {
    '/': 'open-command',
};

window.addEventListener('keydown', event => {
    if (commandWrapperElt.style.display === 'flex') {
        runAction('command-keypress', event);
    } else if (event.key in keybinds) {
        runAction(keybinds[event.key], event);
    }
});


let gensElt = getElement('gens');
let popElt = getElement('pop');

let selectMenuElt = getElement('select-menu');

let frameCount = 0;

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;

canvas.addEventListener('wheel', event => {
    event.preventDefault();
    totalDeltaY += event.deltaY;
    wheelEvent = event;
});

// let startTime = performance.now();

function frame() {
    if (running && frameCount % stepEvery === 0) {
        for (let i = 0; i < step; i++) {
            p.runGeneration();
            p.shrinkToFit();
        }
    }
    gensElt.textContent = String(p.generation);
    popElt.textContent = String(p.population);
    if (wheelEvent && Math.abs(totalDeltaY) > 50) {
        let rect = canvas.getBoundingClientRect();
        let mouseX = wheelEvent.clientX - rect.left;
        let mouseY = wheelEvent.clientY - rect.top;
        let zoomAmount = totalDeltaY < 0 ? (1 + zoomStrength) : (1 - zoomStrength);
        let newScale = scale * zoomAmount;
        let x = (mouseX - topLeftX * scale) / scale;
        let y = (mouseY - topLeftY * scale) / scale;
        topLeftX = (mouseX - x * newScale) / newScale;
        topLeftY = (mouseY - y * newScale) / newScale;
        setZoom(newScale);
        totalDeltaY = 0;
        wheelEvent = undefined;
    }
    let states: string[];
    if (p.rule.states === 2) {
        states = theme.twoState;
    } else {
        states = theme.multiState(p.rule.states);
    }
    ctx.fillStyle = states[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let pixelWidth = canvas.width / scale;
    let pixelHeight = canvas.height / scale;
    ctx.save();
    let xOffset = -p.xOffset - topLeftX;
    let yOffset = -p.yOffset - topLeftY;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset -= xMod;
    yOffset -= yMod;
    for (let y = 0; y < pixelHeight + 1; y++) {
        for (let x = 0; x < pixelWidth + 1; x++) {
            let cell = p.get(x + xOffset, y + yOffset);
            if (cell !== 0) {
                ctx.fillStyle = states[cell];
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }
    if (sel) {
        ctx.fillStyle = theme.selection;
        ctx.fillRect(sel.x + topLeftX + xMod, sel.y + topLeftY + yMod, sel.width, sel.height);
        selectMenuElt.style.display = 'flex';
    } else {
        selectMenuElt.style.display = 'none';
    }
    for (let hook of frameHooks) {
        hook();
    }
    ctx.restore();
    frameCount++;
    // fps = frameCount / (performance.now() - startTime) * 1000;
    requestAnimationFrame(frame);
}

window.addEventListener('load', () => setTimeout(() => {
    for (let [key, value] of Object.entries(events)) {
        let elt = getElement(key);
        for (let [event, action] of Object.entries(value)) {
            for (let hook of actions[action]) {
                elt.addEventListener(event, hook);
            }
        }
    }
    updateSizes();
    loadPattern(parse(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`));
    requestAnimationFrame(frame);
}, 100));
