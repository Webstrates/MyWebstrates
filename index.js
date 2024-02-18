//import * as AutomergeWasm from "@automerge/automerge-wasm"
import { next as Automerge } from "@automerge/automerge"
import { Repo, isValidAutomergeUrl } from "@automerge/automerge-repo"
import { IndexedDBStorageAdapter } from "@automerge/automerge-repo-storage-indexeddb"
import { BrowserWebSocketClientAdapter } from "@automerge/automerge-repo-network-websocket"
import { MessageChannelNetworkAdapter } from "@automerge/automerge-repo-network-messagechannel"
await import("es-module-shims")

const HOME_SYNC_SERVER = "sync.webstrates.net";

import {coreEvents} from "./webstrates/coreEvents.js";
import {coreDOM} from './webstrates/coreDOM.js';
import {corePopulator} from "./webstrates/corePopulator.js";
import {coreMutation} from './webstrates/coreMutation.js';
import {coreOpCreator} from './webstrates/coreOpCreator.js';
import {coreDocument} from './webstrates/coreDocument.js';
import {coreOpApplier} from './webstrates/coreOpApplier.js';
import * as setimmediate from "setimmediate";
const documentProxyObj = {};
const documentProxy = new Proxy(document, documentProxyObj);

coreEvents.createEvent('allModulesLoaded');
coreEvents.createEvent('receivedDocument');
coreEvents.createEvent('message');

window.config = {
	modules: [
		'globalObject',
		/*'loadedEvent'
		'nodeObjects',
		'protectedMode',
		'domEvents',
		'transclusionEvent',
		'signaling',
		//'assets',
		'tagging',
		'clientManager',
		'userObject',
		'data'*/
	]
};
window.config.isTransientElement = (DOMNode) => DOMNode.matches('transient')
window.config.isTransientAttribute = (DOMNode, attributeName) => attributeName.startsWith('transient-')

/*for (let module of window.config.modules) {
	await import(`./webstrates/modules/${module}.js`)
}*/

coreEvents.triggerEvent('allModulesLoaded');


async function installServiceWorker() {
	return new Promise((resolve, reject) => {
		navigator.serviceWorker.getRegistrations().then((registrations) => {
			if (registrations.length > 0) {
				console.log("Service worker already installed")
				resolve();
			} else {
				navigator.serviceWorker.register("/service-worker.js",{
					type: "module",
				}).then(
					(registration) => {
						console.log("Service worker registration succeeded:", registration);
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
	console.log("Creating repo")
	const repo = new Repo({
		storage: new IndexedDBStorageAdapter(),
		network: [
			new BrowserWebSocketClientAdapter(`wss://${HOME_SYNC_SERVER}`),
		],
		peerId: "plubstrates-client-" + Math.round(Math.random() * 1000000),
		sharePolicy: async (peerId) => peerId.includes("storage-server"),
	})

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
console.log("Before registration")
const repo = await initializeRepo()
self.repo = repo;
self.Automerge = Automerge;
setupMessageChannel(repo);

let match = window.location.pathname.match('/d/(.+)/');
if (match) {
	let documentId = match[1];
	const handle = (await repo).find(documentId);

	window.handle = handle;
	if (handle) {

		setupWebstrates(handle);
	} else {
		document.body.innerHTML = "NO SUCH DOCUMENT MAN OR MADAM OR ..."
	}

}


function setupWebstrates(handle) {
	(function(document, _document, documentProxyObj) {
		coreDOM.setDocuments(document, _document, documentProxyObj);
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
			})
		});
	})(documentProxy, document, documentProxyObj);
}


