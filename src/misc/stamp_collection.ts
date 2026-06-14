
import {Pattern, createPattern} from '../core/index.js';


const RULE = 'B2-ak4a5ij6ac/S12-k4a';

const DIGIT_HEIGHT = 13;
const DIGIT_WIDTH = 7;
const DIGIT_RLES: string[] = [
    'b5o2$o5bo$o5bo$o5bo$o5bo$o5bo$o5bo$o5bo$o5bo$o5bo2$b5o!',
    '3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo$3bo!',
    '6o2$6bo$6bo2$3b3o2$b3o2$o$o2$b6o!',
    '6o2$6bo$6bo$6bo2$6o2$6bo$6bo$6bo2$6o!',
    'o5bo$o5bo$o5bo$o5bo$o5bo$6bo$b4obo$6bo$6bo$6bo$6bo$6bo$6bo!',
    '2b5o$o$o$o$o2$b5o2$6bo$6bo$o5bo$o5bo$2b3o!',
    '2b5o$o$o$o$o$o$ob3o$o5bo$o5bo$o5bo$o5bo2$b5o!',
    '7o2$5bo$5bo2$4bo$4bo2$3bo$3bo2$2bo$2bo!',
    '2b3o$o5bo$o5bo$o5bo$o5bo2$b5o2$o5bo$o5bo$o5bo$o5bo$2b3o!',
    'b5o2$o5bo$o5bo$o5bo$o5bo$2b3obo$6bo$6bo$6bo$6bo$6bo$5o!',
];
const DIGIT_SPACING = 2;

const HORIZONTAL_SPACING = 10;
const VERTICAL_SPACING = 10;
const EQUAL_HEIGHT = true;
const EQUAL_WIDTH = true;
const DIGIT_PATTERN_SPACING = 0;

const RLES: [number, ...string[]][] = [
    [
        2,
        'bo$o$3bo$2bo!',
        '2o$bo$bo$2o!',
        'o4bo$ob2obo$3bo$2b2o!',
        '2b2o$o$obob2o2$2bo$2bo!',
        'bo3bo$2bobo$o5bo$o2bo2bo$3bo!',
        'bo$o$3bo$2b3o$3b2o!',
    ],
    [
        3,
        'obo2$obo!',
        'b2o$6bo$3bo2bo$2bobo$o2bo$o$4b2o!',
        '7b2o$5bo$6bo2$4bob2o$bo$2bobo$o3bo$o!',
        '6b3o$2bo$b2o2b3o$4bo$3bo$2bo$obo$obo$o!',
        'o2b2o$o$2bob2o$bo3bo2$2b3o!',
    ],
    [
        4,
        'obo2$2bo!',
        '2o$3bo$2bo2$6bo$5bo$7bo$7bo!',
        '5bo$5bo2$3bobobo2$2obo3bob2o2$3bobobo2$5bo$5bo!',
    ],
    [
        5,
        'bo3bo$o5bo$bo3bo!',
        '6bo$3bo2bob2o$4bobo$bo$2bo2$3o2$bo$bo!',
    ],
    [
        6,
        '3bo$2obo4bo$3bob2obo$8bo$6bo$6bo!',
        'o$o$2bo$bo2$5bo$4b2o2$7b2o$7bo2$11bo$10bo$12b2o!',
        'bo4b2o$2ob2o2$bo2bo$bobo$5b2o$o4bo$o!',
    ],
    [
        7,
        '5bo$5bo2$2bob3obo$o9bo$o4bo4bo$o4bo4bo!',
        '2obo2bob2o2$bobo2bobo$o8bo$3b4o!',
        '6bo$6bo$6bo$3bobobobo2$3bo5bo$3o7b3o$3bo5bo2$3bobobobo$6bo$6bo$6bo!',
    ],
    [
        8,
        '7b2o2$o$o2bobobo2$3bo3bo2$3bobobo2bo$10bo2$2b2o!',
        '2o2bobo2b2o2$2bo5bo$3bo3bo$4bobo3$b9o!',
        '4b2o$4bo2bo$6bo3b2o$5bo2bo$2o4bobo$o2bo$2bobo$bo$3b2o2$2bo$2bo!',
    ],
    [
        9,
        'obo7bobo$5b3o$obo7bobo$6bo$3b2obob2o$6bo$6bo!',
    ],
    [
        10,
        '2o2$bo2$b2o!',
        '7b2o3$3b2o2bo3bo$7bobobo$4bo$o$o2b2o5b2o2bo$14bo$10bo$3bobobo$3bo3bo2b2o3$6b2o!',
    ],
    [
        11,
        '4b5o2$7b4o2$o6b2o$o$o$obobo$obobo$2bo$2bo!',
    ],
    [
        12,
        '5bo$2b2obob2o$5bo$5bo2$3bo3bo$2obobobob2o2$3b5o!',
        '8bo$5b2obob2o$8bo$4bo7bo$3bobo5bobo$bo2bo7bo2bo$bo13bo2$3o11b3o2$bo13bo$bo2bo7bo2bo$3bobo5bobo$4bo7bo$8bo$5b2obob2o$8bo!',
    ],
    [
        13,
        '6b2o$2o4bo$obo5bo$2o6bo!',
        '13b2o$8bo2bo$5b2obo2b2o$8bo$o$o15bo$2bo3bo3bobo3bo$b2o7bo$6b2o7b3o2$b3o7b2o$8bo7b2o$2bo3bobo3bo3bo$2bo15bo$18bo$10bo$6b2o2bob2o$7bo2bo$4b2o!',
    ],
    [
        14,
        '2o$3bo$2bo4$3bobo$5bo$7bo$6bo$8b2o!',
        'b2o12b2o$2bo12bo$o4bobo2bobo4bo$o4b2o4b2o4bo5$4b2o6b2o$4bo8bo$6bo4bo$6bo4bo!',
    ],
    [
        15,
        '14b2o$9bo2bo$6b2obo2b2o$9bo2$o16bo$o10bobo3bo$2bo3bo4bo$b2o3bobo7b3o3$b3o7bobo3b2o$8bo4bo3bo$2bo3bobo10bo$2bo16bo2$10bo$6b2o2bob2o$7bo2bo$4b2o!',
    ],
    [
        16,
        '6bo$3bobo2bo$2obob2obob2o$3bobo2bo$6bo!',
    ],
    [
        17,
        '15b2o$10bo2bo$7b2obo2b2o$10bo2$18bo$o11bobo3bo$o6bo4bo$2bo14b3o$b2o4b2o2$12b2o4b2o$b3o14bo$8bo4bo6bo$2bo3bobo11bo$2bo2$10bo$6b2o2bob2o$7bo2bo$4b2o!',
    ],
    [
        18,
        '17b2o$12bo2bo$9b2obo2b2o$12bo3$14bobo$14bo$o7bo14bo$o8b2o12bo$2bo16b2o$b2o19b3o$19bo$6bo$b3o19b2o$5b2o16bo$2bo12b2o8bo$2bo14bo7bo$11bo$9bobo3$13bo$9b2o2bob2o$10bo2bo$7b2o!',
    ],
    [
        19,
        '15b2o$10bo2bo$7b2obo2b2o$10bo3$o11bobo4bo$o11bo6bo$2bo3bo$b2o3bobo9b3o3$b3o9bobo3b2o$15bo3bo$2bo6bo11bo$2bo4bobo11bo3$11bo$7b2o2bob2o$8bo2bo$5b2o!',
    ],
    [
        20,
        '8bobo$o$obobo3bo$4bo!',
        '8b5o3$10bo$10bo2$10bo$10bo$o19bo$o19bo$o2b2ob2o5b2ob2o2bo$o19bo$o19bo$10bo$10bo2$10bo$10bo3$8b5o!',
    ],
    [
        21,
        '7bo$7bo$7bo2$7bo$o4bo3bo4bo$o4bobobo4bo$2bo9bo$2bo3b3o3bo$2bo9bo!',
    ],
    [
        22,
        '9b3o2$8b5o5$7bobobobo$2bo15bo$obo4bo5bo4bobo$obo15bobo$obo4bo5bo4bobo$2bo15bo$7bobobobo5$8b5o2$9b3o!',
    ],
    [
        23,
    ],
    [
        24,
    ],
    [
        25,
    ],
    [
        26,
        '4b5o$10bo$8bobo$8bobo$o6b2obo$o9bo$o9bo$o3bo5bo$ob3o2$b7o!',
    ],
    [
        27,
    ],
    [
        28,
        '10bo$10bo$10bo$10bo$2b2ob2o$o$o$o!',
        '11b2o7b2o$14bo3bo$13b2o3b2o4$16bo2$16bo$16bo$16bo$o15bo15bo$o31bo$2bo27bo$b2o27b2o2$6bob4o9b4obo2$b2o27b2o$2bo27bo$o31bo$o15bo15bo$16bo$16bo$16bo2$16bo4$13b2o3b2o$14bo3bo$11b2o7b2o!',
    ],
    [
        29,
    ],
    [
        30,
        'bo10bo$bo10bo$5bo$4o6b4o$5bo$bo10bo$bo10bo!',
    ],
    [
        31,
    ],
    [
        32,
        '10b2o3b2o$13bo$13bo4$12bobo$11bo3bo$10bo5bo2$o7bo9bo7bo$o6bo11bo6bo$6bo13bo$b2o21b2o$6bo13bo$o6bo11bo6bo$o7bo9bo7bo2$10bo5bo$11bo3bo$12bobo4$13bo$13bo$10b2o3b2o!',
    ],
    [
        44,
        'bo15bo$bo15bo$5bo$4o6b2o3b4o$5bo$bo15bo$bo15bo!',
    ],
    [
        58,
        'bo20bo$bo20bo$5bo$4o6b2o3b2o3b4o$5bo$bo20bo$bo20bo!',
    ],
    [
        72,
        'bo25bo$bo25bo$5bo$4o6b2o3b2o3b2o3b4o$5bo$bo25bo$bo25bo!',
    ],
];


let base = createPattern(RULE);
let patterns = RLES.filter(x => x.length > 1).map(x => [x[0], (x.slice(1) as string[]).map(y => base.loadRLE(y).shrinkToFit().run(x[0]))] as [number, Pattern[]]);
let digitPatterns = DIGIT_RLES.map(x => base.loadRLE(x));

let maxWidth = Math.max(...patterns.map(x => Math.max(...x[1].map(y => y.width))));
let minHeight = DIGIT_HEIGHT;
if (EQUAL_HEIGHT) {
    minHeight = Math.max(minHeight, ...patterns.map(x => Math.max(...x[1].map(y => y.height))));
}
let maxPeriod = Math.max(...patterns.map(x => x[0]));
let maxDigits = maxPeriod.toString().length;
let digitWidth = maxDigits * (DIGIT_WIDTH + DIGIT_SPACING) - DIGIT_SPACING;
let digitPatternSpacing = DIGIT_PATTERN_SPACING + (EQUAL_WIDTH ? maxWidth : 0);

let rows: Pattern[] = [];
let fullHeight = 0;
let fullWidth = 0;
for (let [period, row] of patterns) {
    let digits = period.toString();
    let height = minHeight;
    let width = digitWidth + digitPatternSpacing;
    for (let p of row) {
        height = Math.max(height, p.height);
        width += (EQUAL_WIDTH ? maxWidth : p.width) + HORIZONTAL_SPACING;
    }
    width -= HORIZONTAL_SPACING;
    let p = base.copy();
    p.ensure(width, height);
    let x = digitWidth - (digits.length * (DIGIT_WIDTH + DIGIT_SPACING) - DIGIT_SPACING);
    for (let digit of digits) {
        p.insert(digitPatterns[Number(digit)], x, 0);
        x += DIGIT_WIDTH + DIGIT_SPACING;
    }
    x -= DIGIT_SPACING;
    x += digitPatternSpacing;
    for (let q of row) {
        p.insert(q, x, 0);
        x += (EQUAL_WIDTH ? maxWidth : q.width) + HORIZONTAL_SPACING;
    }
    rows.push(p);
    fullHeight += height + VERTICAL_SPACING;
    fullWidth = Math.max(fullWidth, width);
}
fullHeight -= VERTICAL_SPACING;

let p = base.copy();
p.ensure(fullWidth, fullHeight);
let y = 0;
for (let q of rows) {
    p.insert(q, 0, y);
    y += q.height + VERTICAL_SPACING;
}

p.shrinkToFit();
console.log(p.toRLE());
