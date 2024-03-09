import * as A from "@automerge/automerge/next";
import { patch } from "@onsetsoftware/automerge-patcher";
import { globalObject } from './globalObject.js';

Object.defineProperty(globalObject.publicObject, 'version', {
	get: () => Automerge.getAllChanges(amDoc).length-1,
});

Object.defineProperty(globalObject.publicObject, 'versionHash', {
	get: () => Automerge.getHeads(amDoc)[0],
});


Object.defineProperty(globalObject.publicObject, 'restore', {
	value: async (version) => {
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
		for (const diffPatch of diffFromNewToOld) {
			handle.change((doc) => {
				patch(doc, diffPatch);
			});
		}
	}
});

Object.defineProperty(globalObject.publicObject, 'copy', {
		value: async (local = false) => {
			let currentDoc = await handle.doc();
			let newDocHandle = repo.create();
			await newDocHandle.change(doc => {
				for (const key in currentDoc) {
					doc[key] = structuredClone(currentDoc[key]);
				}
				if (local && doc.meta) {
					doc.meta.federations = [];
				}
			});
			setTimeout(() => {
				window.open(`/s/${newDocHandle.documentId}/`, '_blank');
			}, 500);
		}
});

Object.defineProperty(globalObject.publicObject, 'clone', {
	value: async () => {
		let clonedDocHandle = repo.clone(handle);
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
