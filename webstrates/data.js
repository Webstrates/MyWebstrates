import { globalObject } from './globalObject.js';
import { coreEvents } from './coreEvents.js';
import { coreDocument } from './coreDocument';

const publicObject = {};
Object.defineProperty(globalObject.publicObject, 'data', {
	get: () => publicObject,
	set: () => { throw new Error('Internal data method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

/**
 * Object to get and override the webstrate data.
 */
Object.defineProperty(publicObject, 'content', {
	get: () => structuredClone(automerge.contentDoc.data),
	set: (data) => updateContent(data)
});

/**
 * Function to delete all webstrate data.
 */
Object.defineProperty(publicObject, 'clear', {
	get: () => clear,
	set: () => { throw new Error('Internal clear method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

/**
 * Function to update the webstrate data using a change function.
 */
Object.defineProperty(publicObject, 'update', {
	get: () => update,
	set: () => { throw new Error('Internal update method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

/**
 * Function to get a specific item from the webstrate data.
 */
Object.defineProperty(publicObject, 'getItem', {
	get: () => getItem,
	set: () => { throw new Error('Internal getItem method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

/**
 * Function to set a specific item in the webstrate data.
 */
Object.defineProperty(publicObject, 'setItem', {
	get: () => setItem,
	set: () => { throw new Error('Internal setItem method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

/**
 * Function to delete a specific item from the webstrate data.
 */
Object.defineProperty(publicObject, 'deleteItem', {
	get: () => deleteItem,
	set: () => { throw new Error('Internal deleteItem method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'updateData', {
	get: () => {
		console.warn('"webstrate.updateData" is deprecated. Use "webstrate.data.update" instead.');
		return update;
	},
	set: () => { throw new Error('Internal updateData method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});


function content() {
	return structuredClone(automerge.contentDoc.data);
}

function updateContent(data) {
	coreDocument.localDataUpdates = true;
	automerge.contentHandle.change((doc) => {
		doc.data = data;
	});
	coreDocument.localDataUpdates = false;
	return content();
}

function clear() {
	coreDocument.localDataUpdates = true;
	automerge.contentHandle.change((doc => {
		doc.data = {};
	}));
	coreDocument.localDataUpdates = false;
	return content();
}

function update(changeFunc) {
	coreDocument.localDataUpdates = true;
	automerge.contentHandle.change((doc => {
		changeFunc(doc.data);
	}));
	coreDocument.localDataUpdates = false;
	return content();
}

function getItem(key) {
	if (typeof automerge.contentDoc.data != 'object') {
		console.warn('Data is not an object. Cannot get item.');
		return;
	}
	return structuredClone(automerge.contentDoc.data[key]);
}

function setItem(key, value) {
	return update((data) => {
		if (typeof data != 'object') {
			console.warn('Data is not an object. Cannot set item.');
			return;
		}
		data[key] = value;
	});
}

function deleteItem(key) {
	coreDocument.localDataUpdates = true;
	automerge.contentHandle.change((doc => {
		if (typeof doc.data != 'object') {
			console.warn('Data is not an object. Cannot delete item.');
			return;
		}
		delete doc.data[key];
	}));
	coreDocument.localDataUpdates = false;
	return content();
}

coreEvents.addEventListener('webstrateObjectsAdded', (nodeTree) => {
	globalObject.createEvent('dataChanged');
	globalObject.createEvent('dataChanged*');
	globalObject.createEvent('dataChangedWithPatchSet');
	globalObject.createEvent('dataChangedWithPatchSet*');
}, coreEvents.PRIORITY.IMMEDIATE);

coreEvents.addEventListener('dataUpdated', (patchObj) => {
	if (patchObj.local) return;
	globalObject.triggerEvent('dataChanged', patchObj.patch);
});

coreEvents.addEventListener('dataUpdated', (patchObj) => {
	globalObject.triggerEvent('dataChanged*', patchObj.patch);
});

coreEvents.addEventListener('dataUpdatedWithPatchSet', (patchesObj) => {
	if (patchesObj.local) return;
	globalObject.triggerEvent('dataChangedWithPatchSet', patchesObj.patches);
});

coreEvents.addEventListener('dataUpdatedWithPatchSet', (patchesObj) => {
	globalObject.triggerEvent('dataChangedWithPatchSet*', patchesObj.patches);
});
