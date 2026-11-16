
import {LifewebError, ParserError} from '../core/index.js';
import {Vector, vectorToString, vectorsToRule, basisSorter, findBasis, parseSymmetry, getSymmetriesOfRule} from './index.js';


function getElement(id: string): HTMLElement;
function getElement<T extends keyof HTMLElementTagNameMap = keyof HTMLElementTagNameMap>(id: string, type: T): HTMLElementTagNameMap[T];
function getElement(id: string, type?: string): HTMLElement {
    let out = document.getElementById(id);
    if (!out) {
        throw new Error(`Missing element: '${id}'`);
    }
    if (type !== undefined) {
        let tag = out.tagName.toLowerCase();
        if (tag !== type) {
            throw new Error(`Element '${id}' is required to be of type '${type}' but is of type '${tag}'`);
        }
    }
    return out;
}


let mainElt = getElement('main');
let inputWrapperElt = getElement('input-wrapper');
let inputElt = getElement('input', 'input');
let textOutputElt = getElement('text-output');
let listOutputElt = getElement('list-output');

function updateSizes() {
    let rect = inputWrapperElt.getBoundingClientRect();
    mainElt.style.width = rect.width + 'px';
    mainElt.style.maxWidth = rect.width + 'px';
}

updateSizes();

window.addEventListener('resize', updateSizes);

let copyText = '';
textOutputElt.addEventListener('click', async () => {
    await navigator.clipboard.writeText(copyText);
});

const MODES: {[key: string]: {
    func: (input: string) => void;
    inputText: string;
}} = {};



let basisLength = -1;
let enabledVectors = new Set<Vector>();
let disabledVectors = new Set<Vector>();
function recomputeRule(): void {
    let rule = vectorsToRule(enabledVectors, disabledVectors);
    copyText = rule;
    if (rule.includes('contradiction')) {
        textOutputElt.textContent = rule[0].toUpperCase() + rule.slice(1);
        listOutputElt.style.maxHeight = `calc(100% - 1.5em)`;
    } else {
        textOutputElt.textContent = `Rule: ${rule}\nContains 2^${basisLength} rules`;
        listOutputElt.style.maxHeight = `calc(100% - 2.5em)`;
    }
}

function updateBasis(symmetryText: string): void {
    let symmetry = parseSymmetry(symmetryText);
    let basis = findBasis(symmetry);
    if (typeof basis === 'string') {
        textOutputElt.textContent = basis[0].toUpperCase() + basis.slice(1);
        copyText = basis;
        listOutputElt.style.maxHeight = `calc(100% - 1.5em)`;
        return;
    }
    basis = basis.sort((x, y) => basisSorter(x, y));
    basisLength = basis.length;
    enabledVectors.clear();
    disabledVectors.clear();
    for (let vector of basis) {
        disabledVectors.add(vector);
        let elt = document.createElement('div');
        elt.className = 'basis-vector';
        let checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                enabledVectors.add(vector);
                disabledVectors.delete(vector);
            } else {
                enabledVectors.delete(vector);
                disabledVectors.add(vector);
            }
            recomputeRule();
        });
        elt.append(checkbox, vectorToString(vector));
        listOutputElt.append(elt);
    }
    recomputeRule();
}

MODES['basis-of-symmetry'] = {
    func: updateBasis,
    inputText: 'Symmetry',
};


function updateSymmetriesOfRule(rule: string): void {
    let symmetries = getSymmetriesOfRule(rule);
    textOutputElt.textContent = symmetries;
    copyText = symmetries;
}

MODES['symmetries-of-rule'] = {
    func: updateSymmetriesOfRule,
    inputText: 'Rule',
};


let modeSelect = getElement('mode', 'select');

function update() {
    let inputValue = inputElt.value;
    localStorage.ruleSymmetriesInput = inputValue;
    textOutputElt.style.color = '#000000';
    textOutputElt.textContent = '';
    copyText = '';
    listOutputElt.replaceChildren();
    if (inputValue === '') {
        return;
    }
    try {
        MODES[modeSelect.value].func(inputValue);
    } catch (error) {
        if (error instanceof LifewebError) {
            textOutputElt.style.color = '#ff0000';
            if (error instanceof ParserError) {
                textOutputElt.textContent = error.stack;
            } else {
                textOutputElt.textContent = String(error);
                // ParserError already does a console.trace() so we don't need to spam the console more if it's a ParserError
                console.error(error);
            }
        } else {
            throw error;
        }
    }
}

inputElt.addEventListener('input', update);

let inputTextElt = getElement('input-text');

function updateMode() {
    let modeStr = modeSelect.value;
    localStorage.ruleSymmetryMode = modeStr;
    let mode = MODES[modeStr];
    inputTextElt.textContent = mode.inputText;
    update();
}

modeSelect.addEventListener('change', updateMode);

if (localStorage.ruleSymmetryMode !== undefined) {
    modeSelect.value = localStorage.ruleSymmetryMode;
}
if (localStorage.ruleSymmetriesInput !== undefined) {
    inputElt.value = localStorage.ruleSymmetriesInput;
}
updateMode();
