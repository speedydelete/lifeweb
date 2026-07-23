
import {Pattern, parse as parseRLE} from '../core/index.js';
import {Rotation, RPFReference, RPFPattern, File, Directory, RPFFile, RPFParser} from './rpf.js';


declare global {

    interface FileSystemDirectoryHandle {
        entries(): {[Symbol.asyncIterator](): AsyncIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>};
    }

    function getElement(id: string): HTMLElement;
    function getElement<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap>(id: string, type: T): HTMLElementTagNameMap[T];

    var p: RPFPattern;
    var rpfFile: RPFFile;

    var canvas: HTMLCanvasElement;
    var ctx: CanvasRenderingContext2D;

}


declare global {

    type DefaultAction =
        | 'frame'
        | 'window-click' | 'window-visibilitychange'
        | 'scroll-canvas' | 'click-canvas' | 'move-mouse-over-canvas' | 'unclick-canvas' | 'move-mouse-onto-canvas' | 'move-mouse-off-of-canvas' | 'right-click-canvas'
        | 'run' | 'pause' | 'step' | 'reset' | 'set-speed'
        | 'set-cursor-to-main' | 'set-cursor-to-edit'
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

    var actions: {[K in DefaultAction]?: Hook[]};

}

export async function run(action: DefaultAction, event?: Event): Promise<void> {
    if (actions[action]) {
        for (let hook of actions[action]) {
            hook(event);
        }
    }
}

export function addHook<T extends DefaultAction>(action: T, hook: Hook): void {
    if (!actions[action]) {
        actions[action] = [hook];
    } else {
        actions[action].push(hook);
    }
}

export function removeHook<T extends DefaultAction>(action: T, hook: Hook): void {
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



declare global {

    var eventListeners: {[key: string]: [DefaultAction, (event: Event) => void]};

    var keybinds: {[key: string]: DefaultAction};

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
    'ArrowUp': 'sel-move-up',
    'ArrowDown': 'sel-move-down',
    'ArrowLeft': 'sel-move-left',
    'ArrowRight': 'sel-move-right',
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


declare global {

    interface Theme {
        empty: string;
        twoState: string;
        multiState(states: number): string[];
        selection: string;
        hover: string;
        pasting: string;
        envelope: string;
        selectedEnvelope: string;
        hoverEnvelope: string;
        connections: string;
        selectedConnections: string;
        hoverConnections: string;
    }

    var theme: Theme;

}

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
    selection: `#ff93d3`,
    hover: `#ffc3d3`,
    pasting: `rgba(255, 0, 0, 0.5)`,
    envelope: `#00007f`,
    selectedEnvelope: `#3f003f`,
    hoverEnvelope: `#1f005f`,
    connections: `#ff0000`,
    selectedConnections: `#ff0000`,
    hoverConnections: `#ff0000`,
};


declare global {

    var frameCount: number;

}

addHook('frame', () => {
    frameCount++;
});

    var scale: number;
    var topLeftX: number;
    var topLeftY: number;
    var pixelHeight: number;
    var pixelWidth: number;

    var scaleStrength: number;

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
    var editing: RPFReference | undefined;

    var sel: Set<RPFReference>;
    var hover: RPFReference | undefined;
    var pasting: [RPFPattern, Rotation] | undefined;

    var leftRightResizing = false;
    var leftRightResizeOffset = 0;

    var rootDirHandle: FileSystemDirectoryHandle | undefined;
    var fs = new Directory('', '/');
    var currentFile: File | undefined;
    var stdlib: RPFFile;




export function parse(data: string, preserveSizes?: boolean): Pattern | [string, string, string] {
    try {
        return parseRLE(data, undefined, preserveSizes);
    } catch (error) {
        try {
            let parser = new RPFParser(p.file.base, p.file, data);
            return parser.pattern();
        } catch (error2) {
            try {
                let parser = new RPFParser(p.file.base, '/main', data);
                let out = parser.parseFile(fs);
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
    let oldP = p;
    if (typeof q === 'string') {
        try {
            q = parseRLE(q);
        } catch (error) {
            try {
                let parser = new RPFParser(p.file.base, '/main', q as string);
                q = parser.parseFile(fs);
            } catch (error2) {
                console.error(error);
                console.error(error2);
                alert(`Invalid pattern!:\n\n${error}\n\n${error2}`);
                return;
            }
        }
    }
    if (q instanceof RPFFile) {
        rpfFile = q;
        p = rpfFile.data['main'];
        if (!p) {
            p = oldP;
            throw new Error(`No 'main' entry present in loaded RPF`);
        }
    } else if (q instanceof RPFPattern) {

    } else {
        p = p.fromPattern(q);
        p.key = 'main';
        rpfFile = new RPFFile(p, '/main', {'main': p});
        fs.write('main', rpfFile);
    }
    run('load-pattern');
}

addHook('load-pattern', () => {
    p.xOffset = 0;
    p.yOffset = 0;
    scale = Math.min(32, canvas.height / p.height / 1.5, canvas.width / p.width / 1.5);
    topLeftX = (canvas.width / 2 / scale) - (p.width / 2);
    topLeftY = (canvas.height / 2 / scale) - (p.height / 2);
    let offset = p.getFullOffset();
    topLeftX -= offset[0];
    topLeftY -= offset[1];
});
