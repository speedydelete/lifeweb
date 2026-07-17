
import * as fs from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {Pattern, MAPPattern, getKnots, INTSeparator, createPattern} from '../core/index.js';


let base = createPattern('B3/S23') as MAPPattern;


const X = -1;

function match(p: Pattern, x: number, y: number, shift: number, value: number[][]): boolean {
    x -= p.xOffset + shift;
    y -= p.yOffset + shift;
    if (x < 0 || x + value[0].length > p.width || y < 0 || y + value.length > p.height) {
        return false;
    }
    for (let y2 = 0; y2 < value.length; y2++) {
        let row = value[y2];
        for (let x2 = 0; x2 < row.length; x2++) {
            if (row[x2] === X) {
                continue;
            } else {
                if (row[x2] !== p.get(x + x2, y + y2)) {
                    return false;
                }
            }
        }
    }
    return true;
}

function normalizeObj(obj: string): string {
    return obj.toLowerCase().replaceAll(/[ /-]/g, '');
}

function hasObjectAt(p: Pattern, x: number, y: number, obj: string, loose: boolean = false): boolean {
    let originalObj = obj;
    obj = normalizeObj(obj);
    let value;
    if (obj === 'block') {
        value = [
            [X, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'horizontalblinker') {
        value = [
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'verticalblinker') {
        value = [
            [X, 0, 0, 0, X],
            [0, 0, 0, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0],
            [0, 0, 0, 0, 0],
            [X, 0, 0, 0, X],
        ];
    } else if (obj === 'horizontalbeehive') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'verticalbeehive') {
        value = [
            [X, X, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'nwglider') {
        value = [
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 0, 1, 0, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, X],
            [X, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'neglider') {
        value = [
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 1, 0, 0],
            [X, 0, 0, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'swglider') {
        value = [
            [X, X, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 0, 0, X],
            [0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'seglider') {
        value = [
            [X, X, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, X],
            [X, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 0, 1, 0, 0],
            [0, 0, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'nwloaf') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 0, 0, X],
            [X, 0, 0, 0, 0, 0, X, X],
            [X, X, 0, 0, 0, X, X, X],
        ];
    } else if (obj === 'neloaf') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 1, 0, 0],
            [X, 0, 0, 0, 1, 0, 0, 0],
            [X, X, 0, 0, 0, 0, 0, X],
            [X, X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'swloaf') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 0, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [X, 0, 0, 1, 1, 0, 0, 0],
            [X, X, 0, 0, 0, 0, 0, X],
            [X, X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'seloaf') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, X],
            [X, 0, 0, 0, 0, 0, X, X],
            [X, X, 0, 0, 0, X, X, X],
        ];
    } else if (obj === 'nwboat') {
        value = [
            [X, 0, 0, 0, 0, X, X],
            [0, 0, 0, 0, 0, 0, X],
            [0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'neboat') {
        value = [
            [X, X, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'swboat') {
        value = [
            [X, X, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'seboat') {
        value = [
            [X, X, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [X, 0, 0, 0, 0, 0, 0],
            [X, X, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'nwseship') {
        value = [
            [X, 0, 0, 0, 0, X, X],
            [0, 0, 0, 0, 0, 0, X],
            [0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [X, 0, 0, 0, 0, 0, 0],
            [X, X, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'neswship') {
        value = [
            [X, X, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 1, 1, 0, 0],
            [0, 0, 1, 0, 1, 0, 0],
            [0, 0, 1, 1, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'pond') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'nwsebarge') {
        value = [
            [X, X, 0, 0, 0, X, X, X],
            [X, 0, 0, 0, 0, 0, X, X],
            [0, 0, 0, 1, 0, 0, 0, X],
            [0, 0, 1, 0, 1, 0, 0, 0],
            [0, 0, 0, 1, 0, 1, 0, 0],
            [X, 0, 0, 0, 1, 0, 0, 0],
            [X, X, 0, 0, 0, 0, 0, X],
            [X, X, X, 0, 0, 0, X, X],
        ];
    } else if (obj === 'horizontalbiblock') {
        value = [
            [X, 0, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'verticalbiblock') {
        value = [
            [X, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0],
            [X, 0, 0, 0, 0, X],
        ];
    } else if (obj === 'neswverticalhalfblockade') {
        value = [
            [X, X, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, 0, 0],
            [X, 0, 0, 1, 1, 0, 0],
            [X, 0, 0, 1, 1, 0, 0],
            [X, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, X],
            [0, 0, 1, 1, 0, 0, X],
            [0, 0, 1, 1, 0, 0, X],
            [0, 0, 0, 0, 0, 0, X],
            [X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'theblockandbeehive') {
        value = [
            [X, 0, 0, 0, 0, X, X, X, X, X, X, X],
            [0, 0, 0, 0, 0, 0, X, X, X, X, X, X],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, X, X],
            [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            [X, X, X, X, 0, 0, 0, 1, 1, 0, 0, 0],
            [X, X, X, X, X, 0, 0, 0, 0, 0, 0, X],
            [X, X, X, X, X, X, 0, 0, 0, 0, X, X],
        ];
    } else if (obj === 'thepondandblock') {
        value = [
            [X, X, 0, 0, 0, 0, X, X],
            [X, 0, 0, 0, 0, 0, 0, X],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 1, 0, 0, 1, 0, 0],
            [0, 0, 0, 1, 1, 0, 0, 0],
            [X, 0, 0, 0, 0, 0, 0, X],
            [X, X, 0, 0, 0, 0, 0, 0],
            [X, X, 0, 0, 1, 1, 0, 0],
            [X, X, 0, 0, 1, 1, 0, 0],
            [X, X, 0, 0, 0, 0, 0, 0],
            [X, X, X, 0, 0, 0, 0, X],
        ];
    } else {
        throw new Error(`Object does not exist: '${originalObj}' (resolved to '${obj}')`);
    }
    let shift;
    if (loose) {
        shift = 0;
        value = value.slice(2, -2).map(x => x.slice(2, -2));
    } else {
        shift = 2;
    }
    return match(p, x, y, shift, value);
}

let objPatterns = Object.fromEntries(Object.entries({
    'block': '33',
    'horizontalblinker': '111',
    'verticalblinker': '7',
    'horizontalbeehive': '2552',
    'verticalbeehive': '696',
    'nwglider': '351',
    'neglider': '153',
    'swglider': '654',
    'seglider': '456',
    'nwloaf': '6952',
    'neloaf': '2596',
    'swloaf': '69a4',
    'seloaf': '4a96',
    'nwboat': '352',
    'neboat': '253',
    'swboat': '652',
    'seboat': '256',
    'nwseship': '356',
    'neswship': '653',
    'pond': '6996',
    'nwsebarge': '25a4',
    'horizontalbiblock': '33033',
    'verticalbiblock': 'rr',
    'neswverticalhalfblockade': 'gj3z11',
    'theblockandbeehive': '33w8kk8',
    'thepondandblock': '6996zw66',
}).map(x => [x[0], base.loadApgcode(x[1]).shrinkToFit()]));

function getObjectPattern(obj: string): Pattern {
    let out = objPatterns[normalizeObj(obj)];
    if (!(out instanceof Pattern)) {
        throw new Error(`Object does not exist: '${obj}' (resolved to '${normalizeObj(obj)}')`);
    }
    return out;
}


let knots = getKnots(base.trs);

function getInputCoords(p: Pattern): string | [number, number] {
    let sep = new INTSeparator(p as MAPPattern, knots);
    let x = undefined;
    let y = undefined;
    for (let obj of sep.getObjects()) {
        if (obj.toApgcode() === INPUT_APGCODE) {
            x = obj.xOffset;
            y = obj.yOffset;
        }
    }
    if (x === undefined || y === undefined) {
        return 'cannot find input';
    }
    return [x, y];
}


interface HFObject {
    obj: string;
    x: number;
    y: number;
    gliders: {
        dir: 'NW' | 'NE' | 'SW' | 'SE';
        x: number;
        y: number;
    }[];
}

let hfObjects: HFObject[] = [
    {obj: 'block', x: -1, y: -4, gliders: [{dir: 'NE', x: -1, y: 0}]},
    {obj: 'horizontal beehive', x: -2, y: 1, gliders: [{dir: 'SW', x: 2, y: -3}]},
    {obj: 'NE loaf', x: -2, y: 0, gliders: [{dir: 'NE', x: -7, y: 2}, {dir: 'SE', x: -7, y: -1}]},
    {obj: 'SW loaf', x: 4, y: 0, gliders: [{dir: 'NE', x: -1, y: 0}]},
    {obj: 'NW boat', x: 1, y: 1, gliders: [{dir: 'NW', x: -4, y: 0}]},
    {obj: 'SW boat', x: -1, y: 4, gliders: [{dir: 'NW', x: 2, y: 1}]},
    {obj: 'NW/SE barge', x: -1, y: -1, gliders: [{dir: 'SE', x: 0, y: -6}]},
    {obj: 'vertical bi-block', x: -1, y: -2, gliders: [{dir: 'SE', x: -6, y: -6}]},
    {obj: 'vertical bi-block', x: 1, y: -3, gliders: [{dir: 'SE', x: -4, y: -4}]},
    {obj: 'NE/SW vertical half-blockade', x: -2, y: 4, gliders: [{dir: 'SE', x: -6, y: -1}]},
    {obj: 'the block and beehive', x: -1, y: -3, gliders: [{dir: 'NE', x: -5, y: 3}]},
    {obj: 'the pond and block', x: -3, y: 0, gliders: [{dir: 'NE', x: -8, y: 9}]},
];

interface HFCheckCurrentData {
    obj: HFObject;
    startGen: number;
    missingCatCells: number;
    time: number;
}

const CONFIRM_HF_ADJUST = 64;
// should be greater than CONFIRM_HF_ADJUST
const CONFIRM_HF_EXPAND = 96;

function confirmHF(catP: Pattern, hfX: number, hfY: number, current: HFCheckCurrentData): undefined | string {
    let obj = current.obj;
    // check that the glider can get through
    let catP2 = catP.copy();
    catP2.expand(CONFIRM_HF_EXPAND, CONFIRM_HF_EXPAND, CONFIRM_HF_EXPAND, CONFIRM_HF_EXPAND);
    let found: undefined | Pattern = undefined;
    for (let glider of obj.gliders) {
        let {dir, x, y} = glider;
        let p = catP2.copy();
        let x2;
        let y2;
        if (dir === 'NW') {
            x2 = x + CONFIRM_HF_ADJUST;
            y2 = y + CONFIRM_HF_ADJUST;
        } else if (dir === 'NE') {
            x2 = x - CONFIRM_HF_ADJUST;
            y2 = y + CONFIRM_HF_ADJUST;
        } else if (dir === 'SW') {
            x2 = x + CONFIRM_HF_ADJUST;
            y2 = y - CONFIRM_HF_ADJUST;
        } else {
            x2 = x - CONFIRM_HF_ADJUST;
            y2 = y - CONFIRM_HF_ADJUST;
        }
        p.insert(getObjectPattern(`${dir} glider`), x2 + hfX - p.xOffset, y2 + hfY - p.yOffset);
        p.run(256);
        if (hasObjectAt(p, x + hfX, y + hfY, `${dir} glider`, true)) {
            found = p;
            break;
        }
    }
    if (!found) {
        return;
    }
    let p = found;
    // check that the HF is restored when ran with the glider
    p.insert(getObjectPattern(obj.obj), obj.x + hfX - p.xOffset, obj.y + hfY - p.yOffset);
    p.shrinkToFit();
    p.generation = 0;
    let outRLE = p.toRLE(false).replaceAll('\n', '');
    let notFound = false;
    for (let i = 0; i < CONFIRM_HF_GENS; i++) {
        if (hasObjectAt(p, hfX + obj.x, hfY + obj.y, obj.obj)) {
            // skip when it happens at the start
            if (!notFound) {
                p.runGeneration();
                p.shrinkToFit();
                continue;
            }
            let genStr = current.time === Infinity ? `${p.generation}+` : `${p.generation} for ${current.time} generations`;
            return `Restores ${obj.obj} in generation ${genStr} (${current.missingCatCells}/${catP.population} missing catalyst cells):\n${outRLE}`;
        } else {
            notFound = true;
        }
        p.runGeneration();
        p.shrinkToFit();
    }
}

function getMissingCatCells(p: Pattern, catP: Pattern): number {
    let out = 0;
    for (let y = 0; y < catP.height; y++) {
        for (let x = 0; x < catP.width; x++) {
            if (catP.get(x, y) && !p.get(x - p.xOffset + catP.xOffset, y - p.yOffset + catP.yOffset)) {
                out++;
            }
        }
    }
    return out;
}

function checkHF(p: Pattern): undefined | string {
    p = p.copy().shrinkToFit();
    let sep = new INTSeparator(p as MAPPattern, knots);
    let hfX = undefined;
    let hfY = undefined;
    for (let obj of sep.getObjects()) {
        if (obj.toApgcode() === '79b4') {
            hfX = obj.xOffset + 1;
            hfY = obj.yOffset + 1;
        }
    }
    if (hfX === undefined || hfY === undefined) {
        throw new Error('Cannot find input honey farm');
    }
    let catP = p.copy();
    catP.set(hfX - 1, hfY - 1, 0);
    catP.set(hfX, hfY - 1, 0);
    catP.set(hfX + 1, hfY - 1, 0);
    catP.set(hfX - 1, hfY, 0);
    catP.set(hfX + 1, hfY, 0);
    catP.set(hfX - 1, hfY + 1, 0);
    catP.set(hfX + 2, hfY + 1, 0);
    catP.set(hfX, hfY + 2, 0);
    catP.set(hfX + 1, hfY + 2, 0);
    let current: undefined | HFCheckCurrentData = undefined;
    for (let i = 0; i < (current ? MAX_GENS + RESTORE_EXTRA_GENS : MAX_GENS); i++) {
        let obj;
        for (let value of hfObjects) {
            if (hasObjectAt(p, hfX + value.x, hfY + value.y, value.obj)) {
                obj = value;
                break;
            }
        }
        if (obj && !current) {
            current = {obj, startGen: p.generation, missingCatCells: getMissingCatCells(p, catP), time: 0};
        } else if ((!obj && current) || (obj && current && obj !== current.obj)) {
            current.time = p.generation - current.startGen;
            console.log(p.generation, current.startGen, current.time);
            let out = confirmHF(catP, hfX, hfY, current);
            if (out) {
                return out;
            } else {
                if (obj) {
                    current = {obj, startGen: p.generation, missingCatCells: getMissingCatCells(p, catP), time: 0};
                } else {
                    current = undefined;
                }
            }
        }
        p.runGeneration();
        p.shrinkToFit();
    }
    if (current) {
        current.time = Infinity;
        return confirmHF(catP, hfX, hfY, current);
    }
}


let prev: 'other' | 'winner' | 'completed' = 'other';

function onLine(line: string) {
    if (line === 'Winner:') {
        prev = 'winner';
    } else if (line.includes('LifeBellman')) {
        prev = 'winner';
    } else if (line === 'Completed:' || line === 'Result found:' || line.startsWith('Eater found') || line.startsWith('Non-eater found')) {
        prev = 'completed';
    } else if (prev === 'winner') {
        prev = 'other';
        return;
    } else if (prev === 'completed') {
        prev = 'other';
        let p = base.loadRLE(line).shrinkToFit();
        p.xOffset = 0;
        p.yOffset = 0;
        let value = checkHF(p);
        if (value) {
            console.log(value);
        } else {
            console.log(`Bad:\n${p.toRLE(false).replaceAll('\n', '')}`);
        }
    } else {
        prev = 'other';
        console.log(line);
    }
}


const MAX_GENS = 256;
const INPUT_APGCODE = '456';

// only for checkPi and checkHF
const RESTORE_EXTRA_GENS = 512;
// only for checkHF, should be greater than or equal to MAX_GENS + RESTORE_EXTRA_GENS
const CONFIRM_HF_GENS = 1024;

let rl = createInterface({
    input: process.stdin,
    terminal: true,
});
rl.on('line', onLine);

// let data = (await fs.readFile('out3.txt')).toString();
// for (let line of data.split('\n').slice(37904)) {
//     onLine(line);
// }
