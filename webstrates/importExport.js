import { globalObject } from './globalObject.js';
import {BlobWriter, ZipWriter, ZipReader, Uint8ArrayReader, Uint8ArrayWriter} from "@zip.js/zip.js";

Object.defineProperty(globalObject.publicObject, 'download', {
	get: () => download,
	set: () => { throw new Error('Internal download method should not be modified'); },
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'loadFromZip', {
	get: () => loadFromZip,
	set: () => { throw new Error('Internal loadFromZip method should not be modified'); },
	enumerable: false
});

/**
 * Download the current strate and its assets as a zip file.
 * Each document is stored as a separate binary file in the zip archive.
 * @returns {Promise<void>}
 */
async function download() {
	let docs = [{id: `rootDoc-${automerge.handle.documentId}`, doc: await automerge.handle.doc()}];
	for (let asset of webstrate.assets) {
		const handle = await automerge.repo.find(`automerge:${asset.id}`);
		const assetDoc = await handle.doc();
		docs.push({id: handle.documentId, doc: assetDoc});
	}
	if (automerge.doc.cache) {
		for (let cacheItem of Object.values(automerge.doc.cache)) {
			const handle = await automerge.repo.find(`automerge:${cacheItem}`);
			const cacheDoc = await handle.doc();
			docs.push({id: handle.documentId, doc: cacheDoc});
		}
	}
	let data = docs.map(d => {return {id: d.id, doc: Automerge.save(d.doc)}})
	const blobWriter = new BlobWriter("application/zip");
	const zipWriter = new ZipWriter(blobWriter);
	for (let file of data) {
		await zipWriter.add(file.id, new Uint8ArrayReader(file.doc));
	}
	const blob = await zipWriter.close();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${automerge.handle.documentId}.zip`;
	a.click();
	URL.revokeObjectURL(url);
}

async function loadFromZip() {
	const input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.zip');
	input.addEventListener('change', async (event) => {
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = async function (e) {
			const arrayBuffer = e.target.result;
			const blobReader = new Uint8ArrayReader(new Uint8Array(arrayBuffer));
			const zipReader = new ZipReader(blobReader);
			const entries = await zipReader.getEntries();
			let rootHandle;
			let otherHandles = {};
			for (let entry of entries) {
				const docData = await entry.getData(new Uint8ArrayWriter());
				let handle = await automerge.repo.import(docData);
				if (entry.filename.startsWith('rootDoc-')) {
					rootHandle = handle;
				} else {
					otherHandles[entry.filename] = handle;
				}
			}
			let rootDoc = await rootHandle.doc();
			let assets = structuredClone(rootDoc.assets);
			for (let asset of assets) {
				for (let oldDocId in otherHandles) {
					if (asset.id === oldDocId) {
						asset.id = otherHandles[oldDocId].documentId;
					}
				}
			}
			let cache = {};
			if (Object.hasOwn(rootDoc, 'cache')) {
				cache = structuredClone(rootDoc.cache);
				for (let cacheItem in cache) {
					for (let oldDocId in otherHandles) {
						if (cache[cacheItem] == oldDocId) {
							cache[cacheItem] = otherHandles[oldDocId].documentId;
						}
					}
				}
			}
			await rootHandle.change(d => {
				d.assets = assets
				d.cache = JSON.parse(JSON.stringify(cache));
			});
			for (let otherHandle of Object.values(otherHandles)) {
				await otherHandle.doc();
			}
			setTimeout(() => {
				window.open(`/s/${rootHandle.documentId}/`, '_blank');
			}, 1000)
		}
		reader.readAsArrayBuffer(file);
	});
	input.click();
}
