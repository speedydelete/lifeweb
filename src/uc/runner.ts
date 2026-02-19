
import {MAPPattern, PatternType, findType, getApgcode, getKnots, INTSeparator} from '../core/index.js';
import {c, base, maxGenerations, StillLife, Oscillator, CAObject} from './base.js';

type ForCombining = (StillLife | Oscillator) & {p: MAPPattern, bb: [number, number, number, number]};

function combineStableObjects(objs: ForCombining[]): false | ForCombining[] {
    let out: ForCombining[] = [];
    let used = new Uint8Array(objs.length);
    for (let i = 0; i < objs.length; i++) {
        let obj = objs[i];
        if (used[i]) {
            continue;
        }
        used[i] = 1;
        let isOsc = obj.type === 'osc';
        let data = [];
        for (let j = 0; j < objs.length; j++) {
            if (used[j]) {
                continue;
            }
            let a = obj;
            let b = objs[j];
            let dist = Math.abs(Math.min(a.bb[2], b.bb[2]) - Math.max(a.bb[0], b.bb[0])) + Math.abs(Math.min(a.bb[3], b.bb[3]) - Math.max(a.bb[1], b.bb[1]));
            if (dist <= c.MAX_PSEUDO_DISTANCE) {
                used[j] = 1;
                data.push(objs[j]);
                isOsc ||= objs[j].type === 'osc';
                continue;
            }
            for (let a of data) {
                let dist = Math.abs(Math.min(a.bb[2], b.bb[2]) - Math.max(a.bb[0], b.bb[0])) + Math.abs(Math.min(a.bb[3], b.bb[3]) - Math.max(a.bb[1], b.bb[1]));
                if (dist <= c.MAX_PSEUDO_DISTANCE) {
                    used[j] = 1;
                    data.push(objs[j]);
                    isOsc ||= objs[j].type === 'osc';
                    break;
                }
            }
        }
        if (data.length === 0) {
            out.push(obj);
            continue;
        }
        let [minX, minY, maxX, maxY] = obj.bb;
        for (let obj of data) {
            if (obj.bb[0] < minX) {
                minX = obj.bb[0];
            }
            if (obj.bb[1] < minY) {
                minY = obj.bb[1];
            }
            if (obj.bb[2] > maxX) {
                maxX = obj.bb[2];
            }
            if (obj.bb[3] > maxY) {
                maxY = obj.bb[3];
            }
        }
        maxX++;
        maxY++;
        let p = base.copy();
        p.height = maxY - minY;
        p.width = maxX - minX;
        p.size = p.height * p.width;
        p.data = new Uint8Array(p.size);
        p.insert(obj.p, obj.x - minX, obj.y - minY);
        for (let obj of data) {
            p.insert(obj.p, obj.x - minX, obj.y - minY);
        }
        p.shrinkToFit();
        let type = findType(p, 2, false);
        if (!type.disp || type.disp[0] !== 0 || type.disp[1] !== 0) {
            return false;
        }
        let bb = [minX, minY, maxX, maxY] as [number, number, number, number];
        if (isOsc) {
            let period = obj.type === 'osc' ? parseInt(obj.code.slice(2)) : 1;
            for (let obj of objs) {
                if (obj.type === 'sl') {
                    continue;
                }
                let objPeriod = parseInt(obj.code.slice(2));
                let gcd = period;
                let b = objPeriod;
                while (b > 0) {
                    let temp = b;
                    b = gcd % b;
                    gcd = temp;
                }
                period = (period * objPeriod) / gcd;
            }
            out.push({
                type: 'osc',
                code: p.run(period - obj.p.generation % period).toApgcode('xp' + period),
                x: minX,
                y: minY,
                p,
                bb,
            });
        } else {
            out.push({
                type: 'sl',
                code: p.toApgcode('xs' + p.population),
                x: minX,
                y: minY,
                p,
                bb,
            });
        }
    }
    return out;
}

function combineAllStableObjects(objs: ForCombining[]): false | ForCombining {
    let obj = objs[0];
    let isOsc = obj.type === 'osc';
    let [minX, minY, maxX, maxY] = obj.bb;
    for (let obj of objs.slice(1)) {
        if (obj.bb[0] < minX) {
            minX = obj.bb[0];
        }
        if (obj.bb[1] < minY) {
            minY = obj.bb[1];
        }
        if (obj.bb[2] > maxX) {
            maxX = obj.bb[2];
        }
        if (obj.bb[3] > maxY) {
            maxY = obj.bb[3];
        }
        if (obj.type === 'osc') {
            isOsc = true;
        }
    }
    maxX++;
    maxY++;
    let p = base.copy();
    p.height = maxY - minY;
    p.width = maxX - minX;
    p.size = p.height * p.width;
    p.data = new Uint8Array(p.size);
    p.insert(obj.p, obj.x - minX, obj.y - minY);
    for (let obj of objs.slice(1)) {
        p.insert(obj.p, obj.x - minX, obj.y - minY);
    }
    p.shrinkToFit();
    let type = findType(p, 2, false);
    if (!type.disp || type.disp[0] !== 0 || type.disp[1] !== 0) {
        return false;
    }
    let bb = [minX, minY, maxX, maxY] as [number, number, number, number];
    if (isOsc) {
        let period = obj.type === 'osc' ? parseInt(obj.code.slice(2)) : 1;
        for (let obj of objs) {
            if (obj.type === 'sl') {
                continue;
            }
            let objPeriod = parseInt(obj.code.slice(2));
            let gcd = period;
            let b = objPeriod;
            while (b > 0) {
                let temp = b;
                b = gcd % b;
                gcd = temp;
            }
            period = (period * objPeriod) / gcd;
        }
        return {
            type: 'osc',
            code: p.run(period - obj.p.generation % period).toApgcode('xp' + period),
            x: minX,
            y: minY,
            p,
            bb,
        };
    } else {
        return {
            type: 'sl',
            code: p.toApgcode('xs' + p.population),
            x: minX,
            y: minY,
            p,
            bb,
        };
    }
}

let knots = getKnots(base.trs);

export function separateObjects(p: MAPPattern, sepGens: number, limit: number, mergeAll: boolean = false): false | CAObject[] {
    if (p.isEmpty()) {
        return [];
    }
    let sep = new INTSeparator(p, knots);
    sep.generation = p.generation;
    let objs: [MAPPattern, PatternType][] = [];
    let found = false;
    for (let i = 0; i < sepGens; i++) {
        let reassigned = sep.runGeneration();
        let reassigned2 = sep.resolveKnots();
        if (reassigned || reassigned2) {
            continue;
        }
        objs = sep.getObjects().map(x => [x, findType(x, limit)]);
        if (objs.every(([_, x]) => x.stabilizedAt === 0 && x.pops[x.pops.length - 1] !== 0)) {
            found = true;
            break;
        }
    }
    if (!found) {
        // if (input) {
        //     console.log(`Unable to separate objects for ${input}!`);
        // } else {
        //     console.log(`Unable to separate objects!`);
        // }
        return false;
    }
    let out: CAObject[] = [];
    let stableObjects: ((StillLife | Oscillator) & {p: MAPPattern, bb: [number, number, number, number]})[] = [];
    for (let [p, type] of objs) {
        if (p.isEmpty()) {
            return false;
        }
        p.shrinkToFit();
        p.generation = sep.generation;
        let apgcode = getApgcode(type);
        if (apgcode.startsWith('xs')) {
            if (apgcode.startsWith('xs0')) {
                return false;
            }
            stableObjects.push({
                type: 'sl',
                code: p.toApgcode('xs' + p.population),
                x: p.xOffset,
                y: p.yOffset,
                p,
                bb: [p.xOffset, p.yOffset, p.xOffset + p.width - 1, p.yOffset + p.height - 1],
            });
        } else if (apgcode.startsWith('xp')) {
            let q = p.copy().run(type.period);
            stableObjects.push({
                type: 'osc',
                code: p.toApgcode('xp' + type.period),
                x: p.xOffset,
                y: p.yOffset,
                p,
                bb: [q.xOffset, q.yOffset, q.xOffset + q.width - 1, q.yOffset + q.height - 1],
            });
        } else if (apgcode in c.SHIP_IDENTIFICATION) {
            let {data: info} = c.SHIP_IDENTIFICATION[apgcode];
            let found = false;
            for (let {height, width, population, data} of info) {
                if (p.height === height && p.width === width && p.population === population) {
                    for (let [cells, dir, timing] of data) {
                        found = true;
                        for (let i of cells) {
                            if (!p.data[i]) {
                                found = false;
                                break;
                            }
                        }
                        if (found) {
                            p.run(timing).shrinkToFit();
                            out.push({
                                type: 'ship',
                                code: apgcode,
                                x: p.xOffset,
                                y: p.yOffset,
                                dir,
                                at: 0,
                                timing: p.generation,
                            })
                            break;
                        }
                    }
                }
                if (found) {
                    break;
                }
            }
            if (!found) {
                throw new Error(`Invalid spaceship: ${p.toRLE()}`);
            }
        } else if (apgcode === 'PATHOLOGICAL' || apgcode.startsWith('zz')) {
            return false;
        } else {
            out.push({
                type: 'other',
                code: apgcode,
                x: p.xOffset,
                y: p.yOffset,
                realCode: p.toApgcode(),
                at: 0,
                timing: p.generation,
            });
        }
    }
    if (stableObjects.length > 0) {
        if (mergeAll) {
            let data = combineAllStableObjects(stableObjects);
            if (!data) {
                return false;
            }
            out.push(data);
        } else {
            let data = combineStableObjects(stableObjects);
            if (!data) {
                return false;
            }
            if (data.length > 1) {
                data = combineStableObjects(data);
                if (!data) {
                    return false;
                }
            }
            for (let obj of data) {
                out.push({
                    type: obj.type,
                    code: obj.code,
                    x: obj.x,
                    y: obj.y,
                })
            }
        }
    }
    return out;
}

// let maxPeriodTable: number[] = [];
// for (let i = 0; i < 1024; i++) {
//     let out = Math.floor(i / c.PERIOD_SECURITY);
//     if (c.MAX_POPULATION_PERIOD !== null) {
//         out = Math.min(out, c.MAX_POPULATION_PERIOD as number);
//     }
//     maxPeriodTable.push(out);
// }

export function stabilize(p: MAPPattern, maxGens: number = maxGenerations): number | 'linear' | null {
    let pops: number[] = [p.population];
    for (let i = 0; i < maxGens; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let pop = p.population;
        // let limit = maxPeriodTable[i];
        // if (limit === undefined) {
        //     limit = Math.floor(maxGens / c.PERIOD_SECURITY);
        // }
        for (let period = 1; period < Math.floor(maxGens / c.PERIOD_SECURITY); period++) {
            let found = true;
            for (let j = 1; j < c.PERIOD_SECURITY; j++) {
                if (pop !== pops[pops.length - period * j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return period;
            }
            if (c.CHECK_LINEAR_GROWTH) {
                let diff = pop - pops[pops.length - period];
                found = true;
                for (let j = 1; j < c.PERIOD_SECURITY; j++) {
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
    return null;
}

export function findOutcome(p: MAPPattern, mergeAll: boolean = false, maxGens?: number): false | 'linear' | CAObject[] {
    let period = stabilize(p, maxGens);
    if (period === 'linear') {
        return 'linear';
    } else if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
        return false;
    }
    p.shrinkToFit();
    return separateObjects(p, period * 4, period * 4, mergeAll);
}
