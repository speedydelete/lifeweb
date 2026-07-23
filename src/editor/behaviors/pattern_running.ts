
import {RPFPattern} from '../rpf.js';
import {addHook} from '../base.js';
import {pushUndo} from './undo_redo.js';


declare global {

    var running: boolean;
    var step: number;
    var stepEvery: number;
    var beforeRunning: RPFPattern;
    var hasRan: boolean;

}


let speedElt = getElement('speed');

let gensElt = getElement('gens');
let popElt = getElement('pop');

addHook('frame', async () => {
    if (running && frameCount % stepEvery === 0) {
        for (let i = 0; i < step; i++) {
            p.runGeneration();
            p.shrinkToFit();
        }
    } else {
        p.shrinkToFit();
    }
    speedElt.textContent = stepEvery === 1 ? `${step}x` : `1/${stepEvery}x`;
    gensElt.textContent = String(p.generation);
    popElt.textContent = String(p.population);
});


let runButton = getElement('run');
let pauseButton = getElement('pause');
let stepButton = getElement('step');
let resetButton = getElement('reset');

addHook('run', () => {
    pushUndo();
    if (!hasRan) {
        beforeRunning = p.copy();
        hasRan = true;
    }
    running = true;
    runButton.style.display = 'none';
    pauseButton.style.display = 'block';
    runButton.classList.add('selected');
    pauseButton.classList.add('selected');
    stepButton.classList.remove('selected');
    resetButton.classList.remove('selected');
});

addHook('pause', () => {
    running = false;
    runButton.style.display = 'block';
    pauseButton.style.display = 'none';
    runButton.classList.add('selected');
    pauseButton.classList.add('selected');
    stepButton.classList.remove('selected');
    resetButton.classList.remove('selected');
});

addHook('step', () => {
    if (running) {
        running = false;
        runButton.style.display = 'block';
        pauseButton.style.display = 'none';
    }
    if (!hasRan) {
        beforeRunning = p.copy();
        hasRan = true;
    }
    pushUndo();
    p.runGeneration();
    p.shrinkToFit();
    runButton.classList.remove('selected');
    pauseButton.classList.remove('selected');
    stepButton.classList.add('selected');
    resetButton.classList.remove('selected');
});

addHook('reset', () => {
    pushUndo();
    hasRan = false;
    running = false;
    p = beforeRunning;
    runButton.style.display = 'block';
    pauseButton.style.display = 'none';
    runButton.classList.remove('selected');
    pauseButton.classList.remove('selected');
    stepButton.classList.remove('selected');
    resetButton.classList.add('selected');
});

addHook('load-pattern', () => {
    running = false;
    beforeRunning = p.copy();
    hasRan = false;
    runButton.classList.remove('selected');
    runButton.style.display = 'block';
    pauseButton.classList.remove('selected');
    pauseButton.style.display = 'none';
    stepButton.classList.remove('selected');
    resetButton.classList.add('selected');
});;


addHook('faster', event => {
    if (event) {
        event.preventDefault();
    }
    if (stepEvery > 1) {
        stepEvery /= 2;
        if (stepEvery <= 1) {
            step = Math.round(1/stepEvery);
            stepEvery = 1;
        }
    } else {
        step *= 2;
    }
});

addHook('slower', event => {
    if (event) {
        event.preventDefault();
    }
    if (step > 1) {
        step /= 2;
        if (step < 1) {
            stepEvery = Math.round(1 / step);
            step = 1;
        }
    } else {
        stepEvery *= 2;
    }
});

addHook('set-speed', () => {
    let value = prompt('Enter speed (as a positive integer n or a fraction of the form 1/n):');
    if (!value) {
        return;
    }
    if (value.match(/^\d+x?$/)) {
        step = parseInt(value);
        stepEvery = 1;
    } else if (value.match(/^1\/\d+x?$/)) {
        step = 1;
        stepEvery = parseInt(value.slice(2));
    } else if (value === '') {
        step = 1;
        stepEvery = 1;
    } else {
        alert(`Error: Invalid speed: ${value}`);
    }
});
