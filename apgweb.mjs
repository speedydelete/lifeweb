#!/usr/bin/env node

import {soupSearch} from './lib/index.js';

if (process.argv.length < 3) {
    console.log(`Usage: apgweb.mjs <rule> <symmetry> <num_soups> [options]`);
    process.exit();
}

let rule = process.argv[2];
let symmetry = process.argv[3];
let soups = parseInt(process.argv[4]);
if (Number.isNaN(soups)) {
    console.log('Invalid soups value');
    process.exit();
}
let seed = undefined;

for (let i = 5; i < process.argv.length; i++) {
    let arg = process.argv[i];
    if (!arg.startsWith('-')) {
        console.log(`Invalid option: '${arg}'`);
        process.exit();
    }
    let flag = arg.slice(1);
    if (flag === 's') {
        seed = process.argv[++i];
    } else {
        console.log(`Invalid option: '${arg}'`);
        process.exit();
    }
}

let data = await soupSearch({rule, symmetry, seed, soups, print: console.log});
console.log(`\n
@VERSION ${data.version}
@MD5 ${data.md5}
@ROOT ${data.seed}
@RULE ${data.rule}
@SYMMETRY ${data.symmetry}_web_test
@NUM_SOUPS ${data.soups}
@NUM_OBJECTS ${data.objects}

@CENSUS TABLE
${Object.entries(data.census).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join('\n')}

@SAMPLE_SOUPIDS
${Object.entries(data.samples).sort((a, b) => data.census[b[0]] - data.census[a[0]]).map(x => x[0] + ' ' + x[1].join(' ')).join('\n')}`);
