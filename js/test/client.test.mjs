import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient, HscodeError } from '../dist/index.js';
import { fakeFetch, snapshots } from './helpers.mjs';

const route = (call) => (call.url.endsWith('/api/v1/snapshots') ? snapshots : { items: [] });

test('sends the bearer key and JSON body on classify', async () => {
	const fetch = fakeFetch(() => ({ results: [] }));
	const client = createClient({ apiKey: 'k_test', fetch });
	await client.classify({ text: 'cotton t-shirt', mode: 'accurate' });
	const [call] = fetch.calls;
	assert.equal(call.url, 'https://hscode.info/api/v1/classify');
	assert.equal(call.method, 'POST');
	assert.equal(call.headers.authorization, 'Bearer k_test');
	assert.deepEqual(call.body, { text: 'cotton t-shirt', mode: 'accurate' });
});

test('uses the baseUrl option', async () => {
	const fetch = fakeFetch(() => snapshots);
	await createClient({ apiKey: 'k', baseUrl: 'http://localhost:5173/', fetch }).snapshots();
	assert.equal(fetch.calls[0].url, 'http://localhost:5173/api/v1/snapshots');
});

test('reads the key from HSCODE_KEY', async () => {
	process.env.HSCODE_KEY = 'from_env';
	try {
		const fetch = fakeFetch(() => snapshots);
		await createClient({ fetch }).snapshots();
		assert.equal(fetch.calls[0].headers.authorization, 'Bearer from_env');
	} finally {
		delete process.env.HSCODE_KEY;
	}
});

test('classifyBatch posts items', async () => {
	const fetch = fakeFetch(() => ({ items: [] }));
	await createClient({ apiKey: 'k', fetch }).classifyBatch({
		items: [{ id: '1', text: 'shrimp' }],
		lang: 'de'
	});
	assert.equal(fetch.calls[0].url, 'https://hscode.info/api/v1/classify/batch');
	assert.deepEqual(fetch.calls[0].body, { items: [{ id: '1', text: 'shrimp' }], lang: 'de' });
});

test('builds the URL for each read method', async () => {
	const fetch = fakeFetch(route);
	const c = createClient({ apiKey: 'k', fetch });
	await c.lookup({ code: '6109100010', year: '2025', lang: 'de', history: true });
	await c.search({ query: 't shirt', year: '2026' });
	await c.duties({ code: '6109100010', year: '2026' });
	await c.chapters({ year: '2026' });
	await c.chapter({ chapter: '61', year: '2026' });
	assert.deepEqual(
		fetch.calls.map((x) => x.url),
		[
			'https://hscode.info/api/v1/de/2025/codes/6109100010?history=true',
			'https://hscode.info/api/v1/en/2026/search?q=t+shirt',
			'https://hscode.info/api/v1/2026/duties/6109100010',
			'https://hscode.info/api/v1/en/2026/chapters',
			'https://hscode.info/api/v1/en/2026/chapters/61'
		]
	);
});

test('resolves the latest year once across calls', async () => {
	const fetch = fakeFetch(route);
	const c = createClient({ apiKey: 'k', fetch });
	await c.lookup({ code: '6109100010' });
	await c.search({ query: 'shirt' });
	const urls = fetch.calls.map((x) => x.url);
	assert.equal(urls.filter((u) => u.endsWith('/snapshots')).length, 1);
	assert.ok(urls.includes('https://hscode.info/api/v1/en/2026/codes/6109100010'));
	assert.ok(urls.includes('https://hscode.info/api/v1/en/2026/search?q=shirt'));
});

test('accepts codes with spaces and dots', async () => {
	const fetch = fakeFetch(route);
	await createClient({ apiKey: 'k', fetch }).lookup({ code: '6109 10 00.10', year: '2026' });
	assert.ok(fetch.calls[0].url.endsWith('/codes/6109100010'));
});

test('rejects bad codes before any request', async () => {
	const fetch = fakeFetch(route);
	const c = createClient({ apiKey: 'k', fetch });
	for (const call of [() => c.lookup({ code: '6109' }), () => c.duties({ code: 'abc' })]) {
		await assert.rejects(call, (e) => {
			assert.ok(e instanceof HscodeError);
			assert.equal(e.status, 0);
			assert.equal(e.code, 'invalid_request');
			return true;
		});
	}
	assert.equal(fetch.calls.length, 0);
});

test('throws HscodeError with status and code on 401 and 429', async () => {
	for (const [status, code] of [
		[401, 'unauthorized'],
		[429, 'rate_limited']
	]) {
		const fetch = fakeFetch(() => ({ status, body: { error: code, message: `msg ${status}` } }));
		await assert.rejects(createClient({ apiKey: 'k', fetch }).snapshots(), (e) => {
			assert.ok(e instanceof HscodeError);
			assert.deepEqual([e.status, e.code, e.message], [status, code, `msg ${status}`]);
			return true;
		});
	}
});

test('retries year resolution after a failure', async () => {
	let n = 0;
	const fetch = fakeFetch((call) => {
		if (call.url.endsWith('/snapshots') && n++ === 0) {
			return { status: 429, body: { error: 'rate_limited', message: 'slow down' } };
		}
		return route(call);
	});
	const c = createClient({ apiKey: 'k', fetch });
	await assert.rejects(c.search({ query: 'x' }));
	await c.search({ query: 'x' });
	assert.ok(fetch.calls.at(-1).url.includes('/en/2026/search'));
});

test('missing key throws before any request', async () => {
	const fetch = fakeFetch(route);
	delete process.env.HSCODE_KEY;
	await assert.rejects(createClient({ fetch }).snapshots(), { code: 'missing_api_key' });
	assert.equal(fetch.calls.length, 0);
});

test('live API', { skip: !(process.env.HSCODE_LIVE === '1' && process.env.HSCODE_KEY) }, async () => {
	const s = await createClient().snapshots();
	assert.match(s.latest.year, /^\d{4}$/);
});
