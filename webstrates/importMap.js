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

Object.defineProperty(publicObject, 'content', {
	get: () => structuredClone(automerge.rootDoc.meta.importMap),
	set: (importMap) => replace(importMap)
})

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

Object.defineProperty(publicObject, 'stringify', {
	get: () => stringify,
	set: () => { throw new Error('Internal toString method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
})

function stringify() {
	return JSON.stringify(automerge.rootDoc.meta.importMap, null, 2);
}

function remove() {
	if (!automerge.rootDoc.meta.importMap) return;
	automerge.rootHandle.change(d => delete d.meta.importMap);
}

function create(map = { imports: {}}) {
	if (automerge.rootDoc.meta.importMap) return;
	automerge.rootHandle.change(d => d.meta.importMap = map);
}

function addImport(path, value) {
	if (!automerge.rootDoc.meta.importMap) create();
	automerge.rootHandle.change(d => d.meta.importMap.imports[path] = value);
}

function removeImport(path) {
	if (!automerge.rootDoc.meta.importMap || !automerge.rootDoc.meta.importMap.imports || !automerge.rootDoc.meta.importMap.imports[path]) return;
	automerge.rootHandle.change(d => delete d.meta.importMap.imports[path]);
}

function replace(importMap) {
	if (typeof importMap === 'string') {
		importMap = JSON.parse(importMap);
	}
	automerge.rootHandle.change(d => d.meta.importMap = importMap);
}


