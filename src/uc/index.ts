
import * as fs from 'node:fs/promises';
import {MAPPattern, parse} from '../core/index.js';
import {c, LETTERS, INFO_ALIASES, unparseSlowSalvo, parseChannelRecipe, unparseChannelRecipe} from './base.js';
import {createSalvoPattern, patternToSalvo, searchSalvos} from './slow_salvos.js';
import {createChannelPattern, searchChannel, mergeChannelRecipes} from './channel.js';


function error(msg: string): never {
    console.error(msg);
    process.exit(1);
}


function normalizeArgs(args: string[]): string[] {
    return args.join(' ').split(/[, ]/).map(x => x.trim()).filter(x => x);
}



const HELP = `
Usage: ./uc <command> <type> [command_options] [flags]

Search program and utility for universal construction in cellular automata.

Subcommands:
    get: Turns a list of lanes/timing gaps into a RLE.
    from: Turns a RLE into a list of lanes/timing gaps.
    search: Perform a search for recipes.
    merge: Merge two restricted-channel recipes.

The type argument is the construction type, defined in src/uc/config.ts.

Flags:
    -h, --help: Show this help message.
    -t <n>, --threads <n>: Parallelize using n threads (only supported for channel searching currently).
    -g, --glider-depth: For channel searching, make it so it searches by number of gliders and not recipe length.
`;


let argv = process.argv;

let posArgs: string[] = [];

let threads = 1;
let gliderDepth = false;

for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (arg.startsWith('-')) {
        if (arg === '-h' || arg === '--help') {
            console.log(HELP);
            process.exit(0);
        } else if (arg === '-t' || arg === '--threads') {
            threads = parseInt(argv[++i]);
            if (Number.isNaN(threads)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '-g' || arg === '--glider-depth') {
            gliderDepth = true;
        } else {
            error(`Unrecognized flag: '${arg}'\nSee -h for help.`);
        }
    } else {
        posArgs.push(arg);
    }
}

if (posArgs.length < 2) {
    error('At least 2 positional arguments expected!');
}

let cmd = posArgs[0];
let type = posArgs[1].toLowerCase();
let args = posArgs.slice(2);
if (type in INFO_ALIASES) {
    type = INFO_ALIASES[type];
}
if (!(type in c.SALVO_INFO || type in c.CHANNEL_INFO)) {
    error(`Invalid construction type: '${type}'`);
}

if (cmd === 'get') {
    if (type in c.SALVO_INFO) {
        let info = c.SALVO_INFO[type];
        let start = info.startObject;
        if (args[0].startsWith('x')) {
            start = args[0];
            args = args.slice(1);
        }
        start = start.slice(start.indexOf('_') + 1);
        console.log(createSalvoPattern(info, start, args.map<[number, number]>(x => {
            if (info.period === 1) {
                return [parseInt(x), 0];
            } else if (info.period === 2) {
                return [parseInt(x.slice(0, -1)), x[x.length - 1] === 'o' ? 1 : 0];
            } else {
                return [parseInt(x.slice(0, -1)), LETTERS.indexOf(x[x.length - 1])];
            }
        }))[0].toRLE());
    } else {
        console.log(createChannelPattern(c.CHANNEL_INFO[type], parseChannelRecipe(c.CHANNEL_INFO[type], args.join(' '))[0])[0].toRLE());
    }
} else if (cmd === 'from') {
    if (type in c.SALVO_INFO) {
        let data = (await fs.readFile(process.argv.slice(4).join(' '))).toString();
        let p = parse(data) as MAPPattern;
        let [target, lanes] = patternToSalvo(p);
        console.log(target + ', ' + unparseSlowSalvo(c.SALVO_INFO[type], lanes));
    }
} else if (cmd === 'search') {
    if (type in c.SALVO_INFO) {
        args = normalizeArgs(args);
        if (args[0].startsWith('x')) {
            await searchSalvos(type, args[0], parseInt(args[1]));
        } else {
            await searchSalvos(type, c.SALVO_INFO[type].startObject, parseInt(args[0]));
        }
    } else {
        await searchChannel(type, threads, parseInt(args[0]), gliderDepth);
    }
} else if (cmd === 'merge') {
    if (type in c.SALVO_INFO) {
        throw new Error('Cannot merge slow salvos');
    }
    let info = c.CHANNEL_INFO[type];
    let recipes = args.map(x => parseChannelRecipe(info, x)[0]);
    console.log(unparseChannelRecipe(info, mergeChannelRecipes(info, ...recipes)));
} else {
    throw new Error(`Invalid command: '${cmd}'.`);
}
