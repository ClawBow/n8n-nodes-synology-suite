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
		description: 'Manage spreadsheets in Synology Office (list, read, append)',
		defaults: { name: 'Synology Office' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [
			{
				displayName: 'Description',
				name: 'toolDescription',
				type: 'string',
				required: true,
				default: 'Manage spreadsheets in Synology Office',
				description: 'Description for the AI Agent',
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

		const description = this.getNodeParameter('toolDescription', itemIndex) as string;
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
						if (!params.spreadsheet_id || !Array.isArray(params.rows))
							return 'Error: spreadsheet_id and rows array required';
						await dsm.callAny(['SYNO.Office.Spreadsheet'], ['appendRow', 'create'], {
							spreadsheet_id: params.spreadsheet_id,
							rows: params.rows,
						});
						return `➕ Row(s) appended`;
					}

					default:
						return `❌ Unknown action: ${action}. Use: listspreadsheets, readrange, appendrow`;
				}
			} catch (error) {
				return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			}
		};

		const tool = new DynamicTool({
			name,
			description,
			func,
		});

		return { response: tool };
	}
}
