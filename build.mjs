
import {join} from 'node:path';
import * as fs from 'node:fs/promises';
import * as esbuild from 'esbuild';
import minify from '@minify-html/node';


function path(value) {
    return join(import.meta.dirname, value);
}


async function buildMain() {
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
    buildMain();
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
    await fs.writeFile(path('editor/stdlib.rpf'), await fs.readFile('src/stdlib.rpf'));
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

// const TARGETS = {
//     main: buildMain,
//     editor: buildEditor,
// };


// let target = process.argv[2];
// if (!(target in TARGETS)) {
//     console.error(`Error: Invalid target: '${target}' (valid: ${Object.keys(targets).join(', ')})`);
//     process.exit(1);
// }
// TARGETS[target]();

buildEditor();
