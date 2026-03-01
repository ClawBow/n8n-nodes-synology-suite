import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyMailPlusMoveMessageTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Move Message',
		name: 'synologyMailPlusMoveMessageTool',
		icon: 'file:synology-mailplus.png',
		group: ['output'],
		version: 1,
		description: 'Move message to different mailbox',
		defaults: { name: 'Synology Move Message' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'Move email to folder', description: 'For AI Agent' }],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let params: any = { message_ids: [], destination_mailbox_id: '' };
				try { params = JSON.parse(input); } catch { params.message_ids = [input]; }
				if (!params.message_ids || !params.destination_mailbox_id) return 'Error: message_ids and destination_mailbox_id required';
				
				await dsm.callAny(['SYNO.MailClient.Message'], ['move'], params);
				return `Message(s) moved to mailbox ${params.destination_mailbox_id}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
