
import {MAPPattern} from '../core/index.js';
import {CAObject, base, findOutcome} from './util.js';
import * as c from './config.js';


export function createSingleChannelPattern(recipe: number[]): [MAPPattern, number, number, number] {
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 2; i >= 0; i--) {
        total += recipe[i];
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE);
        let [height, width, cells] = c.GLIDER_CELLS[total % c.GLIDER_PERIOD];
        p.ensure(x + width, y + height);
        for (let cell of cells) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
    let target = base.loadApgcode(c.START_OBJECT);
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) + c.SINGLE_CHANNEL_LANE - c.LANE_OFFSET + target.height;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos, total];
}

function findSingleChannelResult(recipe: number[]): null | false | true | CAObject[] {
    let [p, xPos, yPos, total] = createSingleChannelPattern(recipe);
    p.run(total * c.GLIDER_PERIOD / c.GLIDER_DY);
    return findOutcome(p, xPos, yPos);
}
