'use strict';

const authentication = require('./authentication');
const classify = require('./creates/classify');
const lookupCode = require('./searches/lookup_code');
const searchCodes = require('./searches/search_codes');
const { version } = require('./package.json');
const platformVersion = require('zapier-platform-core').version;

const addAuth = (request, z, bundle) => {
  request.headers = request.headers || {};
  request.headers.Authorization = `Bearer ${bundle.authData.apiKey}`;
  request.headers.Accept = 'application/json';
  return request;
};

const handleErrors = (response, z) => {
  if (response.status >= 400) {
    let message = `hscode.info returned ${response.status}`;
    try {
      const body = response.data || JSON.parse(response.content);
      if (body && body.message) message = body.message;
    } catch (e) {
      // keep default message
    }
    if (response.status === 429) message = `Quota exceeded. ${message}`;
    throw new z.errors.Error(message, 'ApiError', response.status);
  }
  return response;
};

module.exports = {
  version,
  platformVersion,
  flags: { cleanInputData: false },
  authentication,
  beforeRequest: [addAuth],
  afterResponse: [handleErrors],
  creates: { [classify.key]: classify },
  searches: { [lookupCode.key]: lookupCode, [searchCodes.key]: searchCodes },
};
