import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyDriveUploadFileTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Upload File',
		name: 'synologyDriveUploadFileTool',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'Upload a file to Synology Drive',
		defaults: { name: 'Synology Upload File' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Destination Path',
				name: 'path',
				type: 'string',
				required: true,
				default: '',
				description: 'Destination path (e.g., /Documents/file.pdf)',
			},
			{
				displayName: 'File Content',
				name: 'fileContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 4 },
				description: 'File content (base64 for binary)',
			},
			{
				displayName: 'Overwrite',
				name: 'overwrite',
				type: 'boolean',
				default: false,
				description: 'Overwrite if file exists',
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
				const path = this.getNodeParameter('path', i) as string;
				const fileContent = this.getNodeParameter('fileContent', i) as string;
				const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;

				const params: IDataObject = {
					path,
					content: fileContent,
					overwrite: overwrite ? 'true' : 'false',
				};

				const response = await dsm.callAny(
					['SYNO.Dsm.Share', 'SYNO.FolderSharing'],
					['upload', 'create'],
					params,
				);

				returnData.push({
					success: true,
					path,
					message: 'File uploaded',
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
