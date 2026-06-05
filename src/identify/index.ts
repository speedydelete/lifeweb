
import {Pattern, INTSpec, INT_SPECS, parseTransitions, unparseTransitions, MAPPattern, MAPB0Pattern, MAPGenPattern, getApgcode, getDescription, ALTERNATE_SYMMETRIES, Identified, identify, toCatagolueRule, parse} from '../core/index.js';


function getElement(id: string): HTMLElement;
function getElement<T extends keyof HTMLElementTagNameMap>(id: string, type: T): HTMLElementTagNameMap[T];
function getElement(id: string, type?: string): HTMLElement {
    let out = document.getElementById(id);
    if (!out) {
        throw new Error(`Missing element: '${id}'`);
    }
    if (type !== undefined) {
        let tag = out.tagName.toLowerCase();
        if (tag !== type) {
            throw new Error(`Element '${id}' is required to be of type '${type}' but is type '${tag}'`);
        }
    }
    return out;
}


type ExtraPatternData = {apgcode: string, p: Pattern, name?: string, output?: PatternData, rle: string};
type PatternData = Omit<Identified, 'phases' | 'hashes' | 'output'> & ExtraPatternData;

let patterns: PatternData[] = [];
let selectedPatterns = new Set<PatternData>();


function getMAPRuleTrs(rule: string, spec: INTSpec) {
    if (rule.endsWith('H')) {
        rule = rule.slice(0, -1);
    }
    let parts = rule.split('/');
    if (parts.length === 2) {
        return [parseTransitions(parts[0].slice(1), spec), parseTransitions(parts[1].slice(1), spec)];
    } else {
        return [parseTransitions(parts[1], spec), parseTransitions(parts[0], spec)];
    }
}

function computeCombinedMinmax() {
    if (selectedPatterns.size === 0) {
        minmaxElt.textContent = 'No patterns selected.';
        return;
    }
    let patterns = Array.from(selectedPatterns).filter(x => x.minmax !== undefined) as (PatternData & {minmax: [string, string]})[];
    let p = patterns[0].p;
    for (let data of patterns.slice(1)) {
        if (data.p.constructor !== p.constructor) {
            minmaxElt.textContent = 'Patterns of different rulespaces are selected.';
            return;
        }
    }
    if (p instanceof MAPPattern || p instanceof MAPB0Pattern || p instanceof MAPGenPattern) {
        let nh: 'M' | 'H' | 'V' = 'M';
        if (p.rule.str.endsWith('H')) {
            nh = 'H';
        } else if (p.rule.str.endsWith('V')) {
            nh = 'V';
        }
        if (nh !== 'M' && !patterns.every(data => nh === data.p.rule.str[data.p.rule.str.length - 1])) {
            nh = 'M';
        }
        let spec = INT_SPECS[nh];
        let minB = new Set<string>();
        let minS = new Set<string>();
        let maxB = new Set(Object.keys(spec.trs));
        let maxS = new Set(Object.keys(spec.trs));
        if ('evenTrs' in p) {
            minB.add('0c');
            maxS.delete('8c');
        } else {
            maxB.delete('0c');
        }
        for (let data of patterns) {
            let [newMinB, newMinS] = getMAPRuleTrs(data.minmax[0], spec);
            let [newMaxB, newMaxS] = getMAPRuleTrs(data.minmax[1], spec);
            for (let tr of newMinB) {
                if (!maxB.has(tr)) {
                    minmaxElt.textContent = 'Patterns are incompatible.';
                    return;
                }
                minB.add(tr);
            }
            for (let tr of newMinS) {
                if (!maxS.has(tr)) {
                    minmaxElt.textContent = 'Patterns are incompatible.';
                    return;
                }
                minS.add(tr);
            }
            for (let tr of maxB) {
                if (!newMaxB.includes(tr)) {
                    maxB.delete(tr);
                }
            }
            for (let tr of maxS) {
                if (!newMaxS.includes(tr)) {
                    maxS.delete(tr);
                }
            }
        }
        let minBStr = unparseTransitions(Array.from(minB), spec);
        let minSStr = unparseTransitions(Array.from(minS), spec);
        let maxBStr = unparseTransitions(Array.from(maxB), spec);
        let maxSStr = unparseTransitions(Array.from(maxS), spec);
        let min: string;
        let max: string;
        if (p.rule.states !== 2) {
            min = `${minSStr}/${minBStr}/${p.rule.states}`;
            max = `${maxSStr}/${maxBStr}/${p.rule.states}`;
        } else {
            min = `B${minBStr}/S${minSStr}`;
            max = `B${maxBStr}/S${maxSStr}`;
        }
        if (nh !== 'M') {
            min += nh;
            max += nh;
        }
        minmaxElt.textContent = `Min: ${min}\nMax: ${max}`;
        return;
    } else {
        minmaxElt.textContent = 'Unsupported rulespace for minmax.';
        return;
    }
}


let caPatternTemplate = getElement('ca-pattern-template', 'template').content;

export class CAPatternElement extends HTMLElement {

    data: PatternData;
    isOutput: boolean;

    constructor(data: PatternData, isOutput: boolean = false) {
        super();
        this.data = data;
        this.isOutput = isOutput;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(caPatternTemplate, true));
        let checkbox = root.getElementById('checkbox') as HTMLInputElement;
        if (data.minmax) {
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    selectedPatterns.add(data);
                } else {
                    selectedPatterns.delete(data);
                }
                computeCombinedMinmax();
            });  
        } else {
            checkbox.style.display = 'none';
        }
        let name = data.name ? `${data.name} (${data.desc})` : data.desc;
        if (isOutput) {
            name = 'Output: ' + name;
        }
        (root.getElementById('name') as HTMLElement).textContent = name;
        let basicText = data.minmax ? `Min: ${data.minmax[0]}\nMax: ${data.minmax[1]}\n` : '';
        let text = basicText;
        if (data.power !== undefined) {
            text += `Power: ${data.power}\n`;
        }
        text += `Symmetry: ${data.symmetry} (${ALTERNATE_SYMMETRIES[data.symmetry]})\n`;
        if (data.heat !== undefined) {
            text += `Heat: ${data.heat.toFixed(3).replace(/(\.?)0+$/, '')}\n`;
        }
        if (data.temperature !== undefined) {
            text += `Temperature: ${data.temperature.toFixed(3).replace(/(\.?)0+$/, '')}\n`;
        }
        if (data.volatility !== undefined) {
            text += `Volatility: ${data.volatility.toFixed(3).replace(/(\.?)0+$/, '')}\n`;
        }
        if (data.strictVolatility !== undefined) {
            text += `Strict volatility: ${data.strictVolatility.toFixed(3).replace(/(\.?)0+$/, '')}\n`;
        }
        text = text.slice(0, -1);
        let textElt = root.getElementById('text') as HTMLElement;
        textElt.textContent = basicText;
        let apgcodeElt = root.getElementById('apgcode') as HTMLAnchorElement;
        apgcodeElt.textContent = data.apgcode.length > 50 ? `${data.apgcode.slice(0, 24)}...${data.apgcode.slice(-24)}` : data.apgcode;
        apgcodeElt.href = `https://catagolue.hatsya.com/object/${data.apgcode}/${toCatagolueRule(data.p.rule.str)}`;
        apgcodeElt.style.display = 'none';
        let outputElt: HTMLElement | undefined = undefined;
        if (data.output) {
            outputElt = new CAPatternElement(data.output, true);
            outputElt.style.display = 'none';
            root.appendChild(outputElt);
        }
        let open = false;
        let arrowElt = root.getElementById('arrow') as HTMLElement;
        arrowElt.addEventListener('click', () => {
            open = !open;
            if (open) {
                arrowElt.className = 'pattern-arrow open';
                textElt.textContent = text;
                apgcodeElt.style.display = 'block';
                if (outputElt) {
                    outputElt.style.display = 'flex';
                }
            } else {
                arrowElt.className = 'pattern-arrow closed';
                textElt.textContent = basicText;
                apgcodeElt.style.display = 'none';
                if (outputElt) {
                    outputElt.style.display = 'none';
                }
            }
        });
    }

}

customElements.define('ca-pattern', CAPatternElement);


let rleTextarea = getElement('rle', 'textarea');
let addButton = getElement('add');
let minmaxElt = getElement('minmax');
let maxGensInput = getElement('max-gens', 'input');
let patternsElt = getElement('patterns');

function addPattern(data: PatternData, save = true) {
    patterns.push(data);
    if (save) {
        localStorage.identifyPatterns = JSON.stringify(patterns.map(x => Object.assign({}, x, {p: undefined})));
    }
    let elt = new CAPatternElement(data);
    if (patternsElt.children.length === 0) {
        patternsElt.appendChild(elt);
    } else {
        patternsElt.insertBefore(elt, patternsElt.children[0]);
    }
}

function normalizeType(type: Identified): PatternData {
    return {
        pops: type.pops,
        stabilizedAt: type.stabilizedAt,
        period: type.period,
        disp: type.disp,
        linear: type.linear,
        power: type.power,
        desc: getDescription(type),
        output: type.output ? normalizeType(type.output) : undefined,
        heat: type.heat,
        temperature: type.temperature,
        volatility: type.volatility,
        strictVolatility: type.strictVolatility,
        minmax: type.minmax,
        symmetry: type.symmetry,
        apgcode: getApgcode(type),
        p: type.phases[0],
        rle: type.phases[0].toRLE(),
    };
}

addButton.addEventListener('click', () => {
    let data = identify(parse(rleTextarea.value), Number(maxGensInput.value));
    addPattern(normalizeType(data));
});


// if (localStorage.identifyPatterns) {
//     for (let data of JSON.parse(localStorage.identifyPatterns)) {
//         data.p = parse(data.rle);
//         addPattern(data, false);
//     }
// }

if (localStorage.identifyMaxGens) {
    maxGensInput.value = localStorage.identifyMaxGens;
}
maxGensInput.addEventListener('change', () => {
    localStorage.identifyMaxGens = maxGensInput.value;
});

if (localStorage.identifyRLE) {
    rleTextarea.value = localStorage.identifyRLE;
}
rleTextarea.addEventListener('change', () => {
    localStorage.identifyRLE = rleTextarea.value;
});
