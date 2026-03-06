
import * as fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {execSync} from 'node:child_process';
import {MAPPattern} from '../core/index.js';
import {c, SalvoInfo, base} from './base.js';
import {createSalvoPattern, get1GSalvos} from './slow_salvos.js';


async function getStillLifes(lssPath: string, width: number, height: number): Promise<string[]> {
    let cmd = `${lssPath}/venv/bin/python3 ${lssPath}/lss.py -r '${c.RULE}' slenum ${height} ${width}`;
    let data = execSync(cmd, {maxBuffer: 2**31}).toString();
    let patterns: MAPPattern[] = [];
    let currentRLE = '';
    let all: string[] = [];
    for (let line of data.split('\n')) {
        if ('bo0123456789$!'.includes(line[0])) {
            currentRLE += line;
        } else if (line.startsWith('x')) {
            if (currentRLE.length > 0) {
                let p = base.loadRLE(currentRLE).shrinkToFit();
                patterns.push(p);
                all.push(p.toApgcode());
                currentRLE = '';
            }
        } else {
            continue;
        }
    }
    if (currentRLE.length > 0) {
        patterns.push(base.loadRLE(currentRLE));
    }
    let out = new Set<string>();
    for (let p of patterns) {
        // if (p.height !== height || p.width !== width) {
        //     continue;
        // }
        let prefix = `xs${p.population}`;
        for (let i = 0; i < 2; i++) {
            for (let j = 0; j < 4; j++) {
                p.rotateLeft();
                let value = p.toApgcode(prefix);
                let flipped = p.copy().flipDiagonal().toApgcode(prefix);
                if (!(out.has(value) || out.has(flipped))) {
                    out.add(value);
                }
            }
            p.flipHorizontal();
        }
    }
    return Array.from(out);
}


let info: SalvoInfo = {startObject: '', gliderSpacing: 0, period: 1, intermediateObjects: [], laneLimit: 256};

export async function searchConduits(lssPath: string, width: number, height: number, noEater?: boolean): Promise<void> {
    console.log('Getting objects');
    let start = performance.now() / 1000;
    let sls = await getStillLifes(lssPath, width, height);
    console.log(`Checking ${sls.length} objects (took ${(performance.now() / 1000 - start).toFixed(3)} seconds to get objects)`);
    start = performance.now() / 1000;
    let lastUpdate = start;
    let prevCount = 0;
    let written = false;
    let wasEmpty: boolean;
    if (existsSync('out.txt')) {
        wasEmpty = (await fs.readFile('out.txt')).toString().trim().length === 0;
    } else {
        wasEmpty = true;
    }
    for (let i = 0; i < sls.length; i++) {
        let code = sls[i];
        let data = get1GSalvos(info, code, 0);
        if (data) {
            for (let [lane, timing, result] of data[1]) {
                if (Array.isArray(result)) {
                    let report: string | undefined = undefined;
                    for (let obj of result) {
                        if (obj.type === 'other' && ((!noEater && obj.code === 'eater') || obj.code === 'stable reflector' || obj.code === 'stable splitter' || obj.code === 'factory')) {
                            if (!report) {
                                report = obj.code;
                            } else {
                                report += ' and ' + obj.code;
                            }
                        } 
                    }
                    if (report) {
                        let rle = createSalvoPattern(info, code.slice(code.indexOf('_') + 1), [[lane, timing]]).toRLE();
                        report = report[0].toUpperCase() + report.slice(1);
                        let msg = `\n${report} (${code}, ${lane}):\n${rle}\n`;
                        if (!written) {
                            msg = `${!wasEmpty ? '\n' : ''}\n${width}x${height} search in ${c.RULE}:\n` + msg;
                            written = true;
                        }
                        await fs.appendFile('out.txt', msg);
                        if (!report.startsWith('Eater')) {
                            console.log(`\x1b[92m${report} detected (${code}, ${lane}):\n${rle}\x1b[0m`);
                        }
                    }
                 }
            }
        }
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${i}/${sls.length} (${((i) / sls.length * 100).toFixed(3)}%) complete (${((i - prevCount) / (now - lastUpdate)).toFixed(3)} objects/second current, ${(i / (now - start)).toFixed(3)} overall)`);
            lastUpdate = now;
            prevCount = i;
        }
    }
    console.log(`Search complete in ${((performance.now() - start) / 1000).toFixed(3)} seconds`);
}
