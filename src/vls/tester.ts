
import {join} from 'node:path';
import {existsSync} from 'node:fs';
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';

import {identifyPeriodic, getApgcode, parse} from '../core/index.js';
import {LIFEWEB_VERSION} from '../version.js';
import {error} from './compiler.js';
import {VLSRunData, runVLS} from './index.js';


const SRC_DIR = join(import.meta.dirname, '..', '..', 'src', 'vls');

const TEST_DATA_DIR = join(SRC_DIR, 'test_data');


interface Test {
    name: string;
    command: string;
    expected: string[] | 'nothing' | 'error';
    untimed: boolean;
    iterations: number;
}

const RECOMPILATION_TEST: Test = {
    name: 'recompilation test',
    command: './vls B/S periodic p1 1 1',
    expected: 'nothing',
    untimed: true,
    iterations: 1,
};

function parseTest(lines: string[]): Test {
    if (!lines[0].startsWith('test ')) {
        throw new Error(`Invalid test (first line does not start with 'test ')`);
    }
    let name = lines[0].slice('test '.length);
    let command: string | undefined = undefined;
    let expected: string[] | 'nothing' | 'error' | undefined = undefined;
    let untimed: boolean = false;
    let iterations: number = 1;
    for (let line of lines.slice(1)) {
        let cmd: string;
        let value: string;
        let index = line.indexOf(' ');
        if (index === -1) {
            cmd = line;
            value = '';
        } else {
            cmd = line.slice(0, index);
            value = line.slice(index + 1);
        }
        if (cmd === 'command') {
            command = value;
        } else if (cmd === 'expect') {
            if (Array.isArray(expected)) {
                expected.push(value);
            } else {
                expected = [value];
            }
        } else if (cmd === 'expect_nothing') {
            expected = 'nothing';
        } else if (cmd === 'expect_error') {
            expected = 'error';
        } else if (cmd === 'untimed') {
            untimed = true;
        } else if (cmd === 'iterations') {
            iterations = Number(value);
            if (Number.isNaN(iterations)) {
                throw new Error(`Invalid iterations count in test '${name}': '${value}'`);
            }
        } else {
            throw new Error(`Invalid line in test '${name}': '${line}'`);
        }
    }
    if (command === undefined) {
        throw new Error(`Test '${name}' missing required line 'command'`);
    }
    if (expected === undefined) {
        throw new Error(`Test '${name}' missing required line 'expect' or 'expect_nothing'`);
    }
    return {
        name,
        command,
        expected,
        untimed,
        iterations,
    };
}

async function loadTestsFile(): Promise<Test[]> {
    let data = (await fs.readFile(join(SRC_DIR, 'tests.txt'))).toString();
    let out: Test[] = [];
    let currentTest: string[] = [];
    for (let line of data.split('\n')) {
        line = line.trim();
        if (line.length === 0 || line.startsWith('#')) {
            continue;
        }
        if (line.startsWith('test ')) {
            if (currentTest.length > 0) {
                out.push(parseTest(currentTest));
            }
            currentTest = [line];
        } else {
            currentTest.push(line);
        }
    }
    if (currentTest.length > 0) {
        out.push(parseTest(currentTest));
    }
    return out;
}


interface TestRunData {
    test: Test;
    success: boolean;
    totalTime: number;
    invocationTime: number;
    searchTime: number;
    branches: number;
}

interface TestVersionData {
    name: string;
    lifewebVersion: number;
    commitHash: string;
    commitTime: string;
}

interface AllTestRunData {
    name: string;
    version: TestVersionData;
    data: TestRunData[];
}

function testVersionDataToPrettyString(data: TestVersionData): string {
    return `lifeweb version: ${data.lifewebVersion}, commit: ${data.commitHash} at ${data.commitTime}`;
}

async function getTestVersionData(beforeCount: number = 0): Promise<TestVersionData> {
    let lifewebVersion = LIFEWEB_VERSION;
    let {execSync} = await import('node:child_process');
    let gitCommand = `git log -1 --format='%h %aI' HEAD~${beforeCount}`;
    let gitData = execSync(`(cd ${SRC_DIR}; ${gitCommand})`).toString();
    let [commitHash, localStr] = gitData.replace('\n', '').split(' ');
    let commitTime = (new Date(localStr)).toISOString().slice(0, -5);
    let name = `${lifewebVersion}_${commitHash}_${commitTime}`;
    return {
        name,
        lifewebVersion,
        commitHash,
        commitTime: commitTime.replaceAll('T', ' '),
    };
}

async function saveTestDataFile(data: AllTestRunData): Promise<void> {
    let out = `${data.name}\n`;
    out += `test, success, totalTime, invocationTime, searchTime, branches\n`;
    for (let value of data.data) {
        out += `${value.test.name}, ${value.success}, ${value.totalTime}, ${value.invocationTime}, ${value.searchTime}, ${value.branches}\n`;
    }
    let filePath = join(TEST_DATA_DIR, data.name + '.csv');
    await fs.writeFile(filePath, out);
}

async function loadTestDataFile(file: string, tests: Test[]): Promise<AllTestRunData> {
    if (file === 'current' || file === 'prev' || file.match(/^-\d+$/)) {
        if (file === 'current') {
            file = '0';
        } else if (file === 'prev') {
            file = '-1';
        }
        file = (await getTestVersionData(-Number(file))).name;
        if (!existsSync(join(TEST_DATA_DIR, file))) {
            file = file.slice(file.indexOf('_') + 1);
        }
    }
    let match: string | undefined = undefined;
    for (let filename of await fs.readdir(TEST_DATA_DIR)) {
        filename = filename.slice(0, -'.csv'.length);
        if (filename.includes(file)) {
            match = filename;
        }
    }
    if (match === undefined) {
        error(`Cannot find test data file: '${file}'`);
    }
    file = match;
    let filePath = join(TEST_DATA_DIR, file + '.csv');
    let fileData = (await fs.readFile(filePath)).toString();
    let lines = fileData.split('\n').map(line => line.trim())
    lines = lines.filter(line => line.length > 0 && !line.startsWith('#'));
    let realName = lines[0];
    let [lifewebVersion, commitHash, commitTime] = realName.split('_');
    let version: TestVersionData = {
        name: realName,
        lifewebVersion: Number(lifewebVersion),
        commitHash,
        commitTime: commitTime.replaceAll('T', ' '),
    };
    let out: TestRunData[] = [];
    for (let line of lines.slice(2)) {
        let data = line.split(',').map(value => value.trim());
        let testName = data[0];
        let test: Test | undefined = undefined;
        for (let value of tests) {
            if (value.name === testName) {
                test = value;
            }
        }
        if (test === undefined) {
            console.warn(`Nonexistent test in file: '${test}'`);
            continue;
        }
        let success = data[1] === 'true' ? true : false;
        let totalTime = Number(data[2]);
        let invocationTime = Number(data[3]);
        let searchTime = Number(data[4]);
        let branches = Number(data[5]);
        out.push({
            test,
            success,
            totalTime,
            invocationTime,
            searchTime,
            branches,
        });
    }
    return {
        name: realName,
        version,
        data: out,
    };
}


const RESET = `\x1b[0m`;
const RED = `\x1b[91m`;
const GREEN = `\x1b[92m`;

type PrettyPrintField = 'test' | 'success' | 'total time' | 'invocation time' | 'search time' | 'branches';

const DEFAULT_PRETTY_PRINT_FIELDS: PrettyPrintField[] = ['test', 'success', 'search time', 'branches'];

type FieldLineToFormat = string[] | 'spacer';

const ANSI_REGEX = /\x1b\[.*?m/g;

function formatFieldLines(lines: FieldLineToFormat[], fieldCount: number): string[] {
    let maxLengths: number[] = [];
    let spacerLineData: string[] = [];
    for (let i = 0; i < fieldCount; i++) {
        let maxLength = 1;
        for (let strs of lines) {
            let str = strs[i].replaceAll(ANSI_REGEX, '');
            maxLength = Math.max(maxLength, str.length);
        }
        maxLengths.push(maxLength);
        spacerLineData.push('-'.repeat(maxLength + 2));
    }
    let spacerLine = '+' + spacerLineData.join('+') + '+';
    let out: string[] = [];
    for (let strs of lines) {
        if (strs === 'spacer') {
            out.push(spacerLine);
        } else {
            let line: string[] = [];
            for (let i = 0; i < strs.length; i++) {
                let str = strs[i];
                while (str.replaceAll(ANSI_REGEX, '').length < maxLengths[i]) {
                    str += ' ';
                }
                line.push(str);
            }
            out.push('| ' + line.join(' | ') + ' |');
        }
    }
    return out;
}

function prettyPrintTestData(data: AllTestRunData, fields: PrettyPrintField[]): string {
    let out: string[] = [];
    out.push(testVersionDataToPrettyString(data.version));
    let successCount = 0;
    let strData: string[][] = [];
    for (let value of data.data) {
        let untimed = value.test.untimed;
        if (value.success) {
            successCount += 1;
        }
        let strs: string[] = [];
        for (let field of fields) {
            if (field === 'test') {
                strs.push(value.test.name);
            } else if (field === 'success') {
                strs.push(value.success ? `true` : `false`);
            } else if (field === 'total time') {
                if (untimed) {
                    continue;
                }
                strs.push(value.totalTime.toFixed(3));
            } else if (field === 'invocation time') {
                if (untimed) {
                    strs.push('');
                    continue;
                }
                strs.push(value.invocationTime.toFixed(3));
            } else if (field === 'search time') {
                if (untimed) {
                    strs.push('');
                    continue;
                }
                strs.push(value.searchTime.toFixed(3));
            } else if (field === 'branches') {
                strs.push(String(value.branches));
            } else {
                throw new Error(`Invalid field name: '${field}'`);
            }
        }
        strData.push(strs);
    }
    let toFormat: FieldLineToFormat[] = [
        'spacer',
        fields,
        'spacer',
        ...strData,
        'spacer',
    ];
    for (let line of formatFieldLines(toFormat, fields.length)) {
        out.push(line);
    }
    out.push(`${successCount}/${data.data.length} tests passed, ${(successCount / data.data.length * 100).toFixed(3)}% coverage`);
    return out.join('\n');
}

function percentDifference(first: number, second: number): [number, string] {
    if (first === second) {
        return [0, ''];
    }
    let value = (first - second)/((first + second) / 2) * 100;
    let str = value.toFixed(3) + '%';
    if (!str.startsWith('-')) {
        str = '+' + str;
    }
    return [value, ` (${str})`];
}

function compareAndPrettyPrintTestData(first: AllTestRunData, second: AllTestRunData, fields: PrettyPrintField[]): string {
    let out: string[] = [];
    out.push(
        `comparison between:`,
        ` - ${testVersionDataToPrettyString(first.version)}`,
        ` - ${testVersionDataToPrettyString(second.version)}`
    );
    let data: [TestRunData, TestRunData][] = [];
    for (let value1 of first.data) {
        for (let value2 of second.data) {
            if (value1.test.name === value2.test.name) {
                data.push([value1, value2]);
                break;
            }
        }
    }
    let firstSuccessCount = 0;
    let secondSuccessCount = 0;
    let timedTestCount = 0;
    let avgPercentDiffTotalTime = 0;
    let avgPercentDiffInvocationTime = 0;
    let avgPercentDiffSearchTime = 0;
    let avgPercentDiffBranches = 0;
    let strData: string[][] = [];
    for (let [first, second] of data) {
        let untimed = first.test.untimed;
        if (first.success) {
            firstSuccessCount += 1;
        }
        if (second.success) {
            secondSuccessCount += 1;
        }
        if (!untimed) {
            timedTestCount++;
        }
        let strs: string[] = [];
        for (let field of fields) {
            let str: string;
            let color: string | undefined = undefined;
            if (field === 'test') {
                str = first.test.name;
            } else if (field === 'success') {
                str = second.success ? `true` : `false`;
                if (second.success && !first.success) {
                    color = GREEN;
                } else if (!second.success && first.success) {
                    color = RED;
                }
            } else if (field === 'total time') {
                if (untimed) {
                    strs.push('');
                    continue;
                }
                let [diff, diffStr] = percentDifference(first.totalTime, second.totalTime);
                avgPercentDiffTotalTime += diff;
                str = `${second.totalTime.toFixed(3)}${diffStr}`;
                if (second.totalTime < first.totalTime) {
                    color = GREEN;
                } else if (second.totalTime > first.totalTime) {
                    color = RED;
                }
            } else if (field === 'invocation time') {
                if (untimed) {
                    strs.push('');
                    continue;
                }
                let [diff, diffStr] = percentDifference(first.invocationTime, second.invocationTime);
                avgPercentDiffInvocationTime += diff;
                str = `${second.invocationTime.toFixed(3)}${diffStr}`;
                if (second.invocationTime < first.invocationTime) {
                    color = GREEN;
                } else if (second.invocationTime > first.invocationTime) {
                    color = RED;
                }
            } else if (field === 'search time') {
                if (untimed) {
                    strs.push('');
                    continue;
                }
                let [diff, diffStr] = percentDifference(first.searchTime, second.searchTime);
                avgPercentDiffSearchTime += diff;
                str = `${second.searchTime.toFixed(3)}${diffStr}`;
                if (second.searchTime < first.searchTime) {
                    color = GREEN;
                } else if (second.searchTime > first.searchTime) {
                    color = RED;
                }
            } else if (field === 'branches') {
                let [diff, diffStr] = percentDifference(first.branches, second.branches);
                avgPercentDiffBranches += diff;
                str = `${second.branches}${diffStr}`;
                if (second.branches < first.branches) {
                    color = GREEN;
                } else if (second.branches > first.branches) {
                    color = RED;
                }
            } else {
                throw new Error(`Invalid field name: '${field}'`);
            }
            if (color !== undefined) {
                str = `${color}${str}${RESET}`;
            }
            strs.push(str);
        }
        strData.push(strs);
    }
    avgPercentDiffTotalTime /= timedTestCount;
    avgPercentDiffInvocationTime /= timedTestCount;
    avgPercentDiffSearchTime /= timedTestCount;
    avgPercentDiffBranches /= timedTestCount;
    let avgDiffs: string[] = [];
    for (let field of fields) {
        let str: string;
        let color: string | undefined = undefined;
        if (field === 'test') {
            str = 'Averages';
        } else if (field === 'success') {
            str = '';
        } else if (field === 'total time') {
            str = avgPercentDiffTotalTime.toFixed(3) + '%';
            if (!str.startsWith('-')) {
                str = '+' + str;
            }
            if (avgPercentDiffTotalTime > 0) {
                color = GREEN;
            } else if (avgPercentDiffTotalTime < 0) {
                color = RED;
            }
        } else if (field === 'invocation time') {
            str = avgPercentDiffInvocationTime.toFixed(3) + '%';
            if (!str.startsWith('-')) {
                str = '+' + str;
            }
            if (avgPercentDiffInvocationTime > 0) {
                color = GREEN;
            } else if (avgPercentDiffInvocationTime < 0) {
                color = RED;
            }
        } else if (field === 'search time') {
            str = avgPercentDiffSearchTime.toFixed(3) + '%';
            if (!str.startsWith('-')) {
                str = '+' + str;
            }
            if (avgPercentDiffSearchTime > 0) {
                color = GREEN;
            } else if (avgPercentDiffSearchTime < 0) {
                color = RED;
            }
        } else if (field === 'branches') {
            str = avgPercentDiffBranches.toFixed(3) + '%';
            if (!str.startsWith('-')) {
                str = '+' + str;
            }
            if (avgPercentDiffBranches > 0) {
                color = GREEN;
            } else if (avgPercentDiffBranches < 0) {
                color = RED;
            }
        } else {
            throw new Error(`Invalid field name: '${field}'`);
        }
        if (color !== undefined) {
            str = `${color}${str}${RESET}`;
        }
        avgDiffs.push(str);
    }
    let toFormat: FieldLineToFormat[] = [
        'spacer',
        fields,
        'spacer',
        ...strData,
        'spacer',
        avgDiffs,
        'spacer',
    ];
    for (let line of formatFieldLines(toFormat, fields.length)) {
        out.push(line);
    }
    let successColor: string;
    if (secondSuccessCount > firstSuccessCount) {
        successColor = GREEN;
    } else if (firstSuccessCount > secondSuccessCount) {
        successColor = RED;
    } else {
        successColor = RESET;
    }
    out.push(`before: ${firstSuccessCount}/${data.length} tests passed, ${(firstSuccessCount / data.length * 100).toFixed(3)}% coverage`);
    out.push(`after: ${successColor}${secondSuccessCount}/${data.length} tests passed, ${(secondSuccessCount / data.length * 100).toFixed(3)}% coverage${RESET}`);
    return out.join('\n');
}


function parseArgv(data: string): string[] {
    let script = `for arg in "$@"; do printf "%s\\0" "$arg"; done`;
    let out = execSync(`bash -c '${script}' placeholder ${data}`).toString();
    return out.split('\0').filter(arg => arg);
}

interface ParsedVLSOutputData {
    searchTime: number;
    branches: number;
    solutions: string[];
}

function parseVLSOutput(data: VLSRunData, output: string): ParsedVLSOutputData {
    let search = data.search;
    let searchTime: number = 0;
    let branches: number = 0;
    let solutions: string[] = [];
    let lines = output.split('\n');
    while (lines.length > 0) {
        let line = lines.shift();
        if (line === undefined) {
            break;
        } else if (line === 'Solution found:') {
            let rle = (lines.shift() as string) + '\n';
            while (true) {
                let line = lines.shift();
                if (line === undefined) {
                    break;
                } else if (!(line.endsWith(' $') || line.endsWith(' !'))) {
                    lines.unshift(line);
                    break;
                } else {
                    rle += line.replaceAll(' ', '') + '\n';
                }
            }
            let p = parse(rle);
            let code: string;
            if (search.periodic) {
                let type = identifyPeriodic(p, search.periodic.period);
                code = getApgcode(type);
            } else {
                code = p.toCanonicalApgcode(search.grid.gens);
            }
            solutions.push(code);
        } else if (line.startsWith(`Search complete`)) {
            let parts = line.split(' ');
            let secondsStr = parts[parts.indexOf('seconds,') - 1];
            searchTime = Number(secondsStr);
            if (Number.isNaN(searchTime)) {
                throw new Error(`Invalid seconds count in 'Search complete' message: '${secondsStr}'`);
            }
            let branchesStr = parts[parts.indexOf('branches') - 1];
            branches = Number(branchesStr);
            if (Number.isNaN(branches)) {
                throw new Error(`Invalid branches count in 'Search complete' message: '${branchesStr}'`);
            }
        }
    }
    return {
        searchTime,
        solutions,
        branches,
    };
}

async function actualRunTest(test: Test, recompile: boolean): Promise<TestRunData> {
    let args = parseArgv(test.command);
    args = args.slice(1);
    let data = await runVLS(args, true, recompile);
    let totalTime = data.totalTime;
    let invocationTime = data.invocationTime;
    let success: boolean;
    if (data.out.good === false) {
        console.error(data.out.error);
        if (test.expected === 'error') {
            success = true;
        } else {
            success = false;
        }
    } else {
        if (test.expected === 'error') {
            success = false;
        } else {
            success = true;
        }
    }
    let searchTime = invocationTime;
    let branches = 0;
    if (data.out.good && test.expected !== 'error') {
        let expected: string[];
        if (test.expected === 'nothing') {
            expected = [];
        } else {
            expected = test.expected.toSorted();
        }
        let parsed = parseVLSOutput(data, data.out.data);
        searchTime = parsed.searchTime;
        branches = parsed.branches;
        let solutions = parsed.solutions.toSorted();
        if (!(expected.length === solutions.length && expected.every((code, index) => solutions[index] === code))) {
            success = false;
        }
    }
    return {
        test,
        success,
        totalTime,
        invocationTime,
        searchTime,
        branches,
    };
}

async function runTest(test: Test, recompile: boolean): Promise<TestRunData> {
    if (recompile) {
        console.log('Recompiling');
    } else {
        console.log(`Running test '${test.name}'`);
    }
    let iterations = test.iterations ?? 1;
    let fullData: TestRunData[] = [];
    for (let i = 0; i < iterations; i++) {
        let data = await actualRunTest(test, recompile && i === 0);
        fullData.push(data);
        if (!recompile) {
            console.log(`Iteration ${i + 1}/${iterations} complete in ${data.totalTime.toFixed(3)} seconds, was ${data.success ? 'successful' : 'not successful'}`);
        }
    }

    let success = fullData.every(x => x.success);
    let totalTime = fullData.reduce((x, y) => x + y.totalTime, 0) / fullData.length;
    let invocationTime = fullData.reduce((x, y) => x + y.invocationTime, 0) / fullData.length;
    let searchTime = fullData.reduce((x, y) => x + y.searchTime, 0) / fullData.length;
    let branches = fullData.reduce((x, y) => x + y.branches, 0) / fullData.length;
    return {
        test,
        success,
        totalTime,
        invocationTime,
        searchTime,
        branches,
    };
}

async function runAllTests(tests: Test[]): Promise<AllTestRunData> {
    let versionData = await getTestVersionData();
    let out: TestRunData[] = [];
    await runTest(RECOMPILATION_TEST, true);
    for (let i = 0; i < tests.length; i++) {
        out.push(await runTest(tests[i], false));
    }
    return {
        name: versionData.name,
        version: versionData,
        data: out,
    };
}


const COMMANDS: {[key: string]: (tests: Test[], args: string[]) => void | Promise<void>} = Object.assign(Object.create(null), {

    async 'run'(tests: Test[], args: string[]): Promise<void> {
        if (args.length !== 0) {
            error(`'./vls test run' expects no additional arguments`);
        }
        let data = await runAllTests(tests);
        console.log(prettyPrintTestData(data, DEFAULT_PRETTY_PRINT_FIELDS));
        await saveTestDataFile(data);
    },

    async 'print'(tests: Test[], args: string[]): Promise<void> {
        if (args.length !== 1) {
            error(`'./vls test print' expects exactly 1 additional argument`);
        }
        let data = await loadTestDataFile(args[0], tests);
        console.log(prettyPrintTestData(data, DEFAULT_PRETTY_PRINT_FIELDS));
    },

    async 'compare'(tests: Test[], args: string[]): Promise<void> {
        if (args.length !== 2) {
            error(`'./vls test compare' expects exactly 2 additional arguments`);
        }
        let second = await loadTestDataFile(args[1], tests);
        let first = await loadTestDataFile(args[0], tests);
        console.log(compareAndPrettyPrintTestData(first, second, DEFAULT_PRETTY_PRINT_FIELDS));
    },

} satisfies {[key: string]: (tests: Test[], args: string[]) => void | Promise<void>});

export async function main(args: string[]): Promise<void> {
    let tests = await loadTestsFile();
    let cmd = args[0];
    if (!(cmd in COMMANDS)) {
        error(`Invalid ./vls test subcommand: '${cmd}'`);
    }
    COMMANDS[cmd](tests, args.slice(1));
}
