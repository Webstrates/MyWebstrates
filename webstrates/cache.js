import { globalObject } from './globalObject.js';

const cacheObjectModule = {};

const publicObject = {};

cacheObjectModule.publicObject = publicObject;
globalObject.publicObject.cache = publicObject;

Object.defineProperty(publicObject, 'enable', {
	get: () => enable,
	set: () => { throw new Error('Internal enable method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'disable', {
	get: () => disable,
	set: () => { throw new Error('Internal disable method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'clear', {
	get: () => clear,
	set: () => { throw new Error('Internal clear method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'cached', {
	get: () => {
		if (!automerge.doc.cache) return {};
		return structuredClone(automerge.doc.cache);
	},
	set: () => { throw new Error('Cached cannot directly be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(publicObject, 'remove', {
	get: () => remove,
	set: () => { throw new Error('Internal remove method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
})

function remove(url) {
	if (!automerge.doc.cache || !automerge.doc.cache[url]) throw new Error(`${url} is not cached`);
	automerge.handle.change(d => delete d.cache[url]);
}

function enable() {
	automerge.handle.change(d => {
		d.meta.caching = true
		console.log("ENABLING", !d.cache)
		if (!d.cache)	d.cache = {};
	});
}

function disable() {
	automerge.handle.change(d => d.meta.caching = false);
}

function clear()
{
	automerge.handle.change(d => d.cache = {});
}


