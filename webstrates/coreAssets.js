'use strict';
import { coreEvents } from './coreEvents.js';
import { coreUtils } from './coreUtils.js';
import { coreAssets } from './coreAssets.js';
import { globalObject } from './globalObject.js';
import { coreDocument } from './coreDocument.js';

const assetsModule = {};

// Create internal event that other modules may subscribe to
coreEvents.createEvent('asset');


// Create event in userland.
globalObject.createEvent('asset');
globalObject.createEvent('assetDeleted');
let locationObject = coreUtils.getLocationObject();
let webstrateId;
if (locationObject) {
	webstrateId = locationObject.webstrateId;
};


coreEvents.addEventListener('assetAdded', function(asset) {
	coreEvents.triggerEvent('asset', asset);
	globalObject.triggerEvent('asset', asset);
});

coreEvents.addEventListener('assetDeleted', function(index) {
	globalObject.triggerEvent('assetDeleted', index);
});

// Define webstrate.assets. Returns a frozen copy, so users won't modify it.
Object.defineProperty(globalObject.publicObject, 'assets', {
	get: () => {
		return getAssets();
	}
});

function getAssets() {
	if (!automerge.contentDoc.assets) return {};
	return structuredClone(automerge.contentDoc.assets);
}

/**
 * Adds an asset to the document from a File Object
 * @param file
 * @returns {Promise<void>}
 */
globalObject.publicObject.addAssetFromFile = async (file) => {
	return new Promise((accept, reject) => {
		let reader = new FileReader();
		reader.onload = async function (e) {
			let arrayBuffer = e.target.result;
			let assetHandle = (await automerge.repo).create()
			await assetHandle.change(d => {
				d.data = new Uint8Array(arrayBuffer);
				d.mimeType = file.type;
				d.fileName = file.name;
				d.v = 0;
			});
			let assetObject = {fileName: file.name, fileSize: file.size, mimeType: file.type, id: assetHandle.documentId};
			automerge.contentHandle.change(d => {
				for (const asset of d.assets) {
					if (asset.fileName === file.name) {
						d.assets.splice(d.assets.indexOf(asset), 1);
					}
				}
				d.assets.push(assetObject);
			});
			window.assetHandles.push(assetHandle);
			let doc = await assetHandle.doc();
			accept(assetObject);
		}
		reader.readAsArrayBuffer(file);
	});
}

/**
 * Makes it possible to select and upload files.
 * @param  {Function} callback Callback with two arguments, error and response. First argument will
 *                             be null on success.
 * @return {Promise}  Promise that gets resolved with the result.
 * @public
 */
globalObject.publicObject.uploadAsset = (callback = () => {}, options = {}) => {
	return new Promise((accept, reject) => {
		const input = document.createElement('input');
		input.setAttribute('multiple', true);
		input.setAttribute('type', 'file');

		input.addEventListener('change', async (event) => {
			const formData = new FormData();
			Object.entries(options).forEach(([key, value]) => formData.append(key, value));
			for (let i=0; i < input.files.length; i++) {
				formData.append('file[]', input.files.item(i));
			}
			let files = formData.getAll("file[]");
			let newAssets = [];
			for (let file of files) {
				newAssets.push(await globalObject.publicObject.addAssetFromFile(file));
			}
			accept(newAssets);
		});

		input.click();
	});
};

globalObject.publicObject.deleteAsset = (assetName, callback) => {
	automerge.contentHandle.change((doc) => {
		let toRemove;
		for (let i = 0; i<doc.assets.length; i++) {
			let asset = doc.assets[i];
			if (asset.fileName === assetName) {
				toRemove = i;
				break;
			}
		}
		if (toRemove) doc.assets.splice(toRemove, 1);
	});
	if (callback) callback();
};

export const assets = assetsModule;
