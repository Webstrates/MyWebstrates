import { automergeWasmBase64 } from "@automerge/automerge/automerge.wasm.base64.js";
import * as Automerge from "@automerge/automerge-repo/slim"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
await import("es-module-shims")

window.Automerge = Automerge;
window.AutomergeCore = Automerge.Automerge.next;

const Repo = Automerge.Repo;
const documentProxyObj = {};
const documentProxy = new Proxy(document, documentProxyObj);
window.documentProxy = documentProxy;

import {coreEvents} from "./webstrates/coreEvents.js";
import {coreDOM} from './webstrates/coreDOM.js';
import {corePopulator} from "./webstrates/corePopulator.js";
import {coreMutation} from './webstrates/coreMutation.js';
import {coreOpCreator} from './webstrates/coreOpCreator.js';
import {coreDocument} from './webstrates/coreDocument.js';
import {coreOpApplier} from './webstrates/coreOpApplier.js';
import {coreAssets} from './webstrates/coreAssets.js';
import {coreUtils} from './webstrates/coreUtils.js';
import {corePathTree} from "./webstrates/corePathTree.js";
import {coreJsonML} from "./webstrates/coreJsonML";
import {coreFederation} from "./webstrates/coreFederation";
import * as setimmediate from "setimmediate";
import {globalObject} from "./webstrates/globalObject.js";
import {loadedEvent} from "./webstrates/loadedEvent.js";
import {protectedMode} from "./webstrates/protectedMode";
import {domEvents} from "./webstrates/domEvents";
import {transclusionEvent} from "./webstrates/transclusionEvent";
import {signaling} from "./webstrates/signaling";
import {clientManager} from "./webstrates/clientManager";
import {userObject} from "./webstrates/userObject";
import {data} from "./webstrates/data";
import {peerHandler} from "./webstrates/peerHandler";
import {coreVersioning} from "./webstrates/coreVersioning";
import {cache} from "./webstrates/cache"
import {importMap} from "./webstrates/importMap"
import {importExport} from "./webstrates/importExport"
import {signalStream} from "./webstrates/signalStream";

coreDOM.setDocuments(documentProxy, document, documentProxyObj);

corePopulator.setDocument(documentProxy);
coreMutation.setDocument(documentProxy);
coreOpCreator.setDocument(documentProxy);
coreDocument.setDocument(documentProxy);
coreOpApplier.setDocument(documentProxy);
coreUtils.setDocument(documentProxy);
corePathTree.setDocument(documentProxy);
coreJsonML.setDocument(documentProxy);
protectedMode.setDocument(documentProxy);

window.config = {};
window.config.isTransientElement = (DOMNode) => DOMNode.matches('transient');
window.config.isTransientAttribute = (DOMNode, attributeName) => attributeName.startsWith('transient-');
window.config.peerConnectionConfig = {
	'iceServers': [
		{ urls: 'stun:stun.services.mozilla.com' },
		{ urls: 'stun:stun.l.google.com:19302' }
	]
}
window.config.attributeValueDiffing = false;

window.assetHandles = [];
window.cacheHandles = [];
const automerge = {}
let _automerge = {};
setupAutomergeObject();

coreEvents.triggerEvent('allModulesLoaded');


async function installServiceWorker() {
	return new Promise((resolve, reject) => {
		navigator.serviceWorker.getRegistrations().then((registrations) => {
			if (registrations.length > 0) {
				resolve();
			} else {
				console.log("Installing service worker")
				navigator.serviceWorker.register("service-worker.js",{
					type: "module",
				}).then(
					(registration) => {
						resolve();
					},
					(error) => {
						console.error(`Service worker registration failed: ${error}`, error);
						reject(error);
					},
				);
			}
		});
	});
}

async function initializeRepo() {
	await Automerge.initializeBase64Wasm(automergeWasmBase64);
	let peerId = "mywebstrates-client-" + Math.round(Math.random() * 1000000);
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [],
		peerId: peerId,
		sharePolicy: async (peerId) => peerId.includes("storage-server") || peerId.includes("service-worker") || peerId.includes("p2p"),
	});
	coreEvents.triggerEvent('peerIdReceived', {id: peerId});

	let remoteHost = coreUtils.getLocationObject().remoteHost;
	if (remoteHost) {
		coreFederation.addSyncServerToRepo(`wss://${remoteHost}`, repo);
	}

	return repo
}

// Borrowed from trail-runner
function setupMessageChannel(repo) {
	if (!navigator.serviceWorker.controller) {
		console.log("No service worker is controlling this tab right now.")
		return
	}

	// Send one side of a MessageChannel to the service worker and register the other with the repo.
	const messageChannel = new MessageChannel()
	repo.networkSubsystem.addNetworkAdapter(new MessageChannelNetworkAdapter(messageChannel.port1))
	navigator.serviceWorker.controller.postMessage({type: "INIT_PORT"}, [messageChannel.port2])
	navigator.serviceWorker.addEventListener("message", (event) => {
		if (event.data.type == 'ASSET_REQUEST') {
			let asset;
			for (let a of automerge.contentDoc.assets) {
				if (a.fileName == event.data.fileName) {
					asset = a;
					break;
				}
			}
			event.ports[0].postMessage({type: 'ASSET_RESPONSE', asset: asset});
		}
		if (event.data.type == 'CACHE_REQUEST') {
			let cacheItem;
			if (automerge.contentDoc.cache && automerge.contentDoc.cache[event.data.url]) cacheItem = automerge.contentDoc.cache[event.data.url];
			event.ports[0].postMessage({type: 'CACHE_RESPONSE', cacheItem: cacheItem});
		}
	})
}

await installServiceWorker();
const repo = await initializeRepo()
_automerge.repo = repo;
self.Automerge = Automerge;
setupMessageChannel(repo);

let match = window.location.pathname.match('/s/(.+)/?(.+)?');
if (match) {
	let documentId = coreUtils.getLocationObject().webstrateId;
	let rootHandle;
	document.body.innerHTML = generateLoadingPage();
	try {
		console.log("Looking up strate...")
		rootHandle = await repo.find(`automerge:${documentId}`);
	} catch (e) {
		console.log("Failed to load strate document from Automerge");
		document.querySelector("#message").innerHTML = "Could not find strate.";
		document.querySelector(".spinner").style.display = "none";
		console.log(e);
		throw e;
	}
	let timeout = setTimeout(() => {
		document.querySelector("#message").innerHTML = "Could not find strate.";
		document.querySelector(".spinner").style.display = "none";
	}, 5000);
	let rootDoc = await rootHandle.doc();
	clearTimeout(timeout);
	document.querySelector("#message").remove();
	let contentHandle;
	let contentDoc;
	if (rootDoc.content) {
		contentHandle = await repo.find(`automerge:${rootDoc.content}`);
		contentDoc = await contentHandle.doc();
	}
	if (!contentHandle) {
		console.warn("Legacy strate: No content handle found, using main handle as content handle. Use webstrate.migrate() to migrate to the new format.");
		contentHandle = rootHandle;
		contentDoc = rootDoc;
	}
	_automerge.contentHandle = contentHandle;
	_automerge.rootHandle = rootHandle;
	_automerge.contentDoc = contentDoc;
	_automerge.rootDoc = rootDoc;

	await setupSyncServers();
	await setupAssetHandles();
	await setupCacheHandles();
	await setupWebstrates();
} else if ((window.location.pathname + window.location.search).match('/\?s/(.+)/?(.+)?')) {
	setTimeout(() => {
		window.location = window.location.pathname + window.location.search.slice(1);
	}, 500);
} else {
	document.querySelector("#content").innerHTML = `<strong>Client is installed</strong><br><br>\
		<a href="/new">Create a new blank webstrate.</a><br>\
		<a href="/new?editable">Create a new blank <em>editable</em> webstrate.</a><br>\
		<a href="/new?prototypeUrl=https://cdn.jsdelivr.net/gh/Webstrates/Codestrates-v2@master/prototypes/web.zip">Create a new codestrate.</a><br>`;
}

function setupSyncServers() {
	let rootDoc = automerge.rootDoc;
	if (!rootDoc.meta || !rootDoc.meta.federations) return;
	let syncServers = rootDoc.meta.federations;
	if (syncServers) {
		syncServers.forEach((server) => {
			globalObject.publicObject.addSyncServer(server);
		})
	}
}

async function setupAssetHandles() {
	let contentDoc = automerge.contentDoc;
	if (!contentDoc.assets) return;
	for (let asset of contentDoc.assets) {
		let assetHandle = (await repo).find(`automerge:${asset.id}`);
		window.assetHandles.push(assetHandle);
	}
}

async function setupCacheHandles() {
	let contentDoc = automerge.contentDoc;
	if (!contentDoc.cache) return;
	for (let cached in contentDoc.cache) {
		let cachedHandle = (await repo).find(`automerge:${contentDoc.cache[cached]}`);
		window.cacheHandles.push(cachedHandle);
	}
}

function setupAutomergeObject() {
	window.automerge = automerge;
	Object.defineProperty(automerge, "rootHandle", {
		get: () => _automerge.rootHandle,
		set: () => {throw new Error("Cannot set handle")}
	});
	Object.defineProperty(automerge, "rootDoc", {
		get: () => _automerge.rootDoc,
		set: () => {throw new Error("Cannot set doc")}
	});
	Object.defineProperty(automerge, "contentHandle", {
		get: () => _automerge.contentHandle,
		set: () => {throw new Error("Cannot set handle")}
	});
	Object.defineProperty(automerge, "contentDoc", {
		get: () => _automerge.contentDoc,
		set: () => {throw new Error("Cannot set doc")}
	});
	Object.defineProperty(automerge, "repo", {
		get: () => _automerge.repo,
		set: () => {throw new Error("Cannot set repo")}
	});
}


async function setupWebstrates() {
	let contentDoc = automerge.contentDoc;
	coreOpApplier.listenForOps();
	coreEvents.triggerEvent('receivedDocument', contentDoc, { static: false });
	corePopulator.populate(coreDOM.externalDocument, contentDoc).then(async => {
		coreMutation.emitMutationsFrom(coreDOM.externalDocument);
		coreOpCreator.emitOpsFromMutations();
		coreDocument.subscribeToOps();
		const targetElement = coreDOM.externalDocument.childNodes[0];
		coreOpApplier.setRootElement(targetElement);

		automerge.contentHandle.on( 'change', (change) => {
			if (!window.suppressChanges) {
				let patches = change.patches;
				coreDocument.handlePatches(patches);
			}
			_automerge.contentDoc = change.doc;
		});

		automerge.rootHandle.on('change', (change) => {
			_automerge.rootDoc = change.doc;
		});

		// Ephemeral messages might be sent multiple times, so we need to deduplicate them.
		let messageMap = new Map();
		automerge.rootHandle.on('ephemeral-message', (messageObj) => {
			let message = messageObj.message;
			if (!message.uuid) return;
			if (!messageMap.has(message.uuid)) {
				coreEvents.triggerEvent('message', message, messageObj.senderId);
				messageMap.set(message.uuid, Date.now());
			}
		});
		// We clear out seen messages every 10 seconds.
		setInterval(() => {
			let now = Date.now();
			for (let [uuid, timestamp] of messageMap) {
				if (now - timestamp > 10000) {
					messageMap.delete(uuid);
				}
			}
		}, 10000);
	})
}

function generateLoadingPage() {
	return `
<p id="message">Looking up strate...</p>
<div class="spinner"></div>
<style type="text/css" media="screen">
body {
	font-family: sans-serif;
	font-weight: 200;
	-webkit-font-smoothing: antialiased;
	text-align: center;
	margin-top: 15%;
	animation: fadein 1s;
}
@keyframes fadein {
	0% { opacity: 0; }
	100% { opacity: 1; }
}
.spinner {
	width: 40px;
	height: 40px;
	margin: 0 auto;
	background-color: #31a46f;
	animation: rotateplane 1.2s infinite ease-in-out;
}
@keyframes rotateplane {
	0% { transform: perspective(120px) rotateX(0deg) rotateY(0deg); }
	50% { transform: perspective(120px) rotateX(-180.1deg) rotateY(0deg); }
	100% { transform: perspective(120px) rotateX(-180deg) rotateY(-179.9deg); }
}
</style>
	`
}


