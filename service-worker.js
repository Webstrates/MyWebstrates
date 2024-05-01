import * as AutomergeWasm from "@automerge/automerge-wasm"
import * as Automerge from "@automerge/automerge-repo"
import * as AutomergeCore from "@automerge/automerge"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
import { ZipReader, BlobReader, BlobWriter, TextWriter } from "@zip.js/zip.js";
import mime from 'mime';
import * as parse5 from "parse5";
import {jsonmlAdapter} from "./webstrates/jsonml-adapter";
import { md5 } from 'js-md5';

const Repo = Automerge.Repo;

const CACHE_NAME = "v130";
const FILES_TO_CACHE = [
	"automerge_wasm_bg.wasm",
	"es-module-shims.js",
	"es-module-shims.js.map",
	"index.html",
	"index.js",
	"index.js.map",
	"index2.js",
	"index2.js.map",
	"P2PSetup.js",
	"P2PSetup.js.map",
	"preload-helper.js",
	"preload-helper.js.map",
	"main.js",
	"main.js.map",
	"favicon.ico",
	"local-first.png",
	"mywebstrates.png",
	"p2p/P2PSetup.html"
];

const stratesWithCache = new Map();

async function initializeRepo() {
	console.log("Initializing repo in service worker");
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [],
		peerId: "service-worker-" + Math.round(Math.random() * 1000000),
		sharePolicy: async (peerId) => peerId.includes("p2p"),
	})

	await AutomergeWasm.promise

	return repo
}

const repo = initializeRepo()

// put it on the global context for interactive use
repo.then((r) => {
	self.repo = r
	self.Automerge = Automerge
})

const addResourcesToCache = async (resources) => {
	const cache = await caches.open(CACHE_NAME);
	await cache.addAll(resources);
};


self.addEventListener("install", (event) => {
	console.log("Installing service working")
	event.waitUntil(
		addResourcesToCache(FILES_TO_CACHE),
	);
	self.skipWaiting()
})

self.addEventListener("message", async (event) => {
	if (event.data && event.data.type === "INIT_PORT") {
		const clientPort = event.ports[0]
		;(await repo).networkSubsystem.addNetworkAdapter(
			new MessageChannelNetworkAdapter(clientPort, { useWeakRef: true })
		)
	} else if (event.data && event.data.type === "FEDERATE") {
		const url = event.data.host
		addSyncServer(`wss://${url}`);
	}
});

let syncServers = [];
function addSyncServer(url) {
	return new Promise((resolve, reject) => {
		repo.then((repo) => {
			if (!syncServers.includes(url)) {
				let clientAdapter = new BrowserWebSocketClientAdapter(url)
				repo.networkSubsystem.addNetworkAdapter(clientAdapter);
				syncServers.push(url);
				clientAdapter.on('ready', (p) => {
					resolve();
				});
			} else {
				resolve();
			}
		});
	});
}
self.addSyncServer = addSyncServer


async function clearOldCaches() {
	const cacheWhitelist = [CACHE_NAME]
	const cacheNames = await caches.keys()
	const deletePromises = cacheNames.map((cacheName) => {
		if (!cacheWhitelist.includes(cacheName)) {
			return caches.delete(cacheName)
		}
	})
	await Promise.all(deletePromises)
}

self.addEventListener("activate", async (event) => {
	console.log("Activating service worker.")
	await clearOldCaches()
	clients.claim()
})

self.addEventListener("fetch", (event) => {
	// First we will check if it is a remote URL that is being fetched.
	if (self.location.origin !== (new URL(event.request.url)).origin) {
		let fetchPromise = handleRemoteFetch(event);
		if (!fetchPromise) return;
		event.respondWith(fetchPromise);
	} else if (!(event.request.url.match("/new")
		|| event.request.url.match("/s/(.+)/((.+)\.(.+))")
		|| event.request.url.match("/s/(.+)/?$")
		|| event.request.url.match("/s/([a-zA-Z0-9]+)/?(.+)?")
		|| event.request.url.match("/p2p")
		|| event.request.url.match(`(${FILES_TO_CACHE.join('|')})$`))) {
		return;
	} else {
		event.respondWith(handleLocalFetch(event));
	}
});

async function generateCacheResponse(documentId) {
	let dataDocHandle = await (await repo).find(`automerge:${documentId}`);
	let dataDoc = await dataDocHandle.doc();
	const arrayBuffer = dataDoc.data;
	let headers = new Headers();
	for (let header in dataDoc.headers) {
		headers.set(header, dataDoc.headers[header]);
	}
	return new Response(arrayBuffer, {headers: headers});
}

function handleRemoteFetch(event) {
	// We now check if the webstrate has caching enabled
	let strateWithCaching = stratesWithCache.get(event.clientId);
	if (strateWithCaching) {
		let cacheDoc = async () => {
			const clientsList = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
			const targetClient = clientsList.find(client => client.url.includes(strateWithCaching));
			const messageChannel = new MessageChannel();
			let getCacheItem = function() {
				return new Promise((resolve, reject) => {
					targetClient.postMessage({
						type: 'CACHE_REQUEST',
						url: event.request.url
					}, [messageChannel.port2]);
					messageChannel.port1.onmessage = (event) => {
						if (event.data.type === 'CACHE_RESPONSE') {
							resolve(event.data.cacheItem);
						}
					}
				});
			}
			const cacheItem = await getCacheItem();
			if (cacheItem) {
				return await generateCacheResponse(cacheItem);
			}
			// If it does, we fetch the strate document
			let docHandle = await (await repo).find(`automerge:${strateWithCaching}`);
			let doc = await docHandle.doc()
			if (doc.content) {
				docHandle = await (await repo).find(`automerge:${doc.content}`);
				doc = await docHandle.doc();
			}
			if (doc && !doc.cache) {
				// If a cache hasn't been built yet, we will create one with the first URL that's being requested
				let dataDocHandle = await createDataDoc(event.request)
				if (dataDocHandle) {
					let cache = {};
					cache[event.request.url] = dataDocHandle.documentId;
					await docHandle.change(d => d.cache = cache);
				}
				//return newResponse;
			} else if (doc && doc.cache && !doc.cache[event.request.url]) {
				// if the cache exists, but the file hasn't been cached, we cache it
				let dataDocHandle = await createDataDoc(event.request);
				if (dataDocHandle) {
					await docHandle.change(d => d.cache[event.request.url] = dataDocHandle.documentId);
				}
			}
			doc = await docHandle.doc();
			let dataDocId = doc.cache[event.request.url];
			return await generateCacheResponse(dataDocId);
		};
		return cacheDoc();
	}
	return;
}

async function handleLocalFetch(event) {
	const responseFromCache = await caches.match(event.request);
	if (responseFromCache) return responseFromCache;
	let p2pMatch = event.request.url.match(/\/p2p/);
	if (p2pMatch) return await handleP2PMatch();
	let newMatch = event.request.url.match(/(\/new)((\?prototypeUrl=)(.+))?/);
	if (newMatch) return await handleNewMatch(event, newMatch);
	let assetMatch = event.request.url.match("/s/([^\\/]+)/(.+)");
	if (assetMatch && !(assetMatch[2] && assetMatch[2].startsWith('?'))) return await handleAssetMatch(event, assetMatch);
	let urlPart = "/s/" + event.request.url.split("/s/")[1];
	let match = urlPart.match(/^\/s\/([a-zA-Z0-9._-]+)(?:@([a-zA-Z0-9.-:]+))?\/?(?:([a-zA-Z0-9_-]+)\/)?/);
	if (match) return await handleStrateMatch(event, match);
}

async function handleP2PMatch() {
	const cacheStorage = await caches.open(CACHE_NAME);
	const cachedResponse = await cacheStorage.match("p2p/P2PSetup.html");
	return cachedResponse;
}

async function handleNewMatch(event, newMatch) {
	let jsonML;
	let assets = [];
	if (newMatch) {
		let prototypeZipURL = newMatch[4];
		if (prototypeZipURL) {
			// read the zip file from the prototypeZipURL and extract the content of index.html in it if it exists
			let prototypeZip = await fetch(prototypeZipURL, {credentials: 'same-origin'});
			let prototypeZipBlob = await prototypeZip.blob();
			let prototypeZipReader = new BlobReader(prototypeZipBlob);
			let zip = new ZipReader(prototypeZipReader);
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
				if (entry.filename !== "index.html") { // It's an asset
					let blob = await entry.getData(new BlobWriter());
					let data = new Uint8Array(await blob.arrayBuffer());
					let assetHandle = (await repo).create();
					let mimeType = mime.getType(entry.filename);
					await assetHandle.change(d => {
						d.data = data;
						d.mimetype = mimeType;
						d.fileName = entry.filename;
					});
					let assetId = assetHandle.documentId;
					let asset = {id: assetId, fileName: entry.filename, mimeType: mimeType};
					assets.push(asset);
				}
			}
		}
		let rootHandle = (await repo).create()
		let contentHandle = (await repo).create()
		await contentHandle.change(d => {
			d.assets = assets;
			d.data = {};
			d.dom = jsonML ? jsonML : generateDOM("New webstrate")
		});
		await rootHandle.change(d => {
			d.meta = {federations: []};
			d.content = contentHandle.documentId;
		});
		let id = rootHandle.documentId;
		await new Promise(r => setTimeout(r, 500));
		return Response.redirect(`/s/${id}/`);
	}
}

async function handleAssetMatch(event, assetMatch) {
	let docId = assetMatch[1].split("@")[0];
	let filename = decodeURIComponent(assetMatch[2]);
	// Check if it is a zip file
	let path = filename.split('/');
	let isZip = false;
	let isZipDir = false;
	let zipPath;
	if (path[0].endsWith(".zip?dir") || (path[1] && path[1].endsWith("?dir"))) {
		isZip = true;
		isZipDir = true;
		filename = path[0].split('?')[0];
	} else if (path.length > 1 && path[0].endsWith(".zip")) {
		isZip = true;
		filename = path[0];
		zipPath = path.slice(1).join('/');
	}

	const clientsList = await clients.matchAll({ includeUncontrolled: true, type: 'window' });
	const targetClient = clientsList.find(client => client.url.includes(docId));
	const messageChannel = new MessageChannel();
	let getAsset = function() {
		return new Promise((resolve, reject) => {
			targetClient.postMessage({
				type: 'ASSET_REQUEST',
				fileName: filename
			}, [messageChannel.port2]);
			messageChannel.port1.onmessage = (event) => {
				if (event.data.type === 'ASSET_RESPONSE') {
					resolve(event.data.asset);
				}
			}
		});
	}
	const asset = await getAsset();
	let assetId;
	if (!asset) {
		let handle = (await repo).find(`automerge:${docId}`);
		let doc = await handle.doc();
		if (doc.content) {
			handle = (await repo).find(`automerge:${doc.content}`);
			doc = await handle.doc();
		}
		for (let asset of doc.assets) {
			if (asset.fileName === filename) {
				assetId = asset.id;
			}
		}
	} else {
		assetId = asset.id;
	}
	if (assetId) {
		let assetHandle = (await repo).find(`automerge:${asset.id}`);
		let assetDoc = await assetHandle.doc();
		const uint8Array = assetDoc.data;
		if (isZip && isZipDir) {
			let blob = new Blob([uint8Array], { type: assetDoc.mimetype });
			let blobReader = new BlobReader(blob);
			let zip = new ZipReader(blobReader);
			let entries = await zip.getEntries();
			let result = entries.map(e => e.filename);
			let json = JSON.stringify(result);
			return new Response(json,{
				status: 200,
				statusText: 'OK',
				headers: {
					'Content-Type': 'application/json'
				}
			})
		}
		if (isZip) {
			let blob = new Blob([uint8Array], { type: assetDoc.mimetype });
			let blobReader = new BlobReader(blob);
			let zip = new ZipReader(blobReader);
			let blobWriter = new BlobWriter();
			let entries = await zip.getEntries();
			let entry = entries.find(e => e.filename === zipPath);
			if (entry) {
				const blob = await entry.getData(blobWriter);
				return new Response(blob,{
					status: 200,
					statusText: 'OK'
				})
			} else {
				return new Response("No such asset", {
					status: 404,
					statusText: 'No such asset'
				});
			}
		}
		const blob = new Blob([uint8Array], { type: assetDoc.mimeType });
		return new Response(blob,{
			status: 200,
			statusText: 'OK'
		})
	} else {
		return new Response("No such asset", {
			status: 404,
			statusText: 'No such asset'
		});
	}
}

async function handleStrateMatch(event, match) {
	let documentId = match[1];
	let syncServer = match[2] ? match[2].split('/')[0] : undefined;
	if (syncServer) await addSyncServer(`wss://${syncServer}`);
	let rootDocHandle = (await repo).find(`automerge:${documentId}`);
	let rootDoc = await rootDocHandle.doc();
	// To make it possible to import automerge and automerge-repo we need to add them to the importMap
	// If a user imports them, we want to make sure they get the same instance as running in the client
	let automergeRepoExports = '';
	for (let key in Automerge) {
		automergeRepoExports += `export const ${key} = Automerge.${key};\n`;
	}
	let automergeCoreExports = '';
	for (let key in AutomergeCore) {
		automergeCoreExports += `export const ${key} = AutomergeCore.${key};\n`;
	}

	let importMap = rootDoc && rootDoc.meta && rootDoc.meta.importMap ? rootDoc.meta.importMap : {imports:{}};
	importMap.imports["@automerge/automerge"] = "data:application/javascript;charset=utf-8," + encodeURIComponent(automergeCoreExports);
	importMap.imports["@automerge/automerge-repo"] = "data:application/javascript;charset=utf-8," + encodeURIComponent(automergeRepoExports);
	importMap = JSON.stringify(importMap);

	let caching = rootDoc && rootDoc.meta && rootDoc.meta.caching ? rootDoc.meta.caching : false;
	if (caching) {
		stratesWithCache.set(event.resultingClientId, rootDocHandle.documentId);
	}
	return new Response(`<!DOCTYPE html>
	<html>
	<head>
		<script type="importmap">${importMap}</script>
		<script type="module" crossorigin src="../../main.js"></script>
		<link rel="modulepreload" crossorigin href="../../index.js">
		

	</head>
	<body>
	</body>
	</html>`, {
		status: 200,
		statusText: 'OK',
		headers: {
			'Content-Type': 'text/html'
		}
	});
}

/**
 * This function takes a request stores the response data and headers in an automerge doc
 * @param request
 * @returns {Promise<(DocHandle<unknown>|Response)[]>}
 */
async function createDataDoc(request) {
	let clonedRequest = request.clone();
	let response;
	try {
		response = await fetch(clonedRequest);
	} catch (e) {
		console.warn(`Could not cache ${request.url}.`)
		return null;
	}
	try {
		if (response.type === 'opaque')	response = await fetch(clonedRequest.url);
	} catch (e) {
		console.warn(`Could not cache ${request.url}.`)
		return null;
	}
	let responseClone = response.clone()
	let headers = {};
	for (let [key, value] of responseClone.headers.entries()) {
		headers[key] = value;
	}
	let data = new Uint8Array(await responseClone.arrayBuffer());
	// We compute the checksum to see if we've seen this file before
	// The checksum -> docid pair is stored in indexeddb
	let checksum = md5(data);
	let knownAlready = await getDocId(checksum);
	let handle;
	if (knownAlready) {
		handle = await (await repo).find(knownAlready);
	} else {
		handle = await (await repo).create();
		await handle.change(d => {
			d.data = data;
			d.url = request.url;
			d.headers = headers;
			d.ts = Date.now();
		});
		await storeDocId(checksum, handle.documentId);
	}
	return handle;
}

function generateDOM(name) {
	return ['html', {'__wid': randomString()}, '\n',
		[ 'head', {'__wid': randomString()}, '\n',
			[ 'title', {'__wid': randomString()}, name ], '\n'], '\n',
		[ 'body', {'__wid': randomString()}, '\n' ]
	];
}

/**
 * Get random string of size.
 * @param  {int}    size     Expected length of string (optional).
 * @param  {string} alphabet List of characters to be used in string (optional).
 * @return {string}          Generated string.
 * @public
 */
 function randomString(size = 8,
																			 // Does not include 0, O, o, 1, I, l for readability.
																			 alphabet = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ') {
	const len = alphabet.length;
	let str = '';
	while (size--) {
		str += alphabet[random(0, len)];
	}
	return str;
};

/**
 * Get random integer from interval [min, max). Unbiased and evenly distributed (or close to).
 * @param  {int} min Minimum number, inclusive.
 * @param  {int} max Maximum number, exclusive.
 * @return {int}     Random number in interval [min, max)
 * @public
 */
function random(min, max) {
	return Math.floor(min + Math.random() * (max - min));
};


const openDatabase = () => {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open('docCache', 1);

		request.onupgradeneeded = function(event) {
			// Create an object store if it doesn't exist
			let db = event.target.result;
			if (!db.objectStoreNames.contains('hashToDocId')) {
				db.createObjectStore('hashToDocId', { keyPath: 'key' });
			}
		};

		request.onerror = function(event) {
			reject('IndexedDB database error: ', event.target.error);
		};

		request.onsuccess = function(event) {
			resolve(event.target.result);
		};
	});
};

const storeDocId = async (key, value) => {
	const db = await openDatabase();
	const transaction = db.transaction('hashToDocId', 'readwrite');
	const store = transaction.objectStore('hashToDocId');
	const request = store.put({ key: key, value: value });

	return new Promise((resolve, reject) => {
		request.onsuccess = function() {
			resolve('Data saved successfully');
		};
		request.onerror = function(event) {
			reject('Data save failed: ', event.target.error);
		};
	});
};

const getDocId = async (key) => {
	const db = await openDatabase();
	const transaction = db.transaction('hashToDocId', 'readonly');
	const store = transaction.objectStore('hashToDocId');
	const request = store.get(key);

	return new Promise((resolve, reject) => {
		request.onsuccess = function() {
			resolve(request.result ? request.result.value : null);
		};
		request.onerror = function(event) {
			reject('Data fetch failed: ', event.target.error);
		};
	});
};
