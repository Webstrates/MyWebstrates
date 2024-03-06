import {BrowserWebSocketClientAdapter} from "@automerge/automerge-repo-network-websocket";
import {globalObject} from "./globalObject";

const coreFederationModule = {};

globalObject.publicObject.addSyncServer = (host) => {
	handle.change((doc) => {
		if (!doc.meta.federations) doc.meta.federations = [];
		if (doc.meta.federations.includes(host)) return;
		doc.meta.federations.push(host);
	});
	const messageChannel = new MessageChannel();
	navigator.serviceWorker.controller.postMessage({ type: "FEDERATE", host: host }, [messageChannel.port2])
	return coreFederationModule.addSyncServerToRepo(`wss://${host}`, repo);
}

const syncServers = [];
coreFederationModule.addSyncServerToRepo = function(url, repo) {
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

export const coreFederation = coreFederationModule;
