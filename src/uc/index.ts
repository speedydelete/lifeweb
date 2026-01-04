
import * as c from './config.js';
import {createSalvoPattern, searchSalvos} from './slow_salvos.js';


let cmd = process.argv[2];
let args = process.argv.slice(3);

if (cmd === 'get_ss') {
    let lanes = args.join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x).map(x => parseInt(x)).reverse();
    console.log(createSalvoPattern({target: c.START_OBJECT.slice(c.START_OBJECT.indexOf('_') + 1), lanes})[0].toRLE());
} else if (cmd === 'search_ss') {
    searchSalvos(parseInt(args[0]));
} else {
    throw new Error(`Invalid command: '${cmd}' (expected 'get_ss' or 'search_ss').`);
}
