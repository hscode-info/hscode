'use strict';

const { BASE, LANG_CHOICES } = require('../lib/common');

const perform = async (z, bundle) => {
  const { text, mode, lang } = bundle.inputData;
  const res = await z.request({
    method: 'POST',
    url: `${BASE}/api/v1/classify`,
    body: { text, mode: mode || 'fast', lang: lang || 'en' },
  });
  const data = res.data;
  const top = (data.results || [])[0] || {};
  // Top match is flattened so it can be mapped without a loop.
  return {
    id: `${data.snapshot || ''}:${top.goods_code || 'none'}:${Date.now()}`,
    goods_code: top.goods_code,
    description: top.description,
    confidence: top.confidence,
    reasoning: top.reasoning,
    score: top.score,
    snapshot: data.snapshot,
    mode: data.mode,
    results: data.results,
    disclaimer: data.disclaimer,
  };
};

module.exports = {
  key: 'classify',
  noun: 'Classification',
  display: {
    label: 'Classify Product',
    description: 'Find the EU CN code for a product description.',
  },
  operation: {
    inputFields: [
      { key: 'text', label: 'Product Description', required: true, helpText: '2 to 500 characters, any language.' },
      { key: 'mode', label: 'Mode', choices: { fast: 'Fast (1 AI unit)', accurate: 'Accurate (5 AI units)' }, default: 'fast' },
      { key: 'lang', label: 'Language', choices: LANG_CHOICES, default: 'en' },
    ],
    perform,
    sample: {
      id: '2025:0306179200:1',
      goods_code: '0306179200',
      description: 'Frozen shrimps and prawns, peeled',
      confidence: 0.9,
      snapshot: '2025',
      mode: 'fast',
    },
  },
};
