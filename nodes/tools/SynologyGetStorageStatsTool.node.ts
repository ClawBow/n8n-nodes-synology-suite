import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyGetStorageStatsTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Get Storage Stats',
		name: 'synologyGetStorageStatsTool',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'Get NAS storage capacity and usage',
		defaults: { name: 'Synology Get Storage Stats' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const response = await dsm.callAny(
					['SYNO.DiskIO.Status', 'SYNO.Dsm.Volume', 'SYNO.Core.Storage'],
					['get', 'list'],
					{},
				);

				let totalSize = 0;
				let usedSize = 0;

				if (typeof response === 'object' && response !== null) {
					const data = response as IDataObject;
					const volumes = Array.isArray(data.volumes) ? (data.volumes as IDataObject[]) : [data];

					volumes.forEach((volume: IDataObject) => {
						const size = (volume.total_size as number) || 0;
						const used = (volume.used_size as number) || 0;
						totalSize += size;
						usedSize += used;
					});
				}

				const availableSize = totalSize - usedSize;
				const percentUsed = totalSize > 0 ? ((usedSize / totalSize) * 100).toFixed(2) : '0';

				returnData.push({
					success: true,
					total: totalSize,
					used: usedSize,
					available: availableSize,
					percentUsed: parseFloat(percentUsed as string),
					status: parseFloat(percentUsed as string) > 90 ? 'warning' : 'ok',
				});
			} catch (error) {
				returnData.push({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
