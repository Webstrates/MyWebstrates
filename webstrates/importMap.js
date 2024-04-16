import { globalObject } from './globalObject.js';

const importMapObjectModule = {};

const publicObject = {};

importMapObjectModule.publicObject = publicObject;
globalObject.publicObject.importMap = publicObject;

Object.defineProperty(publicObject, 'create', {
	get: () => create,
	set: () => { throw new Error('Internal enable method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'remove', {
	get: () => remove,
	set: () => { throw new Error('Internal disable method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'addImport', {
	get: () => addImport,
	set: () => { throw new Error('Internal addImport method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
})

Object.defineProperty(publicObject, 'removeImport', {
	get: () => removeImport,
	set: () => { throw new Error('Internal removeImport method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
})

function remove() {
	if (!amDoc.meta.importMap) return;
	handle.change(d => delete d.meta.importMap);
}

function create(map = { imports: {}}) {
	if (amDoc.meta.importMap) return;
	handle.change(d => d.meta.importMap = map);
}

function addImport(path, value) {
	if (!amDoc.meta.importMap) create();
	handle.change(d => d.meta.importMap.imports[path] = value);
}

function removeImport(path) {
	if (!amDoc.meta.importMap || !amDoc.meta.importMap.imports || !amDoc.meta.importMap.imports[path]) return;
	handle.change(d => delete d.meta.importMap.imports[path]);

}


