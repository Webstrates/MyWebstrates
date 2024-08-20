import { patch } from "@onsetsoftware/automerge-patcher";
import { globalObject } from './globalObject.js';

const versioningModule = {};

/**
 * Get the current version number of the strate.
 */
Object.defineProperty(globalObject.publicObject, 'version', {
	get: () => {
		return automerge.contentHandle.history().length-1;
	}
});

/**
 * Get tags.
 */
Object.defineProperty(globalObject.publicObject, 'tags', {
	get: () => {
		return structuredClone(automerge.rootDoc.meta.tags);
	}
});

/**
 * Get the version hash of the current version.
 */
Object.defineProperty(globalObject.publicObject, 'versionHash', {
	get: () => versioningModule.currentVersionHash(),
});

versioningModule.currentVersionHash = () => {
	return automerge.contentHandle.heads()[0];
}

/**
 * Get the list of patches from the current version to the previous given version.
 * @param handle
 * @param version
 * @returns {Promise<Patch[]>}
 */
versioningModule.diffFromNewToOld = async (handle, version) => {
	let allChanges = handle.history();
	let oldHeads;
	if (typeof version === 'number') {
		const versionIndex = version;
		if (version >= allChanges.length || version < 1) {
			throw new Error("Invalid version number");
		}
		oldHeads = allChanges[versionIndex];
		if (oldHeads.length > 1) {
			throw new Error("Old version has multiple heads and represents a conflict. Cannot create a diff.");
		}
	} else if (typeof version === 'string') {
		version = await convertTagOrNumberToVersionHash(version);
		oldHeads = [version];
	}
	try {
		return automerge.contentHandle.diff(oldHeads);
	} catch (e) {
		throw new Error(`${version} is not a proper version hash, number or tag.`);
	}
}

async function convertTagOrNumberToVersionHash(version) {
	if (typeof version === 'number') {
		const allChanges = automerge.contentHandle.history();
		if (version >= allChanges.length || version < 1) {
			throw new Error("Invalid version number");
		}
		let heads = allChanges[version];
		if (heads.length > 1) {
			throw new Error("Old version has multiple heads and represents a conflict.");
		}
		return heads[0];
	}
	let rootDoc = await automerge.rootHandle.doc();
	if (!rootDoc.meta.tags) return version;
	if (!rootDoc.meta.tags[version]) return version;
	let contentDocId = rootDoc.content;
	let tag = rootDoc.meta.tags[version];
	if (tag.contentDocId !== contentDocId) {
		throw new Error("Accessing tags in archived strates is not yet supported");
		return;
	}
	return rootDoc.meta.tags[version].versionHash;
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
			doc.meta.tags[tag] = {
				contentDocId: automerge.contentHandle.documentId,
				versionHash: versioningModule.currentVersionHash()
			};
		});
	}
});

/**
 * Makes a new flat copy of the content document and stores a reference to the old one.
 */
Object.defineProperty(globalObject.publicObject, 'archiveHistory', {
	get: () => archiveHistory,
	set: () => { throw new Error('Internal archiveHistory method should not be modified'); },
	enumerable: false
});

async function archiveHistory() {
	let userConfirmed = confirm("You are about to archive the history of this strate. This is an experimental feature, are you sure you want to continue?\nThe page will reload five seconds after archiving.");
	if (!userConfirmed) {
		console.log("Archiving aborted");
		return;
	}
	let newContentHandle = automerge.repo.create();
	let currentContentDoc = await automerge.contentHandle.doc();
	await newContentHandle.change(doc => {
		// Copy over all properties from the source doc
		for (const key in currentContentDoc) {
			doc[key] = structuredClone(currentContentDoc[key]);
		}
	});
	let rootDocHeads = automerge.rootHandle.heads();
	let contentDocHeads = newContentHandle.heads();
	await automerge.rootHandle.change(doc => {
		if (!doc.meta.archive) doc.meta.archive = [];
		doc.meta.archive.push({
			contentDoc: automerge.contentHandle.documentId,
			contentDocHeads: contentDocHeads,
			rootDocHeads: rootDocHeads,
			timestamp: Date.now(),
		});
		doc.content = newContentHandle.documentId;
	});
	console.log("Reloading page in 5 seconds");
	setTimeout(() => {
		location.reload();
	}, 5000);
}

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
	let sourceDoc = await automerge.contentHandle.doc();
	let rootDoc = await automerge.rootHandle.doc();

	if (options.version) {
		const version = await convertTagOrNumberToVersionHash(options.version);
		sourceDoc = automerge.contentHandle.view([version]);
	} else {
		sourceDoc = await automerge.contentHandle.doc();
	}
	if (rootDoc.content) {
		let newRootHandle = automerge.repo.create();
		let newContentHandle = automerge.repo.create(structuredClone(sourceDoc));
		await newRootHandle.change(doc => {
			doc.content = newContentHandle.documentId;
			let meta = JSON.parse(JSON.stringify(rootDoc.meta));
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
	const rootDoc = await automerge.rootHandle.doc()
	let clonedContentHandle = automerge.repo.clone(automerge.contentHandle);
	if (!rootDoc.content) {
		return clonedContentHandle;
	}
	let rootHandle = automerge.repo.create();
	await rootHandle.change(doc => {
		doc.content = clonedContentHandle.documentId;
		doc.meta = JSON.parse(JSON.stringify(rootDoc.meta));
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
		const rootDoc = await automerge.rootHandle.doc();
		let otherStrateHandle = automerge.repo.find(`automerge:${otherStrateId}`);
		let otherStrateDoc = await otherStrateHandle.doc();
		if (rootDoc.content) {
			let otherStrateContentDocId = otherStrateDoc.content;
			let otherStrateContentHandle = automerge.repo.find(`automerge:${otherStrateContentDocId}`);
			automerge.contentHandle.merge(otherStrateContentHandle);
		} else {
			automerge.rootHandle.merge(otherStrateHandle);
		}
	}
});

export const versioning = versioningModule;
