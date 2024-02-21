'use strict';

import { coreEvents } from './coreEvents.js';
import {globalObject} from "./globalObject";

let peers = [];

coreEvents.addEventListener('message', (message) => {
	if (message.wa !== 'ping') return;
	for (let peer of peers) {
		if (peer.peerId === message.body) return;
	}
	if (peers.includes(message.body)) return;
	peers.push({peerId: message.body, timestamp: Date.now()});
	coreEvents.triggerEvent('peerConnected', message.body);
	coreEvents.triggerEvent('peerListReceived', structuredClone(peers));
});

function ping() {
	handle.broadcast({wa: "ping", body: globalObject.publicObject.clientId});
	for (let peer of peers) {
		if (Date.now() - peer.timestamp > 10000) {
			peers = peers.filter(p => p !== peer);
			coreEvents.triggerEvent('peerDisconnected', peer.peerId);
			coreEvents.triggerEvent('peerListReceived', structuredClone(peers));
		}
	}
}

coreEvents.addEventListener("populated", ping);

setInterval(ping, 5000);

