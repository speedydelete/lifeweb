
import {LifewebError} from '../core/index.js';
import {Symmetry, Vector, basisSorter, vectorToString, vectorsToRule, findBasis, SymmetryParser, PREDEFINED_SYMMETRY_NAMESPACE} from './index.js';


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


function updateSizes() {
    let rect = symmetryWrapperElt.getBoundingClientRect();
    mainElt.style.width = rect.width + 'px';
    mainElt.style.maxWidth = rect.width + 'px';
}

updateSizes();

window.addEventListener('resize', updateSizes);


let enabledVectors = new Set<Vector>();
let disabledVectors = new Set<Vector>();
let computedRuleElt = getElement('computed-rule');
let computedRule = '';
computedRuleElt.addEventListener('click', async () => {
    await navigator.clipboard.writeText(computedRule);
});

function recomputeRule() {
    computedRule = vectorsToRule(enabledVectors, disabledVectors);
    if (computedRule.includes('contradiction')) {
        computedRuleElt.textContent = computedRule[0].toUpperCase() + computedRule.slice(1);
    } else {
        computedRuleElt.textContent = `Rule: ${computedRule}`;
    }
}

let symmetryInput = getElement('symmetry', 'input');
let basisElt = getElement('basis');

function updateBasis() {
    let symmetryText = symmetryInput.value;
    localStorage.ruleSymmetriesSymmetry = symmetryText;
    if (symmetryText === '') {
        basisElt.replaceChildren();
        computedRuleElt.textContent = '\u200b';
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
            computedRuleElt.textContent = '\u200b';
            return;
        } else {
            throw error;
        }
    }
    basisElt.style.color = '#000000';
    let basis = findBasis(symmetry);
    if (typeof basis === 'string') {
        basisElt.textContent = basis[0].toUpperCase() + basis.slice(1);
        computedRuleElt.textContent = '\u200b';
        return;
    }
    basis = basis.sort(basisSorter);
    basisElt.replaceChildren();
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
        basisElt.append(elt);
    }
    recomputeRule();
}

symmetryInput.addEventListener('input', updateBasis);

if (localStorage.ruleSymmetriesSymmetry) {
    symmetryInput.value = localStorage.ruleSymmetriesSymmetry;
    updateBasis();
}
