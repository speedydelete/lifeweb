
import {join} from 'node:path';
import * as fs from 'node:fs/promises';

import {LIFEWEB_VERSION} from '../version.js';
import {runVLS} from './index.js';


interface Test {
    name: string;
    command: string;
    expected: string[] | 'nothing';
    untimed?: boolean;
    iterations?: number;
}

function parseTest(lines: string[]): Test {
    if (!lines[0].startsWith('test ')) {
        throw new Error(`Invalid test (first line does not start with 'test ')`);
    }
    let name = lines[0].slice('test '.length);
    let command: string | undefined = undefined;
    let expected: string[] | 'nothing' | undefined = undefined;
    let untimed: boolean = false;
    let iterations: number | undefined = undefined;
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
    let data = (await fs.readFile(join(import.meta.dirname, 'tests.txt'))).toString();
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
            currentTest = [];
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
    totalTime: number;
    invocationTime: number;
    searchTime: number;
    branches: number;
}

interface AllTestRunData {
    name: string;
    data: TestRunData[];
}

async function getCurrentFullVersion(): Promise<string> {
    let {execSync} = await import('node:child_process');
    let [hash, localStr] = execSync(`(cd ${import.meta.dirname}; git log -1 --format='%h %aI')`).toString().replace('\n', '').split(' ');
    let time = (new Date(localStr)).toISOString().replace('T', '_').slice(0, -5);
    return `${LIFEWEB_VERSION}_${hash}_${time}`;
}

async function saveTestData(data: AllTestRunData): string {
    let out = `${data.name}\n`;
    out += `test, totalTime, invocationTime, searchTime, branches\n`;
    for (let value of data.data) {
        out += `${value.test.name}, ${value.totalTime}, ${value.invocationTime}, ${value.searchTime}, ${value.branches}\n`;
    }
    return out;
}

function loadTestData(data: string, tests: Test[]): AllTestRunData {
    let lines = data.split('\n').map(line => line.trim()).filter(line => line.length > 0 && !line.startsWith('#'));
    let name = lines[0];
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
            throw new Error(`Nonexistent test: '${test}'`);
        }
        let totalTime = Number(data[1]);
        let invocationTime = Number(data[2]);
        let searchTime = Number(data[3]);
        let branches = Number(data[4]);
        out.push({
            test,
            totalTime,
            invocationTime,
            searchTime,
            branches,
        });
    }
    return {
        name,
        data: out,
    };
}


export async function main(args: string[]): Promise<void> {

}
