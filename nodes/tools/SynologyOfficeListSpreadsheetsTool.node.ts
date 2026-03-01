import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyOfficeListSpreadsheetsTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Spreadsheets',
		name: 'synologyOfficeListSpreadsheetsTool',
		icon: 'file:synology-office.png',
		group: ['output'],
		version: 1,
		description: 'List spreadsheets in Synology Office',
		defaults: { name: 'Synology List Spreadsheets' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'List all available spreadsheets', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['list', 'get'], { limit: 20 });
				const sheets = Array.isArray(response) ? response.map((s: any) => s.name).slice(0, 10) : [];
				return `Spreadsheets: ${sheets.join(', ')}${Array.isArray(response) && response.length > 10 ? ' ...' : ''}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
