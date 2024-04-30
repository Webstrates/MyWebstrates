import { globalObject } from './globalObject.js';
import {BlobWriter, BlobReader, ZipWriter, ZipReader, Uint8ArrayReader, Uint8ArrayWriter, TextWriter, TextReader} from "@zip.js/zip.js";
import * as parse5 from "parse5";
import {jsonmlAdapter} from "./jsonml-adapter";
import mime from "mime";
import jsonmlTools from "jsonml-tools";

Object.defineProperty(globalObject.publicObject, 'saveToZip', {
	get: () => saveToZip,
	set: () => { throw new Error('Internal download method should not be modified'); },
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'loadFromZip', {
	get: () => loadFromZip,
	set: () => { throw new Error('Internal loadFromZip method should not be modified'); },
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'importFromZip', {
	get: () => importFromZip,
	set: () => { throw new Error('Internal importFromZip method should not be modified'); },
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'exportToZip', {
	get: () => exportToZip,
	set: () => { throw new Error('Internal export method should not be modified'); },
	enumerable: false
});

Object.defineProperty(globalObject.publicObject, 'migrate', {
	get: () => migrate,
	set: () => { throw new Error('Internal migrate method should not be modified'); },
	enumerable: false
});

async function migrate() {
	// Migrate from old to new version
	let contentHandle = await automerge.repo.create();
	if (automerge.rootDoc.content) {
		console.warn("Webstrate already migrated, aborting");
		return;
	}
	await contentHandle.change(d => {
		if (automerge.rootDoc.assets) d.assets = JSON.parse(JSON.stringify(automerge.rootDoc.assets));
		if (automerge.rootDoc.cache) d.cache = JSON.parse(JSON.stringify(automerge.rootDoc.cache));
		if (automerge.rootDoc.data) d.data = JSON.parse(JSON.stringify(automerge.rootDoc.data));
		if (automerge.rootDoc.dom) d.dom = JSON.parse(JSON.stringify(automerge.rootDoc.dom));
	});
	await automerge.rootHandle.change(d => {
		d.content = contentHandle.documentId;
		delete d.assets;
		delete d.cache;
		delete d.data;
		delete d.dom;
		d.meta.migrated = {ts: Date.now(), heads: automerge.rootHandle.heads()};
	});
	alert("Migration complete. Please reload the page to continue");
}


/**
 * Download the current strate and its assets as a zip file.
 * Each document is stored as a separate binary file in the zip archive.
 * @returns {Promise<void>}
 */
async function saveToZip() {
	let docs = [{id: `rootDoc-${automerge.rootHandle.documentId}`, doc: await automerge.rootHandle.doc()}];
	if (automerge.rootDoc.content) {
		docs.push({id: `contentDoc-${automerge.contentHandle.documentId}`, doc: await automerge.contentHandle.doc()});
	}
	for (let asset of webstrate.assets) {
		const handle = await automerge.repo.find(`automerge:${asset.id}`);
		const assetDoc = await handle.doc();
		docs.push({id: handle.documentId, doc: assetDoc});
	}
	if (automerge.contentDoc.cache) {
		for (let cacheItem of Object.values(automerge.contentDoc.cache)) {
			const handle = await automerge.repo.find(`automerge:${cacheItem}`);
			const cacheDoc = await handle.doc();
			docs.push({id: handle.documentId, doc: cacheDoc});
		}
	}
	let data = await Promise.all(docs.map(async d => {
		let id = d.id.replace('rootDoc-', '');
		id = id.replace('contentDoc-', '');
		return {id: d.id, doc: await automerge.repo.export(`automerge:${id}`)}
	}));
	const blobWriter = new BlobWriter("application/zip");
	const zipWriter = new ZipWriter(blobWriter);
	for (let file of data) {
		await zipWriter.add(file.id, new Uint8ArrayReader(file.doc));
	}
	const blob = await zipWriter.close();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${automerge.rootHandle.documentId}.zip`;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Export the current strate and its assets as a zip file.
 * data and meta is stored as json files.
 * @returns {Promise<void>}
 */
async function exportToZip() {
	let jsonML = automerge.contentDoc.dom;
	let html = jsonmlTools.toXML(jsonML, []);
	html = html.replace(/ __wid="[^"]*"/g, "");
	const blobWriter = new BlobWriter("application/zip");
	const zipWriter = new ZipWriter(blobWriter);
	await zipWriter.add("index.html", new TextReader(html));
	if (automerge.contentDoc.data) {
		await zipWriter.add("data.json", new TextReader(JSON.stringify(automerge.contentDoc.data)));
	}
	if (automerge.rootDoc.meta) {
		await zipWriter.add("meta.json", new TextReader(JSON.stringify(automerge.rootDoc.meta)));
	}
	for (let asset of webstrate.assets) {
		const handle = await automerge.repo.find(`automerge:${asset.id}`);
		const assetDoc = await handle.doc();
		let blob = new Blob([assetDoc.data], {type: assetDoc.mimetype});
		await zipWriter.add(asset.fileName, new BlobReader(blob));
	}
	const blob = await zipWriter.close();
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${automerge.rootHandle.documentId}.zip`;
	a.click();
	URL.revokeObjectURL(url);
}

/**
 * Load a strate from a zip file consisting of binary automerge files
 * @returns {Promise<void>}
 */
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
			let contentHandle;
			let otherHandles = {};
			for (let entry of entries) {
				const docData = await entry.getData(new Uint8ArrayWriter());
				let handle = await automerge.repo.import(docData);
				if (entry.filename.startsWith('rootDoc-')) {
					rootHandle = handle;
				} else if (entry.filename.startsWith('contentDoc-')) {
					contentHandle = handle;
				} else {
					otherHandles[entry.filename] = handle;
				}
			}
			let rootDoc = await rootHandle.doc();
			let contentDoc;
			if (rootDoc.content) {
				contentDoc = await contentHandle.doc();
			}  else {
				contentDoc = rootDoc;
			}
			let assets = structuredClone(contentDoc.assets);
			for (let asset of assets) {
				for (let oldDocId in otherHandles) {
					if (asset.id === oldDocId) {
						asset.id = otherHandles[oldDocId].documentId;
					}
				}
			}
			let cache = {};
			if (Object.hasOwn(contentDoc, 'cache')) {
				cache = structuredClone(contentDoc.cache);
				for (let cacheItem in cache) {
					for (let oldDocId in otherHandles) {
						if (cache[cacheItem] == oldDocId) {
							cache[cacheItem] = otherHandles[oldDocId].documentId;
						}
					}
				}
			}
			if (contentHandle) {
				await contentHandle.change(d => {
					d.assets = assets
					d.cache = JSON.parse(JSON.stringify(cache));
				});
				if (rootDoc.content) {
					await rootHandle.change(d => {
						d.content = contentHandle.documentId;
					});
				}
			} else {
				await rootHandle.change(d => {
					d.assets = assets
					d.cache = JSON.parse(JSON.stringify(cache));
				});
			}
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

/**
 * Import a strate from a zip file containing an index.html file and an optional _data.json and _meta.json
 * As well as optional assets
 * @returns {Promise<void>}
 */
async function importFromZip() {
	const input = document.createElement('input');
	input.setAttribute('type', 'file');
	input.setAttribute('accept', '.zip');
	input.addEventListener('change', async (event) => {
		const file = input.files[0];
		const reader = new FileReader();
		reader.onload = async function (e) {
			const arrayBuffer = e.target.result;
			let jsonML;
			let assets = [];
			let data = {};
			let meta = {federations: []};
			const blobReader = new Uint8ArrayReader(new Uint8Array(arrayBuffer));
			const zip = new ZipReader(blobReader);
			let entries = await zip.getEntries();
			entries.forEach(e => e.filename = e.filename.split('/').pop());
			let indexHtmlEntry = entries.find(e => e.filename === "index.html");
			if (indexHtmlEntry) {
				// get text data from index.html
				const textWriter = new TextWriter();
				let html = await indexHtmlEntry.getData(textWriter);
				jsonML = parse5.parse(html, { treeAdapter: jsonmlAdapter })[0];
			}
			for (let entry of entries) {
				if (entry.filename === "data.json") {
					const textWriter = new TextWriter();
					let jsonData = await entry.getData(textWriter);
					data = JSON.parse(jsonData);
				} else if (entry.filename === "meta.json") {
					const textWriter = new TextWriter();
					let jsonMeta = await entry.getData(textWriter);
					meta = JSON.parse(jsonMeta);
				} else if (entry.filename !== "index.html") { // It's an asset
					let blob = await entry.getData(new BlobWriter());
					let binaryData = new Uint8Array(await blob.arrayBuffer());
					let assetHandle = automerge.repo.create();
					let mimeType = mime.getType(entry.filename);
					await assetHandle.change(d => {
						d.data = binaryData;
						d.mimetype = mimeType;
						d.fileName = entry.filename;
					});
					let assetId = assetHandle.documentId;
					let asset = {id: assetId, fileName: entry.filename, mimeType: mimeType};
					assets.push(asset);
				}
			}
			let rootHandle = await automerge.repo.create()
			let contentHandle = await automerge.repo.create();
			await contentHandle.change(d => {
				d.assets = assets;
				d.data = data;
				d.dom = jsonML;
			});
			await rootHandle.change(d => {
				d.content = contentHandle.documentId;
				d.meta = meta;
			})
			let id = rootHandle.documentId;
			await new Promise(r => setTimeout(r, 1000));
			window.open(`/s/${id}/`, '_blank');
		};
		reader.readAsArrayBuffer(file);
	});
	input.click();
}
