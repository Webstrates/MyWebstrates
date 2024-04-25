import { globalObject } from './globalObject.js';
import { coreEvents } from './coreEvents.js';
import { coreDocument } from "./coreDocument";

let updateData = (changeFunc) => {
	coreDocument.localDataUpdates = true;
	automerge.handle.change((doc => {
		changeFunc(doc.data);
	}));
	coreDocument.localDataUpdates = false;
}

Object.defineProperty(globalObject.publicObject, 'updateData', {
	get: () => updateData,
	set: () => { throw new Error('Internal updateData method should not be modified'); },
	// If enumerable is 'true', Puppeteer tests fail as `window.webstrate` is suddenly undefined
	// due to the circular reference.
	enumerable: false
});

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




