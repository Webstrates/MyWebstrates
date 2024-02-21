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

const HOME_SYNC_SERVER = "sync.webstrates.net";
import {coreDOM} from './webstrates/coreDOM.js';
import {coreEvents} from "./webstrates/coreEvents.js";
import {corePopulator} from "./webstrates/corePopulator.js";
import {coreMutation} from './webstrates/coreMutation.js';
import {coreOpCreator} from './webstrates/coreOpCreator.js';
import {coreDocument} from './webstrates/coreDocument.js';
import {coreOpApplier} from './webstrates/coreOpApplier.js';
import {coreAssets} from './webstrates/coreAssets.js';
import {coreUtils} from './webstrates/coreUtils.js';
import {corePathTree} from "./webstrates/corePathTree.js";
import {coreJsonML} from "./webstrates/coreJsonML";
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
window.config.isTransientElement = (DOMNode) => DOMNode.matches('transient')
window.config.isTransientAttribute = (DOMNode, attributeName) => attributeName.startsWith('transient-')

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
		network: [
			new BrowserWebSocketClientAdapter(`wss://${HOME_SYNC_SERVER}`),
		],
		peerId: peerId,
		sharePolicy: async (peerId) => peerId.includes("storage-server"),
	});
	coreEvents.triggerEvent('peerIdReceived', {id: peerId});

	//await AutomergeWasm.promise
	//Automerge.use(AutomergeWasm)

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

let match = window.location.pathname.match('/d/([a-zA-Z0-9]+)/?(.+)?');
if (match) {

	let documentId = match[1];
	const handle = (await repo).find(`automerge:${documentId}`);

	window.handle = handle;
	if (handle) {
		setupWebstrates(handle);
	} else {
		document.body.innerHTML = "No such strate."
	}

} else {
	document.body.innerHTML = `Client is installed, go to <a href="/new">/new</a> to create a new strate.`;
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

				handle.on('ephemeral-message', (message) => {
					coreEvents.triggerEvent('message', message.message, message.senderId);
				});
			})
		});
}


