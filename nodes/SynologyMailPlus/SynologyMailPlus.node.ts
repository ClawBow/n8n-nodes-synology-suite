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
		icon: 'file:synology-mailplus.png',
		group: ['transform'],
		version: 1,
		description: 'Synology MailPlus API operations (18 endpoints + legacy support)',
		defaults: { name: 'Synology MailPlus' },
		inputs: ['main'],
		outputs: ['main'],
		usableAsTool: true,
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listMailboxes',
				options: [
					// Authorization (2)
					{ name: '[AUTH] Login', value: 'login' },
					{ name: '[AUTH] Logout', value: 'logout' },
					// Mailbox Configuration (5)
					{ name: '[MAILBOX] Get', value: 'getMailboxes' },
					{ name: '[MAILBOX] List', value: 'listMailboxes' },
					{ name: '[MAILBOX] Create', value: 'createMailbox' },
					{ name: '[MAILBOX] Update', value: 'updateMailbox' },
					{ name: '[MAILBOX] Delete', value: 'deleteMailbox' },
					// Label Configuration (5)
					{ name: '[LABEL] Get', value: 'getLabels' },
					{ name: '[LABEL] List', value: 'listLabels' },
					{ name: '[LABEL] Create', value: 'createLabel' },
					{ name: '[LABEL] Update', value: 'updateLabel' },
					{ name: '[LABEL] Delete', value: 'deleteLabel' },
					// Filter Configuration (5)
					{ name: '[FILTER] Get', value: 'getFilters' },
					{ name: '[FILTER] List', value: 'listFilters' },
					{ name: '[FILTER] Create', value: 'createFilter' },
					{ name: '[FILTER] Update', value: 'updateFilter' },
					{ name: '[FILTER] Delete', value: 'deleteFilter' },
					// Send Mail (1)
					{ name: '[MAIL] Send Email', value: 'sendEmail' },
					// Legacy Support (9)
					{ name: '[LEGACY] List Mail APIs', value: 'listApis' },
					{ name: '[LEGACY] Get Mail Server Version', value: 'serverVersion' },
					{ name: '[LEGACY] List Messages', value: 'listMessages' },
					{ name: '[LEGACY] Get Message Detail', value: 'getMessage' },
					{ name: '[LEGACY] Move Message', value: 'moveMessage' },
					{ name: '[LEGACY] Mark Read / Unread', value: 'markReadStatus' },
					{ name: '[LEGACY] Add / Remove Label', value: 'labelMessage' },
					{ name: '[LEGACY] Get Account Info', value: 'getAccountInfo' },
					{ name: '[LEGACY] Custom Mail Call', value: 'customMailCall' },
				],
			},
			// Authentication fields
			{ displayName: 'DSM Account', name: 'dsmAccount', type: 'string', default: '', placeholder: 'admin', displayOptions: { show: { operation: ['login'] } } },
			{ displayName: 'DSM Password', name: 'dsmPassword', type: 'string', typeOptions: { password: true }, default: '', displayOptions: { show: { operation: ['login'] } } },
			{ displayName: 'Session ID (SID)', name: 'sid', type: 'string', default: '', placeholder: 'abcd1234', displayOptions: { show: { operation: ['logout'] } } },
			
			// Mailbox fields
			{ displayName: 'Mailbox IDs (JSON Array)', name: 'mailboxIds', type: 'json', default: '[-1]', placeholder: '[-1, 1, 2]', displayOptions: { show: { operation: ['getMailboxes'] } } },
			{ displayName: 'Mailbox Name', name: 'mailboxName', type: 'string', default: '', placeholder: 'Archive', displayOptions: { show: { operation: ['createMailbox'] } } },
			{ displayName: 'Parent Mailbox ID', name: 'parentMailboxId', type: 'number', default: 0, displayOptions: { show: { operation: ['createMailbox', 'updateMailbox'] } } },
			{ displayName: 'Subscribed', name: 'subscribed', type: 'boolean', default: true, displayOptions: { show: { operation: ['createMailbox', 'updateMailbox'] } } },
			{ displayName: 'Mailbox ID', name: 'mailboxId', type: 'string', default: '', placeholder: '1', displayOptions: { show: { operation: ['updateMailbox', 'deleteMailbox', 'listMessages', 'moveMessage'] } } },
			{ displayName: 'Conversation View', name: 'conversationView', type: 'boolean', default: false, displayOptions: { show: { operation: ['getMailboxes', 'listMailboxes', 'deleteMailbox'] } } },
			{ displayName: 'Additional Attributes', name: 'additionalAttributes', type: 'multiOptions', options: [{ name: 'Unread Count', value: 'unread_count' }, { name: 'Draft Total Count', value: 'draft_total_count' }, { name: 'Total Count', value: 'total_count' }, { name: 'Permission', value: 'permission' }], default: [], displayOptions: { show: { operation: ['getMailboxes', 'listMailboxes'] } } },
			
			// Label fields
			{ displayName: 'Label IDs (JSON Array)', name: 'labelIds', type: 'json', default: '[1]', placeholder: '[1, 2, 3]', displayOptions: { show: { operation: ['getLabels', 'deleteLabel'] } } },
			{ displayName: 'Label Name', name: 'labelName', type: 'string', default: '', placeholder: 'New Label', displayOptions: { show: { operation: ['createLabel'] } } },
			{ displayName: 'Background Color', name: 'backgroundColor', type: 'string', default: '24BFF2', placeholder: '24BFF2', displayOptions: { show: { operation: ['createLabel', 'updateLabel'] } } },
			{ displayName: 'Text Color', name: 'textColor', type: 'string', default: 'FFFFFF', placeholder: 'FFFFFF', displayOptions: { show: { operation: ['createLabel'] } } },
			{ displayName: 'Parent Label ID', name: 'parentLabelId', type: 'number', default: 0, displayOptions: { show: { operation: ['createLabel', 'updateLabel'] } } },
			{ displayName: 'Label ID', name: 'labelId', type: 'string', default: '', placeholder: '1', displayOptions: { show: { operation: ['updateLabel', 'labelMessage'] } } },
			{ displayName: 'Label Action', name: 'labelAction', type: 'options', options: [{ name: 'Add', value: 'add' }, { name: 'Remove', value: 'remove' }], default: 'add', displayOptions: { show: { operation: ['labelMessage'] } } },
			
			// Filter fields
			{ displayName: 'Filter IDs (JSON Array)', name: 'filterIds', type: 'json', default: '[1]', placeholder: '[1, 2, 3]', displayOptions: { show: { operation: ['getFilters', 'deleteFilter'] } } },
			{ displayName: 'Filter Conditions (JSON)', name: 'filterConditions', type: 'json', default: '[]', placeholder: '[{"name":"from","value":"test@example.com"}]', typeOptions: { rows: 6 }, displayOptions: { show: { operation: ['createFilter', 'updateFilter'] } } },
			{ displayName: 'Filter Actions (JSON)', name: 'filterActions', type: 'json', default: '[]', placeholder: '[{"name":"set_label","value":"1"}]', typeOptions: { rows: 6 }, displayOptions: { show: { operation: ['createFilter', 'updateFilter'] } } },
			{ displayName: 'Filter Enabled', name: 'filterEnabled', type: 'boolean', default: true, displayOptions: { show: { operation: ['createFilter', 'updateFilter'] } } },
			{ displayName: 'Apply to Existing', name: 'applyExisting', type: 'boolean', default: false, displayOptions: { show: { operation: ['createFilter', 'updateFilter'] } } },
			{ displayName: 'Filter ID', name: 'filterId', type: 'string', default: '', placeholder: '1', displayOptions: { show: { operation: ['updateFilter'] } } },
			
			// Email fields
			{ displayName: 'From', name: 'from', type: 'string', default: '', placeholder: 'sender@example.com', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'To (JSON Array)', name: 'to', type: 'json', default: '["recipient@example.com"]', placeholder: '["to@example.com"]', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'CC (JSON Array)', name: 'cc', type: 'json', default: '[]', placeholder: '["cc@example.com"]', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'BCC (JSON Array)', name: 'bcc', type: 'json', default: '[]', placeholder: '["bcc@example.com"]', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'Subject', name: 'subject', type: 'string', default: '', placeholder: 'Hello', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'Body', name: 'body', type: 'string', typeOptions: { rows: 6 }, default: '', placeholder: '<p>Hello World</p>', displayOptions: { show: { operation: ['sendEmail'] } } },
			{ displayName: 'Is Plain Text', name: 'isPlain', type: 'boolean', default: false, displayOptions: { show: { operation: ['sendEmail'] } } },
			
			// Legacy fields
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Return All', name: 'returnAll', type: 'boolean', default: false, displayOptions: { show: { operation: ['listMessages'] } } },
			{ displayName: 'Message ID', name: 'messageId', type: 'string', default: '', displayOptions: { show: { operation: ['getMessage', 'markReadStatus', 'labelMessage'] } } },
			{ displayName: 'Message IDs (JSON Array)', name: 'messageIds', type: 'json', default: '["123"]', displayOptions: { show: { operation: ['moveMessage'] } } },
			{ displayName: 'Destination Mailbox ID', name: 'destinationMailboxId', type: 'string', default: '', displayOptions: { show: { operation: ['moveMessage'] } } },
			{ displayName: 'Read', name: 'read', type: 'boolean', default: true, displayOptions: { show: { operation: ['markReadStatus'] } } },
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

			// ===== NEW MAILPLUS API OPERATIONS (18 ops) =====
			
			// AUTH: Login
			if (operation === 'login') {
				const account = this.getNodeParameter('dsmAccount', i) as string;
				const passwd = this.getNodeParameter('dsmPassword', i) as string;
				return dsm.callAuto('SYNO.MailClient.Auth', 'login', {
					format: 'sid',
					account,
					passwd,
				});
			}

			// AUTH: Logout
			if (operation === 'logout') {
				const sid = this.getNodeParameter('sid', i) as string;
				return dsm.callAuto('SYNO.MailClient.Auth', 'logout', {
					_sid: sid,
				});
			}

			// MAILBOX: Get
			if (operation === 'getMailboxes') {
				const mailboxIds = this.getNodeParameter('mailboxIds', i) as number[];
				const conversationView = this.getNodeParameter('conversationView', i, false) as boolean;
				const additionalAttributes = this.getNodeParameter('additionalAttributes', i, []) as string[];
				return dsm.callAuto('SYNO.MailClient.Mailbox', 'get', {
					id: mailboxIds,
					conversation_view: conversationView,
					additional: additionalAttributes,
				});
			}

			// MAILBOX: List
			if (operation === 'listMailboxes') {
				const conversationView = this.getNodeParameter('conversationView', i, false) as boolean;
				const additionalAttributes = this.getNodeParameter('additionalAttributes', i, []) as string[];
				const extraParams = this.getNodeParameter('extraParamsJson', i, {}) as IDataObject;
				return dsm.callAuto('SYNO.MailClient.Mailbox', 'list', {
					conversation_view: conversationView,
					additional: additionalAttributes,
					...extraParams,
				});
			}

			// MAILBOX: Create
			if (operation === 'createMailbox') {
				const name = this.getNodeParameter('mailboxName', i) as string;
				const parentId = this.getNodeParameter('parentMailboxId', i, 0) as number;
				const subscribed = this.getNodeParameter('subscribed', i, true) as boolean;
				return dsm.callAuto('SYNO.MailClient.Mailbox', 'create', {
					name,
					parent_id: parentId,
					subscribed,
				});
			}

			// MAILBOX: Update
			if (operation === 'updateMailbox') {
				const mailboxId = this.getNodeParameter('mailboxId', i) as string;
				const name = this.getNodeParameter('mailboxName', i, '') as string;
				const parentId = this.getNodeParameter('parentMailboxId', i, 0) as number;
				const subscribed = this.getNodeParameter('subscribed', i, true) as boolean;
				const params: IDataObject = { id: mailboxId };
				if (name) params.name = name;
				if (parentId !== undefined) params.parent_id = parentId;
				if (subscribed !== undefined) params.subscribed = subscribed;
				return dsm.callAuto('SYNO.MailClient.Mailbox', 'update', params);
			}

			// MAILBOX: Delete
			if (operation === 'deleteMailbox') {
				const mailboxIds = this.getNodeParameter('mailboxIds', i) as number[];
				const conversationView = this.getNodeParameter('conversationView', i, false) as boolean;
				return dsm.callAuto('SYNO.MailClient.Mailbox', 'delete', {
					id: mailboxIds,
					conversation_view: conversationView,
				});
			}

			// LABEL: Get
			if (operation === 'getLabels') {
				const labelIds = this.getNodeParameter('labelIds', i) as number[];
				const conversationView = this.getNodeParameter('conversationView', i, false) as boolean;
				const additionalAttributes = this.getNodeParameter('additionalAttributes', i, []) as string[];
				return dsm.callAuto('SYNO.MailClient.Label', 'get', {
					id: labelIds,
					conversation_view: conversationView,
					additional: additionalAttributes,
				});
			}

			// LABEL: List
			if (operation === 'listLabels') {
				const conversationView = this.getNodeParameter('conversationView', i, false) as boolean;
				const additionalAttributes = this.getNodeParameter('additionalAttributes', i, []) as string[];
				return dsm.callAuto('SYNO.MailClient.Label', 'list', {
					conversation_view: conversationView,
					additional: additionalAttributes,
				});
			}

			// LABEL: Create
			if (operation === 'createLabel') {
				const name = this.getNodeParameter('labelName', i) as string;
				const backgroundColor = this.getNodeParameter('backgroundColor', i, '24BFF2') as string;
				const textColor = this.getNodeParameter('textColor', i, 'FFFFFF') as string;
				const parentId = this.getNodeParameter('parentLabelId', i, 0) as number;
				const params: IDataObject = {
					name,
					background_color: backgroundColor,
					text_color: textColor,
				};
				if (parentId !== 0) params.parent_id = parentId;
				return dsm.callAuto('SYNO.MailClient.Label', 'create', params);
			}

			// LABEL: Update
			if (operation === 'updateLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				const name = this.getNodeParameter('labelName', i, '') as string;
				const backgroundColor = this.getNodeParameter('backgroundColor', i, '') as string;
				const parentId = this.getNodeParameter('parentLabelId', i) as number;
				const params: IDataObject = { id: labelId };
				if (name) params.name = name;
				if (backgroundColor) params.background_color = backgroundColor;
				if (parentId !== undefined) params.parent_id = parentId;
				return dsm.callAuto('SYNO.MailClient.Label', 'update', params);
			}

			// LABEL: Delete
			if (operation === 'deleteLabel') {
				const labelIds = this.getNodeParameter('labelIds', i) as number[];
				return dsm.callAuto('SYNO.MailClient.Label', 'delete', {
					id: labelIds,
				});
			}

			// FILTER: Get
			if (operation === 'getFilters') {
				const filterIds = this.getNodeParameter('filterIds', i) as number[];
				return dsm.callAuto('SYNO.MailClient.Filter', 'get', {
					id: filterIds,
				});
			}

			// FILTER: List
			if (operation === 'listFilters') {
				return dsm.callAuto('SYNO.MailClient.Filter', 'list', {});
			}

			// FILTER: Create
			if (operation === 'createFilter') {
				const conditions = this.getNodeParameter('filterConditions', i) as unknown[];
				const actions = this.getNodeParameter('filterActions', i) as unknown[];
				const enabled = this.getNodeParameter('filterEnabled', i, true) as boolean;
				const applyExisting = this.getNodeParameter('applyExisting', i, false) as boolean;
				return dsm.callAuto('SYNO.MailClient.Filter', 'create', {
					condition: conditions,
					action: actions,
					enabled,
					apply_exist: applyExisting,
				});
			}

			// FILTER: Update
			if (operation === 'updateFilter') {
				const filterId = this.getNodeParameter('filterId', i) as string;
				const conditions = this.getNodeParameter('filterConditions', i) as unknown[];
				const actions = this.getNodeParameter('filterActions', i) as unknown[];
				const enabled = this.getNodeParameter('filterEnabled', i, true) as boolean;
				const applyExisting = this.getNodeParameter('applyExisting', i, false) as boolean;
				return dsm.callAuto('SYNO.MailClient.Filter', 'update', {
					id: filterId,
					condition: conditions,
					action: actions,
					enabled,
					apply_exist: applyExisting,
				});
			}

			// FILTER: Delete
			if (operation === 'deleteFilter') {
				const filterIds = this.getNodeParameter('filterIds', i) as number[];
				return dsm.callAuto('SYNO.MailClient.Filter', 'delete', {
					id: filterIds,
				});
			}

			// MAIL: Send Email
			if (operation === 'sendEmail') {
				const from = this.getNodeParameter('from', i) as string;
				const to = this.getNodeParameter('to', i) as string[];
				const cc = this.getNodeParameter('cc', i, []) as string[];
				const bcc = this.getNodeParameter('bcc', i, []) as string[];
				const subject = this.getNodeParameter('subject', i) as string;
				const body = this.getNodeParameter('body', i) as string;
				const isPlain = this.getNodeParameter('isPlain', i, false) as boolean;
				return dsm.callAuto('SYNO.MailClient.Mail', 'send', {
					from,
					to,
					cc,
					bcc,
					subject,
					body,
					is_plain: isPlain,
				});
			}

			// ===== LEGACY OPERATIONS (backward compatibility, 9 ops) =====
			const extraParams = this.getNodeParameter('extraParamsJson', i, {}) as IDataObject;

			if (operation === 'listApis') {
				return dsm.queryApis('SYNO.MailClient.*,SYNO.MailPlusServer.*');
			}

			if (operation === 'serverVersion') {
				return dsm.callAuto('SYNO.MailPlusServer.Version', 'get', {});
			}

			if (operation === 'listMessages') {
				const mailboxId = this.getNodeParameter('mailboxId', i) as string;
				const offset = this.getNodeParameter('offset', i) as number;
				const limit = this.getNodeParameter('limit', i) as number;
				const returnAll = this.getNodeParameter('returnAll', i) as boolean;

				if (!returnAll) {
					return dsm.callAny(['SYNO.MailClient.Message'], ['list', 'query', 'get'], {
						mailbox_id: mailboxId,
						offset,
						limit,
						...extraParams,
					});
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
					const messages = pickMessageArray(page as IDataObject);
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
				return dsm.callAny(['SYNO.MailClient.Message'], ['get', 'detail', 'view'], {
					id: messageId,
					message_id: messageId,
					...extraParams,
				});
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
				return dsm.callAny(
					['SYNO.MailClient.Label', 'SYNO.MailClient.Message'],
					labelAction === 'add' ? ['add', 'assign', 'set'] : ['remove', 'unassign', 'unset'],
					{
						id: messageId,
						message_id: messageId,
						label_id: labelId,
						...extraParams,
					}
				);
			}

			if (operation === 'getAccountInfo') {
				return dsm.callAny(['SYNO.MailClient.Account'], ['info', 'get', 'list'], extraParams);
			}

			if (operation === 'customMailCall') {
				const api = this.getNodeParameter('api', i) as string;
				const method = this.getNodeParameter('method', i) as string;
				const paramsJson = this.getNodeParameter('paramsJson', i) as IDataObject;
				return dsm.callAuto(api, method, paramsJson || {});
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
