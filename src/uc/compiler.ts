
import * as fs from 'node:fs/promises';
import {execSync} from 'node:child_process';
import {StillLife, loadRecipes, translateObjects, objectsToString} from './base.js';


// let sourcePath = `${import.meta.dirname}/dijkstra.c`;
// let compiledPath = `${import.meta.dirname}/dijkstra`;

// let data = await loadRecipes();
// let salvos = data.salvos;

// export async function updateTiles(size: number): Promise<void> {
//     if ((await fs.stat(sourcePath)).mtimeMs > (await fs.stat(compiledPath)).mtimeMs) {
//         console.log('Changes to dijkstra.c detected, recompiling');
//         execSync(`gcc -Wall -Werror -O3 -flto -o ${compiledPath} ${sourcePath}`, {stdio: 'inherit'});
//     }
//     let vertices: StillLife[][] = [];
//     let reverseVertices: {[key: string]: number} = {};
//     let edges: [number, number, number][][] = [];
//     let recipeNumbers: number[][] = [];
//     let reverseRecipeNumbers: {[key: string]: number} = {};
//     for (let [input, output, recipe] of Object.values(salvos.tileRecipes)) {
//         let minX = Math.min(...input.map(x => x.x), ...output.map(x => x.x));
//         let maxX = Math.min(...input.map(x => x.x + x.width), ...output.map(x => x.x + x.width));
//         let minY = Math.min(...input.map(x => x.y), ...output.map(x => x.y));
//         let maxY = Math.min(...input.map(x => x.y + x.height), ...output.map(x => x.y + x.height));
//         for (let x = 0; x < size; x++) {
//             if (x + minX < 0 || x + maxX >= size) {
//                 continue;
//             }
//             for (let y = 0; y < size; y++) {
//                 if (y + minY < 0 || y + maxY >= size) {
//                     continue;
//                 }
//                 let input2 = translateObjects(input, x, y);
//                 let output2 = translateObjects(output, x, y);
//                 let inputKey = objectsToString(input2);
//                 let outputKey = objectsToString(output2);
//                 if (!inputKey || !outputKey) {
//                     throw new Error('Invalid objects!');
//                 }
//                 let inputVertex: number;
//                 if (inputKey in reverseVertices) {
//                     inputVertex = reverseVertices[inputKey];
//                 } else {
//                     inputVertex = vertices.length;
//                     reverseVertices[inputKey] = vertices.length;
//                     vertices.push(input2);
//                 }
//                 let outputVertex: number;
//                 if (outputKey in reverseVertices) {
//                     outputVertex = reverseVertices[inputKey];
//                 } else {
//                     outputVertex = vertices.length;
//                     reverseVertices[outputKey] = vertices.length;
//                     vertices.push(output2);
//                 }
//                 let recipeKey = recipe.join(' ');
//                 let recipeNumber: number;
//                 if (recipeKey in reverseRecipeNumbers) {
//                     recipeNumber = reverseRecipeNumbers[recipeKey];
//                 } else {
//                     recipeNumber = recipeNumbers.length;
//                     recipeNumbers.push(recipe);
//                     reverseRecipeNumbers[recipeKey] = recipeNumber;
//                 }
//                 edges[inputVertex].push([outputVertex, recipe.length, recipeNumber]);
//             }
//         }
//     }
//     await fs.writeFile('graph', new Uint32Array([edges.length, ...edges.map(x => x.length).flat(), ...edges.flat(2)]));
//     execSync(`${compiledPath}`, {stdio: 'inherit'});
//     let data = new Uint32Array(await fs.readFile('out'));
//     await fs.rm('graph');
//     await fs.rm('out');
//     // insert code to parse the data here
// }


// function findBestPaths(objs: StillLife[]): something {

// }
