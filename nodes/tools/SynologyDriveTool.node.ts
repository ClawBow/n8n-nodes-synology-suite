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
				displayName: 'Action',
				name: 'action',
				type: 'options',
				required: true,
				default: 'list',
				options: [
					{ name: 'Upload File', value: 'upload' },
					{ name: 'List Files', value: 'list' },
					{ name: 'Search Files', value: 'search' },
					{ name: 'Delete File', value: 'delete' },
				],
			},
			// Upload params
			{
				displayName: 'File Name',
				name: 'filename',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'document.pdf',
				description: 'Name of the file to upload',
				displayOptions: { show: { action: ['upload'] } },
			},
			{
				displayName: 'File Content',
				name: 'content',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'File content here',
				typeOptions: { rows: 5 },
				description: 'File content (base64 for binary)',
				displayOptions: { show: { action: ['upload'] } },
			},
			{
				displayName: 'Destination Path',
				name: 'path',
				type: 'string',
				default: '/Documents',
				placeholder: '/Documents',
				description: 'Destination folder path',
				displayOptions: { show: { action: ['upload'] } },
			},
			{
				displayName: 'Overwrite',
				name: 'overwrite',
				type: 'boolean',
				default: false,
				description: 'Replace if file already exists',
				displayOptions: { show: { action: ['upload'] } },
			},
			// List params
			{
				displayName: 'Folder Path',
				name: 'path',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				description: 'Path to list files from',
				displayOptions: { show: { action: ['list'] } },
			},
			// Search params
			{
				displayName: 'Search Pattern',
				name: 'pattern',
				type: 'string',
				required: true,
				default: '',
				placeholder: '*.pdf',
				description: 'Filename or pattern to search for',
				displayOptions: { show: { action: ['search'] } },
			},
			// Delete params
			{
				displayName: 'File Path',
				name: 'path',
				type: 'string',
				required: true,
				default: '',
				placeholder: '/Documents/file.pdf',
				description: 'Full path of file to delete',
				displayOptions: { show: { action: ['delete'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const action = this.getNodeParameter('action', i) as string;

			switch (action) {
				case 'upload': {
					const filename = this.getNodeParameter('filename', i) as string;
					const content = this.getNodeParameter('content', i) as string;
					const path = (this.getNodeParameter('path', i) as string) || `/Documents/${filename}`;
					const overwrite = this.getNodeParameter('overwrite', i) as boolean;

					if (!filename || !content) return { error: 'filename and content required' };

					await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['upload', 'create'], {
						path,
						content,
						overwrite: overwrite ? 'true' : 'false',
					});
					return { success: true, message: `File uploaded to ${path}` };
				}

				case 'list': {
					const listPath = (this.getNodeParameter('path', i) as string) || '/';
					const response = await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['list', 'get'], {
						path: listPath,
						limit: 50,
					});
					const files = Array.isArray(response) ? response.map((f: any) => f.name || f).slice(0, 10) : [];
					return { success: true, files, count: files.length };
				}

				case 'search': {
					const pattern = this.getNodeParameter('pattern', i) as string;
					if (!pattern) return { error: 'pattern required' };
					const response = await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['search', 'query'], {
						pattern,
						limit: 20,
					});
					const found = Array.isArray(response) ? response.map((f: any) => f.name).slice(0, 10) : [];
					return { success: true, found, count: found.length };
				}

				case 'delete': {
					const path = this.getNodeParameter('path', i) as string;
					if (!path) return { error: 'path required' };
					await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['delete', 'remove'], { path });
					return { success: true, message: `Deleted: ${path}` };
				}

				default:
					return { error: `Unknown action: ${action}` };
			}
		});
	}
}
