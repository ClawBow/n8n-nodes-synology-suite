import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyApi implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology API',
		name: 'synologyApi',
		icon: 'file:synology.png',
		group: ['transform'],
		version: 1,
		description: 'Generic Synology DSM API caller (covers all DSM APIs)',
		defaults: { name: 'Synology API' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.API.Info', required: true },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'query', required: true },
			{
				displayName: 'Version Mode',
				name: 'versionMode',
				type: 'options',
				default: 'auto',
				options: [
					{ name: 'Auto (Use API maxVersion)', value: 'auto' },
					{ name: 'Manual', value: 'manual' },
				],
			},
			{
				displayName: 'Version',
				name: 'version',
				type: 'number',
				default: 1,
				required: true,
				displayOptions: { show: { versionMode: ['manual'] } },
			},
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{"query":"all"}' },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const versionMode = this.getNodeParameter('versionMode', i) as string;
			const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;

			return versionMode === 'auto'
				? dsm.callAuto(api, method, paramsJson || {})
				: dsm.call(api, method, this.getNodeParameter('version', i) as number, paramsJson || {});
		});
	}
}
