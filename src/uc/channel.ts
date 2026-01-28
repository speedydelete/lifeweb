
import * as fs from 'node:fs/promises';
import {MAPPattern} from '../core/index.js';
import {c, ChannelInfo, StillLife, Spaceship, base, gliderPatterns, findOutcome, unparseChannelRecipe, getRecipes, saveRecipes} from './base.js';


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
                for (let recipe of getRecipesForDepth(info, depth - timing, prev)) {
                    recipe.unshift(elt);
                    out.push(recipe);
                }
            }
        }
    }
    return out;
}

export async function searchChannel(type: string, depth: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await getRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    while (true) {
        console.log(`Searching depth ${depth}`);
        let recipesToCheck = getRecipesForDepth(info, depth);
        console.log(`Checking ${recipesToCheck.length} recipes`);
        let possibleLongRange = '\n';
        for (let recipe of recipesToCheck) {
            let key = recipe.map(x => x[0] + ':' + x[1]).join(' ');
            if (done.has(key)) {
                continue;
            } else {
                done.add(key);
            }
            let [p, xPos, yPos, total] = createChannelPattern(info, recipe);
            p.run(total * c.GLIDER_PERIOD / c.GLIDER_DY);
            let result = findOutcome(p, xPos, yPos);
            if (result === false) {
                continue;
            }
            let elbow: [StillLife, number] | null = null;
            let shipData: [Spaceship, 'up' | 'down' | 'left' | 'right'] | null = null;
            let hand: StillLife | null = null;
            let found = false;
            for (let obj of result) {
                if (obj.type === 'sl') {
                    let lane = obj.x - obj.y;
                    let spacing = obj.x + obj.y;
                    if (!elbow && lane === 0) {
                        elbow = [obj, spacing];
                    } else if (!hand && (lane > c.MIN_HAND_SPACING || spacing > c.MIN_HAND_SPACING)) {
                        hand = obj;        
                    } else {
                        found = true;
                        break;
                    }
                } else if (!shipData && obj.type === 'ship') {
                    let dir: 'up' | 'down' | 'left' | 'right';
                    if (obj.dir.startsWith('N')) {
                        dir = obj.dir.startsWith('NE') ? 'right' : 'up';
                    } else if (obj.dir.startsWith('S')) {
                        dir = obj.dir.startsWith('SW') ? 'left' : 'down';
                    } else {
                        dir = obj.dir.startsWith('W') ? 'left' : 'right';
                    }
                    shipData = [obj, dir];
                } else {
                    found = true;
                    break;
                }
            }
            if (found || (shipData && hand)) {
                continue;
            }
            if (!elbow) {
                if (shipData && (shipData[1] === 'up' || shipData[1] === 'down')) {
                    let ship = shipData[0];
                    if (shipData[1] === 'down' && parseInt(ship.code.slice(1)) <= c.SPEED_LIMIT) {
                        continue;
                    }
                    possibleLongRange += `${ship.dir}, lane ${ship.x - ship.y}: ${unparseChannelRecipe(info, recipe)}`;
                } else {
                    continue;
                }
            }
            if (found || !elbow || (shipData && hand)) {
                continue;
            }
            let laneMap = info.elbows[elbow[0].code];
            if (!laneMap || !(elbow[1] in laneMap)) {
                continue;
            }
            let move = elbow[1] + Number(laneMap[elbow[1]]);
            if (shipData) {
                let [ship, dir] = shipData;
                if (dir === 'up') {
                    continue;
                }
                let lane = ship.x - ship.y;
                if (dir === 'down') {
                    let entry = out.recipes0Deg.find(x => x[0] === lane && x[1] === move);
                    if (entry === undefined) {
                        out.recipes0Deg.push([lane, move, recipe]);
                    } else if (entry[2].length > recipe.length) {
                        entry[2] = recipe;
                    }
                } else {
                    let ix = dir === 'right';
                    let entry = out.recipes90Deg.find(x => x[0] === lane && x[1] === ix && x[2] === move);
                    if (entry === undefined) {
                        out.recipes90Deg.push([lane, ix, move, recipe]);
                    } else if (entry[3].length > recipe.length) {
                        entry[3] = recipe;
                    }
                }
            } else if (hand) {
                let entry = out.createHandRecipes.find(x => x[0].code === hand.code && x[0].x === hand.x && x[0].y === hand.y && x[1] === move);
                if (entry === undefined) {
                    out.createHandRecipes.push([hand, move, recipe]);
                } else if (entry[2].length > recipe.length) {
                    entry[2] = recipe;
                }
            } else {
                if (move === 0) {
                    continue;
                }
                let entry = out.moveRecipes.find(x => x[0] === move);
                if (entry === undefined) {
                    out.moveRecipes.push([move, recipe]);
                } else if (entry[1].length > recipe.length) {
                    entry[1] = recipe;
                }
            }
        }
        await saveRecipes(recipes);
        if (possibleLongRange.length > 1) {
            await fs.appendFile('possible_long_range.txt', possibleLongRange + '\n');
        }
        depth++;
    }
}
