
// import {RPFPattern} from '../rpf.js';
// import {run, addHook, pushUndo, parse} from '../base.js';


// addHook('cut', async () => {
//     await run('copy');
//     await run('sel-clear');
// });

// addHook('copy', () => {
//     if (sel.size === 0) {
//         navigator.clipboard.writeText(rpfFile.toString());
//     } else if (sel.size === 1) {
//         navigator.clipboard.writeText(Array.from(sel)[0].p.toString());
//     } else {
//         let q = p.clearedCopy();
//         q.key = '__copy__';
//         q.data = new Set();
//         for (let value of sel) {
//             q.data.add(value.copy(q));
//         }
//         q.recomputeSizes();
//         q.offsetBy(-q.minX, -q.minY);
//         navigator.clipboard.writeText(q.toString());
//     }
// });


// addHook('start-paste', async event => {
//     if (event) {
//         event.preventDefault();
//     }
//     let text = await navigator.clipboard.readText();
//     let q = parse(text, true);
//     if (Array.isArray(q)) {
//         alert(`Invalid pattern:\n\n${q[0]}\n\n${q[1]}\n\n${q[2]}`);
//         return;
//     }
//     if (!(q instanceof RPFPattern)) {
//         if (!rpfFile) {
//             alert(`No rpfFile when running RPF start-paste!`);
//             return;
//         }
//         q = p.fromPattern(q);
//     }
//     if (!(q instanceof RPFPattern)) {
//         throw new Error(`This error should not occur (please check devtools and report the traceback)`);
//     }
//     if (q.key === 'main') {
//         q.key = '__copy__';
//     }
//     q.offsetBy(-q.minX, -q.minY);
//     alert(q.width + ' ' + q.height);
//     pasting = [q, 'F'];
//     run('set-cursor-to-main');
// });

// addHook('end-paste', () => {
//     if (!pasting) {
//         return;
//     }
//     pushUndo();
//     let q = pasting[0];
//     let toAddTo = p;
//     if (sel.size === 1) {
//         let r = Array.from(sel)[0].p;
//         if (r instanceof RPFPattern) {
//             toAddTo = r;
//         }
//     }
//     if (q.key === '__copy__') {
//         for (let ref of q.data) {
//             ref.x += mouseX;
//             ref.y += mouseY;
//             toAddTo.add(ref);
//         }
//     } else {
//         toAddTo.add(toAddTo.createRef(q, mouseX, mouseY, pasting[1]));
//     }
//     pasting = undefined;
// });

// addHook('exit-paste', () => {
//     pasting = undefined;
// });


// addHook('set-paste-mode-to-or', () => {
//     pasteMode = 'or';
// });

// addHook('set-paste-mode-to-copy', () => {
//     pasteMode = 'copy';
// });

// addHook('set-paste-mode-to-and', () => {
//     pasteMode = 'and';
// });

// addHook('set-paste-mode-to-xor', () => {
//     pasteMode = 'xor';
// });

// let pasteOrButton = getElement('paste-or');
// let pasteCopyButton = getElement('paste-copy');
// let pasteAndButton = getElement('paste-and');
// let pasteXorButton = getElement('paste-xor');

// addHook('frame', () => {
//     pasteOrButton.className = pasteMode === 'or' ? 'selected' : '';
//     pasteCopyButton.className = pasteMode === 'copy' ? 'selected' : '';
//     pasteAndButton.className = pasteMode === 'and' ? 'selected' : '';
//     pasteXorButton.className = pasteMode === 'xor' ? 'selected' : '';
// });

// addHook('load-pattern', () => {
//     pasting = undefined;
// });
