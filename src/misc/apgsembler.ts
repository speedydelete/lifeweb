
import * as fs from 'node:fs/promises';
import {Pattern, createPattern, parse} from '../core/index.js';
import * as c from './apgsembler_config.js';


type UnaryRegister = `U${number}`;
type Register = UnaryRegister;
type Component = 'NOP' | 'HALT_OUT' | Register;

type Action = {str: string} & (
    | {type: 'NOP'}
    | {type: 'INC', register: UnaryRegister}
    | {type: 'TDEC', register: UnaryRegister}
    | {type: 'HALT_OUT'}
);

interface State {
    id: string;
    input: 'Z' | 'NZ' | 'ZZ';
    next: string;
    actions: Action[];
}

interface Program {
    components: Component[];
    actions: Action[];
    registers: [Register, number][];
    states: State[];
}


let currentFile: string;
let currentLineNumber: number;

function error(message: string): never {
    console.error(`Error: ${message} (at ${currentFile}:${currentLineNumber})`);
    process.exit(1);
}

function parseDirective(out: Program, directive: string, value: string): void {
    if (directive === 'COMPONENTS') {
        for (let component of value.split(',').map(x => x.trim())) {
            if (component.startsWith('U')) {
                let range = component.slice(1);
                let start: number;
                let end: number;
                let index = range.indexOf('-');
                if (index !== -1) {
                    start = Number(range.slice(0, index));
                    end = parseInt(range.slice(index + 1));
                } else {
                    start = Number(range);
                    end = start;
                }
                if (Number.isNaN(start) || Number.isNaN(end)) {
                    error(`Invalid component (not a number): '${component}'`);
                }
                for (let j = start; j <= end; j++) {
                    let register = `U${j}` as const;
                    out.components.push(register);
                    out.actions.push({str: `INC ${register}`, type: 'INC', register});
                    out.actions.push({str: `TDEC ${register}`, type: 'TDEC', register});
                }
            } else if (['NOP', 'HALT_OUT'].includes(component)) {
                out.components.push(component as Component);
            } else {
                error(`Invalid component (unrecognized): '${component}'`);
            }
        }
    } else if (directive === 'REGISTERS') {
        let data = JSON.parse(value.replaceAll(`'`, '"'));
        if (typeof data !== 'object' || data === null) {
            error(`Expected object for #REGISTERS`);
        }
        for (let key in data) {
            let value = data[key];
            if (typeof value !== 'number') {
                error(`Invalid value for register '${key}': '${value}'`);
            }
            if (key.startsWith('U')) {
                let number = Number(key.slice(1));
                if (Number.isNaN(number)) {
                    error(`Invalid register: '${key}'`);
                }
                out.registers.push([`U${number}`, value]);
            } else {
                error(`Invalid register: '${key}'`);
            }
        }
    }
}

function parseActions(program: Program, actions: string): Action[] {
    let out: Action[] = [];
    for (let action of actions.split(',')) {
        action = action.trim();
        if (action === 'NOP' || action === 'HALT_OUT') {
            if (!program.components.includes(action)) {
                error(`Cannot use action ${action}, no component present`);
            }
            out.push({str: action, type: action});
        } else if (action.startsWith('INC ') || action.startsWith('TDEC ')) {
            let parts = action.split(' ');
            let command = parts[0] as 'INC' | 'TDEC';
            if (parts.length !== 2) {
                error(`More than 1 argument to '${command}'`);
            }
            let register = parts[1] as UnaryRegister;
            if (!register.startsWith('U') || !program.components.includes(register)) {
                error(`Cannot ${command} nonexistent register '${register}`);
            }
            out.push({str: `${command} ${register}`, type: command, register});
        } else {
            error(`Unrecognized action: '${action}'`);
        }
    }
    return out;
}

function parseProgram(code: string): Program {
    let out: Program = {components: [], actions: [], registers: [], states: []};
    let lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        currentLineNumber = i;
        let line = lines[i];
        line = line.trim();
        if (line === '') {
            continue;
        } else if (line.startsWith('#')) {
            let match = line.match(/#([A-Z]+) (.*)/);
            if (match) {
                let directive = match[1];
                let value = match[2];
                parseDirective(out, directive, value);
            }
            continue;
        } else {
            let parts = line.split(';').map(x => x.trim());
            if (parts.length !== 4) {
                error(`Expected 3 semicolons`);
            }
            let id = parts[0];
            let input = parts[1];
            let next = parts[2];
            let actions = parseActions(out, parts[3]);
            if (input === 'Z' || input === 'NZ' || input === 'ZZ') {
                out.states.push({id, input, next, actions});
            } else if (input === '*') {
                out.states.push({id, input: 'Z', next, actions});
                out.states.push({id, input: 'NZ', next, actions});
            } else {
                error(`Invalid input (expected 'Z', 'NZ', 'ZZ', or '*): '${input}'`);
            }
        }
    }
    return out;
}

async function parseFile(path: string): Promise<Program> {
    currentFile = path;
    let code = (await fs.readFile(path)).toString();
    return parseProgram(code);
}


let clockRegulatorUnit = parse(c.CLOCK_REGULATOR_UNIT);
let demuxUnit = parse(c.DEMULTIPLEXER_UNIT);
let demuxUnitFilled = parse(c.DEMULTIPLEXER_UNIT_FILLED);
let splitter = parse(c.SPLITTER);

function insert(p: Pattern, q: Pattern, x: number, y: number): void {
    p.ensure(x + p.xOffset, y + p.yOffset);
    p.ensure(x + q.width + p.xOffset, y + q.height + p.yOffset);
    p.insert(q, x + p.xOffset, y + p.yOffset);
}

function programToPattern(program: Program): Pattern {
    let out = createPattern(c.RULE);
    insert(out, clockRegulatorUnit, 0, 0);
    let [demuxX, demuxY] = c.CRU_CONNECT_DEMULTIPLEXERS;
    for (let state of program.states) {
        if (state.id === 'INITIAL' && state.input === 'ZZ') {
            insert(out, demuxUnitFilled, demuxX, demuxY);
        } else {
            insert(out, demuxUnit, demuxX, demuxY);
        }
        let splitterX = demuxX + c.DEMUX_CONNECT_SPLITTER[0];
        let splitterY = demuxY + c.DEMUX_CONNECT_SPLITTER[1];
        for (let action of program.actions) {
            if (state.actions.some(x => x.str === action.str)) {
                insert(out, splitter, splitterX - c.SPLITTER_CONNECT[0], splitterY - c.SPLITTER_CONNECT[1]);
            }
            splitterX -= c.COMPONENT_OFFSET;
            splitterY -= c.COMPONENT_OFFSET;
        }
        demuxX += c.SPLITTER_OFFSET;
        demuxY += c.SPLITTER_OFFSET;
    }
    return out;
}


let program = await parseFile(process.argv[2]);
let pattern = programToPattern(program);
await fs.writeFile(process.argv[3], pattern.toRLE() + '\n');
