
import {MAPPattern, INTSeparator, createPattern} from './core/index.js';


const ACTIVE_REGIONS: {[key: string]: [string, number, number]} = {
    'R': ['472', 1, 1],
};

const ACTIVE_REGION_LOOKAHEAD_GENS = 20;

const UPDATE_INTERVAL = 3;


let base = createPattern('B3/S23') as MAPPattern;


let activeRegions: {[key: string]: {obj: string, x: number, y: number, time: number}} = {};

function addRegion(p: MAPPattern, obj: string, time: number): void {
    let found = false;
    let x2 = 0;
    let y2 = 0;
    let i = 0;
    for (let y = 0; y < p.height; y++) {
        for (let x = 0; x < p.width; x++) {
            if (p.data[i++] === 2) {
                x2 = x;
                y2 = y;
                found = true;
                break;
            }
        }
        if (found) {
            break;
        }
    }
    if (!found) {
        throw new Error('No center cell found');
    }
    let x = x2 + p.xOffset;
    let y = y2 + p.yOffset;
    activeRegions[p.toApgcode()] = {obj, x, y, time};
}

for (let key in ACTIVE_REGIONS) {
    let [code, x, y] = ACTIVE_REGIONS[key];
    let p = base.loadApgcode(code).shrinkToFit();
    for (let i = 0; i < ACTIVE_REGION_LOOKAHEAD_GENS; i++) {
        p.set(x, y, 2);
        addRegion(p, key + 'F', i);
        p.rotateRight();
        addRegion(p, key + 'R', i);
        p.rotateRight();
        addRegion(p, key + 'B', i);
        p.rotateRight();
        addRegion(p, key + 'L', i);
        p.rotateRight();
        p.flipVertical();
        addRegion(p, key + 'Fx', i);
        p.rotateRight();
        addRegion(p, key + 'Rx', i);
        p.rotateRight();
        addRegion(p, key + 'Bx', i);
        p.rotateRight();
        addRegion(p, key + 'Lx', i);
        p.set(x, y, 1);
        p.runGeneration();
        p.shrinkToFit();
    }
}


type CatalystType = 'block';

interface Catalyst {
    type: CatalystType;
    code: string;
    x: number;
    y: number;
}

type Partial = [MAPPattern, Catalyst[]];


// @ts-ignore
function addCatalysts(data: Partial): Partial[] {
    
}


let args = process.argv.slice(2);

let start: MAPPattern;
if (args[0].endsWith('!')) {
    start = base.loadRLE(args[0]);
} else if (args[0] in ACTIVE_REGIONS) {
    start = base.loadApgcode(ACTIVE_REGIONS[args[0]][0]);
} else {
    start = base.loadApgcode(args[0]);
}
start.shrinkToFit();

let startObj = '?';
let startObjTime = 0;
let startApgcode = start.toApgcode();
if (startApgcode in activeRegions) {
    let data = activeRegions[startApgcode];
    startObj = data.obj;
    startObjTime = data.time;
}

let maxCatalysts = Infinity;
if (args[1] !== undefined) {
    maxCatalysts = parseInt(args[2]);
    if (Number.isNaN(maxCatalysts)) {
        console.error('Invalid max catalysts number');
        process.exit(1);
    }
}

let depth = 1;
let data: Partial[] = [[start, []]];
let startTime = performance.now();
let prevUpdateTime = startTime;
let totalPartialsChecked = 0;
while (true) {
    console.log(`Searching depth ${depth} (${data.length} partials)`);
    prevUpdateTime = performance.now();
    let newData: Partial[] = [];
    let prevPartialsChecked = 0;
    for (let i = 0; i < data.length; i++) {
        newData.push(...addCatalysts(data[i]));
        totalPartialsChecked++;
        let now = performance.now();
        if ((now - prevUpdateTime) / 1000 > UPDATE_INTERVAL) {
            console.log(`${i}/${data.length} (${(i / data.length * 100).toFixed(3)}%) complete (${(i - prevPartialsChecked)/((now - prevPartialsChecked) / 1000)} partials/second current, ${totalPartialsChecked / ((now - startTime) / 1000)} overall)`);
            prevUpdateTime = now;
            prevPartialsChecked = i;
        }
    }
    data = newData;
}
