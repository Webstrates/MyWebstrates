import * as AutomergeWasm from "@automerge/automerge-wasm"
import * as Automerge from "@automerge/automerge"
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"

const CACHE_NAME = "v329"
const FILES_TO_CACHE = [
	"automerge_wasm_bg.wasm",
	"es-module-shims.js",
	"es-module-shims.js.map",
	"index.html",
	"index.js",
	"index.js.map",
	"main.js",
	"main.js.map",
	"favicon.ico"
];

async function initializeRepo() {
	console.log("Initializing repo in service worker");
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [],
		peerId: "service-worker-" + Math.round(Math.random() * 1000000),
		sharePolicy: async (peerId) => false,
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
	repo.then((repo) => {
		if (!syncServers.includes(url)) {
			repo.networkSubsystem.addNetworkAdapter(new BrowserWebSocketClientAdapter(url));
			syncServers.push(url);
		}
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
		|| event.request.url.match(`(${FILES_TO_CACHE.join('|')})$`))) return;
	let result = handleFetch(event);
	if (result) event.respondWith(result);
});

async function handleFetch(event) {
	const responseFromCache = await caches.match(event.request);
	if (responseFromCache) return responseFromCache;
	let newMatch = event.request.url.match("/new");
	if (newMatch) {
		let handle = (await repo).create()
		handle.change(d => {
			d.assets = [];
			d.meta = {federations: []};
			d.data = {};
			d.dom = generateDOM("New webstrate")
		});
		let id = handle.documentId;
		return new Response(`<!DOCTYPE html>
	<html>
	<head>

	</head>
	<body>
		New strate URL is: <a href='s/${id}/'>s/${id}</a>!
	</body>
	</html>`, {
			status: 200,
			statusText: 'OK',
			headers: {
				'Content-Type': 'text/html'
			}
		});
	}

	let assetMatch = event.request.url.match("/s/(.+)/((.+)\.(.+))");
	if (assetMatch) {
		let docId = assetMatch[1].split("@")[0];
		let filename = assetMatch[2];
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
			const blob = new Blob([uint8Array], { type: assetDoc.mimetype });
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
		return new Response(`<!DOCTYPE html>
	<html>
	<head>
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
