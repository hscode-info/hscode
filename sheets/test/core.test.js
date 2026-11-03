const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core.js');

test('normalizers', () => {
	assert.equal(C.normalizeMode(), 'fast');
	assert.equal(C.normalizeMode('Precise'), 'accurate');
	assert.throws(() => C.normalizeMode('slow'), /fast.*accurate/);
	assert.equal(C.normalizeLang(' DE '), 'de');
	assert.throws(() => C.normalizeLang('es'));
	assert.equal(C.normalizeText('  leather\n  shoes '), 'leather shoes');
	assert.throws(() => C.normalizeText('a'));
	assert.throws(() => C.normalizeText('x'.repeat(501)));
});

test('normalizeCode handles spaces, dots, CN8 and numbers that lost a leading zero', () => {
	assert.equal(C.normalizeCode('6109 10 00 10'), '6109100010');
	assert.equal(C.normalizeCode('6109.10.00.10'), '6109100010');
	assert.equal(C.normalizeCode('61091000'), '6109100000');
	assert.equal(C.normalizeCode(306179990), '0306179990');
	assert.equal(C.normalizeCode(6109100010), '6109100010');
	assert.throws(() => C.normalizeCode('1234'), (e) => e.code === 'invalid_code');
	assert.throws(() => C.normalizeCode('abc'));
});

test('cache keys are stable, case-insensitive on text and short', () => {
	const a = C.classifyCacheKey('Leather Shoes', 'fast', 'en');
	assert.equal(a, C.classifyCacheKey('leather shoes', 'fast', 'en'));
	assert.notEqual(a, C.classifyCacheKey('leather shoes', 'accurate', 'en'));
	assert.notEqual(a, C.classifyCacheKey('leather shoe', 'fast', 'en'));
	assert.notEqual(a, C.classifyCacheKey('leather shoes', 'fast', 'de'));
	assert.ok(C.classifyCacheKey('x'.repeat(500), 'fast', 'en').length < 60);
	assert.equal(C.lookupCacheKey('0101210000', 'en'), 'hs1:l:en:0101210000');
});

test('buildRequest', () => {
	const body = C.buildClassifyBody(['a b', 'c d'], 'fast', 'en');
	assert.deepEqual(body.items, [{ id: '0', text: 'a b' }, { id: '1', text: 'c d' }]);
	const r = C.buildRequest('classifyBatch', ' k1 ', { body });
	assert.equal(r.url, 'https://hscode.info/api/v1/classify/batch');
	assert.equal(r.method, 'POST');
	assert.equal(r.headers.Authorization, 'Bearer k1');
	assert.deepEqual(JSON.parse(r.body), body);
	const l = C.buildRequest('lookup', 'k', { code: '0101210000', lang: 'fr' });
	assert.equal(l.url, 'https://hscode.info/api/v1/fr/latest/codes/0101210000');
	assert.equal(l.body, undefined);
	assert.throws(() => C.buildRequest('lookup', '', {}), (e) => e.code === 'missing_api_key');
});

test('chunk splits at 25', () => {
	const sizes = C.chunk(Array.from({ length: 60 }, (_, i) => i), C.MAX_BATCH).map((c) => c.length);
	assert.deepEqual(sizes, [25, 25, 10]);
});

test('HTTP errors map to clear messages', () => {
	assert.throws(() => C.parseResponse(401, '{"error":"unauthorized","message":"x"}'), (e) => e.code === 'invalid_api_key');
	assert.throws(
		() => C.parseResponse(429, '{"error":"quota","message":"x"}', { 'retry-after': '120' }),
		(e) => e.code === 'quota_exceeded' && /Retry in 120 s/.test(e.message) && /pricing/.test(e.message)
	);
	assert.throws(
		() => C.parseResponse(429, '{}', new Map([['Retry-After', '5']])),
		(e) => e.code === 'quota_exceeded' && /pricing/.test(e.message)
	);
	assert.throws(() => C.parseResponse(429, ''), (e) => /Wait or upgrade/.test(e.message));
	assert.throws(() => C.parseResponse(400, '{"error":"bad","message":"too short"}'), /too short/);
	assert.throws(() => C.parseResponse(503, 'oops'), (e) => e.code === 'http_error');
	assert.throws(() => C.parseResponse(200, 'not json'), (e) => e.code === 'bad_response');
	assert.deepEqual(C.parseResponse(200, '{"a":1}'), { a: 1 });
});

test('parseClassifyBatch matches by id and reports row errors', () => {
	const res = {
		items: [
			{ id: '1', results: [], error: null },
			{ id: '0', results: [{ goods_code: '6403999990', description: 'Footwear', confidence: 0.9 }], error: null },
			{ id: '2', results: [], error: 'timeout' }
		]
	};
	const out = C.parseClassifyBatch(res, 4);
	assert.equal(out[0].value.code, '6403999990');
	assert.equal(out[1].error.code, 'no_match');
	assert.match(out[2].error.message, /timeout/);
	assert.equal(out[3].error.code, 'bad_response');
});

test('parseLookup: 404 is notFound, 200 is compacted, 429 throws', () => {
	assert.deepEqual(C.parseLookup(404, '{}'), { notFound: true });
	const detail = {
		goods_code: '0101210000',
		description: 'Pure-bred horses',
		hierarchy: [{}],
		duties: [{ goods_code: 'x', origin: 'ERGA OMNES', origin_code: '1011', duty: '0.00 %', meas_type_code: '103', legal_base: 'l' }]
	};
	assert.deepEqual(C.parseLookup(200, JSON.stringify(detail)), {
		description: 'Pure-bred horses',
		duties: [{ origin: 'ERGA OMNES', origin_code: '1011', duty: '0.00 %', meas_type_code: '103' }]
	});
	assert.throws(() => C.parseLookup(429, '{}'), (e) => e.code === 'quota_exceeded');
});

test('pickDuty', () => {
	const duties = [
		{ origin: 'ERGA OMNES', origin_code: '1011', duty: '12.00 %', meas_type_code: '103' },
		{ origin: 'Korea', origin_code: 'KR', duty: '0.00 %', meas_type_code: '142' },
		{ origin: 'China', origin_code: 'CN', duty: '5.00 %', meas_type_code: '142' }
	];
	assert.equal(C.pickDuty(duties), '12.00 %');
	assert.equal(C.pickDuty(duties, ''), '12.00 %');
	assert.equal(C.pickDuty(duties, 'kr'), '0.00 %');
	assert.equal(C.pickDuty(duties, 'China'), '5.00 %');
	assert.equal(C.pickDuty(duties, 'US'), '12.00 %');
	assert.throws(() => C.pickDuty([], undefined), (e) => e.code === 'no_duty');
});

test('mapGrid keeps shape', () => {
	assert.equal(C.mapGrid('a', (v) => v + '!'), 'a!');
	assert.deepEqual(C.mapGrid([['a', 'b'], ['c', 'd']], (v) => v + '!'), [['a!', 'b!'], ['c!', 'd!']]);
	assert.deepEqual(C.mapGrid(['a', 'b'], (v) => v + '!'), ['a!', 'b!']);
});

test('classify queue coalesces calls into batches of 25 and dedupes texts', async () => {
	const sent = [];
	const q = C.createClassifyQueue({
		delayMs: 1,
		send: async (body) => {
			sent.push(body);
			return { items: body.items.map((it) => ({ id: it.id, results: [{ goods_code: '00' + it.text, description: 'd', confidence: null }], error: null })) };
		}
	});
	const calls = [];
	for (let i = 0; i < 30; i++) calls.push(q.classify('item' + i, 'fast', 'en'));
	calls.push(q.classify('item0', 'fast', 'en'));
	calls.push(q.classify('other', 'accurate', 'en'));
	const out = await Promise.all(calls);
	assert.deepEqual(sent.map((b) => b.items.length).sort((a, b) => a - b), [1, 5, 25]);
	assert.equal(out[0].value.code, '00item0');
	assert.equal(out[30].value.code, '00item0');
	assert.equal(out[31].value.code, '00other');
});

test('classify queue turns a failed request into per-text errors', async () => {
	const q = C.createClassifyQueue({
		delayMs: 1,
		send: async () => {
			throw new C.HsError('quota_exceeded', 'Quota exceeded');
		}
	});
	const [a, b] = await Promise.all([q.classify('aa', 'fast', 'en'), q.classify('bb', 'fast', 'en')]);
	assert.equal(a.error.code, 'quota_exceeded');
	assert.equal(b.error.code, 'quota_exceeded');
});
