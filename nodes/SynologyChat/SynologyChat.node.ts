import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

function parseJsonParam(value: unknown): IDataObject {
	if (!value) return {};
	if (typeof value === 'object') return value as IDataObject;
	try {
		return JSON.parse(String(value)) as IDataObject;
	} catch {
		return {};
	}
}

export class SynologyChat implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Chat',
		name: 'synologyChat',
		icon: 'file:synology-chat.png',
		group: ['transform'],
		version: 1,
		description: 'Synology Chat operations (v2 safe set)',
		defaults: { name: 'Synology Chat' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listChannels',
				options: [
					{ name: 'List Channels', value: 'listChannels' },
					{ name: 'Get Channel', value: 'getChannel' },
					{ name: 'List Posts', value: 'listPosts' },
					{ name: 'List Users', value: 'listUsers' },
					{ name: 'Get User', value: 'getUser' },
					{ name: 'Send Message', value: 'sendMessage' },
					{ name: 'List Incoming Webhooks', value: 'listIncomingWebhooks' },
					{ name: 'Create Incoming Webhook', value: 'createIncomingWebhook' },
					{ name: 'List Apps', value: 'listApps' },
					{ name: 'Custom Chat Call', value: 'customChatCall' },
				],
			},
			{ displayName: 'User ID', name: 'userId', type: 'string', default: '', displayOptions: { show: { operation: ['getUser'] } } },
			{ displayName: 'Channel ID', name: 'channelId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['sendMessage', 'listPosts', 'getChannel', 'createIncomingWebhook'] } } },
			{ displayName: 'Message', name: 'message', type: 'string', default: '', required: true, typeOptions: { rows: 3 }, displayOptions: { show: { operation: ['sendMessage'] } } },
			{ displayName: 'Webhook Name', name: 'webhookName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createIncomingWebhook'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listChannels', 'listUsers', 'listIncomingWebhooks', 'listApps', 'listPosts'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listChannels', 'listUsers', 'listIncomingWebhooks', 'listApps', 'listPosts'] } } },
			{ displayName: 'API Name', name: 'api', type: 'string', default: 'SYNO.Chat.Channel', displayOptions: { show: { operation: ['customChatCall'] } } },
			{ displayName: 'Method', name: 'method', type: 'string', default: 'list', displayOptions: { show: { operation: ['customChatCall'] } } },
			{ displayName: 'Params (JSON)', name: 'paramsJson', type: 'json', default: '{}', displayOptions: { show: { operation: ['customChatCall'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const chatApis = ['SYNO.Chat.Channel', 'SYNO.Chat.ChannelV2'];
			const postApis = ['SYNO.Chat.Post', 'SYNO.Chat.Message'];
			const userApis = ['SYNO.Chat.User', 'SYNO.Chat.Member'];
			const webhookApis = ['SYNO.Chat.Webhook.Incoming', 'SYNO.Chat.Webhook'];
			const appApis = ['SYNO.Chat.App', 'SYNO.Chat.Bot'];

			if (operation === 'listChannels') {
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				return dsm.callAny(chatApis, ['list', 'get'], { offset, limit });
			}

			if (operation === 'getChannel') {
				const channelId = this.getNodeParameter('channelId', i) as string;
				const response = await dsm.callAny(chatApis, ['list', 'get'], { offset: 0, limit: 500 });
				const channels = ((response.data as IDataObject | undefined)?.channels as IDataObject[] | undefined) || [];
				const channel = channels.find((c) => String((c as IDataObject).channel_id) === String(channelId));
				if (!channel) {
					throw new Error(`Channel not found for channel_id=${channelId}. Fallback: run List Channels to discover available IDs and retry.`);
				}
				return {
					...response,
					data: {
						...(response.data as IDataObject),
						channel,
					},
				};
			}

			if (operation === 'listPosts') {
				const channelId = this.getNodeParameter('channelId', i) as string;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				return dsm.callAny(postApis, ['list', 'get'], { channel_id: channelId, offset, limit });
			}

			if (operation === 'listUsers') {
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				return dsm.callAny(userApis, ['list', 'get'], { offset, limit });
			}

			if (operation === 'getUser') {
				const userId = this.getNodeParameter('userId', i) as string;
				const params: IDataObject = {};
				if (userId) params.user_id = userId;
				return dsm.callAny(userApis, ['get', 'list'], params);
			}

			if (operation === 'sendMessage') {
				const channelId = this.getNodeParameter('channelId', i) as string;
				const message = this.getNodeParameter('message', i) as string;
				return dsm.callAny(postApis, ['create', 'send'], { channel_id: channelId, message });
			}

			if (operation === 'listIncomingWebhooks') {
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				return dsm.callAny(webhookApis, ['list', 'get'], { offset, limit });
			}

			if (operation === 'createIncomingWebhook') {
				const channelId = this.getNodeParameter('channelId', i) as string;
				const webhookName = this.getNodeParameter('webhookName', i) as string;
				return dsm.callAny(webhookApis, ['create', 'add'], { channel_id: channelId, name: webhookName });
			}

			if (operation === 'listApps') {
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				return dsm.callAny(appApis, ['list', 'get'], { offset, limit });
			}

			const api = this.getNodeParameter('api', i) as string;
			const method = this.getNodeParameter('method', i) as string;
			const paramsJson = parseJsonParam(this.getNodeParameter('paramsJson', i, {}));
			return dsm.callAuto(api, method, paramsJson);
		});
	}
}
