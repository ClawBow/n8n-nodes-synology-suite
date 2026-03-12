import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

function parseJsonParam(value: unknown): IDataObject {
	if (!value) return {};
	if (typeof value === 'object') return value as IDataObject;
	try {
		return JSON.parse(String(value)) as IDataObject;
	} catch {
		return {};
	}
}

export class SynologyFileStation implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology File Station',
		name: 'synologyFileStation',
		icon: 'file:synology-filestation.png',
		group: ['transform'],
		version: 1,
		description: 'Synology DSM File Station operations',
		defaults: { name: 'Synology File Station' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'list',
				options: [
					{ name: 'List Files', value: 'list' },
					{ name: 'Get File/Folder Info', value: 'info' },
					{ name: 'Search', value: 'search' },
					{ name: 'Create Folder', value: 'createFolder' },
					{ name: 'Rename', value: 'rename' },
					{ name: 'Delete', value: 'delete' },
					{ name: 'Copy / Move', value: 'copyMove' },
					{ name: 'Start Directory Size Task', value: 'dirsizeStart' },
					{ name: 'List Background Tasks', value: 'backgroundList' },
					{ name: 'Download File', value: 'download' },
					{ name: 'Upload File (Base64)', value: 'uploadBase64' },
					{ name: 'Custom FileStation Call', value: 'customCall' },
				],
			},
			{ displayName: 'Path', name: 'path', type: 'string', default: '/OpenClaw', displayOptions: { show: { operation: ['list', 'search', 'createFolder', 'dirsizeStart', 'uploadBase64'] } } },
			{ displayName: 'File Path', name: 'filePath', type: 'string', default: '/OpenClaw/file.txt', displayOptions: { show: { operation: ['info', 'rename', 'delete', 'download'] } } },
			{ displayName: 'New Name', name: 'newName', type: 'string', default: '', displayOptions: { show: { operation: ['rename'] } } },
			{ displayName: 'Pattern', name: 'pattern', type: 'string', default: '*.zip', displayOptions: { show: { operation: ['search'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['list', 'search', 'backgroundList'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['list', 'search', 'backgroundList'] } } },
			{ displayName: 'Folder Name', name: 'folderName', type: 'string', default: 'new-folder', displayOptions: { show: { operation: ['createFolder'] } } },
			{ displayName: 'Recursive', name: 'recursive', type: 'boolean', default: false, displayOptions: { show: { operation: ['delete'] } } },
			{ displayName: 'Source Path', name: 'sourcePath', type: 'string', default: '/OpenClaw/source.txt', displayOptions: { show: { operation: ['copyMove'] } } },
			{ displayName: 'Destination Folder Path', name: 'destFolderPath', type: 'string', default: '/OpenClaw/_archive', displayOptions: { show: { operation: ['copyMove'] } } },
			{ displayName: 'Move Instead of Copy', name: 'removeSrc', type: 'boolean', default: false, displayOptions: { show: { operation: ['copyMove'] } } },
			{ displayName: 'Overwrite', name: 'overwrite', type: 'boolean', default: false, displayOptions: { show: { operation: ['copyMove', 'uploadBase64'] } } },
			{ displayName: 'File Name', name: 'uploadFileName', type: 'string', default: 'upload.bin', displayOptions: { show: { operation: ['uploadBase64'] } } },
			{ displayName: 'File Content (Base64)', name: 'uploadBase64', type: 'string', default: '', typeOptions: { rows: 4 }, displayOptions: { show: { operation: ['uploadBase64'] } } },
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.FileStation.List', displayOptions: { show: { operation: ['customCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'list', displayOptions: { show: { operation: ['customCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customCall'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const listApis = ['SYNO.FileStation.List', 'SYNO.FileStation.Browse'];
			const createFolderApis = ['SYNO.FileStation.CreateFolder', 'SYNO.FileStation.Dir'];
			const renameApis = ['SYNO.FileStation.Rename', 'SYNO.FileStation.Manage'];
			const deleteApis = ['SYNO.FileStation.Delete', 'SYNO.FileStation.Manage'];
			const copyMoveApis = ['SYNO.FileStation.CopyMove', 'SYNO.FileStation.Manage'];

			if (operation === 'list') {
				const path = this.getNodeParameter('path', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAny(listApis, ['list', 'get'], {
					folder_path: path,
					offset,
					limit,
					additional: JSON.stringify(['real_path', 'size', 'time', 'type']),
				});
			}

			if (operation === 'info') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				return dsm.callAny(
					['SYNO.FileStation.Info', 'SYNO.FileStation.Property'],
					['get', 'info'],
					{ path: filePath },
				);
			}

			if (operation === 'search') {
				const path = this.getNodeParameter('path', i) as string;
				const pattern = this.getNodeParameter('pattern', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAny(
					['SYNO.FileStation.Search', 'SYNO.FileStation.Search.History'],
					['start', 'list', 'search'],
					{ folder_path: path, pattern, offset, limit },
				);
			}

			if (operation === 'createFolder') {
				const path = this.getNodeParameter('path', i) as string;
				const folderName = this.getNodeParameter('folderName', i) as string;
				return dsm.callAny(createFolderApis, ['create', 'add'], {
					folder_path: path,
					name: folderName,
				});
			}

			if (operation === 'rename') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				const newName = this.getNodeParameter('newName', i) as string;
				return dsm.callAny(renameApis, ['rename', 'update'], {
					path: filePath,
					name: newName,
				});
			}

			if (operation === 'delete') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				return dsm.callAny(deleteApis, ['delete', 'remove'], {
					path: [filePath],
					recursive,
				});
			}

			if (operation === 'copyMove') {
				const sourcePath = this.getNodeParameter('sourcePath', i) as string;
				const destFolderPath = this.getNodeParameter('destFolderPath', i) as string;
				const removeSrc = this.getNodeParameter('removeSrc', i) as boolean;
				const overwrite = this.getNodeParameter('overwrite', i) as boolean;
				return dsm.callAny(copyMoveApis, ['start', 'copy', 'move'], {
					path: [sourcePath],
					dest_folder_path: destFolderPath,
					remove_src: removeSrc,
					overwrite,
				});
			}

			if (operation === 'dirsizeStart') {
				const path = this.getNodeParameter('path', i) as string;
				return dsm.callAny(['SYNO.FileStation.DirSize', 'SYNO.FileStation.BackgroundTask'], ['start', 'create'], { path });
			}

			if (operation === 'backgroundList') {
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAny(['SYNO.FileStation.BackgroundTask', 'SYNO.FileStation.Task'], ['list', 'get'], { offset, limit });
			}

			if (operation === 'download') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				const data = await dsm.downloadFile(filePath);
				const fileName = (filePath.split('/').filter(Boolean).pop() || 'download.bin');
				const binaryData = await this.helpers.prepareBinaryData(data, fileName);
				return {
					json: { success: true, filePath, fileName, size: data.length },
					binary: { data: binaryData },
				} as unknown as IDataObject;
			}

			if (operation === 'uploadBase64') {
				const path = this.getNodeParameter('path', i) as string;
				const uploadFileName = this.getNodeParameter('uploadFileName', i) as string;
				const uploadBase64 = this.getNodeParameter('uploadBase64', i) as string;
				const overwrite = this.getNodeParameter('overwrite', i) as boolean;
				const buf = Buffer.from(uploadBase64 || '', 'base64');
				return dsm.uploadFile(buf, uploadFileName, path, overwrite, true);
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = parseJsonParam(this.getNodeParameter('paramsJson', i, {}));
			return dsm.callAuto(api, method, paramsJson);
		});
	}
}
