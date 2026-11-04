'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const nock = require('nock');
const zapier = require('zapier-platform-core');
const App = require('../index');

const appTester = zapier.createAppTester(App);
const authData = { apiKey: 'test-key' };
const api = () => nock('https://hscode.info', { reqheaders: { authorization: 'Bearer test-key' } });

test.afterEach(() => nock.cleanAll());

test('auth test calls snapshots', async () => {
  api().get('/api/v1/snapshots').reply(200, { langs: ['en'], latest: {}, snapshots: [] });
  const res = await appTester(App.authentication.test, { authData });
  assert.deepEqual(res.langs, ['en']);
});

test('auth test fails on 401', async () => {
  nock('https://hscode.info').get('/api/v1/snapshots').reply(401, { error: 'unauthorized', message: 'Bad key' });
  await assert.rejects(appTester(App.authentication.test, { authData }), /Bad key/);
});

test('classify posts and flattens top result', async () => {
  api()
    .post('/api/v1/classify', { text: 'frozen shrimp', mode: 'fast', lang: 'en' })
    .reply(200, { snapshot: '2025', mode: 'fast', results: [{ goods_code: '0306179200', description: 'Shrimps', score: 1 }], disclaimer: 'x' });
  const res = await appTester(App.creates.classify.operation.perform, {
    authData,
    inputData: { text: 'frozen shrimp' },
  });
  assert.equal(res.goods_code, '0306179200');
});

test('lookup normalizes code', async () => {
  api().get('/api/v1/en/latest/codes/0306179200').reply(200, { goods_code: '0306179200', description: 'Shrimps' });
  const res = await appTester(App.searches.lookup_code.operation.perform, {
    authData,
    inputData: { code: '0306 17 92 00' },
  });
  assert.equal(res[0].id, '0306179200');
});

test('search maps items', async () => {
  api().get('/api/v1/de/2024/search').query({ q: 'garnelen' }).reply(200, { items: [{ goods_code: '0306179200' }] });
  const res = await appTester(App.searches.search_codes.operation.perform, {
    authData,
    inputData: { query: 'garnelen', lang: 'de', year: '2024' },
  });
  assert.equal(res[0].id, '0306179200');
});

test('429 with Retry-After is throttled with that delay', async () => {
  nock('https://hscode.info').post('/api/v1/classify').reply(429, { error: 'quota', message: 'Plan quota exceeded' }, { 'Retry-After': '30', 'RateLimit-Remaining': '0' });
  await assert.rejects(
    appTester(App.creates.classify.operation.perform, { authData, inputData: { text: 'shrimp' } }),
    /ThrottledError.*"delay":30/
  );
});
