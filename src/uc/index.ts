
import * as fs from 'node:fs/promises';
import {MAPPattern, parse} from '../core/index.js';
import {c, StableObject, separateObjects} from './base.js';
import {createSalvoPattern, searchSalvos} from './slow_salvos.js';


let cmd = process.argv[2];
let args = process.argv.slice(3).join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x);

if (cmd === 'get_ss') {
    let start = c.START_OBJECT;
    if (args[0].startsWith('x')) {
        start = args[0];
        args = args.slice(1);
    }
    start = start.slice(start.indexOf('_') + 1);
    console.log(createSalvoPattern(start, args.map(x => parseInt(x)))[0].toRLE());
} else if (cmd === 'search_ss') {
    if (args[0].startsWith('x')) {
        searchSalvos(args[0], parseInt(args[1]));
    } else {
        searchSalvos(c.START_OBJECT, parseInt(args[0]));
    }
} else if (cmd === 'translate_ss') {
    let x = parseInt(args[0].replaceAll('(', ''));
    let y = parseInt(args[1].replaceAll(')', ''));
    args = args.slice(2);
    let start = '';
    if (args[0].startsWith('x')) {
        start = args[0] + ' ';
        args = args.slice(1);
    }
    let data = args.map(x => parseInt(x));
    data = data.map(lane => lane + x - y);
    console.log(start + data.join(', '));
} else if (cmd === 'rle_to_ss') {
    let data = (await fs.readFile(process.argv.slice(3).join(' '))).toString();
    let p = parse(data) as MAPPattern;
    let objs = separateObjects(p, 1, 256);
    if (objs === false) {
        throw new Error('Object separation failed!');
    }
    let target: StableObject | null = null;
    let ships: {lane: number, timing: number}[] = [];
    for (let obj of objs) {
        if (obj.type === 'ship') {
            ships.push({lane: obj.x - obj.y, timing: obj.x + obj.y});
        } else if (obj.type === 'sl' || obj.type === 'osc') {
            if (target !== null) {
                throw new Error('More than 1 target!');
            }
            target = obj;
        } else {
            throw new Error(`Invalid object: ${obj}`);
        }
    }
    if (!target) {
        throw new Error('No target!');
    }
    let lanes = ships.sort((a, b) => b.timing - a.timing).map(x => x.lane);
    let laneOffset = target.y - target.x;
    lanes = lanes.map(x => x + laneOffset + c.LANE_OFFSET);
    let targetStr = target.type === 'sl' ? target.code : `${target.code} (${target.timing})`;
    console.log(targetStr + ', ' + lanes.join(', '));
} else {
    throw new Error(`Invalid command: '${cmd}' (expected 'get_ss', 'search_ss', 'translate_ss', 'rle_to_ss').`);
}
