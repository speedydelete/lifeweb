
import {LifewebError} from '../core/index.js';
import {Symmetry, basisToString, findBasis, SymmetryParser, PREDEFINED_SYMMETRY_NAMESPACE} from './index.js';


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


let helpButton = getElement('help-button');
let helpShown = false;

let mainElt = getElement('main');
let helpElt = getElement('help');
let symmetryWrapperElt = getElement('symmetry-wrapper');

helpButton.addEventListener('click', () => {
    helpShown = !helpShown;
    if (helpShown) {
        helpButton.textContent = 'Back';
        mainElt.style.display = 'none';
        symmetryWrapperElt.style.visibility = 'hidden';
        helpElt.style.display = 'flex';
    } else {
        helpButton.textContent = 'Help';
        mainElt.style.display = 'flex';
        symmetryWrapperElt.style.visibility = 'visible';
        helpElt.style.display = 'none';
    }
});


let symmetryInput = getElement('symmetry', 'input');
let basisElt = getElement('basis');

function updateBasis() {
    let symmetryText = symmetryInput.value;
    localStorage.ruleSymmetriesSymmetry = symmetryText;
    if (symmetryText === '') {
        return;
    }
    let symmetry: Symmetry;
    try {
        let parser = new SymmetryParser(symmetryText, Object.create(PREDEFINED_SYMMETRY_NAMESPACE));
        symmetry = parser.expression();
    } catch (error) {
        if (error instanceof LifewebError) {
            basisElt.style.color = '#ff0000';
            basisElt.textContent = String(error);
            return;
        } else {
            throw error;
        }
    }
    let basis = findBasis(symmetry);
    if (typeof basis === 'string') {
        basis = basis[0].toUpperCase() + basis.slice(1);
    } else {
        basis = basisToString(basis);
    }
    basisElt.style.color = '#000000';
    basisElt.textContent = basis;
}

symmetryInput.addEventListener('input', updateBasis);

if (localStorage.ruleSymmetriesSymmetry) {
    symmetryInput.value = localStorage.ruleSymmetriesSymmetry;
    updateBasis();
}


function updateSizes() {
    let rect = symmetryWrapperElt.getBoundingClientRect();
    basisElt.style.width = rect.width + 'px';
    basisElt.style.maxWidth = rect.width + 'px';
}

updateSizes();

window.addEventListener('resize', updateSizes);
