
import * as c from './config.js';
import {createSalvoPattern, searchSalvos} from './slow_salvos.js';


let cmd = process.argv[2];
let args = process.argv.slice(3);

if (cmd === 'get_ss') {
    let lanes = args.join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x);
    let start = c.START_OBJECT;
    if (lanes[0].startsWith('x')) {
        start = lanes[0];
        lanes = lanes.slice(1);
    }
    start = start.slice(start.indexOf('_') + 1);
    console.log(createSalvoPattern(start, lanes.map(x => parseInt(x)).reverse())[0].toRLE());
} else if (cmd === 'search_ss') {
    searchSalvos(parseInt(args[0]));
} else {
    throw new Error(`Invalid command: '${cmd}' (expected 'get_ss' or 'search_ss').`);
}
