
import * as c from './config.js';
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
    console.log(createSalvoPattern(start, args.map(x => parseInt(x)).reverse())[0].toRLE());
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
} else {
    throw new Error(`Invalid command: '${cmd}' (expected 'get_ss' or 'search_ss').`);
}
