'use strict';

const { BASE, LANG_CHOICES } = require('../lib/common');

const perform = async (z, bundle) => {
  const { query, year, lang } = bundle.inputData;
  const res = await z.request({
    url: `${BASE}/api/v1/${lang || 'en'}/${year || 'latest'}/search`,
    params: { q: query },
  });
  return (res.data.items || []).map((item) => ({ id: item.goods_code, ...item }));
};

module.exports = {
  key: 'search_codes',
  noun: 'Code',
  display: { label: 'Search Codes', description: 'Search CN codes by words, in any language.' },
  operation: {
    inputFields: [
      { key: 'query', label: 'Query', required: true },
      { key: 'year', label: 'Year', default: 'latest' },
      { key: 'lang', label: 'Language', choices: LANG_CHOICES, default: 'en' },
    ],
    perform,
    sample: { id: '0306179200', goods_code: '0306179200', description: 'Frozen shrimps and prawns, peeled' },
  },
};
