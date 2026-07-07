
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import {existsSync as exists} from 'node:fs';
import {execSync} from 'node:child_process';
import * as esbuild from 'esbuild';
import minify from '@minify-html/node';


function path(value) {
    return join(import.meta.dirname, value);
}


async function buildTypescript() {
    execSync(`${path('node_modules/.bin/tsc')} -b`);
}


async function buildLifewebJS() {
    await esbuild.build({
        entryPoints: [path('src/index.ts')],
        bundle: true,
        outfile: path('lifeweb.js'),
        format: 'esm',
        sourcemap: true,
        target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
        external: ['node:path'],
        treeShaking: true,
        minify: true,
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
    await fs.writeFile(path('editor/index.html'), await minify.minify(Buffer.from(data, 'utf-8'), {
        keep_html_and_head_opening_tags: true,
        minify_css: true,
        minify_js: true,
    }));
    await fs.copyFile(path('src/editor/stdlib.rpf'), path('editor/stdlib.rpf'));
    await esbuild.build({
        entryPoints: [path('src/editor/index.ts')],
        bundle: true,
        outfile: path('editor/index.js'),
        format: 'esm',
        sourcemap: true,
        target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
        external: ['node:path'],
        treeShaking: false,
        minify: true,
        loader: {
            '.rpf': 'text',
        },
        plugins: [
            {
                name: 'lifeweb-core-alias',
                setup(build) {
                    build.onResolve({filter: /\/core\/index\.js$/}, () => ({path: '../lifeweb.js', external: true}));
                }
            }
        ]
    });
}

async function buildIdentify() {
    if (!exists(path('identify'))) {
        await fs.mkdir(path('identify'));
    }
    let data = (await fs.readFile(path('src/identify/website.html'))).toString();
    await fs.writeFile(path('identify/index.html'), await minify.minify(Buffer.from(data, 'utf-8'), {
        keep_html_and_head_opening_tags: true,
        minify_css: true,
        minify_js: true,
    }));
    await esbuild.build({
        entryPoints: [path('src/identify/website.ts')],
        bundle: true,
        outfile: path('identify/index.js'),
        format: 'esm',
        sourcemap: true,
        target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
        external: ['node:path'],
        treeShaking: false,
        minify: true,
        loader: {
            '.rpf': 'text',
        },
        plugins: [
            {
                name: 'lifeweb-core-alias',
                setup(build) {
                    build.onResolve({filter: /\/core\/index\.js$/}, () => ({path: '../lifeweb.js', external: true}));
                }
            }
        ]
    });
}

buildTypescript();
buildLifewebJS();
buildEditor();
buildIdentify();
