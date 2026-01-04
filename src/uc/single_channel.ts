
import {MAPPattern, identify, INTSeparator, getKnots} from '../core/index.js';
import {StillLife, Spaceship, CAObject, getRecipes, saveRecipes, base} from './config.js';
import * as c from './config.js';


export function createSingleChannelPattern(recipe: number[]): MAPPattern {
    let p = base.copy();
    for (let i = 0; i < recipe.length; i++) {
        let y = i * c.GLIDER_SPACING;
        let x = Math.floor(y * c.GLIDER_SLOPE) + lane - minLane;
        p.ensure(x + c.GLIDER_WIDTH, y + c.GLIDER_HEIGHT);
        for (let cell of c.GLIDER_CELLS) {
            p.set(x + cell[0], y + cell[1], 1);
        }
    }
}

