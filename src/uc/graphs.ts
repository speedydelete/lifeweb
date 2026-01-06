
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {getRecipes} from './util.js';
import {getSalvoKey} from './slow_salvos.js';


// @ts-ignore
let sourcePath = `${import.meta.dirname}/graphs.c`;
// @ts-ignore
let compiledPath = `${import.meta.dirname}/a.out`;

// @ts-ignore
if ((await fs.stat(codePath)).mtimeMs > (await fs.stat(compiledPath)).mtimeMs) {
    console.log('Changes to graph.c detected, recompiling');
    execSync(`gcc -Wall -Werror -O3 -o ${compiledPath} ${sourcePath}`, {stdio: 'inherit'});
}

// @ts-ignore
let {salvos} = await getRecipes();


async function updateBasicGraphs(): Promise<void> {
    let range = 0;
    let recipeCount = Object.values(salvos.basicRecipes).length;
    let edgeCount = salvos.stillLifes.length;
    while (edgeCount < 100000000) {
        range++;
        edgeCount = salvos.stillLifes.length * (range * 2 + 1)**2 * recipeCount;
    }
    console.log(`New recipes detected, recomputing optimal graph with range ${range} (${edgeCount} edges)`);
    let vertices: string[] = [];
    let reverseVertices: {[key: string]: number} = {};
    let edges: [number, number, number][][] = [];
    let recipeNumbers: number[][] = [];
    let reverseRecipeNumbers: {[key: string]: number} = {};
    for (let sl of salvos.stillLifes) {
        for (let x = -range; x <= range; x++) {
            for (let y = -range; y <= range; y++) {
                let key = sl + ' ' + x + ' ' + y;
                reverseVertices[key] = vertices.length;
                vertices.push(key);
                edges.push([]);
            }
        }
    }
    for (let [input, output, recipes] of Object.values(salvos.basicRecipes)) {
        let recipe = recipes.sort((a, b) => a.length - b.length)[0];
        for (let x = -range; x <= range; x++) {
            let x2 = x + output.x;
            if (x2 < -range || x2 > range) {
                continue;
            }
            for (let y = -range; y <= range; y++) {
                let y2 = y + output.y;
                if (y2 < -range || y2 > range) {
                    continue;
                }
                let start = reverseVertices[input + ' ' + x + ' ' + y];
                let end = reverseVertices[output.code + ' ' + x2 + ' ' + y2];
                let key = recipe.join(' ');
                let recipeNumber: number;
                if (key in reverseRecipeNumbers) {
                    recipeNumber = reverseRecipeNumbers[key];
                } else {
                    recipeNumber = recipeNumbers.length;
                    recipeNumbers.push(recipe);
                    reverseRecipeNumbers[key] = recipeNumber;
                }
                edges[start].push([end, recipe.length, recipeNumber]);
            }
        }
    }
    await fs.writeFile('graph_data', new Uint32Array([edges.length, ...edges.map(x => x.length).flat(), ...edges.flat(2)]));
    execSync(`${compiledPath}`, {stdio: 'inherit'});
    let data = new Uint32Array(await fs.readFile('out'));
    await fs.rm('graph_data');
}


if (salvos.lastChange > salvos.lastGraphUpdate) {
    // @ts-ignore
    await updateBasicGraphs();
    salvos.lastGraphUpdate = Date.now() / 1000;
}
