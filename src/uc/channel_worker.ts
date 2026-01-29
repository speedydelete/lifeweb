
import {parentPort, workerData} from 'node:worker_threads';
import {RecipeData} from './base.js';
import {findChannelResults} from './channel_searcher.js';


if (!parentPort) {
    throw new Error('No parent port!');
}

let out: RecipeData['channels'][string] = {moveRecipes: [], recipes90Deg: [], recipes0Deg: [], createHandRecipes: []};

let data = findChannelResults(workerData.info, workerData.recipes, out, parentPort);

parentPort.postMessage([out, data[0], data[1]]);
