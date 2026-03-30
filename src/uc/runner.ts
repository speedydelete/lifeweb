
import {lcm, MAPPattern, PatternType, findType, getApgcode, getKnots, INTSeparator} from '../core/index.js';
import {c, base, maxGenerations, StillLife, Oscillator, CAObject} from './base.js';


export type ForCombining = (StillLife | Oscillator) & {p: MAPPattern, bb: [number, number, number, number]};

export function combineStableObjects(objs: ForCombining[]): false | ForCombining[] {
    if (objs.length < 2) {
        return objs;
    }
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
        let p = base.copy();
        p.height = maxY - minY + 1;
        p.width = maxX - minX + 1;
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
            let period = obj.type === 'osc' ? obj.period : 1;
            for (let obj of objs) {
                if (obj.type === 'sl') {
                    continue;
                }
                period = lcm(period, obj.period);
            }
            out.push({
                type: 'osc',
                code: p.toApgcode('xp' + period),
                x: minX + p.xOffset,
                y: minY + p.yOffset,
                period,
                timing: obj.p.generation,
                p,
                bb,
            });
        } else {
            out.push({
                type: 'sl',
                code: p.toApgcode('xs' + p.population),
                x: minX + p.xOffset,
                y: minY + p.yOffset,
                p,
                bb,
            });
        }
    }
    return out;
}

export function combineAllStableObjects(objs: ForCombining[]): false | ForCombining[] {
    if (objs.length < 2) {
        return objs;
    }
    let out: ForCombining[] = [];
    let obj = objs[0];
    let data = objs.slice(1);
    let isOsc = obj.type === 'osc';
    for (let obj of data) {
        isOsc ||= obj.type === 'osc';
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
    let p = base.copy();
    p.height = maxY - minY + 1;
    p.width = maxX - minX + 1;
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
        let period = obj.type === 'osc' ? obj.period : 1;
        for (let obj of objs) {
            if (obj.type === 'sl') {
                continue;
            }
            period = lcm(period, obj.period);
        }
        out.push({
            type: 'osc',
            code: p.toApgcode('xp' + period),
            x: minX + p.xOffset,
            y: minY + p.yOffset,
            period,
            timing: obj.p.generation,
            p,
            bb,
        });
    } else {
        out.push({
            type: 'sl',
            code: p.toApgcode('xs' + p.population),
            x: minX + p.xOffset,
            y: minY + p.yOffset,
            p,
            bb,
        });
    }
    return out;
}


let knots = getKnots(base.trs);

export function separateObjectsPartial(p: MAPPattern, sepGens: number, limit: number): false | [CAObject[], ForCombining[]] {
    if (p.isEmpty()) {
        return [[], []];
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
            let q = p.copy().run(type.period + (type.period - p.generation) % type.period);
            stableObjects.push({
                type: 'osc',
                code: p.toApgcode('xp' + type.period),
                x: p.xOffset,
                y: p.yOffset,
                period: type.period,
                timing: p.generation,
                p,
                bb: [q.xOffset, q.yOffset, q.xOffset + q.width - 1, q.yOffset + q.height - 1],
            });
        } else if (apgcode in c.SPACESHIPS) {
            let data = c.SPACESHIPS[apgcode];
            for (let i = 0; i < data.period; i++) {
                for (let [height, width, pop, cells, dir] of data.identification) {
                    if (p.height === height && p.width === width && p.population === pop && cells.every(x => p.data[x])) {
                        out.push({
                            type: 'ship',
                            code: apgcode,
                            x: p.xOffset,
                            y: p.yOffset,
                            dir,
                            at: 0,
                            timing: p.generation,
                        })
                    }
                }
                p.runGeneration();
                p.shrinkToFit();
            }
            throw new Error(`Invalid spaceship: ${p.toRLE()}`);
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
    return [out, stableObjects];
}

export function separateObjects(p: MAPPattern, sepGens: number, limit: number, combine: boolean = true, combineAll: boolean = false): false | CAObject[] {
    let value = separateObjectsPartial(p, sepGens, limit);
    if (!value) {
        return false;
    }
    let [out, stableObjects] = value;
    if (stableObjects.length > 0) {
        let objs: false | ForCombining[] = [];
        if (combine) {
            let data: false | ForCombining[];
            if (combineAll) {
                data = combineAllStableObjects(stableObjects);
            } else {
                data = combineStableObjects(stableObjects);
            }
            if (!data) {
                return false;
            }
            if (data.length > 1) {
                data = combineStableObjects(data);
                if (!data) {
                    return false;
                }
            }
            objs = data;
        } else {
            objs = stableObjects;
        }
        for (let obj of objs) {
            if (obj.type === 'sl') {
                out.push({
                    type: obj.type,
                    code: obj.code,
                    x: obj.x,
                    y: obj.y,
                });
            } else {
                out.push({
                    type: obj.type,
                    code: obj.code,
                    x: obj.x,
                    y: obj.y,
                    period: obj.period,
                    timing: obj.timing,
                });
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

export function stabilize(p: MAPPattern, isElbow?: boolean): number | 'linear' | null {
    let maxGens = isElbow ? Math.max(maxGenerations, c.ELBOW_MAX_GENERATIONS) : maxGenerations;
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

export function findOutcome(p: MAPPattern, isElbow?: boolean, combine: boolean = true, combineAll: boolean = false): false | 'no stabilize' | 'linear' | CAObject[] {
    let period = stabilize(p, isElbow);
    if (period === 'linear') {
        return 'linear';
    } else if (period === null || (c.VALID_POPULATION_PERIODS && !(c.VALID_POPULATION_PERIODS as number[]).includes(period))) {
        return 'no stabilize';
    }
    p.shrinkToFit();
    let objs = separateObjects(p, period * 4, period * 4, combine, combineAll);
    // if (objs) {
    //     for (let obj of objs) {
    //         if (obj.type === 'osc') {
    //             obj.timing %= obj.period;
    //         }
    //     }
    // }
    return objs;
}
