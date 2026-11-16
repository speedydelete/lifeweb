
import * as fs from 'node:fs/promises';
import readline from 'node:readline/promises';

import {INT, MAPPattern, INTSeparator, createPattern, parse} from '../core/index.js';
import {ROTATIONS, applyRotation, RPFReference, RPFPattern, RPFParser} from './rpf.js';


let rl = readline.createInterface({input: process.stdin, output: process.stdout});

let base = createPattern('B3/S23') as MAPPattern;

let stdlibCode = (await fs.readFile(`${import.meta.dirname}/../../src/editor/stdlib.rpf`)).toString();
let parser = new RPFParser(base, '/stdlib.rpf', stdlibCode);
let stdlib = parser.parseFile();

let out = new RPFPattern(stdlib);

let catalysts: {[key: string]: RPFReference<MAPPattern>} = {};
let activeRegions: {[key: string]: RPFReference<MAPPattern>} = {};
for (let obj of Object.values(stdlib.data)) {
    if (obj.conduit || obj.data.size !== 1) {
        continue;
    }
    let ref = Array.from(obj.data)[0];
    let p = ref.p;
    if (p instanceof RPFPattern) {
        continue;
    }
    p = p.copy().shrinkToFit();
    p.xOffset = ref.x;
    p.yOffset = ref.y;
    if (obj.periodic) {
        // select between catalyst and spaceship
        let addTo = obj.periodic.dx === 0 && obj.periodic.dy === 0 ? catalysts : activeRegions;
        for (let i = 0; i < obj.periodic.period; i++) {
            for (let rotation of ROTATIONS) {
                addTo[applyRotation(p, rotation).toApgcode()] = out.createRef(p, p.xOffset, p.yOffset, rotation, i);
            }
            p.runGeneration();
            p.shrinkToFit();
        }
    } else {
        // active region
        for (let rotation of ROTATIONS) {
            activeRegions[applyRotation(p, rotation).toApgcode()] = out.createRef(p, p.xOffset, p.yOffset, rotation, 0);
        }
    }
}


// set up knots to merge all quasi objects
let knots = new Uint8Array(512);
for (let tr of ['2c', '2i', '2k', '2n', '3c', '3k', '3n', '3q', '3r', '3y', '4c', '4i', '4k', '4n', '4q', '4t', '4y', '4z', '5e', '5j', '5k', '5r', '6e', '6i']) {
    for (let i of INT.trs[tr]) {
        knots[i] = 1;
    }
}
for (let [tr, value] of [['3c', 0x18], ['3y', 0x28], ['4c', 0x38], ['4y', 0x47], ['5e', 0x58]] as const) {
    for (let i of INT.trs[tr]) {
        knots[i] = value;
    }
}


let p = parse((await fs.readFile('in.rle')).toString()) as MAPPattern;

let catP = base.copy().expand(0, p.height, 0, p.width);
let inputP = catP.copy();
let outputP = catP.copy();
for (let y = 0; y < p.height; y++) {
    for (let x = 0; x < p.width; x++) {
        let value = p.get(x, y);
        if (value === 0 || value === 2) {
            continue;
        } else if (value === 1) {
            catP.set(x, y, 1);
        } else if (value === 3) {
            inputP.set(x, y, 1);
        } else if (value === 4) {
            outputP.set(x, y, 1);
        } else {
            throw new Error(`State ${value} is not allowed in input conduits`);
        }
    }
}

let catSep = new INTSeparator(catP, knots);
for (let p of catSep.getObjects()) {
    p = p.copy();
    let x = p.xOffset;
    let y = p.yOffset;
    p.xOffset = 0;
    p.yOffset = 0;
    let code = p.toApgcode();
    if (!(code in catalysts)) {
        console.log('Unrecognized catalyst:');
        console.log(p.toRLE());
        try {
            let value = await rl.question(`Enter 'y' to add as a primitive, or anything else to exit: `);
            if (value === 'y') {
                out.add(p, x, y);
            } else {
                process.exit(0);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                process.stdout.write('\n');
                process.exit(0);
            } else {
                throw error;
            }
        }
    } else {
        let ref = catalysts[code].copy(out);
        ref.x += x;
        ref.y += y;
        out.add(ref);
    }
}

let inputs: RPFReference<MAPPattern>[] = [];
let inputSep = new INTSeparator(inputP, knots);
for (let p of inputSep.getObjects()) {
    p = p.copy();
    let x = p.xOffset;
    let y = p.yOffset;
    p.xOffset = 0;
    p.yOffset = 0;
    let code = p.toApgcode();
    if (!(code in activeRegions)) {
        console.log('Unrecognized active region:');
        console.log(p.toRLE());
        try {
            let value = await rl.question(`Enter 'y' to add as a primitive, or anything else to exit: `);
            if (value === 'y') {
                inputs.push(out.createRef(p, x, y));
            } else {
                process.exit(0);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                process.stdout.write('\n');
                process.exit(0);
            } else {
                throw error;
            }
        }
    } else {
        let ref = activeRegions[code].copy(out);
        ref.x += x;
        ref.y += y;
        inputs.push(ref);
    }
}

let outputs: RPFReference<MAPPattern>[] = [];
let outputSep = new INTSeparator(inputP, knots);
for (let p of outputSep.getObjects()) {
    p = p.copy();
    let x = p.xOffset;
    let y = p.yOffset;
    p.xOffset = 0;
    p.yOffset = 0;
    let code = p.toApgcode();
    if (!(code in activeRegions)) {
        console.log('Unrecognized active region:');
        console.log(p.toRLE());
        try {
            let value = await rl.question(`Enter 'y' to add as a primitive, or anything else to exit: `);
            if (value === 'y') {
                outputs.push(out.createRef(p, x, y));
            } else {
                process.exit(0);
            }
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                process.stdout.write('\n');
                process.exit(0);
            } else {
                throw error;
            }
        }
    } else {
        let ref = activeRegions[code].copy(out);
        ref.x += x;
        ref.y += y;
        outputs.push(ref);
    }
}


console.log('\n' + out.toString());
process.exit(0);
