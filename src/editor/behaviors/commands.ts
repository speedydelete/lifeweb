
import {run, addHook} from '../base.js';


declare global {

    var commandHistory: string[];
    var commandHistoryPos: number | undefined;
    var beforeHistoryCommand: string;

}


let commandWrapperElt = getElement('command-wrapper');
let commandElt = getElement('command');

addHook('open-command', event => {
    if (event) {
        event.preventDefault();
    }
    commandWrapperElt.style.display = 'flex';
    commandElt.textContent = '';
    commandElt.focus();
});

addHook('command-keypress', async event => {
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

addHook('run-command', () => {
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

addHook('click-off-command', () => {
    commandWrapperElt.style.display = 'none';
});
