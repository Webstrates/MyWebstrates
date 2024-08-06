import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket";
import {globalObject} from "./globalObject";
import {coreUtils} from "./coreUtils";

const coreFederationModule = {};

globalObject.publicObject.addSyncServer = (host) => {
	let uri;
	[host, uri] = cleanHost(host);
	automerge.rootHandle.change((doc) => {
		if (!doc.meta.federations) doc.meta.federations = [];
		if (doc.meta.federations.includes(host)) return;
		doc.meta.federations.push(host);
	});
	const messageChannel = new MessageChannel();
	navigator.serviceWorker.controller.postMessage({ type: "FEDERATE", host: uri }, [messageChannel.port2])
	return coreFederationModule.addSyncServerToRepo(uri, automerge.repo);
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

const syncServers = [];
coreFederationModule.addSyncServerToRepo = function(url, repo) {
	console.log("Adding sync server", url);
	return new Promise((resolve, reject) => {
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
}

coreFederationModule.removeSyncServerFromRepo = function(uri, repo) {
	return new Promise((resolve, reject) => {
		if (syncServers.includes(uri)) {
			syncServers.splice(syncServers.indexOf(uri), 1);
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
