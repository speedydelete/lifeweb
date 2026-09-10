
const INITIAL_COLORS = [
    [0, 0, 0],
    [255, 255, 255],
    [0, 0, 255],
    [0, 255, 0],
    [255, 0, 255],
];

const TOTAL = 256;

const STEP = 2;


function linearize(x) {
    if (x <= 0.04045) {
        return x / 12.92;
    } else {
        return ((x + 0.055) / 1.055)**2;
    }
}

function rgbToXYZ([r, g, b]) {
    let lr = linearize(r / 255);
    let lg = linearize(g / 255);
    let lb = linearize(b / 255);
    let x = lr * 0.412453 + lg * 0.357580 + lb * 0.180423;
    let y = lr * 0.212671 + lg * 0.715160 + lb * 0.072169;
    let z = lr * 0.019334 + lg * 0.119193 + lb * 0.950227;
    return [x, y, z];
}

function xyzDistance(x, y) {
    return Math.sqrt((x[0] - y[0])**2 + (x[1] - y[1])**2 + (x[2] - y[2])**2);
}


let possibleRGB = [];
let possibleXYZ = [];
for (let r = 0; r < 256; r += STEP) {
    for (let g = 0; g < 256; g += STEP) {
        for (let b = 0; b < 256; b += STEP) {
            possibleRGB.push([r, g, b]);
            possibleXYZ.push(rgbToXYZ([r, g, b]));
        }
    }
}

for (let i = 0; i < INITIAL_COLORS.length; i++) {
    let color = INITIAL_COLORS[i];
    console.log(`${i} ${color[0]} ${color[1]} ${color[2]}`);
}

let doneXYZ = INITIAL_COLORS.map(rgbToXYZ);
for (let i = INITIAL_COLORS.length; i < TOTAL; i++) {
    let bestDist = 0;
    let bestIndex = -1;
    for (let j = 0; j < possibleXYZ.length; j++) {
        let color = possibleXYZ[j];
        let newDist = Infinity;
        for (let value of doneXYZ) {
            let dist = xyzDistance(color, value);
            if (dist < newDist) {
                newDist = dist;
            }
        }
        if (newDist > bestDist) {
            bestDist = newDist;
            bestIndex = j;
        }
    }
    let value = possibleRGB[bestIndex];
    doneXYZ.push(possibleXYZ[bestIndex]);
    possibleRGB.splice(bestIndex, 1);
    possibleXYZ.splice(bestIndex, 1);
    console.log(`${i} ${value[0]} ${value[1]} ${value[2]}`);
}

