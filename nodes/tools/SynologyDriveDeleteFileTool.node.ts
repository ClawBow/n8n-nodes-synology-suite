import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyDriveDeleteFileTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Delete File',
		name: 'synologyDriveDeleteFileTool',
		icon: 'file:synology-drive.png',
		group: ['output'],
		version: 1,
		description: 'Delete file from Synology Drive',
		defaults: { name: 'Synology Delete File' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'Delete file permanently', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let path = input;
				try { const p = JSON.parse(input); path = p.path || input; } catch { }
				
				await dsm.callAny(['SYNO.Dsm.Share', 'SYNO.FolderSharing'], ['delete', 'remove'], { path });
				return `File deleted: ${path}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
