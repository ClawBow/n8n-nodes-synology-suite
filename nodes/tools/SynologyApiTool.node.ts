import type { IDataObject, IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyApiTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology API',
		name: 'synologyApiTool',
		icon: 'file:synology-api.png',
		group: ['transform'],
		version: 1,
		description: 'Call any Synology DSM API',
		defaults: { name: 'Synology API' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'API Name',
				name: 'api',
				type: 'string',
				required: true,
				default: 'SYNO.API.Info',
				placeholder: 'SYNO.API.Info',
				description: 'Synology API name (e.g., SYNO.API.Info, SYNO.DiskIO.Status)',
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				required: true,
				default: 'query',
				placeholder: 'query',
				description: 'API method (e.g., query, get, list, create)',
			},
			{
				displayName: 'Version Mode',
				name: 'versionMode',
				type: 'options',
				default: 'auto',
				options: [
					{ name: 'Auto (Use API maxVersion)', value: 'auto' },
					{ name: 'Manual', value: 'manual' },
				],
				description: 'Use latest API version or specify manually',
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 1,
				placeholder: '1',
				description: 'API version number (if manual mode)',
				displayOptions: { show: { versionMode: ['manual'] } },
			},
			{
				displayName: 'Parameters (JSON)',
				name: 'params',
				type: 'string',
				default: '{"query":"all"}',
				placeholder: '{"query":"all"}',
				typeOptions: { rows: 4 },
				description: 'API parameters as JSON object',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const versionMode = this.getNodeParameter('versionMode', i) as string;
			const version = this.getNodeParameter('version', i) as number;
			let paramsInput = this.getNodeParameter('params', i) as string | IDataObject;

			if (!api) return { error: 'api field is required' };
			if (!method) return { error: 'method field is required' };

			let params: IDataObject = {};
			try {
				if (typeof paramsInput === 'string') {
					params = JSON.parse(paramsInput);
				} else {
					params = paramsInput;
				}
			} catch (e) {
				return { error: 'Invalid JSON in params' };
			}

			try {
				const response = versionMode === 'auto'
					? await dsm.callAuto(api, method, params)
					: await dsm.call(api, method, version, params);

				return { success: true, response };
			} catch (error) {
				return { error: error instanceof Error ? error.message : 'Unknown error' };
			}
		});
	}
}
