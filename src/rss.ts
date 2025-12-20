
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {execSync, ExecSyncOptions} from 'node:child_process';
import {TRANSITIONS, VALID_TRANSITIONS, parseTransitions, unparseTransitions, transitionsToArray, MAPPattern, stabilize, getHashsoup, toCatagolueRule} from './index.js';
import {getKnots, INTSeparator} from './intsep.js';


const LINK_TEXT = `For more information, see <link>.`;
const HELP_TEXT = `Usage: ./rss <input file path> <output file path>\n${LINK_TEXT}`;

const KEY_TYPES = {
    rule: 'string',
    min: 'string',
    max: 'string',
    transitions_from: 'number',
    transitions: 'string',
    include_transitions: 'string',
    exclude_transitions: 'string',
    outer_totalistic: 'boolean',
    force_transitions: 'string',
    apgcode_filter: 'string',
    check: 'number',
    census: 'boolean',
    explosive_filter: 'boolean',
    maxpop: 'number',
    maxgen: 'number',
    death_filter: 'boolean',
    period_filter: 'string',
    period_filter_linear_growth: 'boolean',
    period_filter_stop_early: 'boolean',
    check_timeout: 'number',
    check_timeout_do_apgsearch_anyway: 'boolean',
    time_filter: 'number',
    apgsearch: 'number',
    timeout: 'number',
} as const;

type KeyTypes = typeof KEY_TYPES;
type Key = keyof KeyTypes;

type Config = {[K in Key]?: KeyTypes[K] extends 'boolean' ? boolean : (KeyTypes[K] extends 'number' ? number : string)};

const DEFAULT_FROM_CHANGE_B = ['2c', '2e', '2i', '2k', '2n', '3a', '3c', '3e', '3i', '3j', '3k', '3n', '3q', '3r', '3y', '4a', '4c', '4e', '4i', '4j', '4k', '4n', '4q', '4r', '4t', '4w', '4y', '4z', '5a', '5c', '5e', '5i', '5j', '5k', '5n', '5q', '5r', '5y', '6a', '6c', '6e', '6i', '6k', '6n', '7c', '7e', '8c'];
const DEFAULT_FROM_CHANGE_S = ['0c', '1c', '1e', '2a', '2c', '2e', '2i', '2k', '2n', '3a', '3c', '3e', '3i', '3j', '3k', '3n', '3q', '3r', '3y', '4a', '4c', '4e', '4i', '4j', '4k', '4n', '4q', '4r', '4t', '4w', '4y', '4z', '5a', '5c', '5e', '5i', '5j', '5k', '5n', '5q', '5r', '5y', '6a', '6c', '6e', '6i', '6k', '6n', '7c', '7e', '8c'];

type PeriodFilter = {required: boolean, op: '=' | '!=' | '>' | '<' | '>=' | '<=', value: number}[];

const FILTER_OPS = ['!=', '>=', '<=', '=', '>', '<'] as const;


function error(msg: string): never {
    msg += '\n' + HELP_TEXT;
    if (import.meta.main) {
        console.log('Error: ' + msg);
        process.exit(1);
    } else {
        throw new Error(msg);
    }
}

function parseConfig(config: string): {config: Config, min: string, max: string} {
    let out: Config = {};
    for (let line of config.split('\n')) {
        line = line.trim();
        if (line === '' || line.startsWith('#') || line.startsWith('//')) {
            continue;
        }
        let index = line.indexOf(':');
        if (index === -1) {
            error(`Invalid line: ${line}`);
        }
        let key = line.slice(0, index);
        let value = line.slice(index + 1);
        key = key.trim();
        value = value.trim();
        if (key in KEY_TYPES) {
            let type = KEY_TYPES[key as Key];
            if (type === 'number') {
                let num = Number(value);
                if (Number.isNaN(num)) {
                    throw new Error(`Invalid value for ${key} option (must be number): '${value}'`);
                }
                // @ts-ignore
                out[key as Key] = num;
            } else if (type === 'boolean') {
                if (value === 'true') {
                    // @ts-ignore
                    out[key as Key] = value;
                } else if (value === 'false') {
                    // @ts-ignore
                    out[key as Key] = value;
                } else {
                    throw new Error(`Invalid value for ${key} option (must be boolean): '${value}'`);
                }
                // @ts-ignore
                out[key as Key] = value === 'true' ? true : false;
            } else {
                // @ts-ignore
                out[key as Key] = value;
            }
        } else {
            throw new Error(`Invalid option: '${key}'`);
        }
    }
    let min: string;
    let max: string;
    if (out.rule) {
        min = out.rule;
        max = out.rule;
    } else if (out.min && out.max) {
        min = out.min;
        max = out.max;
    } else {
        error(`Either 'rule' option or 'min' and 'max' options must be provided.`);
    }
    return {config: out, min, max};
}


function parseRule(rule: string): [string[], string[]] {
    let parts = rule.split('/');
    if (parts.length !== 2) {
        error(`Rules must have exactly 1 slash`);
    }
    if (!(parts[0].startsWith('B') && parts[1].startsWith('S'))) {
        error(`Rules must be in B/S notation`);
    }
    return [
        parseTransitions(parts[0].slice(1), VALID_TRANSITIONS),
        parseTransitions(parts[1].slice(1), VALID_TRANSITIONS),
    ];
}

function parseTransitionsList(data: string): [string[], string[]] {
    let b: string[] = [];
    let s: string[] = [];
    for (let tr of data.split(',')) {
        tr = tr.trim();
        let num = parseInt(tr[1]);
        if ((tr[0] !== 'B' && tr[0] !== 'S') || Number.isNaN(num) || num === 9) {
            error(`Invalid transition: ${tr}`);
        }
        if (tr.length === 2) {
            let trs: string[] = [];
            for (let letter of tr[num]) {
                trs.push(num + letter);
            }
            if (tr[0] === 'B') {
                b.push(...trs);
            } else {
                s.push(...trs);
            }
        } else if (tr.length !== 3 || !VALID_TRANSITIONS[num].includes(tr[2])) {
            error(`Invalid transition: ${tr}`);
        } else {
            if (tr[0] === 'B') {
                b.push(tr.slice(1));
            } else {
                s.push(tr.slice(1));
            }
        }
    }
    return [b, s];
}

function unparseRule(b: string[], s: string[]): string {
    return `B${unparseTransitions(b, VALID_TRANSITIONS, false)}/S${unparseTransitions(s, VALID_TRANSITIONS, false)}`;
}

function getNTransitionsFrom(rules: Set<string>, bTrs: string[], sTrs: string[], n: number, changeB: string[], changeS: string[]): void {
    for (let tr of changeB) {
        let newB = bTrs.slice();
        let index = newB.indexOf(tr);
        if (index !== -1) {
            newB.splice(index, 1);
        } else {
            newB.push(tr);
        }
        rules.add(unparseRule(newB, sTrs));
        if (n > 1) {
            getNTransitionsFrom(rules, newB, sTrs, n - 1, changeB, changeS);
        }
    }
    for (let tr of changeS) {
        let newS = sTrs.slice();
        let index = newS.indexOf(tr);
        if (index !== -1) {
            newS.splice(index, 1);
        } else {
            newS.push(tr);
        }
        rules.add(unparseRule(bTrs, newS));
        if (n > 1) {
            getNTransitionsFrom(rules, bTrs, newS, n - 1, changeB, changeS);
        }
    }
}

function getOuterTotalistic(trs: string[], type: string): number[] {
    let out: number[] = [];
    for (let i = 0; i < VALID_TRANSITIONS.length; i++) {
        let found = false;
        for (let j = 0; j < VALID_TRANSITIONS[i].length; j++) {
            let letter = VALID_TRANSITIONS[i][j];
            if (trs.includes(i + letter)) {
                if (!found && j > 0) {
                    error(`${type} is not outer-totalistic`);
                }
                found = true;
            } else if (found) {
                error(`${type} is not outer-totalistic`);
            }
        }
        if (found) {
            out.push(i);
        }
    }
    return out;
}

function generateRules(min: string, max: string, config: Config): Set<string> {
    let [minB, minS] = parseRule(min);
    let [maxB, maxS] = parseRule(max);
    for (let tr of minB) {
        if (!maxB.includes(tr)) {
            error(`Maxrule does not include ${tr} which is present in minrule`);
        }
    }
    for (let tr of minS) {
        if (!maxS.includes(tr)) {
            error(`Maxrule does not include ${tr} which is present in minrule`);
        }
    }
    let trsFrom = 0;
    let fromChangeB = DEFAULT_FROM_CHANGE_B;
    let fromChangeS = DEFAULT_FROM_CHANGE_S;
    if (config.transitions_from) {
        trsFrom = config.transitions_from;
        if (config.transitions) {
            [fromChangeB, fromChangeS] = parseTransitionsList(config.transitions);
        }
        if (config.include_transitions) {
            let [b, s] = parseTransitionsList(config.include_transitions);
            fromChangeB.push(...b);
            fromChangeS.push(...s);
        }
        if (config.exclude_transitions) {
            let [b, s] = parseTransitionsList(config.exclude_transitions);
            for (let tr of b) {
                let index = fromChangeB.indexOf(tr);
                if (index !== -1) {
                    fromChangeB.splice(index, 1);
                }
            }
            for (let tr of s) {
                let index = fromChangeS.indexOf(tr);
                if (index !== -1) {
                    fromChangeS.splice(index, 1);
                }
            }
        }
    }
    let forceTrs: [string[], string[]] | undefined = undefined;
    if (config.force_transitions) {
        forceTrs = parseTransitionsList(config.force_transitions);
    }
    let rules = new Set<string>();
    if (config.outer_totalistic) {
        let otMinB = getOuterTotalistic(minB, 'Minrule');
        let otMinS = getOuterTotalistic(minS, 'Minrule');
        let otMaxB = getOuterTotalistic(maxB, 'Maxrule');
        let otMaxS = getOuterTotalistic(maxS, 'Maxrule');
        let changeB = otMaxB.filter(x => !otMinB.includes(x));
        let changeS = otMaxS.filter(x => !otMinS.includes(x));
        for (let i = 0; i < 2**(changeB.length); i++) {
            let bStr = i.toString(2).padStart(changeB.length, '0');
            let bTrs: string[] = [];
            for (let num = 0; num <= 8; num++) {
                if (otMinB.includes(num)) {
                    bTrs.push(...Array.from(VALID_TRANSITIONS[num]).map(x => num + x));
                } else {
                    let index = changeB.indexOf(num);
                    if (index !== -1) {
                        if (bStr[index] === '1') {
                            bTrs.push(...Array.from(VALID_TRANSITIONS[num]).map(x => num + x));
                        }
                    }
                }
            }
            if (forceTrs) {
                for (let tr of forceTrs[0]) {
                    if (!bTrs.includes(tr)) {
                        bTrs.push(tr);
                    }
                }
            }
            for (let j = 0; j < 2**(changeS.length); j++) {
                let sStr = i.toString(2).padStart(changeS.length, '0');
                let sTrs: string[] = [];
                for (let num = 0; num <= 8; num++) {
                    if (otMinS.includes(num)) {
                        sTrs.push(...Array.from(VALID_TRANSITIONS[num]).map(x => num + x));
                    } else {
                        let index = changeS.indexOf(num);
                        if (index !== -1) {
                            if (sStr[index] === '1') {
                                sTrs.push(...Array.from(VALID_TRANSITIONS[num]).map(x => num + x));
                            }
                        }
                    }
                }
                if (forceTrs) {
                    for (let tr of forceTrs[1]) {
                        if (!sTrs.includes(tr)) {
                            sTrs.push(tr);
                        }
                    }
                }
                rules.add(unparseRule(bTrs, sTrs));
                if (trsFrom > 0) {
                    getNTransitionsFrom(rules, bTrs, sTrs, trsFrom, fromChangeB, fromChangeS);
                }
            }
        }
    } else {
        let changeB = maxB.filter(x => !minB.includes(x));
        let changeS = maxS.filter(x => !minS.includes(x));
        for (let i = 0; i < 2**(changeB.length); i++) {
            let bStr = i.toString(2).padStart(changeB.length, '0');
            let bTrs = minB.slice();
            for (let j = 0; j < changeB.length; j++) {
                if (bStr[j] === '1') {
                    bTrs.push(changeB[j]);
                }
            }
            if (forceTrs) {
                for (let tr of forceTrs[0]) {
                    if (!bTrs.includes(tr)) {
                        bTrs.push(tr);
                    }
                }
            }
            for (let j = 0; j < 2**(changeS.length); j++) {
                let sStr = i.toString(2).padStart(changeB.length, '0');
                let sTrs = minS.slice();
                for (let k = 0; k < changeS.length; k++) {
                    if (sStr[k] === '1') {
                        sTrs.push(changeS[k]);
                    }
                }
                if (forceTrs) {
                    for (let tr of forceTrs[1]) {
                        if (!sTrs.includes(tr)) {
                            sTrs.push(tr);
                        }
                    }
                }
                rules.add(unparseRule(bTrs, sTrs));
                if (trsFrom > 0) {
                    getNTransitionsFrom(rules, bTrs, sTrs, trsFrom, fromChangeB, fromChangeS);
                }
            }
        }
    }
    return rules;
}


let soups = 0;

async function search(rule: string, config: Config, print: ((data: string) => void) | null | undefined, apgcodeFilter?: [RegExp, boolean][], periodFilter?: PeriodFilter): Promise<string> {
    if (!config.check && !config.apgsearch) {
        return rule;   
    }
    let [bTrs, sTrs] = parseRule(rule);
    let trs = transitionsToArray(bTrs, sTrs, TRANSITIONS);
    rule = 'B' + unparseTransitions(bTrs, VALID_TRANSITIONS, false) + '/S' + unparseTransitions(sTrs, VALID_TRANSITIONS, false);
    let base = new MAPPattern(0, 0, new Uint8Array(0), trs, rule, 'D8');
    let knots: Uint8Array | null = null;
    let apgcodes: {[key: string]: number} = {};
    let startTime = performance.now() / 1000;
    let timedOut = false;
    if (config.check) {
        let allDied = true;
        let toCensus: [MAPPattern, number][] = [];
        for (let i = 0; i < config.check; i++) {
            let {height, width, data} = await getHashsoup('rss_' + soups + '_' + Math.floor(Math.random() * 1000000), 'C1');
            soups++;
            let p = base.copy();
            p.setData(data, height, width);
            let period = stabilize(p, undefined, undefined, config.maxgen, config.maxpop);
            if (period !== 'died') {
                allDied = false;
            } else {
                continue;
            }
            if (period === null) {
                if (config.explosive_filter) {
                    return `${rule}: explosive (${i + 1})`;
                } else {
                    continue;
                }
            }
            if (typeof period === 'object' && config.period_filter_linear_growth) {
                period = period.period;
            }
            if (typeof period === 'number' && periodFilter) {
                let found = false;
                for (let {required, op, value} of periodFilter) {
                    let result: boolean;
                    if (op === '=') {
                        result = period === value;
                    } else if (op === '!=') {
                        result = period !== value;
                    } else if (op === '<') {
                        result = period < value;
                    } else if (op === '<=') {
                        result = period <= value;
                    } else if (op === '>') {
                        result = period > value;
                    } else {
                        result = period >= value;
                    }
                    if (result) {
                        found = true;
                    } else if (required) {
                        found = false;
                        break;
                    }
                }
                if (found) {
                    if (config.period_filter_stop_early) {
                        break;
                    }
                } else {
                    continue;
                }
            }
            toCensus.push([p, typeof period === 'object' ? period.period : period]);
            if (config.check_timeout && (performance.now() / 1000 - startTime) > config.check_timeout) {
                timedOut = true;
                break;
            }
        }
        if (allDied && config.death_filter) {
            return `${rule}: no objects`;
        }
        if (config.census && !timedOut) {
            if (!knots) {
                knots = getKnots(trs);
            }
            for (let [soup, period] of toCensus) {
                let sep = new INTSeparator(soup, knots);
                let data = sep.separate(period * 8, Math.max(period * 8, 256));
                if (!data) {
                    if ('PATHOLOGICAL' in apgcodes) {
                        apgcodes['PATHOLOGICAL']++;
                    } else {
                        apgcodes['PATHOLOGICAL'] = 0;
                    }
                    if (print) {
                        print(`Unable to separate objects in ${rule}!`);
                    }
                    continue;
                }
                if (data[1]) {
                    if (print) {
                        print(`Unable to separate multi-island object or confirm that it is strict in ${rule}!`);
                    }
                }
                for (let {apgcode} of data[0]) {
                    if (apgcode in apgcodes) {
                        apgcodes[apgcode]++;
                    } else {
                        apgcodes[apgcode] = 1;
                    }
                }
                if (config.check_timeout && (performance.now() / 1000 - startTime) > config.check_timeout) {
                    timedOut = true;
                    break;
                }
            }
        }
    }
    let apgsearchTimedOut = false;
    if (config.apgsearch && (!timedOut || config.check_timeout_do_apgsearch_anyway)) {
        if (print) {
            print(`Running apgsearch on ${rule}... `);
        }
        execSync(`(cd apgmera; ./recompile.sh --rule ${toCatagolueRule(rule)} --symmetry C1)`, {stdio: 'ignore'});
        if (print) {
            print(`Compiled!\n`);
        }
        let options: ExecSyncOptions = {stdio: 'ignore'};
        if (config.timeout) {
            options.timeout = config.timeout * 1000;
            options.killSignal = 'SIGKILL';
        }
        try {
            execSync(`./apgmera/apgluxe -n ${config.apgsearch} -i 1 -t 1 -L 1 -v 0`, options);
        } catch (error) {
            if (error && typeof error === 'object' && 'killed' in error && error.killed) {
                if (!(config.check && config.census)) {
                    return `${rule}: timed out`;
                } else {
                    apgsearchTimedOut = true;
                }
            }
        }
        let files = await fs.readdir('.');
        let data: string | null = null;
        for (let file of files) {
            if (file.startsWith('log')) {
                data = (await fs.readFile('./' + file)).toString();
                fs.unlink('./' + file);
                break;
            }
        }
        if (data === null) {
            throw new Error('No log file found!');
        }
        let found = false;
        for (let line of data.split('\n')) {
            if (line.startsWith('@CENSUS')) {
                found = true;
                continue;
            } else if (!found) {
                continue;
            } else if (line.startsWith('@SAMPLE_SOUPIDS')) {
                break;
            }
            let parts = line.trim().split(' ');
            let apgcode = parts[0];
            let count = parseInt(parts[1]);
            if (apgcode.length === 0) {
                continue;
            }
            if (apgcode in apgcodes) {
                apgcodes[apgcode] += count;
            } else {
                apgcodes[apgcode] = count;
            }
        }
    }
    let out: [string, number][] = [];
    if (apgcodeFilter) {
        for (let [apgcode, count] of Object.entries(apgcodes)) {
            let found = false;
            for (let [regex, invert] of apgcodeFilter) {
                if (apgcode.match(regex)) {
                    found = true;
                    break;
                } else if (invert) {
                    break;
                }
            }
            if (!found) {
                out.push([apgcode, count]);
            }
        }
    } else {
        out = Object.entries(apgcodes);
    }
    out = out.sort((x, y) => y[1] - x[1]);
    let text = rule + ': ';
    if (timedOut) {
        text += 'timed out, ';
    }
    if (apgsearchTimedOut) {
        text += 'apgsearch timed out, ';
    }
    if (out.length === 0) {
        text += 'nothing';
    } else {
        text += out.map(x => x[0]).join(', ');
    }
    return text;
}

let defaultPrint = typeof process === 'object' ? process.stdout.write.bind(process.stdout) : console.log;

export async function runRSS(configFile: string, print: ((data: string) => void) | null = defaultPrint, out: string = '', write?: (data: string) => void): Promise<string> {
    let {config, min, max} = parseConfig(configFile);
    let rules = generateRules(min, max, config);
    let periodFilter: PeriodFilter | undefined = undefined;
    if (config.period_filter) {
        periodFilter = [];
        for (let filter of config.period_filter.split('\n')) {
            filter = filter.trim();
            let required = false;
            if (filter.startsWith('#')) {
                required = true;
                filter = filter.slice(1);
            }
            let found = false;
            for (let op of FILTER_OPS) {
                if (filter.startsWith(op)) {
                    let value = parseInt(filter.slice(op.length));
                    if (Number.isNaN(value)) {
                        continue;
                    }
                    periodFilter.push({required, op, value})
                }
            }
            if (!found) {
                error(`Invalid period filter: '${required ? '#' : ''}${filter}'`);
            }
        }
    }
    let apgcodeFilter: [RegExp, boolean][] | undefined = undefined;
    if (config.apgcode_filter) {
        apgcodeFilter = [];
        for (let regex of config.apgcode_filter.split(',')) {
            regex = regex.trim();
            if (regex.startsWith('!')) {
                apgcodeFilter.push([new RegExp(regex.slice(1)), true]);
            } else {
                apgcodeFilter.push([new RegExp(regex), false]);
            }
        }
    }
    let done = new Set<string>();
    for (let line of out.split('\n')) {
        line = line.trim();
        if (line === '' || line.startsWith('#')) {
            continue;
        }
        let rule = line.split(':')[0].trim();
        if (rules.has(rule)) {
            done.add(rule);
        }
    }
    let total = rules.size - done.size;
    if (print) {
        print(`Searching ${total} rules\n`);
    }
    let searched = 0;
    let start = performance.now() / 1000; 
    let prevUpdate = start;
    let prevSearched = 0;
    let now = start;
    let sendLastUpdate = true;
    for (let rule of rules) {
        sendLastUpdate = true;
        if (!done.has(rule)) {
            let text = await search(rule, config, print, apgcodeFilter, periodFilter);
            if (write) {
                write(text);
            }
            out += text;
            done.add(rule);
            searched++;
            now = performance.now() / 1000;
            if (print && now - prevUpdate > 10) {
                let rps = (searched - prevSearched) / (now - prevUpdate);
                let totalRPS = searched / (now - start);
                print(`${searched}/${total} completed (${(searched / total * 100).toFixed(3)}%) (${rps.toFixed(3)} rules/second current, ${totalRPS.toFixed(3)} overall)\n`);
                prevUpdate = now;
                prevSearched = searched;
                sendLastUpdate = false;
            }
        }
    }
    if (print && sendLastUpdate) {
        let rps = (searched - prevSearched) / (now - prevUpdate);
        let totalRPS = searched / (now - start);
        print(`${searched}/${total} rules completed (${(searched / total * 100).toFixed(3)}%) (${rps.toFixed(3)} rules/second current, ${totalRPS.toFixed(3)} overall)\n`);
        prevUpdate = now;
        prevSearched = searched;
    }
    return out;
}


if (import.meta.main) {
    let inputFile = process.argv[2];
    let outputFile = process.argv[3];
    if (inputFile === '-h') {
        console.log(HELP_TEXT);
        process.exit(1);
    } else if (!inputFile) {
        console.log('Error: Missing input file\n' + HELP_TEXT);
        process.exit(1);
    }
    if (!outputFile) {
        console.log('Error: Missing output file\n' + HELP_TEXT);
        process.exit(1);
    }
    let out = '';
    if (exists(outputFile)) {
        out = (await fs.readFile(outputFile)).toString();
    } else {
        await fs.writeFile(outputFile, '');
    }
    await runRSS((await fs.readFile(inputFile)).toString(), process.stdout.write.bind(process.stdout), out, data => {
        console.log(data);
        fs.appendFile(outputFile, data + '\n');
    });
}
