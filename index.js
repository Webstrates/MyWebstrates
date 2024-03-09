//import * as AutomergeWasm from "@automerge/automerge-wasm"
import { next as Automerge } from "@automerge/automerge"
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
await import("es-module-shims")

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
import {signalStream} from "./webstrates/signalStream";
import {coreVersioning} from "./webstrates/coreVersioning";


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
						console.error(`Service worker registration failed: ${error}`);
						reject(error);
					},
				);
			}
		});
	});
}

async function initializeRepo() {
	let peerId = "fedistrates-client-" + Math.round(Math.random() * 1000000);
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [],
		peerId: peerId,
		sharePolicy: async (peerId) => peerId.includes("storage-server") || peerId.includes("service-worker"),
	});
	coreEvents.triggerEvent('peerIdReceived', {id: peerId});

	//await AutomergeWasm.promise
	//Automerge.use(AutomergeWasm)
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
	navigator.serviceWorker.controller.postMessage({ type: "INIT_PORT" }, [messageChannel.port2])
}


await installServiceWorker();
const repo = await initializeRepo()
self.repo = repo;
self.Automerge = Automerge;
setupMessageChannel(repo);

let match = window.location.pathname.match('/s/([a-zA-Z0-9]+)/?(.+)?');
if (match) {

	let documentId = match[1];
	const handle = (await repo).find(`automerge:${documentId}`);

	window.handle = handle;
	if (handle) {
		document.body.innerHTML = "Looking up strate...";
		let timeout = setTimeout(() => {
			document.body.innerHTML = "Could not find the strate.";
		}, 5000);
		let doc = await handle.doc();
		clearTimeout(timeout);
		if (!doc) {
			document.body.innerHTML = "No such strate."
		} else {
			await setupSyncServers(handle);
			await setupAssetHandles(handle);
			setupWebstrates(handle);
		}
	} else {
		document.body.innerHTML = "No such strate."
	}

} else {
	document.querySelector("#content").innerHTML = `<strong>Client is installed</strong><br><br><a href="/new">Create a new blank webstrate.</a><br><a href="/new?prototypeUrl=https://cdn.jsdelivr.net/gh/Webstrates/Codestrates-v2@master/prototypes/web.zip">Create a new codestrate.</a>`;
}

function setupSyncServers(handle) {
	return handle.doc().then((doc) => {
		if (!doc.meta || !doc.meta.federations) return;
		let syncServers = doc.meta.federations;
		if (syncServers) {
			syncServers.forEach((server) => {
				globalObject.publicObject.addSyncServer(server);
			})
		}
	});
}

function setupAssetHandles(handle) {
	return handle.doc().then(async (doc) => {
		if (!doc.assets) return;
		for (let asset of doc.assets) {
			let assetHandle = (await repo).find(`automerge:${asset.id}`);
			window.assetHandles.push(assetHandle);
		}
	});
}


function setupWebstrates(handle) {
		handle.doc().then((doc) => {
			window.amDoc = doc;
			coreOpApplier.listenForOps();
			coreEvents.triggerEvent('receivedDocument', doc, { static: false });
			corePopulator.populate(coreDOM.externalDocument, doc).then(async => {
				coreMutation.emitMutationsFrom(coreDOM.externalDocument);
				coreOpCreator.emitOpsFromMutations();
				coreDocument.subscribeToOps();
				const targetElement = coreDOM.externalDocument.childNodes[0];
				coreOpApplier.setRootElement(targetElement);

				handle.on( 'change', (change) => {
					if (!window.suppressChanges) {
						let patches = change.patches;
						coreDocument.handlePatches(patches);
					}
					window.amDoc = change.doc;
				});

				// Ephemeral messages might be sent multiple times, so we need to deduplicate them.
				let messageMap = new Map();
				handle.on('ephemeral-message', (messageObj) => {
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
		});
}


