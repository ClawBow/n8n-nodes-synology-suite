import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError, nodeNameToToolName, tryToParseAlphanumericString } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyMailPlusListMessagesTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Messages',
		name: 'synologyMailPlusListMessagesTool',
		icon: 'file:synology-mailplus.png',
		group: ['output'],
		version: 1,
		description: 'List messages from a mailbox',
		defaults: { name: 'Synology List Messages' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [
			{ displayName: 'Tool Description', name: 'toolDescription', type: 'string', required: true, default: 'List messages from mailbox', description: 'For AI Agent' },
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());
		try { tryToParseAlphanumericString(name); } catch (e) { throw new NodeOperationError(this.getNode(), 'Invalid name'); }
		
		const desc = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				let mailboxId = '';
				try { const p = JSON.parse(input); mailboxId = p.mailbox_id || p.mailboxId || ''; } catch { mailboxId = input; }
				
				const response = await dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query'], { mailbox_id: mailboxId, limit: 20 });
				const msgs = Array.isArray(response) ? response.map((m: any) => m.subject || m.title).slice(0, 10) : [];
				return `Messages: ${msgs.join(', ')}${Array.isArray(response) && response.length > 10 ? ' ...' : ''}`;
			} catch (e) { return `Error: ${e instanceof Error ? e.message : 'Unknown'}`; }
		};

		return { response: new DynamicTool({ name, description: desc, func }) };
	}
}
