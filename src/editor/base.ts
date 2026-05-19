
import {Pattern, parse as parseRLE} from '../core/index.js';
import {Rotation, RPFObjectData, RPFPattern, File, Directory, RPFFile} from './rpf.js';


declare global {

    interface FileSystemDirectoryHandle {
        entries(): {[Symbol.asyncIterator](): AsyncIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>};
    }

    function getElement(id: string): HTMLElement;
    function getElement<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap>(id: string, type: T): HTMLElementTagNameMap[T];

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
        | 'save'
        | 'download-rle'
    ;

    type Hook = (event?: Event) => void;

    var sharedActions: {[K in DefaultAction]?: Hook[]};
    var normalActions: {[K in DefaultAction]?: Hook[]};
    var rpfActions: {[K in DefaultAction]?: Hook[]};
    var eventListeners: {[key: string]: [DefaultAction, (event: Event) => void]};
    var keybinds: {[key: string]: DefaultAction};
    var extensions: {[key: string]: (name: string, file: File) => void};

    interface Theme {
        empty: string;
        twoState: string;
        multiState(states: number): string[];
        selection: string;
        rpfSelection: string;
        rpfHover: string;
        pasting: string;
        envelope: string;
        intermediateObjects: string;
    }

    var theme: Theme;

    interface UndoState {
        p: Pattern;
        hasRan: boolean;
        rpfEditing?: RPFObjectData;
    }

    var p: Pattern;
    var rpfP: RPFPattern;
    var rpfFile: RPFFile;

    var canvas: HTMLCanvasElement;
    var ctx: CanvasRenderingContext2D;

    var mouseX: number;
    var mouseY: number;

    var fillOffset: number;
    var fillExpand: number;

    var undoBuffer: UndoState[];
    var redoBuffer: UndoState[];
    var beforeRunning: Pattern;
    var hasRan: boolean;

    var scale: number;
    var topLeftX: number;
    var topLeftY: number;
    var pixelHeight: number;
    var pixelWidth: number;

    var scaleStrength: number;

    var step: number;
    var stepEvery: number;
    var running: boolean;

    var isDragging: boolean;
    var dragStart: [number, number];
    var dragOffsetStart: [number, number];
    var dragSelectStart: [number, number];

    var cursorMode: 'main' | 'edit' | 'select';
    var drawState: number;
    var drawDeleteMode: boolean;
    var prevEditX: number | undefined;
    var prevEditY: number | undefined;
    var interactionLevel: number;
    var rpfEditing: RPFObjectData | undefined;

    var sel: {x: number, y: number, height: number, width: number} | undefined;
    var rpfSel: Set<RPFObjectData>;
    var rpfHover: RPFObjectData | undefined;
    var pasting: Pattern | undefined;
    var rpfPasting: [RPFPattern, Rotation] | undefined;
    var pasteMode: 'or' | 'copy' | 'and' | 'xor';

    var rpfCMShown: boolean;

    var commandHistory: string[];
    var commandHistoryPos: number | undefined;
    var beforeHistoryCommand: string;

    var leftRightResizing: boolean;
    var leftRightResizeOffset: number;

    var rootDirHandle: FileSystemDirectoryHandle | undefined;
    var fs: Directory;
    var currentFile: File | undefined;
    var stdlib: RPFFile;

}


export async function run(action: DefaultAction, event?: Event): Promise<void> {
    if (p instanceof RPFPattern) {
        if (rpfActions[action]) {
            for (let hook of rpfActions[action]) {
                hook(event);
            }
        }
    } else {
        if (normalActions[action]) {
            for (let hook of normalActions[action]) {
                hook(event);
            }
        }
    }
    if (sharedActions[action]) {
        for (let hook of sharedActions[action]) {
            hook(event);
        }
    }
}

export function addHook<T extends DefaultAction>(actions: {[K in T]?: Hook[]}, action: T, hook: Hook): void {
    if (!actions[action]) {
        actions[action] = [hook];
    } else {
        actions[action].push(hook);
    }
}

export function removeHook<T extends DefaultAction>(actions: {[K in T]?: Hook[]}, action: T, hook: Hook): void {
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

export function setEvent(id: string, event: keyof HTMLElementEventMap, action: DefaultAction): void {
    let elt = id === 'window' ? window : getElement(id);
    let key = id + '\n' + event;
    if (key in eventListeners) {
        elt.removeEventListener(event, eventListeners[key][1]);
    }
    let listener = (event: Event) => run(action, event);
    elt.addEventListener(event, listener);
    eventListeners[key] = [action, listener];
}

keybinds = {
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
    'Ctrl-s': 'save',
};

let leftElt = getElement('left');

let commandWrapperElt = getElement('command-wrapper');

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


theme = {
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
    rpfSelection: `#ff93d3`,
    rpfHover: `#ffc3d3`,
    pasting: `rgba(255, 0, 0, 0.5)`,
    envelope: `#0000cf`,
    intermediateObjects: `#ff0000`,
};

fs = new Directory('', '/');


export function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan, rpfEditing});
}

export function applyUndo(state: UndoState): void {
    running = false;
    p = state.p.copy();
    hasRan = state.hasRan;
    rpfEditing = state.rpfEditing;
}


export function updateSizes() {
    let bb = canvas.getBoundingClientRect();
    canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
    canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
    ctx.imageSmoothingEnabled = false;
    pixelHeight = canvas.height / scale;
    pixelWidth = canvas.width / scale;
}

window.addEventListener('resize', updateSizes);


export function parse(data: string, preserveSizes?: boolean): Pattern | [string, string, string] {
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

export function loadPattern(q: string | RPFFile | Pattern): void {
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
    rpfP = p instanceof RPFPattern ? p : (undefined as unknown as RPFPattern);
    run('load-pattern');
}


canvas.addEventListener('dragover', event => {
    event.preventDefault();
});


let fsFolderTemplate = getElement('fs-folder-template', 'template').content;

export class FSFolderElement extends HTMLElement {

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

export class FSFileElement extends HTMLElement {

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


export class FSRPFItemElement extends HTMLElement {

    file: RPFFile;
    p: RPFPattern;

    constructor(file: RPFFile, p: RPFPattern) {
        super();
        this.file = file;
        this.p = p;
        let name = p.getName();
        let root = this.attachShadow({mode: 'open'});
        let nameElt = document.createElement('span');
        nameElt.textContent = name;
        root.appendChild(nameElt);
        this.draggable = true;
        this.addEventListener('dragstart', event => {
            let transfer = event.dataTransfer as DataTransfer;
            transfer.dropEffect = 'link';
            transfer.setData('application/x-lifeweb-editor-drag', file.path + '\n' + p.key);
            let parent = this.parentElement as HTMLElement;
            let old = parent.style.overflowY;
            parent.style.overflowY = 'visible';
            let rect = nameElt.getBoundingClientRect();
            transfer.setDragImage(nameElt, rect.width / 2, rect.height / 2);
            requestAnimationFrame(() => {
                parent.style.overflowY = old;
            });
        });
    }

}

customElements.define('fs-rpf-item', FSRPFItemElement);


export class FSRPFFileElement extends HTMLElement {

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


export function loadFile(name: string, file: File): void {
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

export function runFile(name: string, file: File): void {
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

extensions = {

    '.rle': loadFile,
    '.rpf': loadFile,

    '.js': runFile,
    '.mjs': runFile,
    '.cjs': runFile,

};
