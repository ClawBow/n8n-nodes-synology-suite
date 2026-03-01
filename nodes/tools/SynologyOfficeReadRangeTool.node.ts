import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyOfficeReadRangeTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Read Range',
		name: 'synologyOfficeReadRangeTool',
		icon: 'file:synology-office.png',
		group: ['output'],
		version: 1,
		description: 'Read cells from spreadsheet',
		defaults: { name: 'Synology Read Range' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'Read data from spreadsheet cells', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let params: any = { spreadsheet_id: '', range: 'A1:Z100' };
				try { params = JSON.parse(input); } catch { params.spreadsheet_id = input; }
				
				const response = await dsm.callAny(['SYNO.Office.Spreadsheet'], ['readRange', 'read'], params);
				const data = Array.isArray(response) ? response.flat().slice(0, 20) : [];
				return `Data: ${data.join(', ')}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
