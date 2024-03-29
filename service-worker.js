import * as AutomergeWasm from "@automerge/automerge-wasm"
import * as Automerge from "@automerge/automerge"
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
import { ZipReader, BlobReader, BlobWriter, TextWriter } from "@zip.js/zip.js";
import mime from 'mime';
import * as parse5 from "parse5";
import {jsonmlAdapter} from "./webstrates/jsonml-adapter";


const CACHE_NAME = "v473"
const FILES_TO_CACHE = [
	"automerge_wasm_bg.wasm",
	"es-module-shims.js",
	"es-module-shims.js.map",
	"index.html",
	"index.js",
	"index.js.map",
	"main.js",
	"main.js.map",
	"favicon.ico",
	"preload-helper.js",
	"NodeWSServerAdapter.js",
	"local-first.png",
	"mywebstrates.png"
];

async function initializeRepo() {
	console.log("Initializing repo in service worker");
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [],
		peerId: "service-worker-" + Math.round(Math.random() * 1000000),
		sharePolicy: async (peerId) => peerId.includes("p2p"),
	})

	await AutomergeWasm.promise
	Automerge.use(AutomergeWasm)

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

self.addEventListener("fetch",  (event) => {
	if (self.location.origin !== (new URL(event.request.url)).origin) return;
	if (!(event.request.url.match("/new")
		|| event.request.url.match("/s/(.+)/((.+)\.(.+))")
		|| event.request.url.match("/s/(.+)/?$")
		|| event.request.url.match("/s/([a-zA-Z0-9]+)/?(.+)?")
		|| event.request.url.match("/p2p")
		|| event.request.url.match(`(${FILES_TO_CACHE.join('|')})$`))) return;
	let result = handleFetch(event);
	if (result) event.respondWith(result);
});

async function handleFetch(event) {
	const responseFromCache = await caches.match(event.request);
	if (responseFromCache) return responseFromCache;
	let p2pMatch = event.request.url.match(/\/p2p/);
	if (p2pMatch) {
		// Respond with the file P2PSetup.html
		let response = await fetch("p2p/P2PSetup.html");
		return response;
	}
	let newMatch = event.request.url.match(/(\/new)((\?prototypeUrl=)(.+))?/);
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
		let handle = (await repo).create()
		await handle.change(d => {
			d.assets = assets;
			d.meta = {federations: []};
			d.data = {};
			d.dom = jsonML ? jsonML : generateDOM("New webstrate")
		});
		let id = handle.documentId;
		await new Promise(r => setTimeout(r, 500));
		return Response.redirect(`/s/${id}/`);
	}

	let assetMatch = event.request.url.match("/s/([^\\/]+)/(.+)");
	if (assetMatch && !(assetMatch[2] && assetMatch[2].startsWith('?'))) {
		let docId = assetMatch[1].split("@")[0];
		let filename = assetMatch[2];
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

		let handle = (await repo).find(`automerge:${docId}`);
		let doc = await handle.doc();
		let assetId;
		for (let asset of doc.assets) {
			if (asset.fileName === filename) {
				assetId = asset.id;
			}
		}
		if (assetId) {
			let assetHandle = (await repo).find(`automerge:${assetId}`);
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
	let urlPart = "/s/" + event.request.url.split("/s/")[1];
	let match = urlPart.match(/^\/s\/([a-zA-Z0-9._-]+)(?:@([a-zA-Z0-9.-:]+))?\/?(?:([a-zA-Z0-9_-]+)\/)?/);
	if (match) {
		let documentId = match[1];
		let syncServer = match[2] ? match[2].split('/')[0] : undefined;
		if (syncServer) await addSyncServer(`wss://${syncServer}`);
		let docHandle = (await repo).find(`automerge:${documentId}`);
		let doc = await docHandle.doc();
		let importMap = doc && doc.meta && doc.meta.importMap ? JSON.stringify(doc.meta.importMap) : `{"imports": {}}`
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
