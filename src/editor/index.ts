
let showDirectoryPicker: (options?: {id?: string, mode?: 'read' | 'readwrite', startIn?: string | FileSystemFileHandle}) => Promise<FileSystemDirectoryHandle>;
// import {showDirectoryPicker} from 'file-system-access';
import {INSERT_COPY, INSERT_AND, INSERT_OR, INSERT_XOR, Pattern, CoordPattern, createPattern, parse as parseRLE} from '../core/index.js';
import {RPFError, Rotation, ROTATION_COMBINE, applyRotation, transformCoordinates, isInside, getOverlap, RPFObjectData, RPFPattern, File, Directory, RPFFile} from './rpf.js';

import './base.js';

import * as lifeweb from '../core/index.js';
Object.assign(globalThis, lifeweb);
Object.assign(globalThis, {RPFError, ROTATION_COMBINE, applyRotation, transformCoordinates, isInside, getOverlap, RPFPattern, FSFile: File, Directory, RPFFile});


let leftElt = getElement('left');
let leftRightResizerElt = getElement('left-right-resizer');
let rightElt = getElement('right');

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

let interactionLevelElt = getElement('interaction-level');

let selectMenuElt = getElement('select-menu');
let pasteModeMenuElt = getElement('paste-mode-menu');
let interactionLevelMenuElt = getElement('interaction-level-menu');

let selGroupButton = getElement('sel-group');
let selUngroupButton = getElement('sel-ungroup');

let rpfCMElt = getElement('rpf-context-menu');
let rpfCMNameElt = getElement('cm-name');
let rpfCMPathElt = getElement('cm-path');
let rpfCMDescElt = getElement('cm-desc');

let commandWrapperElt = getElement('command-wrapper');
let commandElt = getElement('command');

let searchWrapperElt = getElement('search-wrapper');
let searchElt = getElement('search');

let fsWrapperElt = getElement('file-system');

let rleElt = getElement('rle', 'textarea');

let helpElt = getElement('help');


function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan, rpfEditing});
}

function applyUndo(state: UndoState): void {
    running = false;
    p = state.p.copy();
    hasRan = state.hasRan;
    rpfEditing = state.rpfEditing;
}


function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
    canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
    ctx.imageSmoothingEnabled = false;
    pixelHeight = canvas.height / scale;
    pixelWidth = canvas.width / scale;
}


function parse(data: string, preserveSizes?: boolean): Pattern | [string, string, string] {
    try {
        return parseRLE(data, undefined, preserveSizes);
    } catch (error) {
        try {
            return RPFPattern.fromString(data, rpfFile ?? new RPFFile(p, '/', {}));
        } catch (error2) {
            try {
                let out = RPFFile.fromString(data, '/main', fs);
                if (!out.data['main']) {
                    throw new Error(`No 'main' entry presented in loaded RPF!`);
                } else {
                    return out.data['main'];
                }
            } catch (error3) {
                console.error(error);
                console.error(error2);
                console.error(error3);
                return [String(error), String(error2), String(error3)];
            }
        }
    }
}

function loadPattern(q: string | RPFFile | Pattern): void {
    if (typeof q === 'string') {
        try {
            q = parseRLE(q);
        } catch (error) {
            try {
                q = RPFFile.fromString(q as string, '/main', fs);
            } catch (error2) {
                console.error(error);
                console.error(error2);
                alert(`Invalid pattern!:\n\n${error}\n\n${error2}`);
                return;
            }
        }
    }
    if (q instanceof Pattern) {
        p = q;
        if (p instanceof RPFPattern) {
            rpfFile = new RPFFile(p, '/', {});
            rpfFile.data['main'] = p;
        }
    } else {
        rpfFile = q;
        p = rpfFile.data['main'];
        if (!p) {
            throw new Error(`No 'main' entry present in loaded RPF`);
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
    if (p instanceof RPFPattern) {
        rpfP = p;
    } else {
        // @ts-ignore
        rpfP = undefined;
    }
    run('load-pattern');
}


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
    ctx.save();
    let [pXOffset, pYOffset] = p.getFullOffset();
    let xOffset = -p.xOffset - topLeftX - x;
    let yOffset = -p.yOffset - topLeftY - y;
    let xMod = xOffset % 1;
    let yMod = yOffset % 1;
    ctx.scale(scale, scale);
    ctx.translate(-xMod, -yMod);
    xOffset -= xMod;
    yOffset -= yMod;
    let startY = Math.max(0, -yOffset) + (pYOffset - p.yOffset);
    let endY = Math.max(pixelHeight, p.height - yOffset);
    let startX = Math.max(0, -xOffset) + (pXOffset - p.xOffset);
    let endX = Math.max(pixelWidth, p.width - xOffset);
    for (let screenY = startY; screenY <= endY; screenY++) {
        for (let screenX = startX; screenX <= endX; screenX++) {
            let x = screenX + xOffset;
            let y = screenY + yOffset;
            if (rotation && rotation !== 'F') {
                [x, y] = transformCoordinates(x, y, p.width, p.height, rotation);
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

interface RPFDrawStateData {
    normal: string[];
    selected: string[];
    hover: string[];
}

function drawRPF(p: RPFPattern, states: RPFDrawStateData, xPos: number, yPos: number, startRotation: Rotation, mode: 'normal' | 'selected' | 'hover'): void {
    for (let value of p.data) {
        let p = value.p;
        let mode2: typeof mode;
        if (mode === 'selected' || rpfSel.has(value)) {
            mode2 = 'selected';
        } else if (mode === 'hover' || value === rpfHover) {
            mode2 = 'hover';
        } else {
            mode2 = 'normal';
        }
        let rotation = ROTATION_COMBINE[startRotation][value.rotation];
        let xOffset = xPos + value.x;
        let yOffset = yPos + value.y;
        let [minX, minY] = p.getFullOffset();
        minX += xOffset;
        minY += yOffset;
        if (minX + p.width < -topLeftX || minY + p.height < -topLeftY || minX > -topLeftX + pixelWidth || minY > -topLeftY + pixelHeight) {
            continue;
        }
        if (p instanceof RPFPattern) {
            drawRPF(p, states, xOffset, yOffset, rotation, mode2);
        } else {
            drawPattern(p, states[mode2], xOffset, yOffset, rotation);
        }
    }
}


let fsFolderTemplate = getElement('fs-folder-template', 'template').content;

class FSFolderElement extends HTMLElement {

    static observedAttributes = ['name', 'open'];
    
    file: Directory;

    _iconOpenElt: HTMLElement;
    _iconClosedElt: HTMLElement;
    _nameElt: HTMLElement;
    _mainElt: HTMLElement;

    constructor(file: Directory, name: string, showLeftBar: boolean = true) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFolderTemplate, true));
        this._iconOpenElt = root.getElementById('icon-open') as HTMLElement;
        this._iconClosedElt = root.getElementById('icon-closed') as HTMLElement;
        this._nameElt = root.getElementById('name') as HTMLElement;
        this._mainElt = root.getElementById('main') as HTMLElement;
        (root.getElementById('top') as HTMLElement).addEventListener('click', () => {
            this.open = !this.open;
        });
        if (this.getAttribute('open') !== null) {
            this._iconOpenElt.style.display = 'block';
            this._iconClosedElt.style.display = 'none';
            this._mainElt.style.display = 'flex';
        }
        this.setAttribute('name', name);
        if (!showLeftBar) {
            (root.getElementById('left-bar') as HTMLElement).style.display = 'none';
        }
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        } else if (name === 'open') {
            if (newValue !== null) {
                this._iconOpenElt.style.display = 'block';
                this._iconClosedElt.style.display = 'none';
                this._mainElt.style.display = 'flex';
            } else {
                this._iconOpenElt.style.display = 'none';
                this._iconClosedElt.style.display = 'block';
                this._mainElt.style.display = 'none';
            }
        }
    }

    get open(): boolean {
        return this.getAttribute('open') !== null;
    }

    set open(value: boolean) {
        if (value) {
            this.setAttribute('open', 'open');
        } else {
            this.removeAttribute('open');
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

}

customElements.define('fs-folder', FSFolderElement);


let fsFileTemplate = getElement('fs-file-template', 'template').content;

class FSFileElement extends HTMLElement {

    static observedAttributes = ['name'];

    file: File;

    _nameElt: HTMLElement;

    constructor(file: File, name: string) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFileTemplate, true));
        this._nameElt = root.getElementById('name') as HTMLElement;
        this.addEventListener('dblclick', () => {
            run('open-file', new CustomEvent('open-file', {detail: {name: this.name, file: this.file}}));
        });
        this.setAttribute('name', name);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

}

customElements.define('fs-file', FSFileElement);


class FSRPFItemElement extends HTMLElement {

    file: RPFFile;
    p: RPFPattern;

    constructor(file: RPFFile, p: RPFPattern) {
        super();
        this.file = file;
        this.p = p;
        let name = p.getName();
        this.textContent = name;
        this.draggable = true;
        this.addEventListener('dragstart', event => {
            let transfer = event.dataTransfer as DataTransfer;
            transfer.dropEffect = 'link';
            transfer.setData('application/x-lifeweb-editor-drag', file.path + '\n' + p.key);
            let parent = this.parentElement as HTMLElement;
            let old = parent.style.overflowY;
            parent.style.overflowY = 'visible';
            this.style.width = 'fit-content';
            requestAnimationFrame(() => {
                let rect = this.getBoundingClientRect();
                transfer.setDragImage(this, rect.width / 2, rect.height / 2);
                requestAnimationFrame(() => {
                    parent.style.overflowY = old;
                    this.style.removeProperty('width');
                });
            });
        });
    }

}

customElements.define('fs-rpf-item', FSRPFItemElement);

canvas.addEventListener('dragover', event => {
    event.preventDefault();
});


class FSRPFFileElement extends HTMLElement {

    static observedAttributes = ['name', 'open'];
    
    file: File & {rpf: RPFFile};

    _iconOpenElt: HTMLElement;
    _iconClosedElt: HTMLElement;
    _nameElt: HTMLElement;
    _mainElt: HTMLElement;

    constructor(file: File & {rpf: RPFFile}, name: string) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFolderTemplate, true));
        this._iconOpenElt = root.getElementById('icon-open') as HTMLElement;
        this._iconClosedElt = root.getElementById('icon-closed') as HTMLElement;
        this._nameElt = root.getElementById('name') as HTMLElement;
        this._mainElt = root.getElementById('main') as HTMLElement;
        this._mainElt.style.maxHeight = '200px';
        this._mainElt.style.overflowY = 'auto';
        let topElt = root.getElementById('top') as HTMLElement;
        topElt.addEventListener('click', () => {
            this.open = !this.open;
        });
        (root.getElementById('left-bar') as HTMLElement).style.display = 'none';
        if (this.getAttribute('open') !== null) {
            this._iconOpenElt.style.display = 'block';
            this._iconClosedElt.style.display = 'none';
            this._mainElt.style.display = 'flex';
        }
        this.setAttribute('name', name);
        this.updateContents();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        } else if (name === 'open') {
            if (newValue !== null) {
                this._iconOpenElt.style.display = 'block';
                this._iconClosedElt.style.display = 'none';
                this._mainElt.style.display = 'flex';
            } else {
                this._iconOpenElt.style.display = 'none';
                this._iconClosedElt.style.display = 'block';
                this._mainElt.style.display = 'none';
            }
        }
    }

    get open(): boolean {
        return this.getAttribute('open') !== null;
    }

    set open(value: boolean) {
        if (value) {
            this.setAttribute('open', 'open');
        } else {
            this.removeAttribute('open');
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

    updateContents(): void {
        let rpf = this.file.rpf;
        let out: HTMLElement[] = [];
        for (let value of Object.values(rpf.data)) {
            out.push(new FSRPFItemElement(this.file.rpf, value));
        }
        this.replaceChildren(...out);
    }

}

customElements.define('fs-rpf-file', FSRPFFileElement);


async function updateFileSystem(dir: FileSystemDirectoryHandle, toAddTo: Directory): Promise<void> {
    let out: Directory;
    let value = toAddTo.data[dir.name];
    if (value) {
        if (value instanceof Directory) {
            out = value;
        } else {
            toAddTo.rm(dir.name);
            out = toAddTo.mkdir(dir.name);
        }
    } else {
        out = toAddTo.mkdir(dir.name);
    }
    let names = new Set(Object.keys(out.data));
    for await (let [name, value] of dir.entries()) {
        names.delete(name);
        if (value.kind === 'directory') {
            if (name in out.data && !(out.data[name] instanceof Directory)) {
                out.rm(name);
            }
            await updateFileSystem(value, out);
            out.data[name].handle = value;
        } else {
            console.log(value);
            let fileBlob = await value.getFile();
            if (name in out.data) {
                if (out.data[name] instanceof Directory) {
                    out.rm(name);
                } else if (fileBlob.lastModified < out.data[name].lastModified) {
                    continue;
                }
            }
            out.write(name, await fileBlob.text());
            let file = out.data[name] as File;
            file.handle = value;
            if (fileBlob.name.endsWith('.rpf')) {
                let rpf: RPFFile;
                try {
                    rpf = RPFFile.fromString(file.value, file.path, fs);
                } catch (error) {
                    if (error instanceof RPFError) {
                        continue;
                    } else {
                        throw error;
                    }
                }
                file.rpf = rpf;
            }
        }
    }
    for (let name of names) {
        out.rm(name);
    }
}

function renderFileSystem(dir: Directory, elt: HTMLElement | FSFolderElement, depth: number = 0): void {
    let sorted = Object.entries(dir.data).sort((a, b) => {
        if (a[1] instanceof Directory) {
            if (b[1] instanceof Directory) {
                return a[0] < b[0] ? -1 : 1;
            } else {
                return -1;
            }
        } else {
            if (b[1] instanceof Directory) {
                return 1;
            } else {
                return a[0] < b[0] ? -1 : 1;
            }
        }
    }).map(x => x[0]);
    let newChildren: (HTMLElement | undefined)[] = [];
    for (let i = 0; i < sorted.length; i++) {
        newChildren.push(undefined);
    }
    for (let value of Array.from(elt.children).filter(x => x instanceof FSFolderElement || x instanceof FSFileElement || x instanceof FSRPFFileElement)) {
        if (value.name in dir.data) {
            let file = dir.data[value.name];
            if (file instanceof Directory) {
                if (value instanceof FSFileElement || value instanceof FSRPFFileElement) {
                    value = new FSFolderElement(file, value.name, depth > 0);
                }
                renderFileSystem(file, value, depth + 1);
            } else if (value instanceof FSRPFFileElement) {
                value.updateContents();
            } else {
                if (value instanceof FSFolderElement || value instanceof FSRPFFileElement) {
                    value = new FSFileElement(file, value.name);
                }
            }
        }
        newChildren[sorted.indexOf(value.name)] = value;
    }
    elt.replaceChildren(...newChildren.map((value, i) => {
        if (value === undefined) {
            let name = sorted[i];
            let file = dir.data[name];
            let out: FSFileElement | FSFolderElement | FSRPFFileElement;
            if (file instanceof Directory) {
                out = new FSFolderElement(file, name, depth > 0);
                // alert(name + ': ' + Object.keys(file.data).join(', '));
                renderFileSystem(file, out, depth + 1);
            } else if (file.rpf) {
                let newFile = new FSRPFFileElement(file as File & {rpf: RPFFile}, name);
                out = newFile;
            } else {
                out = new FSFileElement(file, name);
            }
            out.name = name;
            return out;
        } else {
            return value;
        }
    }));
}


function loadFile(name: string, file: File): void {
    if (file.rpf) {
        loadPattern(file.rpf);
    } else {
        loadPattern(file.value);
        if (p instanceof RPFFile) {
            file.rpf = rpfFile;
        }
    }
    currentFile = file;
}

function runFile(name: string, file: File): void {
    try {
        (new Function(`(async()=>{${file.value})()`))();
    } catch (error) {
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
}

var extensions: {[key: string]: (name: string, file: File) => void} = {

    '.rle': loadFile,
    '.rpf': loadFile,

    '.js': runFile,
    '.mjs': runFile,
    '.cjs': runFile,

};


type DefaultAction = 
    | 'frame'
    | 'window-click' | 'window-visibilitychange'
    | 'scroll-canvas' | 'click-canvas' | 'move-mouse-over-canvas' | 'unclick-canvas' | 'move-mouse-onto-canvas' | 'move-mouse-off-of-canvas' | 'right-click-canvas'
    | 'run' | 'pause' | 'step' | 'reset' | 'set-speed'
    | 'set-cursor-to-main' | 'set-cursor-to-edit' | 'set-cursor-to-select'
    | 'undo' | 'redo'
    | 'set-scale' | 'faster' | 'slower'
    | 'sel-cancel' | 'sel-group' | 'sel-ungroup' | 'sel-move-up' | 'sel-move-down' | 'sel-move-left' | 'sel-move-right' | 'sel-clear' | 'sel-flip-horizontal' | 'sel-flip-vertical' | 'sel-rotate-left' | 'sel-rotate-right' | 'sel-rotate-180' | 'sel-flip-diagonal' | 'sel-flip-anti-diagonal'
    | 'copy' | 'start-paste' | 'end-paste' | 'exit-paste' | 'cut' | 'select-all' | 'set-paste-mode-to-or' | 'set-paste-mode-to-copy' | 'set-paste-mode-to-and' | 'set-paste-mode-to-xor'
    | 'inc-interaction-level' | 'dec-interaction-level'
    | 'open-command' | 'command-keypress' | 'run-command' | 'click-off-command'
    | 'load-pattern' | 'view-rle'
    | 'show-help' | 'hide-help'
    | 'open-folder' | 'render-file-system' | 'open-file' | 'canvas-drop'
;

type Hook = (event?: Event) => void;


let frameCount = 0;

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;


var sharedActions: {[K in DefaultAction]?: Hook[]} = {

    'window-visibilitychange': [async () => {
        if (document.visibilityState === 'visible' && rootDirHandle) {
            await updateFileSystem(rootDirHandle, fs);
            run('render-file-system');
        }
    }],

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
        frameCount++;
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

    'exit-paste': [() => {
        pasting = undefined;
        rpfPasting = undefined;
    }],

    'cut': [() => {
        run('copy');
        run('sel-clear');
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

    'load-pattern': [() => {
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
        pasting = undefined;
        rpfPasting = undefined;
        pasteModeMenuElt.style.display = 'none';
        rpfSel.clear();
        rpfCMShown = false;
        rpfCMElt.style.display = 'none';
        if (p instanceof RPFPattern) {
            cursorSelectButton.style.display = 'none';
            selGroupButton.style.display = 'block';
            selUngroupButton.style.display = 'block';
            cursorMainButton.dataset.title = 'pan/select';
            interactionLevelMenuElt.style.display = 'flex';
        } else {
            cursorSelectButton.style.display = 'block';
            selGroupButton.style.display = 'none';
            selUngroupButton.style.display = 'none';
            cursorMainButton.dataset.title = 'pan';
            interactionLevelMenuElt.style.display = 'none';
        }
    }],

    'view-rle': [() => {
        loadPattern(rleElt.value);
    }],

    'show-help': [() => {
        helpElt.style.display = 'block';
    }],

    'hide-help': [() => {
        helpElt.style.display = 'none';
    }],

    'open-folder': [async () => {
        let dir: FileSystemDirectoryHandle;
        try {
            dir = await showDirectoryPicker({id: 'lifeweb-editor-rpf-open', mode: 'readwrite'} as Parameters<typeof showDirectoryPicker>[0]);
        } catch (error) {
            if (error instanceof DOMException && error.name === 'AbortError') {
                return;
            } else {
                throw error;
            }
        }
        rootDirHandle = dir;
        await updateFileSystem(dir, fs);
        getElement('open-folder').style.display = 'none';
        getElement('file-system').style.display = 'flex';
        getElement('rle-wrapper').style.display = 'none';
        run('render-file-system');
        for (let elt of Array.from(fsWrapperElt.children)) {
            if (elt instanceof FSFolderElement) {
                elt.open = true;
            }
        }
        searchWrapperElt.style.display = 'flex';
    }],

    'render-file-system': [() => {
        renderFileSystem(fs, fsWrapperElt);
    }],

    'open-file': [event => {
        if (!(event instanceof CustomEvent)) {
            throw new Error(`command-keypress called with non-CustomEvent value`);
        }
        let {name, file}: {name: string, file: File} = event.detail;
        for (let key in extensions) {
            if (name.endsWith(key)) {
                extensions[key](name, file);
                return;
            }
        }
        alert('No file handlers found');
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
        }
    }],

    'click-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        if (event.buttons !== 1) {
            return;
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
            alert(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}\n\n${q[2]}`);
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

    'window-click': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        if (rpfCMShown && event.target instanceof HTMLElement && !rpfCMElt.contains(event.target)) {
            rpfCMShown = false;
            rpfCMElt.style.display = 'none';
        }
    }],

    'frame': [() => {
        interactionLevelElt.textContent = String(interactionLevel);
        let normal = [theme.empty];
        if (p.rule.states === 2) {
            normal.push(theme.twoState);
        } else {
            normal.push(...theme.multiState(p.rule.states));
        }
        let selected = normal.slice();
        selected[1] = theme.rpfSelection;
        let hover = normal.slice();
        hover[1] = theme.rpfHover;
        let states = {normal, selected, hover};
        ctx.fillStyle = normal[0];
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        drawRPF(rpfP, states, 0, 0, 'F', 'normal');
        if (rpfSel.size > 0) {
            selectMenuElt.style.display = 'flex';
        } else {
            selectMenuElt.style.display = 'none';
        }
        if (rpfPasting) {
            let q = rpfPasting[0];
            drawRPF(q, states, mouseX, mouseY, rpfPasting[1], 'normal');
            ctx.save();
            let xOffset = -topLeftX - mouseX;
            let yOffset = -topLeftY - mouseY;
            let xMod = xOffset % 1;
            let yMod = yOffset % 1;
            ctx.scale(scale, scale);
            ctx.translate(-xMod, -yMod);
            xOffset -= xMod;
            yOffset -= yMod;
            ctx.fillStyle = theme.pasting;
            ctx.fillRect(-xOffset - fillOffset, -yOffset - fillOffset, q.width + fillExpand, q.height + fillExpand);
            ctx.restore();
        }
    }],

    'click-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`click-canvas called with non-MouseEvent value`);
        }
        if (event.buttons !== 1) {
            return;
        }
        isDragging = true;
        dragStart = [event.clientX, event.clientY];
        dragOffsetStart = [topLeftX, topLeftY];
        if (rpfPasting) {
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
            if (rpfPasting) {
                return;
            }
            if (cursorMode === 'main') {
                topLeftX = dragOffsetStart[0] + (event.clientX - dragStart[0]) / scale;
                topLeftY = dragOffsetStart[1] + (event.clientY - dragStart[1]) / scale;
            } else if (cursorMode === 'edit') {
                editCellRPF(false);
            }
        } else {
            rpfHover = rpfP.getObjectAt(mouseX, mouseY, interactionLevel);
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
            let value = rpfP.getObjectAt(mouseX, mouseY, interactionLevel);
            if (value) {
                if (rpfSel.has(value)) {
                    rpfSel.delete(value);
                } else {
                    rpfSel.add(value);
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

    'right-click-canvas': [event => {
        if (!(event instanceof MouseEvent)) {
            throw new Error(`right-click-canvas called with non-MouseEvent value`);
        }
        if (event.shiftKey) {
            return;
        }
        event.preventDefault();
        if (rpfCMShown) {
            rpfCMShown = false;
            rpfCMElt.style.display = 'none';
        } else {
            if (!rpfHover) {
                return;
            }
            let q = rpfHover.p;
            if (!(q instanceof RPFPattern)) {
                return;
            }
            rpfCMShown = true;
            let rect = rightElt.getBoundingClientRect();
            let x = event.clientX - rect.left + 4;
            let y = event.clientY - rect.top + 4;
            rpfCMElt.style.display = 'flex';
            rpfCMElt.style.left = x + 'px';
            rpfCMElt.style.top = y + 'px';
            rpfCMNameElt.textContent = q.getName(true);
            rpfCMPathElt.textContent = q.path;
            let desc = '';
            if (q.periodic) {
                desc += q.getTypeDescription() + '\n';
            }
            if (q.desc !== undefined) {
                desc += q.desc;
            }
            rpfCMDescElt.textContent = desc;
        }
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
        if (rpfSel.size === 0) {
            navigator.clipboard.writeText(rpfFile.toString());
        } else if (rpfSel.size === 1) {
            navigator.clipboard.writeText(Array.from(rpfSel)[0].p.toString(rpfFile, true));
        } else {
            let q = rpfP.clearedCopy();
            q.key = '__copy__';
            q.data = new Set();
            for (let value of rpfSel) {
                q.data.add({p: value.p, x: value.x, y: value.y, rotation: value.rotation, time: value.time});
            }
            q.recomputeSizes();
            q.offsetBy(-q.minX, -q.minY);
            navigator.clipboard.writeText(q.toString());
        }
    }],

    'start-paste': [async event => {
        if (event) {
            event.preventDefault();
        }
        let text = await navigator.clipboard.readText();
        let q = parse(text, true);
        if (Array.isArray(q)) {
            alert(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}\n\n${q[2]}`);
            return;
        }
        if (!(q instanceof RPFPattern)) {
            if (!rpfFile) {
                alert(`No rpfFile when running RPF start-paste!`);
                return;
            }
            let key = prompt(`Enter key:`);
            if (key === null) {
                return;
            }
            q = rpfP.fromPattern(key, rpfFile, q);
        }
        if (!(q instanceof RPFPattern)) {
            throw new Error(`This error should not occur (please check devtools and report the traceback)`);
        }
        if (q.key === 'main') {
            q.key = '__copy__';
        }
        q.offsetBy(-q.minX, -q.minY);
        alert(q.width + ' ' + q.height);
        rpfPasting = [q, 'F'];
        run('set-cursor-to-main');
    }],

    'end-paste': [() => {
        if (!rpfPasting) {
            return;
        }
        pushUndo();
        let q = rpfPasting[0];
        if (q.key === '__copy__') {
            for (let value of q.data) {
                value.x += mouseX;
                value.y += mouseY;
                rpfP.addObject(value);
            }
        } else {
            rpfP.addObject({p: q, x: mouseX, y: mouseY, rotation: rpfPasting[1], time: 0});
        }
        rpfPasting = undefined;
    }],

    'select-all': [event => {
        if (event) {
            event.preventDefault();
        }
        for (let value of rpfP.data) {
            rpfSel.add(value);
        }
    }],

    'inc-interaction-level': [() => {
        interactionLevel++;
    }],


    'dec-interaction-level': [() => {
        interactionLevel--;
        if (interactionLevel < 0) {
            interactionLevel = 0;
        }
    }],

    'canvas-drop': [event => {
        if (!(event instanceof DragEvent)) {
            throw new Error(`canvas-drop called with non-DragEvent value`);
        }
        if (!(event.dataTransfer)) {
            throw new Error(`canvas-drop called with no data transfer`);
        }
        let [path, key] = event.dataTransfer.getData('application/x-lifeweb-editor-drag').split('\n');
        let file = fs.read(path);
        if (!(file instanceof File) || !file.rpf) {
            throw new Error(`This error should not occur (please check devtools and report the traceback)`);
        }
        let rpf = file.rpf;
        if (!(file.name in rpfFile.imports)) {
            rpfFile.imports[file.name] = rpf;
        }
        if (file.name === '/stdlib.rpf' && !rpfFile.starImports.includes(stdlib)) {
            rpfFile.starImports.push(stdlib);
        }
        rpfPasting = [rpf.data[key], 'F'];
        run('set-cursor-to-main');
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
    'view-rle': {'click': 'view-rle'},
    'help-button': {'click': 'show-help'},
    'help-x': {'click': 'hide-help'},
    'open-folder': {'click': 'open-folder'},
};

var eventListeners: {[key: string]: [DefaultAction, (event: Event) => void]} = {};

function setEvent(id: string, event: keyof HTMLElementEventMap, action: DefaultAction): void {
    let elt = id === 'window' ? window : getElement(id);
    let key = id + '\n' + event;
    if (key in eventListeners) {
        elt.removeEventListener(event, eventListeners[key][1]);
    }
    let listener = (event: Event) => run(action, event);
    elt.addEventListener(event, listener);
    eventListeners[key] = [action, listener];
}


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
    'Escape': 'exit-paste',
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


window.onbeforeunload = event => {
    event.preventDefault();
    return `Are you sure you want to leave? Patterns may not be saved yet.`;
};

window.addEventListener('resize', updateSizes);

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


function frame() {
    run('frame');
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
    showDirectoryPicker = (await import('https://esm.sh/file-system-access')).showDirectoryPicker;
    stdlib = RPFFile.fromString(await (await fetch('stdlib.rpf')).text(), '/stdlib.rpf', fs);
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
    rleElt.value = start;
    requestAnimationFrame(frame);
    canvas.focus();
}, 100));
