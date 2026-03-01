import { DynamicTool } from '@langchain/core/tools';
import type {
	INodeType,
	INodeTypeDescription,
	ISupplyDataFunctions,
	SupplyData,
} from 'n8n-workflow';
import {
	NodeConnectionTypes,
	NodeOperationError,
	nodeNameToToolName,
	tryToParseAlphanumericString,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyMailPlusListMailboxesTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Mailboxes',
		name: 'synologyMailPlusListMailboxesTool',
		icon: 'file:synology-mailplus.png',
		group: ['output'],
		version: 1,
		description: 'List all mailboxes in Synology MailPlus',
		defaults: { name: 'Synology List Mailboxes' },
		credentials: [{ name: 'synologyDsmApi', required: true }],
		inputs: [],
		outputs: [NodeConnectionTypes.AiTool],
		outputNames: ['Tool'],
		properties: [
			{
				displayName: 'Tool Description',
				name: 'toolDescription',
				type: 'string',
				required: true,
				default: 'List all mailboxes available',
				description: 'Description for the AI Agent',
			},
		],
	};

	async supplyData(this: ISupplyDataFunctions, itemIndex: number): Promise<SupplyData> {
		const name = nodeNameToToolName(this.getNode());

		try {
			tryToParseAlphanumericString(name);
		} catch (error) {
			throw new NodeOperationError(
				this.getNode(),
				'The name of this tool is not a valid alphanumeric string',
			);
		}

		const toolDescription = this.getNodeParameter('toolDescription', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				const response = await dsm.callAny(
					['SYNO.MailClient.Mailbox', 'SYNO.MailPlusServer.Client'],
					['list', 'get'],
					{},
				);

				const mailboxes = Array.isArray(response) ? response : [];
				const list = mailboxes
					.map((m: any) => `${m.name || m.id} (${m.id})`)
					.slice(0, 10)
					.join(', ');

				return `Available mailboxes: ${list}${mailboxes.length > 10 ? ' ... and more' : ''}`;
			} catch (error) {
				return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
			}
		};

		const tool = new DynamicTool({
			name,
			description: toolDescription,
			func,
		});

		return { response: tool };
	}
}
