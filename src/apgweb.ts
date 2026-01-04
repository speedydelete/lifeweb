
import {soupSearch} from './core/index.js';

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
let seed: string | undefined = undefined;
let key: string | undefined = undefined;

for (let i = 5; i < process.argv.length; i++) {
    let arg = process.argv[i];
    if (!arg.startsWith('-')) {
        console.log(`Invalid option: '${arg}'`);
        process.exit();
    }
    let flag = arg.slice(1);
    if (flag === 's') {
        seed = process.argv[++i];
    } else if (flag === 'k') {
        key = process.argv[++i];
    } else {
        console.log(`Invalid option: '${arg}'`);
        process.exit();
    }
}

let data = await soupSearch({rule, symmetry, seed, soups, print: console.log});
let haul = `@VERSION apgweb-v1.2\n@MD5 ${data.md5}\n@ROOT ${data.seed}\n@RULE ${data.rule}\n@SYMMETRY ${data.symmetry}_web_test\n@NUM_SOUPS ${data.soups}\n@NUM_OBJECTS ${data.objects}\n\n@CENSUS TABLE\n${Object.entries(data.census).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join('\n')}\n\n@SAMPLE_SOUPIDS\n${Object.entries(data.samples).sort((a, b) => data.census[b[0]] - data.census[a[0]]).map(x => x[0] + ' ' + x[1].join(' ')).join('\n')}`;
console.log('\n' + haul);

if (key) {
    console.log('\nAttempting to upload to Catagolue');
    let resp = await fetch('http://catagolue.hatsya.com:80/payosha256', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: 'payosha256:get_token:' + key + ':post_apgsearch_haul',
    });
    let data = await resp.text();
    let parts = data.split('\n')[1].split(':');
    if (parts[1] !== 'good') {
        console.log('Failed:\n' + data);
    }
    let target = parts[2];
    let token = parts[3];
    let str = '';
    for (let nonce = 0; nonce < 244823040; nonce++) {
        str = token + ':' + nonce;
        let data = new Uint8Array(str.length);
        for (let i = 0; i < str.length; i++) {
            data[i] = str.charCodeAt(i);
        }
        data = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
        let hash = Array.from(data).map(x => x.toString(16).padStart(2, '0')).join('');
        if (hash < target) {
            break;
        }
    }
    resp = await fetch('http://catagolue.hatsya.com:80/apgsearch', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain',
        },
        body: 'payosha256:pay_token:' + str + '\n' + haul,
    });
    data = await resp.text();
    if (data === 'Payosha256 authentication succeeded.\n***********************************************\n') {
        console.log('\x1b[1;32m' + data + '\x1b[0m');
    } else {
        console.log('\x1b[1;31m' + data + '\x1b[0m');
    }
}
