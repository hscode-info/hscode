'use strict';

const BASE = 'https://hscode.info';

const normalizeCode = (code) => {
  const digits = String(code).replace(/[\s.]/g, '');
  if (!/^\d{10}$/.test(digits)) {
    throw new Error(`Goods code must have 10 digits, got "${code}".`);
  }
  return digits;
};

const LANG_CHOICES = { en: 'English', de: 'German', fr: 'French' };

module.exports = { BASE, normalizeCode, LANG_CHOICES };
