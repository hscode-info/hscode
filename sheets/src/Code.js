/**
 * hscode.info custom functions for Google Sheets.
 * Pure logic lives in core.js (global HsCore). This file only talks to Apps Script services.
 */

var HSCODE_KEY_PROPERTY = 'HSCODE_API_KEY';
var HSCODE_KEY_HINT = 'Open the HS Code menu > Set API key';

// ---------------------------------------------------------------- menu and key

function onOpen() {
	SpreadsheetApp.getUi()
		.createMenu('HS Code')
		.addItem('Set API key...', 'showKeySidebar')
		.addToUi();
}

function onInstall() {
	onOpen();
}

function showKeySidebar() {
	var html = HtmlService.createHtmlOutputFromFile('Sidebar').setTitle('HS Code API key');
	SpreadsheetApp.getUi().showSidebar(html);
}

function getApiKey_() {
	return PropertiesService.getUserProperties().getProperty(HSCODE_KEY_PROPERTY);
}

/** Called from the sidebar. */
function saveApiKey(key) {
	var trimmed = String(key || '').trim();
	if (!trimmed) throw new Error('Paste your API key first.');
	PropertiesService.getUserProperties().setProperty(HSCODE_KEY_PROPERTY, trimmed);
	return getKeyStatus();
}

/** Called from the sidebar. */
function clearApiKey() {
	PropertiesService.getUserProperties().deleteProperty(HSCODE_KEY_PROPERTY);
	return getKeyStatus();
}

/** Called from the sidebar. Never returns the key itself. */
function getKeyStatus() {
	var key = getApiKey_();
	return { set: !!key, hint: key ? '...' + key.slice(-4) : '' };
}

/** Called from the sidebar. Uses one lookup of a known code. */
function testApiKey() {
	var res = lookupMany_(['0101210000'], 'en')['0101210000'];
	if (res.error) return res.error.message;
	return 'Key works.';
}

// ---------------------------------------------------------------- HTTP and cache

function fetchAll_(requests) {
	var params = requests.map(function (r) {
		var headers = {};
		var contentType;
		Object.keys(r.headers).forEach(function (name) {
			if (name.toLowerCase() === 'content-type') contentType = r.headers[name];
			else headers[name] = r.headers[name];
		});
		var p = { url: r.url, method: r.method.toLowerCase(), headers: headers, muteHttpExceptions: true };
		if (r.body !== undefined) p.payload = r.body;
		if (contentType) p.contentType = contentType;
		return p;
	});
	try {
		return UrlFetchApp.fetchAll(params).map(function (res) {
			return { status: res.getResponseCode(), text: res.getContentText(), headers: res.getHeaders() };
		});
	} catch (e) {
		throw new HsCore.HsError('network', 'Network error: ' + e.message);
	}
}

function cacheGetAll_(keys) {
	try {
		return CacheService.getUserCache().getAll(keys);
	} catch (e) {
		return {};
	}
}

function cachePutAll_(entries) {
	try {
		CacheService.getUserCache().putAll(entries, HsCore.CACHE_TTL_SECONDS);
	} catch (e) {
		// Cache is an optimisation. Ignore size or quota failures.
	}
}

/** Runs requests in parallel, parses each response, returns one {value}|{error} per request. */
function runRequests_(requests, parse) {
	var responses;
	try {
		responses = fetchAll_(requests);
	} catch (e) {
		return requests.map(function () {
			return { error: e };
		});
	}
	return responses.map(function (res) {
		try {
			return { value: parse(res) };
		} catch (e) {
			return { error: e };
		}
	});
}

// ---------------------------------------------------------------- resolvers

/** texts: normalized strings. Returns {cacheKey: {value}|{error}}. Throws if a key is needed and missing. */
function classifyMany_(texts, mode, lang) {
	var result = {};
	var keyOf = {};
	var unique = [];
	texts.forEach(function (text) {
		var key = HsCore.classifyCacheKey(text, mode, lang);
		if (!(key in keyOf)) {
			keyOf[key] = text;
			unique.push(key);
		}
	});
	var cached = cacheGetAll_(unique);
	var misses = [];
	unique.forEach(function (key) {
		if (cached[key]) result[key] = { value: JSON.parse(cached[key]) };
		else misses.push(key);
	});
	if (misses.length) {
		var apiKey = getApiKey_();
		var chunks = HsCore.chunk(misses, HsCore.MAX_BATCH);
		var requests = chunks.map(function (c) {
			var body = HsCore.buildClassifyBody(c.map(function (k) { return keyOf[k]; }), mode, lang);
			return HsCore.buildRequest('classifyBatch', apiKey, { body: body }, HSCODE_KEY_HINT);
		});
		var fresh = {};
		var batches = runRequests_(requests, function (res) {
			return HsCore.parseResponse(res.status, res.text, res.headers);
		});
		batches.forEach(function (batch, i) {
			var outcomes = batch.error
				? chunks[i].map(function () { return { error: batch.error }; })
				: HsCore.parseClassifyBatch(batch.value, chunks[i].length);
			outcomes.forEach(function (outcome, j) {
				result[chunks[i][j]] = outcome;
				if (outcome.value) fresh[chunks[i][j]] = JSON.stringify(outcome.value);
			});
		});
		cachePutAll_(fresh);
	}
	return result;
}

/** codes: 10-digit strings. Returns {code: {description, duties}|{notFound}|{error}}. */
function lookupMany_(codes, lang) {
	var result = {};
	var unique = [];
	codes.forEach(function (code) {
		if (unique.indexOf(code) < 0) unique.push(code);
	});
	var cached = cacheGetAll_(unique.map(function (c) { return HsCore.lookupCacheKey(c, lang); }));
	var misses = [];
	unique.forEach(function (code) {
		var hit = cached[HsCore.lookupCacheKey(code, lang)];
		if (hit) result[code] = JSON.parse(hit);
		else misses.push(code);
	});
	if (misses.length) {
		var apiKey = getApiKey_();
		var requests = misses.map(function (code) {
			return HsCore.buildRequest('lookup', apiKey, { code: code, lang: lang }, HSCODE_KEY_HINT);
		});
		var fresh = {};
		runRequests_(requests, function (res) {
			return HsCore.parseLookup(res.status, res.text, res.headers);
		}).forEach(function (outcome, i) {
			if (outcome.error) {
				result[misses[i]] = { error: outcome.error };
			} else {
				result[misses[i]] = outcome.value;
				fresh[HsCore.lookupCacheKey(misses[i], lang)] = JSON.stringify(outcome.value);
			}
		});
		cachePutAll_(fresh);
	}
	return result;
}

// ---------------------------------------------------------------- helpers

function first_(v) {
	while (Array.isArray(v)) v = v[0];
	return v;
}

/** Scalar input throws (cell shows #ERROR! with the message). Range input gets the message in the cell. */
function failer_(input) {
	return function (e) {
		var message = HsCore.formatError(e);
		if (!Array.isArray(input)) throw new Error(message);
		return '#ERROR: ' + message;
	};
}

function lookupCells_(input, lang, render) {
	var l = HsCore.normalizeLang(first_(lang));
	var fail = failer_(input);
	var prepared = [];
	HsCore.mapGrid(input, function (v) {
		if (HsCore.isBlank(v)) return prepared.push({ blank: true });
		try {
			prepared.push({ code: HsCore.normalizeCode(v), raw: v });
		} catch (e) {
			prepared.push({ invalid: e, raw: v });
		}
	});
	var codes = prepared.filter(function (p) { return p.code; }).map(function (p) { return p.code; });
	var found = codes.length ? lookupMany_(codes, l) : {};
	var i = 0;
	return HsCore.mapGrid(input, function () {
		var p = prepared[i++];
		if (p.blank) return '';
		if (p.invalid) return render({ invalid: p.invalid }, fail);
		return render({ code: p.code, res: found[p.code] }, fail);
	});
}

// ---------------------------------------------------------------- custom functions

/**
 * Returns the best EU Combined Nomenclature (CN/TARIC) code for a product description.
 * Pass a range to classify many rows at once; rows are sent in batches of 25.
 *
 * @param {string} text Product description, or a range of descriptions. Any language.
 * @param {string} mode Optional. "fast" (default, 1 unit) or "accurate" (5 units, slower).
 * @param {string} lang Optional. Language of the lookup: "en" (default), "de" or "fr".
 * @return {string} The 10-digit goods code, as text.
 * @customfunction
 */
function HSCODE(text, mode, lang) {
	var m = HsCore.normalizeMode(first_(mode));
	var l = HsCore.normalizeLang(first_(lang));
	var fail = failer_(text);
	var prepared = [];
	HsCore.mapGrid(text, function (v) {
		if (HsCore.isBlank(v)) return prepared.push({ blank: true });
		try {
			prepared.push({ text: HsCore.normalizeText(v) });
		} catch (e) {
			prepared.push({ error: e });
		}
	});
	var texts = prepared.filter(function (p) { return p.text; }).map(function (p) { return p.text; });
	var found = texts.length ? classifyMany_(texts, m, l) : {};
	var i = 0;
	return HsCore.mapGrid(text, function () {
		var p = prepared[i++];
		if (p.blank) return '';
		if (p.error) return fail(p.error);
		var outcome = found[HsCore.classifyCacheKey(p.text, m, l)];
		return outcome.error ? fail(outcome.error) : outcome.value.code;
	});
}

/**
 * Returns the official description of a CN/TARIC goods code.
 *
 * @param {string} code 10-digit goods code (8-digit CN codes are accepted), or a range of codes.
 * @param {string} lang Optional. "en" (default), "de" or "fr".
 * @return {string} The description of the code.
 * @customfunction
 */
function HSCODE_DESCRIPTION(code, lang) {
	return lookupCells_(code, lang, function (c, fail) {
		if (c.invalid) return fail(c.invalid);
		if (c.res.error) return fail(c.res.error);
		if (c.res.notFound) return fail(new HsCore.HsError('not_found', 'Unknown code "' + c.code + '". It is not in the latest EU tariff.'));
		return c.res.description;
	});
}

/**
 * Returns the import duty of a goods code: the third-country (erga omnes) duty, or the duty listed for an origin.
 * Advisory only.
 *
 * @param {string} code 10-digit goods code, or a range of codes.
 * @param {string} origin Optional. Country code such as "CN" or "US". Falls back to the third-country duty when the tariff lists nothing for that origin.
 * @return {string} The duty as listed in the tariff, for example "12.00 %".
 * @customfunction
 */
function HSCODE_DUTY(code, origin) {
	var o = first_(origin);
	return lookupCells_(code, 'en', function (c, fail) {
		if (c.invalid) return fail(c.invalid);
		if (c.res.error) return fail(c.res.error);
		if (c.res.notFound) return fail(new HsCore.HsError('not_found', 'Unknown code "' + c.code + '". It is not in the latest EU tariff.'));
		try {
			return HsCore.pickDuty(c.res.duties, o);
		} catch (e) {
			return fail(e);
		}
	});
}

/**
 * Checks whether a goods code exists in the latest EU tariff.
 *
 * @param {string} code 10-digit goods code, or a range of codes.
 * @return {boolean} TRUE if the code exists, FALSE if it is malformed or unknown.
 * @customfunction
 */
function HSCODE_VALID(code) {
	return lookupCells_(code, 'en', function (c, fail) {
		if (c.invalid) return false;
		if (c.res.error) return fail(c.res.error);
		return !c.res.notFound;
	});
}
