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
				options: [
					// File operations
					{ name: 'List Files', value: 'listFiles' },
					{ name: 'Search Files', value: 'searchFiles' },
					{ name: 'Download File', value: 'downloadFile' },
					{ name: 'Upload File', value: 'uploadFile' },
					{ name: 'Create Folder', value: 'createFolder' },
					{ name: 'Rename', value: 'rename' },
					{ name: 'Delete', value: 'delete' },
					{ name: 'Copy / Move', value: 'copyMove' },
					
					// File queries
					{ name: 'List Starred Files', value: 'listStarredFiles' },
					{ name: 'List Recent Files', value: 'listRecentFiles' },
					{ name: 'List Shared with Me', value: 'listSharedWithMe' },
					{ name: 'List Shared with Others', value: 'listSharedWithOthers' },
					{ name: 'Get File Ancestors', value: 'getAncestors' },
					
					// Sharing
					{ name: 'Create Share Link', value: 'createShareLink' },
					{ name: 'List Share Links', value: 'listShareLinks' },
					{ name: 'Update Share Permissions', value: 'updateSharePermissions' },
					
					// Labels
					{ name: 'List Labels', value: 'listLabels' },
					{ name: 'Create Label', value: 'createLabel' },
					{ name: 'Update Label', value: 'updateLabel' },
					{ name: 'Delete Label', value: 'deleteLabel' },
					{ name: 'Add Label to File', value: 'addLabelToFile' },
					{ name: 'List Files by Label', value: 'listFilesByLabel' },
					
					// File actions
					{ name: 'Star File', value: 'starFile' },
					{ name: 'Convert Office File', value: 'convertOffice' },
					
					// Team Folders
					{ name: 'List Team Folders', value: 'listTeamFolders' },
					{ name: 'Get Team Folder Members', value: 'getTeamFolderMembers' },
					
					// Webhooks
					{ name: 'Create Webhook', value: 'createWebhook' },
					{ name: 'List Webhooks', value: 'listWebhooks' },
					{ name: 'Get Webhook', value: 'getWebhook' },
					{ name: 'Update Webhook', value: 'updateWebhook' },
					{ name: 'Delete Webhook', value: 'deleteWebhook' },
					
					// File Advanced
					{ name: 'Get File Thumbnail', value: 'getFileThumbnail' },
					{ name: 'Upload from DSM', value: 'uploadFromDsm' },
					{ name: 'Request Access', value: 'requestAccess' },
					
					// Utility
					{ name: 'Custom Drive Call', value: 'customDriveCall' },
					{ name: 'List Drive APIs', value: 'listDriveApis' },
				],
				default: 'listFiles',
			},
			{ displayName: 'Path', name: 'path', type: 'string', default: '/', displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'downloadFile', 'createShareLink', 'rename', 'delete'] } } },
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
			{ displayName: 'Binary Field Name', name: 'downloadBinaryField', type: 'string', default: 'data', displayOptions: { show: { operation: ['downloadFile'] } }, description: 'The field name to store the downloaded file binary data' },
			// Labels
			{ displayName: 'Label Name', name: 'labelName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createLabel', 'updateLabel'] } } },
			{ displayName: 'Label Color', name: 'labelColor', type: 'options', options: [
				{ name: 'Red', value: 'red' },
				{ name: 'Orange', value: 'orange' },
				{ name: 'Yellow', value: 'yellow' },
				{ name: 'Green', value: 'green' },
				{ name: 'Blue', value: 'blue' },
				{ name: 'Purple', value: 'purple' },
			], default: 'blue', displayOptions: { show: { operation: ['createLabel', 'updateLabel'] } } },
			{ displayName: 'Label ID', name: 'labelId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['updateLabel', 'deleteLabel', 'listFilesByLabel'] } } },
			{ displayName: 'File Path', name: 'filePath', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['addLabelToFile', 'starFile'] } } },
			{ displayName: 'Label IDs (JSON)', name: 'labelIds', type: 'json', default: '[]', displayOptions: { show: { operation: ['addLabelToFile'] } } },
			
			// Team Folders
			{ displayName: 'Team Folder ID', name: 'teamFolderId', type: 'string', default: '', displayOptions: { show: { operation: ['getTeamFolderMembers'] } } },
			
			// Webhooks
			{ displayName: 'Webhook URL', name: 'webhookUrl', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createWebhook'] } } },
			{ displayName: 'Webhook Events (JSON)', name: 'webhookEvents', type: 'json', default: '["file.created"]', displayOptions: { show: { operation: ['createWebhook', 'updateWebhook'] } } },
			{ displayName: 'Webhook ID', name: 'webhookId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['deleteWebhook', 'getWebhook', 'updateWebhook'] } } },
			{ displayName: 'App ID', name: 'appId', type: 'string', default: 'n8n', displayOptions: { show: { operation: ['createWebhook', 'deleteWebhook', 'listWebhooks', 'getWebhook', 'updateWebhook'] } } },
			
			// File Advanced
			{ displayName: 'File Path', name: 'filePathThumbnail', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getFileThumbnail'] } }, description: 'Path to file for thumbnail' },
			{ displayName: 'Thumbnail Size', name: 'thumbnailSize', type: 'options', options: [
				{ name: 'Small (96x96)', value: 'small' },
				{ name: 'Medium (256x256)', value: 'medium' },
				{ name: 'Large (512x512)', value: 'large' },
			], default: 'medium', displayOptions: { show: { operation: ['getFileThumbnail'] } } },
			
			{ displayName: 'DSM Source Paths (JSON)', name: 'dsmSourcePaths', type: 'json', default: '[]', required: true, displayOptions: { show: { operation: ['uploadFromDsm'] } }, description: 'Paths on NAS shared folder to upload from' },
			{ displayName: 'Destination Folder', name: 'dsmDestFolder', type: 'string', default: '/', required: true, displayOptions: { show: { operation: ['uploadFromDsm'] } } },
			{ displayName: 'Conflict Action', name: 'dsmConflictAction', type: 'options', options: [
				{ name: 'Skip', value: 'skip' },
				{ name: 'Overwrite', value: 'overwrite' },
				{ name: 'Create Copy', value: 'copy' },
			], default: 'skip', displayOptions: { show: { operation: ['uploadFromDsm'] } } },
			
			{ displayName: 'File Path', name: 'filePathRequestAccess', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['requestAccess'] } }, description: 'Path to file you want to request access to' },
			
			// Sharing
			{ displayName: 'Share IDs (JSON)', name: 'shareIds', type: 'json', default: '[]', displayOptions: { show: { operation: ['updateSharePermissions'] } } },
			{ displayName: 'Permission Type', name: 'permissionType', type: 'options', options: [
				{ name: 'Viewer', value: 'viewer' },
				{ name: 'Editor', value: 'editor' },
				{ name: 'Commenter', value: 'commenter' },
			], default: 'viewer', displayOptions: { show: { operation: ['updateSharePermissions'] } } },
			
			// File operations
			{ displayName: 'Source Format', name: 'sourceFormat', type: 'string', default: '', displayOptions: { show: { operation: ['convertOffice'] } } },
			{ displayName: 'Target Format', name: 'targetFormat', type: 'string', default: 'docx', displayOptions: { show: { operation: ['convertOffice'] } } },
			
			// Limit / offset for queries
			{ displayName: 'Limit', name: 'limitQuery', type: 'number', default: 50, displayOptions: { show: { operation: ['listStarredFiles', 'listRecentFiles', 'listSharedWithMe', 'listSharedWithOthers', 'listFilesByLabel'] } } },
			{ displayName: 'Offset', name: 'offsetQuery', type: 'number', default: 0, displayOptions: { show: { operation: ['listStarredFiles', 'listRecentFiles', 'listSharedWithMe', 'listSharedWithOthers', 'listFilesByLabel'] } } },

			{ displayName: 'Extra Params (JSON)', name: 'extraParamsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['listFiles', 'searchFiles', 'downloadFile', 'createFolder', 'rename', 'delete', 'copyMove', 'createShareLink', 'listShareLinks', 'uploadFile'] } } },
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
			const driveFileApis = ['SYNO.SynologyDrive.Files', 'SYNO.SynologyDrive.File'];
			const driveLabelApis = ['SYNO.SynologyDrive.Labels', 'SYNO.SynologyDrive.Label'];
			const driveWebhookApis = ['SYNO.SynologyDrive.Webhooks', 'SYNO.SynologyDrive.Webhook'];

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
					const page = await dsm.callAny(['SYNO.FileStation.List', 'SYNO.FileStation.Browse'], ['list', 'get'], {
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
					const page = await dsm.callAny(['SYNO.FileStation.List', 'SYNO.FileStation.Browse'], ['list', 'get'], {
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

				// Use FileStation.List instead of Search (Search API doesn't return results properly)
				// Don't use pattern param - it doesn't work reliably via API
				// Return all files and let client-side filter by keyword
				const result = await dsm.callAny(['SYNO.FileStation.List', 'SYNO.FileStation.Browse'], ['list', 'get'], {
					folder_path: path,
					recursive,
					limit,
					...extraParams,
				});

				const data = (result.data || {}) as IDataObject;
				const allFiles = (data.files || []) as IDataObject[];

				// Client-side filtering by keyword (case-insensitive)
				const filteredFiles = keyword
					? allFiles.filter((f) => {
							const name = String(f.name || '').toLowerCase();
							return name.includes(keyword.toLowerCase());
						})
					: allFiles;

				return {
					success: true,
					data: {
						...data,
						files: filteredFiles,
						total_files: allFiles.length,
						matched_count: filteredFiles.length,
						keyword_used: keyword,
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

			if (operation === 'downloadFile') {
				const path = this.getNodeParameter('path', i) as string;
				const downloadBinaryField = this.getNodeParameter('downloadBinaryField', i) as string;

				try {
					const buffer = await dsm.downloadFile(path);
					const fileName = path.split('/').pop() || 'downloaded_file';
					
					// Return in n8n binary format
					return {
						json: {
							success: true,
							metadata: {
								fileName,
								size: buffer.length,
								path,
							},
						},
						binary: {
							[downloadBinaryField]: {
								data: buffer,
								mimeType: 'application/octet-stream',
								fileName: fileName,
							},
						},
					};
				} catch (error) {
					return { success: false, error: `Download failed: ${error}` };
				}
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
						return dsm.uploadFile(buffer, uploadFileName, uploadDestPath, uploadOverwrite, uploadCreateParents);
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
						return dsm.uploadFile(buffer, fileName, uploadDestPath, uploadOverwrite, uploadCreateParents);
					} catch (error) {
						return { success: false, error: `URL download failed: ${error}` };
					}
				}
			}

			// FILE QUERIES
			if (operation === 'listStarredFiles') {
				const limit = this.getNodeParameter('limitQuery', i) as number;
				const offset = this.getNodeParameter('offsetQuery', i) as number;
				return dsm.callAny(driveFileApis, ['list_starred', 'starred', 'list'], { limit, offset, ...extraParams });
			}

			if (operation === 'listRecentFiles') {
				const limit = this.getNodeParameter('limitQuery', i) as number;
				const offset = this.getNodeParameter('offsetQuery', i) as number;
				return dsm.callAny(driveFileApis, ['list_recent', 'recent', 'list'], { limit, offset, ...extraParams });
			}

			if (operation === 'listSharedWithMe') {
				const limit = this.getNodeParameter('limitQuery', i) as number;
				const offset = this.getNodeParameter('offsetQuery', i) as number;
				return dsm.callAny(driveFileApis, ['list_shared_with_me', 'shared_with_me', 'list'], { limit, offset, ...extraParams });
			}

			if (operation === 'listSharedWithOthers') {
				const limit = this.getNodeParameter('limitQuery', i) as number;
				const offset = this.getNodeParameter('offsetQuery', i) as number;
				return dsm.callAny(driveFileApis, ['list_shared_with_others', 'shared_with_others', 'list'], { limit, offset, ...extraParams });
			}

			if (operation === 'getAncestors') {
				const path = this.getNodeParameter('path', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'get_ancestors', { path, ...extraParams });
			}

			// LABELS
			if (operation === 'listLabels') {
				return dsm.callAny(driveLabelApis, ['list', 'get'], { ...extraParams });
			}

			if (operation === 'createLabel') {
				const labelName = this.getNodeParameter('labelName', i) as string;
				const labelColor = this.getNodeParameter('labelColor', i) as string;
				return dsm.callAny(driveLabelApis, ['create', 'add'], { 
					name: labelName, 
					color: labelColor, 
					...extraParams 
				});
			}

			if (operation === 'updateLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				const labelName = this.getNodeParameter('labelName', i) as string;
				const labelColor = this.getNodeParameter('labelColor', i) as string;
				return dsm.callAny(driveLabelApis, ['update', 'set'], { 
					label_id: labelId,
					name: labelName, 
					color: labelColor, 
					...extraParams 
				});
			}

			if (operation === 'deleteLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				return dsm.callAny(driveLabelApis, ['delete', 'remove'], { label_id: labelId, ...extraParams });
			}

			if (operation === 'addLabelToFile') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				const labelIds = this.getNodeParameter('labelIds', i) as string[];
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'add_label', { 
					path: filePath, 
					label_ids: labelIds, 
					...extraParams 
				});
			}

			if (operation === 'listFilesByLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				const limit = this.getNodeParameter('limitQuery', i) as number;
				const offset = this.getNodeParameter('offsetQuery', i) as number;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'list_labelled', { 
					label_id: labelId, 
					limit, 
					offset, 
					...extraParams 
				});
			}

			// FILE ACTIONS
			if (operation === 'starFile') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'star', { path: filePath, ...extraParams });
			}

			if (operation === 'convertOffice') {
				const filePath = this.getNodeParameter('filePath', i) as string;
				const sourceFormat = this.getNodeParameter('sourceFormat', i) as string;
				const targetFormat = this.getNodeParameter('targetFormat', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'convert_office', { 
					path: filePath,
					source_format: sourceFormat,
					target_format: targetFormat,
					...extraParams 
				});
			}

			// TEAM FOLDERS
			if (operation === 'listTeamFolders') {
				return dsm.callAuto('SYNO.SynologyDrive.TeamFolder', 'list', { ...extraParams });
			}

			if (operation === 'getTeamFolderMembers') {
				const teamFolderId = this.getNodeParameter('teamFolderId', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.TeamFolder', 'get_members', { 
					team_folder_id: teamFolderId, 
					...extraParams 
				});
			}

			// WEBHOOKS
			if (operation === 'createWebhook') {
				const webhookUrl = this.getNodeParameter('webhookUrl', i) as string;
				const webhookEvents = this.getNodeParameter('webhookEvents', i) as string[];
				const appId = this.getNodeParameter('appId', i) as string;
				return dsm.callAny(driveWebhookApis, ['create', 'add'], { 
					app_id: appId,
					url: webhookUrl,
					events: webhookEvents,
					...extraParams 
				});
			}

			if (operation === 'listWebhooks') {
				const appId = this.getNodeParameter('appId', i) as string;
				return dsm.callAny(driveWebhookApis, ['list', 'get'], { 
					app_id: appId,
					...extraParams 
				});
			}

			if (operation === 'deleteWebhook') {
				const webhookId = this.getNodeParameter('webhookId', i) as string;
				const appId = this.getNodeParameter('appId', i) as string;
				return dsm.callAny(driveWebhookApis, ['delete', 'remove'], { 
					webhook_id: webhookId,
					app_id: appId,
					...extraParams 
				});
			}

			if (operation === 'getWebhook') {
				const webhookId = this.getNodeParameter('webhookId', i) as string;
				const appId = this.getNodeParameter('appId', i) as string;
				return dsm.callAny(driveWebhookApis, ['get', 'list'], { 
					webhook_id: webhookId,
					app_id: appId,
					...extraParams 
				});
			}

			if (operation === 'updateWebhook') {
				const webhookId = this.getNodeParameter('webhookId', i) as string;
				const appId = this.getNodeParameter('appId', i) as string;
				const webhookEvents = this.getNodeParameter('webhookEvents', i) as string[];
				return dsm.callAny(driveWebhookApis, ['update', 'set'], { 
					webhook_id: webhookId,
					app_id: appId,
					events: webhookEvents,
					...extraParams 
				});
			}

			// FILE ADVANCED
			if (operation === 'getFileThumbnail') {
				const filePathThumbnail = this.getNodeParameter('filePathThumbnail', i) as string;
				const thumbnailSize = this.getNodeParameter('thumbnailSize', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'get_thumbnail', { 
					path: filePathThumbnail,
					size: thumbnailSize,
					...extraParams 
				});
			}

			if (operation === 'uploadFromDsm') {
				const dsmSourcePaths = this.getNodeParameter('dsmSourcePaths', i) as string[];
				const dsmDestFolder = this.getNodeParameter('dsmDestFolder', i) as string;
				const dsmConflictAction = this.getNodeParameter('dsmConflictAction', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'upload_from_dsm', { 
					dsm_paths: dsmSourcePaths,
					path: dsmDestFolder,
					conflict_action: dsmConflictAction,
					...extraParams 
				});
			}

			if (operation === 'requestAccess') {
				const filePathRequestAccess = this.getNodeParameter('filePathRequestAccess', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Files', 'request_access', { 
					path: filePathRequestAccess,
					...extraParams 
				});
			}

			// SHARING ADVANCED
			if (operation === 'updateSharePermissions') {
				const shareIds = this.getNodeParameter('shareIds', i) as string[];
				const permissionType = this.getNodeParameter('permissionType', i) as string;
				return dsm.callAuto('SYNO.SynologyDrive.Sharing', 'update_permissions', { 
					share_ids: shareIds,
					permission_type: permissionType,
					...extraParams 
				});
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
			return dsm.callAuto(api, method, paramsJson || {});
		});
	}
}
