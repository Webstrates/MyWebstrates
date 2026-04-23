'use strict';

// Device-local cookies. Per-user cross-device sync would need a persistent
// user identity; we don't have that yet, so everything here stays in this
// browser profile's IndexedDB.

import { globalObject } from './globalObject.js';
import { userObject } from './userObject.js';
import { coreUtils } from './coreUtils.js';

const cookiesModule = {};

const DB_NAME = 'mywebstrates-cookies';
const DB_VERSION = 1;
const STORE_HERE = 'here';        // keyed by [webstrateId, key]
const STORE_ANYWHERE = 'anywhere'; // keyed by key
const CHANNEL_NAME = 'mywebstrates-cookies';

globalObject.createEvent('cookieUpdateHere');
globalObject.createEvent('cookieUpdateAnywhere');

const getWebstrateId = () => {
	const location = coreUtils.getLocationObject();
	return location && location.webstrateId;
};

let dbPromise;
const openDB = () => {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);
		req.onupgradeneeded = () => {
			const db = req.result;
			if (!db.objectStoreNames.contains(STORE_HERE)) {
				db.createObjectStore(STORE_HERE, { keyPath: ['webstrateId', 'key'] });
			}
			if (!db.objectStoreNames.contains(STORE_ANYWHERE)) {
				db.createObjectStore(STORE_ANYWHERE, { keyPath: 'key' });
			}
		};
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
	dbPromise.catch(err => console.warn('Cookies: IndexedDB unavailable, cookies will not work.', err));
	return dbPromise;
};

const store = async (storeName, mode) => {
	const db = await openDB();
	return db.transaction(storeName, mode).objectStore(storeName);
};

// Wrap an IDBRequest as a promise.
const reqToPromise = (req) => new Promise((resolve, reject) => {
	req.onsuccess = () => resolve(req.result);
	req.onerror = () => reject(req.error);
});

// Cross-tab notifications. Created on first use so importing the module has
// no side effect in environments without BroadcastChannel (e.g. tests).
let channel;
const getChannel = () => {
	if (channel !== undefined) return channel;
	channel = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel(CHANNEL_NAME) : null;
	if (channel) {
		channel.onmessage = (ev) => {
			const { scope, key, value, webstrateId: wid } = ev.data || {};
			if (scope === 'here') {
				if (wid !== getWebstrateId()) return;
				globalObject.triggerEvent('cookieUpdateHere', key, value);
			} else if (scope === 'anywhere') {
				globalObject.triggerEvent('cookieUpdateAnywhere', key, value);
			}
		};
	}
	return channel;
};

const broadcast = (scope, key, value) => {
	const ch = getChannel();
	if (!ch) return;
	ch.postMessage({ scope, key, value, webstrateId: getWebstrateId() });
};

cookiesModule.getHere = async (key) => {
	const webstrateId = getWebstrateId();
	if (!webstrateId) return undefined;
	const s = await store(STORE_HERE, 'readonly');
	const row = await reqToPromise(s.get([webstrateId, key]));
	return row ? row.value : undefined;
};

// Passing value === undefined deletes the entry (matches Webstrates semantics).
cookiesModule.setHere = async (key, value) => {
	const webstrateId = getWebstrateId();
	if (!webstrateId) throw new Error('No webstrateId available for cookies.here');
	const s = await store(STORE_HERE, 'readwrite');
	if (value === undefined) {
		await reqToPromise(s.delete([webstrateId, key]));
	} else {
		await reqToPromise(s.put({ webstrateId, key, value }));
	}
	globalObject.triggerEvent('cookieUpdateHere', key, value);
	broadcast('here', key, value);
};

cookiesModule.getAnywhere = async (key) => {
	const s = await store(STORE_ANYWHERE, 'readonly');
	const row = await reqToPromise(s.get(key));
	return row ? row.value : undefined;
};

cookiesModule.setAnywhere = async (key, value) => {
	const s = await store(STORE_ANYWHERE, 'readwrite');
	if (value === undefined) {
		await reqToPromise(s.delete(key));
	} else {
		await reqToPromise(s.put({ key, value }));
	}
	globalObject.triggerEvent('cookieUpdateAnywhere', key, value);
	broadcast('anywhere', key, value);
};

// Public surface: webstrate.user.cookies.{here,anywhere}.{get,set}
const publicObject = {};

Object.defineProperty(publicObject, 'here', {
	value: Object.freeze({
		get: cookiesModule.getHere,
		set: cookiesModule.setHere
	}),
	enumerable: true
});

Object.defineProperty(publicObject, 'anywhere', {
	value: Object.freeze({
		get: cookiesModule.getAnywhere,
		set: cookiesModule.setAnywhere
	}),
	enumerable: true
});

cookiesModule.publicObject = publicObject;

// Attach to the user object, matching the Webstrates API shape.
Object.defineProperty(userObject.publicObject, 'cookies', {
	get: () => publicObject,
	set: () => { throw new Error('Internal cookies object should not be modified'); },
	enumerable: true
});

export const cookies = cookiesModule;
