
import * as fs from 'node:fs/promises';


const LINK_TEXT = `For more information, see <link>.`;
const HELP_TEXT = `Usage: ./rss <input file path> <output file path>\n${LINK_TEXT}`;

if (!process.argv[1] || process.argv[1] === '-h') {
    console.log('Error: Missing input file\n' + HELP_TEXT);
    process.exit(1);
}
if (!process.argv[2]) {
    console.log('Error: Missing output file\n' + HELP_TEXT);
    process.exit(1);
}

const KEY_TYPES = {
    min: 'string',
    max: 'string',
    rule: 'string',
    ot: 'boolean',
    transitions_from: 'number',
    soups: 'number',
    timeout: 'number',
    filter: 'string',
    interesting: 'string',
    check_explosive: 'number',
    maxpop: 'number',
    maxgen: 'number',
    show_apgsearch_output: 'boolean',
    show_estimated_time: 'boolean',
} as const;

type KeyTypes = typeof KEY_TYPES;
type Key = keyof KeyTypes;

let configText = (await fs.readFile(process.argv[1])).toString();

let config: {[K in Key]?: KeyTypes[K] extends 'boolean' ? boolean : (KeyTypes[K] extends 'number' ? number : string)} = {};

for (let line of configText.split('\n')) {
    line = line.trim();
    if (line === '' || line.startsWith('#')) {
        continue;
    }
    let index = line.indexOf(':');
    if (index === -1) {
        console.log(`Invalid line: ${line}`);
        process.exit(1);
    }
    let key = line.slice(0, index);
    let value = line.slice(index + 1);
    key = key.trim();
    value = value.trim();
    if (key in KEY_TYPES) {
        let type = KEY_TYPES[key as Key];
        if (type === 'number') {
            // @ts-ignore
            config[key as Key] = Number(value);
        } else if (type === 'boolean') {
            // @ts-ignore
            config[key as Key] = value === 'true' ? true : false;
        } else {
            // @ts-ignore
            config[key as Key] = value;
        }
    }
}

let min: string;
let max: string;
if (config.rule) {
    min = config.rule;
    max = config.rule;
} else if (config.min && config.max) {
    min = config.min;
    max = config.max;
} else {
    console.log(`Either 'rule' option or 'min' and 'max' options must be provided.\n${LINK_TEXT}`);
    process.exit(1);
}

if (!config.soups) {
    console.log(`'soups' option must be provided.\n${LINK_TEXT}`);
    process.exit(1);
}

if (!config.interesting) {
    console.log(`'interesting' option must be provided.\n${LINK_TEXT}`);
    process.exit(1);
}
