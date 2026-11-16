
import {isAbsolute, join} from 'node:path';
import * as fs from 'node:fs';
import {execSync} from 'node:child_process';

import * as esbuild from 'esbuild';
import minifyLibrary from '@minify-html/node';
let minifyHTML = minifyLibrary.minify;


let devMode = process.argv.includes('dev');

const BASE_PATH = join(import.meta.dirname, '..');

function path(value: string): string {
    return isAbsolute(value) ? value : join(BASE_PATH, value);
}

function exists(file: string): boolean {
    return fs.existsSync(path(file));
}

async function read(file: string): Promise<string> {
    return (await fs.promises.readFile(path(file))).toString('utf-8');
}

async function write(file: string, data: Parameters<(typeof fs)['promises']['writeFile']>[1]): Promise<void> {
    await fs.promises.writeFile(path(file), data);
}

async function copy(from: string, to: string): Promise<void> {
    await fs.promises.copyFile(path(from), path(to));
}

async function mkdir(file: string): Promise<void> {
    await fs.promises.mkdir(path(file));
}


async function updateVersionNumber(): Promise<void> {
    let data = await read('src/version.ts');
    let match = data.match(/\d+/);
    if (!match) {
        throw new Error(`No build number in src/version.ts!`);
    }
    await write('src/version.ts', `\nexport const LIFEWEB_VERSION = ${parseInt(match[0]) + 1};\n`);
}


async function buildTypescript(): Promise<void> {
    try {
        execSync(`${path('node_modules/.bin/tsc')} -b`, {stdio: 'inherit'});
    } catch (error) {
        if (error instanceof Error && error.message.startsWith('Command failed:')) {
            return;
        } else {
            throw error;
        }
    }
}


const ESBUILD_OPTIONS: esbuild.BuildOptions = {
    bundle: true,
    format: 'esm',
    // no idea where this comes from
    // it maybe should be (according to caniuse.com saved features)
    // target: ['chrome84', 'edge84', 'safari14.1', 'firefox68', 'opera70'],
    target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
    sourcemap: devMode ? 'inline' : false,
    keepNames: devMode,
    external: ['node:path'],
    treeShaking: true,
    minifyIdentifiers: !devMode,
    minifyWhitespace: true,
    minifySyntax: true,
    loader: {
        '.rpf': 'text',
    },
    plugins: [
        {
            name: 'lifeweb-core-alias',
            setup(build) {
                build.onResolve({filter: /\/core\/index\.js$/}, () => ({path: '../lifeweb.js', external: true}));
            },
        },
    ],
};

const MINIFY_HTML_OPTIONS: Parameters<typeof minifyHTML>[1] = {
    keep_html_and_head_opening_tags: true,
    minify_css: true,
    minify_js: true,
};

async function buildLifewebJS() {
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/index.ts')],
        outfile: path('lifeweb.js'),
        plugins: [],
    });
}

async function buildEditor() {
    if (!exists('editor')) {
        await mkdir('editor');
    }
    await write('editor/index.html', minifyHTML(Buffer.from(await read('src/editor/index.html'), 'utf-8'), MINIFY_HTML_OPTIONS).toString('utf-8'));
    await copy('src/editor/stdlib.rpf', 'editor/stdlib.rpf');
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/editor/index.ts')],
        outfile: path('editor/index.js'),
        treeShaking: false,
    });
}

async function buildIdentify() {
    if (!exists('identify')) {
        await mkdir('identify');
    }
    await write('identify/index.html', minifyHTML(Buffer.from(await read('src/identify/website.html'), 'utf-8'), MINIFY_HTML_OPTIONS));
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/identify/website.ts')],
        outfile: path('identify/index.js'),
    });
}

async function buildRuleSymmetries() {
    let html = await read('src/rule_symmetries/website.html');
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/rule_symmetries/website.ts')],
        outfile: path('.temp.js'),
    });
    let buildResult = await read('.temp.js');
    html = html.replace('<script type="module" src="website.ts"></script>', () => `<script type="module">${buildResult}</script>`);
    await write('rule_symmetries.html', minifyHTML(Buffer.from(html, 'utf-8'), {...MINIFY_HTML_OPTIONS, minify_js: false}));
}


await updateVersionNumber();

if (!process.argv.includes('no-ts')) {
    buildTypescript();
}

buildLifewebJS();
buildEditor();
buildIdentify();
buildRuleSymmetries();
