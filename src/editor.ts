
import {Pattern, createPattern, parse} from './core/index.js';


function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}


interface Theme {
    twoState: string[];
    multiState(states: number): string[];
    selection: string;
};

const THEMES: {[key: string]: Theme} = {

    'default': {
        twoState: ['#000000', '#ffffff'],
        multiState(states: number): string[] {
            let out: string[] = ['#000000'];
            for (let i = 1; i < states; i++) {
                out.push(`#ff` + Math.floor((states - i) * (256 / (states - 1))).toString(16).padStart(2, '0') + '00');
            }
            return out;
        },
        selection: `rgba(0, 255, 0, 0.5)`,
    },

};

let theme: Theme = THEMES['default'];


let p = createPattern('B3/S23');

interface UndoState {
    p: Pattern;
    hasRan: boolean;
}

let undoBuffer: UndoState[] = [];
let redoBuffer: UndoState[] = [];
let beforeRunning = p;
let hasRan = false;

let scale = 10;
let topLeftX = 0;
let topLeftY = 0;

let zoomStrength = 0.3;

let step = 1;
let stepEvery = 1;
let running = false;

let isDragging = false;
let dragStart = [0, 0];
let dragOffsetStart = [0, 0];
let dragSelectStart = [0, 0];

let cursorMode: 'main' | 'edit' | 'select' = 'main';
let drawState = 1;
let drawDeleteMode = false;
let prevEditX: number | undefined = undefined;
let prevEditY: number | undefined = undefined;

let selection: {x: number, y: number, height: number, width: number} | undefined = undefined;


let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');

let zoomElt = getElement('zoom');

function loadPattern(q: Pattern): void {
    p = q;
    scale = Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5);
    zoomElt.textContent = scale.toFixed(1);
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
    beforeRunning = p.copy();
    hasRan = false;
    selection = undefined;
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = '';
    resetButton.className = 'selected';
}


runButton.addEventListener('click', () => {
    undoBuffer.push({p: p.copy(), hasRan});
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
});

pauseButton.addEventListener('click', () => {
    running = false;
    runButton.style.display = 'block';
    pauseButton.style.display = 'none';
    runButton.className = 'selected';
    pauseButton.className = 'selected';
    stepButton.className = '';
    resetButton.className = '';
});

stepButton.addEventListener('click', () => {
    if (running) {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
    }
    if (!hasRan) {
        beforeRunning = p.copy();
        hasRan = true;
    }
    undoBuffer.push({p: p.copy(), hasRan});
    p.runGeneration();
    p.shrinkToFit();
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = 'selected';
    resetButton.className = '';
});

resetButton.addEventListener('click', () => {
    undoBuffer.push({p: p.copy(), hasRan});
    hasRan = false;
    running = false;
    p = beforeRunning;
    runButton.style.display = 'block';
    pauseButton.style.display = 'none';
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = '';
    resetButton.className = 'selected';
});

let cursorMainButton = getElement('cursor-main');
let cursorEditButton = getElement('cursor-edit');
let cursorSelectButton = getElement('cursor-select');

cursorMainButton.addEventListener('click', () => {
    cursorMode = 'main';
    cursorMainButton.className = 'selected';
    cursorEditButton.className = '';
    cursorSelectButton.className = '';
});

cursorEditButton.addEventListener('click', () => {
    cursorMode = 'edit';
    cursorMainButton.className = '';
    cursorEditButton.className = 'selected';
    cursorSelectButton.className = '';
    prevEditX = undefined;
    prevEditY = undefined;
});

cursorSelectButton.addEventListener('click', () => {
    cursorMode = 'select';
    cursorMainButton.className = '';
    cursorEditButton.className = '';
    cursorSelectButton.className = 'selected';
});

getElement('undo').addEventListener('click', () => {
    redoBuffer.push({p: p.copy(), hasRan});
    let state = undoBuffer.pop();
    if (state) {
        running = false;
        p = state.p.copy();
        hasRan = state.hasRan;
    }
});

getElement('redo').addEventListener('click', () => {
    let state = redoBuffer.pop();
    if (state) {
        undoBuffer.push({p: p.copy(), hasRan});
        running = false;
        p = state.p.copy();
        hasRan = state.hasRan;
    }
});

getElement('view-rle').addEventListener('click', () => loadPattern(parse(getElement<HTMLTextAreaElement>('rle').value)));


let canvas = getElement<HTMLCanvasElement>('main');
let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

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

let posElt = getElement('position');
let xElt = getElement('x');
let yElt = getElement('y');
let stateElt = getElement('state');

canvas.addEventListener('mousedown', event => {
    isDragging = true;
    dragStart = [event.clientX, event.clientY];
    dragOffsetStart = [topLeftX, topLeftY];
    if (cursorMode === 'edit') {
        undoBuffer.push({p: p.copy(), hasRan});
        editCell(event, true);
    } else if (cursorMode === 'select') {
        let [x, y] = getMouseXY(event);
        dragSelectStart = [x, y];
        selection = undefined;
    }
});

canvas.addEventListener('mousemove', event => {
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
            selection = {x: minX, y: minY, height: maxY - minY + 1, width: maxX - minX + 1};
        }
    }

});


function mouseUpEvent(): void {
    isDragging = false;
    prevEditX = undefined;
    prevEditY = undefined;
    drawDeleteMode = false;
}

canvas.addEventListener('mouseup', mouseUpEvent);

canvas.addEventListener('mouseleave', () => {
    mouseUpEvent();
    posElt.style.display = 'none';
});

canvas.addEventListener('mouseenter', () => {
    posElt.style.display = 'flex';
});

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;

canvas.addEventListener('wheel', event => {
    event.preventDefault();
    totalDeltaY += event.deltaY;
    console.log(event.deltaY);
    wheelEvent = event;
});

let speedElt = getElement('speed');
speedElt.addEventListener('click', () => {
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
});


let gensElt = getElement('gens');
let popElt = getElement('pop');

let frameCount = 0;

let fps = 0;
let startTime = performance.now();

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
        zoomElt.textContent = scale.toFixed(1);
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
    if (selection) {
        ctx.fillStyle = theme.selection;
        ctx.fillRect(selection.x + topLeftX + xMod, selection.y + topLeftY + yMod, selection.width, selection.height);
    }
    ctx.restore();
    frameCount++;
    fps = frameCount / (performance.now() - startTime) * 1000;
    requestAnimationFrame(frame);
}

window.addEventListener('load', () => setTimeout(() => {
    requestAnimationFrame(frame);
    updateSizes();
    loadPattern(parse(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`));
}, 100));
