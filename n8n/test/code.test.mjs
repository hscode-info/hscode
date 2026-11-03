import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { normalizeCode, Hscode } = require('../dist/nodes/Hscode/Hscode.node.js');
const { HscodeApi } = require('../dist/credentials/HscodeApi.credentials.js');

test('normalizeCode strips spaces and dots', () => {
	assert.equal(normalizeCode('0306 17.92 00'), '0306179200');
	assert.throws(() => normalizeCode('1234'));
});
test('node exposes expected operations', () => {
	const ops = new Hscode().description.properties.filter((p) => p.name === 'operation').flatMap((p) => p.options.map((o) => o.value));
	assert.deepEqual(ops.sort(), ['classify', 'classifyBatch', 'history', 'lookup', 'search', 'validate']);
});
test('credential tests /api/v1/snapshots', () => {
	assert.equal(new HscodeApi().test.request.url, '/api/v1/snapshots');
});
