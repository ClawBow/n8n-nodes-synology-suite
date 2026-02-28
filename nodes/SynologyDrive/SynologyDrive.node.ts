import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';
import axios from 'axios';

export class SynologyDrive implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Drive',
		name: 'synologyDrive',
		icon: 'file:synology.png',
		group: ['transform'],
		version: 1,
		description: 'Synology Drive / FileStation operations',
		defaults: { name: 'Synology Drive' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
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
				default: 'listFiles',
			},
			{ displayName: 'Path', name: 'path', type: 'string', default: '/', displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'createShareLink', 'rename', 'delete'] } } },
			{ displayName: 'Recursive', name: 'recursive', type: 'boolean', default: false, displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'delete'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listFiles'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listFiles', 'searchFiles'] } } },
			{ displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, displayOptions: { show: { operation: ['listFiles'] } } },
			{
				displayName: 'Include',
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
			{ displayName: 'Keyword', name: 'keyword', type: 'string', default: '', displayOptions: { show: { operation: ['searchFiles'] } } },
			{ displayName: 'Wait for Completion', name: 'waitForCompletion', type: 'boolean', default: false, displayOptions: { show: { operation: ['searchFiles'] } } },
			{ displayName: 'Poll Every (ms)', name: 'pollIntervalMs', type: 'number', default: 1200, displayOptions: { show: { operation: ['searchFiles'] } } },
			{ displayName: 'Poll Timeout (ms)', name: 'pollTimeoutMs', type: 'number', default: 30000, displayOptions: { show: { operation: ['searchFiles'] } } },
			{ displayName: 'Parent Folder', name: 'parentFolder', type: 'string', default: '/', displayOptions: { show: { operation: ['createFolder'] } } },
			{ displayName: 'Folder Name', name: 'folderName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createFolder'] } } },
			{ displayName: 'New Name', name: 'newName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['rename'] } } },
			{ displayName: 'Paths (JSON Array)', name: 'pathsJson', type: 'json', default: '["/"]', displayOptions: { show: { operation: ['delete', 'copyMove', 'listShareLinks'] } } },
			{ displayName: 'Destination Folder', name: 'destFolder', type: 'string', default: '/', displayOptions: { show: { operation: ['copyMove'] } } },
			{ displayName: 'Remove Source (Move)', name: 'removeSrc', type: 'boolean', default: false, displayOptions: { show: { operation: ['copyMove'] } } },
			{ displayName: 'Link Name', name: 'linkName', type: 'string', default: 'n8n-share', displayOptions: { show: { operation: ['createShareLink'] } } },
			{ displayName: 'Link Password', name: 'linkPassword', type: 'string', typeOptions: { password: true }, default: '', displayOptions: { show: { operation: ['createShareLink'] } } },
			{ displayName: 'Expire Date (YYYY-MM-DD)', name: 'expireDate', type: 'string', default: '', displayOptions: { show: { operation: ['createShareLink'] } } },
			{ displayName: 'Enable Download', name: 'enableDownload', type: 'boolean', default: true, displayOptions: { show: { operation: ['createShareLink'] } } },
			{
				displayName: 'Upload Mode',
				name: 'uploadMode',
				type: 'options',
				options: [
					{ name: 'Binary Data (from n8n)', value: 'binary' },
					{ name: 'From URL', value: 'url' },
				],
				default: 'binary',
				displayOptions: { show: { operation: ['uploadFile'] } },
			},
			{ displayName: 'Destination Folder', name: 'uploadDestPath', type: 'string', default: '/', displayOptions: { show: { operation: ['uploadFile'] } } },
			{ displayName: 'Binary Data Field', name: 'uploadBinaryField', type: 'string', default: 'data', displayOptions: { show: { operation: ['uploadFile'], uploadMode: ['binary'] } } },
			{ displayName: 'File Name', name: 'uploadFileName', type: 'string', default: '', displayOptions: { show: { operation: ['uploadFile'], uploadMode: ['binary'] } } },
			{ displayName: 'File URL', name: 'uploadFileUrl', type: 'string', default: '', displayOptions: { show: { operation: ['uploadFile'], uploadMode: ['url'] } } },
			{ displayName: 'Extract Filename from URL', name: 'uploadExtractFilename', type: 'boolean', default: true, displayOptions: { show: { operation: ['uploadFile'], uploadMode: ['url'] } } },
			{ displayName: 'Custom File Name', name: 'uploadCustomFileName', type: 'string', default: '', displayOptions: { show: { operation: ['uploadFile'], uploadMode: ['url'], uploadExtractFilename: [false] } } },
			{ displayName: 'Overwrite Existing', name: 'uploadOverwrite', type: 'boolean', default: true, displayOptions: { show: { operation: ['uploadFile'] } } },
			{ displayName: 'Create Parent Folders', name: 'uploadCreateParents', type: 'boolean', default: true, displayOptions: { show: { operation: ['uploadFile'] } } },
			{ displayName: 'Extra Params (JSON)', name: 'extraParamsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'createFolder', 'rename', 'delete', 'copyMove', 'createShareLink', 'listShareLinks', 'uploadFile'] } } },
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.FileStation.List', displayOptions: { show: { operation: ['customDriveCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'list', displayOptions: { show: { operation: ['customDriveCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customDriveCall'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const extraParams = this.getNodeParameter('extraParamsJson', i, {}) as IDataObject;

			if (operation === 'listDriveApis') {
				return dsm.queryApis('SYNO.SynologyDrive.*,SYNO.FileStation.*');
			}

			if (operation === 'listFiles') {
				const path = this.getNodeParameter('path', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				const returnAll = this.getNodeParameter('returnAll', i) as boolean;
				const includeType = this.getNodeParameter('includeType', i) as string;

				const applyIncludeFilter = (items: IDataObject[]) => {
					if (includeType === 'files') return items.filter((f) => f.isdir !== true);
					if (includeType === 'folders') return items.filter((f) => f.isdir === true);
					return items;
				};

				if (!returnAll) {
					const page = await dsm.callAuto('SYNO.FileStation.List', 'list', {
						folder_path: path,
						recursive,
						offset,
						limit,
						...extraParams,
					});
					const pageData = (page.data || {}) as IDataObject;
					const files = (pageData.files || []) as IDataObject[];
					return { ...page, data: { ...pageData, files: applyIncludeFilter(files) } };
				}

				const allFiles: IDataObject[] = [];
				let cursor = offset;
				let pages = 0;
				while (pages < 200) {
					const page = await dsm.callAuto('SYNO.FileStation.List', 'list', {
						folder_path: path,
						recursive,
						offset: cursor,
						limit,
						...extraParams,
					});
					const files = (((page.data || {}) as IDataObject).files || []) as IDataObject[];
					allFiles.push(...files);
					if (files.length < limit) break;
					cursor += limit;
					pages += 1;
				}

				const filtered = applyIncludeFilter(allFiles);
				return { success: true, data: { files: filtered, fetched: filtered.length, offset } };
			}

			if (operation === 'searchFiles') {
				const path = this.getNodeParameter('path', i) as string;
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				const keyword = this.getNodeParameter('keyword', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const waitForCompletion = this.getNodeParameter('waitForCompletion', i) as boolean;
				const pollIntervalMs = this.getNodeParameter('pollIntervalMs', i) as number;
				const pollTimeoutMs = this.getNodeParameter('pollTimeoutMs', i) as number;
				const start = await dsm.callAuto('SYNO.FileStation.Search', 'start', {
					folder_path: path,
					recursive,
					keyword,
					limit,
					...extraParams,
				});

				if (!waitForCompletion) return start;

				const taskId = String((((start.data || {}) as IDataObject).taskid || ((start.data || {}) as IDataObject).task_id || ''));
				if (!taskId) return start;
				const deadline = Date.now() + pollTimeoutMs;

				while (Date.now() < deadline) {
					const result = await dsm.callAny(['SYNO.FileStation.Search'], ['list', 'get', 'result'], {
						taskid: taskId,
						task_id: taskId,
					});
					const data = (result.data || {}) as IDataObject;
					if (data.finished === true || data.complete === true || data.done === true) return result;
					await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
				}

				return {
					success: true,
					data: {
						warning: 'Polling timeout reached before search completion',
						task_id: taskId,
						start,
					},
				};
			}

			if (operation === 'createFolder') {
				const parentFolder = this.getNodeParameter('parentFolder', i) as string;
				const folderName = this.getNodeParameter('folderName', i) as string;
				return dsm.callAuto('SYNO.FileStation.CreateFolder', 'create', {
					folder_path: parentFolder,
					name: folderName,
					force_parent: false,
					...extraParams,
				});
			}

			if (operation === 'rename') {
				const path = this.getNodeParameter('path', i) as string;
				const newName = this.getNodeParameter('newName', i) as string;
				return dsm.callAuto('SYNO.FileStation.Rename', 'rename', { path, name: newName, ...extraParams });
			}

			if (operation === 'delete') {
				const recursive = this.getNodeParameter('recursive', i) as boolean;
				const pathsJson = this.getNodeParameter('pathsJson', i) as IDataObject | IDataObject[] | string[];
				return dsm.callAuto('SYNO.FileStation.Delete', 'delete', { path: pathsJson as any, recursive, ...extraParams });
			}

			if (operation === 'copyMove') {
				const pathsJson = this.getNodeParameter('pathsJson', i) as IDataObject | IDataObject[] | string[];
				const destFolder = this.getNodeParameter('destFolder', i) as string;
				const removeSrc = this.getNodeParameter('removeSrc', i) as boolean;
				return dsm.callAuto('SYNO.FileStation.CopyMove', 'start', {
					path: pathsJson as any,
					dest_folder_path: destFolder,
					remove_src: removeSrc,
					...extraParams,
				});
			}

			if (operation === 'listShareLinks') {
				const pathsJson = this.getNodeParameter('pathsJson', i) as IDataObject | IDataObject[] | string[];
				return dsm.callAuto('SYNO.FileStation.Sharing', 'list', { path: pathsJson as any, ...extraParams });
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
					...extraParams,
				});
			}

			if (operation === 'uploadFile') {
				const uploadMode = this.getNodeParameter('uploadMode', i) as string;
				const uploadDestPath = this.getNodeParameter('uploadDestPath', i) as string;
				const uploadOverwrite = this.getNodeParameter('uploadOverwrite', i) as boolean;
				const uploadCreateParents = this.getNodeParameter('uploadCreateParents', i) as boolean;

				if (uploadMode === 'binary') {
					const uploadBinaryField = this.getNodeParameter('uploadBinaryField', i) as string;
					let uploadFileName = this.getNodeParameter('uploadFileName', i) as string;

					try {
						const buffer = await this.helpers.getBinaryDataBuffer(i, uploadBinaryField);
						if (!uploadFileName) {
							uploadFileName = `upload_${Date.now()}.bin`;
						}
						return await performUpload(dsm, creds as any, buffer, uploadFileName, uploadDestPath, uploadOverwrite, uploadCreateParents);
					} catch (error) {
						return { success: false, error: `Binary upload failed: ${error}` };
					}
				} else if (uploadMode === 'url') {
					const uploadFileUrl = this.getNodeParameter('uploadFileUrl', i) as string;
					const uploadExtractFilename = this.getNodeParameter('uploadExtractFilename', i) as boolean;
					let uploadCustomFileName = this.getNodeParameter('uploadCustomFileName', i) as string;

					let fileName: string;
					if (uploadExtractFilename && !uploadCustomFileName) {
						const urlParts = new URL(uploadFileUrl).pathname.split('/');
						fileName = urlParts[urlParts.length - 1] || 'downloaded_file';
					} else {
						fileName = uploadCustomFileName || 'downloaded_file';
					}

					try {
						const response = await axios.get(uploadFileUrl, { responseType: 'arraybuffer' });
						const buffer = Buffer.from(response.data);
						return await performUpload(dsm, creds as any, buffer, fileName, uploadDestPath, uploadOverwrite, uploadCreateParents);
					} catch (error) {
						return { success: false, error: `URL download failed: ${error}` };
					}
				}
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
			return dsm.callAuto(api, method, paramsJson || {});
		});
	}
}

async function performUpload(
	dsm: DsmClient,
	creds: any,
	fileBuffer: Buffer,
	fileName: string,
	destPath: string,
	overwrite: boolean,
	createParents: boolean,
): Promise<IDataObject> {
	try {
		const formData = new FormData();
		formData.append('api', 'SYNO.FileStation.Upload');
		formData.append('version', '2');
		formData.append('method', 'upload');
		formData.append('path', destPath);
		formData.append('create_parents', createParents ? 'true' : 'false');
		formData.append('overwrite', overwrite ? 'true' : 'false');

		const blob = new Blob([fileBuffer], { type: 'application/octet-stream' });
		formData.append('file', blob, fileName);

		const protocol = creds.protocol === 'http' ? 'http' : 'https';
		const host = creds.host as string;
		const port = creds.port as number;
		const sid = creds._sid as string;

		const baseUrl = `${protocol}://${host}:${port}`;
		const uploadUrl = `${baseUrl}/webapi/entry.cgi?_sid=${sid}`;

		const response = await axios.post(uploadUrl, formData, {
			headers: { 'Content-Type': 'multipart/form-data' },
			validateStatus: () => true,
		});

		const result = response.data as IDataObject;

		if (result.success === true) {
			return { success: true, fileName, path: destPath, data: result.data };
		} else {
			return { success: false, error: result.error || 'Upload failed', data: result };
		}
	} catch (error) {
		return { success: false, error: `Upload operation failed: ${error}` };
	}
}
