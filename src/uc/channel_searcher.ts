
import {MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, base, StillLife, Spaceship, unparseChannelRecipe, objectsToString, findOutcome, RecipeData} from './base.js';


export type ChannelRecipeData = {recipe: [number, number][], key: string, p: MAPPattern | string, xPos: number, yPos: number, total: number, time: number}[];

function addObjects(recipe: [number, number][], strRecipe: string, time: number, move: number | null, shipData: [Spaceship, 'up' | 'down' | 'left' | 'right', number] | null, hand: StillLife | null, out: RecipeData['channels'][string]): string | undefined {
    if (move === null) {
        if (shipData) {
            let [ship, dir, timing] = shipData;
            if (dir === 'up') {
                return `${ship.code} ${ship.dir} lane ${ship.x - ship.y}: ${strRecipe}\n`;
            } else if (dir === 'down') {
                let lane = ship.x - ship.y;
                out.recipes0DegDestroy.push({recipe, time, lane, timing});
                return `0 degree emit ${lane} destroy: ${strRecipe}\n`;
            } else {
                let lane = ship.x + ship.y;
                let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
                let entry = out.recipes90Deg.find(x => x.lane === lane && x.ix === ix && x.move === move);
                out.recipes90DegDestroy.push({recipe, time, lane, ix, timing});
                return `90 degree emit ${lane}${ix} destroy: ${strRecipe}\n`;
            }
        } else {
            return;
        }
    }
    if (shipData) {
        let [ship, dir, timing] = shipData;
        if (dir === 'up') {
            return;
        }
        if (dir === 'down') {
            let lane = ship.x - ship.y;
            out.recipes0Deg.push({recipe, time, lane, timing, move});
            return `0 degree emit ${lane} move ${move}: ${strRecipe}\n`;
        } else {
            let lane = ship.x + ship.y;
            let ix: 'i' | 'x' = dir === 'right' ? 'x' : 'i';
            out.recipes90Deg.push({recipe, time, lane, ix, timing, move});
            return `90 degree emit ${lane}${ix} move ${move}: ${strRecipe}\n`;
        }
    } else if (hand) {
        out.createHandRecipes.push({recipe, time, obj: hand, move});
        return `create hand ${hand.code} (${hand.x}, ${hand.y}) move ${move}: ${strRecipe}\n`;
    } else {
        if (move === 0) {
            return;
        }
        out.moveRecipes.push({recipe, time, move});
        return `move ${move}: ${strRecipe}\n`;
    }
}

export function findChannelResults(info: ChannelInfo, recipes: ChannelRecipeData, parentPort?: (typeof import('node:worker_threads'))['parentPort']): [RecipeData['channels'][string], string, string[]] {
    let out: RecipeData['channels'][string] = {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], recipes0DegDestroy: [], recipes90DegDestroy: [], createHandRecipes: []};
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
            } else {
                console.log(`${i - 1}/${recipes.length} (${((i - 1) / recipes.length * 100).toFixed(3)}%) recipes checked`);
            }
        }
        done++;
        let {recipe, key, p, xPos, yPos, total, time} = recipes[i];
        if (typeof p === 'string') {
            p = base.loadApgcode(p).shrinkToFit();
        }
        let strRecipe = unparseChannelRecipe(info, recipe);
        let result = findOutcome(p, xPos, yPos, strRecipe, Math.max(total / c.GLIDER_DY, 0));
        if (result === false) {
            continue;
        }
        if (result === 'linear') {
            possibleUseful += `Linear growth: ${strRecipe}\n`;
            continue;
        }
        let move: number | null = null;
        let shipData: [Spaceship, 'up' | 'down' | 'left' | 'right', number] | null = null;
        let hand: StillLife | null = null;
        let found = false;
        if (result.length === 0) {
            filter.push(key + ' ');
            if (!out.destroyRecipe || out.destroyRecipe.time > time) {
                possibleUseful += `Destroy: ${strRecipe}\n`;
                out.destroyRecipe = {recipe, time};
            }
        }
        if (result.every(x => x.type === 'ship' || x.type === 'other') && !result.some(x => x.type === 'ship' && x.code === c.GLIDER_APGCODE && !(x.dir.startsWith('N') && !x.dir.startsWith('NE')))) {
            filter.push(key + ' ');
            continue;
        }
        for (let obj of result) {
            if (obj.type === 'sl') {
                let lane = obj.y - obj.x;
                let spacing = obj.x + obj.y;
                if (result.length === 1 && (c.RULE as string) === 'B2-ak3y4jn5jy78/S12-k3j4-akn5ir' && ((obj.code === 'xs2_11' && lane === -4) || (obj.code === 'xs2_3' && lane === -3))) {
                    possibleUseful += `Snarkmaker (${obj.code === 'xs2_11' ? 'left' : 'right'}): ${strRecipe}\n`;
                }
                if (move === null && obj.code in info.elbows && info.elbows[obj.code].includes(lane)) {
                    move = spacing;
                } else if (!hand && (lane > info.minHandSpacing || spacing > info.minHandSpacing)) {
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
                shipData = [obj, dir, obj.timing % info.period];
            } else {
                if (info.possiblyUsefulFilter && info.possiblyUsefulFilter.includes(obj.code)) {
                    continue;
                }
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
                found = true;
                break;
            }
        }
        if (found || (shipData && hand)) {
            continue;
        }
        addObjects(recipe, strRecipe, time, move, shipData, hand, out);
    }
    return [out, possibleUseful, filter];
}
