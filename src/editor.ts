
import {INSERT_COPY, INSERT_AND, INSERT_OR, INSERT_XOR, Pattern, CoordPattern, createPattern, parse as parseRLE} from './core/index.js';
import {Rotation, ROTATION_COMBINE, RPFObjectData, RPFPattern, RPFFile, parseRPF, rpfToString} from './rpf.js';

// import * as lifeweb from './core/index.js';
// import * as lifewebRPF from './rpf.js';
// Object.assign(globalThis, lifeweb);
// Object.assign(globalThis, lifewebRPF);


function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}


interface Theme {
    empty: string;
    twoState: string;
    multiState(states: number): string[];
    selection: string;
    rpfSelection: string;
    pasting: string;
    envelope: string;
    intermediateObjects: string;
}

var theme: Theme = {
    empty: '#000000',
    twoState: '#ffffff',
    multiState(states: number): string[] {
        let out: string[] = [];
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
    rpfEditing?: RPFObjectData;
}

var p = createPattern('B3/S23');
var rpfFile: RPFFile | undefined = undefined;
var emptyRPF: RPFFile = {base: p, path: '/main', data: {}};
// @ts-ignore
var rpfP: RPFPattern = undefined;

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
var pixelHeight = 0;
var pixelWidth = 0;

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
var rpfSel = new Set<RPFObjectData>();

var commandHistory: string[] = [];
var commandHistoryPos: number | undefined = undefined;
var beforeHistoryCommand = '/';

var rpfEditing: RPFObjectData | undefined = undefined;


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

let selGroupButton = getElement('sel-group');
let selUngroupButton = getElement('sel-ungroup');

let helpElt = getElement('help');


function parse(data: string, preserveSizes?: boolean): Pattern | [string, string] {
    try {
        return parseRLE(data, undefined, preserveSizes);
    } catch (error) {
        try {
            return RPFPattern.fromString(data, structuredClone(emptyRPF));
        } catch (error2) {
            console.log(error instanceof Error ? error.stack : String(error));
            console.log(error2 instanceof Error ? error2.stack : String(error2));
            return [String(error), String(error2)];
        }
    }
}

function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan, rpfEditing});
}

function applyUndo(state: UndoState): void {
    running = false;
    p = state.p.copy();
    hasRan = state.hasRan;
    rpfEditing = state.rpfEditing;
}

function loadPattern(q: string | RPFFile | Pattern): void {
    if (typeof q === 'string') {
        try {
            q = parseRLE(q);
        } catch (error) {
            try {
                q = parseRPF(q as string, '/main');
            } catch (error2) {
                console.log(error instanceof Error ? error.stack : String(error));
                console.log(error2 instanceof Error ? error2.stack : String(error2));
                alert(`Invalid pattern!:\n\n${error}\n\n${error2}`);
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
    p.xOffset = 0;
    p.yOffset = 0;
    scale = Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5);
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
    let offset = p.getFullOffset();
    topLeftX -= offset[0];
    topLeftY -= offset[1];
    runButton.classList.remove('selected');
    runButton.style.display = 'block';
    pauseButton.classList.remove('selected');
    pauseButton.style.display = 'none';
    stepButton.classList.remove('selected');
    resetButton.classList.add('selected');
    running = false;
    cursorMainButton.classList.add('selected');
    cursorEditButton.classList.remove('selected');
    cursorSelectButton.classList.remove('selected');
    beforeRunning = p.copy();
    hasRan = false;
    cursorMode = 'main';
    sel = undefined;
    rpfSel.clear();
    if (p instanceof RPFPattern) {
        rpfP = p;
        cursorSelectButton.style.display = 'none';
        selGroupButton.style.display = 'block';
        selUngroupButton.style.display = 'block';
        cursorMainButton.dataset.title = 'pan/select';
    } else {
        // @ts-ignore
        rpfP = undefined;
        cursorSelectButton.style.display = 'block';
        selGroupButton.style.display = 'none';
        selUngroupButton.style.display = 'none';
        cursorMainButton.dataset.title = 'pan';
    }
}

function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
    canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
    ctx.imageSmoothingEnabled = false;
    pixelHeight = canvas.height / scale;
    pixelWidth = canvas.width / scale;
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
    if ((x < 0 || y < 0) && !(p instanceof CoordPattern)) {
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
    let q = rpfEditing.p;
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
    rpfEditing.x += q.xOffset;
    rpfEditing.y += q.yOffset;
    q.xOffset = 0;
    q.yOffset = 0;
}

function drawPattern(p: Pattern, states: string[], x: number = 0, y: number = 0, rotation?: Rotation, restore: boolean = true): {xOffset: number, yOffset: number, xMod: number, yMod: number} {
    // console.log(`drawing pattern`, p);
    // console.log(`x = ${x}, y = ${y}, rotation = ${rotation}`);
    ctx.save();
    let [pXOffset, pYOffset] = p.getFullOffset();
    let xOffset = -p.xOffset - topLeftX - x;
    let yOffset = -p.yOffset - topLeftY - y;
    // if (p.rule.range !== Math.round(p.rule.range) && p.generation % 2 === 1) {
    //     xOffset += 0.5;
    //     yOffset += 0.5;
    // }
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset = Math.round(xOffset - xMod);
    yOffset = Math.round(yOffset - yMod);
    let startY = Math.max(0, -yOffset) + (pYOffset - p.yOffset);
    let endY = Math.max(pixelHeight, p.height - yOffset);
    let startX = Math.max(0, -xOffset) + (pXOffset - p.xOffset);
    let endX = Math.max(pixelWidth, p.width - xOffset);
    for (let screenY = startY; screenY <= endY; screenY++) {
        for (let screenX = startX; screenX <= endX; screenX++) {
            let x = screenX + xOffset;
            let y = screenY + yOffset;
            if (rotation && rotation !== 'F') {
                if (rotation === 'Fx') {
                    y = p.height - y - 1;
                } else if (rotation === 'L') {
                    let temp = x;
                    x = p.height - y - 1;
                    y = temp;
                } else if (rotation === 'Lx') {
                    let temp = x;
                    x = y;
                    y = temp;
                } else if (rotation === 'B') {
                    x = p.width - x - 1;
                    y = p.height - y - 1;
                } else if (rotation === 'Bx') {
                    x = p.width - x - 1;
                } else if (rotation === 'R') {
                    let temp = x;
                    x = y;
                    y = p.width - temp - 1;
                } else {
                    let temp = x;
                    x = p.height - y - 1;
                    y = p.width - temp - 1;
                }
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

function drawRPF(p: RPFPattern, states: string[], selectedStates: string[], xPos: number, yPos: number, startRotation: Rotation, selected: boolean): void {
    // console.log('drawing rpf', p);
    // console.log(`x = ${xPos}, y = ${yPos}, rotation = ${startRotation}, selected = ${selected}`);
    for (let value of p.data) {
        let p = value.p;
        let selected2 = selected || rpfSel.has(value);
        let rotation = ROTATION_COMBINE[startRotation][value.rotation];
        let xOffset = xPos + value.x;
        let yOffset = yPos + value.y;
        let [minX, minY] = p.getFullOffset();
        minX += xOffset;
        minY += yOffset;
        if (minX < -topLeftX || minY < -topLeftY || minX + p.width > -topLeftX + pixelWidth || minY + p.height > -topLeftY + pixelHeight) {
            continue;
        }
        if (p instanceof RPFPattern) {
            drawRPF(p, states, selectedStates, xOffset, yOffset, rotation, selected2);
        } else {
            drawPattern(p, selected2 ? selectedStates : states, xOffset, yOffset, rotation);
        }
    }
}


type DefaultAction = 
    | 'frame'
    | 'scroll-canvas' | 'click-canvas' | 'move-mouse-over-canvas' | 'unclick-canvas' | 'move-mouse-onto-canvas' | 'move-mouse-off-of-canvas'
    | 'run' | 'pause' | 'step' | 'reset' | 'set-speed'
    | 'set-cursor-to-main' | 'set-cursor-to-edit' | 'set-cursor-to-select'
    | 'undo' | 'redo'
    | 'set-scale' | 'faster' | 'slower'
    | 'sel-cancel' | 'sel-group' | 'sel-ungroup' | 'sel-move-up' | 'sel-move-down' | 'sel-move-left' | 'sel-move-right' | 'sel-clear' | 'sel-flip-horizontal' | 'sel-flip-vertical' | 'sel-rotate-left' | 'sel-rotate-right' | 'sel-rotate-180' | 'sel-flip-diagonal' | 'sel-flip-anti-diagonal'
    | 'copy' | 'start-paste' | 'end-paste' | 'cut' | 'select-all' | 'set-paste-mode-to-or' | 'set-paste-mode-to-copy' | 'set-paste-mode-to-and' | 'set-paste-mode-to-xor'
    | 'open-command' | 'command-keypress' | 'run-command' | 'click-off-command'
    | 'view-rle'
    | 'show-help' | 'hide-help'
;

type Hook = (event?: Event) => void;


let frameCount = 0;

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;


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
        posElt.style.display = 'flex';
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
        runButton.classList.add('selected');
        pauseButton.classList.add('selected');
        stepButton.classList.remove('selected');
        resetButton.classList.remove('selected');
    }],

    'pause': [() => {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
        runButton.classList.add('selected');
        pauseButton.classList.add('selected');
        stepButton.classList.remove('selected');
        resetButton.classList.remove('selected');
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
        runButton.classList.remove('selected');
        pauseButton.classList.remove('selected');
        stepButton.classList.add('selected');
        resetButton.classList.remove('selected');
    }],

    'reset': [() => {
        pushUndo();
        hasRan = false;
        running = false;
        p = beforeRunning;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
        runButton.classList.remove('selected');
        pauseButton.classList.remove('selected');
        stepButton.classList.remove('selected');
        resetButton.classList.add('selected');
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
            applyUndo(state);
        }
    }],

    'redo': [() => {
        let state = redoBuffer.pop();
        if (state) {
            pushUndo();
            applyUndo(state);
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

    'cut': [() => {
        run('copy');
        run('sel-clear');
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

    'view-rle': [() => {
        loadPattern(getElement<HTMLTextAreaElement>('rle').value);
    }],

    'show-help': [() => {
        helpElt.style.display = 'block';
    }],

    'hide-help': [() => {
        helpElt.style.display = 'none';
    }],

};


var normalActions: {[K in DefaultAction]?: Hook[]} = {

    'frame': [() => {
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
        if (cursorMode === 'select' && sel !== undefined) {
            pushUndo();
        }
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
        cursorMainButton.classList.add('selected');
        cursorEditButton.classList.remove('selected');
        cursorSelectButton.classList.remove('selected');
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-edit': [() => {
        cursorMode = 'edit';
        prevEditX = undefined;
        prevEditY = undefined;
        cursorMainButton.classList.remove('selected');
        cursorEditButton.classList.add('selected');
        cursorSelectButton.classList.remove('selected');
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-select': [() => {
        cursorMode = 'select';
        cursorMainButton.classList.remove('selected');
        cursorEditButton.classList.remove('selected');
        cursorSelectButton.classList.add('selected');
        canvas.style.cursor = 'crosshair';
    }],

    'sel-cancel': [() => {
        if (!sel) {
            return;
        }
        pushUndo();
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
        let q = parse(text, true);
        if (Array.isArray(q)) {
            alert(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}`);
            return;
        }
        pasting = q;
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
        let states = [theme.empty];
        if (p.rule.states === 2) {
            states.push(theme.twoState);
        } else {
            states.push(...theme.multiState(p.rule.states));
        }
        let selectedStates = states.slice();
        selectedStates[1] = theme.rpfSelection;
        ctx.fillStyle = states[0];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawRPF(rpfP, states, selectedStates, 0, 0, 'F', false);
        if (rpfSel.size > 0) {
            selectMenuElt.style.display = 'flex';
        } else {
            selectMenuElt.style.display = 'none';
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
            for (let value of rpfP.data) {
                if (value.p.get(mouseX - value.x, mouseY - value.y)) {
                    if (rpfSel.has(value)) {
                        rpfSel.delete(value);
                    } else {
                        rpfSel.add(value);
                    }
                }
            }
            rpfP.recomputeSizes();
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
        if (cursorMode === 'edit' && rpfEditing) {
            rpfSel.delete(rpfEditing);
            if (rpfEditing.p.population === 0) {
                rpfP.removeObject(rpfEditing);
            }
        }
        cursorMode = 'main';
        cursorMainButton.classList.add('selected');
        cursorEditButton.classList.remove('selected');
        cursorSelectButton.classList.remove('selected');
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-edit': [() => {
        if (rpfSel.size === 0) {
            rpfEditing = {
                p: rpfP.base.clearedCopy(),
                x: 0,
                y: 0,
                rotation: 'F',
                time: 0,
            };
            rpfP.addObject(rpfEditing);
            rpfSel.add(rpfEditing);
        } else if (rpfSel.size === 1) {
            rpfEditing = Array.from(rpfSel)[0];
        } else {
            alert(`Cannot edit multiple objects at once!`);
            return;
        }
        cursorMode = 'edit';
        prevEditX = undefined;
        prevEditY = undefined;
        cursorMainButton.classList.remove('selected');
        cursorEditButton.classList.add('selected');
        cursorSelectButton.classList.remove('selected');
        canvas.style.cursor = 'default';
    }],

    'set-cursor-to-select': [() => {
        throw new Error(`Cannot set cursor to select in RPF mode`);
    }],

    'sel-cancel': [() => {
        if (rpfSel.size === 0) {
            return;
        }
        pushUndo();
        rpfSel.clear();
    }],

    'sel-group': [() => {
        if (rpfSel.size === 0) {
            return;
        }
        let key = prompt('Enter new object ID:');
        if (!key) {
            return;
        }
        pushUndo();
        let q = rpfP.clearedCopy();
        q.setKey(key);
        for (let value of rpfSel) {
            q.addObject(value);
        }
        let minX = Infinity;
        let minY = Infinity;
        for (let obj of q.data) {
            minX = Math.min(minX, obj.x);
            minY = Math.min(minY, obj.y);
        }
        for (let obj of q.data) {
            obj.x -= minX;
            obj.y -= minY;
        }
        for (let value of rpfSel) {
            rpfP.data.delete(value);
        }
        rpfP.recomputeSizes();
        let obj: RPFObjectData = {
            p: q,
            x: minX,
            y: minY,
            rotation: 'F',
            time: 0,
        };
        rpfP.addObject(obj);
        rpfSel.clear();
        rpfSel.add(obj);
        (rpfFile as RPFFile).data[q.key] = q;
    }],

    'sel-ungroup': [() => {
        if (rpfSel.size === 0) {
            return;
        }
        pushUndo();
        let objs: RPFObjectData[] = [];
        for (let value of rpfSel) {
            objs.push(value);
            rpfP.data.delete(value);
        }
        objs = objs.map(x => x.p instanceof RPFPattern ? Array.from(x.p.data).map(y => ({p: y.p, x: y.x + x.x, y: y.y + x.y, rotation: y.rotation, time : y.time})) : x).flat();
        rpfSel.clear();
        for (let obj of objs) {
            rpfP.addObject(obj);
            rpfSel.add(obj);
        }
    }],

    'sel-move-up': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.y--;
        }
        rpfP.recomputeSizes();
    }],

    'sel-move-down': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.y++;
        }
        rpfP.recomputeSizes();
    }],

    'sel-move-left': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.x--;
        }
        rpfP.recomputeSizes();
    }],

    'sel-move-right': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.x++;
        }
        rpfP.recomputeSizes();
    }],

    'sel-clear': [() => {
        pushUndo();
        for (let value of rpfSel) {
            rpfP.data.delete(value);
        }
        rpfSel.clear();
        rpfP.recomputeSizes();
    }],

    'sel-flip-horizontal': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['Bx'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-flip-vertical': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['Fx'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-rotate-left': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['L'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-rotate-right': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['R'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-rotate-180': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['B'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-flip-diagonal': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['Lx'];
        }
        rpfP.recomputeSizes();
    }],

    'sel-flip-anti-diagonal': [() => {
        pushUndo();
        for (let value of rpfSel) {
            value.rotation = ROTATION_COMBINE[value.rotation]['Rx'];
        }
        rpfP.recomputeSizes();
    }],

    'copy': [() => {
        if (rpfSel.size === rpfP.data.size) {
            if (!rpfFile) {
                throw new Error(`No rpfFile when copying everything!`);
            }
            navigator.clipboard.writeText(rpfToString(rpfFile));
        } else if (rpfSel.size > 0) {
            let q = rpfP.clearedCopy();
            q.data = rpfSel;
            navigator.clipboard.writeText(q.toString());
        }
    }],

    'start-paste': [async event => {
        if (event) {
            event.preventDefault();
        }
        let text = await navigator.clipboard.readText();
        let q = parse(text, true);
        pasting = Array.isArray(q) ? undefined : q;
        run('set-cursor-to-main');
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

    'select-all': [event => {
        if (event) {
            event.preventDefault();
        }
        for (let value of rpfP.data) {
            rpfSel.add(value);
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
    'command': {'keydown': 'command-keypress', 'blur': 'click-off-command'},
    'view-rle': {'click': 'view-rle'},
    'help-button': {'click': 'show-help'},
    'help-x': {'click': 'hide-help'},
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


function frame() {
    run('frame');
    requestAnimationFrame(frame);
}

let start = `

B3/S23

glider:
*456

main:
glider 0 0

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
