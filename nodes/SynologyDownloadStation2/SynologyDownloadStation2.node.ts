import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { DsmApiError } from '../shared/DsmError';
import { executePerItem } from '../shared/NodeExecution';

const SAFE_API_PREFIXES = ['SYNO.DownloadStation2.', 'SYNO.DownloadStation.'];
const FORBIDDEN_METHOD_PATTERNS = [
	/^create$/i,
	/^add$/i,
	/^upload$/i,
	/^edit$/i,
	/^update$/i,
	/^set$/i,
	/^delete$/i,
	/^remove$/i,
	/^pause$/i,
	/^resume$/i,
	/^start$/i,
	/^stop$/i,
	/^clear$/i,
	/^clean$/i,
	/^move$/i,
	/^rename$/i,
	/^force_/i,
];

function parseJsonParam(value: unknown): IDataObject {
	if (!value) return {};
	if (typeof value === 'object') return value as IDataObject;
	try {
		return JSON.parse(String(value)) as IDataObject;
	} catch {
		return {};
	}
}

function isApiAllowed(api: string): boolean {
	return SAFE_API_PREFIXES.some((prefix) => api.startsWith(prefix));
}

function assertReadOnlyCustomCall(api: string, method: string): void {
	if (!isApiAllowed(api)) {
		throw new Error(
			`API not allowed in customReadCall: ${api}. Allowed prefixes: ${SAFE_API_PREFIXES.join(', ')}`,
		);
	}

	if (FORBIDDEN_METHOD_PATTERNS.some((pattern) => pattern.test(method))) {
		throw new Error(
			`Method blocked in customReadCall (potentially destructive): ${method}. Allowed scope is read-only only.`,
		);
	}
}

function rethrowWithDsmGuidance(error: unknown, api: string, method: string, version: number): never {
	if (!(error instanceof DsmApiError)) {
		throw error;
	}

	const code = Number(error.details?.code ?? -1);
	const base = `DSM call failed (${api}.${method} v${version})`;

	if (code === 407) {
		throw new Error(
			`${base} [code=407] Authentication is not completed (DSM policy / 2FA / challenge).`,
		);
	}

	if (code === 401) {
		throw new Error(
			`${base} [code=401] Unauthorized: check credentials, application permission and DSM policy.`,
		);
	}

	if ([102, 103, 105, 106, 107, 119].includes(code)) {
		throw new Error(`${base} [code=${code}] ${String(error.details?.mappedMessage || 'DSM error')}`);
	}

	throw error;
}

export class SynologyDownloadStation2 implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Download Station2',
		name: 'synologyDownloadStation2',
		icon: 'file:synology-downloadstation2.svg',
		group: ['transform'],
		version: 1,
		description: 'Read-first Download Station operations for Synology DSM',
		defaults: { name: 'Synology Download Station2' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listTasks',
				options: [
					{ name: 'List Tasks', value: 'listTasks' },
					{ name: 'Get Task', value: 'getTask' },
					{ name: 'List BT Search Results', value: 'listBtSearchResults' },
					{ name: 'List RSS Feeds', value: 'listRssFeeds' },
					{ name: 'Get Package Info', value: 'getPackageInfo' },
					{ name: 'Custom Read Call (Whitelisted)', value: 'customReadCall' },
				],
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['listTasks', 'listBtSearchResults', 'listRssFeeds'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 20,
				displayOptions: { show: { operation: ['listTasks', 'listBtSearchResults', 'listRssFeeds'] } },
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['getTask'] } },
			},
			{
				displayName: 'Keyword',
				name: 'keyword',
				type: 'string',
				default: '',
				description: 'Optional filter keyword for BT search listing',
				displayOptions: { show: { operation: ['listBtSearchResults'] } },
			},
			{
				displayName: 'API Name',
				name: 'api',
				type: 'string',
				default: 'SYNO.DownloadStation2.Task.List',
				required: true,
				description: 'Allowed: SYNO.DownloadStation2.* or SYNO.DownloadStation.*',
				displayOptions: { show: { operation: ['customReadCall'] } },
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				default: 'list',
				required: true,
				description: 'Read-only methods only. Destructive methods are blocked.',
				displayOptions: { show: { operation: ['customReadCall'] } },
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 1,
				required: true,
				displayOptions: { show: { operation: ['customReadCall'] } },
			},
			{
				displayName: 'Params (JSON)',
				name: 'paramsJson',
				type: 'json',
				default: '{}',
				displayOptions: { show: { operation: ['customReadCall'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listTasks') {
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				try {
					return await dsm.callAny(
						['SYNO.DownloadStation2.Task.List', 'SYNO.DownloadStation2.Task', 'SYNO.DownloadStation.Task'],
						['list', 'getinfo'],
						{ offset, limit },
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.DownloadStation2.Task.List', 'list', 2);
				}
			}

			if (operation === 'getTask') {
				const taskId = this.getNodeParameter('taskId', i) as string;
				try {
					return await dsm.callAny(
						['SYNO.DownloadStation2.Task', 'SYNO.DownloadStation2.Task.List', 'SYNO.DownloadStation.Task'],
						['get', 'list', 'getinfo'],
						{ id: taskId, taskid: taskId, additional: 'detail,transfer,file,tracker,peer' },
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.DownloadStation2.Task', 'get', 2);
				}
			}

			if (operation === 'listBtSearchResults') {
				const keyword = this.getNodeParameter('keyword', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				const params: IDataObject = { offset, limit };
				if (keyword) params.keyword = keyword;
				try {
					return await dsm.callAny(
						['SYNO.DownloadStation2.BTSearch', 'SYNO.DownloadStation.BTSearch'],
						['list', 'get'],
						params,
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.DownloadStation2.BTSearch', 'list', 1);
				}
			}

			if (operation === 'listRssFeeds') {
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				try {
					return await dsm.callAny(
						['SYNO.DownloadStation2.RSS.Feed', 'SYNO.DownloadStation.RSS.Feed', 'SYNO.DownloadStation.RSS.Site'],
						['list', 'get'],
						{ offset, limit },
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.DownloadStation2.RSS.Feed', 'list', 1);
				}
			}

			if (operation === 'getPackageInfo') {
				try {
					return await dsm.callAny(
						['SYNO.DownloadStation2.Package.Info', 'SYNO.DownloadStation.Info'],
						['get', 'getinfo'],
						{},
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.DownloadStation2.Package.Info', 'get', 2);
				}
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const version = this.getNodeParameter('version', i) as number;
			const paramsJson = parseJsonParam(this.getNodeParameter('paramsJson', i, {}));

			assertReadOnlyCustomCall(api, method);
			try {
				return await dsm.call(api, method, version, paramsJson);
			} catch (error) {
				rethrowWithDsmGuidance(error, api, method, version);
			}
		});
	}
}
