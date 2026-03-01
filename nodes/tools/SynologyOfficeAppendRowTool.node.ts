import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyOfficeAppendRowTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Append Row',
		name: 'synologyOfficeAppendRowTool',
		icon: 'file:synology-office.png',
		group: ['output'],
		version: 1,
		description: 'Append row to spreadsheet',
		defaults: { name: 'Synology Append Row' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'Add new row to spreadsheet', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let params: any = { spreadsheet_id: '', rows: [] };
				try { params = JSON.parse(input); } catch { return 'Error: JSON input required {spreadsheet_id, rows}'; }
				if (!params.spreadsheet_id || !Array.isArray(params.rows)) return 'Error: spreadsheet_id and rows array required';
				
				await dsm.callAny(['SYNO.Office.Spreadsheet'], ['appendRow', 'create'], params);
				return `Row(s) appended to spreadsheet`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
