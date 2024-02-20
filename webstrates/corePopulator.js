'use strict';
//const coreEvents = require('./coreEvents');
import {coreEvents} from './coreEvents.js';
//const coreUtils = require('./coreUtils');
import {coreUtils} from './coreUtils.js';
//const coreJsonML = require('./coreJsonML');
import {coreJsonML} from './coreJsonML.js';
//const corePathTree = require('./corePathTree');
import {corePathTree} from './corePathTree.js';

const corePopulatorModule = {};


coreEvents.createEvent('populated');

let document;

corePopulatorModule.setDocument = (_document) => {
	document = _document;
}

corePopulatorModule.populate = function(rootElement, doc) {
	// Empty the document, so we can use it.
	while (rootElement.firstChild) {
		rootElement.removeChild(rootElement.firstChild);
	}

	const webstrateId = doc.id;
	const staticMode = coreUtils.getLocationObject().staticMode;

	// In order to execute scripts synchronously, we insert them all without execution, and then
	// execute them in order afterwards.
	const scripts = [];
	const html = coreJsonML.toHTML(doc.dom, undefined, scripts);
	coreUtils.appendChildWithoutScriptExecution(rootElement, html);

	return new Promise((resolve) => {
		coreUtils.executeScripts(scripts, () => {
			// Do not include the parent element in the path, i.e. create corePathTree on the <html>
			// element rather than the document element.
			const targetElement = rootElement.childNodes[0];
			const pathTree = corePathTree.PathTree.create(targetElement, null, true);
			pathTree.check();
			resolve();
			coreEvents.triggerEvent('populated', targetElement, webstrateId);
		});
	});
};


export const corePopulator = corePopulatorModule;
