
import {MAPPattern, findType} from '../core/index.js';
import {c, base, StillLife, Spaceship, ChannelInfo, RecipeData, findOutcome, unparseChannelRecipe} from './base.js';


export type ChannelRecipeData = {recipe: [number, number][], key: string, p: MAPPattern | string, xPos: number, yPos: number, total: number, time: number}[];

export function findChannelResults(info: ChannelInfo, recipes: ChannelRecipeData, out: RecipeData['channels'][string], parentPort?: (typeof import('node:worker_threads'))['parentPort'], log?: (data: string) => void): [string, string[]] {
    let possibleUseful = '';
    let filter: string[] = [];
    let lastUpdate = performance.now();
    let done = 0;
    for (let i = 0; i < recipes.length; i++) {
        let now = performance.now();
        if (now - lastUpdate > 1000) {
            lastUpdate = now;
            if (parentPort) {
                parentPort.postMessage(done);
                done = 0;
            }
            if (log) {
                log(`${i - 1}/${recipes.length} (${((i - 1) / recipes.length * 100).toFixed(3)}%) recipes checked`);
            }
        }
        done++;
        let {recipe, key, p, xPos, yPos, total, time} = recipes[i];
        if (typeof p === 'string') {
            p = base.loadApgcode(p).shrinkToFit();
        }
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
        time += Math.max(stabilizeTime, info.minSpacing);
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
                if (result.length === 1 && (obj.code === 'xs2_11' && lane === -4) || (obj.code === 'xs2_3' && lane === 3)) {
                    possibleUseful += `Snarkmaker (${obj.code === 'xs2_11' ? 'left' : 'right'}): ${strRecipe}\n`;
                }
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
                            possibleUseful += `Creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${strRecipe}\n`;
                        } else {
                            possibleUseful += `Creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${strRecipe}\n`;
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
                let entry = out.recipes0Deg.find(x => x.lane === lane && x.move === move);
                possibleUseful += `0 degree emit ${lane} move ${move}: ${strRecipe}\n`;
                if (entry === undefined) {
                    out.recipes0Deg.push({recipe, time, lane, move});
                } else if (entry.time > time) {
                    entry.recipe = recipe;
                    entry.time = time;
                }
            } else {
                let lane = ship.x + ship.y;
                let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
                possibleUseful += `90 degree emit ${lane}${ix} move ${move}: ${strRecipe}\n`;
                let entry = out.recipes90Deg.find(x => x.lane === lane && x.ix === ix && x.move === move);
                if (entry === undefined) {
                    out.recipes90Deg.push({recipe, time, lane, ix, move});
                } else if (entry.time > time) {
                    entry.recipe = recipe;
                    entry.time = time;
                }
            }
        } else if (hand) {
            let entry = out.createHandRecipes.find(x => x.obj.code === hand.code && x.obj.x === hand.x && x.obj.y === hand.y && x.move === move);
                possibleUseful += `create hand ${hand.code} (${hand.x}, ${hand.y}) move ${move}: ${strRecipe}\n`;
            if (entry === undefined) {
                out.createHandRecipes.push({recipe, time, obj: hand, move});
            } else if (entry.time > time) {
                entry.recipe = recipe;
                entry.time = time;
            }
        } else {
            if (move === 0) {
                continue;
            }
            let entry = out.moveRecipes.find(x => x.move === move);
            if (entry === undefined) {
                out.moveRecipes.push({recipe, time, move});
            } else if (entry.time > time) {
                entry.recipe = recipe;
                entry.time = time;
            }
        }
    }
    return [possibleUseful, filter];
}
