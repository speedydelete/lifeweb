
import * as esbuild from 'esbuild';

const TARGETS = {
    'main': ['src/index.ts', 'lifeweb.js'],
    'editor': ['src/editor.ts', 'editor/index.js'],
};

let target = process.argv[2];
let [entry, out] = TARGETS[target];

esbuild.build({
    entryPoints: [entry],
    bundle: true,
    outfile: out,
    minify: true,
    sourcemap: true,
    format: 'esm',
});
