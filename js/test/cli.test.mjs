import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { main } from '../dist/cli.js';
import { fakeFetch, snapshots } from './helpers.mjs';

async function run(argv, { env = { HSCODE_KEY: 'k' }, fetch = fakeFetch(() => snapshots) } = {}) {
	let stdout = '';
	let stderr = '';
	const code = await main(argv, {
		env,
		fetch,
		stdout: { write: (s) => (stdout += s) },
		stderr: { write: (s) => (stderr += s) }
	});
	return { code, stdout, stderr, fetch };
}

const detail = { goods_code: '6109100010', description: 'T-shirts of cotton', hierarchy: [], duties: [] };
const notFound = { status: 404, body: { error: 'not_found', message: 'No such code' } };

test('validate exits 0 and prints the description for a known code', async () => {
	const fetch = fakeFetch((c) => (c.url.endsWith('/snapshots') ? snapshots : detail));
	const r = await run(['validate', '6109 10 00 10'], { fetch });
	assert.equal(r.code, 0);
	assert.match(r.stdout, /6109 10 00 10 {2}T-shirts of cotton/);
});

test('validate exits 1 on 404 and on a malformed code', async () => {
	const fetch = fakeFetch((c) => (c.url.endsWith('/snapshots') ? snapshots : notFound));
	const missing = await run(['validate', '6109100099'], { fetch });
	assert.equal(missing.code, 1);
	assert.match(missing.stderr, /No such code/);
	const bad = await run(['validate', '61']);
	assert.equal(bad.code, 1);
	assert.equal(bad.fetch.calls.length, 0);
});

test('validate exits 2 on other errors', async () => {
	const fetch = fakeFetch(() => ({ status: 401, body: { error: 'unauthorized', message: 'Bad key' } }));
	const r = await run(['validate', '6109100010'], { fetch });
	assert.equal(r.code, 2);
	assert.match(r.stderr, /Bad key/);
});

test('no key prints how to get one and exits 1', async () => {
	const r = await run(['classify', 'foo'], { env: {} });
	assert.equal(r.code, 1);
	assert.match(r.stderr, /https:\/\/hscode\.info\/en\/account/);
	assert.equal(r.fetch.calls.length, 0);
});

test('429 prints the API message and the pricing link', async () => {
	const fetch = fakeFetch(() => ({ status: 429, body: { error: 'quota', message: 'Daily quota used' } }));
	const r = await run(['classify', 'shirt'], { fetch });
	assert.equal(r.code, 1);
	assert.match(r.stderr, /Daily quota used/);
	assert.match(r.stderr, /Upgrade: https:\/\/hscode\.info\/en\/pricing/);
});

test('classify shows formatted code, third-country duty, confidence and disclaimer', async () => {
	const result = {
		goods_code: '6109100010',
		description: 'T-shirts of cotton',
		path: [],
		score: 0.9,
		confidence: 0.93,
		reasoning: null,
		duties: [{ origin_code: '1011', meas_type_code: '103', duty: '12.00 %', origin: 'Erga omnes' }]
	};
	const fetch = fakeFetch(() => ({ results: [result], disclaimer: 'Advisory only.' }));
	const r = await run(['classify', 'cotton', 't-shirt', '--accurate', '--lang', 'de'], { fetch });
	assert.equal(r.code, 0);
	assert.deepEqual(fetch.calls[0].body, { text: 'cotton t-shirt', mode: 'accurate', lang: 'de' });
	assert.match(r.stdout, /1\. {2}6109 10 00 10 {2}12\.00 % {2}0\.93 {2}T-shirts of cotton/);
	assert.match(r.stdout, /Advisory only\./);
});

test('--json prints the raw response', async () => {
	const fetch = fakeFetch((c) => (c.url.endsWith('/snapshots') ? snapshots : { items: [] }));
	const r = await run(['search', 'shirt', '--json'], { fetch });
	assert.deepEqual(JSON.parse(r.stdout), { items: [] });
});

test('batch writes CSV with a quoted comma and appends result columns', async () => {
	const file = join(mkdtempSync(join(tmpdir(), 'hscode-')), 'p.csv');
	writeFileSync(file, 'sku,description\nA1,"shirt, cotton"\nB2,"5"" nail"\nC3,\n');
	const fetch = fakeFetch((c) => ({
		items: c.body.items.map((i) => ({
			id: i.id,
			error: null,
			results: [
				{
					goods_code: i.text.startsWith('shirt') ? '6109100010' : '7317000000',
					description: `d, ${i.id}`,
					confidence: i.id === '0' ? 0.9 : null
				}
			]
		}))
	}));
	const r = await run(['batch', file, '--column', 'description'], { fetch });
	assert.equal(r.code, 0);
	assert.equal(fetch.calls.length, 1);
	assert.equal(fetch.calls[0].body.items.length, 2);
	assert.equal(
		r.stdout,
		'sku,description,hs_code,description,confidence\n' +
			'A1,"shirt, cotton",6109100010,"d, 0",0.9\n' +
			'B2,"5"" nail",7317000000,"d, 1",\n' +
			'C3,,,,\n'
	);
	assert.match(r.stderr, /Classified 3\/3/);
});

test('batch sends 25 rows per call', async () => {
	const file = join(mkdtempSync(join(tmpdir(), 'hscode-')), 'p.csv');
	writeFileSync(file, 'd\n' + Array.from({ length: 30 }, (_, i) => `item ${i}`).join('\n'));
	const fetch = fakeFetch((c) => ({ items: c.body.items.map((i) => ({ id: i.id, error: null, results: [] })) }));
	await run(['batch', file], { fetch });
	assert.deepEqual(fetch.calls.map((c) => c.body.items.length), [25, 5]);
});

test('help works without a key, per command too', async () => {
	const all = await run(['--help'], { env: {} });
	assert.equal(all.code, 0);
	assert.match(all.stdout, /classify/);
	const one = await run(['batch', '-h'], { env: {} });
	assert.equal(one.code, 0);
	assert.match(one.stdout, /--column/);
});

test('--version prints the package version', async () => {
	const r = await run(['--version']);
	assert.match(r.stdout, /^\d+\.\d+\.\d+/);
});
