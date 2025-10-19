
import {Pattern, RuleError, PatternData, RLE_CHARS} from './pattern.js';
import {parseMAPRule} from './map.js';

export {Pattern, RuleError, RuleSymmetry} from './pattern.js';
export * as pattern from './pattern.js';
export * as map from './map.js';
export * as _identify from './identify.js';
export {identify} from './identify.js';


function _createPattern(data: PatternData, rule: string): Pattern {
    rule = rule.trim();
    let errors: string[] = [];
    try {
        let out = parseMAPRule(rule, data);
        if (typeof out === 'object') {
            return out;
        } else {
            rule = out;
        }
    } catch (error) {
        if (error instanceof RuleError) {
            errors.push(error.message);
        } else {
            throw error;
        }
    }
    // if (rule.startsWith('R')) {
    //     try {
    //         let out = parseHROTRule(rule);
    //         if (typeof out === 'object') {
    //             return out;
    //         } else {
    //             rule = out;
    //         }
    //     } catch (error) {
    //         if (error instanceof RuleError) {
    //             errors.push(error);
    //         } else {
    //             throw error;
    //         }
    //     }
    // }
    throw new RuleError(errors.join(', '));
}


export function parse(rle: string): Pattern {
    let lines = rle.split('\n');
    let raw: number[][] = [];
    let rule = 'B3/S23';
    let height = -1;
    let width = -1;
    let xOffset = 0;
    let yOffset = 0;
    let generation = 0;
    if (lines[0].startsWith('#L') && (lines[0] === '#Life 1.05' || lines[0] === '#Life 1.06')) {
        if (lines[0] === '#Life 1.05') {
            for (let line of lines.slice(1)) {
                if (line.startsWith('#')) {
                    let char = line[1];
                    if (char === 'P' || char === 'p') {
                        let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                        xOffset = parseInt(x);
                        yOffset = parseInt(y);
                    } else if (char === 'R' || char === 'r') {
                        rule = line.slice(2);
                    } else {
                        raw.push(Array.from(line).map(x => x === '*' ? 1 : 0));
                    }
                }
            }
        } else {
            for (let line of lines.slice(1)) {
                let [xStr, yStr] = line.split(' ');
                let x = parseInt(xStr) + xOffset;
                let y = parseInt(yStr) + yOffset;
                while (y < 0) {
                    yOffset--;
                    y++;
                    raw.unshift([]);
                }
                while (y > raw.length) {
                    raw.push([]);
                }
                while (x < 0) {
                    xOffset--;
                    x++;
                    raw.forEach(x => x.unshift(0));
                }
                let row = raw[y];
                while (row.length < x - 1) {
                    row.push(0);
                }
                row.push(1);
            }
        }
    } else if (lines[0].startsWith('!')) {
        for (let line of lines) {
            if (line.startsWith('!')) {
                continue;
            } else {
                raw.push(Array.from(line).map(x => x === 'O' ? 1 : 0));
            }
        }
    } else {
        let data = '';
        let headerFound = false;
        for (let line of lines) {
            line = line.trim();
            if (line.length === 0) {
                continue;
            } else if (line.startsWith('#')) {
                let char = line[1];
                if (char === 'C' || char === 'c') {
                    if (line.startsWith('#CXRLE')) {
                        line = line.slice(3);
                        let index = line.indexOf('Pos=');
                        if (index !== -1) {
                            let data = line.slice(index + 4);
                            let [x, y] = data.split(',');
                            xOffset = parseInt(x);
                            yOffset = parseInt(y);
                        }
                        index = line.indexOf('Gen=');
                        if (index !== -1) {
                            generation = parseInt(line.slice(index + 4));
                        }
                    }
                } else if (char === 'P' || char === 'p') {
                    let [x, y] = line.slice(2).split(' ').filter(x => x !== '');
                    xOffset = parseInt(x);
                    yOffset = parseInt(y);
                } else if (char === 'r') {
                    rule = line.slice(2);
                }
            } else if (line && !headerFound) {
                headerFound = true;
                line = line.trim();
                for (let pair of line.split(',')) {
                    if (!pair.includes('=')) {
                        continue;
                    }
                    let [key, value] = pair.split('=');
                    key = key.trim();
                    if (key === 'x') {
                        width = parseInt(value);
                    } else if (key === 'y') {
                        height = parseInt(value);
                    } else if (key === 'rule') {
                        rule = value;
                    }
                }
            } else {
                data += line;
            }
        }
        let num = '';
        let prefix = '';
        let currentLine: number[] = [];
        for (let i = 0; i < data.length; i++) {
            let char = data[i];
            if (char === 'b' || char === 'o') {
                let value = char === 'o' ? 1 : 0;
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('0123456789'.includes(char)) {
                num += char;
            } else if (char === '$') {
                raw.push(currentLine);
                currentLine = [];
                if (num !== '') {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        raw.push([]);
                    }
                    num = '';
                }
            } else if (char === '.') {
                if (num === '') {
                    currentLine.push(0);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(0);
                    }
                    num = '';
                }
            } else if ('ABCDEFGHIJKLMNOPQRSTUVWX'.includes(char)) {
                if (prefix) {
                    char = prefix + char;
                }
                let value = RLE_CHARS.indexOf(char);
                if (num === '') {
                    currentLine.push(value);
                } else {
                    let count = parseInt(num);
                    for (let i = 0; i < count; i++) {
                        currentLine.push(value);
                    }
                    num = '';
                }
            } else if ('pqrstuvwxy'.includes(char)) {
                prefix = char;
            }
        }
        raw.push(currentLine);
    }
    while (raw.length > 0 && raw[raw.length - 1].length === 0) {
        raw.pop();
    }
    let actualHeight = raw.length;
    let actualWidth = Math.max(...raw.map(x => x.length));
    if (height < actualHeight) {
        height = actualHeight;
    }
    if (width < actualWidth) {
        width = actualWidth;
    }
    let data = new Uint8Array(height * width);
    for (let y = 0; y < raw.length; y++) {
        let i = y * width;
        let line = raw[y];
        for (let x = 0; x < line.length; x++) {
            data[i] = line[x];
            i++;
        }
    }
    let out = _createPattern({height, width, data}, rule);
    out.xOffset = xOffset;
    out.yOffset = yOffset;
    out.generation = generation;
    return out;
}
