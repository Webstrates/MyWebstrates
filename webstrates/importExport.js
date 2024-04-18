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

async function download() {
	let docs = [{id: automerge.handle.documentId, doc: automerge.doc}];
	for (let asset of webstrate.assets) {
		const handle = await automerge.repo.find(`automerge:${asset.id}`);
		const assetDoc = await handle.doc();
		docs.push({id: handle.documentId, doc: assetDoc});
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
			let assetHandles = {};
			for (let entry of entries) {
				const docData = await entry.getData(new Uint8ArrayWriter());
				let handle = await automerge.repo.import(docData);
				if (entry.filename === file.name.split('.')[0]) {
					rootHandle = handle;
				} else {
					assetHandles[entry.filename] = handle;
				}
			}
			let rootDoc = await rootHandle.doc();
			let assets = structuredClone(rootDoc.assets);
			for (let asset of assets) {
				for (let oldAssetId in assetHandles) {
					if (asset.id === oldAssetId) {
						asset.id = assetHandles[oldAssetId].documentId;
					}
				}
			}
			await rootHandle.change(d => d.assets = assets);
			for (let assetHandle of Object.values(assetHandles)) {
				await assetHandle.doc();
			}

			window.open(`/s/${rootHandle.documentId}/`, '_blank').focus();
		}
		reader.readAsArrayBuffer(file);
	});
	input.click();
}
