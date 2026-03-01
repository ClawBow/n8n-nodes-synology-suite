import { DynamicTool } from '@langchain/core/tools';
import type { INodeType, INodeTypeDescription, ISupplyDataFunctions, SupplyData } from 'n8n-workflow';
import {
	NodeConnectionTypes,
	NodeOperationError,
	nodeNameToToolName,
	tryToParseAlphanumericString,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyMailTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Mail',
		name: 'synologyMailTool',
		icon: 'file:synology-mailplus.png',
		group: ['output'],
		version: 1,
		description: 'Manage email in Synology MailPlus (send, list, move)',
		defaults: { name: 'Synology Mail' },
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
				default: 'Manage email in Synology MailPlus',
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
					params = { action: 'listmailboxes' };
				}

				const action = params.action || 'listmailboxes';

				switch (action) {
					case 'sendemail': {
						if (!params.to || !params.subject || !params.body)
							return 'Error: to, subject, body required';
						await dsm.callAny(
							['SYNO.MailClient.Send', 'SYNO.MailPlusServer.Send'],
							['send', 'create'],
							{
								from: params.from || 'noreply@synology.local',
								to: params.to,
								cc: params.cc,
								bcc: params.bcc,
								subject: params.subject,
								body: params.body,
							},
						);
						return `📧 Email sent to ${params.to}`;
					}

					case 'listmailboxes': {
						const response = await dsm.callAny(
							['SYNO.MailClient.Mailbox', 'SYNO.MailPlusServer.Client'],
							['list', 'get'],
							{},
						);
						const mailboxes = Array.isArray(response)
							? response
									.map((m: any) => m.name || m.id)
									.slice(0, 5)
									.join(', ')
							: '';
						return `📬 Mailboxes: ${mailboxes}`;
					}

					case 'listmessages': {
						if (!params.mailbox_id) return 'Error: mailbox_id required';
						const response = await dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query'], {
							mailbox_id: params.mailbox_id,
							limit: 20,
						});
						const messages = Array.isArray(response)
							? response
									.map((m: any) => m.subject || m.title)
									.slice(0, 5)
									.join(', ')
							: '';
						return `📨 Messages: ${messages}`;
					}

					case 'movemessage': {
						if (!params.message_ids || !params.destination_mailbox_id)
							return 'Error: message_ids and destination_mailbox_id required';
						await dsm.callAny(['SYNO.MailClient.Message'], ['move'], {
							message_ids: Array.isArray(params.message_ids) ? params.message_ids : [params.message_ids],
							destination_mailbox_id: params.destination_mailbox_id,
						});
						return `↔️ Message(s) moved`;
					}

					default:
						return `❌ Unknown action: ${action}. Use: sendemail, listmailboxes, listmessages, movemessage`;
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
