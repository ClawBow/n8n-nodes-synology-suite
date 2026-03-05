import type {
	IDataObject,
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import axios from 'axios';

interface SpreadsheetApiCredentials {
	baseUrl: string;
	username: string;
	password: string;
	host: string;
	protocol: string;
}

interface SheetInfo {
	title: string;
	sheetId: string;
	index: number;
}

interface ColumnMapEntry {
	column: string;
	inputField: string;
}

export class SynologySheets implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Sheets',
		name: 'synologySheets',
		icon: 'file:synology-sheets.svg',
		group: ['transform'],
		version: 1,
		description: 'Create, read, write, and manage Synology spreadsheets via Docker API',
		subtitle: '={{$parameter["operation"]}}',
		defaults: { name: 'Synology Sheets' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologySpreadsheetApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'createSpreadsheet',
				description: 'The operation to perform',
				options: [
					{ name: 'Create Spreadsheet', value: 'createSpreadsheet', description: 'Create a new spreadsheet' },
					{ name: 'Get Spreadsheet', value: 'getSpreadsheet', description: 'Get spreadsheet metadata' },
					{ name: 'Read Cells', value: 'readCells', description: 'Read cell values from a range' },
					{ name: 'Write Cells', value: 'writeCells', description: 'Write values to cells' },
					{ name: 'Append Rows', value: 'appendRows', description: 'Append rows to a spreadsheet' },
					{ name: 'Add Sheet', value: 'addSheet', description: 'Add a new sheet' },
					{ name: 'Rename Sheet', value: 'renameSheet', description: 'Rename a sheet' },
					{ name: 'Delete Sheet', value: 'deleteSheet', description: 'Delete a sheet' },
					{ name: 'Delete Spreadsheet', value: 'deleteSpreadsheet', description: 'Delete a spreadsheet' },
					{ name: 'Format Cells', value: 'formatCells', description: 'Format cells with styling' },
					{ name: 'Read Cell Styles', value: 'readStyles', description: 'Read formatting/styles from cells' },
					{ name: 'Export Sheet as CSV', value: 'exportCsv', description: 'Export sheet to CSV (binary)' },
					{ name: 'Export Spreadsheet as XLSX', value: 'exportXlsx', description: 'Export spreadsheet to XLSX (binary)' },
					{ name: 'Batch Update', value: 'batchUpdate', description: 'Perform batch operations (insert/delete rows/columns)' },
				],
			},

			// Create Spreadsheet
			{
				displayName: 'Spreadsheet Name',
				name: 'spreadsheetName',
				type: 'string',
				default: 'New Spreadsheet',
				required: true,
				displayOptions: { show: { operation: ['createSpreadsheet'] } },
				description: 'Name for the new spreadsheet',
			},

			// Spreadsheet ID
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheetId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['getSpreadsheet', 'readCells', 'writeCells', 'appendRows', 'addSheet', 'renameSheet', 'deleteSheet', 'deleteSpreadsheet'],
					},
				},
				description: 'The spreadsheet ID (e.g., 17Hx...)',
			},

			// Sheet ID - simple text input
			{
				displayName: 'Sheet ID',
				name: 'sheetId',
				type: 'string',
				default: 'sh_1',
				required: true,
				displayOptions: {
					show: {
						operation: ['readCells', 'writeCells', 'appendRows', 'renameSheet', 'deleteSheet'],
					},
				},
				description: 'Sheet ID (e.g., sh_1, sh_2, sh_3). Use "Get Spreadsheet" operation first to discover all available sheet IDs in your spreadsheet.',
			},

			// Sheet Name for new sheets
			{
				displayName: 'Sheet Name',
				name: 'sheetName',
				type: 'string',
				default: 'New Sheet',
				required: true,
				displayOptions: { show: { operation: ['addSheet', 'renameSheet'] } },
				description: 'Name for the sheet',
			},

			// Cell Range
			{
				displayName: 'Cell Range',
				name: 'cellRange',
				type: 'string',
				default: 'Sheet1!A1:B2',
				required: true,
				displayOptions: {
					show: {
						operation: ['readCells', 'writeCells'],
					},
				},
				description: 'Cell range (e.g., "Sheet1!A1:B2")',
			},

			// Simple Values mode (for Write/Append)
			{
				displayName: 'Input Type',
				name: 'inputType',
				type: 'options',
				default: 'manual',
				displayOptions: {
					show: {
						operation: ['writeCells', 'appendRows'],
					},
				},
				options: [
					{ name: 'Manual Values', value: 'manual' },
					{ name: 'Column Mapping', value: 'mapping' },
				],
				description: 'How to input data',
			},

			// Manual JSON values
			{
				displayName: 'Values',
				name: 'values',
				type: 'json',
				default: '[["Header1","Header2"],["Value1","Value2"]]',
				required: true,
				displayOptions: {
					show: {
						operation: ['writeCells', 'appendRows'],
						inputType: ['manual'],
					},
				},
				description: 'JSON array of arrays with cell values',
			},

			// Column Mapping mode
			{
				displayName: 'Auto-Detect Headers',
				name: 'autoDetectHeaders',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						operation: ['appendRows'],
						inputType: ['mapping'],
					},
				},
				description: 'Read first row as column headers',
			},

			{
				displayName: 'Column Mapping',
				name: 'columnMapping',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: { values: [{ column: '', inputField: '' }] },
				displayOptions: {
					show: {
						operation: ['appendRows'],
						inputType: ['mapping'],
					},
				},
				options: [
					{
						name: 'values',
						displayName: 'Column Mappings',
						values: [
							{
								displayName: 'Column Letter',
								name: 'column',
								type: 'string',
								default: 'A',
								description: 'Column (A, B, C, ...)',
							},
							{
								displayName: 'Input Field Name',
								name: 'inputField',
								type: 'string',
								default: '',
								description: 'Field from input data',
							},
						],
					},
				],
			},

			// Read Styles
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheetIdStyles',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['readStyles'] } },
				description: 'ID of the spreadsheet',
			},
			{
				displayName: 'Range',
				name: 'rangeStyles',
				type: 'string',
				default: 'Sheet1!A1:Z100',
				required: true,
				displayOptions: { show: { operation: ['readStyles'] } },
				description: 'Cell range (e.g. Sheet1!A1:C10)',
			},

			// Export CSV
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheetIdCsv',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['exportCsv'] } },
				description: 'ID of the spreadsheet',
			},
			{
				displayName: 'Sheet Name',
				name: 'sheetNameCsv',
				type: 'string',
				default: 'Sheet1',
				displayOptions: { show: { operation: ['exportCsv'] } },
				description: 'Name of the sheet to export',
			},
			{
				displayName: 'Binary Field Name',
				name: 'binaryFieldCsv',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['exportCsv'] } },
				description: 'Field name to store CSV binary data',
			},

			// Export XLSX
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheetIdXlsx',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['exportXlsx'] } },
				description: 'ID of the spreadsheet',
			},
			{
				displayName: 'Binary Field Name',
				name: 'binaryFieldXlsx',
				type: 'string',
				default: 'data',
				displayOptions: { show: { operation: ['exportXlsx'] } },
				description: 'Field name to store XLSX binary data',
			},

			// Batch Update
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheetIdBatch',
				type: 'string',
				default: '',
				required: true,
				displayOptions: { show: { operation: ['batchUpdate'] } },
				description: 'ID of the spreadsheet',
			},
			{
				displayName: 'Operations (JSON)',
				name: 'batchOperations',
				type: 'json',
				default: '[]',
				required: true,
				displayOptions: { show: { operation: ['batchUpdate'] } },
				description: 'Array of batch operations (insertRows, deleteRows, insertColumns, deleteColumns, etc.)',
				typeOptions: { rows: 5 },
			},
		],
	};



	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const operation = this.getNodeParameter('operation', 0) as string;

		const credentials = (await this.getCredentials('synologySpreadsheetApi')) as unknown as SpreadsheetApiCredentials;
		if (!credentials) {
			throw new NodeOperationError(this.getNode(), 'No credentials provided');
		}

		const baseUrl = credentials.baseUrl.replace(/\/$/, '');
		const results: INodeExecutionData[] = [];

		for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
			try {
				let result: IDataObject;

				switch (operation) {
					case 'createSpreadsheet':
						result = await createSpreadsheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'getSpreadsheet':
						result = await getSpreadsheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'readCells':
						result = await readCells(this, baseUrl, credentials, itemIndex);
						break;
					case 'writeCells':
						result = await writeCells(this, baseUrl, credentials, itemIndex);
						break;
					case 'appendRows':
						result = await appendRows(this, baseUrl, credentials, itemIndex, items);
						break;
					case 'addSheet':
						result = await addSheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'renameSheet':
						result = await renameSheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'deleteSheet':
						result = await deleteSheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'deleteSpreadsheet':
						result = await deleteSpreadsheet(this, baseUrl, credentials, itemIndex);
						break;
					case 'formatCells':
						result = await formatCells(this, baseUrl, credentials, itemIndex);
						break;
					case 'readStyles':
						result = await readStyles(this, baseUrl, credentials, itemIndex);
						break;
					case 'exportCsv':
						result = await exportCsv(this, baseUrl, credentials, itemIndex);
						break;
					case 'exportXlsx':
						result = await exportXlsx(this, baseUrl, credentials, itemIndex);
						break;
					case 'batchUpdate':
						result = await batchUpdate(this, baseUrl, credentials, itemIndex);
						break;
					default:
						throw new NodeOperationError(this.getNode(), `Unknown operation: ${operation}`);
				}

				results.push({ json: result, pairedItem: itemIndex });
			} catch (error) {
				if (this.continueOnFail()) {
					results.push({ json: { error: String(error) }, pairedItem: itemIndex });
				} else {
					throw error;
				}
			}
		}

		return [results];
	}
}

// Helper functions
async function getToken(baseUrl: string, credentials: SpreadsheetApiCredentials): Promise<string> {
	const response = await axios.post(`${baseUrl}/spreadsheets/authorize`, {
		username: credentials.username,
		password: credentials.password,
		host: credentials.host,
		protocol: credentials.protocol,
	});
	if (!response.data.token) {
		throw new Error('Failed to obtain authentication token');
	}
	return response.data.token as string;
}

async function createSpreadsheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const name = context.getNodeParameter('spreadsheetName', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.post(
		`${baseUrl}/spreadsheets/create`,
		{ name },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 30000,
		},
	);
	return response.data as IDataObject;
}

async function getSpreadsheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.get(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}`,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function readCells(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const cellRange = context.getNodeParameter('cellRange', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.get(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(cellRange)}`,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function writeCells(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const cellRange = context.getNodeParameter('cellRange', itemIndex) as string;
	const values = context.getNodeParameter('values', itemIndex) as unknown;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.put(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(cellRange)}`,
		{ values },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 15000,
		},
	);
	return response.data as IDataObject;
}

async function appendRows(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
	allItems?: INodeExecutionData[],
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const sheetId = context.getNodeParameter('sheetId', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	let values: unknown;
	const inputType = context.getNodeParameter('inputType', itemIndex) as string;

	if (inputType === 'manual') {
		const cellRange = context.getNodeParameter('cellRange', itemIndex) as string;
		values = context.getNodeParameter('values', itemIndex) as unknown;

		const response = await axios.put(
			`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(cellRange)}/append`,
			{ values },
			{
				headers: { 'Authorization': `Bearer ${token}` },
				timeout: 15000,
			},
		);
		return response.data as IDataObject;
	} else {
		const columnMapping = context.getNodeParameter('columnMapping', itemIndex) as {
			values: Array<{ column: string; inputField: string }>;
		};
		const inputData = allItems?.[itemIndex]?.json as IDataObject;

		const row: unknown[] = [];
		if (columnMapping.values && inputData) {
			for (const mapping of columnMapping.values) {
				const fieldValue = inputData[mapping.inputField] || '';
				row.push(fieldValue);
			}
		}

		const response = await axios.put(
			`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/Sheet1!A1:Z1/append`,
			{ values: [row] },
			{
				headers: { 'Authorization': `Bearer ${token}` },
				timeout: 15000,
			},
		);
		return response.data as IDataObject;
	}
}

async function addSheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const sheetName = context.getNodeParameter('sheetName', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.post(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/sheet/add`,
		{ sheetName },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function renameSheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const sheetId = context.getNodeParameter('sheetId', itemIndex) as string;
	const sheetName = context.getNodeParameter('sheetName', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.post(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/sheet/rename`,
		{ sheetId, sheetName },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function deleteSheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const sheetId = context.getNodeParameter('sheetId', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.post(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/sheet/delete`,
		{ sheetId },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function deleteSpreadsheet(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const token = await getToken(baseUrl, credentials);

	const response = await axios.post(
		`${baseUrl}/spreadsheets/delete`,
		{ spreadsheetId },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 10000,
		},
	);
	return response.data as IDataObject;
}

async function formatCells(
	context: IExecuteFunctions,
	baseUrl: string,
	credentials: SpreadsheetApiCredentials,
	itemIndex: number,
): Promise<IDataObject> {
	const spreadsheetId = context.getNodeParameter('spreadsheetId', itemIndex) as string;
	const sheetName = context.getNodeParameter('sheetName', itemIndex, 'Sheet1') as string;
	const token = await getToken(baseUrl, credentials);

	// Simple format: bold, italic, font color, background
	const formatPayload = {
		sheetName,
		startRow: 0,
		startCol: 0,
		rows: [
			{
				values: [
					{
						userEnteredFormat: {
							textFormat: { bold: true },
							backgroundColor: { red: 1, green: 1, blue: 0.8 },
						},
					},
				],
			},
		],
	};

	const response = await axios.put(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/styles`,
		formatPayload,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 15000,
		},
	);
	return response.data as IDataObject;
}

async function readStyles(context: any, baseUrl: string, credentials: SpreadsheetApiCredentials, itemIndex: number): Promise<IDataObject> {
	const token = await getToken(baseUrl, credentials);
	const spreadsheetId = context.getNodeParameter('spreadsheetIdStyles', itemIndex) as string;
	const range = context.getNodeParameter('rangeStyles', itemIndex) as string;

	const response = await axios.get(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/styles/${encodeURIComponent(range)}`,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 15000,
		},
	);
	return response.data as IDataObject;
}

async function exportCsv(context: any, baseUrl: string, credentials: SpreadsheetApiCredentials, itemIndex: number): Promise<any> {
	const token = await getToken(baseUrl, credentials);
	const spreadsheetId = context.getNodeParameter('spreadsheetIdCsv', itemIndex) as string;
	const sheetName = context.getNodeParameter('sheetNameCsv', itemIndex) as string;
	const binaryField = context.getNodeParameter('binaryFieldCsv', itemIndex) as string;

	const response = await axios.get(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/sheet/csv`,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			params: { sheet_name: sheetName },
			responseType: 'arraybuffer',
			timeout: 30000,
		},
	);

	const buffer = Buffer.from(response.data);
	const fileName = `${sheetName}.csv`;

	return {
		json: {
			success: true,
			filename: fileName,
			size: buffer.length,
			mimeType: 'text/csv',
		},
		binary: {
			[binaryField]: {
				data: buffer.toString('base64'),
				mimeType: 'text/csv',
				fileName: fileName,
			},
		},
	};
}

async function exportXlsx(context: any, baseUrl: string, credentials: SpreadsheetApiCredentials, itemIndex: number): Promise<any> {
	const token = await getToken(baseUrl, credentials);
	const spreadsheetId = context.getNodeParameter('spreadsheetIdXlsx', itemIndex) as string;
	const binaryField = context.getNodeParameter('binaryFieldXlsx', itemIndex) as string;

	const response = await axios.get(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/xlsx`,
		{
			headers: { 'Authorization': `Bearer ${token}` },
			responseType: 'arraybuffer',
			timeout: 30000,
		},
	);

	const buffer = Buffer.from(response.data);
	const fileName = `spreadsheet.xlsx`;

	return {
		json: {
			success: true,
			filename: fileName,
			size: buffer.length,
			mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		},
		binary: {
			[binaryField]: {
				data: buffer.toString('base64'),
				mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				fileName: fileName,
			},
		},
	};
}

async function batchUpdate(context: any, baseUrl: string, credentials: SpreadsheetApiCredentials, itemIndex: number): Promise<IDataObject> {
	const token = await getToken(baseUrl, credentials);
	const spreadsheetId = context.getNodeParameter('spreadsheetIdBatch', itemIndex) as string;
	const operations = context.getNodeParameter('batchOperations', itemIndex) as any[];

	const response = await axios.post(
		`${baseUrl}/spreadsheets/${encodeURIComponent(spreadsheetId)}/batchUpdate`,
		{ requests: operations },
		{
			headers: { 'Authorization': `Bearer ${token}` },
			timeout: 30000,
		},
	);
	return response.data as IDataObject;
}
