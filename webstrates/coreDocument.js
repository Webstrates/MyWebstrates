'use strict';
import {coreEvents} from './coreEvents.js';
import {coreOpCreator} from './coreOpCreator.js';
import {corePathTree} from './corePathTree.js';
import { coreUtils } from "./coreUtils";

const coreDocumentModule = {};

let document;

coreDocumentModule.setDocument = (_document) => {
	document = _document;
}

coreEvents.createEvent('receivedOps');
coreEvents.createEvent('assetAdded');
coreEvents.createEvent('assetDeleted');
coreEvents.createEvent('dataUpdated');

coreDocumentModule.subscribeToOps = function() {
	coreEvents.addEventListener('createdOps', (ops) => {
		window.suppressChanges = true;
		handle.change(function(doc) {
			applyOpsToDoc(ops, doc);
		})
		window.suppressChanges = false;
	}, coreEvents.PRIORITY.IMMEDIATE);
}

coreDocumentModule.handlePatches = function(patches) {
	coreOpCreator.suppressAddingWids = true;
	processPatches(patches);
	coreOpCreator.suppressAddingWids = false;
}


/**
 * Called as a result of an incoming sync message.
 * @param patches
 */
function processPatches(patches) {
	patches = coreUtils.consolidateAutomergePatches(patches);
	let assetPatch;
	for (let patch of patches) {
		let path = patch.path;
		let first = path.shift();
		switch (first) {
			case 'dom':
				let patchOps = generateOpsFromPatch(patch);
				if (patchOps) coreEvents.triggerEvent('receivedOps', patchOps);
			case 'meta':
				break;
			case 'assets':
				if (patch.action === 'del') {
					handleUpdateToAssets(patch);
					return;
				} else if (patch.action === 'insert') { //We have to consolidate the subsequent puts into one patch
					assetPatch = structuredClone(patch);
				} else if (assetPatch && patch.action == 'put' && assetPatch.path[0] === patch.path[0]) {
					assetPatch.values[0][patch.path[1]] = patch.value;
				}
				if (assetPatch && assetPatch.values[0].fileName && assetPatch.values[0].fileSize && assetPatch.values[0].mimeType, assetPatch.values[0].id) {
					handleUpdateToAssets(assetPatch);
					assetPatch = undefined;
				}
				break;
			case 'data':
				coreEvents.triggerEvent('dataUpdated', patch);
				break;
		}
	}
}

/**
 * Triggers events if assets are modified
 * @param patch
 */
function handleUpdateToAssets(patch) {
	if (patch.path.length !== 1) return; // We don't care about attributes being changed. They shouldn't!
	if (patch.action === 'insert') { // Adding an asset
		coreEvents.triggerEvent('assetAdded', patch.values[0]);
	} else if (patch.action === 'del') { // Removing an asset
		coreEvents.triggerEvent('assetDeleted', patch.path[0]);
	}
}

let noTag; // Automerge will insert a new element with no tagname and then update the tagname. We can't handle this, so we do it in two steps.

/**
 * Internally Webstrates used Json0 ops for representing any changes to documents.
 * This function creates Json0 ops from Automerge patches.
 * @param patch
 * @returns {*[]} Array of ops.
 */
function generateOpsFromPatch(patch) {
	return coreUtils.generateOpsFromAutomergePatch(patch);
}

function applyOpsToDoc(ops, doc) {
	for (let op of ops) {
		applyOptoAMDoc(op, doc);
	}
}

function setAttribute(root, path, attributeName, value) {
	if (path.length > 0) {
		setAttribute(root[path.shift()], path, attributeName, value);
	} else {
		root[attributeName] = value;
	}
}

function removeAttribute(root, path, attributeName) {
	if (path.length > 0) {
		removeAttribute(root[path.shift()], path, attributeName);
	} else {
		delete root[attributeName];
	}
}

function deleteInText(root, path, charIndex, str) {
	let length = Number(str.length);
	Automerge.splice(root, path, charIndex, length);
}

function insertInText(root, path, charIndex, str) {
	Automerge.splice(root, path, charIndex, 0, str);
}

function deleteNode(root, path) {
	if (path.length > 1) {
		deleteNode(root[path.shift()], path);
	} else {
		root.splice(path[0], 1);
	}
}

function insertNode(root, path, node) {
	if (path.length > 1) {
		insertNode(root[path.shift()], path, node);
	} else {
		root.splice(path[0], 0, JSON.parse(JSON.stringify(node)));
	}
}

function applyOptoAMDoc(op, doc) {
	let charIndex, attributeName;
	const path = structuredClone(op.p);
	if (path.length === 0) {
		return;
	}

	// We have to use "prop in obj" syntax, because not all properties have a value, necessarily
	// (i.e. `oi`).
	if ('si' in op || 'sd' in op) {
		// For string insertions and string deletions, we extract the character index from the path.
		charIndex = path.pop();
	}

	if ('oi' in op || 'od' in op) {
		// For attribute insertions and attribute deletions, we extract the attribtue name from the
		// path.
		attributeName = path.pop();
	}
	// Attribute insertion (object insertion). Also catches replace operations, i.e. operations with
	// both `oi` and `od`.
	if ('oi' in op) {
		return setAttribute(doc.dom, path, attributeName, op.oi);
	}

	// Attribute removal (object deletion)
	if ('od' in op) {
		return removeAttribute(doc.dom, path, attributeName);
	}

	// String deletion.
	if ('sd' in op) {
		return deleteInText(doc.dom, path, charIndex, op.sd);
	}

	// String insertion.
	if ('si' in op) {
		return insertInText(doc.dom, path, charIndex, op.si);
	}

	// Node replacement, either a regular node, tag renaming, or a complete replacement of
	// attributes.
	if ('li' in op && 'ld' in op) {
		console.log("Pretty sure this doesn't happen");
		//return replaceNode(doc.dom, path, op.li);
	}

	// Element deletion operation (list deletion).
	if ('ld' in op) {
		return deleteNode(doc.dom, path);
	}

	// Element insertion operation (list insertion).
	if ('li' in op) {
		return insertNode(doc.dom, path, op.li);
	}
}

export const coreDocument = coreDocumentModule;
