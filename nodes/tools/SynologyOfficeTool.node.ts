import type { IDataObject, IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyOfficeTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Office',
		name: 'synologyOfficeTool',
		icon: 'file:synology-office.png',
		group: ['transform'],
		version: 1,
		description: 'Manage spreadsheets in Synology Office',
		defaults: { name: 'Synology Office' },
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
				default: 'listspreadsheets',
				options: [
					{ name: 'List Spreadsheets', value: 'listspreadsheets' },
					{ name: 'Read Range', value: 'readrange' },
					{ name: 'Append Row', value: 'appendrow' },
				],
			},
			// Read Range params
			{
				displayName: 'Spreadsheet ID',
				name: 'spreadsheet_id',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'sheet-id-here',
				description: 'ID of the spreadsheet to read from',
				displayOptions: { show: { action: ['readrange', 'appendrow'] } },
			},
			{
				displayName: 'Range',
				name: 'range',
				type: 'string',
				default: 'A1:Z100',
				placeholder: 'A1:Z100',
				description: 'Cell range (e.g., A1:Z100, Sheet1!A1:C10)',
				displayOptions: { show: { action: ['readrange'] } },
			},
			// Append Row params
			{
				displayName: 'Row Data (JSON)',
				name: 'rows',
				type: 'string',
				required: true,
				default: '[]',
				placeholder: '[["value1", "value2"], ["value3", "value4"]]',
				typeOptions: { rows: 4 },
				description: 'Row data as JSON array of arrays',
				displayOptions: { show: { action: ['appendrow'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const action = this.getNodeParameter('action', i) as string;

			switch (action) {
				case 'listspreadsheets': {
					const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['list', 'get'], { limit: 20 });
					const sheets = Array.isArray(response) ? response.map((s: any) => s.name).slice(0, 10) : [];
					return { success: true, sheets, count: sheets.length };
				}

				case 'readrange': {
					const spreadsheet_id = this.getNodeParameter('spreadsheet_id', i) as string;
					const range = (this.getNodeParameter('range', i) as string) || 'A1:Z100';

					if (!spreadsheet_id) return { error: 'spreadsheet_id required' };

					const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['readRange', 'read'], {
						spreadsheet_id,
						range,
					});
					const data = Array.isArray(response) ? response.flat().slice(0, 50) : [];
					return { success: true, data, count: data.length };
				}

				case 'appendrow': {
					const spreadsheet_id = this.getNodeParameter('spreadsheet_id', i) as string;
					let rows = this.getNodeParameter('rows', i) as string;

					if (!spreadsheet_id) return { error: 'spreadsheet_id required' };
					if (!rows) return { error: 'rows required' };

					try {
						const parsedRows = typeof rows === 'string' ? JSON.parse(rows) : rows;
						if (!Array.isArray(parsedRows)) return { error: 'rows must be a JSON array' };

						await dsm.callAny(['SYNO.Office.Spreadsheet'], ['appendRow', 'create'], {
							spreadsheet_id,
							rows: parsedRows,
						});
						return { success: true, message: `${parsedRows.length} row(s) appended` };
					} catch (e) {
						return { error: 'Invalid JSON in rows' };
					}
				}

				default:
					return { error: `Unknown action: ${action}` };
			}
		});
	}
}
