
import {parentPort, workerData} from 'node:worker_threads';
import {RecipeData} from './base.js';
import {findChannelResults} from './channel_searcher.js';


if (!parentPort) {
    throw new Error('No parent port!');
}

let data = findChannelResults(workerData.info, workerData.recipes, parentPort);

parentPort.postMessage(data);
