
import {MAPPattern} from '../core/index.js';
import {c, CAObject, base, gliderPatterns, findOutcome} from './base.js';


const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

export function parseChannelRecipe(data: string): [number, number][] {
    let out: [number, number][] = [];
    for (let part of data.split(/[, ]/)) {
        part = part.trim();
        if (part === '') {
            continue;
        }
        let timing = parseInt(part);
        let end = part[part.length - 1];
        let index = LETTERS.indexOf(end);
        if (index === -1) {
            out.push([timing, 0]);
        } else {
            out.push([timing, index]);
        }
    }
    return out;
}

export function unparseChannelRecipe(type: string, data: [number, number][]): string {
    if (c.CHANNEL_INFO[type].lanes.length === 1) {
        return data.map(x => x[0]).join(', ');
    } else {
        return data.map(x => x[0] + LETTERS[x[1]]).join(', ');
    }
}

export function createChannelPattern(type: string, recipe: [number, number][]): [MAPPattern, number, number, number] {
    let info = c.CHANNEL_INFO[type];
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 2; i >= 0; i--) {
        let [timing, channel] = recipe[i];
        total += timing;
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.lanes[channel];
        let q = gliderPatterns[total % c.GLIDER_PERIOD];
        p.ensure(x + q.width, y + q.height);
        p.insert(q, x, y);
    }
    let target = base.loadApgcode(info.start[0]);
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) + info.start[1] - c.LANE_OFFSET + target.height;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos, total];
}


function findChannelResult(type: string, recipe: [number, number][]): null | false | true | CAObject[] {
    let [p, xPos, yPos, total] = createChannelPattern(type, recipe);
    p.run(total * c.GLIDER_PERIOD / c.GLIDER_DY);
    return findOutcome(p, xPos, yPos);
}
