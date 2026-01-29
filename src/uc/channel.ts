
import * as fs from 'node:fs/promises';
import {MAPPattern} from '../core/index.js';
import {c, log, ChannelInfo, StillLife, Spaceship, base, gliderPatterns, findOutcome, unparseChannelRecipe, getRecipes, saveRecipes} from './base.js';


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
    let xPos = Math.floor(yPos * c.GLIDER_SLOPE) - info.start[1] + c.LANE_OFFSET;
    p.ensure(target.width + xPos, target.height + yPos);
    p.insert(target, xPos, yPos);
    p.shrinkToFit();
    return [p, xPos, yPos, total + c.GLIDER_TARGET_SPACING];
}


function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing?: number, prev?: number): [number, number][][] {
    let out: [number, number][][] = [];
    let limit = maxSpacing ? Math.min(depth, maxSpacing + 1) : depth;
    for (let channel = 0; channel < info.channels.length; channel++) {
        for (let spacing = prev === undefined ? info.minSpacing : info.minSpacings[prev][channel]; spacing < limit; spacing++) {
            if (prev && info.excludeSpacings?.[prev]?.[channel]?.includes(spacing)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            out.push([elt]);
            if (depth - spacing > info.minSpacing) {
                for (let recipe of getRecipesForDepth(info, depth - spacing, maxSpacing, prev)) {
                    recipe.unshift(elt);
                    out.push(recipe);
                }
            }
        }
    }
    return out;
}

export async function searchChannel(type: string, depth: number, maxSpacing?: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await getRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    while (true) {
        log(`Searching depth ${depth}`, true);
        let recipesToCheck: [number, number][][] = [];
        for (let recipe of getRecipesForDepth(info, depth, maxSpacing, info.forceStart ? info.forceStart[info.forceStart.length - 1][1] : undefined)) {
            let key = recipe.map(x => x[0] + ':' + x[1]).join(' ');
            if (!done.has(key)) {
                done.add(key);
                if (info.forceStart) {
                    recipe.unshift(...info.forceStart);
                }
                recipesToCheck.push(recipe);
            }
        }
        log(`Checking ${recipesToCheck.length} recipes`, true);
        let possibleUseful = '\n';
        for (let i = 0; i < recipesToCheck.length; i++) {
            log(`${i - 1} out of ${recipesToCheck.length} (${((i - 1) / recipesToCheck.length * 100).toFixed(1)}%) recipes checked`);
            let recipe = recipesToCheck[i];
            let time = recipe.map(x => x[0]).reduce((x, y) => x + y);
            let [p, xPos, yPos, total] = createChannelPattern(info, recipe);
            p.run(total * c.GLIDER_PERIOD / c.GLIDER_DY);
            let result = findOutcome(p, xPos, yPos, unparseChannelRecipe(info, recipe));
            if (result === false) {
                continue;
            }
            let elbow: [StillLife, number] | null = null;
            let shipData: [Spaceship, 'up' | 'down' | 'left' | 'right'] | null = null;
            let hand: StillLife | null = null;
            let found = false;
            if (result.length === 0) {
                possibleUseful += `Destroy: ${unparseChannelRecipe(info, recipe)}\n`;
            }
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
                    if (shipData[1] === 'down' && parseInt(ship.code.slice(2)) <= c.SPEED_LIMIT) {
                        continue;
                    }
                    possibleUseful += `${ship.code} ${ship.dir} lane ${ship.x - ship.y}: ${unparseChannelRecipe(info, recipe)}\n`;
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
                if (dir === 'down') {
                    let lane = ship.x - ship.y;
                    let entry = out.recipes0Deg.find(x => x[0] === lane && x[1] === move);
                    if (entry === undefined) {
                        out.recipes0Deg.push([lane, move, recipe]);
                    } else if (entry[2].map(x => x[0]).reduce((x, y) => x + y) > time) {
                        entry[2] = recipe;
                    }
                } else {
                    let lane = ship.x + ship.y;
                    let ix = dir === 'right';
                    let entry = out.recipes90Deg.find(x => x[0] === lane && x[1] === ix && x[2] === move);
                    if (entry === undefined) {
                        out.recipes90Deg.push([lane, ix, move, recipe]);
                    } else if (entry[3].map(x => x[0]).reduce((x, y) => x + y) > time) {
                        entry[3] = recipe;
                    }
                }
            } else if (hand) {
                let entry = out.createHandRecipes.find(x => x[0].code === hand.code && x[0].x === hand.x && x[0].y === hand.y && x[1] === move);
                if (entry === undefined) {
                    out.createHandRecipes.push([hand, move, recipe]);
                } else if (entry[2].map(x => x[0]).reduce((x, y) => x + y) > time) {
                    entry[2] = recipe;
                }
            } else {
                if (move === 0) {
                    continue;
                }
                let entry = out.moveRecipes.find(x => x[0] === move);
                if (entry === undefined) {
                    out.moveRecipes.push([move, recipe]);
                } else if (entry[1].map(x => x[0]).reduce((x, y) => x + y) > time) {
                    entry[1] = recipe;
                }
            }
        }
        await saveRecipes(recipes);
        if (possibleUseful.length > 1) {
            await fs.appendFile('possible_useful.txt', possibleUseful);
        }
        depth++;
    }
}
