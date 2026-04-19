
import * as fs from 'node:fs/promises';
import {MAPPattern, parse} from '../core/index.js';
import {c, setMaxGenerations, INFO_ALIASES, parseSlowSalvo, salvoToString, parseChannelRecipe, channelRecipeToString, parseElbow, addRecipeFile, loadRecipes, saveRecipes, printMemory} from './base.js';
import {createSalvoPattern, patternToSalvo, searchSalvos} from './slow_salvos.js';
import {createChannelPattern, searchChannel} from './channel.js';
import {mergeRecipes, sortRecipes, salvoToChannel} from './compiler.js';


export async function run(): Promise<void> {


if (typeof process.env === 'object') {
    process.env.FORCE_COLOR = '1';
}


function error(msg: string): never {
    console.error('Error:', msg);
    process.exit(1);
}

const HELP = `
Usage: ./uc <command> [options]

Search program and utility for universal construction in cellular automata.

Subcommands:

    get <type> <recipe>: Turns a list of lanes/timing gaps into a RLE.

    from <type> <rle_file>: Turns a RLE into a list of lanes/timing gaps.

    search <type> [max_spacing]: Perform a search for recipes. max_spacing is required for channel searching.

    convert <type> <new_type> <dir> <recipe>: Convert a slow salvo to a restricted-channel recipe.

    merge <file>: Merge recipes from another file.

    purge_elbows <type> <limit>: Purge elbows whose score is less than the given number.

    get_recipe_file_size: Load recipes and see the size in memory.

The type argument is the construction type, defined in src/uc/config.ts.

Options:

    -h, --help: Show this help message.

    -t <n>, --threads <n>: Parallelize using n threads (only supported for channel searching currently).

    -m, --max-gens: Set the maximum amount of generations for stabilization (overrides config.ts).

    -d <depth>, --depth <depth>: For convert, the depth to use for searching. For salvo searching, it will increase the depth by that much when compiling recipes.

    -b <beam>, --beam <beam>: For convert, the beam width to use. Not providing this option will make it use full Dijkstra instead of beam search.

    -f <path>, --file <path>: Provide an output file to append stdout to as well as putting it on the screen.
    
    --force-end-elbow <elbow>: For convert, force an ending elbow.

    --destroy-elbow: For convert, destroy the elbow.

    --min-elbow <pos>: For convert_0, the minimum position the elbow can be on.

    --max-elbow <pos>: For convert_0, the maximum postiion the elbow can be on.

    --no-compile: For slow salvo searching, disables compilation of recipes.

`;

const OPTIONS = {
    'help': true,
    'threads': 'number',
    'max-gens': 'number',
    'depth': 'number',
    'beam': 'number',
    'file': 'string',
    'force-end-elbow': 'string',
    'destroy-elbow': true,
    'min-elbow': 'number',
    'max-elbow': 'number',
    'no-compile': true,
    'dvgrn': true,
} as const satisfies {[key: string]: true | 'string' | 'number'};

type Options = typeof OPTIONS;
type Option = keyof Options;

const OPTION_ALIASES: {[key: string]: Option} = {
    'h': 'help',
    't': 'threads',
    'm': 'max-gens',
    'd': 'depth',
    'b': 'beam',
    'f': 'file',
};

let argv = process.argv;

let posArgs: string[] = [];
let options: Partial<{[K in Option]: Options[K] extends true ? true : (Options[K] extends 'string' ? string : (Options[K] extends 'number' ? number : never))}> = {}

for (let i = 2; i < argv.length; i++) {
    let arg = argv[i];
    if (arg.match(/^-[-a-zA-Z]/)) {
        arg = arg.toLowerCase();
        let originalArg = arg;
        while (arg.startsWith('-')) {
            arg = arg.slice(1);
        }
        if (arg in OPTION_ALIASES) {
            arg = OPTION_ALIASES[arg];
        }
        if (!(arg in OPTIONS)) {
            error(`Unrecognized option: '${arg}'`);
        }
        let option = arg as Option;
        let value = OPTIONS[option];
        if (value === true) {
            (options[option] as true) = true;
        } else if (value === 'string') {
            if (i === argv.length - 1) {
                error(`Expected argument for option '${originalArg}'`);
            }
            let arg = argv[++i];
            (options[option] as string) = arg;
        } else {
            if (i === argv.length - 1) {
                error(`Expected argument for option '${originalArg}'`);
            }
            let arg = argv[++i];
            let num = parseFloat(arg);
            if (Number.isNaN(num)) {
                error(`Expected numeric argument for option '${originalArg}'`);
            }
            (options[option] as number) = num;
        }
    } else {
        posArgs.push(arg);
    }
}


if (options['help']) {
    console.log(HELP);
    process.exit(0);
}

if (options['max-gens'] !== undefined) {
    setMaxGenerations(options['max-gens']);
}

if (options['file'] !== undefined) {
    let originalWrite = process.stdout.write.bind(process.stdout);
    let {appendFileSync} = await import('node:fs');
    process.stdout.write = function(data: string | Uint8Array, encoding: NodeJS.BufferEncoding | ((error?: Error | null) => void) = 'utf-8', callback?: (error?: Error | null) => void): boolean {
        if (typeof encoding === 'function') {
            callback = encoding;
            encoding = 'utf-8';
        }
        if (data instanceof Uint8Array) {
            let str = '';
            for (let byte of data) {
                str += String.fromCharCode(byte);
            }
            data = str;
            encoding = 'latin1';
        }
        let stripped = data.replaceAll(/\x1b\[([0-9;]+)m/g, '');
        appendFileSync(options['file'] as string, stripped, encoding);
        return originalWrite(data, encoding, callback);
    }
}

// if (posArgs[0] === 'search_simeks') {
//     let info = c.CHANNEL_INFO['Single-channel (90)'];
//     let recipes = (await fs.readFile('recipes_b3s23_simeks.txt')).toString().split('\n').map(x => parseChannelRecipe(info, x)[0]);
//     await searchChannel('Single-channel (90)', options['threads'] ?? 1, 'xs4_33/9', 256, recipes, options['file'], true);
//     process.exit(0);
// }

if (posArgs.length < 1) {
    error('At least 1 positional argument expected!');
}

let cmd = posArgs[0];

const EXPECTS_TYPE: string[] = ['get', 'from', 'search', 'convert', 'purge_elbows'];
let args = posArgs.slice(1);
let type = '';
if (EXPECTS_TYPE.includes(cmd)) {
    if (args.length < 1) {
        error('At least 1 positional argument expected!');
    }
    type = args[0].toLowerCase();
    args = args.slice(1);
    if (type in INFO_ALIASES) {
        type = INFO_ALIASES[type];
    }
    if (!(type in c.SALVO_INFO || type in c.CHANNEL_INFO)) {
        error(`Invalid construction type: '${type}'`);
    }
}


const COMMANDS: {[key: string]: () => Promise<void>} = {

    async 'get'(): Promise<void> {
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
    },

    async 'from'(): Promise<void> {
        let data = (await fs.readFile(args[0])).toString();
        let p = parse(data) as MAPPattern;
        if (type in c.SALVO_INFO) {
            let info = c.SALVO_INFO[type];
            if (options['dvgrn']) {
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
    },
    
    async 'search'(): Promise<void> {
        if (type in c.SALVO_INFO) {
            if (args[0] && args[0].startsWith('x')) {
                await searchSalvos(type, args[0], options['no-compile']);
            } else {
                await searchSalvos(type, c.SALVO_INFO[type].startObject, options['no-compile'], options['depth']);
            }
        } else {
            await searchChannel(type, options['threads'] ?? 1, parseElbow(args[0]), parseInt(args[1]), options['file']);
        }
    },

    async 'convert'(): Promise<void> {
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
            let elbow = parseElbow(args[2]);
            let recipes = await loadRecipes();
            let salvo = parseSlowSalvo(c.SALVO_INFO[type], args.slice(2).join(' '));
            let {recipe, time, elbow: newElbow} = salvoToChannel(info, sortRecipes(recipes.channels[newType]), elbow, salvo, dir as c.ShipDirection, options['depth'], options['beam'], options['destroy-elbow'] ? false : options['force-end-elbow'], options['min-elbow'], options['max-elbow']);
            console.log(channelRecipeToString(info, recipe));
            console.log(`${recipe.length} gliders, ${time} generations long`);
            if (newElbow !== false) {
                console.log(`End elbow is ${newElbow[0].timingStr}, moved by ${newElbow[1]}`);
            }
        }
    },

    async 'merge'(): Promise<void> {
        let recipes = await loadRecipes();
        let file = (await fs.readFile(args.join(' '))).toString();
        recipes = addRecipeFile(recipes, file);
        await saveRecipes(recipes);
    },

    async 'purge_elbows'(): Promise<void> {
        if (!(type in c.CHANNEL_INFO)) {
            error(`Type must be channel`);
        }
        let limit = parseInt(args[0]);
        if (Number.isNaN(limit)) {
            error(`Invalid number: '${args[0]}'`);
        }
        let recipes = await loadRecipes();
        console.log('Loaded recipes');
        let info = c.CHANNEL_INFO[type];
        let value = recipes.channels[type];
        let scoreSets: {[key: string]: Set<string>} = {};
        for (let recipe of Object.values(value.recipes)) {
            if (recipe.end) {
                let value = channelRecipeToString(info, recipe.recipe.filter(x => x[1] !== -2));
                if (recipe.end.str in scoreSets) {
                    scoreSets[recipe.end.str].add(value);
                } else {
                    scoreSets[recipe.end.str] = new Set([value]);
                }
            }
        }
        let scores = Object.entries(scoreSets).map(x => [x[0], x[1].size] as [string, number]);
        let rareElbows = scores.filter(x => x[1] >= limit).map(x => x[0]);
        for (let [elbow, data] of Object.entries(value.elbows)) {
            if (rareElbows.includes(elbow)) {
                for (let i = 0; i < data.length; i++) {
                    if (data[i].type === 'normal') {
                        data[i] = {type: 'rare'};
                    }
                }
            }
        }
        for (let [key, recipe] of Object.entries(value.recipes)) {
            if (recipe.end && rareElbows.includes(recipe.end.str)) {
                delete value.recipes[key];
            }
        }
        console.log('Purge complete, saving recipes');
        await saveRecipes(recipes);
    },

    async 'get_recipe_file_size'(): Promise<void> {
        await eval('ybnq'.replace(/[a-z]/g, x => String.fromCharCode(((x.charCodeAt(0) - 97 + 13) % 26) + 97)) + 'Recipes()');
    }

};

if (cmd in COMMANDS) {
    COMMANDS[cmd]();
} else {
    throw new Error(`Invalid command: '${cmd}'.`);
}


}


if (import.meta.main || (typeof process === 'object' && process && Array.isArray(process.argv) && process.argv[0].endsWith('lib/uc/index.js'))) {
    run();
}
