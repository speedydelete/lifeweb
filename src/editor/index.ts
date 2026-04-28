
import {Pattern, createPattern, parse} from '../core/index.js';


function getElement<T extends HTMLElement = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}


let p = createPattern('B3/S23');

let undoBuffer: Pattern[] = [];
let redoBuffer: Pattern[] = [];

let scale = 10;
let topLeftX = 0;
let topLeftY = 0;

let step = 1;
let stepEvery = 1;
let running = false;

let isDragging = false;
let dragStart = {x: 0, y: 0};
let dragOffsetStart = {x: 0, y: 0};

let cursorMode: 'main' | 'edit' | 'select' = 'main';
let drawState = 1;
let prevEditX: number | undefined = undefined;
let prevEditY: number | undefined = undefined;

function loadPattern(q: Pattern): void {
    p = q;
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
}


let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');

runButton.addEventListener('click', () => {
    undoBuffer.push(p.copy());
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

getElement('step').addEventListener('click', () => {
    if (running) {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
    }
    undoBuffer.push(p.copy());
    p.runGeneration();
    runButton.className = '';
    pauseButton.className = '';
    stepButton.className = 'selected';
    resetButton.className = '';
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
    let q = undoBuffer.pop();
    if (q) {
        redoBuffer.push(p);
        p = q;
    }
});

getElement('redo').addEventListener('click', () => {
    let q = redoBuffer.pop();
    if (q) {
        undoBuffer.push(p);
        p = q;
    }
});

getElement('view-rle').addEventListener('click', () => loadPattern(parse(getElement<HTMLTextAreaElement>('rle').value)));


interface Theme {
    states: string[];
}

const THEMES: {[key: string]: Theme} = {

    'default': {
        states: ['#000000', '#ffffff'],
    },

};

let theme: Theme = THEMES['default'];


let canvas = getElement<HTMLCanvasElement>('main');
let ctx = canvas.getContext('2d') as CanvasRenderingContext2D;

function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = bb.height;
    canvas.width = bb.width;
}

window.addEventListener('resize', updateSizes);

function editCell(event: MouseEvent, overridePrev: boolean): void {
    let rect = canvas.getBoundingClientRect();
    let x = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale + p.xOffset);
    let y = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale + p.yOffset);
    if (!overridePrev && x === prevEditX && y === prevEditY) {
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
        topLeftX -= x2 * 2;
        topLeftY -= y2 * 2;
        prevEditX += x2;
        prevEditY += y2;
    }
    p.ensure(x + 1, y + 1);
    p.set(x, y, p.get(x, y) === drawState ? 0 : drawState);
}

canvas.addEventListener('mousedown', event => {
    isDragging = true;
    dragStart = {x: event.clientX, y: event.clientY};
    dragOffsetStart = {x: topLeftX, y: topLeftY};
    if (cursorMode === 'edit') {
        editCell(event, true);
    }
});

canvas.addEventListener('mousemove', event => {
    if (cursorMode === 'main' && isDragging) {
        topLeftX = dragOffsetStart.x + (event.clientX - dragStart.x) / scale;
        topLeftY = dragOffsetStart.y + (event.clientY - dragStart.y) / scale;
    } else if (cursorMode === 'edit' && isDragging) {
        editCell(event, false);
    }
});

function mouseUpEvent(): void {
    isDragging = false;
    prevEditX = undefined;
    prevEditY = undefined;
}
canvas.addEventListener('mouseup', mouseUpEvent);
canvas.addEventListener('mouseleave', mouseUpEvent);

let zoomStrength = 0.2;

canvas.addEventListener('wheel', event => {
    event.preventDefault();
    let rect = canvas.getBoundingClientRect();
    let mouseX = event.clientX - rect.left;
    let mouseY = event.clientY - rect.top;
    let zoomAmount = event.deltaY < 0 ? (1 + zoomStrength) : (1 - zoomStrength);
    let newScale = scale * zoomAmount;
    let worldX = (mouseX - topLeftX * scale) / scale;
    let worldY = (mouseY - topLeftY * scale) / scale;
    topLeftX = (mouseX - worldX * newScale) / newScale;
    topLeftY = (mouseY - worldY * newScale) / newScale;
    scale = newScale;
});

let frameCount = 0;

function frame() {
    if (running && frameCount % stepEvery === 0) {
        p.run(step);
    }
    ctx.fillStyle = theme.states[0];
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let pixelWidth = canvas.width / scale;
    let pixelHeight = canvas.height / scale;
    ctx.save();
    let xOffset = -p.xOffset - topLeftX;
    let yOffset = -p.yOffset - topLeftY;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.translate(-xMod * scale, -yMod * scale);
    xOffset -= xMod;
    yOffset -= yMod;
    for (let y = 0; y < pixelHeight + 1; y++) {
        for (let x = 0; x < pixelWidth + 1; x++) {
            let cell = p.get(x + xOffset, y + yOffset);
            if (cell !== 0) {
                ctx.fillStyle = theme.states[cell];
                ctx.fillRect(x * scale, y * scale, scale, scale);
            }
        }
    }
    ctx.restore();
    frameCount++;
    requestAnimationFrame(frame);
}

requestAnimationFrame(frame);

updateSizes();
loadPattern(parse(`x = 3, y = 3, rule = B3/S23\nbo$2bo$3o!`));
