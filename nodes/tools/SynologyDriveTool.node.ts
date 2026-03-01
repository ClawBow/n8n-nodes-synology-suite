import type { IDataObject, IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyDriveTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Drive',
		name: 'synologyDriveTool',
		icon: 'file:synology-drive.png',
		group: ['transform'],
		version: 1,
		description: 'Manage files in Synology Drive',
		defaults: { name: 'Synology Drive' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				required: true,
				default: 'listFiles',
				options: [
					{ name: 'List Files', value: 'listFiles' },
					{ name: 'Search Files', value: 'searchFiles' },
					{ name: 'Upload File', value: 'uploadFile' },
					{ name: 'Delete File', value: 'deleteFile' },
				],
			},
			// List Files params
			{
				displayName: 'Folder Path',
				name: 'path',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				description: 'Path to list files from',
				displayOptions: { show: { operation: ['listFiles'] } },
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				description: 'Include subfolders',
				displayOptions: { show: { operation: ['listFiles'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				description: 'Maximum files to return',
				displayOptions: { show: { operation: ['listFiles'] } },
			},
			{
				displayName: 'Include Type',
				name: 'includeType',
				type: 'options',
				default: 'all',
				options: [
					{ name: 'Files + Folders', value: 'all' },
					{ name: 'Files Only', value: 'files' },
					{ name: 'Folders Only', value: 'folders' },
				],
				displayOptions: { show: { operation: ['listFiles'] } },
			},
			// Search Files params
			{
				displayName: 'Folder Path',
				name: 'path',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				description: 'Path to search in',
				displayOptions: { show: { operation: ['searchFiles'] } },
			},
			{
				displayName: 'Search Keyword',
				name: 'keyword',
				type: 'string',
				required: true,
				default: '',
				placeholder: '*.pdf',
				description: 'Filename or pattern to search for',
				displayOptions: { show: { operation: ['searchFiles'] } },
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['searchFiles'] } },
			},
			// Upload File params
			{
				displayName: 'Destination Folder',
				name: 'uploadDestPath',
				type: 'string',
				required: true,
				default: '/',
				placeholder: '/Documents',
				description: 'Destination folder path',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{
				displayName: 'File Name',
				name: 'uploadFileName',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'document.pdf',
				description: 'Name for the uploaded file',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{
				displayName: 'File Content',
				name: 'uploadContent',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'File content here',
				typeOptions: { rows: 5 },
				description: 'File content (base64 for binary)',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{
				displayName: 'Overwrite',
				name: 'uploadOverwrite',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			// Delete File params
			{
				displayName: 'File Path',
				name: 'deletePath',
				type: 'string',
				required: true,
				default: '',
				placeholder: '/Documents/file.pdf',
				description: 'Full path of file to delete',
				displayOptions: { show: { operation: ['deleteFile'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listFiles') {
				const path = this.getNodeParameter('path', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				const limit = this.getNodeParameter('limit', i) as number;
				const includeType = this.getNodeParameter('includeType', i) as string;

				const result = await dsm.callAuto('SYNO.FileStation.List', 'list', {
					folder_path: path,
					recursive,
					offset: 0,
					limit,
				});

				const pageData = (result.data || {}) as IDataObject;
				const files = (pageData.files || []) as IDataObject[];

				let filtered = files;
				if (includeType === 'files') {
					filtered = files.filter((f) => f.isdir !== true);
				} else if (includeType === 'folders') {
					filtered = files.filter((f) => f.isdir === true);
				}

				return { success: true, data: { files: filtered, count: filtered.length } };
			}

			if (operation === 'searchFiles') {
				const path = this.getNodeParameter('path', i) as string;
				const keyword = this.getNodeParameter('keyword', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;

				const result = await dsm.callAuto('SYNO.FileStation.Search', 'start', {
					folder_path: path,
					recursive,
					keyword,
					limit: 100,
				});

				return { success: true, data: result };
			}

			if (operation === 'uploadFile') {
				const uploadDestPath = this.getNodeParameter('uploadDestPath', i) as string;
				const uploadFileName = this.getNodeParameter('uploadFileName', i) as string;
				const uploadContent = this.getNodeParameter('uploadContent', i) as string;
				const uploadOverwrite = this.getNodeParameter('uploadOverwrite', i) as boolean;

				try {
					const buffer = Buffer.from(uploadContent, 'base64');
					const result = await dsm.uploadFile(buffer, uploadFileName, uploadDestPath, uploadOverwrite, true);
					return { success: true, data: result };
				} catch (error) {
					return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
				}
			}

			if (operation === 'deleteFile') {
				const deletePath = this.getNodeParameter('deletePath', i) as string;

				const result = await dsm.callAuto('SYNO.FileStation.Delete', 'delete', {
					path: [deletePath],
					recursive: false,
				});

				return { success: true, data: result };
			}

			return { error: `Unknown operation: ${operation}` };
		});
	}
}
