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
	if (!window.amDoc.assets) return {};
	return structuredClone(window.amDoc.assets);
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

		input.addEventListener('change', event => {
			const formData = new FormData();
			Object.entries(options).forEach(([key, value]) => formData.append(key, value));
			for (let i=0; i < input.files.length; i++) {
				formData.append('file[]', input.files.item(i));
			}
			let files = formData.getAll("file[]");
			for (let file of files) {
				let reader = new FileReader();
				reader.onload = async function (e) {
					let arrayBuffer = e.target.result;
					let assetHandle = (await repo).create()
					await assetHandle.change(d => {
						d.data = new Uint8Array(arrayBuffer);
						d.mimeType = file.type;
						d.fileName = file.name;
						d.v = 0;
					});
					handle.change(d => {
						d.assets.push({fileName: file.name, fileSize: file.size, mimeType: file.type, id: assetHandle.documentId});
					});
					window.assetHandles.push(assetHandle);
					let doc = await assetHandle.doc();
				}
				reader.readAsArrayBuffer(file);
			}
		});

		input.click();
	});
};

globalObject.publicObject.deleteAsset = (assetName, callback) => {
	handle.change((doc) => {
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
