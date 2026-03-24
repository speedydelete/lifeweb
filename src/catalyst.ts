
import {MAPPattern, INTSeparator, createPattern} from './core/index.js';


const ACTIVE_REGIONS: {[key: string]: [string, number, number][]} = {
    'R': [['472', 1, 1]],
    'B': [['pe4', 1, 2], ['d72', 1, 1]],
    'H': [['74e', 1, 2]],
    'C': [['c97', 2, 1]],
    'D': [['ci97', 2, 1]],
    'E': [['1572', 2, 1]],
    'P': [['557', 1, 1], ['577', 1, 1]],
    'Q': [['3us8z31', 2, 3]],
    'W': [['c53', 1, 1]],
    'U': [['77ac', 1, 1]],
    'L': [['5889e', 4, 2]],
    'M': [['aghgis', 5, 3]],
};

const ACTIVE_REGION_LOOKAHEAD_GENS = 20;

const UPDATE_INTERVAL = 3;


let base = createPattern('B3/S23') as MAPPattern;

const BLOCK = base.loadApgcode('33').shrinkToFit();

let empty = new Uint8Array(65536);


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
    for (let [code, x, y] of ACTIVE_REGIONS[key]) {
        let p = base.loadApgcode(code).shrinkToFit();
        for (let i = 0; i < ACTIVE_REGION_LOOKAHEAD_GENS; i++) {
            let prevCenter = p.get(x, y);
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
            p.set(x, y, prevCenter);
            p.runGeneration();
            p.shrinkToFit();
        }
    }
}


type CatalystType = 'block';

interface Catalyst {
    type: CatalystType;
    p: MAPPattern;
    x: number;
    y: number;
}

interface Partial {
    p: MAPPattern;
    catP?: MAPPattern;
    cats: Catalyst[];
    minCatX: number;
    maxCatX: number;
    minCatY: number;
    maxCatY: number;
    p2Prev?: {
        hash: number;
        pop: number;
        data: Uint8Array;
    };
}


function addCatalystsToPattern(p: MAPPattern, data: Partial): MAPPattern {
    p = p.copy();
    p.expand(
        data.minCatY < p.yOffset ? p.yOffset - data.minCatY : 0,
        data.maxCatY > p.yOffset + p.height ? data.minCatY - (p.yOffset + p.height) : 0,
        data.minCatX < p.xOffset ? p.xOffset - data.minCatX : 0,
        data.maxCatY > p.yOffset + p.height ? data.minCatY - (p.yOffset + p.height) : 0,
    );
    for (let cat of data.cats) {
        let x = cat.x + p.xOffset;
        let y = cat.y + p.yOffset;
        if (cat.type === 'block') {
            let i = y * p.width + x;
            p.data[i] = 1;
            p.data[i + 1] = 1;
            p.data[i + p.width] = 1;
            p.data[i + p.width + 1] = 1;
        } else {
            let index = 0;
            for (let i = 0; i < cat.p.height; i++) {
                p.data.set(cat.p.data.slice(index, index + cat.p.width), (y + i) * p.width + x);
                index += cat.p.width;
            }
        }
    }
    return p;
}

function removeCatalystsFromPattern(p: MAPPattern, data: Partial): MAPPattern {
    p = p.copy();
    for (let cat of data.cats) {
        let x = cat.x + p.xOffset;
        let y = cat.y + p.yOffset;
        if (cat.type === 'block') {
            let i = y * p.width + x;
            p.data[i] = 0;
            p.data[i + 1] = 0;
            p.data[i + p.width] = 0;
            p.data[i + p.width + 1] = 0;
        } else {
            let i = (cat.y + p.yOffset) * p.width + cat.x + p.xOffset;
            for (let y = 0; y < cat.p.height; y++) {
                for (let x = 0; x < cat.p.width; x++) {
                    p.data[i++] = 0;
                }
            }
        }
    }
    return p;
}

function patternsAreSame(p: MAPPattern, q: MAPPattern): boolean {
    if (p.height !== q.height || p.width !== q.width) {
        return false;
    }
    for (let i = 0; i < p.data.length; i++) {
        if (p.data[i] !== q.data[i]) {
            return false;
        }
    }
    return true;
}


function addCatalyst(out: Partial[], {p, cats, minCatX, maxCatX, minCatY, maxCatY, p2Prev}: Partial, type: CatalystType, q: MAPPattern, x: number, y: number, restoreTime: number): void {
    for (let cat of cats) {
        // code to check if overlap, return if overlap
    }
    // code to check if catalyst actually works
    out.push({p: p.copy(), cats, minCatX, maxCatX, minCatY, maxCatY, p2Prev});
}

function searchSingleObject(data: Partial): false | Partial[] {
    let {p, p2Prev} = data;
    let prevHash = p.hash32();
    let prevPop = p.population;
    let prevData = p.data;
    let catP = data.catP ? data.catP : addCatalystsToPattern(p, data);
    p.runGeneration();
    if (p.population === 0) {
        return false;
    }
    catP.runGeneration();
    let q = removeCatalystsFromPattern(catP, data);
    if (!patternsAreSame(p, q)) {
        return false;
    }
    if ((p.data.length === prevData.length && p.population === prevPop && p.hash32() === prevHash && p.data.every((x, i) => prevData[i] === x)) || (p2Prev && (p.data.length === p2Prev.data.length && p.population === p2Prev.pop && p.hash32() === p2Prev.hash && p.data.every((x, i) => p2Prev.data[i] === x)))) {
        return false;
    }
    data = {p, catP, cats: data.cats, minCatX: data.minCatX, minCatY: data.minCatY, maxCatX: data.maxCatX, maxCatY: data.maxCatY, p2Prev: {hash: prevHash, pop: prevPop, data: prevData}};
    let out: Partial[] = [data];
    let top = p.data;
    let bottom = p.data.slice(p.size - p.width);
    let left = new Uint8Array(p.height);
    let right = new Uint8Array(p.width);
    // block
    for (let x = 1; x < p.width - 1; x++) {
        if (top[x] && !top[x - 1] && !top[x + 1]) {
            
        }
        if (bottom[x] && !bottom[x - 1] && !bottom[x + 1]) {

        }
    }
}


let args = process.argv.slice(2);

let start: MAPPattern;
if (args[0].endsWith('!')) {
    start = base.loadRLE(args[0]);
} else if (args[0] in ACTIVE_REGIONS) {
    start = base.loadApgcode(ACTIVE_REGIONS[args[0]][0][0]);
} else {
    start = base.loadApgcode(args[0]);
}
start.shrinkToFit();

let startObj: string;
let startObjTime: number;
let startApgcode = start.toApgcode();
if (startApgcode in activeRegions) {
    let data = activeRegions[startApgcode];
    startObj = data.obj;
    startObjTime = data.time;
    start.xOffset -= data.x;
    start.yOffset -= data.y;
} else {
    startObj = '(' + startApgcode + ')';
    startObjTime = 0;
}

let maxCatalysts = Infinity;
if (args[1] !== undefined) {
    maxCatalysts = parseInt(args[1]);
    if (Number.isNaN(maxCatalysts)) {
        console.error('Invalid max catalysts number');
        process.exit(1);
    }
}

let depth = 1;
let data: Partial[] = [{p: start, cats: [], minCatX: 0, maxCatX: 0, minCatY: 0, maxCatY: 0}];
let startTime = performance.now();
let prevUpdateTime = startTime;
let totalPartialsChecked = 0;
while (true) {
    console.log(`Searching depth ${depth} (${data.length} partials)`);
    prevUpdateTime = performance.now();
    let newData: Partial[] = [];
    let prevPartialsChecked = 0;
    for (let i = 0; i < data.length; i++) {
        let value = searchSingleObject(data[i]);
        if (value) {
            newData.push(...value);
        }
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
