
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {TRANSITIONS, VALID_TRANSITIONS, unparseTransitions, transitionsToArray, MAPPattern, getHashsoup, toCatagolueRule} from './index.js';


const BASE_B = ['3a', '3c', '3e', '3i', '3j', '3k', '3n', '3q', '3r', '3y'];
const BASE_S = ['2a', '2c', '2e', '2k', '2i', '2n', '3a', '3c', '3e', '3i', '3j', '3k', '3n', '3q', '3r', '3y'];

const CHECK_TRS = [
    'B2c', 'B2e', 'B2i', 'B2k', 'B2n',
    'B3a', 'B3c', 'B3e', 'B3i', 'B3j', 'B3k', 'B3n', 'B3q', 'B3r', 'B3y',
    'B4a', 'B4c', 'B4e', 'B4i', 'B4j', 'B4k', 'B4n', 'B4q', 'B4r', 'B4t', 'B4w', 'B4y', 'B4z',
    'B5a', 'B5c', 'B5e', 'B5i', 'B5j', 'B5k', 'B5n', 'B5q', 'B5r', 'B5y',
    'B6a', 'B6c', 'B6e', 'B6i', 'B6k', 'B6n',
    'B7c', 'B7e',
    'B8c',
    'S0c',
    'S1c', 'S1e',
    'S2a', 'S2c', 'S2e', 'S2i', 'S2k', 'S2n',
    'S3a', 'S3c', 'S3e', 'S3i', 'S3j', 'S3k', 'S3n', 'S3q', 'S3r', 'S3y',
    'S4a', 'S4c', 'S4e', 'S4i', 'S4j', 'S4k', 'S4n', 'S4q', 'S4r', 'S4t', 'S4w', 'S4y', 'S4z',
    'S5a', 'S5c', 'S5e', 'S5i', 'S5j', 'S5k', 'S5n', 'S5q', 'S5r', 'S5y',
    'S6a', 'S6c', 'S6e', 'S6i', 'S6k', 'S6n',
    'S7c', 'S7e',
    'S8c',
];


let soups = 0;

function createPattern(change: string[]): MAPPattern {
    let bTrs = BASE_B.slice();
    let sTrs = BASE_S.slice();
    for (let tr of change) {
        let trs = tr.startsWith('B') ? bTrs : sTrs;
        tr = tr.slice(1);
        if (trs.includes(tr)) {
            trs.splice(trs.indexOf(tr), 1);
        } else {
            trs.push(tr);
        }
    }
    let trs = transitionsToArray(bTrs, sTrs, TRANSITIONS);
    let ruleStr = 'B' + unparseTransitions(bTrs, VALID_TRANSITIONS, false) + '/S' + unparseTransitions(sTrs, VALID_TRANSITIONS, false);
    return new MAPPattern(0, 0, new Uint8Array(0), trs, ruleStr, 'D8');
}

function isExplosive(p: MAPPattern): boolean {
    p.run(256);
    let pops: number[] = [];
    for (let i = 0; i < 4000; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pop > 4000) {
            return true;
        }
        if (pop === 0) {
            return false;
        }
        for (let period = 1; period < Math.floor(pops.length / 15); period++) {
            let found = true;
            for (let j = 1; j < 16; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return false;
            }
        }
        if (i > 500 && i % 50 === 0) {
            for (let period = 1; period < Math.floor(i / 20); period++) {
                let diff = pop - pops[pops.length - period];
                let found = true;
                for (let j = 1; j < 16; j++) {
                    if (diff !== pops[pops.length - period * j] - pops[pops.length - period * (j + 1)]) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    return false;
                }
            }
        }
        pops.push(pop);
    }
    return true;
}

let out = '';

async function writeOut(data: string): Promise<void> {
    console.log(data);
    out += data + '\n';
    await fs.writeFile('out.txt', out);
}

async function check(change: string[]): Promise<void> {
    let p = createPattern(change);
    for (let i = 0; i < 100; i++) {
        let {height, width, data} = await getHashsoup('k_tfltest_' + soups + '_' + Math.floor(Math.random() * 1000000), 'C1');
        soups++;
        let q = p.copy();
        q.setData(data, height, width);
        if (isExplosive(q)) {
            await writeOut(`${p.ruleStr}: explosive (${i + 1})`);
            return;
        }
    }
    execSync(`(cd apgmera; ./recompile.sh --rule ${toCatagolueRule(p.ruleStr)} --symmetry C1)`, {stdio: 'inherit'});
    execSync(`./apgmera/apgluxe -n 2000 -i 1 -t 1 -L 1`, {stdio: 'inherit'});
    let files = await fs.readdir('.');
    let data: string | null = null;
    for (let file of files) {
        if (file.startsWith('log')) {
            data = (await fs.readFile('./' + file)).toString();
            fs.unlink('./' + file);
            break;
        }
    }
    if (data === null) {
        throw new Error('No log file found!');
    }
    let lines = data.split('\n');
    let found = false;
    let notable: string[] = [];
    for (let line of lines) {
        if (line === '@CENSUS TABLE') {
            found = true;
        } else if (!found) {
            continue;
        } else if (line === '@SAMPLE_SOUPIDS') {
            break;
        }
        let apgcode = line.trim().split(' ')[0];
        if (apgcode.length === 0) {
            continue;
        }
        let prefix = apgcode.split('_')[0];
        if (prefix === 'zz') {
            notable.push(apgcode);
        } else if (prefix.startsWith('yl')) {
            notable.push(apgcode);
        } else if (prefix.startsWith('xp') && parseInt(prefix.slice(2)) > 30) {
            notable.push(apgcode);
        } else if (prefix.startsWith('xq') && apgcode !== 'xq4_153' && apgcode !== 'xq4_6frc') {
            notable.push(apgcode);
        } else if (apgcode === 'PATHOLOGICAL') {
            notable.push(apgcode);
        }
    }
    if (notable.length === 0) {
        await writeOut(`${p.ruleStr}: nothing`);
    } else {
        await writeOut(`${p.ruleStr}: ${notable.join(', ')}`);
    }
}


for (let a of CHECK_TRS) {
    for (let b of CHECK_TRS) {
        if (a !== b) {
            await check([a, b]);
        }
    }
}
