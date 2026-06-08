
import {Pattern} from '../core/pattern.js';
import {PhaseData} from '../core/minmax.js';
import {Separator} from './separate.js';


/** Base type for all tyypes. */
export interface BaseObjectType<T extends Pattern = Pattern> {
    /** Which category the object belongs to. */
    type: string;
    /** A "representative" phase of the pattern. It should be so that the population sequences can be accurately calculated starting from it. It should be in the "phases" property, and there should be at least (period - 1) entries in that variable after it. */
    p: T;
    /** The X coordinate of the pattern. */
    x: number;
    /** The Y coordinate of the pattern. */
    y: number;
    /** The number of generations it takes to stabilize into its current form. */
    stabilizedAt: number;
}

/** Represents a periodic pattern. */
export interface PeriodicObject<T extends Pattern = Pattern> extends BaseObjectType<T> {
    type: 'periodic';
    /** The X displacement of the object after its period. */
    dx: number;
    /** The Y displacement of the object after its period. */
    dy: number;
    /** The number of generations it takes to go to its original form. */
    period: number;
}

/** Represents an infinite-growth pattern that works by creating other objects. */
export interface CreatingObject<T extends Pattern = Pattern> extends BaseObjectType<T> {
    type: 'creating';
    /** The X displacement of the object after its period. */
    dx: number;
    /** The Y displacement of the object after its period. */
    dy: number;
    /** The number of generations it takes to reappear. */
    period: number;
    /** The outputted objects. The x and y coordinates are for the object in the `p` property after 1 period. */
    output: CAObject[];
}

export type CAObject<T extends Pattern = Pattern> = PeriodicObject<T> | CreatingObject<T>;


/** Internal function, confirms that apparent (in the population sequence) linear growth is actually linear growth. */
function confirmLinear<T extends Pattern>(p: T, popPeriod: number, maxPeriodMul: number, calledByCheckLinear: boolean): CAObject<T> | undefined {
    p = p.copy();
    let startXOffset = p.xOffset;
    let startYOffset = p.yOffset;
    let engine = p.copy();
    let engineData = engine.getData();
    let width = engine.width;
    let height = engine.height;
    for (let i = 0; i < maxPeriodMul; i++) {
        p.run(popPeriod).shrinkToFit();
        let pData = p.getData();
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                // check if the engine is present at the given x and y offset
                let j = 0;
                let k = y * p.width + x;
                let found = true;
                for (let row = 0; row < height; row++) {
                    let engineRow = engineData.slice(j, j + width);
                    let dataRow = pData.slice(k, k + width);
                    if (!engineRow.every((x, i) => !x || x === dataRow[i])) {
                        found = false;
                        break;
                    }
                    j += width;
                    k += p.width;
                }
                // if it is, we have confirmed linear growth
                if (found) {
                    let dx = x + p.xOffset - startXOffset;
                    let dy = y + p.yOffset - startYOffset;
                    let period = i * popPeriod;
                    // if this was called recursively, just return the object
                    if (calledByCheckLinear) {
                        return {type: 'creating', p, x: p.xOffset, y: p.yOffset, stabilizedAt: 0, dx, dy, period, output: []};
                    }
                    // extract the ash pattern
                    let ash = p.copy();
                    let ashData = ash.getData();
                    for (let y2 = 0; y2 < height; y2++) {
                        for (let x2 = 0; x2 < width; x2++) {
                            if (engineData[y2 * width + x2]) {
                                ashData[(y2 + y) * ash.width + (x2 + x)] = 0;
                            }
                        }
                    }
                    ash.setData(ash.height, ash.width, ashData);
                    ash.shrinkToFit();
                    // TODO FINISH THIS
                    // ok now we have to minimize the engine
                    // we have to remove the past emitted objects
                }
            }
        }
    }
}

/** Internal variable for how many population periods have to repeat for linear growth. */
const LINEAR_PERIOD_SECURITY = 16;

/** Internal identification function.
 * @param i The current generation number.
 * @param j The index at which to check for.
 */
function identifyCheck(i: number, j: number, p: Pattern, pop: number, hash: number, maxPeriodMul: number, pops: number[], hashes: number[], phases: Pattern[], calledByCheckLinear: boolean): CAObject | undefined {
    // check for basic periodic objects
    if (hash === hashes[j] && pop === pops[j]) {
        let q = phases[j];
        let disp = p.isEqualWithTranslate(q);
        if (disp) {
            return {type: 'periodic', x: p.xOffset, y: p.yOffset, p, stabilizedAt: j, period: i - j + 1, dx: disp[0], dy: disp[1]};
        }
    }
    // check for linear growth
    for (let period = 1; period < Math.floor((i - j) / LINEAR_PERIOD_SECURITY); period++) {
        let diff = pop - pops[pops.length - period];
        // filter out negative diffs (fuses) and zero diffs (normal periodic patterns)
        if (diff < 1) {
            continue;
        }
        let found = true;
        for (let k = 1; k < LINEAR_PERIOD_SECURITY; k++) {
            if (diff !== pops[pops.length - period * k] - pops[pops.length - period * (k + 1)]) {
                found = false;
                break;
            }
        }
        if (found) {
            let out = confirmLinear(p, period, maxPeriodMul, calledByCheckLinear);
            if (out) {
                return out;
            }
        }
    }
}

/** Performs basic identification of a pattern. More complex analysis is performed by the other functions.
 * @param limit The maximum number of generations to run for.
 * @param acceptStabilized Whether to check for unstable patterns that stabilize into other patterns.
 * @param maxPeriodMul The maximum period multiplication for linear growth detection (for example, C4-symmetric RRG's can have a true period 4 times their given one).
 * @param calledByCheckLinear Internal parameter, do not use.
 */
export function baseIdentify(p: Pattern, limit: number, acceptStabilized: boolean = true, maxPeriodMul: number = 4, calledByCheckLinear: boolean = false): CAObject | undefined {
    p = p.copy().shrinkToFit();
    let phases: Pattern[] = [p.copy()];
    let pops: number[] = [p.population];
    let hashes: number[] = [p.hash32()];
    for (let i = 0; i < limit; i++) {
        p.runGeneration();
        p.shrinkToFit();
        let pop = p.population;
        let hash = p.hash32();
        // special override for empty patterns
        if (pop === 0) {
            for (let j = 0; j < p.rule.period; j++) {
                pops.push(0);
                hashes.push(hash);
                phases.push(p.copy());
            }
            return {type: 'periodic', p, x: p.xOffset, y: p.yOffset, stabilizedAt: i, period: p.rule.period, dx: 0, dy: 0};
        }
        // skip if it's not a multiple of the rule period, so stuff like B0 ships is always counted as an even period
        if ((i + 1) % p.rule.period === 0) {
            for (let j = 0; j <= (acceptStabilized ? i : 0); j += p.rule.period) {
                let out = identifyCheck(i, j, p, pop, hash, maxPeriodMul, pops, hashes, phases, calledByCheckLinear);
                if (out) {
                    return out;
                }
            }
        }
        phases.push(p.copy());
        pops.push(pop);
        hashes.push(hash);
    }
}


/** Performs identification and object separation of a pattern.
 * @param limit The maximum number of generations to run for.
 * @param acceptStabilized Whether to check for unstable patterns that stabilize into other patterns.
 * @param maxPeriodMul The maximum period multiplication for linear growth detection (for example, C4-symmetric RRG's can have a true period 4 times their given one).
 */
export function identify(p: Pattern, limit: number, acceptStabilized: boolean = true, maxPeriodMul: number = 4): CAObject[] | undefined {
    let sep = new Separator(p);
    let gens = 0;
    let step = 1;
    for (let i = 0; i < limit; i++) {
        let objs = sep.getObjects();
        // TODO: implement stuff here
        if (gens + step > limit) {
            return;
        }
        for (let j = 0; j < step; j++) {
            sep.runGeneration();
            sep.resolveKnots();
            sep.shrinkToFit();
            gens++;
        }
        step *= 2;
    }
}
