
import * as fs from 'node:fs';
import {MAPPattern, parse} from '../core/index.js';
import {c, setMaxGenerations, INFO_ALIASES, parseSlowSalvo, unparseSlowSalvo, parseChannelRecipe, unparseChannelRecipe, loadRecipes} from './base.js';
import {createSalvoPattern, patternToSalvo, searchSalvos} from './slow_salvos.js';
import {createChannelPattern, searchChannel, mergeChannelRecipes, salvoToChannel90DegDijkstra, salvoToChannel0DegDijkstra} from './channel.js';


function error(msg: string): never {
    console.error(msg);
    process.exit(1);
}



const HELP = `
Usage: ./uc <command> <type> [command_options] [flags]

Search program and utility for universal construction in cellular automata.

Subcommands:
    get <type> <recipe>: Turns a list of lanes/timing gaps into a RLE.
    from <type> <rle_file>: Turns a RLE into a list of lanes/timing gaps.
    search <type> [max_spacing]: Perform a search for recipes. max_spacing is required for channel searching.
    convert90i <type> <new_type> <recipe>: Convert a recipe using a 90-degree elbow and internal lanes.
    convert90x <type> <new_type> <recipe>: Convert a recipe using a 90-degree elbow and external lanes.
    convert0 <type> <new_type> <recipe>: Convert a recipe using a 0-degree elbow.
    merge <type> '<recipe 1>' '<recipe 2>': Merge restricted-channel recipes.

The type argument is the construction type, defined in src/uc/config.ts.

Flags:
    -h, --help: Show this help message.
    -t <n>, --threads <n>: Parallelize using n threads (only supported for channel searching currently).
    -m, --max-gens: Set the maximum amount of generations for stabilization (overrides config.ts).
    -d <depth>, --depth <depth>: For convert_90, the depth to use for searching. Using this enables the usage of Dijkstra instead of the naive method.
    --force-end-elbow <pos>: For convert, force an ending elbow position.
    --destroy-elbow: For convert, destroy the elbow.
    --min-elbow <pos>: For convert_0, the minimum position the elbow can be on.
    --max-elbow <pos>: For convert_0, the maximum postiion the elbow can be on.
    --no-compile: For slow salvo searching, disables compilation of recipes.
`;


let argv = process.argv;

let posArgs: string[] = [];

let threads = 1;
let maxGens: number | undefined = undefined;
let forceEndElbow: number | false | undefined = undefined;
let minElbow: number | undefined = undefined;
let maxElbow: number | undefined = undefined;
let depth: number | undefined = undefined;
let dvgrn = false;
let noCompile = false;

for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (arg.match(/^-[-a-zA-Z]/)) {
        if (arg === '-h' || arg === '--help') {
            console.log(HELP);
            process.exit(0);
        } else if (arg === '-t' || arg === '--threads') {
            threads = parseInt(argv[++i]);
            if (Number.isNaN(threads)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '-m' || arg === '--max-gens') {
            maxGens = parseInt(argv[++i]);
            if (Number.isNaN(maxGens)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '-d' || arg === '--depth') {
            depth = parseInt(argv[++i]);
            if (Number.isNaN(depth)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '--force-end-elbow') {
            forceEndElbow = parseInt(argv[++i]);
            if (Number.isNaN(forceEndElbow)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '--destroy-elbow') {
            forceEndElbow = false;
        } else if (arg === '--min-elbow') {
            minElbow = parseInt(argv[++i]);
            if (Number.isNaN(minElbow)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '--max-elbow') {
            maxElbow = parseInt(argv[++i]);
            if (Number.isNaN(maxElbow)) {
                error(`Invalid option for ${arg}: '${argv[i]}'\nSee -h for help.`);
            }
        } else if (arg === '--dvgrn') {
            dvgrn = true;
        } else if (arg === '--no-compile') {
            noCompile = true;
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

if (maxGens !== undefined) {
    setMaxGenerations(maxGens);
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
        start = start.slice(start.indexOf('_') + 1).replaceAll(',', '');
        console.log(createSalvoPattern(info, start, parseSlowSalvo(info, args.join(' ')))[0].toRLE());
    } else {
        console.log(createChannelPattern(c.CHANNEL_INFO[type], parseChannelRecipe(c.CHANNEL_INFO[type], args.join(' '))[0]).p.toRLE());
    }
} else if (cmd === 'from') {
    let data = fs.readFileSync(args[0]).toString();
    let p = parse(data) as MAPPattern;
    if (type in c.SALVO_INFO) {
        let info = c.SALVO_INFO[type];
        if (dvgrn) {
            let out: string[] = [];
            for (let [lane, timing] of patternToSalvo(info, p)[1]) {
                out.push((timing ? 'O' : 'E') + (lane - 2));
            }
            console.log(out.join(' '));
        } else {
            let [target, lanes] = patternToSalvo(info, p);
            lanes = lanes.map(x => [x[0] + 6, x[1]]);
            console.log(target + ', ' + unparseSlowSalvo(c.SALVO_INFO[type], lanes));
        }
    } else {
        error(`Cannot use 'from' with restricted-channel (will hopefully be supported soon!)`);
    }
} else if (cmd === 'search') {
    if (type in c.SALVO_INFO) {
        if (args[0] && args[0].startsWith('x')) {
            searchSalvos(type, args[0], noCompile);
        } else {
            searchSalvos(type, c.SALVO_INFO[type].startObject, noCompile);
        }
    } else {
        searchChannel(type, threads, parseInt(args[0]));
    }
} else if (cmd === 'convert90i' || cmd === 'convert90x' || cmd === 'convert0') {
    if (type in c.CHANNEL_INFO) {
        error(`Cannot convert from restricted-channel`);
    }
    let newType = args[0];
    if (newType in INFO_ALIASES) {
        newType = INFO_ALIASES[newType];
    }
    if (newType in c.SALVO_INFO) {
        error(`Cannot convert to slow salvos`);
    } else if (newType in c.CHANNEL_INFO) {
        let info = c.CHANNEL_INFO[newType];
        let recipes = await loadRecipes();
        let salvo = parseSlowSalvo(c.SALVO_INFO[type], args.slice(1).join(' '));
        let out: {recipe: [number, number][], time: number, move: number};
        if (cmd === 'convert90i' || cmd === 'convert90x') {
            out = salvoToChannel90DegDijkstra(newType, info, recipes, salvo, cmd[cmd.length - 1] as 'i' | 'x', depth ?? salvo.length, forceEndElbow)
        } else {
            out = salvoToChannel0DegDijkstra(newType, info, recipes, salvo, minElbow, maxElbow, forceEndElbow);

        }
        console.log(unparseChannelRecipe(c.CHANNEL_INFO[newType], out.recipe));
        console.log(`Moves elbow by ${out.move}, ${out.time} generations long`);
    } else {
        error(`Invalid construction type: '${newType}'`)
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
