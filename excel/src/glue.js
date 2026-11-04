/*
 * Excel custom functions for hscode.info. Needs HsCore (core.js) in the same scope.
 * build.mjs concatenates core.js and this file into functions.js, which the manifest loads.
 */
(function () {
	'use strict';

	const KEY_NAME = 'hscode.apiKey';
	const WHERE = 'Open the HS Code task pane (Home > HS Code) and save your key';
	const memo = new Map(); // cache key -> { value, expires }
	const inflight = new Map(); // cache key -> Promise

	const getApiKey = () => OfficeRuntime.storage.getItem(KEY_NAME);

	async function send(kind, params) {
		const req = HsCore.buildRequest(kind, await getApiKey(), params, WHERE);
		let res;
		try {
			res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
		} catch (e) {
			throw new HsCore.HsError('network', 'Network error: could not reach hscode.info. Check your connection.');
		}
		return { status: res.status, text: await res.text(), headers: res.headers };
	}

	const queue = HsCore.createClassifyQueue({
		send: async (body) => {
			const res = await send('classifyBatch', { body: body });
			return HsCore.parseResponse(res.status, res.text, res.headers);
		}
	});

	function memoGet(key) {
		const hit = memo.get(key);
		if (!hit) return undefined;
		if (hit.expires < Date.now()) {
			memo.delete(key);
			return undefined;
		}
		return hit.value;
	}

	// Caches successful values for the TTL. Concurrent callers of the same key share one request.
	async function cached(key, produce) {
		const hit = memoGet(key);
		if (hit !== undefined) return { value: hit };
		if (inflight.has(key)) return inflight.get(key);
		const promise = produce().then((outcome) => {
			inflight.delete(key);
			if (outcome.value !== undefined) memo.set(key, { value: outcome.value, expires: Date.now() + HsCore.CACHE_TTL_SECONDS * 1000 });
			return outcome;
		});
		inflight.set(key, promise);
		return promise;
	}

	function lookup(code, lang) {
		return cached(HsCore.lookupCacheKey(code, lang), async () => {
			try {
				const res = await send('lookup', { code: code, lang: lang });
				return { value: HsCore.parseLookup(res.status, res.text, res.headers) };
			} catch (e) {
				return { error: e };
			}
		});
	}

	function classify(text, mode, lang) {
		return cached(HsCore.classifyCacheKey(text, mode, lang), () => queue.classify(text, mode, lang));
	}

	function cellError(e) {
		const E = CustomFunctions.ErrorCode;
		const soft = ['not_found', 'no_match', 'no_duty', 'quota_exceeded', 'classify_failed'];
		const code = e instanceof HsCore.HsError && soft.indexOf(e.code) >= 0 ? E.notAvailable : E.invalidValue;
		return new CustomFunctions.Error(code, HsCore.formatError(e));
	}

	const mapCells = (input, fn) => Promise.all(input.map((row) => Promise.all(row.map(fn))));
	const unknownCode = (code) => new HsCore.HsError('not_found', 'Unknown code "' + code + '". It is not in the latest EU tariff.');

	// Guards the whole call: bad mode or lang gives the same error in every cell.
	function guard(input, work) {
		return async function () {
			try {
				return await work();
			} catch (e) {
				return input.map((row) => row.map(() => cellError(e)));
			}
		};
	}

	async function HSCODE(text, mode, lang) {
		return guard(text, async () => {
			const m = HsCore.normalizeMode(mode);
			const l = HsCore.normalizeLang(lang);
			return mapCells(text, async (v) => {
				if (HsCore.isBlank(v)) return '';
				try {
					const outcome = await classify(HsCore.normalizeText(v), m, l);
					return outcome.error ? cellError(outcome.error) : outcome.value.code;
				} catch (e) {
					return cellError(e);
				}
			});
		})();
	}

	async function lookupCells(input, lang, render) {
		return guard(input, async () => {
			const l = HsCore.normalizeLang(lang);
			return mapCells(input, async (v) => {
				if (HsCore.isBlank(v)) return '';
				let code;
				try {
					code = HsCore.normalizeCode(v);
				} catch (e) {
					return render({ invalid: e });
				}
				const outcome = await lookup(code, l);
				return render({ code: code, outcome: outcome });
			});
		})();
	}

	const DESCRIPTION = (code, lang) =>
		lookupCells(code, lang, (c) => {
			if (c.invalid) return cellError(c.invalid);
			if (c.outcome.error) return cellError(c.outcome.error);
			if (c.outcome.value.notFound) return cellError(unknownCode(c.code));
			return c.outcome.value.description;
		});

	const DUTY = (code, origin) =>
		lookupCells(code, 'en', (c) => {
			if (c.invalid) return cellError(c.invalid);
			if (c.outcome.error) return cellError(c.outcome.error);
			if (c.outcome.value.notFound) return cellError(unknownCode(c.code));
			try {
				return HsCore.pickDuty(c.outcome.value.duties, origin);
			} catch (e) {
				return cellError(e);
			}
		});

	const VALID = (code) =>
		lookupCells(code, 'en', (c) => {
			if (c.invalid) return false;
			if (c.outcome.error) return cellError(c.outcome.error);
			return !c.outcome.value.notFound;
		});

	CustomFunctions.associate('CODE', HSCODE);
	CustomFunctions.associate('DESCRIPTION', DESCRIPTION);
	CustomFunctions.associate('DUTY', DUTY);
	CustomFunctions.associate('VALID', VALID);
})();
