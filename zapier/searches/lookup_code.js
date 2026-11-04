'use strict';

const { BASE, normalizeCode, LANG_CHOICES } = require('../lib/common');

const perform = async (z, bundle) => {
  const { code, year, lang } = bundle.inputData;
  const res = await z.request({
    url: `${BASE}/api/v1/${lang || 'en'}/${year || 'latest'}/codes/${normalizeCode(code)}`,
  });
  const d = res.data;
  return [{ id: d.goods_code, ...d }];
};

module.exports = {
  key: 'lookup_code',
  noun: 'Code',
  display: { label: 'Look Up Code', description: 'Find description, hierarchy and duties of a 10-digit CN code.' },
  operation: {
    inputFields: [
      { key: 'code', label: 'Code', required: true, helpText: '10 digits. Spaces and dots are removed.' },
      { key: 'year', label: 'Year', default: 'latest', helpText: 'Four-digit snapshot year or "latest".' },
      { key: 'lang', label: 'Language', choices: LANG_CHOICES, default: 'en' },
    ],
    perform,
    sample: { id: '0306179200', goods_code: '0306179200', description: 'Frozen shrimps and prawns, peeled' },
  },
};
