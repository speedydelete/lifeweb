
import {addHook} from '../base.js';


let helpElt = getElement('help');

addHook('show-help', () => {
    helpElt.style.display = 'block';
});

addHook('hide-help', () => {
    helpElt.style.display = 'none';
});
