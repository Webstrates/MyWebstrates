'use strict';

import { coreEvents } from './coreEvents.js';
import {globalObject} from "./globalObject.js";
import {coreUtils} from "./coreUtils.js";

let peers = [];

coreEvents.addEventListener('message', (message) => {
	if (message.wa !== 'ping') return;
	for (let peer of peers) {
		if (peer.peerId === message.body) {
			peer.timestamp = Date.now();
			return;
		}
	}
	peers.push({peerId: message.body, timestamp: Date.now()});
	coreEvents.triggerEvent('peerListReceived', peers.map(p => p.peerId));
	coreEvents.triggerEvent('peerConnected', message.body);
});

function ping() {
	if (window.handle === undefined) return;
	handle.broadcast({wa: "ping", body: globalObject.publicObject.clientId, uuid: coreUtils.generateUUID()});
	for (let peer of peers) {
		if (Date.now() - peer.timestamp > 10000) {
			peers = peers.filter(p => p !== peer);
			coreEvents.triggerEvent('peerListReceived', peers.map(p => p.peerId));
			coreEvents.triggerEvent('peerDisconnected', peer.peerId);
		}
	}
}

coreEvents.addEventListener("userObjectAdded", () => {
	setTimeout(ping, 500);
});

setInterval(ping, 5000);

