
import {Pattern, createPattern, findType, INTSeparator, MAPPattern, fullIdentify} from './index.js';


export type Direction = 'N' | 'S' | 'E' | 'W' | 'NW' | 'NE' | 'SW' | 'SE';

export interface Synthesis {
    start: string;
    ships: {
        type?: string;
        direction: Direction;
        lane: number;
        timing: number;
    }[];
}

export interface Config {
    rule: string;
    base: Pattern;
    defaultShip: {
        apgcode: string;
        p: Pattern;
        dx: number;
        dy: number;
        period: number;
    };
}

export interface Data extends Config {
    synths: Map<string, Synthesis[]>;
}


const KNOTS = (new Uint8Array(512)).fill(1);
KNOTS[0b101000100] = 0x18;
KNOTS[0b101000001] = 0x18;
KNOTS[0b100000101] = 0x18;
KNOTS[0b001000101] = 0x18;
KNOTS[0b101000010] = 0x28;
KNOTS[0b001100001] = 0x28;
KNOTS[0b010000101] = 0x28;
KNOTS[0b100001100] = 0x28;
KNOTS[0b101000101] = 0x38;
KNOTS[0b101000110] = 0x47;
KNOTS[0b101000011] = 0x47;
KNOTS[0b101100001] = 0x47;
KNOTS[0b001100101] = 0x47;
KNOTS[0b110000101] = 0x47;
KNOTS[0b011000101] = 0x47;
KNOTS[0b100001101] = 0x47;
KNOTS[0b101001100] = 0x47;
KNOTS[0b101000111] = 0x58;
KNOTS[0b111000101] = 0x58;
KNOTS[0b101100101] = 0x58;
KNOTS[0b101001101] = 0x58;


export function loadData(data: string): Data {
    let options: {[key: string]: string | undefined} = {};
    let synths = new Map<string, Synthesis[]>();
    let current: string | null = null;
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line.length === 0) {
            continue;
        }
        if (line.includes('=')) {
            let [key, value] = line.split('=').map(x => x.trim());
            options[key] = value;
        } else if (line.endsWith(':')) {
            current = line.slice(0, -1);
        } else {
            if (current === null) {
                throw new Error(`No current apgcode defined`);
            }
            let data = line.split(' ');
            let synth: Synthesis = {
                start: line[0],
                ships: [],
            };
            for (let i = 1; i < data.length;) {
                synth.ships.push({
                    type: data[i].startsWith('xq') ? data[i++] : undefined,
                    direction: data[i++] as Direction,
                    lane: parseInt(data[i++]),
                    timing: parseInt(data[i++]),
                });
            }
            let list = synths.get(current);
            if (list) {
                list.push(synth);
            } else {
                synths.set(current, [synth]);
            }
        }
    }
    if (options.rule === undefined) {
        throw new Error(`Missing required option: 'rule'`);
    }
    if (options.default_ship === undefined) {
        throw new Error(`Missing required option: 'default_ship'`);
    }
    let rule = options.rule;
    let base = createPattern(rule);
    let ship = createPattern(options.default_ship);
    let type = findType(ship, 4096, false);
    if (!type.disp || (type.disp[0] === 0 && type.disp[1] === 0)) {
        throw new Error('Not a spaceship');
    }
    let defaultShip = {
        apgcode: options.default_ship,
        p: ship,
        dx: type.disp[0],
        dy: type.disp[1],
        period: type.period,
    };
    return {rule, base, defaultShip, synths};
}

export function dataToString(data: Data): string {
    let out = `\nrule = ${data.rule}\ndefault_ship = ${data.defaultShip}\n\n`;
    for (let [apgcode, synths] of data.synths) {
        out += apgcode + ':\n';
        for (let synth of synths) {
            out += synth.start + ' ' + synth.ships.map(ship => {
                let out = ship.direction + ' ' + ship.lane + ' ' + ship.timing;
                if (ship.type) {
                    out = ship.type + ' ' + out;
                }
                return out;
            }).join(' ') + '\n';
        }
        out += '\n';
    }
    return out;
}


export function createSynthesis(synth: Synthesis, config: Config): Pattern {
    let p = config.base.loadApgcode(synth.start).shrinkToFit();
    let height = p.height;
    let width = p.width;
    for (let ship of synth.ships) {
        let q: Pattern;
        let dx: number;
        let dy: number;
        let period: number;
        if (ship.type === undefined) {
            q = config.defaultShip.p.copy();
            dx = config.defaultShip.dx;
            dy = config.defaultShip.dy;
            period = config.defaultShip.period;
        } else {
            q = config.base.loadApgcode(ship.type);
            let type = findType(q, 4096);
            if (!type.disp) {
                throw new Error('Not a spaceship');
            }
            dx = type.disp[0];
            dy = type.disp[1];
            period = type.period;
        }
        let dir = ship.direction;
        let {lane, timing} = ship;
        let inc = timing % period;
        if (inc !== 0) {
            q.run(inc);
            timing += period - inc;
        }
        let x: number;
        let y: number;
        if (dir === 'NW') {
            x = -1 - timing * dx - q.width + lane;
            y = -1 - timing * dy - q.height;
        } else if (dir === 'NE') {
            x = width + 1 + timing * dx + lane;
            y = -1 - timing * dy - q.height;
            q.flipHorizontal();
        } else if (dir === 'SW') {
            x = -1 - timing * dx - q.width + lane;
            y = height + 1 + timing * dy;
            q.flipVertical();
        } else if (dir === 'SE') {
            x = width + 1 + timing * dx + lane;
            y = height + 1 + timing * dy;
            q.rotate180();
        } else if (dir === 'W') {
            x = -1 - timing * dx;
            y = Math.floor(height / 2) + lane;
            if (dy > 0) {
                y -= dy * timing;
                q.flipDiagonal();
            }
        } else if (dir === 'N') {
            x = Math.floor(width / 2) - q.height + lane;
            y = -1 - timing * dx;
            if (dy > 0) {
                x += dy * timing;
                q.flipDiagonal();
            }
            q.rotateRight();
        } else if (dir === 'E') {
            x = width + 1 + timing * dx;
            y = Math.floor(height / 2) + lane;
            if (dy > 0) {
                y += dy * timing;
                q.flipDiagonal();
            }
            q.flipHorizontal();
        } else if (dir === 'S') {
            x = Math.floor(width / 2) - q.height + lane;
            y = height + 1 + timing * dx;
            if (dy > 0) {
                x -= dy * timing;
                q.flipDiagonal();
            }
            q.rotateLeft();            
        } else {
            throw new Error(`Invalid direction: ${dir}`);
        }
        x += p.xOffset;
        y += p.yOffset;
        if (x < 0 || y < 0) {
            p.offsetBy(-x, -y);
        }
        p.insert(q, x, y);
    }
    return p;
}

export function findOutcome(synth: Synthesis, config: Config): {apgcode: string, x: number, y: number}[] {
    let p = createSynthesis(synth, config);
    let pops: number[] = [p.population];
    let found = false;
    let outPeriod = 256;
    for (let i = 0; i < 65536; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pop === 0) {
            return [];
        }
        for (let period = 1; period < Math.floor(pops.length / 15); period++) {
            found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    outPeriod = period;
                    found = false;
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        if (found) {
            break;
        }
        if (i > 500 && i % 50 === 0) {
            for (let period = 1; period < Math.floor(i / 20); period++) {
                let diff = pop - pops[pops.length - period];
                found = true;
                for (let j = 1; j < 16; j++) {
                    if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                        outPeriod = period;
                        found = false;
                        break;
                    }
                }
                if (found) {
                    break;
                }
            }
            if (found) {
                break;
            }
        }
        pops.push(pop);
    }
    let sep = new INTSeparator(p as MAPPattern, KNOTS);
    let data = sep.separate(outPeriod * 8, Math.max(outPeriod * 8, 256));
    if (!data) {
        throw new Error('Failed to detect periodic behavior!');
    }
    let out: {apgcode: string, x: number, y: number}[] = [];
    for (let obj of data[0]) {
        let x = obj.phases[0].xOffset;
        let y = obj.phases[0].yOffset;
        if (obj.apgcode.startsWith('x')) {
            out.push({apgcode: obj.apgcode, x, y});
        } else {
            let obj2 = fullIdentify(obj.phases[0], 4096, 16);
            out.push({apgcode: obj2.apgcode, x, y});
        }
    }
    return out;
}
