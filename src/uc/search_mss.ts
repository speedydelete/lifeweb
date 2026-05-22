
import {c, StillLife, Spaceship, loadRecipes} from './base.js';


const TYPE = 'Slow salvo';
const SALVO = [0];
const DIR: string = 'SE';
const MAX_GPG = 32;
const BEAM_WIDTH = 1024;
const MIN_LANE = 0;
const MAX_LANE = 20;

let info = c.SALVO_INFO[TYPE];
let recipes = (await loadRecipes()).salvos['Slow salvo'];

interface State {
    elbow: string;
    x: number;
    y: number;
    gliders: number[];
    emitted: number;
    sinceLastGlider: number;
}

// let bad = new Set<string>();

function addToState(state: State): State[] {
    let out: State[] = [];
    let laneOffset = state.y - state.x;
    // let found = false;
    for (let [lane, timing, data] of recipes.searchResults[state.elbow]) {
        lane += laneOffset;
        if (timing !== 0 || lane < MIN_LANE || lane > MAX_LANE || typeof data === 'string' || data.length === 0 || data.length > 2) {
            continue;
        }
        let sl: StillLife;
        let ship: Spaceship | undefined;
        if (data.length === 1 && data[0].type === 'sl') {
            sl = data[0] as StillLife;
        } else if (data.length === 1 && data[0].type !== 'ship') {
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
        }
        let newX = state.x + sl.x;
        let newY = state.y + sl.y;
        // if (bad.has(sl.code + ' ' + (newY - newX))) {
        //     continue;
        // }
        // found = true;
        let gliders = state.gliders.slice();
        gliders.push(lane);
        let value: State = {
            elbow: sl.code,
            x: newX,
            y: newY,
            gliders: gliders,
            emitted: state.emitted,
            sinceLastGlider: state.sinceLastGlider + 1,
        };
        if (ship) {
            if (ship.dir !== DIR) {
                continue;
            }
            let x = newX - ship.x;
            let y = newY - ship.y;
            let lane = DIR === 'NW' || DIR === 'SW' ? x - y : x + y;
            if (lane !== SALVO[state.emitted]) {
                continue;
            }
            value.emitted++;
            value.sinceLastGlider = 0;
        }
        if (value.sinceLastGlider > MAX_GPG) {
            continue;
        }
        out.push(value);
    }
    // if (!found) {
    //     bad.add(state.elbow + ' ' + laneOffset);
    // }
    return out;
}

let prevLayer: State[] = [{
    elbow: 'xs2_11',
    x: 0,
    y: 6,
    gliders: [],
    emitted: 0,
    sinceLastGlider: 0,
}];


let depth = 1;
while (true) {
    let nextLayer = [];
    let best = 0;
    console.log(`Searching depth ${depth}`);
    for (let state of prevLayer) {
        for (let value of addToState(state)) {
            if (value.emitted === SALVO.length) {
                console.log(`Solution found: ${value.gliders.join(', ')}`);
            }
            best = Math.max(best, value.emitted);
        }
        nextLayer.push(...addToState(state));
    }
    let total = nextLayer.length;
    nextLayer = nextLayer.sort((x, y) => {
        if (x.emitted === y.emitted) {
            return y.gliders.length - x.gliders.length;
        } else {
            return y.emitted - x.emitted;
        }
    }).slice(0, BEAM_WIDTH);
    console.log(`Depth ${depth} complete (total results: ${total}, after beam: ${nextLayer.length}, best emitted glider count: ${best})`);
}
