import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

export class SynologyMailPlusSendEmailTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Send Email',
		name: 'synologyMailPlusSendEmailTool',
		icon: 'file:synology.png',
		group: ['output'],
		version: 1,
		description: 'Send an email via Synology MailPlus',
		defaults: { name: 'Synology Send Email' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'To',
				name: 'to',
				type: 'string',
				required: true,
				default: '',
				description: 'Recipient email address',
			},
			{
				displayName: 'Subject',
				name: 'subject',
				type: 'string',
				required: true,
				default: '',
				description: 'Email subject',
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'string',
				required: true,
				default: '',
				typeOptions: { rows: 3 },
				description: 'Email body',
			},
			{
				displayName: 'CC',
				name: 'cc',
				type: 'string',
				default: '',
				description: 'CC recipients (comma-separated)',
			},
			{
				displayName: 'BCC',
				name: 'bcc',
				type: 'string',
				default: '',
				description: 'BCC recipients (comma-separated)',
			},
			{
				displayName: 'Priority',
				name: 'priority',
				type: 'options',
				default: '3',
				options: [
					{ name: 'Low', value: '5' },
					{ name: 'Normal', value: '3' },
					{ name: 'High', value: '1' },
				],
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
				const subject = this.getNodeParameter('subject', i) as string;
				const body = this.getNodeParameter('body', i) as string;
				const cc = this.getNodeParameter('cc', i, '') as string;
				const bcc = this.getNodeParameter('bcc', i, '') as string;
				const priority = this.getNodeParameter('priority', i, '3') as string;

				const params: IDataObject = {
					to,
					cc: cc || undefined,
					bcc: bcc || undefined,
					subject,
					body,
					priority: parseInt(priority, 10),
				};

				const response = await dsm.callAny(
					['SYNO.MailClient.Send', 'SYNO.MailPlusServer.Send'],
					['send', 'create'],
					params,
				);

				returnData.push({
					success: true,
					to,
					subject,
					message: 'Email sent',
				});
			} catch (error) {
				returnData.push({
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error',
				});
			}
		}

		return [this.helpers.returnJsonArray(returnData)];
	}
}
