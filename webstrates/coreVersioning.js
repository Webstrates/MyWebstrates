import * as A from "@automerge/automerge/next";
import { patch } from "@onsetsoftware/automerge-patcher";
import { globalObject } from './globalObject.js';

const versioningModule = {};

/**
 * Get the current version number of the strate.
 */
Object.defineProperty(globalObject.publicObject, 'version', {
	get: () => Automerge.getAllChanges(amDoc).length-1,
});

/**
 * Get the version hash of the current version.
 */
Object.defineProperty(globalObject.publicObject, 'versionHash', {
	get: () => Automerge.getHeads(amDoc)[0],
});

/**
 * Get the list of patches from the current version to the previous given version.
 * @param handle
 * @param version
 * @returns {Promise<Patch[]>}
 */
versioningModule.diffFromNewToOld = async (handle, version) => {
	let currentDoc = await handle.doc();
	let allChanges = A.getAllChanges(currentDoc);
	let oldHead;
	if (typeof version === 'number') {
		const versionIndex = version;
		if (version >= allChanges.length || version < 1) {
			throw new Error("Invalid version number");
		}
		oldHead = allChanges.map(c => A.decodeChange(c))[versionIndex].hash;
	} else if (typeof version === 'string') {
		oldHead = version;
	}
	const diffFromNewToOld = A.diff(currentDoc, A.getHeads(currentDoc), [oldHead]);
	return diffFromNewToOld;
}

versioningModule.restore = async (handle, version) => {
	const diffFromNewToOld = await versioningModule.diffFromNewToOld(handle, version);
	for (const diffPatch of diffFromNewToOld) {
		handle.change((doc) => {
			patch(doc, diffPatch);
		});
	}
}

/**
 * Restore the strate to a previous version.
 */
Object.defineProperty(globalObject.publicObject, 'restore', {
	value: async (version) => {
		await versioningModule.restore(handle, version);
	}
});

/**
 * Copy the current strate.
 * @param handle
 * @param repo
 * @param options
 * @returns {Promise<*>}
 */
versioningModule.copy = async (handle, repo, options = {local: false, version: undefined}) => {
	let sourceDoc;
	if (options.version) {
		// We have to create a new source doc from the previous version
		const diffFromNewToOld = await versioningModule.diffFromNewToOld(handle, options.version);
		const currentDoc = await handle.doc();
		sourceDoc = A.clone(currentDoc);
		for (const diffPatch of diffFromNewToOld) {
			sourceDoc = A.change(sourceDoc, doc => {
				patch(doc, diffPatch);
			});
		}
	} else {
		sourceDoc = await handle.doc();
	}
	let newDocHandle = repo.create();
	await newDocHandle.change(doc => {
		// Copy over all properties from the source doc
		for (const key in sourceDoc) {
			doc[key] = structuredClone(sourceDoc[key]);
		}
		if (options.local && doc.meta) {
			doc.meta.federations = [];
		}
	});
	return newDocHandle;
}

/**
 * Copy the current strate.
 * options.local: If true, the new strate will not be federated.
 * options.version: The version to copy from. If undefined, the current version is copied.
 * The version can either be a number or a version hash.
 */
Object.defineProperty(globalObject.publicObject, 'copy', {
		value: async (options = {local: false, version: undefined}) => {
			let newDocHandle = await versioningModule.copy(handle, repo, options);
			setTimeout(() => {
				window.open(`/s/${newDocHandle.documentId}/`, '_blank');
			}, 500);
		}
});

/**
 * Clone the current strate.
 * @param handle
 * @param repo
 * @returns {Promise<*>}
 */
versioningModule.clone = async (handle, repo) => {
	let clonedDocHandle = repo.clone(handle);
	return clonedDocHandle;
}

/**
 * Clone the current strate.
 * Opens the cloned strate in a new tab
 */
Object.defineProperty(globalObject.publicObject, 'clone', {
	value: async () => {
		let clonedDocHandle = await versioningModule.clone(handle, repo);
		setTimeout(() => {
			window.open(`/s/${clonedDocHandle.documentId}/`, '_blank');
		}, 500);
	}
});

/**
 * Merge the changes from another strate into the current strate.
 * @param {string} otherStrateId The id of the strate to merge changes from.
 */
Object.defineProperty(globalObject.publicObject, 'merge', {
	value: async (otherStrateId) => {
		let otherStrateHandle = repo.find(`automerge:${otherStrateId}`);
		let otherStrateDoc = await otherStrateHandle.doc();
		handle.merge(otherStrateHandle);
	}
});

export const versioning = versioningModule;
