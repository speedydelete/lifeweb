
import {c, base, StillLife, Spaceship, loadRecipes} from './base.js';


const TYPE = 'Slow salvo';
const START_OBJECT = 'xs2_11';
const END_OBJECT = 'xs2_11';
const END_LANE = 0;
const SALVO = [0, -2, -8, -9, 3, 3, 1, 7, 11, 7, -17, -11, -3, -12, -2, -5];
const DIR: string = 'SW';
const BEAM_WIDTH = 65536;
const MIN_LANE = -16;
const MAX_LANE = 16;
const CLOSENESS_OFFSET = -5;

let info = c.SALVO_INFO[TYPE];
let recipes = (await loadRecipes()).salvos['Slow salvo'];

interface State {
    key: string;
    elbow: string;
    x: number;
    y: number;
    closeness: number;
    gliders: number[];
    emitted: number;
    sinceLastGlider: number;
}

const SIZES: {[key: string]: number} = {};

// let bad = new Set<string>();

function addToState(state: State): State[] {
    let out: State[] = [];
    let laneOffset = state.y - state.x;
    // let found = false;
    for (let [lane, timing, data] of recipes.searchResults[state.elbow]) {
        lane -= laneOffset;
        if (timing !== 0 || lane % 2 !== 0 || lane < MIN_LANE || lane > MAX_LANE || typeof data === 'string' || data.length === 0 || data.length > 2) {
            continue;
        }
        let sl: StillLife;
        let ship: Spaceship | undefined;
        if (data.length === 1 && data[0].type === 'sl') {
            sl = data[0] as StillLife;
        } else if (data.length === 1 && data[0].type !== 'sl') {
            continue;
        } else {
            let obj0 = data[0];
            let obj1 = data[1];
            if (obj0.type !== 'sl') {
                let temp = obj0;
                obj0 = obj1;
                obj1 = temp;
            }
            if (obj0.type !== 'sl' || obj1.type !== 'ship') {
                continue;
            }
            sl = obj0;
            ship = obj1;
            if (ship.code !== info.ship.code || ship.dir !== DIR) {
                continue;
            }
        }
        if (!(sl.code in recipes.searchResults)) {
            continue;
        }
        let x = state.x + sl.x;
        let y = state.y + sl.y;
        let emitted = state.emitted;
        if (ship) {
            let shipX = x - ship.x;
            let shipY = y - ship.y;
            let lane = DIR === 'NW' || DIR === 'SE' ? shipX - shipY : shipX + shipY;
            if (lane !== SALVO[state.emitted]) {
                continue;
            }
            emitted++;
        }
        // if (bad.has(sl.code + ' ' + (newY - newX))) {
        //     continue;
        // }
        // found = true;
        let gliders = state.gliders.slice();
        gliders.push(lane);
        let closeness: number;
        if (!(sl.code in SIZES)) {
            let p = base.loadApgcode(sl.code.slice(sl.code.indexOf('_'))).shrinkToFit();
            let value = Math.floor((p.height + p.width) / 2);
            closeness = x + y + value;
            SIZES[sl.code] = value;
        } else {
            closeness = x + y + SIZES[sl.code];
        }
        if (SALVO[emitted] === undefined) {
            closeness = 0;
        } else {
            closeness = Math.abs(SALVO[emitted] - (closeness + CLOSENESS_OFFSET));
        }
        let value: State = {
            key: sl.code + ' ' + x + ' ' + y + ' ' + emitted,
            elbow: sl.code,
            x,
            y,
            closeness,
            gliders,
            emitted,
            sinceLastGlider: ship ? 0 : state.sinceLastGlider + 1,
        };
        out.push(value);
    }
    // if (!found) {
    //     bad.add(state.elbow + ' ' + laneOffset);
    // }
    return out;
}

let prevLayer: State[] = [{
    key: START_OBJECT + ' 0 0 0',
    elbow: START_OBJECT,
    x: 0,
    y: 0,
    closeness: Math.abs(SALVO[0]) + CLOSENESS_OFFSET,
    gliders: [],
    emitted: 0,
    sinceLastGlider: 0,
}];


let depth = 1;
while (true) {
    let data = new Map<string, State>();
    let bestEmitted = 0;
    let bestCloseness = Infinity;
    console.log(`Searching depth ${depth}`);
    for (let state of prevLayer) {
        for (let value of addToState(state)) {
            if (value.emitted === SALVO.length) {
                console.log(`Solution found: ${value.gliders.join(', ')}`);
                process.exit(0);
            }
            bestEmitted = Math.max(bestEmitted, value.emitted);
            bestCloseness = Math.min(bestCloseness, value.closeness);
            if (!data.has(value.key)) {
                data.set(value.key, value);
            }
        }
    }
    let total = data.size;
    let nextLayer = Array.from(data.values()).sort((x, y) => {
        if (x.emitted === y.emitted) {
            if (x.closeness === y.closeness) {
                return x.gliders.length - y.gliders.length;
            } else {
                return x.closeness - y.closeness;
            }
        } else {
            return y.emitted - x.emitted;
        }
    }).slice(0, BEAM_WIDTH);
    // console.log(nextLayer.map(x => `${x.elbow} (${x.x}, ${x.y}): ${x.gliders.join(', ')}`).join('\n'));
    console.log(`Depth ${depth} complete (total results: ${total}, best emitted glider count: ${bestEmitted}, best closeness: ${bestCloseness})`);
    if (nextLayer.length === 0) {
        console.log(`Search exhausted`);
        break;
    }
    prevLayer = nextLayer;
    depth++;
}
