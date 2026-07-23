
declare let showDirectoryPicker: (options?: {id?: string, mode?: 'read' | 'readwrite', startIn?: string | FileSystemFileHandle}) => Promise<FileSystemDirectoryHandle>;
// import {showDirectoryPicker} from 'file-system-access';
import {RPFError, RPFPattern, Directory, File, RPFFile} from '../rpf.js';
import {run, addHook, loadPattern} from '../base.js';


declare global {

    var currentFile: string;
    var extensions: {[key: string]: (name: string, file: File) => void};

}


canvas.addEventListener('dragover', event => {
    event.preventDefault();
});


let fsFolderTemplate = getElement('fs-folder-template', 'template').content;

export class FSFolderElement extends HTMLElement {

    static observedAttributes = ['name', 'open'];

    file: Directory;

    _iconOpenElt: HTMLElement;
    _iconClosedElt: HTMLElement;
    _nameElt: HTMLElement;
    _mainElt: HTMLElement;

    constructor(file: Directory, name: string, showLeftBar: boolean = true) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFolderTemplate, true));
        this._iconOpenElt = root.getElementById('icon-open') as HTMLElement;
        this._iconClosedElt = root.getElementById('icon-closed') as HTMLElement;
        this._nameElt = root.getElementById('name') as HTMLElement;
        this._mainElt = root.getElementById('main') as HTMLElement;
        (root.getElementById('top') as HTMLElement).addEventListener('click', () => {
            this.open = !this.open;
        });
        if (this.getAttribute('open') !== null) {
            this._iconOpenElt.style.display = 'block';
            this._iconClosedElt.style.display = 'none';
            this._mainElt.style.display = 'flex';
        }
        this.setAttribute('name', name);
        if (!showLeftBar) {
            (root.getElementById('left-bar') as HTMLElement).style.display = 'none';
        }
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        } else if (name === 'open') {
            if (newValue !== null) {
                this._iconOpenElt.style.display = 'block';
                this._iconClosedElt.style.display = 'none';
                this._mainElt.style.display = 'flex';
            } else {
                this._iconOpenElt.style.display = 'none';
                this._iconClosedElt.style.display = 'block';
                this._mainElt.style.display = 'none';
            }
        }
    }

    get open(): boolean {
        return this.getAttribute('open') !== null;
    }

    set open(value: boolean) {
        if (value) {
            this.setAttribute('open', 'open');
        } else {
            this.removeAttribute('open');
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

}

customElements.define('fs-folder', FSFolderElement);


let fsFileTemplate = getElement('fs-file-template', 'template').content;

export class FSFileElement extends HTMLElement {

    static observedAttributes = ['name'];

    file: File;

    _nameElt: HTMLElement;

    constructor(file: File, name: string) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFileTemplate, true));
        this._nameElt = root.getElementById('name') as HTMLElement;
        this.addEventListener('dblclick', () => {
            run('open-file', new CustomEvent('open-file', {detail: {name: this.name, file: this.file}}));
        });
        this.setAttribute('name', name);
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

}

customElements.define('fs-file', FSFileElement);


export class FSRPFItemElement extends HTMLElement {

    file: RPFFile;
    p: RPFPattern;

    constructor(file: RPFFile, p: RPFPattern) {
        super();
        this.file = file;
        this.p = p;
        let name = p.getName() ?? '[unnamed]';
        let root = this.attachShadow({mode: 'open'});
        let nameElt = document.createElement('span');
        nameElt.textContent = name;
        root.appendChild(nameElt);
        this.draggable = true;
        this.addEventListener('dragstart', event => {
            let transfer = event.dataTransfer as DataTransfer;
            transfer.dropEffect = 'link';
            transfer.setData('application/x-lifeweb-editor-drag', file.path + '\n' + p.key);
            let parent = this.parentElement as HTMLElement;
            let old = parent.style.overflowY;
            parent.style.overflowY = 'visible';
            let rect = nameElt.getBoundingClientRect();
            transfer.setDragImage(nameElt, rect.width / 2, rect.height / 2);
            requestAnimationFrame(() => {
                parent.style.overflowY = old;
            });
        });
    }

}

customElements.define('fs-rpf-item', FSRPFItemElement);


export class FSRPFFileElement extends HTMLElement {

    static observedAttributes = ['name', 'open'];

    file: File & {rpf: RPFFile};

    _iconOpenElt: HTMLElement;
    _iconClosedElt: HTMLElement;
    _nameElt: HTMLElement;
    _mainElt: HTMLElement;

    constructor(file: File & {rpf: RPFFile}, name: string) {
        super();
        this.file = file;
        let root = this.attachShadow({mode: 'open'});
        root.appendChild(document.importNode(fsFolderTemplate, true));
        this._iconOpenElt = root.getElementById('icon-open') as HTMLElement;
        this._iconClosedElt = root.getElementById('icon-closed') as HTMLElement;
        this._nameElt = root.getElementById('name') as HTMLElement;
        this._mainElt = root.getElementById('main') as HTMLElement;
        this._mainElt.style.maxHeight = '200px';
        this._mainElt.style.overflowY = 'auto';
        let topElt = root.getElementById('top') as HTMLElement;
        topElt.addEventListener('click', () => {
            this.open = !this.open;
        });
        (root.getElementById('left-bar') as HTMLElement).style.display = 'none';
        if (this.getAttribute('open') !== null) {
            this._iconOpenElt.style.display = 'block';
            this._iconClosedElt.style.display = 'none';
            this._mainElt.style.display = 'flex';
        }
        this.setAttribute('name', name);
        this.updateContents();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (name === 'name') {
            this._nameElt.textContent = newValue;
        } else if (name === 'open') {
            if (newValue !== null) {
                this._iconOpenElt.style.display = 'block';
                this._iconClosedElt.style.display = 'none';
                this._mainElt.style.display = 'flex';
            } else {
                this._iconOpenElt.style.display = 'none';
                this._iconClosedElt.style.display = 'block';
                this._mainElt.style.display = 'none';
            }
        }
    }

    get open(): boolean {
        return this.getAttribute('open') !== null;
    }

    set open(value: boolean) {
        if (value) {
            this.setAttribute('open', 'open');
        } else {
            this.removeAttribute('open');
        }
    }

    get name(): string {
        return this.getAttribute('name') ?? '';
    }

    set name(value: string) {
        this.setAttribute('name', value);
    }

    updateContents(): void {
        let rpf = this.file.rpf;
        let out: HTMLElement[] = [];
        for (let value of Object.values(rpf.data)) {
            out.push(new FSRPFItemElement(this.file.rpf, value));
        }
        this.replaceChildren(...out);
    }

}

customElements.define('fs-rpf-file', FSRPFFileElement);


addHook('canvas-drop', event => {
    if (!(event instanceof DragEvent)) {
        throw new Error(`canvas-drop called with non-DragEvent value`);
    }
    if (!(event.dataTransfer)) {
        throw new Error(`canvas-drop called with no data transfer`);
    }
    let [path, key] = event.dataTransfer.getData('application/x-lifeweb-editor-drag').split('\n');
    let file = fs.read(path);
    if (!(file instanceof File) || !file.rpf) {
        throw new Error(`This error should not occur (please check devtools and report the traceback)`);
    }
    let rpf = file.rpf;
    if (!(file.name in rpfFile.imports)) {
        rpfFile.imports[file.name] = rpf;
    }
    if (file.name === '/stdlib.rpf' && !rpfFile.starImports.includes(stdlib)) {
        rpfFile.starImports.push(stdlib);
    }
    pasting = [rpf.data[key], 'F'];
    run('set-cursor-to-main');
});


export function loadFile(name: string, file: File): void {
    if (file.rpf) {
        loadPattern(file.rpf);
    } else {
        loadPattern(file.value);
        if (p instanceof RPFFile) {
            file.rpf = rpfFile;
        }
    }
    currentFile = file;
}

export function runFile(name: string, file: File): void {
    try {
        (new Function(`(async()=>{${file.value})()`))();
    } catch (error) {
        let msg: string;
        // @ts-ignore
        if (typeof globalThis.formatError === 'function') {
            // @ts-ignore
            msg = globalThis.formatError(error);
        } else {
            msg = String(error);
        }
        alert(msg);
    }
}

extensions['.rle'] = loadFile;
extensions['.rpf'] = loadFile;

extensions['.js'] = runFile;
extensions['.mjs'] = runFile;
extensions['.cjs'] = runFile;

addHook('save', event => {
    if (event) {
        event.preventDefault();
    }
    if (currentFile !== undefined) {
        currentFile.write(rpfFile);
        currentFile.sync();
    }
});


addHook('download-rle', () => {
    let link = document.createElement('a');
    link.download = currentFile ? path.basename(currentFile.name) + '.rle' : 'pattern.rle';
    link.href = URL.createObjectURL(new Blob([p.toRLE()]));
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});



let searchWrapperElt = getElement('search-wrapper');
let fsWrapperElt = getElement('file-system');

async function updateFileSystem(dir: FileSystemDirectoryHandle, toAddTo: Directory): Promise<void> {
    let out: Directory;
    let value = toAddTo.data[dir.name];
    if (value) {
        if (value instanceof Directory) {
            out = value;
        } else {
            toAddTo.rm(dir.name);
            out = toAddTo.mkdir(dir.name);
        }
    } else {
        out = toAddTo.mkdir(dir.name);
    }
    let names = new Set(Object.keys(out.data));
    for await (let [name, value] of dir.entries()) {
        names.delete(name);
        if (value.kind === 'directory') {
            if (name in out.data && !(out.data[name] instanceof Directory)) {
                out.rm(name);
            }
            await updateFileSystem(value, out);
            out.data[name].handle = value;
        } else {
            let fileBlob = await value.getFile();
            if (name in out.data) {
                if (out.data[name] instanceof Directory) {
                    out.rm(name);
                } else if (fileBlob.lastModified < out.data[name].lastModified) {
                    continue;
                }
            }
            out.write(name, await fileBlob.text());
            let file = out.data[name] as File;
            file.handle = value;
            if (fileBlob.name.endsWith('.rpf')) {
                try {
                    file.getRPF();
                } catch (error) {
                    if (error instanceof RPFError) {
                        continue;
                    } else {
                        throw error;
                    }
                }
            }
        }
    }
    for (let name of names) {
        out.rm(name);
    }
}

function renderFileSystem(dir: Directory, elt: HTMLElement | FSFolderElement, depth: number = 0): void {
    let sorted = Object.entries(dir.data).sort((a, b) => {
        if (a[1] instanceof Directory) {
            if (b[1] instanceof Directory) {
                return a[0] < b[0] ? -1 : 1;
            } else {
                return -1;
            }
        } else {
            if (b[1] instanceof Directory) {
                return 1;
            } else {
                return a[0] < b[0] ? -1 : 1;
            }
        }
    }).map(x => x[0]);
    let newChildren: (HTMLElement | undefined)[] = [];
    for (let i = 0; i < sorted.length; i++) {
        newChildren.push(undefined);
    }
    for (let value of Array.from(elt.children).filter(x => x instanceof FSFolderElement || x instanceof FSFileElement || x instanceof FSRPFFileElement)) {
        if (value.name in dir.data) {
            let file = dir.data[value.name];
            if (file instanceof Directory) {
                if (value instanceof FSFileElement || value instanceof FSRPFFileElement) {
                    value = new FSFolderElement(file, value.name, depth > 0);
                }
                renderFileSystem(file, value, depth + 1);
            } else if (value instanceof FSRPFFileElement) {
                value.updateContents();
            } else {
                if (value instanceof FSFolderElement || value instanceof FSRPFFileElement) {
                    value = new FSFileElement(file, value.name);
                }
            }
        }
        newChildren[sorted.indexOf(value.name)] = value;
    }
    elt.replaceChildren(...newChildren.map((value, i) => {
        if (value === undefined) {
            let name = sorted[i];
            let file = dir.data[name];
            let out: FSFileElement | FSFolderElement | FSRPFFileElement;
            if (file instanceof Directory) {
                out = new FSFolderElement(file, name, depth > 0);
                // alert(name + ': ' + Object.keys(file.data).join(', '));
                renderFileSystem(file, out, depth + 1);
            } else if (file.rpf) {
                let newFile = new FSRPFFileElement(file as File & {rpf: RPFFile}, name);
                out = newFile;
            } else {
                out = new FSFileElement(file, name);
            }
            out.name = name;
            return out;
        } else {
            return value;
        }
    }));
}

addHook('render-file-system', () => {
    renderFileSystem(fs, fsWrapperElt);
});

addHook('window-visibilitychange', async () => {
    if (document.visibilityState === 'visible' && rootDirHandle) {
        await updateFileSystem(rootDirHandle, fs);
        await run('render-file-system');
    }
});


addHook('open-file', event => {
    if (!(event instanceof CustomEvent)) {
        throw new Error(`command-keypress called with non-CustomEvent value`);
    }
    let {name, file}: {name: string, file: File} = event.detail;
    for (let key in extensions) {
        if (name.endsWith(key)) {
            extensions[key](name, file);
            return;
        }
    }
    alert('No file handlers found');
});


addHook('open-folder', async () => {
    let dir: FileSystemDirectoryHandle;
    try {
        dir = await showDirectoryPicker({id: 'lifeweb-editor-rpf-open', mode: 'readwrite'} as Parameters<typeof showDirectoryPicker>[0]);
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
            return;
        } else {
            throw error;
        }
    }
    rootDirHandle = dir;
    await updateFileSystem(dir, fs);
    getElement('open-folder').style.display = 'none';
    getElement('file-system').style.display = 'flex';
    getElement('rle-wrapper').style.display = 'none';
    await run('render-file-system');
    for (let elt of Array.from(fsWrapperElt.children)) {
        if (elt instanceof FSFolderElement) {
            elt.open = true;
        }
    }
    searchWrapperElt.style.display = 'flex';
});

