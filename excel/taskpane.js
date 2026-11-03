/* global Office, OfficeRuntime, HsCore */
const KEY_NAME = 'hscode.apiKey';
const $ = (id) => document.getElementById(id);

function show(text, isError) {
	$('msg').textContent = text;
	$('msg').className = isError ? 'err' : '';
}

async function refresh() {
	const key = await OfficeRuntime.storage.getItem(KEY_NAME);
	$('status').textContent = key ? 'A key is saved (...' + key.slice(-4) + ').' : 'No key saved.';
}

async function testKey() {
	const key = await OfficeRuntime.storage.getItem(KEY_NAME);
	const req = HsCore.buildRequest('lookup', key, { code: '0101210000', lang: 'en' });
	const res = await fetch(req.url, { method: req.method, headers: req.headers });
	HsCore.parseLookup(res.status, await res.text(), res.headers);
}

function attempt(fn, okMessage) {
	return async () => {
		show('Working...');
		try {
			await fn();
			await refresh();
			show(okMessage);
		} catch (e) {
			show(e instanceof HsCore.HsError ? e.message : 'Could not reach hscode.info: ' + e.message, true);
		}
	};
}

Office.onReady(() => {
	refresh();
	show('');
	$('save').onclick = attempt(async () => {
		const value = $('key').value.trim();
		if (!value) throw new HsCore.HsError('missing_api_key', 'Paste your API key first.');
		await OfficeRuntime.storage.setItem(KEY_NAME, value);
		$('key').value = '';
	}, 'Saved.');
	$('clear').onclick = attempt(() => OfficeRuntime.storage.removeItem(KEY_NAME), 'Removed.');
	$('test').onclick = attempt(testKey, 'Key works.');
});
