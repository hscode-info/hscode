'use strict';

const { BASE } = require('./lib/common');

// GET /api/v1/snapshots: spends no AI units (one lookup) and returns 401 on a bad key.
const test = (z, bundle) =>
  z.request({ url: `${BASE}/api/v1/snapshots` }).then((r) => r.data);

module.exports = {
  type: 'custom',
  fields: [
    {
      key: 'apiKey',
      label: 'API Key',
      type: 'password',
      required: true,
      helpText: 'Create a key on your [hscode.info account](https://hscode.info/en/account).',
    },
  ],
  test,
};
