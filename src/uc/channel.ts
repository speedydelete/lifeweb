
import {MAPPattern} from '../core/index.js';
import {c, ChannelInfo, StillLife, Spaceship, CAObject, base, gliderPatterns, findOutcome, getRecipes, saveRecipes} from './base.js';


export function createChannelPattern(info: ChannelInfo, recipe: [number, number][]): [MAPPattern, number, number, number] {
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 1; i >= 0; i--) {
        let [timing, channel] = recipe[i];
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.channels[channel];
        let q = gliderPatterns[total % c.GLIDER_PERIOD];
        p.ensure(x + q.width, y + q.height);
        p.insert(q, x, y);
        total += timing;
    }
    let y = Math.floor(total / c.GLIDER_PERIOD);
    let x = Math.floor(y * c.GLIDER_SLOPE);
    let q = gliderPatterns[total % c.GLIDER_PERIOD];
    p.ensure(x + q.width, y + q.height);
    p.insert(q, x, y);
    let target = base.loadApgcode(info.start[0]).shrinkToFit();
    let yPos = Math.floor(total / c.GLIDER_PERIOD) + c.GLIDER_TARGET_SPACING;
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) + info.start[1] + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos, total];
}


function getRecipesForDepth(info: ChannelInfo, depth: number, prev?: number): [number, number][][] {
    let out: [number, number][][] = [];
    for (let channel = 0; channel < info.channels.length; channel++) {
        for (let timing = prev === undefined ? 0 : info.minSpacings[prev][channel]; timing < depth; timing++) {
            let elt: [number, number] = [timing, channel];
            out.push([elt]);
            if (depth - timing > info.minSpacing) {
                let data = getRecipesForDepth(info, depth - timing, prev);
                for (let recipe of getRecipesForDepth(info, depth - timing, prev)) {
                    recipe.unshift(elt);
                    data.push(recipe);
                }
            }
        }
    }
    return out;
}

export async function searchChannel(info: ChannelInfo, depth: number): Promise<void> {
    let recipes = await getRecipes();
    let done = new Set<string>();
    while (true) {
        console.log(`Searching depth ${depth}`);
        let recipes = getRecipesForDepth(info, depth);
        console.log(`Checking ${recipes.length} recipes`);
        for (let recipe of recipes) {
            let [p, xPos, yPos, total] = createChannelPattern(info, recipe);
            p.run(total * c.GLIDER_PERIOD / c.GLIDER_DY);
            let result = findOutcome(p, xPos, yPos);
            if (result === false) {
                continue;
            }
            let elbow: [StillLife, number] | null = null;
            let hand: StillLife | null = null;
            let ship: Spaceship | null = null;
            let found = false;
            for (let obj of result) {
                if (obj.type === 'sl') {
                    let lane = obj.x - obj.y;
                    let spacing = obj.x + obj.y;
                    if (!elbow && lane === 0) {
                        elbow = [obj, lane];
                    } else if (!hand && (lane > c.MIN_HAND_SPACING || spacing > c.MIN_HAND_SPACING)) {
                        hand = obj;        
                    } else {
                        found = true;
                        break;
                    }
                } else if (!ship && obj.type === 'ship') {
                    ship = obj;
                } else {
                    found = true;
                    break;
                }
            }
            if (found || !elbow || (hand && ship)) {
                continue;
            }
            let laneMap = info.elbows[elbow[0].code];
            if (!laneMap || !(elbow[1] in laneMap)) {
                continue;
            }
        }
        depth++;
    }
}
