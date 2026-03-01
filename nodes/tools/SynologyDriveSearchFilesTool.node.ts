import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyDriveSearchFilesTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Search Files',
		name: 'synologyDriveSearchFilesTool',
		icon: 'file:synology-drive.png',
		group: ['output'],
		version: 1,
		description: 'Search files in Synology Drive',
		defaults: { name: 'Synology Search Files' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'Search files by name or pattern', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let query = input;
				try { const p = JSON.parse(input); query = p.pattern || p.query || input; } catch { }
				
				const response = await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['search', 'query'], { pattern: query, limit: 20 });
				const files = Array.isArray(response) ? response.map((f: any) => f.name).slice(0, 10) : [];
				return `Found: ${files.join(', ')}${Array.isArray(response) && response.length > 10 ? ' ...' : ''}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
