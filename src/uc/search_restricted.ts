
import {c, base, StillLife, Spaceship, loadRecipes} from './base.js';
import {createSalvoPattern} from './slow_salvos.js';


const TYPE = 'Monochrome slow salvo';
const VALID_LANES = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20];
const START: [string, number] = ['xs2_11', 6];
const END: undefined | 'destroy' | [string, number] = ['xs2_11', 6];
const SALVO_DIR: string = 'SW';
const SALVO: [string, number][] = [['xq5_103a', -4], ['xq4_15', -3], ['xq4_15', -2]];
const SALVO_OFFSET = 0;
const BEAM_WIDTH = 131072;
const CLOSENESS_OFFSET = -5;

let info = c.SALVO_INFO[TYPE];
console.log(`Loading recipes`);
let recipes = (await loadRecipes()).salvos[TYPE];
console.log(`Recipes loaded`);

interface State {
    key: string;
    elbow?: string;
    x: number;
    y: number;
    closeness: number;
    gliders: number[];
    emitted: number;
}

const SIZES: {[key: string]: number} = {};

// let bad = new Set<string>();

function addToState(state: State): State[] {
    let out: State[] = [];
    let laneOffset = state.y - state.x;
    // let found = false;
    for (let [lane, timing, data] of recipes.searchResults[state.elbow as string]) {
        lane -= laneOffset;
        if (timing !== 0 || !VALID_LANES.includes(lane) || typeof data === 'string' || data.length > 2) {
            continue;
        }
        if (data.length === 0) {
            if (END === 'destroy' && state.emitted === SALVO.length) {
                let gliders = state.gliders.slice();
                gliders.push(lane);
                out.push({
                    key: 'none ' + state.emitted,
                    elbow: undefined,
                    x: 0,
                    y: 0,
                    closeness: 0,
                    gliders,
                    emitted: state.emitted,
                });
            }
            continue;
        }
        let sl: StillLife;
        let ship: Spaceship | undefined;
        if (data.length === 1 && data[0].type === 'sl') {
            sl = data[0] as StillLife;
        } else if (data.length === 1 && data[0].type !== 'sl') {
            if (END === 'destroy' && state.emitted === SALVO.length && data[0].type === 'ship') {
                let ship = data[0];
                if (ship.code !== info.ship.code || ship.dir !== SALVO_DIR) {
                    continue;
                }
                let shipX = state.x + ship.x;
                let shipY = state.y + ship.y;
                let lane = ((SALVO_DIR === 'NW' || SALVO_DIR === 'SE') ? shipX - shipY : shipX + shipY) - SALVO_OFFSET;
                if (lane !== SALVO[state.emitted][1]) {
                    continue;
                }
                let gliders = state.gliders.slice();
                gliders.push(lane);
                out.push({
                    key: 'none ' + (state.emitted + 1),
                    elbow: undefined,
                    x: 0,
                    y: 0,
                    closeness: 0,
                    gliders,
                    emitted: state.emitted + 1,
                });
            }
            continue;
        } else {
            if (state.emitted === SALVO.length) {
                continue;
            }
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
            if (ship.code !== SALVO[state.emitted][0] || ship.dir !== SALVO_DIR) {
                continue;
            }
        }
        if (!(sl.code in recipes.searchResults)) {
            continue;
        }
        let x = state.x + sl.x;
        let y = state.y + sl.y;
        // if (bad.has(sl.code + ' ' + (y - x))) {
        //     continue;
        // }
        // found = true;
        let emitted = state.emitted;
        if (ship) {
            let shipX = state.x + ship.x;
            let shipY = state.y + ship.y;
            let shipLane = ((SALVO_DIR === 'NW' || SALVO_DIR === 'SE') ? shipX - shipY : shipX + shipY) - SALVO_OFFSET;
            if (shipLane !== SALVO[emitted][1]) {
                continue;
            }
            emitted++;
        }
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
            closeness = typeof END === 'object' ? Math.abs(y - x - END[1]) : 0;
        } else {
            closeness = Math.abs((SALVO[emitted][1] - SALVO_OFFSET) - (closeness + CLOSENESS_OFFSET));
        }
        let value: State = {
            key: sl.code + ' ' + x + ' ' + y + ' ' + emitted,
            elbow: sl.code,
            x,
            y,
            closeness,
            gliders,
            emitted,
        };
        out.push(value);
    }
    // if (!found) {
    //     bad.add(state.elbow + ' ' + laneOffset);
    // }
    return out;
}

let prevLayer: State[] = [{
    key: `${START[0]} ${START[1]} 0 0 0`,
    elbow: START[0],
    x: START[1],
    y: 0,
    closeness: Math.abs(SALVO[0][1] + CLOSENESS_OFFSET),
    gliders: [],
    emitted: 0,
}];


let depth = 1;
while (true) {
    let data = new Map<string, State>();
    let bestEmitted = 0;
    console.log(`Searching depth ${depth}`);
    for (let state of prevLayer) {
        for (let value of addToState(state)) {
            if (value.emitted === SALVO.length && (!END || ((END as unknown as 'destroy') === 'destroy' && value.elbow === undefined) || (value.elbow === END[0] && value.y - value.x === END[1]))) {
                console.log(createSalvoPattern(info, START[0].slice(START[0].indexOf('_') + 1), value.gliders.map(x => [x - START[1], 0])).toRLE());
                console.log(`Solution found (length ${value.gliders.length}): ${value.gliders.join(', ')}`);
                process.exit(0);
            }
            bestEmitted = Math.max(bestEmitted, value.emitted);
            if (!data.has(value.key)) {
                data.set(value.key, value);
            }
        }
    }
    let total = data.size;
    let nextLayer = Array.from(data.values()).sort((x, y) => {
        if (x.emitted === y.emitted) {
            return x.closeness - y.closeness;
        } else {
            return y.emitted - x.emitted;
        }
    }).slice(0, BEAM_WIDTH);
    // console.log(nextLayer.map(x => `${x.elbow} (${x.x}, ${x.y}): ${x.gliders.join(', ')}`).join('\n'));
    console.log(`Depth ${depth} complete (total results: ${total}, best result: ${bestEmitted}/${SALVO.length})`);
    if (nextLayer.length === 0) {
        console.log(`Search exhausted`);
        break;
    }
    prevLayer = nextLayer;
    depth++;
}
