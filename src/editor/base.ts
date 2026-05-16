
import {Pattern} from '../core/index.js';
import {RPFObjectData} from './rpf.js';


declare global {

    interface FileSystemDirectoryHandle {
        entries(): {[Symbol.asyncIterator](): AsyncIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>};
    }

    function getElement<T extends HTMLElement = HTMLElement>(id: string): T;

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
    

}


globalThis.getElement = function<T extends HTMLElement = HTMLElement>(id: string): T {
    let out = document.getElementById(id);
    if (!out) {
        throw new Error(`Missing element: '${id}'`);
    }
    return out as T;
}


globalThis.theme = {
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
