
document.querySelectorAll('[data-title]').forEach(elt => {
    elt.addEventListener('mouseenter', () => {
        let rect = elt.getBoundingClientRect();
        if (rect.bottom > window.innerHeight/2) {
            elt.classList.add('tooltip-top');
        } else {
            elt.classList.remove('tooltip-top');
        }
    });
});
