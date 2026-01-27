
/** Implements a soup searching program similar to apgsearch, but worse! */

import {stringMD5} from './core/md5.js';
import {Pattern, MAPPattern, getApgcode, getKnots, INTSeparator, getHashsoup, randomHashsoup, toCatagolueRule, createPattern} from './core/index.js';


let print: (msg: string) => void | Promise<void>;


/** Runs a pattern to stabilization. */
async function stabilize(p: Pattern, soup?: string, maxgen?: number, maxpop?: number): Promise<null | number | 'died' | {linear: true, period: number}> {
    p.run(60);
    let maxPeriod = 6;
    let pops: number[] = [];
    maxgen ??= 120000;
    for (let i = 0; i < maxgen; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pop === 0) {
            return 'died';
        }
        if (maxpop && pop > maxpop) {
            return null;
        }
        for (let period = 1; period < Math.min(maxPeriod, Math.floor(i / 16)); period++) {
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return period;
            }
        }
        for (let period = 1; period < Math.floor(i / 16); period++) {
            let diff = pop - pops[pops.length - period];
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return {linear: true, period};
            }
        }
        pops.push(pop);
        if (i === 60) {
            maxPeriod = 12;
        } else if (i === 120) {
            maxPeriod = 24;
        } else if (i === 240) {
            maxPeriod = 60;
        }
    }
    if (soup) {
        await print(`Failed to detect periodic behavior in soup ${soup}!`);
    } else {
        await print('Failed to detect periodic behavior!');
    }
    return null;
}

/** Runs a INT pattern to stabilization and censuses it into apgcodes and counts.
 * @param knots The precomputed knot data (which helps with disconnected strict objects), call `getKnots` to use it.
 */
async function censusINT(p: MAPPattern, knots: Uint8Array, soup?: string): Promise<{[key: string]: number}> {
    let period = await stabilize(p, soup);
    if (period === 'died') {
        period = 1;
    } else if (period === null) {
        period = 0;
    } else if (typeof period === 'object') {
        period = period.period;
    }
    let sep = new INTSeparator(p, knots);
    let data = sep.separate(period * 8, Math.max(period * 8, 256));
    if (!data) {
        if (soup) {
            await print(`Unable to separate objects in soup ${soup}!`);
        } else {
            await print('Unable to separate objects!');
        }
        return {PATHOLOGICAL: 1};
    }
    if (data[1]) {
        if (soup) {
            await print(`Unable to separate multi-island object or confirm that it is strict in soup ${soup}!`);
        } else {
            await print(`Unable to separate multi-island object or confirm that it is strict!`);
        }
    }
    let out: {[key: string]: number} = {};
    for (let [_, type] of data[0]) {
        let apgcode = getApgcode(type);
        if (apgcode in out) {
            out[apgcode]++;
        } else {
            out[apgcode] = 1;
        }
    }
    return out;
}

/** Does a soup search. */
async function runSearch(rule: string, symmetry: string, soups: number, seed: string | undefined): Promise<[string, string]> {
    seed ??= randomHashsoup();
    print('Using seed ' + seed);
    let census: {[key: string]: number} = {};
    let samples: {[key: string]: number[]} = {};
    let pattern = createPattern(rule);
    if (!(pattern instanceof MAPPattern) || pattern.ruleSymmetry !== 'D8') {
        throw new Error('Cannot search non-INT rules');
    }
    let knots = getKnots(pattern.trs);
    let start = performance.now();
    let prev = start;
    let prevI = 0;
    for (let i = 0; i < soups; i++) {
        let {height, width, data} = await getHashsoup(seed + i, symmetry);
        let soup = new MAPPattern(height, width, data, pattern.trs, '', 'D8');
        let out = await censusINT(soup, knots, seed + i);
        for (let key in out) {
            if (key in census) {
                census[key] += out[key];
            } else {
                census[key] = out[key];
            }
            if (!samples[key]) {
                samples[key] = [i];
            } else if (samples[key].length < 10) {
                samples[key].push(i);
            }
            if (key.startsWith('x')) {
                if (rule === 'b3s23') {
                    if (key[1] === 'p') {
                        if ((key[2] !== '2' || key[3] !== '_') && key !== 'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401' && key !== 'xp15_4r4z4r4') {
                            await print('Rare oscillator detected: \x1b[1;31m' + key + '\x1b[0m in soup ' + seed + i);
                        }
                    } else if (key[1] === 'q' && key !== 'xq4_153' && key !== 'xq4_6frc' && key !== 'xq4_27dee6' && key !== 'xq4_27deee6') {
                        await print('Rare spaceship detected: \x1b[1;34m' + key + '\x1b[0m in soup ' + seed + i);
                    }
                }
            } else if (key.startsWith('y')) {
                await print('Linear-growth pattern detected: \x1b[1;32m' + key + '\x1b[0m in soup ' + seed + i);
            } else if (key.startsWith('z')) {
                await print('Chaotic-growth pattern detected: \x1b[1;32m' + key + '\x1b[0m in soup ' + seed + i);
            } else if (key.startsWith('P')) {
                await print('Pathological object detected in soup ' + seed + i);
            }
        }
        let now = performance.now();
        if (now - prev > 10000) {
            await print(`${rule}/${symmetry}: ${i} soups completed (${((i - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(i / ((now - start) / 1000)).toFixed(3)} overall).`);
            prev = now;
            prevI = i;
        }
    }
    let now = performance.now();
    await print(`${rule}/${symmetry}: ${soups} soups completed (${((soups - prevI) / ((now - prev) / 1000)).toFixed(3)} soups/second current, ${(soups / ((now - start) / 1000)).toFixed(3)} overall).`);
    let prefix = `@VERSION apgweb-v1.2\n@MD5 ${stringMD5(seed)}\n@ROOT ${seed}\n@RULE ${rule}\n@SYMMETRY ${symmetry}_web_test\n@NUM_SOUPS ${soups}\n@NUM_OBJECTS ${Object.keys(census).length}`;
    return [
        prefix + `\n\n@CENSUS TABLE\n${Object.entries(census).sort((a, b) => b[1] - a[1]).map(x => x[0] + ' ' + x[1]).join('\n')}\n\n@SAMPLE_SOUPIDS\n${Object.entries(samples).sort((a, b) => census[b[0]] - census[a[0]]).map(x => x[0] + ' ' + x[1].join(' ')).join('\n')}`,
        prefix + `\n\n@CENSUS TABLE\n${Object.entries(census).sort((a, b) => b[1] - a[1]).map(x => `<a href="https://catagolue.hatsya.com/object/${x[0]}/${rule}">${x[0]}</a> ${x[1]}`).join('\n')}\n\n@SAMPLE_SOUPIDS\n${Object.entries(samples).sort((a, b) => census[b[0]] - census[a[0]]).map(x => `<a href="https://catagolue.hatsya.com/object/${x[0]}/${rule}">${x[0]}</a> ${x[1].map(y => `<a href="https://catagolue.hatsya.com/hashsoup/${symmetry}/${seed}${y}/${rule}">${y}</a>`).join(' ')}`).join('\n')}`,
    ];
}


if (typeof process === 'object' && process && Array.isArray(process.argv)) {
    print = console.log.bind(console);
    if (process.argv.length < 3) {
        console.log(`Usage: apgweb <rule> <symmetry> <num_soups> [options]`);
        process.exit();
    }
    let rule = toCatagolueRule(process.argv[2]);
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
    let haul = (await runSearch(rule, symmetry, soups, seed))[0];
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
} else {
    function getElement<T extends undefined | keyof HTMLElementTagNameMap>(id: string): T extends string ? HTMLElementTagNameMap[T] : HTMLElement {
        // @ts-ignore
        return document.getElementById(id);
    }
    let outElt = getElement('out');
    let rule: string;
    let symmetry: string;
    const APGCODE_REGEX = /(x[spq]|yl)\d+_[a-z0-9]+/g;
    const SOUP_REGEX = /k_[a-zA-Z0-9]+/g;
    print = async msg => {
        if (msg.includes('\x1b')) {
            msg = msg.replaceAll('\x1b[1;31m', ''/*'<span style="color: #ff7f7f">'*/);
            msg = msg.replaceAll('\x1b[1;34m', ''/*'<span style="color: #7f7fff">'*/);
            msg = msg.replaceAll('\x1b[1;32m', ''/*'<span style="color: #7fff7f">'*/);
            msg = msg.replaceAll('\x1b[0m', ''/*'</span>'*/);
        }
        for (let [match] of msg.matchAll(APGCODE_REGEX)) {
            msg = msg.replace(match, `<a href="https://catagolue.hatsya.com/object/${match}/${rule}">${match}</a>`);
        }
        for (let [match] of msg.matchAll(SOUP_REGEX)) {
            msg = msg.replace(match, `<a href="https://catagolue.hatsya.com/hashsoup/${symmetry}/${match}/${rule}">${match}</a>`);

        }
        outElt.innerHTML += '\n' + msg;
        return new Promise(resolve => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
            });
        });
    }
    let link = document.createElement('a');
    getElement('run').addEventListener('click', async () => {
        getElement('config').style.display = 'none';
        rule = toCatagolueRule(getElement<'input'>('rule').value);
        symmetry = getElement<'input'>('symmetry').value;
        let soups = parseInt(getElement<'input'>('soups').value);
        if (Number.isNaN(soups)) {
            throw new Error('Invalid soups value');
        }
        let seed: string | undefined = getElement<'input'>('seed').value;
        if (seed.length === 0) {
            seed = undefined;
        }
        let [haul, htmlHaul] = await runSearch(rule, symmetry, soups, seed);
        outElt.innerHTML += '\n\n' + htmlHaul + '\n\n\n';
        let downloadButton = document.createElement('button');
        downloadButton.addEventListener('click', event => {
            event.preventDefault();
            let url = URL.createObjectURL(new Blob([haul]));
            link.href = url;
            link.download = 'haul.apg';
            link.click();
        });
        outElt.appendChild(downloadButton);
    });
    document.querySelectorAll('input').forEach(elt => {
        let value = localStorage['apgweb-input-' + elt.id];
        if (value) {
            elt.value = value;
        }
        elt.addEventListener('change', () => {
            localStorage['apgweb-input-' + elt.id] = elt.value;
        });
    });
}
