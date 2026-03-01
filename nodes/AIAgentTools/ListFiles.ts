import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyListFiles implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Files (AI Tool)',
		name: 'synologyListFilesAI',
		icon: 'file:synology.png',
		group: ['input'],
		version: 1,
		description: 'List files in a Synology Drive folder — designed for AI Agents',
		defaults: { name: 'Synology List Files' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Folder Path',
				name: 'folderPath',
				type: 'string',
				required: true,
				placeholder: '/Documents',
				default: '/',
				description: 'Folder path to list (e.g., /Documents, /Photos)',
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				description: 'Include subfolders in results',
			},
			{
				displayName: 'Sort By',
				name: 'sortBy',
				type: 'options',
				default: 'name',
				options: [
					{ name: 'Name', value: 'name' },
					{ name: 'Modified Date', value: 'date' },
					{ name: 'Size', value: 'size' },
				],
				description: 'Sort results by this field',
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum number of files to return',
			},
			{
				displayName: 'Include Hidden Files',
				name: 'includeHidden',
				type: 'boolean',
				default: false,
				description: 'Show hidden files (starting with .)',
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
				const folderPath = this.getNodeParameter('folderPath', i, '/') as string;
				const recursive = this.getNodeParameter('recursive', i, false) as boolean;
				const sortBy = this.getNodeParameter('sortBy', i, 'name') as string;
				const limit = this.getNodeParameter('limit', i, 100) as number;
				const includeHidden = this.getNodeParameter('includeHidden', i, false) as boolean;

				// Build list parameters
				const listParams: IDataObject = {
					path: folderPath,
					recursive: recursive ? 'true' : 'false',
					sort_by: sortBy,
					limit,
					hidden: includeHidden ? 'true' : 'false',
				};

				// Call Synology API to list files
				// Using SYNO.FolderSharing or SYNO.Dsm.Share
				const response = await dsm.callAny(
					['SYNO.Dsm.Share', 'SYNO.FolderSharing'],
					['list', 'get'],
					listParams,
				);

				// Extract files from response
				let files: IDataObject[] = [];
				if (Array.isArray(response)) {
					files = response as IDataObject[];
				} else if (typeof response === 'object' && response !== null) {
					const data = response as IDataObject;
					files = (data.data as IDataObject | IDataObject[]) ? 
						(Array.isArray(data.data) ? data.data : [data.data]) : 
						((data.shares as IDataObject[]) || []);
				}

				returnData.push({
					success: true,
					path: folderPath,
					files,
					count: files.length,
					recursive,
					sortBy,
					response,
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
