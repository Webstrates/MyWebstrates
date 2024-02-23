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
	repo.networkSubsystem.addNetworkAdapter(new BrowserWebSocketClientAdapter(`wss://${host}`));
}

export const coreFederation = coreFederationModule;
