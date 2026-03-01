import type { IDataObject, IExecuteFunctions, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyMailTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Mail',
		name: 'synologyMailTool',
		icon: 'file:synology-mailplus.png',
		group: ['transform'],
		version: 1,
		description: 'Manage email in Synology MailPlus',
		defaults: { name: 'Synology Mail' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Action',
				name: 'action',
				type: 'options',
				required: true,
				default: 'listmailboxes',
				options: [
					{ name: 'Send Email', value: 'sendemail' },
					{ name: 'List Mailboxes', value: 'listmailboxes' },
					{ name: 'List Messages', value: 'listmessages' },
					{ name: 'Move Message', value: 'movemessage' },
				],
			},
			// Send Email params
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'user@example.com',
				description: 'Recipient email address',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				placeholder: 'cc@example.com',
				description: 'CC recipients (comma-separated)',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				placeholder: 'bcc@example.com',
				description: 'BCC recipients (comma-separated)',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Email subject',
				description: 'Email subject line',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'Email message content',
				typeOptions: { rows: 5 },
				description: 'Email body/message',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			{
				displayName: 'From',
				name: 'from',
				type: 'string',
				default: '',
				placeholder: 'sender@example.com',
				description: 'Sender email address',
				displayOptions: { show: { action: ['sendemail'] } },
			},
			// List Messages params
			{
				displayName: 'Mailbox ID',
				name: 'mailbox_id',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'mailbox-id-here',
				description: 'ID of mailbox to query',
				displayOptions: { show: { action: ['listmessages'] } },
			},
			// Move Message params
			{
				displayName: 'Message IDs',
				name: 'message_ids',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'id1,id2,id3',
				description: 'Comma-separated message IDs',
				displayOptions: { show: { action: ['movemessage'] } },
			},
			{
				displayName: 'Destination Mailbox ID',
				name: 'destination_mailbox_id',
				type: 'string',
				required: true,
				default: '',
				placeholder: 'destination-mailbox-id',
				description: 'ID of destination mailbox',
				displayOptions: { show: { action: ['movemessage'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const action = this.getNodeParameter('action', i) as string;

			switch (action) {
				case 'sendemail': {
					const to = this.getNodeParameter('to', i) as string;
					const subject = this.getNodeParameter('subject', i) as string;
					const body = this.getNodeParameter('body', i) as string;
					const cc = this.getNodeParameter('cc', i, '') as string;
					const bcc = this.getNodeParameter('bcc', i, '') as string;
					const from = this.getNodeParameter('from', i, '') as string;

					if (!to || !subject || !body) return { error: 'to, subject, body required' };

					await dsm.callAny(['SYNO.MailClient.Send', 'SYNO.MailPlusServer.Send'], ['send', 'create'], {
						from: from || 'noreply@synology.local',
						to,
						cc: cc || undefined,
						bcc: bcc || undefined,
						subject,
						body,
					});
					return { success: true, message: `Email sent to ${to}` };
				}

				case 'listmailboxes': {
					const response = await dsm.callAny(
						['SYNO.MailClient.Mailbox', 'SYNO.MailPlusServer.Client'],
						['list', 'get'],
						{},
					);
					const mailboxes = Array.isArray(response) ? response.map((m: any) => m.name || m.id).slice(0, 5) : [];
					return { success: true, mailboxes, count: mailboxes.length };
				}

				case 'listmessages': {
					const mailbox_id = this.getNodeParameter('mailbox_id', i) as string;
					if (!mailbox_id) return { error: 'mailbox_id required' };
					const response = await dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query'], {
						mailbox_id,
						limit: 20,
					});
					const messages = Array.isArray(response) ? response.map((m: any) => m.subject || m.title).slice(0, 10) : [];
					return { success: true, messages, count: messages.length };
				}

				case 'movemessage': {
					const message_ids = this.getNodeParameter('message_ids', i) as string;
					const destination_mailbox_id = this.getNodeParameter('destination_mailbox_id', i) as string;

					if (!message_ids || !destination_mailbox_id) return { error: 'message_ids and destination_mailbox_id required' };

					const ids = message_ids.split(',').map((id: string) => id.trim());
					await dsm.callAny(['SYNO.MailClient.Message'], ['move'], {
						message_ids: ids,
						destination_mailbox_id,
					});
					return { success: true, message: `Moved ${ids.length} message(s)` };
				}

				default:
					return { error: `Unknown action: ${action}` };
			}
		});
	}
}
