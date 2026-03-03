import type {
	IDataObject,
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeType,
	INodeTypeDescription,
	INodePropertyOptions,
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

export class SynologySheets implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Sheets',
		name: 'synologySheets',
		icon: 'file:synology-sheets.svg',
		group: ['transform'],
		version: 1,
		description: 'Synology Sheets / Spreadsheet operations',
		defaults: { name: 'Synology Sheets' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listSpreadsheets',
				options: [
					{ name: 'List Spreadsheets', value: 'listSpreadsheets' },
					{ name: 'Get Spreadsheet Metadata', value: 'getSpreadsheetMetadata' },
					{ name: 'List Sheets', value: 'listSheets' },
					{ name: 'Get Sheet Metadata', value: 'getSheetMetadata' },
					{ name: 'Read Range / Cells', value: 'readRange' },
					{ name: 'Write Range / Cells', value: 'writeRange' },
					{ name: 'Append Row', value: 'appendRow' },
					{ name: 'Get Row', value: 'getRow' },
					{ name: 'Update Row', value: 'updateRow' },
					{ name: 'Delete Row', value: 'deleteRow' },
					{ name: 'Insert Row', value: 'insertRow' },
					{ name: 'Delete Column', value: 'deleteColumn' },
					{ name: 'Insert Column', value: 'insertColumn' },
					{ name: 'Clear Range', value: 'clearRange' },
					{ name: 'Create Sheet', value: 'createSheet' },
					{ name: 'Delete Sheet', value: 'deleteSheet' },
					{ name: 'Rename Sheet', value: 'renameSheet' },
					{ name: 'Set Column Width', value: 'setColumnWidth' },
					{ name: 'Set Row Height', value: 'setRowHeight' },
					{ name: 'Merge Cells', value: 'mergeCells' },
					{ name: 'Unmerge Cells', value: 'unmergeCells' },
					{ name: 'Get Named Range', value: 'getNamedRange' },
					{ name: 'Create Named Range', value: 'createNamedRange' },
					{ name: 'Delete Named Range', value: 'deleteNamedRange' },
					{ name: 'List Sheets APIs', value: 'listSheetsApis' },
					{ name: 'Custom Office Call', value: 'customOfficeCall' },
				],
			},
			// List Spreadsheets
			{ displayName: 'Folder', name: 'folderId', type: 'options', default: '0', options: [{ name: 'Root', value: '0' }], displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			
			// Spreadsheet selector (dynamic dropdown)
			{
				displayName: 'Spreadsheet',
				name: 'fileId',
				type: 'options',
				default: '',
				required: true,
				typeOptions: {
					loadOptionsMethod: 'getSpreadsheets',
					searchable: true,
				},
				displayOptions: {
					show: {
						operation: ['getSpreadsheetMetadata', 'listSheets', 'getSheetMetadata', 'readRange', 'writeRange', 'appendRow', 'getRow', 'updateRow', 'deleteRow', 'insertRow', 'deleteColumn', 'insertColumn', 'clearRange', 'createSheet', 'deleteSheet', 'renameSheet', 'setColumnWidth', 'setRowHeight', 'mergeCells', 'unmergeCells', 'getNamedRange', 'createNamedRange', 'deleteNamedRange'],
					},
				},
			},
			
			// Sheet selector (dynamic dropdown, depends on fileId)
			{
				displayName: 'Sheet',
				name: 'sheetId',
				type: 'options',
				default: '',
				typeOptions: {
					loadOptionsMethod: 'getSheets',
					searchable: true,
				},
				displayOptions: {
					show: {
						operation: ['getSheetMetadata', 'readRange', 'writeRange', 'appendRow', 'getRow', 'updateRow', 'deleteRow', 'insertRow', 'deleteColumn', 'insertColumn', 'clearRange', 'renameSheet', 'setColumnWidth', 'setRowHeight', 'mergeCells', 'unmergeCells'],
					},
				},
			},
			
			// Read/Write Range
			{ displayName: 'Range (A1 notation)', name: 'range', type: 'string', default: 'A1:C10', placeholder: 'A1:C10', displayOptions: { show: { operation: ['readRange', 'writeRange', 'clearRange', 'mergeCells'] } } },
			
			// Write values
			{ displayName: 'Values (2D JSON Array)', name: 'values', type: 'json', default: '[["v1","v2"],["v3","v4"]]', displayOptions: { show: { operation: ['writeRange'] } } },
			
			// Append row
			{ displayName: 'Row Values (JSON Array)', name: 'rowValues', type: 'json', default: '["v1","v2"]', displayOptions: { show: { operation: ['appendRow'] } } },
			
			// Get row by index
			{ displayName: 'Row Index', name: 'rowIndex', type: 'number', default: 0, displayOptions: { show: { operation: ['getRow', 'deleteRow', 'setRowHeight'] } } },
			
			// Update row
			{ displayName: 'Row Index', name: 'rowIndexUpdate', type: 'number', default: 0, displayOptions: { show: { operation: ['updateRow'] } } },
			{ displayName: 'Updated Values (JSON Array)', name: 'updatedValues', type: 'json', default: '["v1","v2"]', displayOptions: { show: { operation: ['updateRow'] } } },
			
			// Insert row
			{ displayName: 'Insert After Row Index', name: 'insertAfterIndex', type: 'number', default: 0, displayOptions: { show: { operation: ['insertRow'] } } },
			{ displayName: 'Count', name: 'insertRowCount', type: 'number', default: 1, displayOptions: { show: { operation: ['insertRow'] } } },
			
			// Column operations
			{ displayName: 'Column Letter (A, B, C...)', name: 'columnLetter', type: 'string', default: 'A', displayOptions: { show: { operation: ['deleteColumn', 'insertColumn', 'setColumnWidth'] } } },
			{ displayName: 'Column Count', name: 'columnCount', type: 'number', default: 1, displayOptions: { show: { operation: ['deleteColumn', 'insertColumn'] } } },
			{ displayName: 'Width (pixels)', name: 'columnWidth', type: 'number', default: 100, displayOptions: { show: { operation: ['setColumnWidth'] } } },
			
			// Row height
			{ displayName: 'Height (pixels)', name: 'rowHeight', type: 'number', default: 20, displayOptions: { show: { operation: ['setRowHeight'] } } },
			
			// Merge/unmerge cells
			{ displayName: 'Merge Range (A1:B2)', name: 'mergeRange', type: 'string', default: 'A1:B2', displayOptions: { show: { operation: ['mergeCells', 'unmergeCells'] } } },
			
			// Create sheet
			{ displayName: 'New Sheet Name', name: 'newSheetName', type: 'string', default: 'Sheet1', displayOptions: { show: { operation: ['createSheet'] } } },
			
			// Delete/rename sheet
			{ displayName: 'Sheet ID to Delete', name: 'sheetIdDelete', type: 'string', default: '', displayOptions: { show: { operation: ['deleteSheet'] } } },
			
			// Rename sheet
			{ displayName: 'New Name', name: 'sheetNewName', type: 'string', default: 'New Name', displayOptions: { show: { operation: ['renameSheet'] } } },
			
			// Named ranges
			{ displayName: 'Named Range Name', name: 'namedRangeName', type: 'string', default: 'MyRange', displayOptions: { show: { operation: ['getNamedRange', 'createNamedRange', 'deleteNamedRange'] } } },
			{ displayName: 'Named Range Scope (sheet or workbook)', name: 'namedRangeScope', type: 'string', default: 'workbook', displayOptions: { show: { operation: ['createNamedRange'] } } },
			
			// Custom call
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.Office.Sheet', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'list', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			
			// Extra params
			{ displayName: 'Extra Params (JSON)', name: 'extraParamsJson', type: 'json', default: '{}', description: 'Optional params merged into the API call', displayOptions: { show: { operation: ['listSpreadsheets', 'listSheets', 'readRange', 'writeRange', 'appendRow', 'getRow', 'updateRow', 'deleteRow', 'insertRow', 'clearRange', 'createSheet', 'deleteSheet', 'mergeCells'] } } },
		],
	};

	// Load options for Spreadsheets dropdown
	async getSpreadsheets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
			const dsm = new DsmClient(creds);
			
			const result = await dsm.callAny(['SYNO.Office.File', 'SYNO.Office.OFile'], ['list', 'query'], {
				folder_id: '0',
				offset: 0,
				limit: 100,
				type: 'spreadsheet',
			});

			const data = (result.data || {}) as IDataObject;
			const files = (data.files || []) as IDataObject[];

			return files.map((file: IDataObject) => ({
				name: `${file.name || 'Unnamed'} (${file.id || 'N/A'})`,
				value: String(file.id || ''),
			}));
		} catch (error) {
			return [];
		}
	}

	// Load options for Sheets dropdown (depends on selected fileId)
	async getSheets(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
		try {
			const fileId = this.getCurrentNodeParameter('fileId') as string;
			if (!fileId) return [];

			const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
			const dsm = new DsmClient(creds);

			const result = await dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node'], ['list', 'query', 'get'], {
				file_id: fileId,
			});

			const data = (result.data || {}) as IDataObject;
			const sheets = (data.sheets || data.nodes || []) as IDataObject[];

			return sheets.map((sheet: IDataObject) => ({
				name: `${sheet.title || sheet.name || 'Unnamed'} (${sheet.id || 'N/A'})`,
				value: String(sheet.id || ''),
			}));
		} catch (error) {
			return [];
		}
	}

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const extraParams = parseJsonParam(this.getNodeParameter('extraParamsJson', i, {}));

			if (operation === 'listSpreadsheets') {
				const folderId = this.getNodeParameter('folderId', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAny(['SYNO.Office.File', 'SYNO.Office.OFile'], ['list', 'query'], {
					folder_id: folderId,
					offset,
					limit,
					type: 'spreadsheet',
					...extraParams,
				});
			}

			if (operation === 'getSpreadsheetMetadata') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				return dsm.callAny(['SYNO.Office.File', 'SYNO.Office.OFile'], ['get', 'info', 'load'], {
					file_id: fileId,
					...extraParams,
				});
			}

			if (operation === 'listSheets') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node'], ['list', 'query', 'get'], {
					file_id: fileId,
					...extraParams,
				});
			}

			if (operation === 'getSheetMetadata') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node', 'SYNO.Office.File'], ['get', 'info', 'load'], {
					file_id: fileId,
					sheet_id: sheetId || undefined,
					...extraParams,
				});
			}

			if (operation === 'readRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const range = this.getNodeParameter('range', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['read', 'get', 'query'], {
					file_id: fileId,
					sheet_id: sheetId,
					range,
					...extraParams,
				});
			}

			if (operation === 'writeRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const range = this.getNodeParameter('range', i) as string;
				const values = this.getNodeParameter('values', i) as unknown;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['write', 'set', 'update'], {
					file_id: fileId,
					sheet_id: sheetId,
					range,
					values: typeof values === 'string' ? JSON.parse(values) : values,
					...extraParams,
				});
			}

			if (operation === 'appendRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowValues = this.getNodeParameter('rowValues', i) as unknown;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['append', 'insert', 'add'], {
					file_id: fileId,
					sheet_id: sheetId,
					values: [typeof rowValues === 'string' ? JSON.parse(rowValues) : rowValues],
					...extraParams,
				});
			}

			if (operation === 'getRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowIndex = this.getNodeParameter('rowIndex', i) as number;
				const range = `A${rowIndex + 1}:Z${rowIndex + 1}`;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['read', 'get', 'query'], {
					file_id: fileId,
					sheet_id: sheetId,
					range,
					...extraParams,
				});
			}

			if (operation === 'updateRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowIndex = this.getNodeParameter('rowIndexUpdate', i) as number;
				const updatedValues = this.getNodeParameter('updatedValues', i) as unknown;
				const range = `A${rowIndex + 1}:Z${rowIndex + 1}`;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['write', 'set', 'update'], {
					file_id: fileId,
					sheet_id: sheetId,
					range,
					values: [typeof updatedValues === 'string' ? JSON.parse(updatedValues) : updatedValues],
					...extraParams,
				});
			}

			if (operation === 'deleteRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowIndex = this.getNodeParameter('rowIndex', i) as number;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['delete', 'remove', 'clear'], {
					file_id: fileId,
					sheet_id: sheetId,
					range: `${rowIndex}:${rowIndex}`,
					dimension: 'ROWS',
					...extraParams,
				});
			}

			if (operation === 'insertRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const insertAfterIndex = this.getNodeParameter('insertAfterIndex', i) as number;
				const insertRowCount = this.getNodeParameter('insertRowCount', i) as number;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['insert', 'add'], {
					file_id: fileId,
					sheet_id: sheetId,
					index: insertAfterIndex,
					dimension: 'ROWS',
					count: insertRowCount,
					...extraParams,
				});
			}

			if (operation === 'deleteColumn') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const columnLetter = this.getNodeParameter('columnLetter', i) as string;
				const columnCount = this.getNodeParameter('columnCount', i) as number;
				const columnIndex = columnLetter.charCodeAt(0) - 65;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['delete', 'remove'], {
					file_id: fileId,
					sheet_id: sheetId,
					index: columnIndex,
					dimension: 'COLUMNS',
					count: columnCount,
					...extraParams,
				});
			}

			if (operation === 'insertColumn') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const columnLetter = this.getNodeParameter('columnLetter', i) as string;
				const columnCount = this.getNodeParameter('columnCount', i) as number;
				const columnIndex = columnLetter.charCodeAt(0) - 65;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['insert', 'add'], {
					file_id: fileId,
					sheet_id: sheetId,
					index: columnIndex,
					dimension: 'COLUMNS',
					count: columnCount,
					...extraParams,
				});
			}

			if (operation === 'clearRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const range = this.getNodeParameter('range', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['clear', 'delete', 'write'], {
					file_id: fileId,
					sheet_id: sheetId,
					range,
					values: [],
					...extraParams,
				});
			}

			if (operation === 'createSheet') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const newSheetName = this.getNodeParameter('newSheetName', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node'], ['create', 'insert', 'add'], {
					file_id: fileId,
					title: newSheetName,
					...extraParams,
				});
			}

			if (operation === 'deleteSheet') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetIdDelete = this.getNodeParameter('sheetIdDelete', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node'], ['delete', 'remove'], {
					file_id: fileId,
					sheet_id: sheetIdDelete,
					...extraParams,
				});
			}

			if (operation === 'renameSheet') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const sheetNewName = this.getNodeParameter('sheetNewName', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Node'], ['update', 'set', 'rename'], {
					file_id: fileId,
					sheet_id: sheetId,
					title: sheetNewName,
					...extraParams,
				});
			}

			if (operation === 'setColumnWidth') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const columnLetter = this.getNodeParameter('columnLetter', i) as string;
				const columnWidth = this.getNodeParameter('columnWidth', i) as number;
				const columnIndex = columnLetter.charCodeAt(0) - 65;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['set', 'update', 'format'], {
					file_id: fileId,
					sheet_id: sheetId,
					column: columnIndex,
					width: columnWidth,
					...extraParams,
				});
			}

			if (operation === 'setRowHeight') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowIndex = this.getNodeParameter('rowIndex', i) as number;
				const rowHeight = this.getNodeParameter('rowHeight', i) as number;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['set', 'update', 'format'], {
					file_id: fileId,
					sheet_id: sheetId,
					row: rowIndex,
					height: rowHeight,
					...extraParams,
				});
			}

			if (operation === 'mergeCells') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const mergeRange = this.getNodeParameter('mergeRange', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['merge', 'set'], {
					file_id: fileId,
					sheet_id: sheetId,
					range: mergeRange,
					...extraParams,
				});
			}

			if (operation === 'unmergeCells') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const mergeRange = this.getNodeParameter('mergeRange', i) as string;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Range'], ['unmerge', 'delete', 'clear'], {
					file_id: fileId,
					sheet_id: sheetId,
					range: mergeRange,
					...extraParams,
				});
			}

			if (operation === 'getNamedRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const namedRangeName = this.getNodeParameter('namedRangeName', i) as string;
				return dsm.callAny(['SYNO.Office.NamedRange', 'SYNO.Office.Sheet'], ['get', 'query'], {
					file_id: fileId,
					name: namedRangeName,
					...extraParams,
				});
			}

			if (operation === 'createNamedRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const namedRangeName = this.getNodeParameter('namedRangeName', i) as string;
				const range = this.getNodeParameter('range', i) as string;
				const namedRangeScope = this.getNodeParameter('namedRangeScope', i) as string;
				return dsm.callAny(['SYNO.Office.NamedRange', 'SYNO.Office.Sheet'], ['create', 'insert', 'add'], {
					file_id: fileId,
					name: namedRangeName,
					range,
					scope: namedRangeScope,
					...extraParams,
				});
			}

			if (operation === 'deleteNamedRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const namedRangeName = this.getNodeParameter('namedRangeName', i) as string;
				return dsm.callAny(['SYNO.Office.NamedRange', 'SYNO.Office.Sheet'], ['delete', 'remove'], {
					file_id: fileId,
					name: namedRangeName,
					...extraParams,
				});
			}

			if (operation === 'listSheetsApis') {
				return dsm.queryApis('SYNO.Office.Sheet.*,SYNO.Office.Range.*,SYNO.Office.NamedRange.*');
			}

			if (operation === 'customOfficeCall') {
				const api = this.getNodeParameter('api', i) as string;
				const method = this.getNodeParameter('method', i) as string;
				const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
				return dsm.callAuto(api, method, paramsJson);
			}

			return { error: 'Unknown operation' };
		});
	}
}
