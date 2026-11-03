import { HscodeError } from './errors.js';
import type { components, paths } from './schema.js';

type Schemas = components['schemas'];
type Json<R> = R extends { content: { 'application/json': infer J } } ? J : never;
type Ok<P extends keyof paths, M extends keyof paths[P]> = paths[P][M] extends {
	responses: { 200: infer R };
}
	? Json<R>
	: never;

export type Lang = NonNullable<Schemas['ClassifyRequest']['lang']>;
export type Mode = NonNullable<Schemas['ClassifyRequest']['mode']>;
export type ClassifyResponse = Schemas['ClassifyResponse'];
export type ClassifyResult = Schemas['ClassifyResult'];
export type ClassifyBatchResponse = Schemas['ClassifyBatchResponse'];
export type ClassifyBatchItem = Schemas['ClassifyBatchItem'];
export type CodeDetail = Schemas['CodeDetail'];
export type ImportDuty = Schemas['ImportDutyItem'];
export type SnapshotsResponse = Ok<'/api/v1/snapshots', 'get'>;
export type SearchResponse = Ok<'/api/v1/{lang}/{year}/search', 'get'>;
export type DutiesResponse = Ok<'/api/v1/{year}/duties/{goodsCode}', 'get'>;
export type ChaptersResponse = Ok<'/api/v1/{lang}/{year}/chapters', 'get'>;
export type ChapterResponse = Ok<'/api/v1/{lang}/{year}/chapters/{chapter}', 'get'>;

export type BatchItemInput = NonNullable<
	paths['/api/v1/classify/batch']['post']['requestBody']
>['content']['application/json']['items'][number];

export interface ClientOptions {
	apiKey?: string;
	baseUrl?: string;
	fetch?: typeof fetch;
}

interface RequestOptions {
	query?: Record<string, string | undefined>;
	body?: unknown;
	signal?: AbortSignal;
}

interface Signal {
	signal?: AbortSignal;
}

const invalid = (message: string) => new HscodeError(0, 'invalid_request', message);

export function normalizeCode(code: string): string {
	const digits = String(code).replace(/[\s.]/g, '');
	if (!/^\d{10}$/.test(digits)) {
		throw invalid(`Goods code must have 10 digits, got "${code}".`);
	}
	return digits;
}

export function createClient(options: ClientOptions = {}) {
	const baseUrl = (options.baseUrl ?? 'https://hscode.info').replace(/\/+$/, '');
	const apiKey = options.apiKey ?? process.env.HSCODE_KEY;
	const doFetch = options.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

	async function request<T>(
		method: 'GET' | 'POST',
		path: string,
		{ query, body, signal }: RequestOptions = {}
	): Promise<T> {
		if (!apiKey) {
			throw new HscodeError(0, 'missing_api_key', 'No API key. Pass apiKey or set HSCODE_KEY.');
		}
		const url = new URL(baseUrl + path);
		for (const [key, value] of Object.entries(query ?? {})) {
			if (value !== undefined) url.searchParams.set(key, value);
		}
		const headers: Record<string, string> = {
			authorization: `Bearer ${apiKey}`,
			accept: 'application/json'
		};
		if (body !== undefined) headers['content-type'] = 'application/json';
		const res = await doFetch(url, {
			method,
			headers,
			body: body === undefined ? undefined : JSON.stringify(body),
			signal
		});
		const data: unknown = await res.json().catch(() => null);
		if (!res.ok) {
			const err = (data ?? {}) as Partial<Schemas['ApiError']>;
			throw new HscodeError(
				res.status,
				err.error ?? 'http_error',
				err.message ?? `Request failed with status ${res.status}.`
			);
		}
		return data as T;
	}

	const yearOf = (year?: string) => year ?? 'latest';

	async function lookup(input: {
		code: string;
		lang?: Lang;
		year?: string;
		history?: boolean;
	} & Signal) {
		const code = normalizeCode(input.code);
		const year = yearOf(input.year);
		return request<CodeDetail>('GET', `/api/v1/${input.lang ?? 'en'}/${year}/codes/${code}`, {
			query: { history: input.history ? 'true' : undefined },
			signal: input.signal
		});
	}

	return {
		classify: (input: { text: string; mode?: Mode; lang?: Lang } & Signal) =>
			request<ClassifyResponse>('POST', '/api/v1/classify', {
				body: { text: input.text, mode: input.mode, lang: input.lang },
				signal: input.signal
			}),

		classifyBatch: (input: { items: BatchItemInput[]; mode?: Mode; lang?: Lang } & Signal) =>
			request<ClassifyBatchResponse>('POST', '/api/v1/classify/batch', {
				body: { items: input.items, mode: input.mode, lang: input.lang },
				signal: input.signal
			}),

		lookup,

		history: (input: { code: string; lang?: Lang; year?: string } & Signal) =>
			lookup({ ...input, history: true }),

		search: async (input: { query: string; lang?: Lang; year?: string } & Signal) => {
			const year = yearOf(input.year);
			return request<SearchResponse>('GET', `/api/v1/${input.lang ?? 'en'}/${year}/search`, {
				query: { q: input.query },
				signal: input.signal
			});
		},

		duties: async (input: { code: string; year?: string } & Signal) => {
			const code = normalizeCode(input.code);
			const year = yearOf(input.year);
			return request<DutiesResponse>('GET', `/api/v1/${year}/duties/${code}`, {
				signal: input.signal
			});
		},

		chapters: async (input: { lang?: Lang; year?: string } & Signal = {}) => {
			const year = yearOf(input.year);
			return request<ChaptersResponse>('GET', `/api/v1/${input.lang ?? 'en'}/${year}/chapters`, {
				signal: input.signal
			});
		},

		chapter: async (input: { chapter: string; lang?: Lang; year?: string } & Signal) => {
			const chapter = String(input.chapter);
			if (!/^\d{2}$/.test(chapter)) throw invalid(`Chapter must have 2 digits, got "${chapter}".`);
			const year = yearOf(input.year);
			return request<ChapterResponse>(
				'GET',
				`/api/v1/${input.lang ?? 'en'}/${year}/chapters/${chapter}`,
				{ signal: input.signal }
			);
		},

		snapshots: (input: Signal = {}) =>
			request<SnapshotsResponse>('GET', '/api/v1/snapshots', { signal: input.signal })
	};
}

export type Client = ReturnType<typeof createClient>;
