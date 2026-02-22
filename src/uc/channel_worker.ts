
import {MessagePort, parentPort, workerData} from 'node:worker_threads';
import {ChannelInfo, setMaxGenerations} from './base.js';
import {findChannelResults} from './channel_searcher.js';


let info: ChannelInfo = workerData.info;

setMaxGenerations(workerData.maxGenerations);

let starts: [number, number][][] = workerData.starts;

(parentPort as MessagePort).on('message', data => {
    (parentPort as MessagePort).postMessage(['completed', findChannelResults(info, data.elbows, data.badElbows, data.elbow, data.depth, data.maxSpacing, starts, parentPort)]);
});
