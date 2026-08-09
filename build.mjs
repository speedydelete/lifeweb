
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {execSync} from 'node:child_process';

import * as esbuild from 'esbuild';
import minify from '@minify-html/node';


let devMode = process.argv.includes('dev');

function path(value) {
    return join(import.meta.dirname, value);
}


async function buildTypescript() {
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


const ESBUILD_OPTIONS = {
    bundle: true,
    format: 'esm',
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

const MINIFY_HTML_OPTIONS = {
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
    if (!exists(path('editor'))) {
        await fs.mkdir(path('editor'));
    }
    let data = (await fs.readFile(path('src/editor/index.html'))).toString();
    let match = data.match(/var BUILD_NUMBER = (\d+);/);
    if (!match) {
        console.error(`Error: No build number in src/editor/index.html!`);
        throw new Error(`No build number!`);
    }
    data = data.replace(match[0], `var BUILD_NUMBER = ${parseInt(match[1]) + 1};`);
    await fs.writeFile(path('src/editor/index.html'), data);
    await fs.writeFile(path('editor/index.html'), await minify.minify(Buffer.from(data, 'utf-8'), MINIFY_HTML_OPTIONS));
    await fs.copyFile(path('src/editor/stdlib.rpf'), path('editor/stdlib.rpf'));
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/editor/index.ts')],
        outfile: path('editor/index.js'),
        treeShaking: false,
    });
}

async function buildIdentify() {
    if (!exists(path('identify'))) {
        await fs.mkdir(path('identify'));
    }
    let data = (await fs.readFile(path('src/identify/website.html'))).toString();
    await fs.writeFile(path('identify/index.html'), await minify.minify(Buffer.from(data, 'utf-8'), MINIFY_HTML_OPTIONS));
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/identify/website.ts')],
        outfile: path('identify/index.js'),
        treeShaking: false,
    });
}

async function buildRuleSymmetries() {
    let html = (await fs.readFile(path('src/rule_symmetries/website.html'))).toString();
    await esbuild.build({
        ...ESBUILD_OPTIONS,
        entryPoints: [path('src/rule_symmetries/website.ts')],
        outfile: path('.temp.js'),
        treeShaking: false,
    });
    let buildResult = (await fs.readFile(path('.temp.js'))).toString();
    html = html.replace('<script type="module" src="website.ts"></script>', () => `<script type="module">${buildResult}</script>`);
    await fs.writeFile(path('rule_symmetries.html'), await minify.minify(Buffer.from(html, 'utf-8'), {...MINIFY_HTML_OPTIONS, minify_js: false}));
}

if (!process.argv.includes('no-ts')) {
    buildTypescript();
}

buildLifewebJS();
buildEditor();
buildIdentify();
buildRuleSymmetries();
