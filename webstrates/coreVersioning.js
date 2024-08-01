import * as A from "@automerge/automerge/slim";
import { patch } from "@onsetsoftware/automerge-patcher";
import { globalObject } from './globalObject.js';

const versioningModule = {};

/**
 * Get the current version number of the strate.
 */
Object.defineProperty(globalObject.publicObject, 'version', {
	get: () => Automerge.getAllChanges(automerge.contentDoc).length-1,
});

/**
 * Get the version hash of the current version.
 */
Object.defineProperty(globalObject.publicObject, 'versionHash', {
	get: () => versioningModule.currentVersionHash(),
});

versioningModule.currentVersionHash = () => {
	return AutomergeCore.getHeads(automerge.contentDoc)[0];
}

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

Object.defineProperty(globalObject.publicObject, 'tag', {
	value: async (tag) => {
		await automerge.rootHandle.change(doc => {
			if (!doc.meta.tags) doc.meta.tags = {};
			doc.meta.tags[tag] = versioningModule.currentVersionHash();
		});
	}
});

/**
 * Restore the strate to a previous version.
 */
Object.defineProperty(globalObject.publicObject, 'restore', {
	value: async (version) => {
		await versioningModule.restore(automerge.contentHandle, version);
	}
});

/**
 * Copy the current strate.
 * @param handle
 * @param repo
 * @param options
 * @returns {Promise<*>}
 */
versioningModule.copy = async (options = {local: false, version: undefined}) => {
	let sourceDoc = automerge.contentDoc;

	if (options.version) {
		// We have to create a new source doc from the previous version
		const diffFromNewToOld = await versioningModule.diffFromNewToOld(automerge.contentHandle, options.version);
		const currentDoc = await automerge.contentHandle.doc();
		sourceDoc = A.clone(currentDoc);
		for (const diffPatch of diffFromNewToOld) {
			sourceDoc = A.change(sourceDoc, doc => {
				patch(doc, diffPatch);
			});
		}
	} else {
		sourceDoc = await automerge.contentHandle.doc();
	}
	if (automerge.rootDoc.content) {
		let newRootHandle = automerge.repo.create();
		let newContentHandle = automerge.repo.create();
		await newContentHandle.change(doc => {
			// Copy over all properties from the source doc
			for (const key in sourceDoc) {
				doc[key] = structuredClone(sourceDoc[key]);
			}
		});
		await newRootHandle.change(doc => {
			doc.content = newContentHandle.documentId;
			let meta = JSON.parse(JSON.stringify(automerge.rootDoc.meta));
			if (options.local) {
				meta.federations = [];
			}
			doc.meta = meta;
		});
		return newRootHandle;
	} else {
		let newContentHandle = automerge.repo.create();
		await newContentHandle.change(doc => {
			// Copy over all properties from the source doc
			for (const key in sourceDoc) {
				doc[key] = structuredClone(sourceDoc[key]);
			}
			if (options.local) {
				doc.meta.federations = [];
			}
		});
		return newContentHandle;
	}

}

/**
 * Copy the current strate.
 * options.local: If true, the new strate will not be federated.
 * options.version: The version to copy from. If undefined, the current version is copied.
 * The version can either be a number or a version hash.
 */
Object.defineProperty(globalObject.publicObject, 'copy', {
		value: async (options = {local: false, version: undefined, openInNewTab: true}) => {
			let newDocHandle = await versioningModule.copy(options);
			if (options.openInNewTab) {
				await new Promise(r => setTimeout(r, 500));
				window.open(`/s/${newDocHandle.documentId}/`, '_blank');
			}
			return newDocHandle;
		}
});

/**
 * Clone the current strate.
 * @param handle
 * @param repo
 * @returns {Promise<*>}
 */
versioningModule.clone = async () => {
	let clonedContentHandle = automerge.repo.clone(automerge.contentHandle);
	if (!automerge.rootDoc.content) {
		return clonedContentHandle;
	}
	let rootHandle = automerge.repo.create();
	await rootHandle.change(doc => {
		doc.content = clonedContentHandle.documentId;
		doc.meta = JSON.parse(JSON.stringify(automerge.rootDoc.meta));
	});
	return rootHandle;
}

/**
 * Clone the current strate.
 * Opens the cloned strate in a new tab
 */
Object.defineProperty(globalObject.publicObject, 'clone', {
	value: async (options = {openInNewTab: true}) => {
		let clonedDocHandle = await versioningModule.clone();
		if (options.openInNewTab) {
			await new Promise(r => setTimeout(r, 500));
			window.open(`/s/${clonedDocHandle.documentId}/`, '_blank');
		}
		return clonedDocHandle;
	}
});

/**
 * Merge the changes from another strate into the current strate.
 * @param {string} otherStrateId The id of the strate to merge changes from.
 */
Object.defineProperty(globalObject.publicObject, 'merge', {
	value: async (otherStrateId) => {
		let otherStrateHandle = automerge.repo.find(`automerge:${otherStrateId}`);
		let otherStrateDoc = await otherStrateHandle.doc();
		if (automerge.rootDoc.content) {
			let otherStrateContentDocId = otherStrateDoc.content;
			let otherStrateContentHandle = automerge.repo.find(`automerge:${otherStrateContentDocId}`);
			automerge.contentHandle.merge(otherStrateContentHandle);
		} else {
			automerge.rootHandle.merge(otherStrateHandle);
		}
	}
});

export const versioning = versioningModule;
