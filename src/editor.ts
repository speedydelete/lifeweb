
import {Pattern, createPattern, parse} from './core/index.js';
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

var canvas = getElement<HTMLCanvasElement>('canvas');
var ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

var frameHooks: (() => void)[] = [];


function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan});
}

let zoomElt = getElement('zoom');

function updateZoom(): void {
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
    scale = Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5);
    updateZoom();
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


type DefaultAction = 'clickCanvas' | 'moveMouseOverCanvas' | 'unclickCanvas' | 'moveMouseOntoCanvas' | 'moveMouseOffOfCanvas' | 'run' | 'pause' | 'step' | 'reset' | 'setSpeed' | 'setCursorToMain' | 'setCursorToEdit' | 'setCursorToSelect' | 'undo' | 'redo' | 'setZoom' | 'selCancel' | 'selFlipHorizontal' | 'selFlipVertical' | 'selRotateLeft' | 'selRotateRight' | 'selRotate180' | 'selFlipDiagonal' | 'selFlipAntiDiagonal' | 'viewRLE';

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

type ActionFunction = (() => void) | ((event: Event) => void) | ((event: MouseEvent) => void);

var actions: {[K in DefaultAction]: ActionFunction} = {

    clickCanvas(event: MouseEvent): void {
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
    },

    moveMouseOverCanvas(event: MouseEvent): void {
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
    },

    unclickCanvas(): void {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
    },

    moveMouseOntoCanvas(): void {
        posElt.style.display = 'flex';
    },

    moveMouseOffOfCanvas(): void {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
        posElt.style.display = 'none';
    },

    run(): void {
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
    },

    pause(): void {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
        runButton.className = 'selected';
        pauseButton.className = 'selected';
        stepButton.className = '';
        resetButton.className = '';
    },

    step(): void {
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
    },

    reset(): void {
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
    },

    setSpeed(): void {
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
    },

    setCursorToMain(): void {
        cursorMode = 'main';
        cursorMainButton.className = 'selected';
        cursorEditButton.className = '';
        cursorSelectButton.className = '';
        canvas.style.cursor = 'default';
    },

    setCursorToEdit(): void {
        cursorMode = 'edit';
        cursorMainButton.className = '';
        cursorEditButton.className = 'selected';
        cursorSelectButton.className = '';
        prevEditX = undefined;
        prevEditY = undefined;
        canvas.style.cursor = 'default';
    },

    setCursorToSelect(): void {
        cursorMode = 'select';
        cursorMainButton.className = '';
        cursorEditButton.className = '';
        cursorSelectButton.className = 'selected';
        canvas.style.cursor = 'crosshair';
    },

    undo(): void {
        redoBuffer.push({p: p.copy(), hasRan});
        let state = undoBuffer.pop();
        if (state) {
            running = false;
            p = state.p.copy();
            hasRan = state.hasRan;
        }
    },

    redo(): void {
        let state = redoBuffer.pop();
        if (state) {
            pushUndo();
            running = false;
            p = state.p.copy();
            hasRan = state.hasRan;
        }
    },

    setZoom(): void {
        let value = prompt('Enter zoom:');
        if (!value) {
            return;
        }
        scale = Number(value);
    },

    selCancel(): void {
        sel = undefined;
    },

    selFlipHorizontal(): void {
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
        p.insert(q.flipHorizontal(), x, y);
    },

    selFlipVertical(): void {
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
        p.insert(q.flipVertical(), x, y);
    },

    selRotateLeft(): void {
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
        p.insert(q.rotateLeft(), x, y);
    },

    selRotateRight(): void {
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
        p.insert(q.rotateRight(), x, y);
    },

    selRotate180(): void {
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
        p.insert(q.rotate180(), x, y);
    },

    selFlipDiagonal(): void {
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
        p.insert(q.flipDiagonal(), x, y);
    },

    selFlipAntiDiagonal(): void {
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
        p.insert(q.flipAntiDiagonal(), x, y);
    },

    viewRLE(): void {
        loadPattern(parse(getElement<HTMLTextAreaElement>('rle').value));
    },

};


var events: {[key: string]: {[K in keyof HTMLElementEventMap]?: DefaultAction}} = {
    'canvas': {'mousedown': 'clickCanvas', 'mousemove': 'moveMouseOverCanvas', 'mouseup': 'unclickCanvas', 'mouseenter': 'moveMouseOntoCanvas', 'mouseleave': 'moveMouseOffOfCanvas'},
    'run': {'click': 'run'},
    'pause': {'click': 'pause'},
    'step': {'click': 'step'},
    'reset': {'click': 'reset'},
    'speed': {'click': 'setSpeed'},
    'cursor-main': {'click': 'setCursorToMain'},
    'cursor-edit': {'click': 'setCursorToEdit'},
    'cursor-select': {'click': 'setCursorToSelect'},
    'undo': {'click': 'undo'},
    'redo': {'click': 'redo'},
    'zoom': {'click': 'setZoom'},
    'sel-cancel': {'click': 'selCancel'},
    'sel-flip-horizontal': {'click': 'selFlipHorizontal'},
    'sel-flip-vertical': {'click': 'selFlipVertical'},
    'sel-rotate-left': {'click': 'selRotateLeft'},
    'sel-rotate-right': {'click': 'selRotateRight'},
    'sel-rotate-180': {'click': 'selRotate180'},
    'sel-flip-diagonal': {'click': 'selFlipDiagonal'},
    'sel-flip-anti-diagonal': {'click': 'selFlipAntiDiagonal'},
    'view-rle': {'click': 'viewRLE'},
};

function changeAction(action: DefaultAction, func: (() => void) | ((event: Event) => void)): void {
    if (!actions[action]) {
        actions[action] = func;
        return;
    }
    for (let [id, value] of Object.entries(events)) {
        for (let [event, action2] of Object.entries(value)) {
            if (action === action2) {
                let elt = getElement(id);
                elt.removeEventListener(event, actions[action] as () => void);
                elt.addEventListener(event, func);
            }
        }
    }
    actions[action] = func;
}

function setEvent(id: string, event: keyof HTMLElementEventMap, action: DefaultAction): void {
    let elt = getElement(id);
    if (id in events) {
        if (event in events[id] && events[id][event] !== undefined) {
            elt.removeEventListener(event, actions[events[id][event] as DefaultAction] as () => void);
        }
    }
}


var keybinds: {[key: string]: DefaultAction} = {

};

window.addEventListener('keydown', event => {
    if (event.key in keybinds) {
        actions[keybinds[event.key]](event as any);
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
    console.log(event.deltaY);
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
        scale = newScale;
        updateZoom();
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
            elt.addEventListener(event, actions[action] as () => void);
        }
    }
    updateSizes();
    loadPattern(parse(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`));
    requestAnimationFrame(frame);
}, 100));
