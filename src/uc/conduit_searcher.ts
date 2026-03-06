
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {MAPPattern, findStaticSymmetry} from '../core/index.js';
import {c, SalvoInfo, base} from './base.js';
import {createSalvoPattern, get1GSalvos} from './slow_salvos.js';


async function getStillLifes(lssPath: string, height: number, width: number): Promise<string[]> {
    let cmd = `${lssPath}/venv/bin/python3 ${lssPath}/lss.py -r '${c.RULE}' slenum ${width} ${height}`;
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
    let done = new Set<string>();
    for (let p of patterns) {
        // if (p.height !== height || p.width !== width) {
        //     continue;
        // }
        let key = p.toCanonicalApgcode();
        if (done.has(key)) {
            continue;
        }
        done.add(key);
        let prefix = `xs${p.population}`;
        let s = findStaticSymmetry(p);
        let C2 = s[0] === '.' || s[0] === 'r' || s[0] === '+' || s[0] === '*';
        let C4 = s[0] === 'r' || s[0] === '*';
        let D2s = s[0] === '/' || s[0] === 'x' || s[0] === '*';
        let D2b = s[0] === '\\' || s[0] === 'x' || s[0] === '*';
        out.add(p.toApgcode(prefix));
        if (!C4) {
            out.add(p.rotateLeft().toApgcode(prefix));
            if (!C2) {
                out.add(p.rotate180().toApgcode(prefix));
                if (!D2s) {
                    out.add(p.rotateLeft().flipAntiDiagonal().toApgcode(prefix));
                }
            } else if (!D2s) {
                out.add(p.rotateRight().flipAntiDiagonal().toApgcode(prefix));
            }
        } else if (!D2s) {
            out.add(p.flipAntiDiagonal().toApgcode(prefix));
        }
        if (!c.GLIDER_IS_GLIDE_SYMMETRIC && !D2b) {
            out.add(p.flipDiagonal().toApgcode(prefix));
            if (!C4) {
                out.add(p.rotateLeft().toApgcode(prefix));
                if (!C2) {
                    out.add(p.rotate180().toApgcode(prefix));
                    if (!D2s) {
                        out.add(p.rotateLeft().flipAntiDiagonal().toApgcode(prefix));
                    }
                } else if (!D2s) {
                    out.add(p.rotateRight().flipAntiDiagonal().toApgcode(prefix));
                }
            } else if (!D2s) {
                out.add(p.flipAntiDiagonal().toApgcode(prefix));
            }
        }
    }
    return Array.from(out);
}


let info: SalvoInfo = {startObject: '', gliderSpacing: 0, period: 1, intermediateObjects: [], laneLimit: 256};

export async function searchConduits(lssPath: string, height: number, width: number): Promise<void> {
    console.log('Getting objects');
    let start = performance.now() / 1000;
    let sls = await getStillLifes(lssPath, height, width);
    console.log(`Checking ${sls.length} objects (took ${((performance.now() - start) / 1000).toFixed(3)} seconds to get objects)`);
    let lastUpdate = start;
    let prevCount = 0;
    let written = false;
    for (let i = 0; i < sls.length; i++) {
        let code = sls[i];
        let data = get1GSalvos(info, code, 0);
        if (data) {
            for (let [lane, timing, result] of data[1]) {
                if (Array.isArray(result)) {
                    let report: string | undefined = undefined;
                    for (let obj of result) {
                        if (obj.type === 'other' && (obj.code === 'eater' || obj.code === 'stable reflector' || obj.code === 'stable splitter' || obj.code === 'factory')) {
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
                        let msg = `${report} (${code}, ${lane}):\n${rle}\n\n`;
                        if (!written) {
                            msg = '\n' + msg;
                            written = true;
                        }
                        await fs.appendFile('out.txt', msg);
                        if (!report.startsWith('Eater')) {
                            console.log(`${report} detected (${code}, ${lane}):\n${rle}`);
                        }
                    }
                 }
            }
        }
        let now = performance.now() / 1000;
        if (now - lastUpdate > 5) {
            console.log(`${i}/${sls.length} (${((i) / sls.length * 100).toFixed(3)}%) objects checked (${((i - prevCount) / (now - lastUpdate)).toFixed(3)} objects/second, ${(i / (now - start)).toFixed(3)} overall)`);
            lastUpdate = now;
            prevCount = i;
        }
    }
    console.log(`Search complete in ${((performance.now() - start) / 1000).toFixed(3)} seconds`);
}
