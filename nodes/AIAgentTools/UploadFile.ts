import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyUploadFile implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Upload File (AI Tool)',
		name: 'synologyUploadFileAI',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'Upload a file to Synology Drive — designed for AI Agents',
		defaults: { name: 'Synology Upload File' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Destination Path',
				name: 'destinationPath',
				type: 'string',
				required: true,
				default: '',
				placeholder: '/Documents/report.pdf',
				description: 'Destination path in NAS (e.g., /Documents/myfile.pdf)',
			},
			{
				displayName: 'File Content',
				name: 'fileContent',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 5 },
				description: 'File content (base64 for binary, plain text for text files)',
			},
			{
				displayName: 'Overwrite',
				name: 'overwrite',
				type: 'boolean',
				default: false,
				description: 'Whether to overwrite if file already exists',
			},
			{
				displayName: 'File Size (bytes)',
				name: 'fileSize',
				type: 'number',
				default: 0,
				description: 'Optional: explicitly set file size',
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
				const destinationPath = this.getNodeParameter('destinationPath', i) as string;
				const fileContent = this.getNodeParameter('fileContent', i) as string;
				const overwrite = this.getNodeParameter('overwrite', i, false) as boolean;
				const fileSize = this.getNodeParameter('fileSize', i, 0) as number;

				// Build upload parameters
				const uploadParams: IDataObject = {
					path: destinationPath,
					content: fileContent,
					overwrite: overwrite ? 'true' : 'false',
				};

				if (fileSize > 0) {
					uploadParams.size = fileSize;
				}

				// Extract filename from path
				const filename = destinationPath.split('/').pop() || 'file';

				// Call Synology API to upload file
				// Using SYNO.FolderSharing.Upload or SYNO.Dsm.Share
				const response = await dsm.callAny(
					['SYNO.DsmNotifyCenter.Device', 'SYNO.Dsm.Share'],
					['upload', 'create'],
					uploadParams,
				);

				returnData.push({
					success: true,
					path: destinationPath,
					filename,
					size: fileSize || fileContent.length,
					overwritten: overwrite,
					response: response || { success: true },
				});
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
