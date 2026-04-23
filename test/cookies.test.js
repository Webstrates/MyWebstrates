import { beforeEach, describe, expect, test, vi } from 'vitest';
import 'fake-indexeddb/auto';

// --- Mocks for the cookies module's imports -------------------------------

let events = {};
let globalPublicObject = {};
let userPublicObject = {};

vi.mock('../webstrates/globalObject.js', () => ({
	globalObject: {
		get publicObject() { return globalPublicObject; },
		createEvent: (name) => { events[name] = new Set(); },
		triggerEvent: (name, ...args) => {
			if (!events[name]) return;
			for (const l of events[name]) l(...args);
		},
	},
}));

vi.mock('../webstrates/userObject.js', () => ({
	userObject: { get publicObject() { return userPublicObject; } },
}));

let currentWebstrateId = 'strate-A';
vi.mock('../webstrates/coreUtils.js', () => ({
	coreUtils: {
		getLocationObject: () => ({ webstrateId: currentWebstrateId }),
	},
}));

// Force-disable BroadcastChannel so leftover listeners from previous module
// imports don't leak into later tests.
globalThis.BroadcastChannel = undefined;

// Fresh module + fresh mock objects for each test
async function loadCookies() {
	const { indexedDB } = await import('fake-indexeddb');
	globalThis.indexedDB = indexedDB;
	vi.resetModules();
	events = {};
	globalPublicObject = {};
	userPublicObject = {};
	const mod = await import('../webstrates/cookies.js');
	return mod.cookies;
}

// --- Tests ---------------------------------------------------------------

describe('cookies (device-local)', () => {
	beforeEach(() => {
		currentWebstrateId = 'strate-A';
	});

	test('exposes here/anywhere API on userObject.publicObject.cookies', async () => {
		await loadCookies();
		expect(typeof userPublicObject.cookies.here.get).toBe('function');
		expect(typeof userPublicObject.cookies.here.set).toBe('function');
		expect(typeof userPublicObject.cookies.anywhere.get).toBe('function');
		expect(typeof userPublicObject.cookies.anywhere.set).toBe('function');
	});

	test('cookies property on user object is read-only', async () => {
		await loadCookies();
		expect(() => { userPublicObject.cookies = null; }).toThrow();
	});

	test('here: set then get returns the stored value', async () => {
		await loadCookies();
		await userPublicObject.cookies.here.set('theme', 'dark');
		expect(await userPublicObject.cookies.here.get('theme')).toBe('dark');
	});

	test('here: missing key returns undefined', async () => {
		await loadCookies();
		expect(await userPublicObject.cookies.here.get('nope')).toBeUndefined();
	});

	test('here: setting undefined deletes the key', async () => {
		await loadCookies();
		await userPublicObject.cookies.here.set('k', 1);
		expect(await userPublicObject.cookies.here.get('k')).toBe(1);
		await userPublicObject.cookies.here.set('k', undefined);
		expect(await userPublicObject.cookies.here.get('k')).toBeUndefined();
	});

	test('here: stores complex values (objects, arrays)', async () => {
		await loadCookies();
		const v = { a: 1, b: [1, 2, 3], c: { nested: true } };
		await userPublicObject.cookies.here.set('obj', v);
		expect(await userPublicObject.cookies.here.get('obj')).toEqual(v);
	});

	test('here: is scoped per webstrateId (webstrateId read lazily)', async () => {
		await loadCookies();
		currentWebstrateId = 'strate-A';
		await userPublicObject.cookies.here.set('x', 'A');

		currentWebstrateId = 'strate-B';
		expect(await userPublicObject.cookies.here.get('x')).toBeUndefined();
		await userPublicObject.cookies.here.set('x', 'B');

		currentWebstrateId = 'strate-A';
		expect(await userPublicObject.cookies.here.get('x')).toBe('A');

		currentWebstrateId = 'strate-B';
		expect(await userPublicObject.cookies.here.get('x')).toBe('B');
	});

	test('anywhere: set then get returns the stored value', async () => {
		await loadCookies();
		await userPublicObject.cookies.anywhere.set('lang', 'en');
		expect(await userPublicObject.cookies.anywhere.get('lang')).toBe('en');
	});

	test('anywhere: missing key returns undefined', async () => {
		await loadCookies();
		expect(await userPublicObject.cookies.anywhere.get('nope')).toBeUndefined();
	});

	test('anywhere: setting undefined deletes the key', async () => {
		await loadCookies();
		await userPublicObject.cookies.anywhere.set('k', 1);
		await userPublicObject.cookies.anywhere.set('k', undefined);
		expect(await userPublicObject.cookies.anywhere.get('k')).toBeUndefined();
	});

	test('anywhere: shared across webstrateIds', async () => {
		await loadCookies();
		currentWebstrateId = 'strate-A';
		await userPublicObject.cookies.anywhere.set('lang', 'en');
		currentWebstrateId = 'strate-B';
		expect(await userPublicObject.cookies.anywhere.get('lang')).toBe('en');
	});

	test('here and anywhere are independent namespaces', async () => {
		await loadCookies();
		await userPublicObject.cookies.here.set('k', 'here-val');
		await userPublicObject.cookies.anywhere.set('k', 'anywhere-val');
		expect(await userPublicObject.cookies.here.get('k')).toBe('here-val');
		expect(await userPublicObject.cookies.anywhere.get('k')).toBe('anywhere-val');
	});

	test('cookieUpdateHere event fires on set', async () => {
		await loadCookies();
		const calls = [];
		events.cookieUpdateHere.add((k, v) => calls.push([k, v]));
		await userPublicObject.cookies.here.set('theme', 'dark');
		expect(calls).toEqual([['theme', 'dark']]);
	});

	test('cookieUpdateAnywhere event fires on set', async () => {
		await loadCookies();
		const calls = [];
		events.cookieUpdateAnywhere.add((k, v) => calls.push([k, v]));
		await userPublicObject.cookies.anywhere.set('lang', 'en');
		expect(calls).toEqual([['lang', 'en']]);
	});

	test('cookieUpdateHere fires with undefined when a key is deleted', async () => {
		await loadCookies();
		await userPublicObject.cookies.here.set('k', 1);
		const calls = [];
		events.cookieUpdateHere.add((k, v) => calls.push([k, v]));
		await userPublicObject.cookies.here.set('k', undefined);
		expect(calls).toEqual([['k', undefined]]);
	});

	test('values persist across module reloads (same IndexedDB)', async () => {
		await loadCookies();
		await userPublicObject.cookies.anywhere.set('persist', 42);
		const c = await loadCookies();
		expect(await c.publicObject.anywhere.get('persist')).toBe(42);
	});
});
