import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import {
	NodeConnectionTypes,
	NodeOperationError,
	nodeNameToToolName,
	tryToParseAlphanumericString,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyDriveTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Drive',
		name: 'synologyDriveTool',
		icon: 'file:synology-drive.png',
		group: ['output'],
		version: 1,
		description: 'Manage files in Synology Drive',
		defaults: { name: 'Synology Drive' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
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
					params = { action: 'list', path: '/' };
				}

				const action = params.action || 'list';

				switch (action) {
					case 'upload': {
						if (!params.filename || !params.content) return 'Error: filename and content required';
						const path = params.path || `/Documents/${params.filename}`;
						await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['upload', 'create'], {
							path,
							content: params.content,
							overwrite: params.overwrite ? 'true' : 'false',
						});
						return `✅ File uploaded to ${path}`;
					}

					case 'list': {
						const listPath = params.path || '/';
						const response = await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['list', 'get'], {
							path: listPath,
							limit: 50,
						});
						const files = Array.isArray(response)
							? response
									.map((f: any) => f.name || f)
									.slice(0, 10)
									.join(', ')
							: '';
						return `📂 ${files}${Array.isArray(response) && response.length > 10 ? ' ...' : ''}`;
					}

					case 'search': {
						const pattern = params.pattern || params.query || '';
						if (!pattern) return 'Error: pattern required';
						const response = await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['search', 'query'], {
							pattern,
							limit: 20,
						});
						const found = Array.isArray(response) ? response.map((f: any) => f.name).slice(0, 10).join(', ') : '';
						return `🔍 Found: ${found}`;
					}

					case 'delete': {
						if (!params.path) return 'Error: path required';
						await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['delete', 'remove'], { path: params.path });
						return `🗑️ Deleted: ${params.path}`;
					}

					default:
						return `❌ Unknown action: ${action}`;
				}
			} catch (error) {
				return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			}
		};

		const tool = new DynamicTool({
			name,
			description: 'Manage files in Synology Drive (upload, list, search, delete)',
			func,
		});

		return { response: tool };
	}
}
