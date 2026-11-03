// Runs the built functions.js in a vm with fake Office, CustomFunctions and fetch.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { build } from '../build.mjs';

const root = new URL('..', import.meta.url);
const plain = (v) => JSON.parse(JSON.stringify(v));

function load({ apiKey = 'key', respond }) {
	const calls = [];
	const registered = {};
	const storage = { 'hscode.apiKey': apiKey };
	class CfError {
		constructor(code, message) {
			this.code = code;
			this.message = message;
		}
	}
	const ctx = {
		console,
		setTimeout,
		Date,
		Promise,
		OfficeRuntime: { storage: { getItem: async (k) => storage[k] || null } },
		CustomFunctions: {
			associate: (id, fn) => (registered[id] = fn),
			Error: CfError,
			ErrorCode: { invalidValue: 'invalidValue', notAvailable: 'notAvailable' }
		},
		fetch: async (url, init) => {
			calls.push({ url, ...init });
			const { status, body, headers } = respond({ url, ...init });
			return { status, text: async () => JSON.stringify(body), headers: new Map(Object.entries(headers || {})) };
		}
	};
	vm.createContext(ctx);
	vm.runInContext(build(), ctx);
	return { fn: registered, calls, CfError };
}

const classifyRespond = (r) => {
	const body = JSON.parse(r.body);
	return {
		status: 200,
		body: { items: body.items.map((it) => ({ id: it.id, results: [{ goods_code: '64039999' + it.id.padStart(2, '0'), description: 'x', confidence: null }], error: null })) }
	};
};

test('functions.js is up to date with src/', () => {
	assert.equal(fs.readFileSync(new URL('functions.js', root), 'utf8'), build());
});

test('src/core.js matches the Sheets copy when both are present', () => {
	const sheets = new URL('../sheets/src/core.js', root);
	if (!fs.existsSync(sheets)) return;
	assert.equal(fs.readFileSync(new URL('src/core.js', root), 'utf8'), fs.readFileSync(sheets, 'utf8'));
});

test('registered ids match functions.json', () => {
	const { fn } = load({ respond: classifyRespond });
	const meta = JSON.parse(fs.readFileSync(new URL('functions.json', root), 'utf8'));
	assert.deepEqual(Object.keys(fn).sort(), meta.functions.map((f) => f.id).sort());
});

test('CODE over 60 cells in one call sends 3 batch requests, then caches', async () => {
	const { fn, calls } = load({ respond: classifyRespond });
	const input = Array.from({ length: 60 }, (_, i) => ['product ' + i]);
	const out = await fn.CODE(input);
	assert.equal(out.length, 60);
	assert.match(out[0][0], /^\d{10}$/);
	assert.deepEqual(plain(calls.map((c) => JSON.parse(c.body).items.length).sort((a, b) => a - b)), [10, 25, 25]);
	assert.equal(calls[0].headers.Authorization, 'Bearer key');
	await fn.CODE(input);
	assert.equal(calls.length, 3, 'recalculation must not call the API');
});

test('separate single-cell calls made together are coalesced into one batch', async () => {
	const { fn, calls } = load({ respond: classifyRespond });
	const outs = await Promise.all(['alpha shoes', 'beta boots', 'gamma socks'].map((t) => fn.CODE([[t]])));
	assert.equal(calls.length, 1);
	assert.equal(JSON.parse(calls[0].body).items.length, 3);
	assert.equal(outs.length, 3);
});

test('errors become cell errors with clear messages', async () => {
	const missing = load({ apiKey: '', respond: classifyRespond });
	const m = await missing.fn.CODE([['shoes']]);
	assert.equal(m[0][0].code, 'invalidValue');
	assert.match(m[0][0].message, /No API key set/);
	assert.equal(missing.calls.length, 0);

	const quota = load({ respond: () => ({ status: 429, body: {}, headers: { 'Retry-After': '30' } }) });
	const q = await quota.fn.CODE([['shoes']]);
	assert.equal(q[0][0].code, 'notAvailable');
	assert.match(q[0][0].message, /Quota exceeded.*30 s/);

	const bad = await load({ respond: classifyRespond }).fn.CODE([['shoes']], 'slow');
	assert.match(bad[0][0].message, /"fast" or "accurate"/);

	const blank = await load({ respond: classifyRespond }).fn.CODE([[''], ['x']]);
	assert.equal(blank[0][0], '');
	assert.match(blank[1][0].message, /2 characters/);
});

const detail = {
	goods_code: '0101210000',
	description: 'Pure-bred breeding horses',
	hierarchy: [],
	duties: [
		{ origin: 'ERGA OMNES', origin_code: '1011', duty: '0.00 %', meas_type_code: '103' },
		{ origin: 'China', origin_code: 'CN', duty: '3.00 %', meas_type_code: '142' }
	]
};
const lookupRespond = (r) => (r.url.endsWith('0101210000') ? { status: 200, body: detail } : { status: 404, body: { message: 'nope' } });

test('DESCRIPTION, DUTY and VALID share one cached lookup', async () => {
	const { fn, calls } = load({ respond: lookupRespond });
	assert.equal((await fn.DESCRIPTION([['0101210000']]))[0][0], 'Pure-bred breeding horses');
	assert.equal((await fn.DUTY([['0101210000']]))[0][0], '0.00 %');
	assert.equal((await fn.DUTY([[101210000]], 'cn'))[0][0], '3.00 %');
	assert.equal((await fn.VALID([['0101210000']]))[0][0], true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0].url, 'https://hscode.info/api/v1/en/latest/codes/0101210000');
});

test('unknown and malformed codes', async () => {
	const { fn } = load({ respond: lookupRespond });
	const d = await fn.DESCRIPTION([['9999999999'], ['12']]);
	assert.equal(d[0][0].code, 'notAvailable');
	assert.match(d[0][0].message, /Unknown code "9999999999"/);
	assert.equal(d[1][0].code, 'invalidValue');
	assert.deepEqual(plain(await fn.VALID([['9999999999'], ['12'], ['0101210000']])), [[false], [false], [true]]);
});

test('manifest points at the hosted files', () => {
	const xml = fs.readFileSync(new URL('manifest.xml', root), 'utf8');
	for (const file of ['functions.js', 'functions.json', 'taskpane.html']) {
		assert.ok(xml.includes('https://hscode.info/excel/' + file), file);
		assert.ok(fs.existsSync(new URL(file, root)), file + ' exists');
	}
	assert.match(xml, /Functions\.Namespace" DefaultValue="HSCODE"/);
});
