// Runs src/Code.js in a vm with fake Apps Script services.
const test = require('node:test');
const plain = (v) => JSON.parse(JSON.stringify(v));
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load({ apiKey = 'key', respond }) {
	const calls = [];
	const store = {};
	const props = { HSCODE_API_KEY: apiKey };
	const ctx = {
		console,
		UrlFetchApp: {
			fetchAll(reqs) {
				calls.push(reqs);
				return reqs.map((r) => {
					const { status, body, headers } = respond(r);
					return { getResponseCode: () => status, getContentText: () => JSON.stringify(body), getHeaders: () => headers || {} };
				});
			}
		},
		CacheService: {
			getUserCache: () => ({
				getAll: (keys) => Object.fromEntries(keys.filter((k) => k in store).map((k) => [k, store[k]])),
				putAll: (obj) => Object.assign(store, obj)
			})
		},
		PropertiesService: {
			getUserProperties: () => ({
				getProperty: (k) => props[k] || null,
				setProperty: (k, v) => (props[k] = v),
				deleteProperty: (k) => delete props[k]
			})
		}
	};
	vm.createContext(ctx);
	const src = (f) => fs.readFileSync(path.join(__dirname, '../src', f), 'utf8');
	vm.runInContext(src('core.js'), ctx);
	vm.runInContext(src('Code.js'), ctx);
	return { fn: ctx, calls, store };
}

const classifyRespond = (r) => {
	const body = JSON.parse(r.payload);
	return {
		status: 200,
		body: { items: body.items.map((it) => ({ id: it.id, results: [{ goods_code: '64039999' + it.id.padStart(2, '0'), description: 'x', confidence: null }], error: null })) }
	};
};

test('HSCODE on a 60-row range makes 3 parallel batch requests, then serves from cache', () => {
	const { fn, calls } = load({ respond: classifyRespond });
	const input = Array.from({ length: 60 }, (_, i) => ['product ' + i]);
	const out = fn.HSCODE(input);
	assert.equal(out.length, 60);
	assert.equal(calls.length, 1);
	assert.deepEqual(plain(calls[0].map((r) => JSON.parse(r.payload).items.length)), [25, 25, 10]);
	assert.equal(calls[0][0].method, 'post');
	assert.equal(calls[0][0].contentType, 'application/json');
	assert.equal(calls[0][0].headers.Authorization, 'Bearer key');
	assert.match(out[0][0], /^\d{10}$/);
	fn.HSCODE(input);
	assert.equal(calls.length, 1, 'second recalculation must not call the API');
});

test('HSCODE keeps blanks, flags bad rows, dedupes identical rows', () => {
	const { fn, calls } = load({ respond: classifyRespond });
	const out = fn.HSCODE([['shoes'], [''], ['x'], ['Shoes']]);
	assert.equal(calls[0].length, 1);
	assert.equal(JSON.parse(calls[0][0].payload).items.length, 1);
	assert.equal(out[1][0], '');
	assert.match(out[2][0], /^#ERROR: .*2 characters/);
	assert.equal(out[0][0], out[3][0]);
});

test('scalar errors throw: missing key, quota, bad mode', () => {
	assert.throws(() => load({ apiKey: '', respond: classifyRespond }).fn.HSCODE('shoes'), /No API key set/);
	const quota = load({ respond: () => ({ status: 429, body: { error: 'quota' }, headers: { 'Retry-After': '60' } }) });
	assert.throws(() => quota.fn.HSCODE('shoes'), /Quota exceeded.*60 s/);
	assert.throws(() => load({ respond: classifyRespond }).fn.HSCODE('shoes', 'slow'), /fast.*accurate/);
});

test('range with quota error gets a message per cell', () => {
	const { fn } = load({ respond: () => ({ status: 429, body: {} }) });
	const out = fn.HSCODE([['shoes'], ['boots']]);
	assert.match(out[0][0], /^#ERROR: Quota exceeded/);
	assert.match(out[1][0], /^#ERROR: Quota exceeded/);
});

const detail = {
	goods_code: '0101210000',
	description: 'Pure-bred breeding horses',
	hierarchy: [],
	duties: [{ origin: 'ERGA OMNES', origin_code: '1011', duty: '0.00 %', meas_type_code: '103' }]
};
const lookupRespond = (r) =>
	r.url.endsWith('0101210000') ? { status: 200, body: detail } : { status: 404, body: { error: 'not_found', message: 'nope' } };

test('lookup functions share one cached request per code', () => {
	const { fn, calls } = load({ respond: lookupRespond });
	assert.equal(fn.HSCODE_DESCRIPTION('0101210000'), 'Pure-bred breeding horses');
	assert.equal(fn.HSCODE_DUTY('0101210000'), '0.00 %');
	assert.equal(fn.HSCODE_VALID('0101210000'), true);
	assert.equal(calls.length, 1);
	assert.equal(calls[0][0].method, 'get');
	assert.equal(calls[0][0].url, 'https://hscode.info/api/v1/en/latest/codes/0101210000');
});

test('unknown and malformed codes', () => {
	const { fn } = load({ respond: lookupRespond });
	assert.throws(() => fn.HSCODE_DESCRIPTION('9999999999'), /Unknown code "9999999999"/);
	assert.equal(fn.HSCODE_VALID('9999999999'), false);
	assert.equal(fn.HSCODE_VALID('12'), false);
	assert.throws(() => fn.HSCODE_DESCRIPTION('12'), /8 or 10 digits/);
	assert.deepEqual(plain(fn.HSCODE_VALID([['0101210000'], ['9999999999'], ['']])), [[true], [false], ['']]);
});

test('key management never exposes the key', () => {
	const { fn } = load({ apiKey: '', respond: lookupRespond });
	assert.deepEqual(plain(fn.getKeyStatus()), { set: false, hint: '' });
	assert.deepEqual(plain(fn.saveApiKey(' abcd1234 ')), { set: true, hint: '...1234' });
	assert.equal(fn.testApiKey(), 'Key works.');
	assert.deepEqual(plain(fn.clearApiKey()), { set: false, hint: '' });
	assert.throws(() => fn.saveApiKey('  '));
});
