import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket";
import {globalObject} from "./globalObject";
import {coreUtils} from "./coreUtils";
import { coreEvents } from './coreEvents.js';

const coreFederationModule = {};

globalObject.createEvent('syncServerAdded');
globalObject.createEvent('syncServerRemoved');

globalObject.publicObject.addSyncServer = (host) => {
	let uri;
	[host, uri] = cleanHost(host);
	automerge.rootHandle.change((doc) => {
		if (!doc.meta.federations) doc.meta.federations = [];
		if (doc.meta.federations.includes(host)) return;
		doc.meta.federations.push(host);
	});
	tellServiceWorkerToFederate(uri);
}

globalObject.publicObject.removeSyncServer = (host) => {
	let uri;
	[host, uri] = cleanHost(host);
	automerge.rootHandle.change((doc) => {
		if (!doc.meta.federations) return;
		if (!doc.meta.federations.includes(host)) return;
		doc.meta.federations = doc.meta.federations.filter(f => f !== host);
	})
	return coreFederationModule.removeSyncServerFromRepo(uri, automerge.repo);
}

globalObject.publicObject.getSyncServers = () => {
	return coreFederationModule.getSyncServers();
}

function tellServiceWorkerToFederate(uri) {
	const messageChannel = new MessageChannel();
	navigator.serviceWorker.controller.postMessage({ type: "FEDERATE", host: uri }, [messageChannel.port2])
}

const syncServers = [];
coreFederationModule.addSyncServerToRepo = function(uri, repo) {
	console.log("Connecting to sync server:", uri)
	return new Promise((resolve, reject) => {
		if (!syncServers.includes(uri)) {
			let clientAdapter = new BrowserWebSocketClientAdapter(uri)
			repo.networkSubsystem.addNetworkAdapter(clientAdapter);
			syncServers.push(uri);
			clientAdapter.on('ready', (p) => {
				globalObject.triggerEvent('syncServerAdded', uri);
				resolve();
			});
		} else {
			resolve();
		}
	});
}

coreEvents.addEventListener('receivedDocument', async () => {
	let rootDoc = await automerge.rootHandle.doc();
	for (let host of rootDoc.meta.federations) {
		let uri;
		[host, uri] = cleanHost(host);
		await coreFederationModule.addSyncServerToRepo(uri, automerge.repo);
	}
	automerge.rootHandle.on('change', async (change) => {
		for (let p of change.patches) {
			if (p.action === 'splice' && p.path.join(".").startsWith('meta.federations')) {
				let host = p.value;
				let uri;
				[host, uri] = cleanHost(host);
				coreFederationModule.addSyncServerToRepo(uri, automerge.repo);
			}
			if (p.action === 'put' && p.path.join(".").startsWith('meta.federations')) {
				let rootDoc = await automerge.rootHandle.doc();
				let diff = syncServers.filter(x => !rootDoc.meta.federations.includes(x.replace(/(^\w+:|^)\/\//, '')));
				if (diff.length > 0) {
					for (let uri of diff) {
						globalObject.triggerEvent('syncServerRemoved', uri);
					}
				}
			}
		}
	});
});


coreFederationModule.getSyncServers = function() {
	return syncServers;
}

coreFederationModule.removeSyncServerFromRepo = function(uri, repo) {
	return new Promise((resolve, reject) => {
		if (syncServers.includes(uri)) {
			syncServers.splice(syncServers.indexOf(uri), 1);
			coreEvents.triggerEvent('syncServerRemoved', uri);
			resolve();
		} else {
			resolve();
		}
	});
}

function cleanHost(host) {
	host = host.replace(/(^\w+:|^)\/\//, '');
	let uri = `wss://${host}`;
	if (coreUtils.isValidUrl(uri) === false) {
		throw new Error('Invalid host ' + host);
		return;
	}
	return [host, uri];
}

export const coreFederation = coreFederationModule;
