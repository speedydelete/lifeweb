
import {INSERT_COPY, INSERT_AND, INSERT_OR, INSERT_XOR, Pattern, createPattern, parse as parseRLE} from './core/index.js';
import {Rotation, ROTATION_COMBINE, RPFObjectData, RPFPattern, RPFFile, parseRPF, rpfToString} from './rpf.js';

// import * as lifeweb from './core/index.js';
// import * as lifewebRPF from './rpf.js';
// Object.assign(globalThis, lifeweb);
// Object.assign(globalThis, lifewebRPF);


function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}


interface Theme {
    twoState: string[];
    multiState(states: number): string[];
    selection: string;
    rpfSelection: string;
    pasting: string;
    envelope: string;
    intermediateObjects: string;
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
    rpfSelection: `#ffb3e3`,
    pasting: `rgba(255, 0, 0, 0.5)`,
    envelope: `#0000cf`,
    intermediateObjects: `#ff0000`,
};


interface UndoState {
    p: Pattern;
    hasRan: boolean;
}

var p = createPattern('B3/S23');
var rpfFile: RPFFile | undefined = undefined;

var emptyRPF: RPFFile = {base: p, path: '/main', data: {}};

var mouseX: number;
var mouseY: number;

var canvas = getElement<HTMLCanvasElement>('canvas');
var ctx = canvas.getContext('2d', {alpha: false}) as CanvasRenderingContext2D;

var fillOffset = -0.01;
var fillExpand = 0.02;

var undoBuffer: UndoState[] = [];
var redoBuffer: UndoState[] = [];
var beforeRunning = p;
var hasRan = false;

var scale = 10;
var topLeftX = 0;
var topLeftY = 0;

var scaleStrength = 0.3;

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
var pasting: Pattern | undefined = undefined;
var pasteMode: 'or' | 'copy' | 'and' | 'xor' = 'or';

var sel: {x: number, y: number, height: number, width: number} | undefined = undefined;
var rpfSel = new Set<number>();

var commandHistory: string[] = [];
var commandHistoryPos: number | undefined = undefined;
var beforeHistoryCommand = '/';

var rpfEditing: RPFObjectData | undefined = undefined;


function parse(data: string, preserveSizes?: boolean): Pattern | undefined {
    try {
        return parseRLE(data, undefined, preserveSizes);
    } catch (error) {
        try {
            return RPFPattern.fromString(data, structuredClone(emptyRPF));
        } catch (error) {
            return undefined;
        }
    }
}

function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan});
}

function loadPattern(q: string | RPFFile | Pattern): void {
    if (typeof q === 'string') {
        try {
            q = parseRLE(q);
        } catch (error) {
            try {
                q = parseRPF(q as string, '/main');
            } catch (error) {
                alert('Invalid pattern!');
                return;
            }
        }
    }
    if (q instanceof Pattern) {
        p = q;
        if (p instanceof RPFPattern) {
            rpfFile = structuredClone(emptyRPF);
            rpfFile.data['main'] = p;
        }
    } else {
        rpfFile = q;
        p = rpfFile.data['main'];
        if (!p) {
            alert(`No 'main' entry present in loaded RPF`);
            return;
        }
    }
    scale = Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5);
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = '';
    resetButton.className = 'selected';
    beforeRunning = p.copy();
    hasRan = false;
    cursorMode = 'main';
    sel = undefined;
    getElement('cursor-select').style.display = p instanceof RPFPattern ? 'none' : 'block';
}

function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
    canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
    ctx.imageSmoothingEnabled = false;
}

window.addEventListener('resize', updateSizes);
canvas.addEventListener('resize', updateSizes);

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

function editCellRPF(isStart: boolean): void {
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
    if (x < 0 || y < 0) {
        rpfEditing.x += Math.min(x, 0);
        rpfEditing.y += Math.min(y, 0);
        x = Math.max(x, 0);
        y = Math.max(y, 0);
    }
    let cell = rpfEditing.p.get(x, y);
    if (isStart) {
        drawDeleteMode = cell === drawState;
    }
    rpfEditing.p.ensure(x + 1, y + 1);
    rpfEditing.p.set(x, y, drawDeleteMode ? 0 : drawState);
}

function drawPattern(p: Pattern, states: string[], x: number = 0, y: number = 0, rotation?: Rotation, restore: boolean = true): {xOffset: number, yOffset: number, xMod: number, yMod: number} {
    ctx.save();
    let pixelWidth = canvas.width / scale;
    let pixelHeight = canvas.height / scale;
    let xOffset = -p.xOffset - topLeftX - x;
    let yOffset = -p.yOffset - topLeftY - y;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset = Math.round(xOffset - xMod);
    yOffset = Math.round(yOffset - yMod);
    let startY = Math.max(0, -yOffset);
    let endY = Math.max(pixelHeight, p.height - yOffset);
    let startX = Math.max(0, -xOffset);
    let endX = Math.max(pixelWidth, p.width - xOffset);
    for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
            let x2 = x + xOffset;
            let y2 = y + yOffset;
            if (rotation && rotation !== 'F') {
                if (rotation === 'Fx') {
                    y2 = p.height - y2 - 1;
                } else if (rotation === 'L') {
                    let temp = x2;
                    x2 = p.height - y2 - 1;
                    y2 = temp;
                } else if (rotation === 'Lx') {
                    let temp = x2;
                    x2 = y2;
                    y2 = temp;
                } else if (rotation === 'B') {
                    x2 = p.width - x2 - 1;
                    y2 = p.height - y2 - 1;
                } else if (rotation === 'Bx') {
                    x2 = p.width - x2 - 1;
                } else if (rotation === 'R') {
                    let temp = x2;
                    x2 = y2;
                    y2 = p.width - temp - 1;
                } else {
                    let temp = x2;
                    x2 = p.height - y2 - 1;
                    y2 = p.width - temp - 1;
                }
            }
            let cell = p.get(x2, y2);
            if (cell !== 0) {
                ctx.fillStyle = states[cell];
                ctx.fillRect(x - fillOffset, y - fillOffset, 1 + fillExpand, 1 + fillExpand);
            }
        }
    }
    if (restore) {
        ctx.restore();
    }
    return {xOffset, yOffset, xMod, yMod};
}


type DefaultAction = 
    | 'frame'
    | 'scroll-canvas' | 'click-canvas' | 'move-mouse-over-canvas' | 'unclick-canvas' | 'move-mouse-onto-canvas' | 'move-mouse-off-of-canvas'
    | 'run' | 'pause' | 'step' | 'reset' | 'set-speed'
    | 'set-cursor-to-main' | 'set-cursor-to-edit' | 'set-cursor-to-select'
    | 'undo' | 'redo'
    | 'set-scale' | 'faster' | 'slower'
    | 'sel-cancel' | 'sel-move-up' | 'sel-move-down' | 'sel-move-left' | 'sel-move-right' | 'sel-clear' | 'sel-flip-horizontal' | 'sel-flip-vertical' | 'sel-rotate-left' | 'sel-rotate-right' | 'sel-rotate-180' | 'sel-flip-diagonal' | 'sel-flip-anti-diagonal'
    | 'copy' | 'start-paste' | 'end-paste' | 'cut' | 'select-all' | 'set-paste-mode-to-or' | 'set-paste-mode-to-copy' | 'set-paste-mode-to-and' | 'set-paste-mode-to-xor'
    | 'open-command' | 'command-keypress' | 'run-command' | 'click-off-command'
    | 'viewRLE';

let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');
let speedElt = getElement('speed');

let cursorMainButton = getElement('cursor-main');
let cursorEditButton = getElement('cursor-edit');
let cursorSelectButton = getElement('cursor-select');

let scaleElt = getElement('scale');

let gensElt = getElement('gens');
let popElt = getElement('pop');

let posElt = getElement('position');
let xElt = getElement('x');
let yElt = getElement('y');
let stateElt = getElement('state');

let pasteOrButton = getElement('paste-or');
let pasteCopyButton = getElement('paste-copy');
let pasteAndButton = getElement('paste-and');
let pasteXorButton = getElement('paste-xor');

let commandWrapperElt = getElement('command-wrapper');
let commandElt = getElement('command');

let selectMenuElt = getElement('select-menu');
let pasteModeMenuElt = getElement('paste-mode-menu');

let frameCount = 0;

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;

type Hook = (event?: Event) => void;


var sharedActions: {[K in DefaultAction]?: Hook[]} = {

    'frame': [() => {
        if (running && frameCount % stepEvery === 0) {
            for (let i = 0; i < step; i++) {
                p.runGeneration();
                p.shrinkToFit();
            }
        } else {
            p.shrinkToFit();
        }
        speedElt.textContent = stepEvery === 1 ? `${step}x` : `1/${stepEvery}x`;
        if (scale < 0.5) {
            if (scale < 0.00001) {
                scaleElt.textContent = scale.toExponential();
            } else if (scale < 0.0001) {
                scaleElt.textContent = scale.toFixed(5);
            } else if (scale < 0.01) {
                scaleElt.textContent = scale.toFixed(4);
            } else if (scale < 0.1) {
                scaleElt.textContent = scale.toFixed(3);
            } else {
                scaleElt.textContent = scale.toFixed(2);
            }
        } else if (scale < 10**10) {
            scaleElt.textContent = scale.toFixed(1);
        } else {
            scaleElt.textContent = scale.toExponential();
        }
        gensElt.textContent = String(p.generation);
        popElt.textContent = String(p.population);
        pasteOrButton.className = pasteMode === 'or' ? 'selected' : '';
        pasteCopyButton.className = pasteMode === 'copy' ? 'selected' : '';
        pasteAndButton.className = pasteMode === 'and' ? 'selected' : '';
        pasteXorButton.className = pasteMode === 'xor' ? 'selected' : '';
        if (wheelEvent && Math.abs(totalDeltaY) > 50) {
            let rect = canvas.getBoundingClientRect();
            let mouseX = wheelEvent.clientX - rect.left;
            let mouseY = wheelEvent.clientY - rect.top;
            let scaleAmount = totalDeltaY < 0 ? (1 + scaleStrength) : (1 - scaleStrength);
            let newScale = Math.min(64, scale * scaleAmount);
            let x = (mouseX - topLeftX * scale) / scale;
            let y = (mouseY - topLeftY * scale) / scale;
            topLeftX = (mouseX - x * newScale) / newScale;
            topLeftY = (mouseY - y * newScale) / newScale;
            scale = newScale;
            totalDeltaY = 0;
            wheelEvent = undefined;
        }
    }],

    'scroll-canvas': [event => {
        if (!(event instanceof WheelEvent)) {
            throw new Error(`scroll called with non-MouseEvent value`);
        }
        event.preventDefault();
        totalDeltaY += event.deltaY;
        wheelEvent = event;
    }],

    'move-mouse-over-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
        }
        let rect = canvas.getBoundingClientRect();
        mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
        mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
    }],

    'move-mouse-onto-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`move-mouse-onto-canvas called with non-MouseEvent value`);
        }
        let rect = canvas.getBoundingClientRect();
        mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
        mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
        posElt.style.display = 'flex'
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
        } else if (value.match(/^1\/\d+x?$/)) {
            step = 1;
            stepEvery = parseInt(value.slice(2));
        } else if (value === '') {
            step = 1;
            stepEvery = 1;
        } else {
            alert(`Error: Invalid speed: ${value}`);
        }
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

    'set-scale': [() => {
        let value = prompt('Enter scale:');
        if (!value) {
            return;
        }
        scale = Number(value);
    }],

    'faster': [event => {
        if (event) {
            event.preventDefault();
        }
        if (stepEvery > 1) {
            stepEvery /= 2;
            if (stepEvery <= 1) {
                step = Math.round(1/stepEvery);
                stepEvery = 1;
            }
        } else {
            step *= 2;
        }
        
    }],

    'slower': [() => {
        if (step > 1) {
            step /= 2;
            if (step < 1) {
                stepEvery = Math.round(1 / step);
                step = 1;
            }
        } else {
            stepEvery *= 2;
        }
    }],

    'set-paste-mode-to-or': [() => {
        pasteMode = 'or';
    }],

    'set-paste-mode-to-copy': [() => {
        pasteMode = 'copy';
    }],

    'set-paste-mode-to-and': [() => {
        pasteMode = 'and';
    }],

    'set-paste-mode-to-xor': [() => {
        pasteMode = 'xor';
    }],

    'open-command': [event => {
        if (event) {
            event.preventDefault();
        }
        commandWrapperElt.style.display = 'flex';
        commandElt.textContent = '';
        commandElt.focus();
    }],

    'command-keypress': [event => {
        if (!(event instanceof KeyboardEvent)) {
            throw new Error(`command-keypress called with non-MouseEvent value`);
        }
        let key = event.key;
        if (key === 'Enter') {
            event.preventDefault();
            run('run-command', event);
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
        } else if (key === 'Backspace' && commandElt.textContent.length === 0) {
            commandWrapperElt.style.display = 'none';
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

    'click-off-command': [() => {
        commandWrapperElt.style.display = 'none';
    }],

    'viewRLE': [() => {
        let q = parse(getElement<HTMLTextAreaElement>('rle').value);
        if (q === undefined) {
            alert('Invalid pattern!');
            return;
        }
        loadPattern(q);
    }],

};


var normalActions: {[K in DefaultAction]?: Hook[]} = {

    'frame': [() => {
        let states: string[];
        if (p.rule.states === 2) {
            states = theme.twoState;
        } else {
            states = theme.multiState(p.rule.states);
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
            pasteModeMenuElt.style.display = 'flex';
        } else {
            pasteModeMenuElt.style.display = 'none';
        }
        frameCount++;
    }],

    'click-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        isDragging = true;
        dragStart = [event.clientX, event.clientY];
        dragOffsetStart = [topLeftX, topLeftY];
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
    }],

    'move-mouse-over-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
        }
        xElt.textContent = String(mouseX);
        yElt.textContent = String(mouseY);
        stateElt.textContent = String(p.get(mouseX - p.xOffset, mouseY - p.yOffset));
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
    }],

    'unclick-canvas': [() => {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
    }],

    'move-mouse-off-of-canvas': [() => {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
        posElt.style.display = 'none';
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
        prevEditX = undefined;
        prevEditY = undefined;
        cursorMainButton.className = '';
        cursorEditButton.className = 'selected';
        cursorSelectButton.className = '';
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-select': [() => {
        cursorMode = 'select';
        cursorMainButton.className = '';
        cursorEditButton.className = '';
        cursorSelectButton.className = 'selected';
        canvas.style.cursor = 'crosshair';
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

    'copy': [() => {
        if (!sel) {
            return;
        }
        p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
        let x = sel.x - p.xOffset;
        let y = sel.y - p.yOffset;
        p.ensure(x + sel.width, y + sel.height);
        navigator.clipboard.writeText(p.copyPart(x, y, sel.height, sel.width).toRLE());
    }],

    'start-paste': [async event => {
        if (event) {
            event.preventDefault();
        }
        let text = await navigator.clipboard.readText();
        pasting = parse(text, true);
        run('set-cursor-to-select');
    }],

    'end-paste': [() => {
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
    }],

    'cut': [() => {
        if (!sel) {
            return;
        }
        p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
        let x = sel.x - p.xOffset;
        let y = sel.y - p.yOffset;
        p.ensure(x + sel.width, y + sel.height);
        navigator.clipboard.writeText(p.copyPart(x, y, sel.height, sel.width).toRLE());
        p.clearPart(x, y, sel.height, sel.width);
        p.shrinkToFit();
    }],

    'select-all': [event => {
        if (event) {
            event.preventDefault();
        }
        cursorMode = 'select';
        sel = {x: p.xOffset, y: p.yOffset, height: p.height, width: p.width}; 
    }],

};


var rpfActions: {[K in DefaultAction]?: Hook[]} = {

    'frame': [() => {
        let states: string[];
        if (p.rule.states === 2) {
            states = theme.twoState;
        } else {
            states = theme.multiState(p.rule.states);
        }
        let selectedStates = states.slice();
        selectedStates[1] = theme.rpfSelection;
        ctx.fillStyle = states[0];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        let data = (p as RPFPattern).data;
        for (let i = 0; i < data.length; i++) {
            let value = data[i];
            drawPattern(value.p, rpfSel.has(i) ? selectedStates : states, value.x, value.y, value.rotation);
        }
        ctx.restore();
        if (rpfSel.size > 0) {
            selectMenuElt.style.display = 'flex';
        } else {
            selectMenuElt.style.display = 'flex';
        }
        frameCount++;
    }],

    'click-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        isDragging = true;
        dragStart = [event.clientX, event.clientY];
        dragOffsetStart = [topLeftX, topLeftY];
        if (pasting) {
            run('end-paste');
            return;
        }
        if (cursorMode === 'edit') {
            pushUndo();
            editCellRPF(true);
        }
    }],

    'move-mouse-over-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
        }
        xElt.textContent = String(mouseX);
        yElt.textContent = String(mouseY);
        stateElt.textContent = String(p.get(mouseX - p.xOffset, mouseY - p.yOffset));
        if (isDragging) {
            if (cursorMode === 'main') {
                topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
                topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
            } else if (cursorMode === 'edit') {
                editCellRPF(false);
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
    }],

    'unclick-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`unclick-canvas called with non-MouseEvent value`);
        }
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
        if (cursorMode === 'main' && dragStart[0] === event.clientX && dragStart[1] === event.clientY) {
            let data = (p as RPFPattern).data;
            for (let i = 0; i < data.length; i++) {
                if (data[i].p.get(mouseX - data[i].x, mouseY - data[i].y)) {
                    if (rpfSel.has(i)) {
                        rpfSel.delete(i);
                    } else {
                        rpfSel.add(i);
                    }
                }
            }
            (p as RPFPattern).recomputeSizes();
        }
    }],

    'move-mouse-off-of-canvas': [() => {
        isDragging = false;
        prevEditX = undefined;
        prevEditY = undefined;
        drawDeleteMode = false;
        posElt.style.display = 'none';
    }],

    'set-cursor-to-main': [() => {
        if (cursorMode === 'edit' && rpfEditing && rpfEditing.p.population === 0) {
            (p as RPFPattern).removeObject(rpfEditing);
        }
        cursorMode = 'main';
        cursorMainButton.className = 'selected';
        cursorEditButton.className = '';
        cursorSelectButton.className = '';
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-edit': [() => {
        if (rpfSel.size === 0) {
            rpfEditing = {
                p: (p as RPFPattern).base.clearedCopy(),
                x: 0,
                y: 0,
                rotation: 'F',
                time: 0,
            };
            (p as RPFPattern).addObject(rpfEditing);
        } else if (rpfSel.size === 1) {
            rpfEditing = (p as RPFPattern).data[Array.from(rpfSel)[0]];
        } else {
            alert(`Cannot edit multiple objects at once!`);
            return;
        }
        cursorMode = 'edit';
        prevEditX = undefined;
        prevEditY = undefined;
        cursorMainButton.className = '';
        cursorEditButton.className = 'selected';
        cursorSelectButton.className = '';
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-select': [() => {
        throw new Error(`Cannot set cursor to select in RPF mode`);
    }],

    'sel-cancel': [() => {
        pushUndo();
        rpfSel.clear();
    }],

    'sel-move-up': [() => {
        pushUndo();
        for (let i of rpfSel) {
            (p as RPFPattern).data[i].y--;
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-move-down': [() => {
        pushUndo();
        for (let i of rpfSel) {
            (p as RPFPattern).data[i].y++;
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-move-left': [() => {
        pushUndo();
        for (let i of rpfSel) {
            (p as RPFPattern).data[i].x--;
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-move-right': [() => {
        pushUndo();
        for (let i of rpfSel) {
            (p as RPFPattern).data[i].x++;
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-clear': [() => {
        pushUndo();
        let deleted = 0;
        for (let i of rpfSel) {
            (p as RPFPattern).data.splice(i - deleted, 1);
            deleted++;
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-flip-horizontal': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['Bx'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-flip-vertical': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['Fx'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-rotate-left': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['L'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-rotate-right': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['R'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-rotate-180': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['B'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-flip-diagonal': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['Lx'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'sel-flip-anti-diagonal': [() => {
        pushUndo();
        for (let i of rpfSel) {
            let value = (p as RPFPattern).data[i];
            value.rotation = ROTATION_COMBINE[value.rotation]['Rx'];
        }
        (p as RPFPattern).recomputeSizes();
    }],

    'copy': [() => {
        let toCopy: string;
        if (rpfSel.size === (p as RPFPattern).data.length) {
            if (!rpfFile) {
                throw new Error(`No rpfFile when copying everything!`);
            }
            toCopy = rpfToString(rpfFile);
        } else if (rpfSel.size > 0) {
            let q = p.copy() as RPFPattern;
            let deleted = 0;
            for (let i = 0; i < q.data.length; i++) {
                if (!rpfSel.has(i)) {
                    q.data.splice(i - deleted, 1);
                    deleted++;
                }
            }
            toCopy = q.toString();
        } else {
            return;
        }
        navigator.clipboard.writeText(toCopy);
    }],

    'start-paste': [async event => {
        if (event) {
            event.preventDefault();
        }
        let text = await navigator.clipboard.readText();
        pasting = parse(text, true);
        run('set-cursor-to-select');
    }],

    'end-paste': [() => {
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
    }],

    'cut': [() => {
        if (!sel) {
            return;
        }
        p.ensure(sel.x - p.xOffset, sel.y - p.yOffset);
        let x = sel.x - p.xOffset;
        let y = sel.y - p.yOffset;
        p.ensure(x + sel.width, y + sel.height);
        navigator.clipboard.writeText(p.copyPart(x, y, sel.height, sel.width).toRLE());
        p.clearPart(x, y, sel.height, sel.width);
        p.shrinkToFit();
    }],

    'select-all': [event => {
        if (event) {
            event.preventDefault();
        }
        let data = (p as RPFPattern).data;
        for (let i = 0; i < data.length; i++) {
            rpfSel.add(i);
        }
    }],

};


function run(action: DefaultAction, event?: Event): void {
    if (sharedActions[action]) {
        for (let hook of sharedActions[action]) {
            hook(event);
        }
    }
    if (!(p instanceof RPFPattern) && normalActions[action]) {
        for (let hook of normalActions[action]) {
            hook(event);
        }
    }
    if (p instanceof RPFPattern && rpfActions[action]) {
        for (let hook of rpfActions[action]) {
            hook(event);
        }
    }
}

function addHook<T extends DefaultAction>(actions: {[K in T]: Hook[]}, action: T, hook: Hook): void {
    if (!actions[action]) {
        actions[action] = [hook];
    } else {
        actions[action].push(hook);
    }
}

function removeHook<T extends DefaultAction>(actions: {[K in T]: Hook[]}, action: T, hook: Hook): void {
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
}


let startEvents: {[key: string]: {[K in keyof HTMLElementEventMap]?: DefaultAction}} = {
    'canvas': {'wheel': 'scroll-canvas', 'mousedown': 'click-canvas', 'mousemove': 'move-mouse-over-canvas', 'mouseup': 'unclick-canvas', 'mouseenter': 'move-mouse-onto-canvas', 'mouseleave': 'move-mouse-off-of-canvas'},
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
    'scale': {'click': 'set-scale'},
    'paste-or': {'click': 'set-paste-mode-to-or'},
    'paste-copy': {'click': 'set-paste-mode-to-copy'},
    'paste-and': {'click': 'set-paste-mode-to-and'},
    'paste-xor': {'click': 'set-paste-mode-to-xor'},
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
    'command': {'keydown': 'command-keypress', 'blur': 'click-off-command'},
    'view-rle': {'click': 'viewRLE'},
};

var eventListeners: {[key: string]: [DefaultAction, (event: Event) => void]} = {};

function setEvent(id: string, event: keyof HTMLElementEventMap, action: DefaultAction): void {
    let elt = getElement(id);
    let key = id + '\n' + event;
    if (key in eventListeners) {
        elt.removeEventListener(event, eventListeners[key][1]);
    }
    let listener = (event: Event) => run(action, event);
    elt.addEventListener(event, listener);
    eventListeners[key] = [action, listener];
}


let leftElt = getElement('left');

var keybinds: {[key: string]: DefaultAction} = {
    '=': 'faster',
    '-': 'slower',
    'Ctrl-z': 'undo',
    'Ctrl-R': 'redo',
    'Backspace': 'sel-clear',
    'Ctrl-c': 'copy',
    'Ctrl-v': 'start-paste',
    'Ctrl-x': 'cut',
    'Ctrl-a': 'select-all',
    '/': 'open-command',
};

window.addEventListener('keydown', event => {
    if (leftElt.contains(document.activeElement)) {
        return;
    }
    if (commandWrapperElt.style.display === 'flex') {
        run('command-keypress', event);
    } else {
        let key = event.key;
        if (event.metaKey) {
            key = 'Meta-' + key;
        }
        if (event.altKey) {
            key = 'Alt-' + key;
        }
        if (event.ctrlKey) {
            key = 'Ctrl-' + key;
        }
        if (key in keybinds) {
            run(keybinds[key], event);
        }
    }
});

canvas.addEventListener('click', () => {
    canvas.focus();
});


function frame() {
    run('frame');
    requestAnimationFrame(frame);
}

let start = `

B3/S23

glider:
*456

main:
glider

`;

window.addEventListener('load', () => setTimeout(() => {
    for (let [key, value] of Object.entries(startEvents)) {
        for (let [event, action] of Object.entries(value)) {
            setEvent(key, event as keyof HTMLElementEventMap, action);
        }
    }
    updateSizes();
    // loadPattern(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`);
    loadPattern(start);
    requestAnimationFrame(frame);
    canvas.focus();
}, 100));
