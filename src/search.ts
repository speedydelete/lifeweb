
import {Pattern} from './pattern.js';
import {MAPPattern} from './map.js';
import {identify} from './identify.js';
import {getKnots, INTSeperator} from './intsep.js';


let printElt: null | HTMLElement = null;

export function setPrintElement(elt: HTMLElement): void {
    printElt = elt;
}

function naivestab(p: Pattern): number {
    let prevPop = 0;
    let period = 12;
    let count = 0;
    let limit = 15;
    for (let i = 0; i < 1000; i++) {
        if (i === 40) {
            limit = 20;
        } else if (i === 60) {
            limit = 25;
        } else if (i === 80) {
            limit = 30;
        }
        if (i === 400) {
            period = 18;
        } else if (i === 500) {
            period = 24;
        } else if (i === 600) {
            period = 30;
        }
        p.run(period);
        let pop = p.population;
        if (pop === prevPop) {
            count++;
        } else {
            count = 0;
            period ^= 4;
        }
        if (count === limit) {
            return period;
        }
        prevPop = pop;
    }
    return 0;
}

export function stabilize(p: Pattern): number {
    let period = naivestab(p);
    if (period > 0) {
        return period;
    }
    let hashes: bigint[] = [];
    let gens: number[] = [];
    let gen = 0;
    for (let i = 0; i < 4000; i++) {
        p.run(30);
        let hash = p.hash64();
        for (let i = 0; i < hashes.length; i++) {
            if (hash < hashes[i]) {
                hashes = hashes.slice(0, i);
                gens = gens.slice(0, i);
                break;
            } else if (hash === hashes[i]) {
                let period = gen - gens[i];
                let prevPop = p.population;
                for (let j = 0; j < 20; j++) {
                    p.run(period);
                    let pop = p.population;
                    if (pop !== prevPop) {
                        if (period < 1280) {
                            period = 1280;
                        }
                        break;
                    }
                    prevPop = pop;
                }
                return period;
            }
        }
        gen += 30;
    }
    if (printElt) {
        printElt.innerHTML += '<br>Failed to detect periodic behavior!';
    } else {
        console.log('Failed to detect periodic behavior!');
    }
    p.run(1280);
    return 1280;
}


function attemptCensus(sep: INTSeperator, limit: number, ignorePathologicals: boolean, soup?: string): null | {[key: string]: number} {
    let data = sep.getObjects().map(x => identify(x, limit));
    let out: {[key: string]: number} = {};
    for (let {apgcode} of data) {
        if (apgcode[0] === 'P' && !ignorePathologicals) {
            return null;
        }
        if (apgcode in out) {
            out[apgcode]++;
        } else {
            out[apgcode] = 1;
        }
        if (apgcode[0] === 'x') {
            if (sep.ruleStr === 'B3/S23') {
                if (apgcode[1] === 'p') {
                    if ((apgcode[2] !== '2' || apgcode[3] !== '_') && apgcode !== 'xp3_co9nas0san9oczgoldlo0oldlogz1047210127401' && apgcode !== 'xp15_4r4z4r4') {
                        if (printElt) {
                            printElt.innerHTML += '<br>Rare oscillator detected: <span style="color: #ff7f7f">' + apgcode + '</span>';
                        } else {
                            console.log('Rare oscillator detected: %c' + apgcode, 'color: #ff7f7f');
                        }
                    }
                } else if (apgcode[1] === 'q' && apgcode !== 'xq4_153' && apgcode !== 'xq4_6frc' && apgcode !== 'xq4_27dee6' && apgcode !== 'xq4_27deee6') {
                    if (printElt) {
                        printElt.innerHTML += '<br>Rare spaceship detected: <span style="color: #5997ff">' + apgcode + '</span>';
                    } else {
                        console.log('Rare spaceship detected: %c' + apgcode, 'color: #5997ff');
                    }
                }
            }
        } else if (apgcode[0] === 'y') {
            if (printElt) {
                printElt.innerHTML += '<br>Linear-growth pattern detected: <span style="color: #7fff7f">' + apgcode + '</span>';
            } else {
                console.log('Linear-growth pattern detected: %c' + apgcode, 'color: #7fff7f');
            }
        } else if (apgcode[0] === 'z') {
            if (printElt) {
                printElt.innerHTML += '<br>Chaotic-growth pattern detected: <span style="color: #7fff7f">' + apgcode + '</span>';
            } else {
                console.log('Chaotic-growth pattern detected: %c' + apgcode, 'color: #7fff7f');
            }
        }
    }
    return out;
}

export function censusINT(p: MAPPattern, knots: Uint8Array): {[key: string]: number} {
    let out: {[key: string]: number} = {};
    let time = stabilize(p);
    let step = 120;
    for (let i = 0; i < 5; i++) {
        let sep = new INTSeperator(p, knots);
        let data = attemptCensus(sep, step, i === 4);
        for (let i = 0; i < step; i++) {
            sep.runGeneration();
            sep.resolveKnots();
            data = attemptCensus(sep, step, i === 4);
        }
        if (i === 4) {
            data = attemptCensus(sep, step, i === 4);
        }
        p.run(step);
        step *= 4;
    }
    return out;
}


// export function getHashsoup(soup: string, symmetry: string, stdin: string): {height: number, width: number, data: Uint8Array} {
//     let hash = crypto.subtle.digest('SHA-256', (new TextEncoder()).encode(soup));
// }
