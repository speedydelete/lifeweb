
import {INSERT_COPY, INSERT_AND, INSERT_OR, INSERT_XOR, Pattern, CoordPattern, createPattern, parse as parseRLE} from '../core/index.js';
import {RPFError, Rotation, ROTATION_COMBINE, transformCoordinates, RPFObjectData, RPFPattern, File, Directory, RPFFile} from './rpf.js';
import './base.js';


declare global {

    interface FileSystemDirectoryHandle {
        entries(): {[Symbol.asyncIterator](): AsyncIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>};
    }

    function getElement(id: string): HTMLElement;
    function getElement<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap>(id: string, type: T): HTMLElementTagNameMap[T];

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
