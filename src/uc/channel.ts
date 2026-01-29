
import * as fs from 'node:fs/promises';
import {MAPPattern, findType} from '../core/index.js';
import {c, log, ChannelInfo, StillLife, Spaceship, base, gliderPatterns, findOutcome, unparseChannelRecipe, getRecipes, saveRecipes} from './base.js';


export function createChannelPattern(info: ChannelInfo, recipe: [number, number][]): false | [MAPPattern, number, number, number] {
    let p = base.copy();
    let total = 0;
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel === -1) {
            continue;
        }
        let y = Math.floor(total / c.GLIDER_PERIOD);
        let x = Math.floor(y * c.GLIDER_SLOPE) + info.channels[channel];
        let q = gliderPatterns[total % c.GLIDER_PERIOD];
        p.ensure(x + q.width, y + q.height);
        p.insert(q, x, y);
        total += timing;
        // if (total % 10 > 5) {
        //     return false;
        // }
    }
    let y = Math.floor(total / c.GLIDER_PERIOD);
    let x = Math.floor(y * c.GLIDER_SLOPE);
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
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


function _getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing?: number, prev?: number): [number, number][][] {
    let out: [number, number][][] = [];
    let limit = maxSpacing ? Math.min(depth, maxSpacing) : depth;
    for (let channel = 0; channel < info.channels.length; channel++) {
        for (let spacing = prev === undefined ? info.minSpacing : info.minSpacings[prev][channel]; spacing <= limit; spacing++) {
            if (prev && info.excludeSpacings?.[prev]?.[channel]?.includes(spacing)) {
                continue;
            }
            let elt: [number, number] = [spacing, channel];
            out.push([elt]);
            if (depth - spacing > info.minSpacing) {
                for (let recipe of _getRecipesForDepth(info, depth - spacing, maxSpacing, channel)) {
                    recipe.unshift(elt);
                    out.push(recipe);
                }
            }
        }
    }
    return out;
}

function getRecipesForDepth(info: ChannelInfo, depth: number, maxSpacing?: number, prev?: number): [number, number][][] {
    if (info.channels.length === 1 || prev) {
        return _getRecipesForDepth(info, depth, maxSpacing, prev);
    } else {
        let out: [number, number][][] = [];
        for (let channel = 0; channel < info.channels.length; channel++) {
            for (let recipe of _getRecipesForDepth(info, depth, maxSpacing, channel)) {
                recipe.unshift([-1, channel]);
                out.push(recipe);
            }
        }
        return out;
    }
}

export async function searchChannel(type: string, depth: number, maxSpacing?: number): Promise<void> {
    let info = c.CHANNEL_INFO[type];
    let recipes = await getRecipes();
    let out = recipes.channels[type];
    let done = new Set<string>();
    let filter: string[] = [];
    while (true) {
        log(`Searching depth ${depth}`, true);
        let recipesToCheck: {recipe: [number, number][], key: string, p: MAPPattern, xPos: number, yPos: number, total: number, time: number}[] = [];
        for (let recipe of getRecipesForDepth(info, depth, maxSpacing, info.forceStart ? info.forceStart[info.forceStart.length - 1][1] : undefined)) {
            let key = recipe.map(x => x[0] + ':' + x[1]).join(' ');
            let time = recipe.map(x => x[0]).filter(x => x !== -1).reduce((x, y) => x + y);
            if (time !== depth) {
                continue;
            }
            if (filter.some(x => key.startsWith(x))) {
                continue;
            }
            if (!done.has(key)) {
                done.add(key);
                if (info.forceStart) {
                    recipe.unshift(...info.forceStart);
                    time += info.forceStart.map(x => x[0]).reduce((x, y) => x + y);
                }
                let data = createChannelPattern(info, recipe);
                if (data) {
                    recipesToCheck.push({recipe, key, p: data[0], xPos: data[1], yPos: data[2], total: data[3], time});
                }
            }
        }
        log(`Checking ${recipesToCheck.length} recipes`, true);
        let possibleUseful = '';
        for (let i = 0; i < recipesToCheck.length; i++) {
            log(`${i - 1}/${recipesToCheck.length} (${((i - 1) / recipesToCheck.length * 100).toFixed(3)}%) recipes checked`);
            let {recipe, key, p, xPos, yPos, total, time} = recipesToCheck[i];
            let strRecipe = unparseChannelRecipe(info, recipe);
            for (let gen = 0; gen < Math.max(total / c.GLIDER_DY, 0); gen++) {
                p.runGeneration();
                p.shrinkToFit();
            }
            let [result, stabilizeTime] = findOutcome(p, xPos, yPos, strRecipe);
            if (result === false) {
                continue;
            }
            if (result === 'linear') {
                possibleUseful += `Linear growth: ${strRecipe}\n`;
                continue;
            }
            recipe.push([stabilizeTime, -1]);
            strRecipe += `, ${stabilizeTime}`;
            let elbow: [StillLife, number] | null = null;
            let shipData: [Spaceship, 'up' | 'down' | 'left' | 'right'] | null = null;
            let hand: StillLife | null = null;
            let found = false;
            if (result.length === 0) {
                possibleUseful += `Destroy: ${strRecipe}\n`;
                filter.push(key + ' ');
            }
            if (result.every(x => x.type === 'ship' || x.type === 'other') && !result.some(x => x.type === 'ship' && x.code === c.GLIDER_APGCODE && !(x.dir.startsWith('N') && !x.dir.startsWith('NE')))) {
                filter.push(key + ' ');
                continue;
            }
            for (let obj of result) {
                if (obj.type === 'sl') {
                    let lane = obj.y - obj.x;
                    let spacing = obj.x + obj.y;
                    if (!elbow && lane === 0) {
                        elbow = [obj, spacing];
                    } else if (!hand && (lane > c.MIN_HAND_SPACING || spacing > c.MIN_HAND_SPACING)) {
                        hand = obj;        
                    } else {
                        found = true;
                        break;
                    }
                } else if (!shipData && obj.type === 'ship' && obj.code === c.GLIDER_APGCODE) {
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
                    if (!c.POSSIBLY_USEFUL_FILTER.includes(obj.code)) {
                        if (obj.type === 'ship'  && obj.code !== c.GLIDER_APGCODE) {
                            possibleUseful += `Creates ${obj.code} (${obj.dir}, lane ${obj.x - obj.y}): ${strRecipe}\n`;
                        } else if (obj.type === 'other' && obj.code.startsWith('xq')) {
                            filter.push(key + ' ');
                            let type = findType(base.loadApgcode(obj.realCode), parseInt(obj.code.slice(2)));
                            if (type.disp) {
                                let lane: number;
                                if (type.disp[0] === 0) {
                                    lane = obj.y;
                                } else if (type.disp[1] === 0) {
                                    lane = obj.x;
                                } else if (Math.sign(type.disp[0]) === Math.sign(type.disp[1])) {
                                    lane = obj.x - obj.y;
                                } else {
                                    lane = obj.x + obj.y;
                                }
                                possibleUseful += `Creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}): ${strRecipe}\n`;
                            } else {
                                possibleUseful += `Creates ${obj.code} (no found displacement): ${strRecipe}\n`;
                            }
                        }
                    }
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
                    possibleUseful += `${ship.code} ${ship.dir} lane ${ship.x - ship.y}: ${strRecipe}\n`;
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
            recipe[recipe.length - 1][0] += move * c.GLIDER_PERIOD / c.GLIDER_DY;
            if (shipData) {
                let [ship, dir] = shipData;
                if (dir === 'up') {
                    continue;
                }
                if (dir === 'down') {
                    let lane = ship.x - ship.y;
                    let entry = out.recipes0Deg.find(x => x[0] === lane && x[1] === move);
                    possibleUseful += `0 degree emit ${lane} move ${move}: ${strRecipe}\n`;
                    if (entry === undefined) {
                        out.recipes0Deg.push([lane, move, recipe]);
                    } else if (entry[2].filter(x => x[1] >= 0).map(x => x[0]).reduce((x, y) => x + y) > time) {
                        entry[2] = recipe;
                    }
                } else {
                    let lane = ship.x + ship.y;
                    let ix = dir === 'right';
                    possibleUseful += `90 degree emit ${lane}${ix ? 'x' : 'i'} move ${move}: ${strRecipe}\n`;
                    let entry = out.recipes90Deg.find(x => x[0] === lane && x[1] === ix && x[2] === move);
                    if (entry === undefined) {
                        out.recipes90Deg.push([lane, ix, move, recipe]);
                    } else if (entry[3].filter(x => x[1] >= 0).map(x => x[0]).reduce((x, y) => x + y) > time) {
                        entry[3] = recipe;
                    }
                }
            } else if (hand) {
                let entry = out.createHandRecipes.find(x => x[0].code === hand.code && x[0].x === hand.x && x[0].y === hand.y && x[1] === move);
                    possibleUseful += `create hand ${hand.code} (${hand.x}, ${hand.y}) move ${move}: ${strRecipe}\n`;
                if (entry === undefined) {
                    out.createHandRecipes.push([hand, move, recipe]);
                } else if (entry[2].filter(x => x[1] >= 0).map(x => x[0]).reduce((x, y) => x + y) > time) {
                    entry[2] = recipe;
                }
            } else {
                if (move === 0) {
                    continue;
                }
                let entry = out.moveRecipes.find(x => x[0] === move);
                if (entry === undefined) {
                    out.moveRecipes.push([move, recipe]);
                } else if (entry[1].filter(x => x[1] >= 0).map(x => x[0]).reduce((x, y) => x + y) > time) {
                    entry[1] = recipe;
                }
            }
        }
        await saveRecipes(recipes);
        if (possibleUseful.length > 0) {
            await fs.appendFile('possible_useful.txt', `\nDepth ${depth}:\n` + possibleUseful);
        }
        depth++;
    }
}
