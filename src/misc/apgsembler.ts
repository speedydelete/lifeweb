
import * as fs from 'node:fs/promises';
import {Pattern, createPattern, parse} from '../core/index.js';
import {inspect} from 'node:util';


type Direction = 'N' | 'S' | 'W' | 'E' | 'NW' | 'NE' | 'SW' | 'SE';

class Coords {

    x: number;
    y: number;

    constructor(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    toString(): string {
        return `(${this.x}, ${this.y})`;
    }

    [Symbol.for('nodejs.util.inspect.custom')](): string {
        return `(${this.x}, ${this.y})`;
    }

    neg(): Coords {
        return new Coords(-this.x, -this.y);
    }

    offset(dir: Direction, by: number | Coords): Coords;
    offset(by: number | Coords): Coords;
    offset(x: number, y: number): Coords;
    offset(dir: Direction | number | Coords, by?: number | Coords): Coords {
        if (by === undefined) {
            if (typeof dir === 'string') {
                throw new Error(`This error should not occur (invalid call to Coords.prototype.offset())`);
            }
            by = dir;
            dir = 'SE';
        }
        let x = this.x;
        let y = this.y;
        let offsetX: number;
        let offsetY: number;
        if (typeof by === 'number') {
            if (typeof dir === 'number') {
                offsetX = dir;
                offsetY = by;
                dir = 'SE';
            } else if (dir instanceof Coords) {
                throw new Error(`This error should not occur (invalid call to Coords.prototype.offset())`);
            } else {
                offsetX = by;
                offsetY = by;
            }
        } else {
            if (typeof dir !== 'string') {
                throw new Error(`This error should not occur (invalid call to Coords.prototype.offset())`);
            }
            offsetX = by.x;
            offsetY = by.y;
        }
        if (dir === 'NW' || dir === 'SW' || dir === 'E') {
            x -= offsetX;
        } else if (dir === 'NE' || dir === 'SE' || dir === 'W') {
            x += offsetX;
        }
        if (dir === 'NW' || dir === 'NE' || dir === 'N') {
            y -= offsetY;
        } else if (dir === 'SW' || dir === 'SE' || dir === 'S') {
            y += offsetY;
        }
        return new Coords(x, y);
    }

}

function coords(x: number, y: number): Coords {
    return new Coords(x, y);
}

function insert(p: Pattern, q: Pattern, coords: Coords): void {
    let {x, y} = coords;
    p.ensure(x - p.xOffset, y - p.yOffset);
    p.ensure(x + q.width - p.xOffset, y + q.height - p.yOffset);
    p.insert(q, x - p.xOffset, y - p.yOffset);
}


const RULE = 'B2-ak4a5ij6ac/S12-k4a';

const CLOCK_REGULATOR_UNIT = `x = 190, y = 109, rule = B2-ak4a5ij6ac/S12-k4a
27b2o4$26b3o2$27bo$27bo7$94b2o10b2o10b2o10b2o10b2o10b2o10b2o2$92bob3o
7bob3o7bob3o7bob3o7bob3o7bob3o7bob3o$92bo11bo11bo11bo11bo11bo11bo6$98b
o11bo11bo11bo11bo11bo20bo$98bob3o7bob3o7bob3o7bob3o7bob3o7bob3o16bobo
$179bobo$100b2o10b2o10b2o10b2o10b2o10b2o17bo$170bo3bo$167b2obo3bo$170b
o$185b3o$85bo$81bo3bob2o35b2o$76bo4bo3bo77b2o$73b2obo89bo3bobo$76bo88b
2o5bo13b2o$123b3o60bo$188b2o$124bo$124bo$165b3o2$129bo$101bo24b2obo3b
o$101bo27bo3bo43bo$171b2o4bo$100b3o69bo4bo$170bo$11b2o157bo2$101b2o2$
10b3o2$11bo$11bo13$52bo63bo$48bo3bob2o56bo3bob2o$43bo4bo3bo54bo4bo3bo
$40b2obo60b2obo$43bo63bo5$31b2o62b2o$34bo63bo$33b2o62b2o$51bo63bo$48b
2obo3bo56b2obo3bo$43b4o4bo3bo51b4o4bo3bo$36b2o$44bo63bo$44bo63bo$41b2o
62b2o$24b2o15bo46b2o15bo$27bo15b2o46bo15b2o$26b2o8bo18bo34b2o8bo18bo$
32bo3bob2o11bo3bob2o37bo3bob2o11bo3bob2o$32bo3bo14bo3bo40bo3bo14bo3bo
2$42b2o62b2o$40bo63bo$40b2o62b2o3$39b3o61b3o2$40bo63bo$40bo63bo5$35bo
63bo$31bo3bob2o56bo3bob2o$31bo3bo59bo3bo!`;
const CRU_CONNECT_COMPONENT_STACK = coords(0, 22);
const CRU_CONNECT_DEMUX = coords(108, 150);

const ZNZ_OFFSET_DEMUX = 32;
const SPLITTER_OFFSET = 32;
const ACTION_OFFSET = 32;

const DEMUX_UNIT = `x = 32, y = 32, rule = B2-ak4a5ij6ac/S12-k4a
8$18b2o$16bo$16b2o3$4b4o2$6bo$6bo$8b2o$9bo$6b2o$14bo$11b2obo3bo$14bo3b
o!`;
const DEMUX_UNIT_FILLED = `x = 32, y = 32, rule = B2-ak4a5ij6ac/S12-k4a
8$18b2o$16bo$16b2o3$4b4o$13b2o$6bo$6bo$8b2o$9bo$6b2o$14bo$11b2obo3bo$
14bo3bo!`;
const DEMUX_CONNECT_SPLITTER = coords(7, 32);
const DEMUX_CONNECT_PREV_STATE = coords(15, 0);

const AFTER_DEMUX = `x = 105, y = 3, rule = B2-ak4a5ij6ac/S12-k4a
2b2o35b2o25b2o35b2o$3bo36bo26bo36bo$2o35b2o25b2o35b2o!`;
const AFTER_DEMUX_CONNECT = coords(-40, 0);

const DEMUX_SPLITTER_OFFSET = 32;
const PREV_STATE_DEMUX_OFFSET = 32;

const SPLITTER = `x = 38, y = 38, rule = B2-ak4a5ij6ac/S12-k4a
4$11b2o17bo$14bo11bo3bob2o$13b2o6bo4bo3bo$18b2obo$21bo$33b3o4$8b2o$9b
o24b2o$7bo5bo20bo$7bo2b2obo22b2o$13bo$o12bo$o$2bo4bo$b2o4bo$7bo11$15b
o$9b2o4bo$10bo4bo$8bo$8bo!`;
const SPLITTER_CONNECT_SPLITTER = coords(26, 0);
const SPLITTER_CONNECT_ACTION = coords(1, 0);

const NEXT_STATE_OFFSET = 32;
const NEXT_STATE_BACK_REFLECTORS_OFFSET = 32;

const REFLECTOR_SW_TO_SE = `x = 15, y = 16, rule = B2-ak4a5ij6ac/S12-k4a
8$12b2o$4o8bo$14bo$2bo11bo$2bo$4b2o$5bo$2b2o!`;
const SW_TO_SE_CONNECT_SW = coords(7, 0);
const SW_TO_SE_CONNECT_SE = coords(0, 3);

const REFLECTOR_SE_TO_NE = `x = 16, y = 12, rule = B2-ak4a5ij6ac/S12-k4a
$7bo$7bo2$6b3o4$7b2o!`;
const SE_TO_NE_CONNECT_SE = coords(0, 1);
const SE_TO_NE_CONNECT_NE = coords(15, 0);

const REFLECTOR_NE_TO_NW = `x = 12, y = 16, rule = B2-ak4a5ij6ac/S12-k4a
7$4bo3bo$b2obo3bo$4bo!`;
const NE_TO_NW_CONNECT_NE = coords(-1, 11);
const NE_TO_NW_CONNECT_NW = coords(0, 0);

const REFLECTOR_NW_TO_SW = `x = 29, y = 30, rule = B2-ak4a5ij6ac/S12-k4a
22$19b2o4$19b3o2$20bo$20bo!`;
const SPLITTER_NW_TO_SW = `x = 29, y = 30, rule = B2-ak4a5ij6ac/S12-k4a
4$17b2o$17bo$19b2o$6bo$3b2obo$6bo4bo3bo$11bo3bob2o$15bo3$18bo$18bo2$17b
3o5$19b2o4$19b3o2$20bo$20bo!`;
const NW_TO_SW_CONNECT_NW = coords(8, 8);
const NW_TO_SW_CONNECT_SW = coords(10, 29);

const COMPONENT_STACK_CRU_OFFSET = 96;

const NOP_COMPONENT = `x = 36, y = 16, rule = B2-ak4a5ij6ac/S12-k4aHistory
7$27bo3bo$27bo3bob2o$31bo!`;
const NOP_SIZE = 16;
const NOP_OFFSET = 16;
const NOP_CONNECT_ACTION = coords(29, 15);
const NOP_CONNECT_ZNZ = coords(0, 0);

const UNARY_REGISTER = `x = 142, y = 162, rule = B2-ak4a5ij6ac/S12-k4a
115b2o$118bo4bo$117b2o4bo$123bo7$95b2o$98bo4bo$97b2o4bo$103bo8$64b2o$
67bo4bo$66b2o4bo$72bo4$59bo$59bo$53bo2b2obo$53bo5bo$55bo$54b2o6$48bo$
33bo14bo10b2o$33bo8bo2b2obo11bo$35bo6bo5bo8b2o33bo$34b2o8bo12bo3bo30b
o$43b2o16bo$91b3o$60b3o2$92b2o$33bo3bo54bo$30b2obo3bo22b2o26bo5bo$33b
o14b2o38bob2o2bo$49bo29bo3bo4bo$46b2o28b2obo3bo$79bo$58b3o2$59bo$59bo
$72bo$68bo3bob2o$63bo4bo3bo$60b2obo$25bo37bo$25bo3$10b2o$70bo$9b4o53b
o3bo4b2o$bo60bo3bobobo4bo$bo55bo4bo3bobo8b2o$3bo18b2o30b2obo10bo$2b2o
7b2o10bo33bo10bo$20b2o4b2o$27bo$24b2o2$2b3o54bo2bo$59b2obo3bo$62bo3bo
4bo$71bob2o$4bo2b2o62bo$4bo3bo2$2bob2o$2bo2bob2o$2bo75b3o$4bob2o$4bo43b
o$32b2o8b2o4bo$43bo4bo$41bo11b2o24b2o$41bo12bo24bo$31b3o17b2o10bo17bo
$59b2o2bob2o14bo$32bo27bo2bo$31b2o41bo$56b2o10b2o4bo$57bo11bo4bo$b2o63b
2o$2bo50b2o$o53bo$o50b2o3$4b2o$5bo$3bo6bo$3bo6bo3b2o$14bo$16b2o9$79b2o
$77bo$77b2o7$82b2o$82bo$78bo5bo$78bob2o2bo$78bo$78bo9$88b2o$86bo$86b2o
7$91b2o$91bo$87bo5bo$87bob2o2bo$87bo$87bo!`;
const UNARY_REGISTER_SIZE = 128;
const UNARY_REGISTER_OFFSET = 32;
const UNARY_REGISTER_CONNECT_INC = coords(141, 24);
const UNARY_REGISTER_CONNECT_TDEC = coords(141, 54);
const UNARY_REGISTER_CONNECT_ZNZ = coords(141, 62);
const UNARY_REGISTER_OBJECT_POS = coords(25, 63);
const UNARY_REGISTER_OBJECT_SIZE = [2, 1];

const ACTION_GLIDER_MOVER_OFFSET = 32;
const ACTION_GLIDER_MOVERS_IN_CRU = 2;
const MIN_ACTION_GLIDER_MOVER_MOVE_AMOUNT = 16;
const ACTION_GLIDER_MOVERS_SPLITTERS_OFFSET = 32;

// reflectorNWToSW is defined below
let reflectorSWToNWPreserving = parse(`x = 3, y = 8, rule = B2-ak4a5ij6ac/S12-k4a
bo$bo2$3o4$2o!`, undefined, true);
let reflectorSWToNWChanging = parse(`x = 14, y = 10, rule = B2-ak4a5ij6ac/S12-k4a
2bo3bo$obo3bo$obo9bo$2bo9bo2$11b3o4$11b2o!`, undefined, true);
function addActionGliderMover(out: Pattern, from: number, to: number, pos: Coords, action: string): void {
    let lane: number;
    if (from % 2 === 0) {
        pos = pos.offset('SW', -from / 2);
        lane = (to - from) / 2;
    } else {
        pos = pos.offset('SW', -(from - 1) / 2);
        lane = (to - (from - 1)) / 2;
    }

    pos = pos.offset(coords(-26, 0));
    // console.log(`${from} -> ${to}, pos = ${pos}, lane = ${lane}`);
    insert(out, reflectorNWToSW, pos);
    if (lane !== Math.floor(lane)) {
        insert(out, reflectorSWToNWPreserving, pos.offset('SW', -Math.floor(lane)).offset(coords(14, 15)).offset('NE', 16));
    } else {
        insert(out, reflectorSWToNWChanging, pos.offset('SW', -lane).offset(coords(14, 2)).offset('NE', 3));
    }
}


type UnaryRegister = `U${number}`;
type Register = UnaryRegister;
type Component = Register | 'NOP';

type Action = {str: string} & (
    | {type: 'NOP'}
    | {type: 'HALT_OUT'}
    | {type: 'INC', register: UnaryRegister}
    | {type: 'TDEC', register: UnaryRegister}
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
    registers: {[key: Register]: number};
    states: State[];
    gotoStates: string[];
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
            } else if (['NOP'].includes(component)) {
                out.components.push(component as Component);
                out.actions.push({str: component, type: component as 'NOP'});
            } else if (component === 'HALT_OUT') {
                continue;
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
                out.registers[`U${number}`] = value;
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
    let out: Program = {
        components: [],
        actions: [],
        registers: {},
        states: [],
        gotoStates: [],
    };
    let lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
        currentLineNumber = i;
        let line = lines[i];
        line = line.trim();
        if (line === '') {
            continue;
        } else if (line.startsWith('#')) {
            let match = line.match(/^#([A-Z]+) (.*)/);
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
            if (!out.gotoStates.includes(next)) {
                out.gotoStates.push(next);
            }
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


let clockRegulatorUnit = parse(CLOCK_REGULATOR_UNIT, undefined, true);
let demuxUnit = parse(DEMUX_UNIT, undefined, true);
let demuxUnitFilled = parse(DEMUX_UNIT_FILLED, undefined, true);
let afterDemux = parse(AFTER_DEMUX, undefined, true);
let splitter = parse(SPLITTER, undefined, true);
let reflectorSWToSE = parse(REFLECTOR_SW_TO_SE, undefined, true);
let reflectorSEToNE = parse(REFLECTOR_SE_TO_NE, undefined, true);
let reflectorNEToNW = parse(REFLECTOR_NE_TO_NW, undefined, true);
let reflectorNWToSW = parse(REFLECTOR_NW_TO_SW, undefined, true);
let splitterNWToSW = parse(SPLITTER_NW_TO_SW, undefined, true);
let nopComponent = parse(NOP_COMPONENT, undefined, true);
let unaryRegister = parse(UNARY_REGISTER, undefined, true);

function createStateMachine(program: Program, out: Pattern): [number[], Coords] {
    // keep track of the lanes associated with each action
    let actionLanes: number[] = [];
    let actionMoverPos = coords(0, 0);
    let demuxPos = CRU_CONNECT_DEMUX.offset(ACTION_GLIDER_MOVER_OFFSET * (program.actions.length - ACTION_GLIDER_MOVERS_IN_CRU));
    for (let i = 0; i < program.states.length; i++) {
        let state = program.states[i];
        // demultiplexer
        if (state.id === 'INITIAL' && state.input === 'ZZ') {
            insert(out, demuxUnitFilled, demuxPos.offset('NE', ZNZ_OFFSET_DEMUX));
        } else if (state.input === 'Z') {
            insert(out, demuxUnit, demuxPos.offset('NE', ZNZ_OFFSET_DEMUX));
        } else {
            insert(out, demuxUnit, demuxPos);
        }
        // previous state reflector
        let gotoIndex = program.gotoStates.indexOf(state.id);
        if (gotoIndex !== -1) {
            let gotoPos = demuxPos.offset(DEMUX_CONNECT_PREV_STATE).offset('NE', ZNZ_OFFSET_DEMUX);
            gotoPos = gotoPos.offset('NE', PREV_STATE_DEMUX_OFFSET).offset('NE', NEXT_STATE_OFFSET * gotoIndex);
            gotoPos = gotoPos.offset('NW', NE_TO_NW_CONNECT_NW);
            let toInsert = program.states.slice(0, i).some(x => x.id === state.id) ? splitterNWToSW : reflectorNWToSW;
            insert(out, toInsert, gotoPos.offset(NW_TO_SW_CONNECT_SW.neg()));
        }
        // splitters
        let splitterPos = demuxPos.offset(DEMUX_CONNECT_SPLITTER).offset('SW', DEMUX_SPLITTER_OFFSET);
        for (let j = 0; j < program.actions.length; j++) {
            let action = program.actions[j];
            if (i === 0) {
                let pos = splitterPos.offset(SPLITTER_CONNECT_ACTION);
                if (j === 0) {
                    actionMoverPos = pos.offset('NW', ACTION_GLIDER_MOVERS_SPLITTERS_OFFSET);
                }
                actionLanes.push(pos.x - pos.y);
            }
            if (state.actions.some(x => x.str === action.str)) {
                insert(out, splitter, splitterPos.offset(SPLITTER_CONNECT_SPLITTER.neg()));
            }
            splitterPos = splitterPos.offset('SW', ACTION_OFFSET);
        }
        // next state reflector
        if (!state.actions.some(x => x.type === 'HALT_OUT')) {
            let nextIndex = program.gotoStates.indexOf(state.next);
            let nextPos = splitterPos.offset('SW', NEXT_STATE_OFFSET * nextIndex);
            insert(out, reflectorSWToSE, nextPos.offset(SW_TO_SE_CONNECT_SW.neg()));
        }
        demuxPos = demuxPos.offset('SE', SPLITTER_OFFSET);
    }
    // after demux unit
    insert(out, afterDemux, demuxPos.offset(AFTER_DEMUX_CONNECT));
    // next state reflectors (1)
    let reflectorPos = demuxPos.offset(DEMUX_CONNECT_SPLITTER).offset('SW', DEMUX_SPLITTER_OFFSET);
    reflectorPos = reflectorPos.offset('SW', ACTION_OFFSET * program.actions.length);
    reflectorPos = reflectorPos.offset(SW_TO_SE_CONNECT_SE).offset('SE', NEXT_STATE_BACK_REFLECTORS_OFFSET);
    for (let i = 0; i < program.gotoStates.length; i++) {
        insert(out, reflectorSEToNE, reflectorPos.offset(SE_TO_NE_CONNECT_SE));
        reflectorPos = reflectorPos.offset('S', NEXT_STATE_OFFSET);
    }
    // next state reflectors (2)
    reflectorPos = demuxPos.offset(DEMUX_CONNECT_PREV_STATE).offset('NE', ZNZ_OFFSET_DEMUX).offset('NE', PREV_STATE_DEMUX_OFFSET);
    reflectorPos = reflectorPos.offset('SE', NEXT_STATE_BACK_REFLECTORS_OFFSET).offset(SE_TO_NE_CONNECT_NE).offset('NE', NW_TO_SW_CONNECT_NW);
    // reflectorPos = reflectorPos.offset('S', NEXT_STATE_OFFSET * (program.gotoStates.length - 1));
    for (let i = 0; i < program.gotoStates.length; i++) {
        insert(out, reflectorNEToNW, reflectorPos.offset(NE_TO_NW_CONNECT_NE));
        reflectorPos = reflectorPos.offset('E', NEXT_STATE_OFFSET);
    }
    return [actionLanes, actionMoverPos];
}

function findComponentStackAdjust(program: Program, actionLanes: number[]): number {
    let pos = coords(0, 0).offset(CRU_CONNECT_COMPONENT_STACK).offset('SW', COMPONENT_STACK_CRU_OFFSET);
    let out = 0;
    let index = 0;
    for (let component of program.components) {
        let size: number;
        let actions: Coords[] = [];
        if (component === 'NOP') {
            pos = pos.offset('SW', NOP_OFFSET);
            size = NOP_SIZE;
            let pos2 = pos.offset(NOP_CONNECT_ZNZ.neg());
            actions.push(pos2.offset(NOP_CONNECT_ACTION));
        } else if (component.startsWith('U')) {
            pos = pos.offset('SW', UNARY_REGISTER_OFFSET);
            size = UNARY_REGISTER_SIZE;
            let pos2 = pos.offset(UNARY_REGISTER_CONNECT_ZNZ.neg());
            actions.push(pos2.offset(UNARY_REGISTER_CONNECT_INC), pos.offset(UNARY_REGISTER_CONNECT_TDEC));
        } else {
            throw new Error(`This error should not occur (invalid component: '${component}')`);
        }
        for (let coords of actions) {
            let lane = actionLanes[index++];
            let lane2 = coords.x - coords.y;
            let offset = lane2 - lane;
            out = Math.max(out, Math.max(0, offset - MIN_ACTION_GLIDER_MOVER_MOVE_AMOUNT));
        }
        pos = pos.offset('SW', size);
    }
    return out;
}

function createComponentStack(program: Program, out: Pattern, actionLanes: number[], actionMoverPos: Coords): void {
    let componentPos = coords(0, 0).offset(CRU_CONNECT_COMPONENT_STACK).offset('SW', COMPONENT_STACK_CRU_OFFSET);
    componentPos = componentPos.offset('SW', findComponentStackAdjust(program, actionLanes));
    // keep track of the lanes that the gliders from the splitters need to be reflected to
    let actionLanes2: number[] = [];
    for (let component of program.components) {
        let size: number;
        let actions: Coords[] = [];
        if (component === 'NOP') {
            componentPos = componentPos.offset('SW', NOP_OFFSET);
            size = NOP_SIZE;
            let pos = componentPos.offset(NOP_CONNECT_ZNZ.neg());
            insert(out, nopComponent, pos);
            actions.push(pos.offset(NOP_CONNECT_ACTION));
        } else if (component.startsWith('U')) {
            componentPos = componentPos.offset('SW', UNARY_REGISTER_OFFSET);
            size = UNARY_REGISTER_SIZE;
            let pos = componentPos.offset(UNARY_REGISTER_CONNECT_ZNZ.neg());
            insert(out, unaryRegister, pos);
            if (program.registers[component]) {
                let objPos = pos.offset(UNARY_REGISTER_OBJECT_POS);
                let {x, y} = objPos.offset(-out.xOffset, -out.yOffset);
                let [height, width] = UNARY_REGISTER_OBJECT_SIZE;
                let obj = out.copyPart(x, y, height, width);
                out.clearPart(x, y, height, width);
                insert(out, obj, objPos.offset('NW', program.registers[component]));
            }
            actions.push(pos.offset(UNARY_REGISTER_CONNECT_INC), pos.offset(UNARY_REGISTER_CONNECT_TDEC));
        } else {
            throw new Error(`This error should not occur (invalid component: '${component}')`);
        }
        for (let coords of actions) {
            actionLanes2.push(coords.x - coords.y);
        }
        componentPos = componentPos.offset('SW', size);
    }
    // add the action glider movers
    let offset = actionLanes[0];
    for (let i = 0; i < program.actions.length; i++) {
        addActionGliderMover(out, actionLanes[i] - offset, actionLanes2[i] - offset, actionMoverPos, program.actions[i].str);
        actionMoverPos = actionMoverPos.offset('NW', ACTION_GLIDER_MOVER_OFFSET);
    }
}

function programToPattern(program: Program): Pattern {
    console.log(inspect(program, {colors: true, depth: Infinity}));
    let out = createPattern(RULE);
    insert(out, clockRegulatorUnit, coords(0, 0));
    let [actionLanes, actionMoverPos] = createStateMachine(program, out);
    createComponentStack(program, out, actionLanes, actionMoverPos);
    return out;
}


let program = await parseFile(process.argv[2]);
let pattern = programToPattern(program);
pattern.shrinkToFit();
console.log('offset:', new Coords(pattern.xOffset, pattern.yOffset));
await fs.writeFile(process.argv[3], pattern.toRLE() + '\n');
