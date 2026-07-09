
declare let showDirectoryPicker: (options?: {id?: string, mode?: 'read' | 'readwrite', startIn?: string | FileSystemFileHandle}) => Promise<FileSystemDirectoryHandle>;
// import {showDirectoryPicker} from 'file-system-access';
import {path, RPFError, RPFPattern, File, Directory, RPFFile} from './rpf.js';
import {run, addHook, pushUndo, applyUndo, loadPattern, FSFolderElement, FSFileElement, FSRPFFileElement} from './base.js';


let posElt = getElement('position');
let xElt = getElement('x');
let yElt = getElement('y');
let stateElt = getElement('state');

addHook(sharedActions, 'click-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`click-canvas called with non-MouseEvent value`);
    }
    if (event.buttons !== 1) {
        return;
    }
    isDragging = true;
    dragStart = [event.clientX, event.clientY];
    dragOffsetStart = [topLeftX, topLeftY];
});

addHook(sharedActions, 'move-mouse-over-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
    }
    let rect = canvas.getBoundingClientRect();
    mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
    mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
    xElt.textContent = String(mouseX);
    yElt.textContent = String(mouseY);
    stateElt.textContent = String(p.get(mouseX - p.xOffset, mouseY - p.yOffset));
});

addHook(sharedActions, 'move-mouse-onto-canvas', event => {
    if (!(event instanceof MouseEvent)) {
        throw new Error(`move-mouse-onto-canvas called with non-MouseEvent value`);
    }
    let rect = canvas.getBoundingClientRect();
    mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
    mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
    posElt.style.display = 'flex';
});

addHook(sharedActions, 'unclick-canvas', () => {
    isDragging = false;
    prevEditX = undefined;
    prevEditY = undefined;
    drawDeleteMode = false;
});

addHook(sharedActions, 'move-mouse-off-of-canvas', () => {
    isDragging = false;
    prevEditX = undefined;
    prevEditY = undefined;
    drawDeleteMode = false;
    posElt.style.display = 'none';
});

let wheelEvent: WheelEvent | undefined = undefined;
let totalDeltaY = 0;

addHook(sharedActions, 'scroll-canvas', event => {
    if (!(event instanceof WheelEvent)) {
        throw new Error(`scroll called with non-MouseEvent value`);
    }
    event.preventDefault();
    totalDeltaY += event.deltaY;
    wheelEvent = event;
});


let frameCount = 0;

let speedElt = getElement('speed');
let scaleElt = getElement('scale');
let gensElt = getElement('gens');
let popElt = getElement('pop');

let pasteOrButton = getElement('paste-or');
let pasteCopyButton = getElement('paste-copy');
let pasteAndButton = getElement('paste-and');
let pasteXorButton = getElement('paste-xor');

addHook(sharedActions, 'frame', async () => {
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
        pixelHeight = canvas.height / scale;
        pixelWidth = canvas.width / scale;
        totalDeltaY = 0;
        wheelEvent = undefined;
    }
    frameCount++;
});


addHook(sharedActions, 'set-cursor-to-main', () => {
    cursorMode = 'main';
    cursorMainButton.classList.add('selected');
    cursorEditButton.classList.remove('selected');
    cursorSelectButton.classList.remove('selected');
    canvas.style.cursor = 'default';
});

addHook(sharedActions, 'set-cursor-to-edit', () => {
    cursorMode = 'edit';
    cursorMainButton.classList.remove('selected');
    cursorEditButton.classList.add('selected');
    cursorSelectButton.classList.remove('selected');
    canvas.style.cursor = 'default';
    prevEditX = undefined;
    prevEditY = undefined;
});

addHook(sharedActions, 'set-cursor-to-select', () => {
    cursorMode = 'select';
    cursorMainButton.classList.remove('selected');
    cursorEditButton.classList.remove('selected');
    cursorSelectButton.classList.add('selected');
    canvas.style.cursor = 'crosshair';
});


let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');

addHook(sharedActions, 'run', () => {
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
});

addHook(sharedActions, 'pause', () => {
    running = false;
    runButton.style.display = 'block';
    pauseButton.style.display = 'none';
    runButton.classList.add('selected');
    pauseButton.classList.add('selected');
    stepButton.classList.remove('selected');
    resetButton.classList.remove('selected');
});

addHook(sharedActions, 'step', () => {
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
});

addHook(sharedActions, 'reset', () => {
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
});

addHook(sharedActions, 'set-speed', () => {
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
});


addHook(sharedActions, 'undo', () => {
    redoBuffer.push({p: p.copy(), hasRan});
    let state = undoBuffer.pop();
    if (state) {
        applyUndo(state);
    }
});

addHook(sharedActions, 'redo', () => {
    let state = redoBuffer.pop();
    if (state) {
        pushUndo();
        applyUndo(state);
    }
});


addHook(sharedActions, 'set-scale', () => {
    let value = prompt('Enter scale:');
    if (!value) {
        return;
    }
    scale = Number(value);
});

addHook(sharedActions, 'faster', event => {
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
});

addHook(sharedActions, 'slower', event => {
    if (event) {
        event.preventDefault();
    }
    if (step > 1) {
        step /= 2;
        if (step < 1) {
            stepEvery = Math.round(1 / step);
            step = 1;
        }
    } else {
        stepEvery *= 2;
    }
});


addHook(sharedActions, 'exit-paste', () => {
    pasting = undefined;
    rpfPasting = undefined;
});

addHook(sharedActions, 'cut', async () => {
    await run('copy');
    await run('sel-clear');
});

addHook(sharedActions, 'set-paste-mode-to-or', () => {
    pasteMode = 'or';
});

addHook(sharedActions, 'set-paste-mode-to-copy', () => {
    pasteMode = 'copy';
});

addHook(sharedActions, 'set-paste-mode-to-and', () => {
    pasteMode = 'and';
});

addHook(sharedActions, 'set-paste-mode-to-xor', () => {
    pasteMode = 'xor';
});


let commandWrapperElt = getElement('command-wrapper');
let commandElt = getElement('command');

addHook(sharedActions, 'open-command', event => {
    if (event) {
        event.preventDefault();
    }
    commandWrapperElt.style.display = 'flex';
    commandElt.textContent = '';
    commandElt.focus();
});

addHook(sharedActions, 'command-keypress', async event => {
    if (!(event instanceof KeyboardEvent)) {
        throw new Error(`command-keypress called with non-MouseEvent value`);
    }
    let key = event.key;
    if (key === 'Enter') {
        event.preventDefault();
        await run('run-command', event);
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
});

addHook(sharedActions, 'run-command', () => {
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
});

addHook(sharedActions, 'click-off-command', () => {
    commandWrapperElt.style.display = 'none';
});


let cursorMainButton = getElement('cursor-main');
let cursorEditButton = getElement('cursor-edit');
let cursorSelectButton = getElement('cursor-select');

let pasteModeMenuElt = getElement('paste-mode-menu');

let interactionLevelMenuElt = getElement('interaction-level-menu');
let selGroupButton = getElement('sel-group');
let selUngroupButton = getElement('sel-ungroup');
let rpfCMElt = getElement('rpf-context-menu');

addHook(sharedActions, 'load-pattern', () => {
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
});

let rleElt = getElement('rle', 'textarea');

addHook(sharedActions, 'view-rle', () => {
    loadPattern(rleElt.value);
});


let helpElt = getElement('help');

addHook(sharedActions, 'show-help', () => {
    helpElt.style.display = 'block';
});

addHook(sharedActions, 'hide-help', () => {
    helpElt.style.display = 'none';
});


let searchWrapperElt = getElement('search-wrapper');
let fsWrapperElt = getElement('file-system');

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

addHook(sharedActions, 'window-visibilitychange', async () => {
    if (document.visibilityState === 'visible' && rootDirHandle) {
        await updateFileSystem(rootDirHandle, fs);
        await run('render-file-system');
    }
});

addHook(sharedActions, 'open-folder', async () => {
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
    await run('render-file-system');
    for (let elt of Array.from(fsWrapperElt.children)) {
        if (elt instanceof FSFolderElement) {
            elt.open = true;
        }
    }
    searchWrapperElt.style.display = 'flex';
});

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

addHook(sharedActions, 'render-file-system', () => {
    renderFileSystem(fs, fsWrapperElt);
});

addHook(sharedActions, 'open-file', event => {
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
});


addHook(sharedActions, 'download-rle', () => {
    let link = document.createElement('a');
    link.download = currentFile ? path.basename(currentFile.name) + '.rle' : 'pattern.rle';
    link.href = URL.createObjectURL(new Blob([p.toRLE()]));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});
