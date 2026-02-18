import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
	INodeExecutionData,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';

function toArray(value: unknown): IDataObject[] {
	if (Array.isArray(value)) return value as IDataObject[];
	return [];
}

function extractMessages(data: IDataObject): IDataObject[] {
	const d = (data.data || {}) as IDataObject;
	return [
		...toArray(d.messages),
		...toArray(d.message_list),
		...toArray(d.list),
		...toArray(d.items),
	];
}

function getMessageId(m: IDataObject): string {
	return String(m.id ?? m.message_id ?? m.uid ?? '');
}

function isGreaterMessageId(a: string, b: string): boolean {
	if (!a) return false;
	if (!b) return true;
	try {
		return BigInt(a) > BigInt(b);
	} catch {
		return a > b;
	}
}

export class SynologyMailPlusTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology MailPlus Trigger',
		name: 'synologyMailPlusTrigger',
		icon: 'file:synology.png',
		group: ['trigger'],
		version: 1,
		description: 'Poll Synology MailPlus for newly received messages',
		defaults: { name: 'Synology MailPlus Trigger' },
		inputs: [],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		properties: [
			{
				displayName: 'Mailbox ID',
				name: 'mailboxId',
				type: 'string',
				default: '',
				required: true,
				description: 'Mailbox identifier from Synology MailPlus (get via Synology MailPlus node → List Mailboxes)',
			},
			{
				displayName: 'Poll Every',
				name: 'pollEvery',
				type: 'options',
				default: '60',
				options: [
					{ name: '30 seconds', value: '30' },
					{ name: '1 minute', value: '60' },
					{ name: '5 minutes', value: '300' },
					{ name: '15 minutes', value: '900' },
					{ name: 'Custom', value: 'custom' },
				],
			},
			{
				displayName: 'Poll Every (seconds)',
				name: 'pollEverySeconds',
				type: 'number',
				default: 60,
				displayOptions: { show: { pollEvery: ['custom'] } },
			},
			{
				displayName: 'Batch Size',
				name: 'batchSize',
				type: 'number',
				default: 20,
				description: 'How many latest messages to fetch on each poll',
			},
			{
				displayName: 'Emit Existing On Start',
				name: 'emitExistingOnStart',
				type: 'boolean',
				default: false,
				description: 'If false, first run only stores the latest message and waits for new ones',
			},
			{
				displayName: 'Include Read Messages',
				name: 'includeRead',
				type: 'boolean',
				default: true,
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const mailboxId = this.getNodeParameter('mailboxId') as string;
		const pollEvery = this.getNodeParameter('pollEvery') as string;
		const pollEverySeconds = this.getNodeParameter('pollEverySeconds', 60) as number;
		const batchSize = this.getNodeParameter('batchSize', 20) as number;
		const emitExistingOnStart = this.getNodeParameter('emitExistingOnStart', false) as boolean;
		const includeRead = this.getNodeParameter('includeRead', true) as boolean;
		const intervalMs = (pollEvery === 'custom' ? pollEverySeconds : Number(pollEvery)) * 1000;

		const staticData = this.getWorkflowStaticData('node') as IDataObject;
		let running = false;

		const poll = async () => {
			if (running) return;
			running = true;
			try {
				const result = await dsm.callAny(
					['SYNO.MailClient.Message'],
					['list', 'query', 'getall'],
					{
						mailbox_id: mailboxId,
						offset: 0,
						limit: batchSize,
						sort_by: 'date',
						sort_direction: 'desc',
					},
				);

				let messages = extractMessages(result);
				if (!includeRead) {
					messages = messages.filter((m) => !(m.seen === true || m.is_seen === true || m.read === true));
				}

				messages = messages
					.filter((m) => getMessageId(m))
					.sort((a, b) => {
						const ida = getMessageId(a);
						const idb = getMessageId(b);
						if (isGreaterMessageId(ida, idb)) return 1;
						if (isGreaterMessageId(idb, ida)) return -1;
						return 0;
					});

				const latestInBatch = messages.length ? getMessageId(messages[messages.length - 1]) : '';
				const lastSeen = String(staticData.lastMessageId || '');

				if (!lastSeen && !emitExistingOnStart) {
					if (latestInBatch) staticData.lastMessageId = latestInBatch;
					return;
				}

				const fresh = messages.filter((m) => isGreaterMessageId(getMessageId(m), lastSeen));
				if (fresh.length > 0) {
					const executionData: INodeExecutionData[] = fresh.map((m) => ({ json: m }));
					this.emit([executionData]);
					staticData.lastMessageId = getMessageId(fresh[fresh.length - 1]);
				} else if (latestInBatch && !lastSeen) {
					staticData.lastMessageId = latestInBatch;
				}
			} catch (error) {
				this.logger.error(`SynologyMailPlusTrigger poll failed: ${(error as Error).message}`);
			} finally {
				running = false;
			}
		};

		await poll();
		const timer = setInterval(async () => poll(), intervalMs);

		return {
			closeFunction: async () => clearInterval(timer),
		};
	}
}
