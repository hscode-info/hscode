export function fakeFetch(handler) {
	const calls = [];
	const fn = async (url, init = {}) => {
		const call = {
			url: String(url),
			method: init.method ?? 'GET',
			headers: init.headers ?? {},
			body: init.body ? JSON.parse(init.body) : undefined
		};
		calls.push(call);
		const out = handler(call);
		const { status = 200, body } = out && out.body !== undefined ? out : { body: out };
		return new Response(JSON.stringify(body), {
			status,
			headers: { 'content-type': 'application/json' }
		});
	};
	fn.calls = calls;
	return fn;
}

export const snapshots = { langs: ['en'], latest: { year: '2026', month: '10' }, snapshots: [] };
