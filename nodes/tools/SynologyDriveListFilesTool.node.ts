import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyDriveListFilesTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Files',
		name: 'synologyDriveListFilesTool',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'List files in a Synology Drive folder',
		defaults: { name: 'Synology List Files' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Folder Path',
				name: 'path',
				type: 'string',
				required: true,
				default: '/',
				description: 'Folder path to list (e.g., /Documents)',
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				description: 'Include subfolders',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum files to return',
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
				const path = this.getNodeParameter('path', i, '/') as string;
				const recursive = this.getNodeParameter('recursive', i, false) as boolean;
				const limit = this.getNodeParameter('limit', i, 100) as number;

				const params: IDataObject = {
					path,
					recursive: recursive ? 'true' : 'false',
					limit,
				};

				const response = await dsm.callAny(
					['SYNO.Dsm.Share', 'SYNO.FolderSharing'],
					['list', 'get'],
					params,
				);

				const files = Array.isArray(response) ? response : 
					(typeof response === 'object' && response !== null) ? 
					((response as IDataObject).files as IDataObject[] | undefined) || [] : [];

				returnData.push({
					success: true,
					path,
					files,
					count: Array.isArray(files) ? files.length : 0,
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
