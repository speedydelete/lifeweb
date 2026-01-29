
import * as fs from 'node:fs/promises';
import {MAPPattern, parse} from '../core/index.js';
import {c, parseChannelRecipe} from './base.js';
import {createSalvoPattern, patternToSalvo, searchSalvos} from './slow_salvos.js';
import {createChannelPattern, searchChannel} from './channel.js';


let cmd = process.argv[2].toLowerCase();
let type = process.argv[3].toLowerCase();
let args = process.argv.slice(4).join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x);;

if (!(type === 'ss' || type in c.CHANNEL_INFO)) {
    throw new Error(`Invalid construction type: ${type}`);
}

if (cmd === 'get') {
    if (type === 'ss') {
        let start = c.START_OBJECT;
        if (args[0].startsWith('x')) {
            start = args[0];
            args = args.slice(1);
        }
        start = start.slice(start.indexOf('_') + 1);
        console.log(createSalvoPattern(start, args.map(x => parseInt(x)))[0].toRLE());
    } else {
        console.log(createChannelPattern(c.CHANNEL_INFO[type], parseChannelRecipe(args.join(' ')))[0].toRLE());
    }
} else if (cmd === 'from') {
    if (type === 'ss') {
        let data = (await fs.readFile(process.argv.slice(4).join(' '))).toString();
        let p = parse(data) as MAPPattern;
        let [target, lanes] = patternToSalvo(p);
        console.log(target + ', ' + lanes.join(', '));
    }
} else if (cmd === 'search') {
    if (type === 'ss') {
        if (args[0].startsWith('x')) {
            await searchSalvos(args[0], parseInt(args[1]));
        } else {
            await searchSalvos(c.START_OBJECT, parseInt(args[0]));
        }
    } else {
        await searchChannel(type, typeof args[0] === 'string' ? parseInt(args[0]) : c.CHANNEL_INFO[type].minSpacing, typeof args[1] === 'string' ? parseInt(args[1]) : undefined);
    }
} else if (cmd === 'translate') {
    if (type !== 'ss') {
        throw new Error('Can only translate slow salvos');
    }
    let x = parseInt(args[0].replaceAll('(', ''));
    let y = parseInt(args[1].replaceAll(')', ''));
    let start = '';
    if (args[0].startsWith('x')) {
        start = args[0] + ' ';
        args = args.slice(1);
    }
    let data = args.map(x => parseInt(x));
    data = data.map(lane => lane + x - y);
    console.log(start + data.join(', '));
} else {
    throw new Error(`Invalid command: '${cmd}'.`);
}
