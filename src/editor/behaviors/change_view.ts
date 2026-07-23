
// import {addHook} from '../base.js';


// declare global {

//     var mouseX: number;
//     var mouseY: number;

//     var scale: number;
//     var scaleStrength: number;

//     var topLeftX: number;
//     var topLeftY: number;

//     var pixelHeight: number;
//     var pixelWidth: number;

//     var isDragging: boolean;
//     var dragStart: [number, number];
//     var dragOffsetStart: [number, number];
//     var dragSelectStart: [number, number];

// }


// export function updateSizes() {
//     let bb = canvas.getBoundingClientRect();
//     canvas.height = Math.min(bb.bottom, window.innerHeight) - bb.top;
//     canvas.width = Math.min(bb.right, window.innerWidth) - bb.left;
//     ctx.imageSmoothingEnabled = false;
//     pixelHeight = canvas.height / scale;
//     pixelWidth = canvas.width / scale;
// }

// window.addEventListener('resize', updateSizes);

// addHook('set-scale', () => {
//     let value = prompt('Enter scale:');
//     if (!value) {
//         return;
//     }
//     scale = Number(value);
//     updateSizes();
// });


// let wheelEvent: WheelEvent | undefined = undefined;
// let totalDeltaY = 0;

// addHook('scroll-canvas', event => {
//     if (!(event instanceof WheelEvent)) {
//         throw new Error(`scroll called with non-MouseEvent value`);
//     }
//     event.preventDefault();
//     totalDeltaY += event.deltaY;
//     wheelEvent = event;
// });

// let scaleElt = getElement('scale');

// addHook('frame', () => {
//     if (wheelEvent && Math.abs(totalDeltaY) > 50) {
//         let rect = canvas.getBoundingClientRect();
//         let mouseX = wheelEvent.clientX - rect.left;
//         let mouseY = wheelEvent.clientY - rect.top;
//         let scaleAmount = totalDeltaY < 0 ? (1 + scaleStrength) : (1 - scaleStrength);
//         let newScale = Math.min(64, scale * scaleAmount);
//         let x = (mouseX - topLeftX * scale) / scale;
//         let y = (mouseY - topLeftY * scale) / scale;
//         topLeftX = (mouseX - x * newScale) / newScale;
//         topLeftY = (mouseY - y * newScale) / newScale;
//         scale = newScale;
//         pixelHeight = canvas.height / scale;
//         pixelWidth = canvas.width / scale;
//         totalDeltaY = 0;
//         wheelEvent = undefined;
//     }
//     if (scale < 0.5) {
//         if (scale < 0.00001) {
//             scaleElt.textContent = scale.toExponential();
//         } else if (scale < 0.0001) {
//             scaleElt.textContent = scale.toFixed(5);
//         } else if (scale < 0.01) {
//             scaleElt.textContent = scale.toFixed(4);
//         } else if (scale < 0.1) {
//             scaleElt.textContent = scale.toFixed(3);
//         } else {
//             scaleElt.textContent = scale.toFixed(2);
//         }
//     } else if (scale < 10**10) {
//         scaleElt.textContent = scale.toFixed(1);
//     } else {
//         scaleElt.textContent = scale.toExponential();
//     }
// });


// addHook('click-canvas', event => {
//     if (!(event instanceof MouseEvent)) {
//         throw new Error(`click-canvas called with non-MouseEvent value`);
//     }
//     if (event.buttons !== 1) {
//         return;
//     }
//     isDragging = true;
//     dragStart = [event.clientX, event.clientY];
//     dragOffsetStart = [topLeftX, topLeftY];
// });

// let xElt = getElement('x');
// let yElt = getElement('y');
// let stateElt = getElement('state');

// addHook('move-mouse-over-canvas', event => {
//     if (!(event instanceof MouseEvent)) {
//         throw new Error(`move-mouse-over-canvas called with non-MouseEvent value`);
//     }
//     let rect = canvas.getBoundingClientRect();
//     mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
//     mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
//     xElt.textContent = String(mouseX);
//     yElt.textContent = String(mouseY);
//     stateElt.textContent = String(p.get(mouseX - p.xOffset, mouseY - p.yOffset));
// });

// addHook('unclick-canvas', () => {
//     isDragging = false;
// });


// let posElt = getElement('position');

// addHook('move-mouse-onto-canvas', event => {
//     if (!(event instanceof MouseEvent)) {
//         throw new Error(`move-mouse-onto-canvas called with non-MouseEvent value`);
//     }
//     let rect = canvas.getBoundingClientRect();
//     mouseX = Math.floor((event.clientX - rect.left - topLeftX * scale) / scale);
//     mouseY = Math.floor((event.clientY - rect.top - topLeftY * scale) / scale);
//     posElt.style.display = 'flex';
// });

// addHook('move-mouse-off-of-canvas', () => {
//     isDragging = false;
//     posElt.style.display = 'none';
// });
