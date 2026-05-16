
import * as fs from 'node:fs';
import * as esbuild from 'esbuild';

const TARGETS = {

    'main': ['src/index.ts', 'lifeweb.js'],

    'editor': ['src/editor.ts', 'editor/index.js', () => {
        let data = fs.readFileSync('src/editor.html').toString();
        let match = data.match(/var BUILD_NUMBER=(\d+);/);
        if (!match) {
            throw new Error(`No build number!`);
        }
        data = data.replace(match[0], `var BUILD_NUMBER=${parseInt(match[1]) + 1};`);
        fs.writeFileSync('src/editor.html', data);
        fs.writeFileSync('editor/index.html', data);
        fs.writeFileSync('editor/stdlib.rpf', fs.readFileSync('src/stdlib.rpf'));
    }],

};

let target = process.argv[2];
let [entry, out, func] = TARGETS[target];

if (func) {
    func();
}

esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: out,
    minifyWhitespace: true,
    minifySyntax: true,
    sourcemap: true,
    format: 'esm',
    target: ['chrome85', 'edge85', 'safari14.1', 'firefox77', 'opera71'],
    external: ['node:path'],
    treeShaking: false,
});
