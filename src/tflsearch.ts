
import * as fs from 'node:fs/promises';
import {execSync, spawn} from 'node:child_process';
import {HEX_TRANSITIONS, VALID_HEX_TRANSITIONS, parseTransitions, unparseTransitions, transitionsToArray, MAPPattern, getHashsoup, toCatagolueRule} from './core/index.js';


// const CHECK_TRS = [
//     'B2c', 'B2e', 'B2i', 'B2k', 'B2n',
//     'B3a', 'B3c', 'B3e', 'B3i', 'B3j', 'B3k', 'B3n', 'B3q', 'B3r', 'B3y',
//     'B4a', 'B4c', 'B4e', 'B4i', 'B4j', 'B4k', 'B4n', 'B4q', 'B4r', 'B4t', 'B4w', 'B4y', 'B4z',
//     'B5a', 'B5c', 'B5e', 'B5i', 'B5j', 'B5k', 'B5n', 'B5q', 'B5r', 'B5y',
//     'B6a', 'B6c', 'B6e', 'B6i', 'B6k', 'B6n',
//     'B7c', 'B7e',
//     'B8c',
//     'S0c',
//     'S1c', 'S1e',
//     'S2a', 'S2c', 'S2e', 'S2i', 'S2k', 'S2n',
//     'S3a', 'S3c', 'S3e', 'S3i', 'S3j', 'S3k', 'S3n', 'S3q', 'S3r', 'S3y',
//     'S4a', 'S4c', 'S4e', 'S4i', 'S4j', 'S4k', 'S4n', 'S4q', 'S4r', 'S4t', 'S4w', 'S4y', 'S4z',
//     'S5a', 'S5c', 'S5e', 'S5i', 'S5j', 'S5k', 'S5n', 'S5q', 'S5r', 'S5y',
//     'S6a', 'S6c', 'S6e', 'S6i', 'S6k', 'S6n',
//     'S7c', 'S7e',
//     'S8c',
// ];

// const RULES: string[] = [];
// for (let b4 of ['', '4']) {
//     for (let b5 of ['', '5']) {
//         for (let b6 of ['', '6']) {
//             for (let b7 of ['', '7']) {
//                 for (let b8 of ['', '8']) {
//                     for (let s0 of ['', '0']) {
//                         for (let s1 of ['', '1']) {
//                             for (let s2 of ['', '2']) {
//                                 for (let s3 of ['', '3']) {
//                                     for (let s4 of ['', '4']) {
//                                         for (let s5 of ['', '5']) {
//                                             for (let s6 of ['', '6']) {
//                                                 for (let s7 of ['', '7']) {
//                                                     for (let s8 of ['', '8']) {
//                                                         RULES.push('B3' + b4 + b5 + b6 + b7 + b8 + '/S' + s0 + s1 + s2 + s3 + s4 + s5 + s6 + s7 + s8);
//                                                     }
//                                                 }
//                                             }
//                                         }
//                                     }
//                                 }
//                             }
//                         }
//                     }
//                 }
//             }
//         }
//     }
// }


let soups = 0;

function createPattern(base: string, change: string[]): MAPPattern {
    let [baseB, baseS] = base.split('/').map(x => x.slice(1));
    let bTrs = parseTransitions(baseB, VALID_HEX_TRANSITIONS);
    let sTrs = parseTransitions(baseS, VALID_HEX_TRANSITIONS);
    // for (let tr of change) {
    //     let trs = tr.startsWith('B') ? bTrs : sTrs;
    //     tr = tr.slice(1);
    //     if (trs.includes(tr)) {
    //         trs.splice(trs.indexOf(tr), 1);
    //     } else {
    //         trs.push(tr);
    //     }
    // }
    let trs = transitionsToArray(bTrs, sTrs, HEX_TRANSITIONS);
    let ruleStr = 'B' + unparseTransitions(bTrs, VALID_HEX_TRANSITIONS, false) + '/S' + unparseTransitions(sTrs, VALID_HEX_TRANSITIONS, false);
    return new MAPPattern(0, 0, new Uint8Array(0), trs, ruleStr, 'D8');
}

function isExplosive(p: MAPPattern): 'yes' | number | 'died' | 'linear' {
    p.run(30);
    let pops: number[] = [];
    for (let i = 0; i < 4000; i++) {
        p.runGeneration();
        let pop = p.population;
        if (pop > 4000) {
            return 'yes';
        }
        if (pop === 0) {
            return 'died';
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
                return period;
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
                    return 'linear';
                }
            }
        }
        pops.push(pop);
    }
    return 'yes';
}

let out = (await fs.readFile('out3.txt')).toString();

let lastUpdate = 0;

let apgsearchPID: number | null = null;

async function writeOut(data: string): Promise<void> {
    console.log(data);
    out += data + '\n';
    let now = performance.now();
    if (lastUpdate === 0 || (now - lastUpdate) > 3000) {
        await fs.writeFile('out3.txt', out);
        lastUpdate = now;
    }
}

let done = new Set(out.split('\n').map(x => x.trim()).filter(x => x.length > 0).map(x => x.split(':')[0]));

async function check(p: MAPPattern, change: string[]): Promise<void> {
    // let p = createPattern(base, change);
    if (done.has(p.ruleStr)) {
        return;
    }
    done.add(p.ruleStr);
    let allDied = true;
    let interesting = false;
    for (let i = 0; i < 50; i++) {
        let {height, width, data} = await getHashsoup('k_tfltest_' + soups + '_' + Math.floor(Math.random() * 1000000), 'C1');
        soups++;
        let q = p.copy();
        q.setData(height, width, data);
        let e = isExplosive(q);
        if (e === 'yes') {
            await writeOut(`${p.ruleStr}: explosive (${i + 1})`);
            return;
        } else if (typeof e === 'number') {
            if (e > 1) {
                interesting = true;
            }
            allDied = false;
        } else if (e === 'linear') {
            interesting = true;
            allDied = false;
        }
    }
    if (allDied) {
        await writeOut(`${p.ruleStr}: no objects`);
        return;
    } else if (!interesting) {
        await writeOut(`${p.ruleStr}: not interesting`);
        return;
    }
    execSync(`(cd apgmera; ./recompile.sh --rule ${toCatagolueRule(p.ruleStr)} --symmetry C1)`, {stdio: 'inherit'});
    let timedOut = await new Promise<boolean>((resolve, reject) => {
        let child = spawn('./apgmera/apgluxe', ['-n', '2000', '-i', '1', '-t', '1', '-L', '1', '-v', '0'], {stdio: 'inherit', detached: true});
        let timeout: any = null;
        child.on('error', error => {
            if (timeout) {
                clearTimeout(timeout);
            }
            apgsearchPID = null;
            reject(error);
        });
        if (child.pid) {
            apgsearchPID = child.pid;
        }
        timeout = setTimeout(() => {
            resolve(true);
            if (child.pid) {
                try {
                    process.kill(-child.pid, 'SIGKILL');
                } catch {}
            }
            apgsearchPID = null;
        }, 300000);
        child.on('exit', code => {
            apgsearchPID = null;
            if (code !== 137) {
                resolve(false);
            }
        });
    });
    if (timedOut) {
        await writeOut(`${p.ruleStr}: timed out`);
        return;
    }
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
        if (line.startsWith('@CENSUS')) {
            found = true;
            continue;
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
        if (prefix.startsWith('xs')) {
            continue;
        } else if (prefix.startsWith('xp')) {
            if (parseInt(prefix.slice(2)) > 4) {
                notable.push(apgcode);
            }
        } else {
            notable.push(apgcode);
        }
    }
    if (notable.length === 0) {
        await writeOut(`${p.ruleStr}: nothing`);
    } else {
        await writeOut(`${p.ruleStr}: ${notable.join(', ')}`);
    }
}


// for (let a of CHECK_TRS) {
//     for (let b of CHECK_TRS) {
//         if (CHECK_TRS.indexOf(a) < CHECK_TRS.indexOf(b)) {
//             await check('B3/S23', [a, b]);
//         }
//     }
// }

function cleanup(): void {
    if (apgsearchPID) {
        process.kill(-apgsearchPID, 'SIGKILL');
    }
    process.exit(0);
}
process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('SIGHUP', cleanup);

const TRS = ['B2o', 'B2m', 'B2p', 'B3o', 'B3m', 'B3p', 'B4o', 'B4m', 'B4p', 'B5', 'B6', 'S0', 'S1', 'S2o', 'S2m', 'S2p', 'S3o', 'S3m', 'S3p', 'S4', 'S5', 'S6'];

for (let num = 0; num < 2**TRS.length; num++) {
    let allTrs = TRS.filter((_, i) => Boolean(num & (1 << (22 - i))));
    let bTrs = allTrs.filter(x => x.startsWith('B'));
    let sTrs = allTrs.filter(x => x.startsWith('S'));
    let trs = transitionsToArray(bTrs, sTrs, HEX_TRANSITIONS);
    let ruleStr = 'B' + unparseTransitions(bTrs, VALID_HEX_TRANSITIONS, false) + '/S' + unparseTransitions(sTrs, VALID_HEX_TRANSITIONS, false);
    let p = new MAPPattern(0, 0, new Uint8Array(0), trs, ruleStr, 'D8');
    await check(p, []);
}

// for (let rule of RULES) {
//     await check(rule, []);
//     for (let tr of CHECK_TRS) {
//         await check(rule, [tr]);
//     }
// }
