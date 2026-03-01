import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyGetStorageStats implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Get Storage Stats (AI Tool)',
		name: 'synologyGetStorageStatsAI',
		icon: 'file:synology.png',
		group: ['input'],
		version: 1,
		description: 'Get NAS storage capacity and usage — designed for AI Agents',
		defaults: { name: 'Synology Get Storage Stats' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Include Details',
				name: 'includeDetails',
				type: 'boolean',
				default: false,
				description: 'Return detailed storage breakdown by volume/partition',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const includeDetails = this.getNodeParameter('includeDetails', i, false) as boolean;

				// Call Synology API to get storage stats
				// Using SYNO.DiskIO or SYNO.Dsm.Storage or similar system info API
				const storageParams: IDataObject = {
					include_details: includeDetails ? 'true' : 'false',
				};

				const response = await dsm.callAny(
					[
						'SYNO.DiskIO.Status',
						'SYNO.Dsm.Volume',
						'SYNO.Core.Storage',
					],
					['get', 'list'],
					storageParams,
				);

				// Parse response to extract storage info
				let data: IDataObject = {};
				if (typeof response === 'object' && response !== null) {
					const resp = response as IDataObject;
					data = (resp.data as IDataObject) || resp;
				}
				const volumes: IDataObject[] = Array.isArray(data.volumes) ? 
					(data.volumes as IDataObject[]) : 
					[data];

				// Calculate totals
				let totalSize = 0;
				let usedSize = 0;
				const volumeDetails: IDataObject[] = [];

				volumes.forEach((volume: IDataObject) => {
					const size = (volume.total_size as number) || 0;
					const used = (volume.used_size as number) || 0;
					totalSize += size;
					usedSize += used;

					if (includeDetails) {
						volumeDetails.push({
							name: volume.name || volume.display_name || 'Unknown',
							total: size,
							used,
							free: size - used,
							percentUsed: size > 0 ? ((used / size) * 100).toFixed(2) : '0',
						});
					}
				});

				const availableSize = totalSize - usedSize;
				const percentUsed = totalSize > 0 ? ((usedSize / totalSize) * 100).toFixed(2) : '0';

				const result: IDataObject = {
					success: true,
					total: totalSize,
					used: usedSize,
					available: availableSize,
					percentUsed: parseFloat(percentUsed as string),
					status: percentUsed > '90' ? 'warning' : 'ok',
				};

				if (includeDetails && volumeDetails.length > 0) {
					result.volumes = volumeDetails;
				}

				returnData.push(result);
			} catch (error) {
				returnData.push({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					itemIndex: i,
				});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
