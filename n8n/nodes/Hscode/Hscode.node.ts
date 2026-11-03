import type {
	IDataObject,
	IExecuteFunctions,
	IHttpRequestOptions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeApiError, NodeOperationError } from 'n8n-workflow';

const LANGS = [
	{ name: 'English', value: 'en' },
	{ name: 'German', value: 'de' },
	{ name: 'French', value: 'fr' },
];
const MODES = [
	{ name: 'Fast (1 AI Unit)', value: 'fast' },
	{ name: 'Accurate (5 AI Units)', value: 'accurate' },
];

export function normalizeCode(code: string): string {
	const digits = String(code).replace(/[\s.]/g, '');
	if (!/^\d{10}$/.test(digits)) {
		throw new Error(`Goods code must have 10 digits, got "${code}".`);
	}
	return digits;
}

const show = (...operation: string[]) => ({ show: { resource: ['code'], operation } });
const showClassify = (...operation: string[]) => ({ show: { resource: ['classification'], operation } });

export class Hscode implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'hscode.info',
		name: 'hscode',
		icon: 'file:hscode.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		description: 'Classify products into EU customs CN codes and look up codes and duties',
		defaults: { name: 'hscode.info' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [{ name: 'hscodeApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Classification', value: 'classification' },
					{ name: 'Code', value: 'code' },
				],
				default: 'classification',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['classification'] } },
				options: [
					{ name: 'Classify Product', value: 'classify', action: 'Classify a product', description: 'Find the CN code for a product description' },
					{ name: 'Classify Batch', value: 'classifyBatch', action: 'Classify up to 25 products', description: 'Classify the incoming items in one request, up to 25' },
				],
				default: 'classify',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: { show: { resource: ['code'] } },
				options: [
					{ name: 'Look Up', value: 'lookup', action: 'Look up a code', description: 'Description, hierarchy and duties of a code' },
					{ name: 'Search', value: 'search', action: 'Search codes', description: 'Search codes by words' },
					{ name: 'Duty History', value: 'history', action: 'Get duty history', description: 'Third-country duty in every yearly snapshot' },
					{ name: 'Validate', value: 'validate', action: 'Validate a code', description: 'Check whether a code exists in a snapshot' },
				],
				default: 'lookup',
			},
			{
				displayName: 'Product Description',
				name: 'text',
				type: 'string',
				default: '',
				required: true,
				placeholder: 'frozen shrimp, peeled',
				description: '2 to 500 characters, any language',
				displayOptions: showClassify('classify'),
			},
			{
				displayName: 'Description Field',
				name: 'textField',
				type: 'string',
				default: 'description',
				required: true,
				description: 'Name of the input field holding the product description for each item (max 25 items)',
				displayOptions: showClassify('classifyBatch'),
			},
			{
				displayName: 'ID Field',
				name: 'idField',
				type: 'string',
				default: '',
				description: 'Optional input field copied to the batch item id, returned unchanged. Defaults to the item index.',
				displayOptions: showClassify('classifyBatch'),
			},
			{
				displayName: 'Mode',
				name: 'mode',
				type: 'options',
				options: MODES,
				default: 'fast',
				displayOptions: showClassify('classify', 'classifyBatch'),
			},
			{
				displayName: 'Language',
				name: 'lang',
				type: 'options',
				options: LANGS,
				default: 'en',
				displayOptions: { show: { resource: ['classification', 'code'], operation: ['classify', 'classifyBatch', 'lookup', 'search', 'history'] } },
			},
			{
				displayName: 'Code',
				name: 'code',
				type: 'string',
				default: '',
				required: true,
				placeholder: '0306 17 92 00',
				description: '10-digit goods code. Spaces and dots are removed.',
				displayOptions: show('lookup', 'history', 'validate'),
			},
			{
				displayName: 'Query',
				name: 'query',
				type: 'string',
				default: '',
				required: true,
				displayOptions: show('search'),
			},
			{
				displayName: 'Year',
				name: 'year',
				type: 'string',
				default: 'latest',
				description: 'Four-digit snapshot year or "latest"',
				displayOptions: show('lookup', 'search', 'validate'),
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const credentials = await this.getCredentials('hscodeApi');
		const baseUrl = String(credentials.baseUrl || 'https://hscode.info').replace(/\/+$/, '');
		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;
		const out: INodeExecutionData[] = [];

		const call = async (
			method: 'GET' | 'POST',
			path: string,
			opts: { qs?: IDataObject; body?: IDataObject } = {},
		): Promise<IDataObject> => {
			const options: IHttpRequestOptions = {
				method,
				url: baseUrl + path,
				qs: opts.qs,
				body: opts.body,
				json: true,
			};
			return (await this.helpers.httpRequestWithAuthentication.call(
				this,
				'hscodeApi',
				options,
			)) as IDataObject;
		};

		if (operation === 'classifyBatch') {
			const textField = this.getNodeParameter('textField', 0) as string;
			const idField = this.getNodeParameter('idField', 0) as string;
			if (items.length > 25) {
				throw new NodeOperationError(this.getNode(), 'Batch classification accepts at most 25 items.');
			}
			const batch = items.map((item, i) => {
				const entry: IDataObject = { text: String(item.json[textField] ?? '') };
				entry.id = String(idField ? (item.json[idField] ?? i) : i);
				return entry;
			});
			try {
				const res = await call('POST', '/api/v1/classify/batch', {
					body: {
						items: batch,
						mode: this.getNodeParameter('mode', 0),
						lang: this.getNodeParameter('lang', 0),
					},
				});
				const results = (res.items as IDataObject[]) ?? [];
				for (const r of results) out.push({ json: r });
			} catch (error) {
				throw new NodeApiError(this.getNode(), error as never);
			}
			return [out];
		}

		for (let i = 0; i < items.length; i++) {
			try {
				let json: IDataObject;
				const lang = (): string => this.getNodeParameter('lang', i) as string;
				const year = (): string => (this.getNodeParameter('year', i) as string) || 'latest';
				const code = (): string => {
					try {
						return normalizeCode(this.getNodeParameter('code', i) as string);
					} catch (e) {
						throw new NodeOperationError(this.getNode(), (e as Error).message, { itemIndex: i });
					}
				};
				if (operation === 'classify') {
					json = await call('POST', '/api/v1/classify', {
						body: {
							text: this.getNodeParameter('text', i),
							mode: this.getNodeParameter('mode', i),
							lang: lang(),
						},
					});
				} else if (operation === 'lookup') {
					json = await call('GET', `/api/v1/${lang()}/${year()}/codes/${code()}`);
				} else if (operation === 'history') {
					json = await call('GET', `/api/v1/${lang()}/latest/codes/${code()}`, { qs: { history: 'true' } });
				} else if (operation === 'search') {
					json = await call('GET', `/api/v1/${lang()}/${year()}/search`, {
						qs: { q: this.getNodeParameter('query', i) as string },
					});
				} else if (operation === 'validate') {
					const c = code();
					try {
						const res = await call('GET', `/api/v1/en/${year()}/codes/${c}`);
						json = { valid: true, goods_code: res.goods_code, description: res.description };
					} catch (error) {
						const status = (error as { httpCode?: string; statusCode?: number }).httpCode
							?? String((error as { statusCode?: number }).statusCode);
						if (status !== '404') throw error;
						json = { valid: false, goods_code: c };
					}
				} else {
					throw new NodeOperationError(this.getNode(), `Unknown operation ${operation}`, { itemIndex: i });
				}
				out.push({ json, pairedItem: { item: i } });
			} catch (error) {
				if (this.continueOnFail()) {
					out.push({ json: { error: (error as Error).message }, pairedItem: { item: i } });
					continue;
				}
				if (error instanceof NodeOperationError) throw error;
				throw new NodeApiError(this.getNode(), error as never, { itemIndex: i });
			}
		}
		void resource;
		return [out];
	}
}
