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

export class SynologyOffice implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Office',
		name: 'synologyOffice',
		icon: 'file:synology.png',
		group: ['transform'],
		version: 1,
		description: 'Synology Office / Spreadsheet helper node',
		defaults: { name: 'Synology Office' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'getInfo',
				options: [
					{ name: 'Get Office Info', value: 'getInfo' },
					{ name: 'List Office APIs', value: 'listOfficeApis' },
					{ name: 'List Spreadsheets', value: 'listSpreadsheets' },
					{ name: 'Get Sheet Metadata', value: 'getSheetMetadata' },
					{ name: 'Read Range / Cells', value: 'readRange' },
					{ name: 'Write Range / Cells', value: 'writeRange' },
					{ name: 'Append Row', value: 'appendRow' },
					{ name: 'Custom Office Call', value: 'customOfficeCall' },
				],
			},
			{ displayName: 'Folder ID', name: 'folderId', type: 'string', default: '0', displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listSpreadsheets'] } } },
			{ displayName: 'Spreadsheet File ID', name: 'fileId', type: 'string', default: '', displayOptions: { show: { operation: ['getSheetMetadata', 'readRange', 'writeRange', 'appendRow'] } } },
			{ displayName: 'Sheet ID', name: 'sheetId', type: 'string', default: '', displayOptions: { show: { operation: ['getSheetMetadata', 'readRange', 'writeRange', 'appendRow'] } } },
			{ displayName: 'Range (A1)', name: 'range', type: 'string', default: 'A1:C10', displayOptions: { show: { operation: ['readRange', 'writeRange'] } } },
			{ displayName: 'Row Values (JSON Array)', name: 'rowValues', type: 'json', default: '["v1","v2"]', displayOptions: { show: { operation: ['appendRow'] } } },
			{ displayName: 'Values (2D JSON Array)', name: 'values', type: 'json', default: '[["v1","v2"]]', displayOptions: { show: { operation: ['writeRange'] } } },
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.Office.Info', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'get', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customOfficeCall'] } } },
			{ displayName: 'Extra Params (JSON)', name: 'extraParamsJson', type: 'json', default: '{}', description: 'Optional params merged into the API call. Useful when your DSM uses different parameter names.', displayOptions: { show: { operation: ['listSpreadsheets', 'getSheetMetadata', 'readRange', 'writeRange', 'appendRow'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const extraParams = parseJsonParam(this.getNodeParameter('extraParamsJson', i, {}));

			if (operation === 'getInfo') {
				return dsm.callAuto('SYNO.Office.Info', 'get', {});
			}

			if (operation === 'listOfficeApis') {
				return dsm.queryApis('SYNO.Office.*');
			}

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
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Shard', 'SYNO.Office.Node'], ['get_range', 'read', 'get_cells', 'get'], {
					file_id: fileId,
					sheet_id: sheetId || undefined,
					range,
					...extraParams,
				});
			}

			if (operation === 'writeRange') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const range = this.getNodeParameter('range', i) as string;
				const values = this.getNodeParameter('values', i) as string[] | string[][] | IDataObject;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Shard', 'SYNO.Office.Node'], ['set_range', 'write', 'update', 'set_cells', 'set'], {
					file_id: fileId,
					sheet_id: sheetId || undefined,
					range,
					values: values as any,
					...extraParams,
				});
			}

			if (operation === 'appendRow') {
				const fileId = this.getNodeParameter('fileId', i) as string;
				const sheetId = this.getNodeParameter('sheetId', i) as string;
				const rowValues = this.getNodeParameter('rowValues', i) as string[] | IDataObject;
				return dsm.callAny(['SYNO.Office.Sheet', 'SYNO.Office.Shard', 'SYNO.Office.Node'], ['append_row', 'append', 'insert_row', 'add_row'], {
					file_id: fileId,
					sheet_id: sheetId || undefined,
					values: rowValues as any,
					...extraParams,
				});
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
			return dsm.callAuto(api, method, paramsJson || {});
		});
	}
}
