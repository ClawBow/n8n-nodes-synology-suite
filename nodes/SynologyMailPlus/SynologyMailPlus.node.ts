import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

function pickMessageArray(data: IDataObject): unknown[] {
	const body = (data.data || {}) as IDataObject;
	const candidates = ['messages', 'items', 'list', 'mails'];
	for (const key of candidates) {
		const value = body[key];
		if (Array.isArray(value)) return value;
	}
	return [];
}

export class SynologyMailPlus implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology MailPlus',
		name: 'synologyMailPlus',
		icon: 'file:synology.png',
		group: ['transform'],
		version: 1,
		description: 'Synology MailPlus helper node (client/server API)',
		defaults: { name: 'Synology MailPlus' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listApis',
				options: [
					{ name: 'List Mail APIs', value: 'listApis' },
					{ name: 'Get Mail Server Version', value: 'serverVersion' },
					{ name: 'List Mailboxes', value: 'listMailboxes' },
					{ name: 'List Messages', value: 'listMessages' },
					{ name: 'Get Message Detail', value: 'getMessage' },
					{ name: 'Move Message', value: 'moveMessage' },
					{ name: 'Mark Read / Unread', value: 'markReadStatus' },
					{ name: 'Add / Remove Label', value: 'labelMessage' },
					{ name: 'Custom Mail Call', value: 'customMailCall' },
				],
			},
			{ displayName: 'Mailbox ID', name: 'mailboxId', type: 'string', default: '', displayOptions: { show: { operation: ['listMessages', 'moveMessage'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Message ID', name: 'messageId', type: 'string', default: '', displayOptions: { show: { operation: ['getMessage', 'markReadStatus', 'labelMessage'] } } },
			{ displayName: 'Message IDs (JSON Array)', name: 'messageIds', type: 'json', default: '["123"]', displayOptions: { show: { operation: ['moveMessage'] } } },
			{ displayName: 'Destination Mailbox ID', name: 'destinationMailboxId', type: 'string', default: '', displayOptions: { show: { operation: ['moveMessage'] } } },
			{ displayName: 'Read', name: 'read', type: 'boolean', default: true, displayOptions: { show: { operation: ['markReadStatus'] } } },
			{ displayName: 'Label Action', name: 'labelAction', type: 'options', options: [{ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }], default: 'add', displayOptions: { show: { operation: ['labelMessage'] } } },
			{ displayName: 'Label ID', name: 'labelId', type: 'string', default: '', displayOptions: { show: { operation: ['labelMessage'] } } },
			{ displayName: 'Extra Params (JSON)', name: 'extraParamsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['listMailboxes', 'listMessages', 'getMessage', 'moveMessage', 'markReadStatus', 'labelMessage'] } } },
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.MailClient.Info', displayOptions: { show: { operation: ['customMailCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'get', displayOptions: { show: { operation: ['customMailCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customMailCall'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const extraParams = this.getNodeParameter('extraParamsJson', i, {}) as IDataObject;

			if (operation === 'listApis') return dsm.queryApis('SYNO.MailClient.*,SYNO.MailPlusServer.*');
			if (operation === 'serverVersion') return dsm.callAuto('SYNO.MailPlusServer.Version', 'get', {});
			if (operation === 'listMailboxes') {
				return dsm.callAny(['SYNO.MailClient.Mailbox', 'SYNO.MailPlusServer.Client'], ['list', 'get'], extraParams);
			}

			if (operation === 'listMessages') {
				const mailboxId = this.getNodeParameter('mailboxId', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				const returnAll = this.getNodeParameter('returnAll', i) as boolean;

				if (!returnAll) {
					return dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query', 'get'], { mailbox_id: mailboxId, offset, limit, ...extraParams });
				}

				let cursor = offset;
				const merged: unknown[] = [];
				let pages = 0;
				while (pages < 100) {
					const page = await dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query', 'get'], {
						mailbox_id: mailboxId,
						offset: cursor,
						limit,
						...extraParams,
					});
					const messages = pickMessageArray(page);
					merged.push(...messages);
					if (messages.length < limit) break;
					cursor += limit;
					pages += 1;
				}

				return {
					success: true,
					data: {
						messages: merged,
						offset,
						fetched: merged.length,
					},
				};
			}

			if (operation === 'getMessage') {
				const messageId = this.getNodeParameter('messageId', i) as string;
				return dsm.callAny(['SYNO.MailClient.Message'], ['get', 'detail', 'view'], { id: messageId, message_id: messageId, ...extraParams });
			}

			if (operation === 'moveMessage') {
				const mailboxId = this.getNodeParameter('mailboxId', i) as string;
				const destinationMailboxId = this.getNodeParameter('destinationMailboxId', i) as string;
				const messageIds = this.getNodeParameter('messageIds', i) as string[];
				return dsm.callAny(['SYNO.MailClient.Message'], ['move', 'batch_move', 'update_mailbox'], {
					ids: messageIds as any,
					message_ids: messageIds as any,
					mailbox_id: mailboxId,
					destination_mailbox_id: destinationMailboxId,
					dest_mailbox_id: destinationMailboxId,
					...extraParams,
				});
			}

			if (operation === 'markReadStatus') {
				const messageId = this.getNodeParameter('messageId', i) as string;
				const read = this.getNodeParameter('read', i) as boolean;
				return dsm.callAny(['SYNO.MailClient.Message'], ['set_status', 'set_read', 'mark', 'update'], {
					id: messageId,
					message_id: messageId,
					read,
					is_read: read,
					...extraParams,
				});
			}

			if (operation === 'labelMessage') {
				const messageId = this.getNodeParameter('messageId', i) as string;
				const labelId = this.getNodeParameter('labelId', i) as string;
				const labelAction = this.getNodeParameter('labelAction', i) as string;
				return dsm.callAny(['SYNO.MailClient.Label', 'SYNO.MailClient.Message'], labelAction === 'add' ? ['add', 'assign', 'set'] : ['remove', 'unassign', 'unset'], {
					id: messageId,
					message_id: messageId,
					label_id: labelId,
					...extraParams,
				});
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
			return dsm.callAuto(api, method, paramsJson || {});
		});
	}
}
