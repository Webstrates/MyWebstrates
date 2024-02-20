import { globalObject } from './globalObject.js';
import { coreEvents } from './coreEvents.js';

let updateData = (changeFunc) => {
	handle.change((doc => {
		changeFunc(doc.data);
	}));
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
}, coreEvents.PRIORITY.IMMEDIATE);

coreEvents.addEventListener('dataUpdated', (patch) => {
	globalObject.triggerEvent('dataChanged', patch);
});





