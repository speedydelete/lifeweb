
import * as fs from 'node:fs/promises';
import {MAPPattern, parse} from '../core/index.js';
import {c, setMaxGenerations, INFO_ALIASES, parseSlowSalvo, salvoToString, parseChannelRecipe, channelRecipeToString, loadRecipes} from './base.js';
import {createSalvoPattern, patternToSalvo, searchSalvos} from './slow_salvos.js';
import {createChannelPattern, searchChannel, mergeChannelRecipes, salvoToChannel} from './channel.js';
import {searchConduits, searchConduitsRandom} from './conduit_searcher.js';


export async function run(): Promise<void> {


function error(msg: string): never {
    console.error('Error:', msg);
    process.exit(1);
}

const HELP = `
Usage: ./uc <command> <type> [command_options] [flags]

Search program and utility for universal construction in cellular automata.

Subcommands:
    get <type> <recipe>: Turns a list of lanes/timing gaps into a RLE.
    from <type> <rle_file>: Turns a RLE into a list of lanes/timing gaps.
    search <type> [max_spacing]: Perform a search for recipes. max_spacing is required for channel searching.
    convert <type> <new_type> <dir> <recipe>: Convert a slow salvo to a restricted-channel recipe.
    merge <type> '<recipe 1>' '<recipe 2>': Merge restricted-channel recipes.
    search_conduits <lss-path> <height> <width>: Search for width by height stable reflectors, conduits, and eaters.
    search_conduits_objects <objects> <height> <width> <count>: Search for width by height stable reflectors, conduits, and eaters that are made up of count of the given objects.
    search_conduits_random <objects> <height> <width> <count>: Search for width by height stable reflectors, conduits, and eaters that are made up of count of the given objects placed randomly.

The type argument is the construction type, defined in src/uc/config.ts.

Flags:
    -h, --help: Show this help message.
    -t <n>, --threads <n>: Parallelize using n threads (only supported for channel searching currently).
    -m, --max-gens: Set the maximum amount of generations for stabilization (overrides config.ts).
    -d <depth>, --depth <depth>: For convert, the depth to use for searching. For salvo searching, it will increase the depth by that much when compiling recipes.
    -b <beam>, --beam <beam>: For convert, the beam width to use. Not providing this option will make it use full Dijkstra instead of beam search.
    --force-end-elbow <elbow>[/pos]: For convert, force an ending elbow.
    --destroy-elbow: For convert, destroy the elbow.
    --min-elbow <pos>: For convert_0, the minimum position the elbow can be on.
    --max-elbow <pos>: For convert_0, the maximum postiion the elbow can be on.
    --no-compile: For slow salvo searching, disables compilation of recipes.
    --no-eater: For conduit searching, do not report eaters.
    --strict-height: For conduit searching, only search objects that fill the whole height.
    --strict-width: For conduit searching, only search objects that fill the whole width.
    --strict-bb: Combination of --strict-height and --strict-width.
`;


let argv = process.argv;

let posArgs: string[] = [];
let threads = 1;
let maxGens: number | undefined = undefined;
let forceEndElbow: number | false | undefined = undefined;
let minElbow: number | undefined = undefined;
let maxElbow: number | undefined = undefined;
let depth: number | undefined = undefined;
let beam: number | undefined = undefined;
let dvgrn = false;
let noCompile = false;
let noEater = false;
let strictHeight = false;
let strictWidth = false;

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
        } else if (arg === '-b' || arg === '--beam') {
            beam = parseInt(argv[++i]);
            if (Number.isNaN(beam)) {
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
        } else if (arg === '--no-eater') {
            noEater = true;
        } else if (arg === '--strict-height') {
            strictHeight = true;
        } else if (arg === '--strict-width') {
            strictWidth = true;
        } else if (arg === '--strict-bb') {
            strictHeight = true;
            strictWidth = true;
        } else {
            error(`Unrecognized flag: '${arg}'\nSee -h for help.`);
        }
    } else {
        posArgs.push(arg);
    }
}



if (maxGens !== undefined) {
    setMaxGenerations(maxGens);
}

if (posArgs[0] === 'search_conduits') {
    await searchConduits(posArgs[1], parseInt(posArgs[2]), parseInt(posArgs[3]), undefined, noEater, strictHeight, strictWidth);
    process.exit(0);
} else if (posArgs[0] === 'search_conduits_objects') {
    await searchConduits('', parseInt(posArgs[2]), parseInt(posArgs[3]), [posArgs[1].split(/[ ,]+/), parseInt(posArgs[4])], noEater, strictHeight, strictWidth);
    process.exit(0);
} else if (posArgs[0] === 'search_conduits_random') {
    await searchConduitsRandom(parseInt(posArgs[2]), parseInt(posArgs[3]), posArgs[1].split(/[ ,]+/), parseInt(posArgs[4]), noEater);
    process.exit(0);
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
        start = start.slice(start.indexOf('_') + 1).replaceAll(',', '');
        console.log(createSalvoPattern(info, start, parseSlowSalvo(info, args.join(' '))).shrinkToFit().toRLE());
    } else {
        let info = c.CHANNEL_INFO[type];
        let target: string;
        let data: string;
        if (args[0].startsWith('x')) {
            target = args[0];
            data = args.slice(1).join(' ');
        } else {
            target = 'xs0_0/0';
            data = args.join(' ');
        }
        let lanes = parseChannelRecipe(info, data)[0];
        console.log(createChannelPattern(info, target, lanes).p.shrinkToFit().toRLE());
    }
} else if (cmd === 'from') {
    let data = (await fs.readFile(args[0])).toString();
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
            console.log(target + ', ' + salvoToString(c.SALVO_INFO[type], lanes));
        }
    } else {
        error(`Cannot use 'from' with restricted-channel (will hopefully be supported soon!)`);
    }
} else if (cmd === 'search') {
    if (type in c.SALVO_INFO) {
        if (args[0] && args[0].startsWith('x')) {
            await searchSalvos(type, args[0], noCompile);
        } else {
            await searchSalvos(type, c.SALVO_INFO[type].startObject, noCompile, depth);
        }
    } else {
        let elbow = args[0];
        let elbowTiming = 0;
        let parts = elbow.split('T');
        if (parts.length > 1) {
            elbow = parts[0];
            elbowTiming = parseInt(parts[1]);
        }
        await searchChannel(type, threads, elbow, elbowTiming, parseInt(args[1]));
    }
} else if (cmd === 'convert') {
    if (type in c.CHANNEL_INFO) {
        error(`Cannot convert from restricted-channel`);
    }
    let newType = args[0];
    if (newType in INFO_ALIASES) {
        newType = INFO_ALIASES[newType];
    }
    if (!(newType in c.SALVO_INFO || newType in c.CHANNEL_INFO)) {
        error(`Invalid construction type: '${newType}'`)
    }
    let ship = (newType in c.SALVO_INFO ? c.SALVO_INFO[newType] : c.CHANNEL_INFO[newType]).ship;
    let dir = args[1];
    if (dir === 'up' || dir === '180') {
        dir = ship.slope === 0 ? 'N' : 'NW';
    } else if (dir === 'down' || dir === '0') {
        dir = ship.slope === 0 ? 'S' : 'SE';
    } else if (dir === 'left' || dir === '90x') {
        dir = ship.slope === 0 ? 'W' : 'SW';
    } else if (dir === 'right' || dir === '90i') {
        dir = ship.slope === 0 ? 'E' : 'NE';
    }
    if (newType in c.SALVO_INFO) {
        error(`Cannot convert to slow salvos (yet!)`);
    } else {
        let info = c.CHANNEL_INFO[newType];
        let elbow = args[2];
        let recipes = await loadRecipes();
        let salvo = parseSlowSalvo(c.SALVO_INFO[type], args.slice(2).join(' '));
        let {recipe, time, elbow: newElbow} = salvoToChannel(info, recipes.channels[newType], elbow, salvo, dir as c.ShipDirection, depth, beam, forceEndElbow, minElbow, maxElbow);
        console.log(channelRecipeToString(info, recipe));
        console.log(`${recipe.length} gliders, ${time} generations long`);
        if (newElbow !== false) {
            console.log(`End elbow is ${newElbow[0]}, moved by ${newElbow[1]}`);
        }
    }
} else if (cmd === 'merge') {
    if (type in c.SALVO_INFO) {
        throw new Error('Cannot merge slow salvos');
    }
    let info = c.CHANNEL_INFO[type];
    let recipes = args.map(x => parseChannelRecipe(info, x)[0]);
    console.log(channelRecipeToString(info, mergeChannelRecipes(info, ...recipes)));
} else {
    throw new Error(`Invalid command: '${cmd}'.`);
}


}


if (import.meta.main) {
    run();
}
