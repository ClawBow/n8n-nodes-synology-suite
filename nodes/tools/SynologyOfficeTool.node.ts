import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import {
	NodeConnectionTypes,
	NodeOperationError,
	nodeNameToToolName,
	tryToParseAlphanumericString,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyOfficeTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Office',
		name: 'synologyOfficeTool',
		icon: 'file:synology-office.png',
		group: ['output'],
		version: 1,
		description: 'Manage spreadsheets in Synology Office',
		defaults: { name: 'Synology Office' },
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
					params = { action: 'listspreadsheets' };
				}

				const action = params.action || 'listspreadsheets';

				switch (action) {
					case 'listspreadsheets': {
						const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['list', 'get'], { limit: 20 });
						const sheets = Array.isArray(response)
							? response
									.map((s: any) => s.name)
									.slice(0, 10)
									.join(', ')
							: '';
						return `📊 Spreadsheets: ${sheets}${Array.isArray(response) && response.length > 10 ? ' ...' : ''}`;
					}

					case 'readrange': {
						if (!params.spreadsheet_id) return 'Error: spreadsheet_id required';
						const range = params.range || 'A1:Z100';
						const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['readRange', 'read'], {
							spreadsheet_id: params.spreadsheet_id,
							range,
						});
						const data = Array.isArray(response) ? response.flat().slice(0, 20).join(', ') : '';
						return `📖 Data: ${data}`;
					}

					case 'appendrow': {
						if (!params.spreadsheet_id) return 'Error: spreadsheet_id required';
						if (!params.rows) return 'Error: rows required';
						let rows = params.rows;
						if (typeof rows === 'string') {
							try {
								rows = JSON.parse(rows);
							} catch {
								return 'Error: rows must be valid JSON array';
							}
						}
						if (!Array.isArray(rows)) return 'Error: rows must be an array';
						await dsm.callAny(['SYNO.Office.Spreadsheet'], ['appendRow', 'create'], {
							spreadsheet_id: params.spreadsheet_id,
							rows,
						});
						return `➕ ${rows.length} row(s) appended`;
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
			description: 'Manage spreadsheets in Synology Office (list, read, append)',
			func,
		});

		return { response: tool };
	}
}
