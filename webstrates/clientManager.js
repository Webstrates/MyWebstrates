'use strict';

import { coreEvents } from './coreEvents.js';
import { globalObject } from './globalObject.js';

coreEvents.createEvent('clientsReceived');
coreEvents.createEvent('clientJoin');
coreEvents.createEvent('clientPart');

globalObject.createEvent('clientJoin');
globalObject.createEvent('clientJoin*');
globalObject.createEvent('clientPart');
globalObject.createEvent('clientPart*');

let clientId;
let clients = [];

Object.defineProperty(globalObject.publicObject, 'clients', {
	get: () => {
		return clients;
	}
});

Object.defineProperty(globalObject.publicObject, 'clientId', {
	get: () => clientId
});

coreEvents.addEventListener("peerIdReceived", (msg) => {
	clientId = msg.id;
});

coreEvents.addEventListener('peerListReceived', (peers) => {
	clients = peers;
});

coreEvents.addEventListener('peerConnected', (peer) => {
	coreEvents.triggerEvent('clientJoin', peer);
	if (peer !== clientId) {
		globalObject.triggerEvent('clientJoin', peer, false);
	}
	globalObject.triggerEvent('clientJoin*', peer, peer === clientId);
});

coreEvents.addEventListener('peerDisconnected', (peer) => {
	coreEvents.triggerEvent('clientPart', peer);
	if (peer !== clientId) {
		globalObject.triggerEvent('clientPart', peer, false);
	}
	globalObject.triggerEvent('clientPart*', peer, peer === clientId);
});
