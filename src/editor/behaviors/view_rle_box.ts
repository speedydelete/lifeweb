
import {addHook, loadPattern} from '../base.js';


let rleElt = getElement('rle', 'textarea');

addHook('view-rle', () => {
    loadPattern(rleElt.value);
});
