import { DynamicTool } from '@langchain/core/tools';
import type { IDataObject, INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import {
	NodeConnectionTypes,
	NodeOperationError,
	nodeNameToToolName,
	tryToParseAlphanumericString,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyApiTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology API',
		name: 'synologyApiTool',
		icon: 'file:synology-api.png',
		group: ['output'],
		version: 1,
		description: 'Call any Synology DSM API',
		defaults: { name: 'Synology API' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
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

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try {
			tryToParseAlphanumericString(name);
		} catch (error) {
			throw new NodeOperationError(this.getNode(), 'Invalid tool name');
		}

		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let params: any = {};
				try {
					params = JSON.parse(input);
				} catch {
					return 'Error: Input must be valid JSON with {api, method, params, versionMode?}';
				}

				// Extract parameters
				const api = params.api || '';
				const method = params.method || '';
				const versionMode = params.versionMode || 'auto';
				const version = params.version || 1;
				const apiParams = typeof params.params === 'string' ? JSON.parse(params.params) : params.params || {};

				if (!api) return 'Error: api field is required (e.g., SYNO.API.Info)';
				if (!method) return 'Error: method field is required (e.g., query, get, list)';

				// Call the API
				const response = versionMode === 'auto'
					? await dsm.callAuto(api, method, apiParams)
					: await dsm.call(api, method, version, apiParams);

				// Format response for LLM
				if (typeof response === 'object') {
					// If response has lots of data, summarize
					const responseStr = JSON.stringify(response);
					if (responseStr.length > 500) {
						const keys = Object.keys(response).slice(0, 5).join(', ');
						return `✅ Response (keys: ${keys}): ${responseStr.substring(0, 200)}...`;
					}
					return `✅ ${JSON.stringify(response, null, 2)}`;
				}

				return `✅ ${response}`;
			} catch (error) {
				return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			}
		};

		const tool = new DynamicTool({
			name,
			description:
				'Call any Synology DSM API. Input: JSON with {api, method, params, versionMode?}. Example: {"api":"SYNO.API.Info","method":"query","params":{"query":"all"}}',
			func,
		});

		return { response: tool };
	}
}
