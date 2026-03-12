import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { DsmApiError } from '../shared/DsmError';
import { executePerItem } from '../shared/NodeExecution';

const SAFE_API_PREFIXES = ['SYNO.SecurityAdvisor.', 'SYNO.LogCenter.'];
const FORBIDDEN_METHOD_PATTERNS = [
	/^create$/i,
	/^update$/i,
	/^set$/i,
	/^delete$/i,
	/^remove$/i,
	/^start$/i,
	/^stop$/i,
	/^restart$/i,
	/^write$/i,
	/^run$/i,
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

	if (code === 114) {
		throw new Error(
			`${base} [code=114] DSM returned an unmapped/unknown error code. Check DSM logs and raw error details.`,
		);
	}

	if (code === 407) {
		throw new Error(
			`${base} [code=407] Authentication is not completed (DSM security policy / 2FA / app permission).`,
		);
	}

	if ([103, 104, 105, 106, 107, 119].includes(code)) {
		throw new Error(`${base} [code=${code}] ${String(error.details?.mappedMessage || 'DSM error')}`);
	}

	throw error;
}

export class SynologySecurityObservability implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Security Observability',
		name: 'synologySecurityObservability',
		icon: 'file:synology-security-observability.png',
		group: ['transform'],
		version: 1,
		description: 'Read-only Security Advisor / LogCenter observability operations for Synology DSM',
		defaults: { name: 'Synology Security Observability' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'getLoginActivityUser',
				options: [
					{ name: 'Get Login Activity User', value: 'getLoginActivityUser' },
					{ name: 'Custom Read Call (Whitelisted)', value: 'customReadCall' },
				],
			},
			{
				displayName: 'User Name',
				name: 'userName',
				type: 'string',
				default: '',
				description: 'Optional filter by DSM user name',
				displayOptions: { show: { operation: ['getLoginActivityUser'] } },
			},
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				displayOptions: { show: { operation: ['getLoginActivityUser'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				displayOptions: { show: { operation: ['getLoginActivityUser'] } },
			},
			{
				displayName: 'API Name',
				name: 'api',
				type: 'string',
				default: 'SYNO.SecurityAdvisor.LoginActivity.User',
				required: true,
				description: 'Allowed: SYNO.SecurityAdvisor.* or SYNO.LogCenter.*',
				displayOptions: { show: { operation: ['customReadCall'] } },
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				default: 'get',
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

			if (operation === 'getLoginActivityUser') {
				const userName = this.getNodeParameter('userName', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				const params: IDataObject = { offset, limit };
				if (userName) params.username = userName;

				try {
					return await dsm.call('SYNO.SecurityAdvisor.LoginActivity.User', 'get', 1, params);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.SecurityAdvisor.LoginActivity.User', 'get', 1);
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
