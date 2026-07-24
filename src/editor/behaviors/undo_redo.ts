
import {RPFReference, RPFPattern} from '../rpf.js';
import {addHook} from '../base.js';


declare global {
    interface UndoState {
        p: RPFPattern;
        hasRan: boolean;
        editing?: RPFReference;
    }
    var undoBuffer: UndoState[];
    var redoBuffer: UndoState[];
}

undoBuffer = [];
redoBuffer = [];


export function pushUndo(): void {
    undoBuffer.push({p: p.copy(), hasRan, editing});
}

export function applyUndo(state: UndoState): void {
    running = false;
    p = state.p.copy();
    hasRan = state.hasRan;
    editing = state.editing;
}


addHook('undo', () => {
    redoBuffer.push({p: p.copy(), hasRan});
    let state = undoBuffer.pop();
    if (state) {
        applyUndo(state);
    }
});

keybinds['Ctrl-z'] = 'undo';

addHook('redo', () => {
    let state = redoBuffer.pop();
    if (state) {
        pushUndo();
        applyUndo(state);
    }
});

keybinds['Ctrl-y'] = 'redo';
keybinds['Ctrl-Shift-z'] = 'redo';
