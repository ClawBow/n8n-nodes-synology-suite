import type { IDataObject, IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';
import axios from 'axios';

export class SynologyDriveTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Drive (AI Agent)',
		name: 'synologyDriveTool',
		icon: 'file:synology-drive.png',
		group: ['transform'],
		version: 1,
		description: 'Synology Drive / FileStation operations',
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
					{ name: 'Create Folder', value: 'createFolder' },
					{ name: 'Rename', value: 'rename' },
					{ name: 'Delete', value: 'delete' },
					{ name: 'Copy / Move', value: 'copyMove' },
					{ name: 'Create Share Link', value: 'createShareLink' },
					{ name: 'List Share Links', value: 'listShareLinks' },
					{ name: 'Custom Drive Call', value: 'customDriveCall' },
					{ name: 'List Drive APIs', value: 'listDriveApis' },
				],
			},
			// List Files
			{
				displayName: 'Path',
				name: 'path',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'createShareLink', 'rename', 'delete'] } },
			},
			{
				displayName: 'Recursive',
				name: 'recursive',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'delete'] } },
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 50,
				displayOptions: { show: { operation: ['listFiles', 'searchFiles'] } },
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
			// Search Files
			{
				displayName: 'Keyword',
				name: 'keyword',
				type: 'string',
				default: '',
				placeholder: '*.pdf',
				displayOptions: { show: { operation: ['searchFiles'] } },
			},
			// Upload File
			{
				displayName: 'Destination Folder',
				name: 'uploadDestPath',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{
				displayName: 'File Name',
				name: 'uploadFileName',
				type: 'string',
				default: '',
				placeholder: 'document.pdf',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{
				displayName: 'File Content',
				name: 'uploadContent',
				type: 'string',
				default: '',
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
			// Create Folder
			{
				displayName: 'Parent Folder',
				name: 'parentFolder',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				displayOptions: { show: { operation: ['createFolder'] } },
			},
			{
				displayName: 'Folder Name',
				name: 'folderName',
				type: 'string',
				default: '',
				placeholder: 'NewFolder',
				displayOptions: { show: { operation: ['createFolder'] } },
			},
			// Rename
			{
				displayName: 'New Name',
				name: 'newName',
				type: 'string',
				default: '',
				placeholder: 'NewName',
				displayOptions: { show: { operation: ['rename'] } },
			},
			// Copy / Move
			{
				displayName: 'Source Paths (JSON)',
				name: 'pathsJson',
				type: 'string',
				default: '["/"]',
				typeOptions: { rows: 3 },
				description: 'JSON array of paths',
				displayOptions: { show: { operation: ['delete', 'copyMove', 'listShareLinks'] } },
			},
			{
				displayName: 'Destination Folder',
				name: 'destFolder',
				type: 'string',
				default: '/',
				placeholder: '/Documents',
				displayOptions: { show: { operation: ['copyMove'] } },
			},
			{
				displayName: 'Move (Remove Source)',
				name: 'removeSrc',
				type: 'boolean',
				default: false,
				displayOptions: { show: { operation: ['copyMove'] } },
			},
			// Create Share Link
			{
				displayName: 'Link Name',
				name: 'linkName',
				type: 'string',
				default: 'n8n-share',
				displayOptions: { show: { operation: ['createShareLink'] } },
			},
			{
				displayName: 'Link Password',
				name: 'linkPassword',
				type: 'string',
				typeOptions: { password: true },
				default: '',
				displayOptions: { show: { operation: ['createShareLink'] } },
			},
			{
				displayName: 'Expire Date (YYYY-MM-DD)',
				name: 'expireDate',
				type: 'string',
				default: '',
				displayOptions: { show: { operation: ['createShareLink'] } },
			},
			{
				displayName: 'Enable Download',
				name: 'enableDownload',
				type: 'boolean',
				default: true,
				displayOptions: { show: { operation: ['createShareLink'] } },
			},
			// Custom Drive Call
			{
				displayName: 'API Name',
				name: 'api',
				type: 'string',
				default: 'SYNO.FileStation.List',
				placeholder: 'SYNO.FileStation.List',
				displayOptions: { show: { operation: ['customDriveCall'] } },
			},
			{
				displayName: 'Method',
				name: 'method',
				type: 'string',
				default: 'list',
				placeholder: 'list',
				displayOptions: { show: { operation: ['customDriveCall'] } },
			},
			{
				displayName: 'Params (JSON)',
				name: 'paramsJson',
				type: 'string',
				default: '{}',
				typeOptions: { rows: 4 },
				displayOptions: { show: { operation: ['customDriveCall'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listDriveApis') {
				return dsm.queryApis('SYNO.SynologyDrive.*,SYNO.FileStation.*');
			}

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
				let files = (pageData.files || []) as IDataObject[];

				if (includeType === 'files') {
					files = files.filter((f) => f.isdir !== true);
				} else if (includeType === 'folders') {
					files = files.filter((f) => f.isdir === true);
				}

				return { success: true, data: { files, count: files.length } };
			}

			if (operation === 'searchFiles') {
				const path = this.getNodeParameter('path', i) as string;
				const keyword = this.getNodeParameter('keyword', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				const limit = this.getNodeParameter('limit', i) as number;

				return dsm.callAuto('SYNO.FileStation.Search', 'start', {
					folder_path: path,
					recursive,
					keyword,
					limit,
				});
			}

			if (operation === 'createFolder') {
				const parentFolder = this.getNodeParameter('parentFolder', i) as string;
				const folderName = this.getNodeParameter('folderName', i) as string;

				return dsm.callAuto('SYNO.FileStation.CreateFolder', 'create', {
					folder_path: parentFolder,
					name: folderName,
					force_parent: false,
				});
			}

			if (operation === 'rename') {
				const path = this.getNodeParameter('path', i) as string;
				const newName = this.getNodeParameter('newName', i) as string;

				return dsm.callAuto('SYNO.FileStation.Rename', 'rename', { path, name: newName });
			}

			if (operation === 'delete') {
				const pathsJson = this.getNodeParameter('pathsJson', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;

				let paths: string[];
				try {
					paths = JSON.parse(pathsJson);
				} catch {
					paths = [pathsJson];
				}

				return dsm.callAuto('SYNO.FileStation.Delete', 'delete', { path: paths, recursive });
			}

			if (operation === 'copyMove') {
				const pathsJson = this.getNodeParameter('pathsJson', i) as string;
				const destFolder = this.getNodeParameter('destFolder', i) as string;
				const removeSrc = this.getNodeParameter('removeSrc', i) as boolean;

				let paths: string[];
				try {
					paths = JSON.parse(pathsJson);
				} catch {
					paths = [pathsJson];
				}

				return dsm.callAuto('SYNO.FileStation.CopyMove', 'start', {
					path: paths,
					dest_folder_path: destFolder,
					remove_src: removeSrc,
				});
			}

			if (operation === 'createShareLink') {
				const path = this.getNodeParameter('path', i) as string;
				const linkName = this.getNodeParameter('linkName', i) as string;
				const linkPassword = this.getNodeParameter('linkPassword', i) as string;
				const expireDate = this.getNodeParameter('expireDate', i) as string;
				const enableDownload = this.getNodeParameter('enableDownload', i) as boolean;

				return dsm.callAuto('SYNO.FileStation.Sharing', 'create', {
					path,
					name: linkName,
					password: linkPassword || undefined,
					date_expired: expireDate || undefined,
					downloadable: enableDownload,
				});
			}

			if (operation === 'listShareLinks') {
				const pathsJson = this.getNodeParameter('pathsJson', i) as string;

				let paths: string[];
				try {
					paths = JSON.parse(pathsJson);
				} catch {
					paths = [pathsJson];
				}

				return dsm.callAuto('SYNO.FileStation.Sharing', 'list', { path: paths });
			}

			if (operation === 'uploadFile') {
				const uploadDestPath = this.getNodeParameter('uploadDestPath', i) as string;
				const uploadFileName = this.getNodeParameter('uploadFileName', i) as string;
				const uploadContent = this.getNodeParameter('uploadContent', i) as string;
				const uploadOverwrite = this.getNodeParameter('uploadOverwrite', i) as boolean;

				try {
					const buffer = Buffer.from(uploadContent, 'base64');
					return dsm.uploadFile(buffer, uploadFileName, uploadDestPath, uploadOverwrite, true);
				} catch (error) {
					return { success: false, error: error instanceof Error ? error.message : 'Upload failed' };
				}
			}

			if (operation === 'customDriveCall') {
				const api = this.getNodeParameter('api', i) as string;
				const method = this.getNodeParameter('method', i) as string;
				const paramsJson = this.getNodeParameter('paramsJson', i) as string;

				let params: IDataObject = {};
				try {
					params = JSON.parse(paramsJson);
				} catch {
					return { error: 'Invalid JSON in params' };
				}

				return dsm.callAuto(api, method, params);
			}

			return { error: `Unknown operation: ${operation}` };
		});
	}
}
