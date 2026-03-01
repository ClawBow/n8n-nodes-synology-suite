import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologySendEmail implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Send Email (AI Tool)',
		name: 'synologySendEmailAI',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'Send an email via Synology MailPlus — designed for AI Agents',
		defaults: { name: 'Synology Send Email' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		// AI Agent tool metadata
		properties: [
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'user@example.com',
				description: 'Recipient email address (or comma-separated for multiple)',
			},
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				placeholder: 'cc@example.com',
				description: 'CC recipients (comma-separated, optional)',
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				placeholder: 'bcc@example.com',
				description: 'BCC recipients (comma-separated, optional)',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Email subject',
				description: 'Email subject line',
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 4 },
				placeholder: 'Email body text',
				description: 'Email body (plain text or HTML)',
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: '3', // 3 = normal
				options: [
					{ name: 'Low', value: '5' },
					{ name: 'Normal', value: '3' },
					{ name: 'High', value: '1' },
				],
				description: 'Email priority level',
			},
			{
				displayName: 'From Address',
				name: 'fromAddress',
				type: 'string',
				default: '',
				placeholder: 'sender@example.com (optional)',
				description: 'Sender address (uses default if empty)',
			},
			{
				displayName: 'Mailbox ID',
				name: 'mailboxId',
				type: 'string',
				default: '1',
				description: 'Mailbox ID to send from (default: 1)',
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const items = this.getInputData();
		const returnData: IDataObject[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const to = this.getNodeParameter('to', i) as string;
				const cc = this.getNodeParameter('cc', i, '') as string;
				const bcc = this.getNodeParameter('bcc', i, '') as string;
				const subject = this.getNodeParameter('subject', i) as string;
				const body = this.getNodeParameter('body', i) as string;
				const priority = this.getNodeParameter('priority', i, '3') as string;
				const fromAddress = this.getNodeParameter('fromAddress', i, '') as string;
				const mailboxId = this.getNodeParameter('mailboxId', i, '1') as string;

				// Build email parameters
				const emailParams: IDataObject = {
					to,
					cc: cc || undefined,
					bcc: bcc || undefined,
					subject,
					body,
					priority: parseInt(priority, 10),
					mailbox_id: mailboxId,
				};

				if (fromAddress) {
					emailParams.from = fromAddress;
				}

				// Call Synology API to send email
				// Using SYNO.MailClient.Send or SYNO.MailPlusServer.Send
				const response = await dsm.callAny(
					['SYNO.MailClient.Send', 'SYNO.MailPlusServer.Send'],
					['send', 'create'],
					emailParams,
				);

				returnData.push({
					success: true,
					to,
					subject,
					status: 'sent',
					response: response || { success: true },
				});
			} catch (error) {
				returnData.push({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
					itemIndex: i,
				});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
