
import {IS_BROWSER, LifewebError, IdentityPattern} from '../core/index.js';
import {UNKNOWN, OFF, ON, Cell, cell, Grid} from './base.js';


interface Position {
    file: string;
    line: number;
    col: number;
}

function positionToString(pos: Position): string {
    return `${pos.file}:${pos.line}:${pos.col}`;
}

type ObjWithPos = {pos: Position};

type HasPos = Position | ObjWithPos;

class VLSFileError extends Error {

    name: string = 'VLSFileError';
    [Symbol.toStringTag]: string = 'VLSFileError';

}


type Range = {type: 'range', isInclusive: boolean, start: number, end: number};

type Generation = {type: 'generation', isAbsolute: boolean, value: number};
type GenerationRange = {type: 'generation_range', isInclusive: boolean, start: Generation, end: Generation};

type StateSpecifier = {type: 'state_specifier'} & (
    | {kind: 'nop'}
    | {kind: 'cell', cell: Cell}
    | {kind: 'periodic', cell: Cell, period: number}
);

function stateSpecifiersAreEqual(x: StateSpecifier, y: StateSpecifier): boolean {
    if (x.kind !== y.kind) {
        return false;
    }
    if (x.kind === 'nop' && y.kind === 'nop') {
        return true;
    } else if (x.kind === 'cell' && y.kind === 'cell') {
        return x.cell.eq(y.cell);
    } else if (x.kind === 'periodic' && y.kind === 'periodic') {
        return x.cell.eq(y.cell) && x.period === y.period;
    } else {
        throw new Error(`This error should not occur, please report it (invalid state specifier)`);
    }
}

type FullStateSpecifierPart = {gens: Generation | GenerationRange, value: StateSpecifier};
type FullStateSpecifier = {type: 'full_state_specifier', parts: FullStateSpecifierPart[]};

type Value = null | boolean | number | Range | Generation | GenerationRange | StateSpecifier | FullStateSpecifier;

type ValueType = 'null' | 'boolean' | 'number' | Extract<Value, object>['type'];

type ValueOfType<T extends ValueType> =
    T extends 'null' ? null :
    T extends 'boolean' ? boolean :
    T extends 'number' ? number :
    Extract<Value, {type: T}>
;

function typeOfValue(value: Value): ValueType {
    if (value === null) {
        return 'null';
    } else if (typeof value !== 'object') {
        return typeof value as ValueType;
    } else {
        return value.type;
    }
}

function copyValue<T extends Value>(value: T): T {
    let out: Value;
    if (value === null || typeof value !== 'object') {
        out = value;
    } else if (value.type === 'range') {
        out = {type: 'range', isInclusive: value.isInclusive, start: value.start, end: value.end};
    } else if (value.type === 'generation') {
        out = {type: 'generation', isAbsolute: value.isAbsolute, value: value.value};
    } else if (value.type === 'generation_range') {
        out = {type: 'generation_range', isInclusive: value.isInclusive, start: copyValue(value.start), end: copyValue(value.end)};
    } else if (value.type === 'state_specifier') {
        if (value.kind === 'nop') {
            out = {type: 'state_specifier', kind: 'nop'};
        } else if (value.kind === 'cell') {
            out = {type: 'state_specifier', kind: 'cell', cell: value.cell.copy()};
        } else if (value.kind === 'periodic') {
            out = {type: 'state_specifier', kind: 'periodic', cell: value.cell.copy(), period: value.period};
        } else {
            throw new Error(`This error should not occur, please report it (invalid state specifier)`);
        }
    } else if (value.type === 'full_state_specifier') {
        out = {type: 'full_state_specifier', parts: value.parts.map(part => ({gens: copyValue(part.gens), value: copyValue(part.value)}))};
    } else {
        throw new Error(`This error should not occur, please report it (invalid value)`);
    }
    return out as T;
}

function valueIsTruthy(value: Value): boolean {
    if (value === null) {
        return false;
    } else if (typeof value === 'boolean') {
        return value;
    } else if (typeof value === 'number') {
        return value !== 0;
    } else if (value.type === 'range') {
        return value.start >= value.end;
    } else if (value.type === 'generation') {
        return value.value !== 0;
    } else if (value.type === 'generation_range') {
        return true;
    } else if (value.type === 'state_specifier') {
        return true;
    } else if (value.type === 'full_state_specifier') {
        return true;
    } else {
        throw new Error(`This error should not occur, please report it (invalid value)`);
    }
}

function valuesAreEqual(x: Value, y: Value): boolean {
    if (x === null || typeof x !== 'object' || y === null || typeof y !== 'object') {
        return x === y;
    }
    if (x.type !== y.type) {
        return false;
    }
    if (x.type === 'range' && y.type === 'range') {
        return x.isInclusive === y.isInclusive && x.start === y.start && x.end === y.end;
    } else if (x.type === 'generation' && y.type === 'generation') {
        return x.isAbsolute === y.isAbsolute && x.value === y.value;
    } else if (x.type === 'generation_range' && y.type === 'generation_range') {
        return x.isInclusive === y.isInclusive
            && x.start.isAbsolute === y.start.isAbsolute && x.start.value === y.start.value
            && x.end.isAbsolute === y.end.isAbsolute && x.end.value === y.end.value
        ;
    } else if (x.type === 'state_specifier' && y.type === 'state_specifier') {
        return stateSpecifiersAreEqual(x, y);
    } else if (x.type === 'full_state_specifier' && y.type === 'full_state_specifier') {
        // placeholder
        return x === y;
    } else {
        throw new Error(`This error should not occur, please report it (invalid value)`);
    }
}


const EOF = Symbol();
type EOF = typeof EOF;

const WHITESPACE = new Set([' ', '\n', '\t', '\v', '\f']);

const KEYWORDS = new Set([
    // literals
    'null', 'true', 'false', 'nop', 'off', 'on', 'unknown', 'var', 'all', 'height', 'width', 'gens',
    // operators
    'state', 'noclause', 'yesclause', 'period',
    // statements
    'gens', 'let', 'mut',
] as const);
type Keyword = typeof KEYWORDS extends Set<infer T> ? T : never;

const SYMBOLS = new Set([
    // misc
    ';', ',', '(', ')', ':',
    // unary operators
    '+', '-', '~', '!', '%', '$',
    // arithmetic binary operators
    '+', '-', '*', '/', '%', '<<', '>>', '&', '^', '|', '..', '..=',
    // boolean binary operators
    '<', '<=', '>', '>=', '==', '!=', '&&', '||', '^^', '??', '?', ':',
    // assignment operators
    '=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|=', '??=',
] as const);
type VLSFileSymbol = typeof SYMBOLS extends Set<infer T> ? T : never;

type NewlineToken = ObjWithPos & {type: 'newline'};
type KeywordToken<T extends Keyword = Keyword> = ObjWithPos & {type: 'keyword', value: T};
type IdentifierToken = ObjWithPos & {type: 'identifier', value: string};
type NumberLiteralToken = ObjWithPos & {type: 'number-literal', value: number, raw: string};
type SymbolToken<T extends VLSFileSymbol = VLSFileSymbol> = ObjWithPos & {type: 'symbol', value: T};
type RLEToken = ObjWithPos & {type: 'rle', value: string};
type Token = NewlineToken | KeywordToken | IdentifierToken | NumberLiteralToken | SymbolToken | RLEToken;

const STRING_TOKEN_NAMES: {[K in Token['type']]: string} = {
    'newline': 'newline',
    'keyword': 'keyword',
    'identifier': 'identifier',
    'number-literal': 'number literal',
    'symbol': 'symbol',
    'rle': 'RLE',
};

function getTokenRaw(token: Token): string {
    if (token.type === 'newline') {
        return '\\n';
    } else if (token.type === 'number-literal') {
        return token.raw;
    } else {
        return JSON.stringify(token.value).slice(1, -1).replaceAll('\\"', '"');
    }
}

function tokenToString(token: Token | EOF): string {
    if (token === EOF) {
        return `end of file`;
    } else {
        return `${STRING_TOKEN_NAMES[token.type]} '${getTokenRaw(token)}'`;
    }
}


type Matcher = 
    | EOF
    | 'any'
    | Token['type']
    | Keyword
    | VLSFileSymbol
    | `identifier ${string}`
    | Matcher[]
;

const LINE_END: ['newline', ';', EOF] = ['newline', ';', EOF];

type MatcherReturnType<T extends Matcher> =
    T extends EOF ? EOF :
    T extends 'any' ? Token :
    T extends Token['type'] ? Extract<Token, {type: T}> :
    T extends Keyword ? KeywordToken :
    T extends VLSFileSymbol ? SymbolToken<T> :
    T extends `identifier ${string}` ? IdentifierToken :
    // T extends (infer U)[] ? MatcherReturnType<U> :
    T extends any[] ? Token :
    never
;

function matcherToString(matcher: Matcher): string {
    if (matcher === EOF) {
        return `end of file`;
    } else if (typeof matcher === 'string') {
        if (KEYWORDS.has(matcher as Keyword)) {
            return `keyword '${matcher}'`;
        } else if (SYMBOLS.has(matcher as VLSFileSymbol)) {
            return `symbol '${matcher}'`;
        } else if (matcher.startsWith('identifier ')) {
            return `identifier '${matcher.slice('identifier '.length)}'`;
        } else {
            return STRING_TOKEN_NAMES[matcher as Token['type']];
        }
    } else {
        let out = matcher.map(matcherToString);
        if (out.length === 0) {
            return `nothing`;
        } else if (out.length === 1) {
            return out[0];
        } else if (out.length === 2) {
            return `${out[0]} or ${out[1]}`;
        } else {
            return `${out.slice(0, -1).join(', ')}, or ${out[out.length - 1]}`;
        }
    }
}


type SpecialIdentifier = 
    | 'width' | 'height' | 'gens'
;

type IdentifierExpression = ObjWithPos & {type: 'identifier-expression', name: string};
type LiteralExpression = ObjWithPos & {type: 'literal-expression', value: Value};
type SpecialIdentifierExpression = ObjWithPos & {type: 'special-identifier-expression', name: SpecialIdentifier};
type UnaryOperator =
    | '+' | '-' | '~' | '!' | '%' | '$'
    | 'state' | 'noclause' | 'yesclause' | 'period'
;
type UnaryExpression = ObjWithPos & {type: 'unary-expression', op: UnaryOperator, value: Expression};
type BinaryOperator =
    |'+' | '-' | '*' | '/' | '%' | '<<' | '>>' | '&' | '^' | '|' | '..' | '..='
    | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||' | '^^' | '??'
    | '='
;
type BinaryExpression = ObjWithPos & {type: 'binary-expression', op: BinaryOperator, left: Expression, right: Expression};
type FullStateSpecifierExpressionPart = ObjWithPos & {type: 'full-state-specifier-expression-part', gens: Expression, value: Expression};
type FullStateSpecifierExpression = ObjWithPos & {type: 'full-state-specifier-expression', parts: FullStateSpecifierExpressionPart[]};
type ConditionalExpression = ObjWithPos & {type: 'conditional-expression', condition: Expression, ifTrue: Expression, ifFalse: Expression};
type Expression = IdentifierExpression | LiteralExpression | SpecialIdentifierExpression | UnaryExpression | BinaryExpression | FullStateSpecifierExpression | ConditionalExpression;
type AnyExpressionNode = Expression | FullStateSpecifierExpressionPart;

type ExpressionStatement = ObjWithPos & {type: 'expression-statement', expr: Expression};
type RLEStatement = ObjWithPos & {type: 'rle-statement', rle: RLEToken, gens?: Expression, offset?: {x: Expression, y: Expression}};
type VariableDeclarationStatement = ObjWithPos & {type: 'variable-declaration-statement', mut: boolean, name: string, value?: Expression};
type Statement = ExpressionStatement | RLEStatement | VariableDeclarationStatement;
type AnyStatementNode = Statement;

type Node = AnyExpressionNode | AnyStatementNode;
type NodeType = Node['type'];

function createNode<T extends NodeType>(pos: HasPos, type: T, data: Omit<Extract<Node, {type: T}>, 'pos' | 'type'>): Extract<NodeType, {type: T}> {
    return {pos, type, ...data} as Extract<NodeType, {type: T}>;
}


class VLSFileParser {

    currentFilePath: string;
    code: string;
    tokens: Token[];
    pos: number;

    constructor(filePath: string, code: string) {
        this.currentFilePath = filePath;
        this.code = code;
        this.tokens = this.tokenize(code);
        this.pos = 0;
    }

    getCurrentPosition(): Position {
        if (this.tokens[this.pos] === undefined) {
            return this.tokens[this.tokens.length - 1].pos;
        } else {
            return this.tokens[this.pos].pos;
        }
    }

    error(pos: HasPos | undefined, msg: string): never {
        if (pos === undefined) {
            pos = this.getCurrentPosition();
        } else if ('pos' in pos) {
            pos = pos.pos;
        }
        let trace: string[] = [];
        let text = `Error: ${msg}\n    at ${positionToString(pos)}`;
        throw new VLSFileError(text);
    }

    readonly IDENTIFIER_REGEX = /^\p{XID_Start}\p{XID_Continue}*$/u;
    readonly NUMBER_REGEX = /^-?(0|[1-9]\d*(.[0-9]+)?(e[+-]?[1-9]\d+(.[0-9]+)?)?|0b[01]+|0o[0-7]+|0x[0-9a-f])$/iu;

    tryToConvertToSingleToken(pos: Position, value: string): Token | false | undefined {
        pos = structuredClone(pos);
        if (WHITESPACE.has(value)) {
            // undefined means whitespace
            return undefined;
        } else if (value.match(this.IDENTIFIER_REGEX)) {
            return {pos, type: 'identifier', value};
        } else if (value.match(this.NUMBER_REGEX)) {
            return {pos, type: 'number-literal', value: Number(value), raw: value};
        } else if (SYMBOLS.has(value as VLSFileSymbol)) {
            return {pos, type: 'symbol', value: value as VLSFileSymbol};
        } else {
            return false;
        }
    }

    readonly RLE_HEADER_REGEX = /^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)\s*(,\s*rule\s*=\s*.*\s*)?$/;

    tokenize(code: string): Token[] {
        let file = this.currentFilePath;
        // call Array.from here to use real Unicode characters
        let lines = code.split('\n').map(line => Array.from(line));
        let out: Token[] = [];
        let multiLineComment: false | Position = false;
        for (let lineNumber = 1; lineNumber < lines.length + 1; lineNumber++) {
            let line: string[] = [];
            let startLineNumber = lineNumber;
            while (true) {
                for (let char of lines[lineNumber - 1]) {
                    line.push(char);
                }
                if (line[line.length - 1] === '\\') {
                    lineNumber++;
                } else {
                    break;
                }
            }
            lineNumber = startLineNumber;
            let currentLine: Token[] = [];
            let singleLineComment = false;
            let col = 1;
            while (WHITESPACE.has(line[0])) {
                line = line.slice(1);
                col++;
            }
            while (WHITESPACE.has(line[line.length - 1])) {
                line = line.slice(0, -1);
            }
            if (line.join().match(this.RLE_HEADER_REGEX)) {
                let pos: Position = {file, line: lineNumber, col};
                let rle = line.join();
                while (true) {
                    lineNumber++;
                    let line = lines[lineNumber - 1];
                    let index = line.indexOf('!');
                    if (index === -1) {
                        rle += '\n' + line.join();
                        continue;
                    } else {
                        rle += '\n' + line.slice(0, index + 1).join();
                        line = line.slice(index + 1);
                        col = index + 2;
                        break;
                    }
                }
                out.push({pos, type: 'rle', value: rle});
            }
            while (line.length > 0) {
                if (col > lines[lineNumber - 1].length) {
                    col -= lines[lineNumber - 1].length;
                    lineNumber++;
                }
                let pos = {file, line: lineNumber, col};
                let char = line[0];
                // do comments
                if (singleLineComment) {
                    line.shift();
                    col += 1;
                    continue;
                }
                if (multiLineComment) {
                    if (char === '*' && line[1] === '/') {
                        multiLineComment = false;
                        line.shift();
                        line.shift();
                        col += 2;
                        continue;
                    } else {
                        line.shift();
                        col += 1;
                        continue;
                    }
                }
                if (char === '/' && line[1] === '/') {
                    singleLineComment = true;
                    line.shift();
                    line.shift();
                    col += 2;
                    continue;
                } else if (char === '/' && line[1] === '*') {
                    multiLineComment = structuredClone(pos);
                    line.shift();
                    line.shift();
                    col += 2;
                    continue;
                }
                // get the largest possible token
                let found = false;
                for (let i = line.length; i > 0; i--) {
                    let value = line.slice(0, i).join('');
                    let token = this.tryToConvertToSingleToken(pos, value);
                    if (token !== false) {
                        // undefined means whitespace
                        if (token !== undefined) {
                            currentLine.push(token);
                        }
                        found = true;
                        for (let j = 0; j < i; j++) {
                            line.shift();
                        }
                        col += i;
                        break;
                    }
                }
                if (!found) {
                    this.error(pos, `Cannot parse input into token`);
                }
            }
            for (let token of currentLine) {
                out.push(token);
            }
            out.push({pos: {file, line: lineNumber, col}, type: 'newline'});
        }
        if (multiLineComment) {
            this.error(multiLineComment, `Unterminated multi-line comment`);
        }
        if (out.length === 0) {
            this.error({file, line: 1, col: 1}, `Empty file`);
        }
        return out;
    }

    peek<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(undefined, `Unexpected end of input`);
        } else {
            return out as MatcherReturnType<T>;
        }
    }

    peekOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
        return (this.tokens[this.pos] ?? EOF) as MatcherReturnType<T> | EOF;
    }

    advance<T extends Exclude<Matcher, EOF> = Exclude<Matcher, EOF>>(): MatcherReturnType<T> {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            this.error(undefined, `Unexpected end of input`);
        } else {
            this.pos++;
            return out as MatcherReturnType<T>;
        }
    }

    advanceOrEOF<T extends Matcher = Matcher>(): MatcherReturnType<T> | EOF {
        let out = this.tokens[this.pos];
        if (out === undefined) {
            return EOF;
        } else {
            this.pos++;
            return out as MatcherReturnType<T>;
        }
    }

    _match(token: Token | EOF, matcher: Matcher): boolean {
        if (matcher === EOF) {
            return token === EOF;
        } else if (token === EOF) {
            return false;
        } else if (typeof matcher === 'string') {
            if (KEYWORDS.has(matcher as Keyword)) {
                return token.type === 'keyword' && token.value === matcher;
            } else if (SYMBOLS.has(matcher as VLSFileSymbol)) {
                return token.type === 'symbol' && token.value === matcher;
            } else if (matcher.startsWith('identifier ')) {
                return token.type === 'identifier' && token.value === matcher.slice('identifier '.length);
            } else {
                return token.type === matcher;
            }
        } else {
            return matcher.some(value => this._match(token, value));
        }
    }

    match(...data: Matcher[]): boolean {
        for (let i = 0; i < data.length; i++) {
            let token = (this.tokens[this.pos + i] ?? EOF) as Token | EOF;
            if (!this._match(token, data[i])) {
                return false;
            }
        }
        return true;
    }

    expect(...data: Matcher[]): void {
        for (let i = 0; i < data.length; i++) {
            let token = (this.tokens[this.pos + i] ?? EOF) as Token | EOF;
            let matcher = data[i];
            if (!this._match(token, matcher)) {
                this.error(undefined, `Expected ${matcherToString(matcher)}, got ${tokenToString(token)}`);;
            }
        }
    }

    eat<T extends Exclude<Matcher, EOF>>(matcher: T): MatcherReturnType<T> {
        this.expect(matcher);
        return this.advance<T>();
    }

    try<T, U extends any[]>(func: (this: this, ...args: U) => T, ...args: U): T | undefined {
        try {
            return func.apply(this, args);
        } catch (error) {
            if (error instanceof VLSFileError) {
                return undefined;
            } else {
                throw error;
            }
        }
    }

    tryVoid<T extends any[]>(func: (this: this, ...args: T) => void, ...args: T): boolean {
        try {
            func.apply(this, args);
            return true;
        } catch (error) {
            if (error instanceof VLSFileError) {
                return false;
            } else {
                throw error;
            }
        }
    }

    primaryExpression(): Expression {
        if (this.match('identifier')) {
            let token = this.advance<'identifier'>();
            return createNode(token, 'identifier-expression', {name: token.value});
        } else if (this.match('null')) {
            let token = this.advance();
            return createNode(token, 'literal-expression', {value: null});
        } else if (this.match('false')) {
            let token = this.advance();
            return createNode(token, 'literal-expression', {value: false});
        } else if (this.match('true')) {
            let token = this.advance();
            return createNode(token, 'literal-expression', {value: true});
        } else if (this.match('number-literal')) {
            let token = this.advance<'number-literal'>();
            return createNode(token, 'literal-expression', {value: token.value});
        } else if (this.match('nop')) {
            let token = this.advance();
            let value: StateSpecifier = {type: 'state_specifier', kind: 'nop'};
            return createNode(token, 'literal-expression', {value});
        } else if (this.match('off')) {
            let token = this.advance();
            let value: StateSpecifier = {type: 'state_specifier', kind: 'cell', cell: cell(OFF)};
            return createNode(token, 'literal-expression', {value});
        } else if (this.match('on')) {
            let token = this.advance();
            let value: StateSpecifier = {type: 'state_specifier', kind: 'cell', cell: cell(ON)};
            return createNode(token, 'literal-expression', {value});
        } else if (this.match('unknown')) {
            let token = this.advance();
            let value: StateSpecifier = {type: 'state_specifier', kind: 'cell', cell: cell(UNKNOWN)};
            return createNode(token, 'literal-expression', {value});
        } else if (this.match('all')) {
            let token = this.advance();
            let start: Generation = {type: 'generation', isAbsolute: true, value: 0};
            let end: Generation = {type: 'generation', isAbsolute: true, value: -1};
            let value: GenerationRange = {type: 'generation_range', isInclusive: true, start, end};
            return createNode(token, 'literal-expression', {value});
        } else if (this.match(['height', 'width', 'gens'])) {
            let token = this.advance() as KeywordToken<SpecialIdentifier>;
            return createNode(token, 'special-identifier-expression', {name: token.value});
        } else if (this.match('(')) {
            let out = this.expression();
            this.eat(')');
            return out;
        } else {
            this.error(undefined, `Expected primary expression`);
        }
    }

    readonly UNARY_OPERATORS: Matcher[] = ['+', '-', '~', '!', '%', '$', 'state', 'noclause', 'yesclause', 'period'];

    unaryExpression(): Expression {
        if (!this.match(this.UNARY_OPERATORS)) {
            return this.primaryExpression();
        }
        let op = this.eat(this.UNARY_OPERATORS) as SymbolToken | KeywordToken;
        let value = this.primaryExpression();
        return createNode(op, 'unary-expression', {op: op.value as UnaryOperator, value});
    }

    rangeExpression(): Expression {
        let left = this.unaryExpression();
        while (this.match(['..', '..='])) {
            let op = this.advance<'..' | '..='>();
            let right = this.unaryExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    multiplicativeExpression(): Expression {
        let left = this.rangeExpression();
        while (this.match(['*', '/', '%'])) {
            let op = this.advance<'*' | '/' | '%'>();
            let right = this.rangeExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    additiveExpression(): Expression {
        let left = this.multiplicativeExpression();
        while (this.match(['+', '-'])) {
            let op = this.advance<'+' | '-'>();
            let right = this.multiplicativeExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    shiftExpression(): Expression {
        let left = this.additiveExpression();
        while (this.match(['<<', '>>'])) {
            let op = this.advance<'<<' | '>>'>();
            let right = this.additiveExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    relationalExpression(): Expression {
        let left = this.shiftExpression();
        while (this.match(['<', '<=', '>', '>='])) {
            let op = this.advance<'<' | '<=' | '>' | '>='>();
            let right = this.shiftExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    equalityExpression(): Expression {
        let left = this.relationalExpression();
        while (this.match(['==', '!='])) {
            let op = this.advance<'==' | '!='>();
            let right = this.relationalExpression();
            left = createNode(op, 'binary-expression', {op: op.value, left, right});
        }
        return left;
    }

    bitwiseANDExpression(): Expression {
        let left = this.equalityExpression();
        while (this.match('&')) {
            let op = this.advance();
            let right = this.equalityExpression();
            left = createNode(op, 'binary-expression', {op: '&', left, right});
        }
        return left;
    }

    bitwiseXORExpression(): Expression {
        let left = this.bitwiseANDExpression();
        while (this.match('^')) {
            let op = this.advance();
            let right = this.bitwiseANDExpression();
            left = createNode(op, 'binary-expression', {op: '^', left, right});
        }
        return left;
    }

    bitwiseORExpression(): Expression {
        let left = this.bitwiseXORExpression();
        while (this.match('|')) {
            let op = this.advance();
            let right = this.bitwiseXORExpression();
            left = createNode(op, 'binary-expression', {op: '|', left, right});
        }
        return left;
    }

    logicalANDExpression(): Expression {
        let left = this.bitwiseORExpression();
        while (this.match('&&')) {
            let op = this.advance();
            let right = this.bitwiseORExpression();
            left = createNode(op, 'binary-expression', {op: '&&', left, right});
        }
        return left;
    }

    logicalXORExpression(): Expression {
        let left = this.logicalANDExpression();
        while (this.match('^^')) {
            let op = this.advance();
            let right = this.logicalANDExpression();
            left = createNode(op, 'binary-expression', {op: '^^', left, right});
        }
        return left;
    }

    logicalORExpression(): Expression {
        let left = this.logicalXORExpression();
        while (this.match('||')) {
            let op = this.advance();
            let right = this.logicalXORExpression();
            left = createNode(op, 'binary-expression', {op: '||', left, right});
        }
        return left;
    }

    defaultToExpression(): Expression {
        let left = this.logicalORExpression();
        while (this.match('??')) {
            let op = this.advance();
            let right = this.logicalORExpression();
            left = createNode(op, 'binary-expression', {op: '??', left, right});
        }
        return left;
    }

    fullStateSpecifierExpressionPart(): FullStateSpecifierExpressionPart {
        let gens = this.rangeExpression();
        let colon = this.eat(':');
        let value = this.defaultToExpression();
        return createNode(colon, 'full-state-specifier-expression-part', {gens, value});
    }

    fullStateSpecifierExpression(): Expression {
        let isSpecifier = false;
        let startPos = this.pos;
        try {
            this.rangeExpression();
            if (this.match(':')) {
                isSpecifier = true;
            }
        } catch (error) {
            if (!(error instanceof VLSFileError)) {
                throw error;
            }
        }
        this.pos = startPos;
        if (!isSpecifier) {
            return this.logicalORExpression();
        }
        let pos = this.getCurrentPosition();
        let parts: FullStateSpecifierExpressionPart[] = [];
        while (true) {
            parts.push(this.fullStateSpecifierExpressionPart());
            if (this.match(',')) {
                this.advance();
            } else {
                break;
            }            
        }
        return createNode(pos, 'full-state-specifier-expression', {parts});
    }

    conditionalExpression(): Expression {
       let condition = this.logicalORExpression();
        if (!this.match('?')) {
            return condition;
        }
        let questionMark = this.advance();
        let ifTrue = this.expression();
        this.eat(':');
        let ifFalse = this.conditionalExpression();
        return createNode(questionMark, 'conditional-expression', {condition, ifTrue, ifFalse});
    }

    expression(): Expression {
        let left = this.conditionalExpression();
        if (!this.match(['=', '+=', '-=', '*=', '/=', '%=', '<<=', '>>=', '&=', '^=', '|=', '??='])) {
            return left;
        }
        let op = this.advance() as SymbolToken;
        let right = this.conditionalExpression();
        if (op.value !== '=') {
            let stringOp = op.value.slice(1) as BinaryOperator;
            right = createNode(op, 'binary-expression', {op: stringOp, left, right});
        }
        return createNode(op, 'binary-expression', {op: '=', left, right});
    }

    expressionStatement(): Statement {
        let pos = this.getCurrentPosition();
        let expr = this.expression();
        this.eat(LINE_END);
        return createNode(pos, 'expression-statement', {expr});
    }

    rleStatement(): Statement {
        let pos = this.getCurrentPosition();
        if (this.match('rle')) {
            let token = this.advance<'rle'>();
            this.eat(LINE_END);
            return createNode(pos, 'rle-statement', {rle: token});
        }
        this.eat(['identifier gen', 'gens']);
        let gens = this.expression();
        let offset: RLEStatement['offset'] = undefined;
        if (this.match(`identifier offset`)) {
            this.advance();
            let x = this.expression();
            this.eat(',');
            let y = this.expression();
            offset = {x, y};
        }
        this.eat(':');
        this.eat('newline');
        while (this.match('newline')) {
            this.advance();
        }
        let rle = this.eat('rle');
        this.eat(LINE_END);
        return createNode(pos, 'rle-statement', {rle, gens, offset});
    }

    variableDeclarationStatement(): Statement {
        let pos = this.getCurrentPosition();
        this.eat('let');
        let mut = false;
        if (this.match('mut')) {
            this.advance();
            mut = true;
        }
        let name = this.eat('identifier').value;
        let value: Expression | undefined = undefined;
        if (this.match('=')) {
            this.advance();
            value = this.expression();
        }
        if (!mut && value === undefined) {
            this.error(undefined, `Non-mutable variable declarations must include an initializer`);
        }
        this.eat(LINE_END);
        return createNode(pos, 'variable-declaration-statement', {mut, name, value});
    }

    statement(): Statement {
        while (this.match(LINE_END)) {
            this.advance();
        }
        if (this.match('rle')) {
            return this.rleStatement();
        } else if (this.match(['identifier gen', 'gens'])) {
            // advanced lookahead to see if it is a RLE statement
            // this works because RLE statements must end in a colon followed
            // by one or more newlines and then a RLE token, and this is
            // always an invalid expression, so the grammar is unambiguous
            let startPos = this.pos;
            let isRLEStatement = false;
            while (!this.match(LINE_END)) {
                if (this.match(':')) {
                    this.advance();
                    while (this.match(LINE_END)) {
                        this.advance();
                    }
                    if (this.match('rle')) {
                        isRLEStatement = true;
                    }
                    break;
                }
            }
            this.pos = startPos;
            if (isRLEStatement) {
                return this.rleStatement();
            } else {
                return this.expressionStatement();
            }
        } else if (this.match('let')) {
            return this.variableDeclarationStatement();
        } else {
            return this.expressionStatement();
        }
    }

    async program(): Promise<Statement[]> {
        let out: Statement[] = [];
        while (this.pos < this.tokens.length) {
            out.push(this.statement());
        }
        return out;
    }

}


interface Variable {
    mut?: boolean;
    value: Value;
}

class Scope {

    runner: VLSFileRunner;
    parent: Scope | undefined;
    vars: Map<string, Variable>;
    states: Map<number, FullStateSpecifier>;

    constructor(runner: VLSFileRunner, parent: Scope | undefined) {
        this.runner = runner;
        this.parent = parent;
        this.vars = new Map();
        this.states = new Map();
    }

    getVar(pos: HasPos, name: string): Variable {
        let value = this.vars.get(name);
        if (value !== undefined) {
            return value;
        } else if (this.parent) {
            return this.parent.getVar(pos, name);
        } else {
            this.runner.error(pos, `Variable ${name} is not defined`);
        }
    }

    declareVar(name: string, value: Variable): void {
        this.vars.set(name, value);
    }

    setVar(pos: HasPos, name: string, value: Value): void {
        let data = this.vars.get(name);
        if (data !== undefined) {
            if (!data.mut) {
                this.runner.error(pos, `Variable ${name} is not mutable`);
            }
            this.vars.set(name, {mut: data.mut, value});
        } else if (this.parent) {
            this.parent.setVar(pos, name, value);
        } else {
            this.runner.error(pos, `Variable ${name} is not defined`);
        }
    }

    getState(pos: HasPos, state: number): FullStateSpecifier {
        let value = this.states.get(state);
        if (value !== undefined) {
            return value;
        } else if (this.parent) {
            return this.parent.getState(pos, state);
        } else {
            this.runner.error(pos, `State ${state} is not defined`);
        }
    }

    setState(state: number, value: FullStateSpecifier): void {
        this.states.set(state, value);
    }

}


type IdentifierLvalue = {type: 'lvalue', kind: 'identifier', name: string};
type SpecialIdentifierLvalue = {type: 'lvalue', kind: 'special-identifier', name: SpecialIdentifier};
type StateLvalue = {type: 'lvalue', kind: 'state', value: number};

type Lvalue = IdentifierLvalue | SpecialIdentifierLvalue | StateLvalue;

type ExpressionValue = Value | Lvalue;


class VLSFileRunner {

    code: string;
    grid: Grid;
    scope: Scope;
    callStack: Position[];

    constructor(code: string, initialMinRule: string, initialMaxRule: string) {
        this.code = code;
        this.grid = new Grid(0, 0, 0);
        this.grid.minRule = initialMinRule;
        this.grid.maxRule = initialMaxRule;
        this.scope = new Scope(this, undefined);
        this.callStack = [];
    }

    error(pos: HasPos, msg: string): never {
        if ('pos' in pos) {
            pos = pos.pos;
        }
        let text = `Error: ${msg}\n    at ${positionToString(pos)}`;
        if (this.callStack) {
            for (let value of this.callStack) {
                text += `\n    at ${positionToString(value)}`;
            }
        }
        throw new VLSFileError(text);
    }

    assertType<T extends ValueType>(pos: HasPos, value: Value, type: T, whatFor: string): ValueOfType<T> {
        let valueType = typeOfValue(value);
        if (valueType !== type) {
            this.error(pos, `Expected value of type '${type}' for ${whatFor}, got type '${valueType}'`);
        }
        return value as ValueOfType<T>;
    }

    getSpecialIdentifier(pos: HasPos, name: SpecialIdentifier): Value {
        if (name === 'width') {
            return this.grid.width;
        } else if (name === 'height') {
            return this.grid.height;
        } else if (name === 'gens') {
            return this.grid.gens;
        } else {
            throw new Error(`This error should not occur, please report it (invalid special identifier)`);
        }
    }

    setSpecialIdentifier(opPos: HasPos, namePos: HasPos, name: SpecialIdentifier, value: Value): void {
        if (name === 'width' || name === 'height' || name === 'gens') {
            value = this.assertType(opPos, value, 'number', `assignment to ${name}`);
            if (name === 'width') {
                if (this.grid.width === value) {
                    return;
                } else if (value < this.grid.width) {
                    this.grid.shrink({right: this.grid.width - value});
                } else {
                    this.grid.expand({right: value - this.grid.width});
                }
            } else if (name === 'height') {
                if (this.grid.height === value) {
                    return;
                } else if (value < this.grid.height) {
                    this.grid.shrink({bottom: this.grid.height - value});
                } else {
                    this.grid.expand({bottom: value - this.grid.height});
                }
            } else {

            }
        } else {
            throw new Error(`This error should not occur, please report it (invalid special identifier)`);
        }
    }

    decayLvalues(pos: HasPos, value: ExpressionValue): Value {
        if (value !== null && typeof value === 'object' && value.type === 'lvalue') {
            if (value.kind === 'identifier') {
                return this.scope.getVar(pos, value.name).value;
            } else if (value.kind === 'state') {
                return this.scope.getState(pos, value.value);
            } else {
                throw new Error(`This error should not occur, please report it (invalid lvalue)`);
            }
        } else {
            return value;
        }
    }

    unaryExpression(node: UnaryExpression): ExpressionValue {
        let op = node.op;
        let arg = this.expression(node.value);
        let argPos = node.value.pos;
        if (op === '+') {
            return this.assertType(argPos, arg, 'number', 'unary + operator');
        } else if (op === '-') {
            return -this.assertType(argPos, arg, 'number', 'unary - operator');
        } else if (op === '~') {
            return Number(~BigInt(this.assertType(argPos, arg, 'number', 'unary - operator')));
        } else if (op === '!') {
            return !valueIsTruthy(arg);
        } else if (op === '%' || op === '$') {
            let isAbsolute = op === '$';
            let value = this.assertType(argPos, arg, 'number', `${op} operator`);
            return {type: 'generation', isAbsolute, value};
        } else if (op === 'state') {
            let value = this.assertType(argPos, arg, 'number', 'state operator');
            return {type: 'lvalue', kind: 'state', value};
        } else if (op === 'noclause' || op === 'yesclause') {
            let value = copyValue(this.assertType(argPos, arg, 'state_specifier', `${op} operator`));
            let noClause = op === 'noclause';
            if (value.kind !== 'nop') {
                value.cell.noClause = noClause;
            }
            return value;
        } else if (op === 'period') {
            let period = this.assertType(argPos, arg, 'number', 'period operator');
            return {type: 'state_specifier', kind: 'periodic', cell: cell(UNKNOWN), period};
        } else {
            throw new Error(`This error should not occur, please report it (invalid unary operator)`);
        }
    }

    binaryExpression(node: BinaryExpression): ExpressionValue {
        let op = node.op;
        let left = this._expression(node.left);
        let leftPos = node.left.pos;
        // first the assignment operator
        if (op === '=') {
            if (!(left !== null && typeof left === 'object' && left.type === 'lvalue')) {
                this.error(leftPos, `Left-hand operand of assignment operator is not an lvalue`);
            }
            let right = this.expression(node.right);
            if (left.kind === 'identifier') {
                this.scope.setVar(leftPos, left.name, right);
            } else if (left.kind === 'special-identifier') {
                this.setSpecialIdentifier(node, leftPos, left.name, right);
            } else if (left.kind === 'state') {
                this.scope.setState(left.value, this.assertType(node, right, 'full_state_specifier', `assigning to state`));
            } else {
                throw new Error(`This error should not occur, please report it (invalid lvalue)`);
            }
            return right;
        }
        left = this.decayLvalues(node, left);
        // next the short-circuiting operators
        if (op === '&&') {
            if (valueIsTruthy(left)) {
                return valueIsTruthy(this.expression(node.right));
            } else {
                return false;
            }
        } else if (op === '||') {
            if (valueIsTruthy(left)) {
                return true;
            } else {
                return valueIsTruthy(this.expression(node.right));;
            }
        } else if (op === '??') {
            if (left === null) {
                return this.expression(node.right);
            } else {
                return left;
            }
        }
        // then the operators that don't work on only numbers
        let right = this.expression(node.right);
        let rightPos = node.right.pos;
        if (op === '..' || op === '..=') {
            let isInclusive = op === '..=';
            if (typeof left === 'number' && typeof right === 'number') {
                return {type: 'range', isInclusive, start: left, end: right};
            } else if (left !== null && typeof left === 'object' && left.type === 'generation' && right !== null && typeof right === 'object' && right.type === 'generation') {
                return {type: 'generation_range', isInclusive, start: left, end: right};
            } else {
                this.error(node, `Invalid types for ${op} operator (expected 'number' and 'number', or 'generation' and 'generation')`);
            }
        } else if (op === '==') {
            return valuesAreEqual(left, right);
        } else if (op === '!=') {
            return !valuesAreEqual(left, right);
        } else if (op === '^^') {
            return valueIsTruthy(left) !== valueIsTruthy(right);
        }
        // finally the operators that work on numbers
        left = this.assertType(leftPos, left, 'number', `${op} operator`);
        right = this.assertType(rightPos, right, 'number', `${op} operator`);
        if (op === '+') {
            return left + right;
        } else if (op === '-') {
            return left - right;
        } else if (op === '*') {
            return left * right;
        } else if (op === '/') {
            return left / right;
        } else if (op === '%') {
            return left % right;
        } else if (op === '<<') {
            return Number(BigInt(left) << BigInt(right));
        } else if (op === '>>') {
            return Number(BigInt(left) >> BigInt(right));
        } else if (op === '&') {
            return Number(BigInt(left) & BigInt(right));
        } else if (op === '^') {
            return Number(BigInt(left) ^ BigInt(right));
        } else if (op === '|') {
            return Number(BigInt(left) | BigInt(right));
        } else if (op === '<') {
            return left < right;
        } else if (op === '<=') {
            return left <= right;
        } else if (op === '>') {
            return left > right;
        } else if (op === '>=') {
            return left >= right;
        } else {
            throw new Error(`This error should not occur, please report it (invalid binary operator)`);
        }
    }

    _expression(node: Expression): ExpressionValue {
        if (node.type === 'identifier-expression') {
            return {type: 'lvalue', kind: 'identifier', name: node.name};
        } else if (node.type === 'literal-expression') {
            return node.value;
        } else if (node.type === 'special-identifier-expression') {
            return {type: 'lvalue', kind: 'special-identifier', name: node.name};
        } else if (node.type === 'unary-expression') {
            return this.unaryExpression(node);
        } else if (node.type === 'binary-expression') {
            return this.binaryExpression(node);
        } else if (node.type === 'full-state-specifier-expression') {
            let parts: FullStateSpecifierPart[] = [];
            for (let part of node.parts) {
                let gens = this.expression(part.gens);
                if (!(gens !== null && typeof gens === 'object' && (gens.type === 'generation' || gens.type === 'generation_range'))) {
                    this.error(part.gens, `Expected value of type 'generation' or 'generation_range' for generation in full state specifier, got type '${typeOfValue(gens)}'`);
                }
                let value = this.assertType(part.value, this.expression(part.value), 'state_specifier', `specifier part of full state specifier`);
                parts.push({gens, value});
            }
            return {type: 'full_state_specifier', parts};
        } else if (node.type === 'conditional-expression') {
            if (valueIsTruthy(this.expression(node.condition))) {
                return this._expression(node.ifTrue);
            } else {
                return this._expression(node.ifFalse);
            }
        } else {
            throw new Error(`This error should not occur, please report it (invalid expression)`);
        }
    }
    
    expression(node: Expression): Value {
        return this.decayLvalues(node, this._expression(node));
    }

    _resolveGeneration(pos: HasPos, value: Generation, relativeTo: number) {
        let out = value.value;
        if (!value.isAbsolute) {
            out += relativeTo;
        }
        if (out < 0) {
            out += this.grid.gens;
        }
        if (out < 0 || out >= this.grid.gens) {
            this.error(pos, `Gneration out of bounds: '${out}' (expected -${this.grid.gens} to ${this.grid.gens - 1})`);
        }
        return out;
    }

    resolveGenerations(pos: HasPos, value: Value, relativeTo: number): number[] {
        if (!(value !== null && typeof value === 'object')) {
            this.error(pos, `Expected value of type 'generation' or 'generation_range', got type '${typeOfValue(value)}'`);
        } else if (value.type === 'generation') {
            return [this._resolveGeneration(pos, value, relativeTo)];
        } else if (value.type === 'generation_range') {
            let start = this._resolveGeneration(pos, value.start, relativeTo);
            let end = this._resolveGeneration(pos, value.end, relativeTo);
            if (value.isInclusive) {
                end++;
            }
            let out: number[] = [];
            for (let i = start; i < end; i++) {
                out.push(i);
            }
            return out;
        } else {
            this.error(pos, `Expected value of type 'generation' or 'generation_range', got type '${value.type}'`);
        }
    }

    rleStatementSetCells(gens: number[], x: number, y: number, value: StateSpecifier, baseT: number): void {
        if (value.kind === 'nop') {
            // do nothing
        } else if (value.kind === 'cell') {
            for (let t of gens) {
                this.grid.set(t, x, y, structuredClone(value.cell));
            }
        } else if (value.kind === 'periodic') {
            let cells: Cell[] = [];
            for (let i = 0; i < value.period; i++) {
                let cell = structuredClone(value.cell);
                cell.variable = this.grid.getNewVar();
                cells.push(cell);
            }
            for (let t of gens) {
                let cell = structuredClone(cells[(t + baseT) % cells.length]);
                this.grid.set(t, x, y, cell);
            }
        } else {
            throw new Error(`This error should not occur, please report it (invalid state specifier)`);
        }
    }

    rleStatement(node: RLEStatement): void {
        // get the pattern corresponding to the RLE
        let rle = node.rle.value;
        let p: IdentityPattern;
        try {
            p = IdentityPattern.loadRLE(rle);
        } catch (error) {
            if (error instanceof LifewebError) {
                this.error(node.rle, error.message);
            } else {
                throw error;
            }
        }
        // expand the pattern by the width and height given in the RLE header
        let header = rle.slice(0, rle.indexOf('\n'));
        let match = header.match(/^x\s*=\s*(\d+)\s*,\s*y\s*=\s*(\d+)/);
        if (!match) {
            throw new Error(`This error should not occur, please report it (bad RLE header)`);
        }
        let width = Math.max(Number(match[1]), p.width);
        let height = Math.max(Number(match[2]), p.height);
        p.expand(0, height - p.height, 0, width - p.width);
        // expand the grid to fit the pattern
        let xOffset = 0;
        let yOffset = 0;
        if (node.offset) {
            xOffset = this.assertType(node.offset.x, this.expression(node.offset.x), 'number', 'RLE X offset');
            yOffset = this.assertType(node.offset.y, this.expression(node.offset.y), 'number', 'RLE Y offset');
        }
        if (xOffset < 0) {
            this.grid.expand({left: -xOffset});
            xOffset = 0;
        }
        if (yOffset < 0) {
            this.grid.expand({top: -xOffset});
            yOffset = 0;
        }
        let maxX = width + xOffset;
        let maxY = height + yOffset;
        if (maxX > this.grid.width) {
            this.grid.expand({right: maxX - this.grid.width});
        }
        if (maxY > this.grid.height) {
            this.grid.expand({bottom: maxY - this.grid.height});
        }
        // copy the states into the pattern
        let baseGens: number[];
        if (node.gens === undefined) {
            baseGens = [0];
        } else {
            baseGens = this.resolveGenerations(node.gens, this.expression(node.gens), 0);
        }
        for (let y = 0; y < p.height; y++) {
            for (let x = 0; x < p.width; x++) {
                let state = p.get(x, y);
                let x2 = x + xOffset;
                let y2 = y + yOffset;
                for (let part of this.scope.getState(node.rle, state).parts) {
                    for (let baseGen of baseGens) {
                        let gens = this.resolveGenerations(node.gens ?? node, part.gens, baseGen);
                        this.rleStatementSetCells(gens, x2, y2, part.value, baseGen);
                    }
                }
            }
        }
    }

    variableDeclarationStatement(node: VariableDeclarationStatement): void {
        let value: Value;
        if (node.value !== undefined) {
            value = this.expression(node.value);
        } else {
            value = null;
        }
        let data: Variable = {mut: node.mut, value};
        this.scope.declareVar(node.name, data);
    }

    statement(node: Statement): void {
        if (node.type === 'expression-statement') {
            this.expression(node.expr);
        } else if (node.type === 'rle-statement') {
            this.rleStatement(node);
        } else if (node.type === 'variable-declaration-statement') {
            this.variableDeclarationStatement(node);
        } else {
            throw new Error(`This error should not occur, please report it (invalid statement)`);
        }
    }

    async program(data: Statement[]): Promise<Grid> {
        for (let node of data) {
            this.statement(node);
        }
        return this.grid;
    }

}


export async function runFile(filePath: string, initialMinRule: string, initialMaxRule: string): Promise<Grid> {
    let fs = await import('node:fs/promises');
    let code = (await fs.readFile(filePath)).toString();
    try {
        let parser = new VLSFileParser(filePath, code);
        let data = await parser.program();
        let runner = new VLSFileRunner(code, initialMinRule, initialMaxRule);
        return await runner.program(data);
    } catch (error) {
        if (IS_BROWSER) {
            throw error;
        } else {
            if (error instanceof VLSFileError) {
                console.error(error.stack + '\n');
                console.error(`Use ./vls -h for help`);
                process.exit(1);
            } else {
                throw error;
            }
        }
    }
}
