
import {lcm, MAPPattern, findType} from '../core/index.js';
import {c, ChannelInfo, ShipDirection, maxGenerations, setMaxGenerations, base, shipPatterns, channelRecipeToString, StableObject, Spaceship, CAObject, normalizeOscillator, objectsToString, ShipInfo, getShipInfo, ElbowData, ChannelRecipe, channelRecipeInfoToString} from './base.js';
import {separateObjectsPartial, findOutcome} from './runner.js';
import {getCollision} from './slow_salvos.js';


export type GliderDirection = 'NW' | 'NE' | 'SW' | 'SE';

// const GLIDERS_HORIZONTAL: {[key: number]: [GliderDirection, number]} = {
//     0b110_101_100_000000: ['NW', 0],
//     0b011_110_001_000000: ['NW', 3],
//     0b111_100_010_000000: ['NW', 2],
//     0b010_110_101_000000: ['NW', 1],
//     0b010_100_111_000000: ['NE', 0],
//     0b101_110_010_000000: ['NE', 3],
//     0b100_101_110_000000: ['NE', 2],
//     0b001_110_011_000000: ['NE', 1],
//     0b111_001_010_000000: ['SW', 0],
//     0b010_011_101_000000: ['SW', 3],
//     0b011_101_001_000000: ['SW', 2],
//     0b110_011_100_000000: ['SW', 1],
//     0b001_101_011_000000: ['SE', 0],
//     0b100_011_110_000000: ['SE', 3],
//     0b010_001_111_000000: ['SE', 2],
//     0b101_011_010_000000: ['SE', 1],
// };

// const GLIDERS_VERTICAL: {[key: number]: [GliderDirection, number]} = {
//     0b111_100_010_000000: ['NW', 0],
//     0b010_110_101_000000: ['NW', 3],
//     0b110_101_100_000000: ['NW', 2],
//     0b011_110_001_000000: ['NW', 1],
//     0b011_101_001_000000: ['NE', 0],
//     0b110_011_100_000000: ['NE', 3],
//     0b111_001_010_000000: ['NE', 2],
//     0b010_011_101_000000: ['NE', 1],
//     0b100_101_110_000000: ['SW', 0],
//     0b001_110_011_000000: ['SW', 3],
//     0b010_100_111_000000: ['SW', 2],
//     0b101_110_010_000000: ['SW', 1],
//     0b010_001_111_000000: ['SE', 0],
//     0b101_011_010_000000: ['SE', 3],
//     0b001_101_011_000000: ['SE', 2],
//     0b100_011_110_000000: ['SE', 1],
// };

// function extractGlider(p: MAPPattern, x: number, y: number, dir: GliderDirection): false | [MAPPattern, Spaceship] {
//     let height = p.height;
//     let width = p.width;
//     let data = p.data;
//     // we first check if every cell within 2 rows of the glider is empty
//     if (x > 0) {
//         // (-1, 0), (-1, 1), (-1, 2)
//         if (data[y * width + x - 1] || data[(y + 1) * width + x - 1] || data[(y + 2) * width + x - 1]) {
//             return false;
//         }
//         if (y > 0) {
//             // (-1, -1)
//             if (data[(y - 1) * width + x - 1]) {
//                 return false;
//             }
//             // (-1, -2)
//             if (y > 1 && data[(y - 2) * width + x - 1]) {
//                 return false;
//             }
//         }
//         if (x > 1) {
//             // (-2, 0), (-2, 1), (-2, 2)
//             if (data[y * width + x - 2] || data[(y + 1) * width + x - 2] || data[(y + 2) * width + x - 2]) {
//                 return false;
//             }
//             if (y > 0) {
//                 // (-2, -1)
//                 if (data[(y - 1) * width + x - 2]) {
//                     return false;
//                 }
//                 // (-2, -2)
//                 if (y > 1 && data[(y - 2) * width + x - 2]) {
//                     return false;
//                 }
//             }
//         }
//     }
//     if (x < width - 3) {
//         // (3, 0), (3, 1), (3, 2)
//         if (data[y * width + x + 3] || data[(y + 1) * width + x + 3] || data[(y + 2) * width + x + 3]) {
//             return false;
//         }
//         if (y > 0) {
//             // (3, -1)
//             if (data[(y - 1) * width + x + 3]) {
//                 return false;
//             }
//             // (3, -2)
//             if (y > 1 && data[(y - 2) * width + x + 3]) {
//                 return false;
//             }
//         }
//         if (x < width - 4) {
//             // (4, 0), (4, 1), (4, 2)
//             if (data[y * width + x + 4] || data[(y + 1) * width + x + 4] || data[(y + 2) * width + x + 4]) {
//                 return false;
//             }
//             if (y > 0) {
//                 // (4, -1)
//                 if (data[(y - 1) * width + x - 2]) {
//                     return false;
//                 }
//                 // (4, -2)
//                 if (y > 1 && data[(y - 2) * width + x - 2]) {
//                     return false;
//                 }
//             }
//         }
//     }
//     if (y > 0) {
//         // (-1, 0), (-1, 1), (-1, 2)
//         if (data[(y - 1) * width + x] || data[(y - 1) * width + x + 1] || data[(y - 1) * width + x + 2]) {
//             return false;
//         }
//         if (y > 1) {
//             // (-2, 0), (-2, 1), (-2, 2)
//             if (data[(y - 2) * width + x] || data[(y - 2) * width + x + 1] || data[(y - 2) * width + x + 2]) {
//                 return false;
//             }
//         }
//     }
//     if (y < width - 3) {
//         // (3, 0), (3, 1), (3, 2)
//         if (data[(y + 3) * width + x] || data[(y + 3) * width + x + 1] || data[(y + 3) * width + x + 2]) {
//             return false;
//         }
//         if (y < width - 4) {
//             // (4, 0), (4, 1), (4, 2)
//             if (data[(y + 4) * width + x] || data[(y + 4) * width + x + 1] || data[(y + 4) * width + x + 2]) {
//                 return false;
//             }
//         }
//     }
//     // we now check if it has actually escaped
//     // a pattern's bounding diamond is bounded by 4 slope-1 lines where they have points that are the min/max x + y (or  x - y) live cells
//     // however we only need to check 1 of these to see if it has escaped
//     // if it's more than 3 cells away from it, then it has in fact escaped, because nothing can travel faster than c/4d
//     let q = p.copy();
//     let glider = p.copyPart(x, y, 3, 3);
//     glider.xOffset = 0;
//     glider.yOffset = 0;
//     q.insertXor(glider, x, y);
//     q.shrinkToFit();
//     height = q.height;
//     width = q.width;
//     data = q.data;
//     if (dir === 'NW') {
//         let gliderPoint = (x + 6) + (y + 6);
//         let found = false;
//         for (let i = 0; i < width; i++) {
//             let x = i;
//             let y = 0;
//             for (let j = 0; j <= i; j++) {
//                 y++
//                 x--;
//                 if (data[y * width + x]) {
//                     if (gliderPoint >= x + y) {
//                         return false;
//                     }
//                     found = true;
//                     break;
//                 }
//             }
//             if (found) {
//                 break;
//             }
//         }
//     } else if (dir === 'SW') {
//         let gliderPoint = (x - 3) + (y - 3);
//         let found = false;
//         for (let i = height - 1; i >= 0; i--) {
//             let x = width - 1;
//             let y = i;
//             for (let j = 0; j <= i; j++) {
//                 y++;
//                 x--;
//                 if (data[y * width + x]) {
//                     if (gliderPoint <= x + y) {
//                         return false;
//                     }
//                     found = true;
//                     break;
//                 }
//             }
//             if (found) {
//                 break;
//             }
//         }
//     }
// }

// function removeEscapedGlider(p: MAPPattern): false | [MAPPattern, Spaceship] {
//     let height = p.height;
//     let width = p.width;
//     let width2 = width * 2;
//     let data = p.data;
//     // top and bottom
//     let tr1 = 0;
//     let tr2 = 0;
//     let i = 0;
//     let j = p.size - width;
//     while (i < 5) {
//         tr1 = (tr1 << 3) | (data[i] << 2) | (data[i + width] << 1) | (data[i + width2] << 1);
//         tr2 = (tr2 << 3) | (data[j - width2] << 2) | (data[j - width] << 1) | (data[j] << 1);
//         i++;
//         j++;
//     }
//     if (tr1 in GLIDERS_HORIZONTAL) {
//         return extractGlider(p, 0, 0, GLIDERS_HORIZONTAL[tr1][0]);
//     }
//     if (tr2 in GLIDERS_HORIZONTAL) {
//         return extractGlider(p, 0, height - 3, GLIDERS_HORIZONTAL[tr2][0]);
//     }
//     while (i < width - 5) {
//         tr1 = ((tr1 << 3) & 32767) | (data[i] << 2) | (data[i + width] << 1) | (data[i + width2] << 1);
//         tr2 = (tr2 << 3) | (data[j - width2] << 2) | (data[j - width] << 1) | (data[j] << 1);
//         if (tr1 in GLIDERS_HORIZONTAL) {
//             return extractGlider(p, i - 4, 0, GLIDERS_HORIZONTAL[tr1][0]);
//         }
//         if (tr2 in GLIDERS_HORIZONTAL) {
//             return extractGlider(p, j - 4, height - 3, GLIDERS_HORIZONTAL[tr2][0]);
//         }
//         i++;
//         j++;
//     }
//     while (i < width) {
//         tr1 = ((tr1 << 3) & 32767);
//         tr2 = ((tr2 << 3) & 32767);
//         if (tr1 in GLIDERS_HORIZONTAL) {
//             return extractGlider(p, i - 4, 0, GLIDERS_HORIZONTAL[tr1][0]);
//         }
//         if (tr2 in GLIDERS_HORIZONTAL) {
//             return extractGlider(p, j - 4, height - 3, GLIDERS_HORIZONTAL[tr2][0]);
//         }
//         i++;
//         j++;
//     }
//     // left and right
//     tr1 = 0;
//     tr2 = 0;
//     let y = 0;
//     i = 0;
//     j = width - 1;
//     while (y < 5) {
//         tr1 = (tr1 << 3) | (data[i] << 2) | (data[i + 1] << 2) | data[i + 2];
//         tr2 = (tr2 << 3) | (data[j - 2] << 2) | (data[j - 1] << 2) | data[j];
//         y++;
//         i += width;
//         j += width;
//     }
//     if (tr1 in GLIDERS_VERTICAL) {
//         return extractGlider(p, 0, 0, GLIDERS_VERTICAL[tr1][0]);
//     }
//     if (tr2 in GLIDERS_VERTICAL) {
//         return extractGlider(p, width - 3, 0, GLIDERS_VERTICAL[tr2][0]);
//     }
//     while (y < height - 5) {
//         tr1 = ((tr1 << 3) & 32767) | (data[i] << 2) | (data[i + 1] << 2) | data[i + 2];
//         tr2 = ((tr1 << 3) & 32767) | (data[j - 2] << 2) | (data[j - 1] << 2) | data[j];
//         if (tr1 in GLIDERS_VERTICAL) {
//             return extractGlider(p, 0, y - 4, GLIDERS_VERTICAL[tr1][0]);
//         }
//         if (tr2 in GLIDERS_VERTICAL) {
//             return extractGlider(p, width - 3, y - 4, GLIDERS_VERTICAL[tr2][0]);
//         }
//         y++;
//         i += width;
//         j += width;
//     }
//     while (y < height) {
//         tr1 = ((tr1 << 3) & 32767);
//         tr2 = ((tr1 << 3) & 32767);
//         if (tr1 in GLIDERS_VERTICAL) {
//             return extractGlider(p, 0, y - 4, GLIDERS_VERTICAL[tr1][0]);
//         }
//         if (tr2 in GLIDERS_VERTICAL) {
//             return extractGlider(p, width - 3, y - 4, GLIDERS_VERTICAL[tr2][0]);
//         }
//         y++;
//         i += width;
//         j += width;
//     }
//     return false;
// }


export function runInjection(info: ChannelInfo, elbow: [string, number], elbowTiming: number, recipe: [number, number][], override?: [MAPPattern, number], doFinal: boolean = true): MAPPattern {
    let phaseOffset = 0;
    for (let [spacing] of recipe) {
        phaseOffset += spacing;
    }
    phaseOffset = (info.ship.period - (phaseOffset % info.ship.period)) % info.ship.period;
    let gliders: MAPPattern[] = [];
    let total = 0;
    let timingOffset = elbowTiming;
    while (recipe.length > 0 && recipe[0][1] === -2) {
        timingOffset += recipe[0][0];
        recipe.shift();
    }
    for (let i = recipe.length - 1; i >= (info.channels.length === 1 ? 0 : 1); i--) {
        let [timing, channel] = recipe[i];
        if (channel < 0) {
            if (channel === -2) {
                total += timing;
            }
            continue;
        }
        if (override && i < recipe.length - override[1]) {
            total += timing;
            continue;
        }
        let y = Math.floor(total * info.ship.dy / info.ship.period);
        if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
            y++;
        }
        let x = Math.floor(y * info.ship.slope) + info.channels[channel];
        let p = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period].copy();
        p.xOffset += x;
        p.yOffset += y;
        gliders.push(p);
        total += timing;
    }
    if (override) {
        total -= override[0].generation;
    }
    let y = Math.floor(total * info.ship.dy / info.ship.period) + c.GLIDER_TARGET_SPACING;
    let x = Math.floor(y * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
    if (info.channels.length > 1) {
        x += info.channels[recipe[0][1]];
    }
    for (let glider of gliders) {
        glider.xOffset -= x;
        glider.yOffset -= y;
    }
    let p: MAPPattern;
    if (override) {
        p = override[0];
    } else {
        p = base.loadApgcode(elbow[0].slice(elbow[0].indexOf('_') + 1)).shrinkToFit();
        let yPos = c.GLIDER_TARGET_SPACING;
        if ((total % info.ship.period) + phaseOffset >= info.ship.period) {
            yPos--;
        }
        let xPos = Math.floor(yPos * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
        let change = 0;
        while (xPos < 0 || yPos < 0) {
            xPos++;
            yPos++;
            change++;
        }
        for (let glider of gliders) {
            glider.xOffset -= change;
            glider.yOffset -= change;
        }
        if (timingOffset > 0) {
            p.run(timingOffset).shrinkToFit();
            for (let glider of gliders) {
                glider.xOffset -= p.xOffset;
                glider.yOffset -= p.yOffset;
            }
            xPos += p.xOffset;
            yPos += p.yOffset;
            p.xOffset = 0;
            p.yOffset = 0;
            p.generation = 0;
        }
        p.offsetBy(xPos, yPos);
        let toInsert = shipPatterns[info.ship.code][(total + phaseOffset) % info.ship.period];
        p.ensure(toInsert.width, toInsert.height);
        p.insert(toInsert, 0, 0);
    }
    total += c.GLIDER_TARGET_SPACING;
    let i = 0;
    while (gliders.length > 0) {
        for (let g of gliders) {
            g.runGeneration();
            g.shrinkToFit();
        }
        p.runGeneration();
        p.shrinkToFit();
        while (gliders.length > 0) {
            let last = gliders[gliders.length - 1];
            let xDiff = p.xOffset - last.xOffset;
            let yDiff = p.yOffset - last.yOffset;
            if (xDiff - last.width < 3 || yDiff - last.height < 3 || ((xDiff < last.width + 3) && (yDiff < last.height + 3)) || (xDiff + p.width <= last.width) || (yDiff + p.height <= last.height)) {
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
                if (elbow[0] === 'ggg07zy0ey633') {
                    console.log(p.toRLE());
                }
            } else {
                break;
            }
        }
        i++;
        if (i > total + maxGenerations) {
            while (gliders.length > 0) {
                let last = gliders[gliders.length - 1];
                let xDiff = p.xOffset - last.xOffset;
                let yDiff = p.yOffset - last.yOffset;
                p.offsetBy(xDiff, yDiff);
                p.insert(last, 0, 0);
                gliders.pop();
            }
            break;
        }
    }
    if (doFinal) {
        let prevPop = p.population;
        for (let i = 0; i < 256; i++) {
            p.run(info.ship.popPeriod);
            let pop = p.population;
            if (pop !== prevPop) {
                return p;
            }
            prevPop = pop;
        }
    }
    return p;
}


export interface RunState {
    p: MAPPattern;
    elbow: [string, number, number];
    recipe: [number, number, number][];
    time: number;
    startX: number;
    startY: number;
    gliders?: Spaceship[];
}

export interface StrRunState {
    p: string;
    xOffset: number;
    yOffset: number;
    generation: number;
    elbow: [string, number, number];
    recipe: [number, number, number][];
    time: number;
    startX: number;
    startY: number;
    gliders?: Spaceship[];
}

export function createState(info: ChannelInfo, elbow: [string, number, number]): RunState {
    let p = base.loadApgcode(elbow[0].slice(elbow[0].indexOf('_') + 1)).shrinkToFit();
    let yPos = c.GLIDER_TARGET_SPACING;
    let timing = elbow[2];
    if (timing > info.ship.period) {
        let mod = timing % info.ship.period;
        yPos += (timing - (info.ship.period - mod)) / info.ship.period + 1;
        timing = mod;
    }
    while (timing > info.ship.period) {
        yPos++;
        timing -= info.ship.period;
    }
    let xPos = Math.floor(yPos * info.ship.slope) - elbow[1] + c.LANE_OFFSET;
    p.offsetBy(Math.max(xPos, 0), Math.max(yPos, 0));
    let toInsert = shipPatterns[info.ship.code][timing];
    p.ensure(toInsert.width, toInsert.height);
    let startX = Math.max(-xPos, 0);
    let startY = Math.max(-yPos, 0);
    p.insert(toInsert, startX, startY);
    startX += p.xOffset;
    startY += p.yOffset;
    p.xOffset = startX;
    p.yOffset = startY;
    return {p, elbow, recipe: [], time: 0, startX, startY};
}

function runState(info: ChannelInfo, state: RunState, nextGlider: number, channel: number, injected: boolean = false, subtractTime: boolean = true): RunState {
    // console.log(Object.assign({}, state, {p: undefined}));
    let p = state.p.copy();
    for (let i = 0; i < c.MAX_CHANNEL_RUN_GENERATIONS; i++) {
        let timing = p.generation - (subtractTime ? state.time : 0) - (injected ? info.minSpacing + nextGlider : nextGlider);
        let mod = timing % info.ship.period;
        if (mod < 0) {
            mod += info.ship.period;
        }
        let q = shipPatterns[info.ship.code][mod];
        let dist = (timing - mod) / info.ship.period;
        let x = state.startX + dist * info.ship.dx + info.channels[channel];
        let y = state.startY + dist * info.ship.dy;
        let xDiff = p.xOffset - x;
        let yDiff = p.yOffset - y;
        // console.log(`time = ${p.generation}, timing = ${timing}, dist = ${dist}, x = ${x}, y = ${y}, p.xOffset = ${p.xOffset}, p.yOffset = ${p.yOffset}, xDiff = ${xDiff}, yDiff = ${yDiff}`);
        if (i >= c.MAX_CHANNEL_RUN_GENERATIONS - 2 || xDiff - q.width < 3 || yDiff - q.height < 3 || ((xDiff < q.width + 3) && (yDiff < q.height + 3)) || (xDiff + p.width <= q.width) || (yDiff + p.height <= q.height)) {
            if (injected) {
                // console.log('returning');
                // console.log(p.toRLE());
                let recipe = state.recipe.slice();
                recipe.push([nextGlider, channel, 0]);
                return {
                    p,
                    elbow: state.elbow,
                    recipe,
                    time: state.time + nextGlider,
                    startX: state.startX,
                    startY: state.startY,
                };
            } else {
                injected = true;
            }
            p.offsetBy(Math.max(xDiff, 0), Math.max(yDiff, 0));
            p.insert(q, Math.max(-xDiff, 0), Math.max(-yDiff, 0));
            // console.log('injecting');
            // console.log(p.toRLE());
        }
        p.runGeneration();
        p.shrinkToFit();
    }
    throw new Error(`This error should not occur (runState completed loop), please report this to speedydelete`);
}

interface ExpectedResult {
    data: {
        stables: StableObject[];
        ships: ShipInfo[];
        period: number;
    }[];
    period: number;
    offsets: Set<number>;
}


function getExpected(info: ChannelInfo, elbow: [string, number, number], recipe: ChannelRecipe, results: {data: CAObject[][], x: number, y: number} | undefined): ExpectedResult {
    let data: ExpectedResult['data'] = [];
    let period = 1;
    if (recipe.end) {
        if (!results) {
            throw new Error(`This error should not occur (no results but recipe.end exists in getExpected), please report this to speedydelete`);
        }
        for (let result of results.data) {
            let out: (typeof data)[number] = {stables: [], ships: [], period: 1};
            for (let obj of result) {
                obj = structuredClone(obj);
                if (obj.type === 'osc') {
                    obj = normalizeOscillator(obj);
                }
                obj.x += results.x;
                obj.y += results.y;
                if (obj.type === 'sl') {
                    out.stables.push(obj);
                } else if (obj.type === 'osc') {
                    out.period = lcm(out.period, obj.period);
                    out.stables.push(obj);
                } else if (obj.type === 'ship') {
                    out.period = lcm(out.period, c.SPACESHIPS[obj.code].popPeriod);
                    out.ships.push(getShipInfo(info, obj));
                } else {
                    console.log(obj);
                    throw new Error(`This error should not occur (invalid object for getting expected), please report this to speedydelete (also some debug information got printed above, send that too)`);
                }
            }
            if (recipe.create) {
                if (recipe.create.type === 'sl') {
                    out.stables.push(recipe.create);
                } else {
                    out.period = lcm(out.period, recipe.create.period);
                    out.stables.push(normalizeOscillator(recipe.create));
                }
            }
            if (recipe.emit) {
                for (let ship of recipe.emit) {
                    out.period = lcm(out.period, c.SPACESHIPS[ship.code].popPeriod);
                }
                out.ships.push(...recipe.emit);
            }
            period = lcm(period, out.period);
            data.push(out);
        }
    } else {
        let out: (typeof data)[number] = {
            stables: [],
            ships: [{
                code: info.ship.code,
                dir: info.ship.slope === 0 ? 'S' : 'SE',
                lane: elbow[1],
                timing: 0,
            }],
            period: 1,
        };
        if (recipe.create) {
            if (recipe.create.type === 'sl') {
                out.stables.push(recipe.create);
            } else {
                out.period = lcm(out.period, recipe.create.period);
                out.stables.push(normalizeOscillator(recipe.create));
            }
        }
        if (recipe.emit) {
            for (let ship of recipe.emit) {
                out.period = lcm(out.period, c.SPACESHIPS[ship.code].popPeriod);
            }
            out.ships.push(...recipe.emit);
        }
        period = lcm(period, out.period);
        data.push(out);
    }
    let out: ExpectedResult = {data, period, offsets: new Set()};
    for (let i = 0; i < data.length; i++) {
        out.offsets.add(i);
    }
    return out;
}

function checkNextWorkingInput(info: ChannelInfo, state: RunState, expected: ExpectedResult['data'][number]): boolean {
    let p = state.p;
    if (expected.period > 1) {
        let prevPop = p.population;
        for (let i = 0; i < 256; i++) {
            p.run(expected.period);
            let pop = p.population;
            if (pop !== prevPop) {
                break;
            }
            prevPop = pop;
        }
    }
    let objs = findOutcome(p, undefined, undefined, true);
    if (typeof objs !== 'object') {
        return false;
    }
    let stables: StableObject[] = [];
    let ships: ShipInfo[] = [];
    for (let obj of objs) {
        if (obj.type === 'sl') {
            stables.push(obj);
        } else if (obj.type === 'osc') {
            stables.push(normalizeOscillator(obj));
        } else if (obj.type === 'ship') {
            ships.push(getShipInfo(info, obj));
        } else {
            return false;
        }
    }
    // console.log(`\x1b[94mgot:\n    stables: ${objectsToString(stables)}\n    ships: ${ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}\x1b[0m`);
    if (stables.length !== expected.stables.length || ships.length !== expected.ships.length) {
        return false;
    }
    for (let a of expected.stables) {
        if (!stables.some(b => a.code === b.code && a.x === b.x && a.y === b.y)) {
            return false;
        }
    }
    for (let a of expected.ships) {
        if (!ships.some(b => a.dir === b.dir && a.lane === b.lane)) {
            return false;
        }
    }
    return true;
}

function isNextWorkingInput(cache: {[key: number]: boolean}, info: ChannelInfo, state: RunState, next: number, expecteds: ExpectedResult): boolean {
    if (next in cache) {
        return cache[next];
    }
    state = runState(info, state, next, 0, false, true);
    let out: boolean;
    if (expecteds.offsets.size === 1) {
        out = checkNextWorkingInput(info, state, expecteds.data[(next + Array.from(expecteds.offsets)[0]) % expecteds.data.length]);
    } else {
        let data = expecteds.data.map(x => checkNextWorkingInput(info, state, x));
        if (data.every(x => x === false)) {
            out = false;
        } else {
            for (let i = 0; i < data.length; i++) {
                if (i in expecteds.offsets) {
                    if (!data[i]) {
                        expecteds.offsets.delete(i);
                    }
                }
            }
            out = true;
        }
    }
    cache[next] = out;
    return out;
}

export function findNextWorkingInput(info: ChannelInfo, state: RunState, recipe: ChannelRecipe, results: {data: CAObject[][], x: number, y: number} | undefined): false | number {
    // console.log(recipe);
    let expecteds = getExpected(info, state.elbow, recipe, results);
    // let msg = '\x1b[92mexpecteds:';
    // for (let i = 0; i < expecteds.data.length; i++) {
    //     let value = expecteds.data[i];
    //     msg += `\n    ${i}:\n        stables: ${objectsToString(value.stables)}\n        ships: ${value.ships.map(x => `${x.dir} lane ${x.lane} timing ${x.timing}`).join(', ')}`;
    // }
    // msg += `\ntotal period: ${expecteds.period}`;
    let cache: {[key: number]: boolean} = {};
    let prevI = 0;
    let i = info.initialBound;
    // console.log('\x1b[95mexponential search:\x1b[0m');
    while (true) {
        let value = info.minSpacing + i;
        if (value > info.maxNextSpacing) {
            break;
        }
        if (isNextWorkingInput(cache, info, state, value, expecteds) && isNextWorkingInput(cache, info, state, value + 1, expecteds) && isNextWorkingInput(cache, info, state, value + 2, expecteds) && isNextWorkingInput(cache, info, state, value + 3, expecteds)) {
            break;
        }
        // console.log(`\x1b[92mold: ${info.minSpacing + prevI} to ${value}, new: ${value} to ${info.minSpacing + i * 2}\x1b[0m`);
        prevI = i;
        i *= 2;
    }
    // console.log('\x1b[95mbinary search:\x1b[0m');
    let low = info.minSpacing + prevI;
    let high = Math.min(info.minSpacing + i, info.maxNextSpacing);
    while (low < high) {
        // let oldLow = low;
        // let oldHigh = high;
        let mid = Math.floor((low + high) / 2);
        if (isNextWorkingInput(cache, info, state, mid, expecteds) && isNextWorkingInput(cache, info, state, mid + 1, expecteds) && isNextWorkingInput(cache, info, state, mid + 2, expecteds) && isNextWorkingInput(cache, info, state, mid + 3, expecteds)) {
            high = mid;
        } else {
            low = mid + 1;
        }
        // console.log(`\x1b[92mold: ${oldLow} to ${oldHigh}, mid = ${mid}, new: ${low} to ${high}: ${isNextWorkingInput(cache, info, state, mid, expecteds)}, ${isNextWorkingInput(cache, info, state, mid + 1, expecteds)}, ${isNextWorkingInput(cache, info, state, mid + 2, expecteds)} ${isNextWorkingInput(cache, info, state, mid + 3, expecteds)}\x1b[0m`);
    }
    if (low >= info.maxNextSpacing) {
        if (!recipe.create) {
            console.error(`\x1b[91mUnable to find next possible glider spacing: ${channelRecipeToString(info, recipe.recipe)}\x1b[0m`);
        }
        return false;
    }
    return low;
}


export function isTooBig(obj: string, limit: number, overrides: string[]): boolean {
    if (obj.startsWith('xs')) {
        if (parseInt(obj.slice(2)) > limit) {
            let index = obj.indexOf('_');
            let p = base.loadApgcode(obj.slice(index + 1, obj.indexOf('/')));
            if (overrides.includes(p.toCanonicalApgcode(1, obj.slice(0, index)))) {
                return false;
            } else {
                return true;
            }
        } else {
            return false;
        }
    }
    let period = parseInt(obj.slice(2));
    let p = base.loadApgcode(obj.slice(obj.indexOf('_') + 1, obj.indexOf('/')));
    if (p.population > limit) {
        if (overrides.includes(p.toCanonicalApgcode(1, 'xp' + period))) {
            return false;
        }
        return true;
    }
    for (let i = 0; i < period - 1; i++) {
        p.runGeneration();
        if (p.population > limit) {
            if (overrides.includes(p.toCanonicalApgcode(1, 'xp' + period))) {
                return false;
            }
            return true;
        }
    }
    return false;
}

export function getStringRecipe(info: ChannelInfo, recipe: ChannelRecipe): string {
    return `${channelRecipeInfoToString(recipe)}: ${channelRecipeToString(info, recipe.recipe)}\n`;
}

export function resolveElbow(info: ChannelInfo, elbows: ElbowData, recipe: ChannelRecipe, depth: number = 0): {recipes: ChannelRecipe[], possibleUseful: string} {
    if (depth === 64) {
        console.error(`\x1b[91mThere is a recursive elbow (please report to speedydelete)\x1b[0m`);
        return {recipes: [], possibleUseful: ''};
    }
    if (!recipe.end) {
        return {recipes: [recipe], possibleUseful: getStringRecipe(info, recipe)};
    }
    if (!(recipe.end.elbow in elbows)) {
        return {recipes: [recipe], possibleUseful: ''};
    }
    let outcomes = elbows[recipe.end.elbow];
    let out: ChannelRecipe[] = [];
    let possibleUseful = '';
    // console.log(`resolving ${recipe.end.elbow}: ${outcomes.map(x => x.type).join(', ')}`);
    for (let i = 0; i < outcomes.length; i++) {
        let elbow = outcomes[i];
        if (elbow.type === 'bad') {
            continue;
        }
        if (elbow.type === 'normal') {
            let recipe2 = structuredClone(recipe);
            recipe2.recipe[recipe2.recipe.length - 1][2] = outcomes.length;
            out.push(recipe2);
            possibleUseful += getStringRecipe(info, recipe);
            continue;
        }
        if (elbow.type === 'no collision') {
            if (recipe.create || recipe.emit) {
                continue;
            }
            let recipe2 = structuredClone(recipe);
            recipe2.end = undefined;
            let elbow = recipe.end.elbow;
            let parts = elbow.split('/');
            let y = recipe.end.move;
            let x = y * info.ship.slope - (parseInt(parts[1]) - parseInt(recipe.start.slice(recipe.start.indexOf('/') + 1)));
            if (elbow.startsWith('xp')) {
                recipe2.create = {
                    type: 'osc',
                    code: parts[0],
                    x,
                    y,
                    period: parseInt(elbow.slice(2)),
                    timing: recipe.end.timing,
                };
            } else {
                recipe2.create = {
                    type: 'sl',
                    code: parts[0],
                    x,
                    y,
                    timing: recipe.end.timing,
                };
            }
            out.push(recipe2);
            possibleUseful += getStringRecipe(info, recipe2);
            continue;
        }
        let recipe2 = structuredClone(recipe) as ChannelRecipe & {end: {elbow: string, move: number, flipped: boolean, timing: number}};
        if (elbow.type !== 'alias') {
            let value = recipe2.recipe[recipe2.recipe.length - 1];
            let inc = (i + recipe.end.timing - recipe.time) % outcomes.length;
            if (inc < 0) {
                inc += outcomes.length;
            }
            // console.log(`recipe = ${channelRecipeToString(info, recipe.recipe)}, elbow = ${recipe.end.elbow}: i = ${i}, recipe.end.timing = ${recipe.end.timing}, recipe.time = ${recipe.time}, outcomes.length = ${outcomes.length}, inc = ${inc}\n`);
            value[0] += inc;
            value[1] = 0;
            value[2] = outcomes.length;
            recipe2.recipe.push([info.minSpacing, -1, 0]);
            recipe2.time += inc + info.minSpacing;
        }
        if ((elbow.type === 'convert' || elbow.type === 'destroy') && elbow.emit) {
            // if (recipe2.create) {
            //     continue;
            // }
            if (recipe2.emit) {
                if (elbow.emit.some(x => x.dir !== (recipe2.emit as ShipInfo[])[0].dir)) {
                    continue;
                }
                recipe2.emit.push(...elbow.emit);
            } else {
                recipe2.emit = elbow.emit;
            }
        }
        if (elbow.type === 'destroy') {
            (recipe2 as ChannelRecipe).end = undefined;
            out.push(recipe2);
            possibleUseful += getStringRecipe(info, recipe2);
        } else {
            if (isTooBig(elbow.elbow, c.ELBOW_SIZE_LIMIT, c.ELBOW_SIZE_LIMIT_OVERRIDES)) {
                continue;
            }
            recipe2.end.elbow = elbow.elbow;
            recipe2.end.flipped = recipe2.end.flipped !== elbow.flipped;
            recipe2.end.timing += elbow.timing;
            recipe2.end.move += elbow.move;
            if (recipe2.create && recipe2.create.timing !== undefined) {
                recipe2.create.timing += elbow.timing;
            }
            let value = resolveElbow(info, elbows, recipe2, depth + 1);
            out.push(...value.recipes);
            possibleUseful += value.possibleUseful;
        }
    }
    return {recipes: out, possibleUseful};
}


interface CheckerObjectData {
    obj: StableObject;
    period: number;
    lane: number;
    spacing: number;
}

function checkRecipe(info: ChannelInfo, elbows: ElbowData, newElbows: string[], state: RunState, nextGlider: number, nextChannel: number): {state: RunState, outcome: string, recipes?: ChannelRecipe[], possibleUseful?: string} {
    state = runState(info, state, nextGlider, nextChannel, true, true);
    let p = state.p.copy();
    let prevPop = p.population;
    for (let i = 0; i < 256; i++) {
        p.run(info.ship.popPeriod);
        let pop = p.population;
        if (pop !== prevPop) {
            break;
        }
        prevPop = pop;
    }
    let result = findOutcome(p);
    if (result === false || result === 'no stabilize') {
        return {state, outcome: String(result)};
    } else if (result === 'linear') {
        return {state, outcome: String(result), possibleUseful: `Linear growth: ${channelRecipeToString(info, state.recipe)}\n`};
    }
    let outcome = objectsToString(result.map(obj => {
        if (obj.type === 'ship') {
            return {
                type: 'ship',
                code: obj.code,
                dir: obj.dir,
                timing: 0,
                x: 0,
                y: 0,
                at: 0,
            };
        } else if (obj.type === 'osc') {
            return normalizeOscillator(obj);
        } else {
            return obj;
        }
    }));
    let so1: CheckerObjectData | undefined = undefined;
    let so2: CheckerObjectData | undefined = undefined;
    let emit: ShipInfo[] | undefined = undefined;
    for (let obj of result) {
        if (obj.type === 'sl' || obj.type === 'osc') {
            if (so1 && so2) {
                return {state, outcome};
            }
            if (obj.type === 'osc') {
                obj = normalizeOscillator(obj, false);
            }
            let period = obj.type === 'osc' ? obj.period : 1;
            let lane = Math.floor(obj.y * info.ship.slope) - obj.x + state.elbow[1];
            let value = {obj, period, lane, spacing: obj.y};
            if (so1 === undefined) {
                so1 = value;
            } else {
                so2 = value;
            }
        } else if (obj.type === 'ship') {
            let ship = getShipInfo(info, obj);
            if (emit) {
                let dir = ship.dir;
                if (dir.endsWith('2')) {
                    dir = dir.slice(0, -1) as ShipDirection;
                }
                if (emit.some(x => dir !== (x.dir.endsWith('2') ? x.dir.slice(0, -1) : x.dir))) {
                    return {state, outcome};
                }
                emit.push(ship);
            } else {
                emit = [ship];
            }
        } else {
            if (obj.type === 'other' && obj.code.startsWith('xq')) {
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
                    return {state, outcome, possibleUseful: `creates ${obj.code} (${type.disp[0]}, ${type.disp[1]}, lane ${lane}) and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}\n`};
                } else {
                    return {state, outcome, possibleUseful: `creates ${obj.code} (no found displacement) and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}\n`};
                }
            }
            return {state, outcome, possibleUseful: `creates ${obj.code} and ${result.length - 1} other objects: ${channelRecipeToString(info, state.recipe)}`};
        }
    }
    let create: StableObject | undefined = undefined;
    let endElbowData: [CheckerObjectData, CAObject[][]] | undefined = undefined;
    if (so1) {
        if (so2) {
            let so1Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                so1Result.push(getCollision(info, so1.obj.code, so1.lane, i, undefined, undefined, true));
            }
            let so2Result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so2.period; i++) {
                so2Result.push(getCollision(info, so2.obj.code, so2.lane, i, undefined, undefined, true));
            }
            if (so1Result.every(x => typeof x === 'object')) {
                endElbowData = [so1, so1Result];
                create = so2.obj;
                if (emit) {
                    return {state, outcome};
                }
            } else {
                if (so2Result.every(x => typeof x === 'object')) {
                    endElbowData = [so2, so2Result];
                    create = so1.obj;
                } else {
                    return {state, outcome};
                }
            }
        } else {
            let result: ReturnType<typeof getCollision>[] = [];
            for (let i = 0; i < so1.period; i++) {
                result.push(getCollision(info, so1.obj.code, so1.lane, i, undefined, undefined, true));
            }
            if (result.every(x => typeof x === 'object')) {
                endElbowData = [so1, result];
            } else {
                create = so1.obj;
            }
        }
    }
    if (create && (emit || isTooBig(create.code, c.CREATE_SIZE_LIMIT, c.CREATE_SIZE_LIMIT_OVERRIDES))) {
        return {state, outcome};
    }
    let end: ChannelRecipe['end'] | undefined = undefined;
    let endResult: Parameters<typeof findNextWorkingInput>[3] = undefined;
    if (endElbowData) {
        let [elbow, result] = endElbowData;
        if (isTooBig(elbow.obj.code, c.ELBOW_SIZE_LIMIT, c.ELBOW_SIZE_LIMIT_OVERRIDES)) {
            return {state, outcome};
        }
        endResult = {data: result, x: elbow.obj.x, y: elbow.obj.y};
        let str = `${elbow.obj.code}/${elbow.lane}`;
        let period = elbow.obj.type === 'osc' ? elbow.obj.period : 1;
        end = {elbow: str, period, move: elbow.spacing, flipped: false, timing: elbow.obj.timing ?? 0};
        if (!(str in elbows) && newElbows && !newElbows.includes(str)) {
            // console.log(`New elbow detected: ${str} in recipe ${strRecipe}`);
            newElbows.push(str);
        }
    }
    let out: ChannelRecipe = {start: `${state.elbow[0]}/${state.elbow[1]}`, recipe: state.recipe.slice(), time: state.time, end, create, emit};
    let next = findNextWorkingInput(info, state, out, endResult);
    if (next !== false) {
        out.recipe.push([next, -1, 1]);
        out.time += next;
        let {recipes} = resolveElbow(info, elbows, out);
        return {state, outcome, recipes};
    } else {
        return {state, outcome, possibleUseful: `probably broken ${channelRecipeInfoToString(out)}: ${channelRecipeToString(info, state.recipe)}\n`};
    }
}


function runStart(info: ChannelInfo, elbows: ElbowData, newElbows: string[], state: RunState, maxSpacing: number): {states: RunState[], recipes: ChannelRecipe[], possibleUseful: string, recipesChecked: number} {
    let states: RunState[] = [];
    let recipes: ChannelRecipe[] = [];
    let possibleUseful = '';
    let recipesChecked = 0;
    let startChannel = (state.recipe[state.recipe.length - 1] ?? [0, 0])[1];
    for (let channel = 0; channel < info.channels.length; channel++) {
        let timings: number[] = [];
        for (let timing = info.minSpacings[startChannel][channel]; timing <= maxSpacing; timing++) {
            timings.push(timing);
        }
        let outcomes: string[] = [];
        // console.log(Object.assign({}, state, {p: undefined}));
        let p = state.p.copy();
        while (timings.length > 0) {
            let timing = p.generation - state.time - timings[0];
            let mod = timing % info.ship.period;
            if (mod < 0) {
                mod += info.ship.period;
            }
            let q = shipPatterns[info.ship.code][mod];
            let dist = (timing - mod) / info.ship.period;
            let x = state.startX + dist * info.ship.dx + info.channels[channel];
            let y = state.startY + dist * info.ship.dy;
            let xDiff = p.xOffset - x;
            let yDiff = p.yOffset - y;
            // console.log(`time = ${p.generation}, timing = ${timing}, dist = ${dist}, x = ${x}, y = ${y}, p.xOffset = ${p.xOffset}, p.yOffset = ${p.yOffset}, xDiff = ${xDiff}, yDiff = ${yDiff}`);
            while (xDiff - q.width < 3 || yDiff - q.height < 3 || ((xDiff < q.width + 3) && (yDiff < q.height + 3)) || (xDiff + p.width <= q.width) || (yDiff + p.height <= q.height)) {
                let r = p.copy();
                r.offsetBy(Math.max(xDiff, 0), Math.max(yDiff, 0));
                r.insert(q, Math.max(-xDiff, 0), Math.max(-yDiff, 0));
                let data = checkRecipe(info, elbows, newElbows, {
                    p: r,
                    elbow: state.elbow,
                    recipe: state.recipe.slice(),
                    time: state.time,
                    startX: state.startX,
                    startY: state.startY,
                }, timings[0], channel);
                timings.shift();
                recipesChecked++;
                states.unshift(data.state);
                if (data.recipes) {
                    recipes.push(...data.recipes);
                }
                if (data.possibleUseful) {
                    possibleUseful += data.possibleUseful;
                }
                // console.log(channelRecipeToString(info, data.state.recipe) + ': ' + data.outcome);
                outcomes.unshift(data.outcome);
                let found = false;
                for (let period = 1; period < Math.floor(outcomes.length / 3); period++) {
                    let found2 = false;
                    for (let i = 0; i < period; i++) {
                        if (outcomes[i] === 'no stabilize' || outcomes[i] === 'linear' || outcomes[i] !== outcomes[i + period] || outcomes[i] !== outcomes[i + period * 2]) {
                            found2 = true;
                            break;
                        }
                    }
                    if (!found2) {
                        found = true;
                        states = states.slice(period * 2);
                        let toChange: number[] = [];
                        for (let i = 0; i < period; i++) {
                            let recipe = states[i].recipe;
                            let part = structuredClone(recipe[recipe.length - 1]);
                            recipe[recipe.length - 1] = part;
                            toChange.push(part[0]);
                            part[2] = period;
                        }
                        for (let {recipe} of recipes) {
                            if (toChange.includes(recipe[recipe.length - 1][0])) {
                                let part = structuredClone(recipe[recipe.length - 1]);
                                recipe[recipe.length - 1] = part;
                                part[2] = period;
                            }
                        }
                        break;
                    }
                }
                if (found) {
                    break;
                }
                if (timings.length === 0) {
                    break;
                }
                timing = p.generation - state.time - timings[0];
                mod = timing % info.ship.period;
                if (mod < 0) {
                    mod += info.ship.period;
                }
                q = shipPatterns[info.ship.code][mod];
                dist = (timing - mod) / info.ship.period;
                x = state.startX + dist * info.ship.dx + info.channels[channel];
                y = state.startY + dist * info.ship.dy;
                xDiff = p.xOffset - x;
                yDiff = p.yOffset - y;
            }
            p.runGeneration();
            p.shrinkToFit();
        }
    }
    return {states, recipes, possibleUseful, recipesChecked};
}


export interface WorkerData {
    info: ChannelInfo;
    maxGenerations: number;
    outputFile?: string;
    maxSpacing: number;
}

export interface WorkerStartData {
    elbows: ElbowData;
    starts: StrRunState[];
}

export interface WorkerOutput {
    complete: boolean;
    startsChecked: number;
    recipesChecked: number;
    states: StrRunState[];
    recipes: ChannelRecipe[];
    possibleUseful: string[];
    newElbows: string[];
}


// @ts-ignore
if (import.meta.main || ('__wrecked_isWorker' in globalThis && globalThis.__wrecked_isWorker)) {
    if (typeof process === 'object' && process && typeof process.env === 'object') {
        process.env.FORCE_COLOR = '1';
    }
    let {parentPort, workerData: _workerData} = await import('node:worker_threads');
    if (!parentPort) {
        throw new Error('No parent port!');
    }
    let workerData: WorkerData = _workerData;
    let info = workerData.info;
    let maxSpacing = workerData.maxSpacing;
    setMaxGenerations(workerData.maxGenerations);
    if (workerData.outputFile !== undefined) {
        let originalWrite = process.stdout.write.bind(process.stdout);
        let {appendFileSync} = await import('node:fs');
        process.stdout.write = function(data: string | Uint8Array, encoding: NodeJS.BufferEncoding | ((error?: Error | null) => void) = 'utf-8', callback?: (error?: Error | null) => void): boolean {
            if (typeof encoding === 'function') {
                callback = encoding;
                encoding = 'utf-8';
            }
            if (data instanceof Uint8Array) {
                let str = '';
                for (let byte of data) {
                    str += String.fromCharCode(byte);
                }
                data = str;
                encoding = 'latin1';
            }
            let stripped = data.replaceAll(/\ib\[([0-9;]+)m/g, '');
            appendFileSync(workerData.outputFile as string, stripped, encoding);
            return originalWrite(data, encoding, callback);
        }
    }
    parentPort.on('message', async (data: WorkerStartData) => {
        let lastUpdate = performance.now();
        let startsChecked = 0;
        let recipesChecked = 0;
        let states: StrRunState[] = [];
        let recipes: ChannelRecipe[] = [];
        let possibleUseful: string[] = [];
        let newElbows: string[] = [];
        for (let start of data.starts) {
            let state = Object.assign(start, {p: base.loadApgcode(start.p).shrinkToFit()});
            state.p.xOffset = state.xOffset;
            state.p.yOffset = state.yOffset;
            state.p.generation = state.generation;
            // let value = runStart(info, data.elbows, newElbows, state, maxSpacing);
            let value: ReturnType<typeof runStart>;
            try {
                value = runStart(info, data.elbows, newElbows, state, maxSpacing);
            } catch (error) {
                console.error(`Error while searching ${channelRecipeToString(info, state.recipe)}:`);
                throw error;
            }
            startsChecked++;
            recipesChecked += value.recipesChecked;
            states.push(...value.states.map(x => Object.assign(x, {
                p: x.p.toApgcode(),
                xOffset: x.p.xOffset,
                yOffset: x.p.yOffset,
                generation: x.p.generation,
            })));
            recipes.push(...value.recipes);
            possibleUseful.push(value.possibleUseful);
            let now = performance.now();
            if (now - lastUpdate > 5000) {
                lastUpdate = now;
                parentPort.postMessage({complete: false, startsChecked, recipesChecked, states, recipes, possibleUseful, newElbows} satisfies WorkerOutput);
                startsChecked = 0;
                recipesChecked = 0;
                states = [];
                recipes = [];
                possibleUseful = [];
                newElbows = [];
            }
        }
        parentPort.postMessage({complete: true, startsChecked, recipesChecked, states, recipes, possibleUseful, newElbows} satisfies WorkerOutput);
    });
}
