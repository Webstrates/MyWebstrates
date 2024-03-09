import * as A from "@automerge/automerge/next";
import { patch } from "@onsetsoftware/automerge-patcher";
import { globalObject } from './globalObject.js';

const versioningModule = {};

Object.defineProperty(globalObject.publicObject, 'version', {
	get: () => Automerge.getAllChanges(amDoc).length-1,
});

Object.defineProperty(globalObject.publicObject, 'versionHash', {
	get: () => Automerge.getHeads(amDoc)[0],
});

versioningModule.diffFromNewToOld = async (handle, version) => {
	let currentDoc = await handle.doc();
	let allChanges = A.getAllChanges(currentDoc);
	let oldHead;
	console.log("VERSION", version);
	if (typeof version === 'number') {
		const versionIndex = version;
		if (version >= allChanges.length || version < 1) {
			throw new Error("Invalid version number");
		}
		oldHead = allChanges.map(c => A.decodeChange(c))[versionIndex].hash;
	} else if (typeof version === 'string') {
		oldHead = version;
	}
	console.log("OLD HEAD", oldHead);
	const diffFromNewToOld = A.diff(currentDoc, A.getHeads(currentDoc), [oldHead]);
	console.log("diffFromNewToOld", diffFromNewToOld);
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

Object.defineProperty(globalObject.publicObject, 'restore', {
	value: async (version) => {
		await versioningModule.restore(handle, version);
	}
});

versioningModule.copy = async (handle, repo, options = {local: false, version: undefined}) => {
	let sourceDoc;
	if (options.version) {
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
		for (const key in sourceDoc) {
			doc[key] = structuredClone(sourceDoc[key]);
		}
		if (options.local && doc.meta) {
			doc.meta.federations = [];
		}
	});
	return newDocHandle;
}

Object.defineProperty(globalObject.publicObject, 'copy', {
		value: async (options = {local: false, version: undefined}) => {
			let newDocHandle = await versioningModule.copy(handle, repo, options);
			setTimeout(() => {
				window.open(`/s/${newDocHandle.documentId}/`, '_blank');
			}, 500);
		}
});

versioningModule.clone = async (handle, repo) => {
	let clonedDocHandle = repo.clone(handle);
	return clonedDocHandle;
}

Object.defineProperty(globalObject.publicObject, 'clone', {
	value: async () => {
		let clonedDocHandle = await versioningModule.clone(handle, repo);
		setTimeout(() => {
			window.open(`/s/${clonedDocHandle.documentId}/`, '_blank');
		}, 500);
	}
});

Object.defineProperty(globalObject.publicObject, 'merge', {
	value: async (otherStrateId) => {
		let otherStrateHandle = repo.find(`automerge:${otherStrateId}`);
		let otherStrateDoc = await otherStrateHandle.doc();
		handle.merge(otherStrateHandle);
	}
});

export const versioning = versioningModule;
