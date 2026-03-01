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

export class SynologyMailPlusSendEmailTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Send Email',
		name: 'synologyMailPlusSendEmailTool',
		icon: 'file:synology-mailplus.png',
		group: ['output'],
		version: 1,
		description: 'Send an email via Synology MailPlus',
		defaults: { name: 'Synology Send Email' },
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
				default: 'Send an email via Synology MailPlus',
				description: 'Description for the AI Agent',
			},
			{
				displayName: 'Default From Address',
				name: 'defaultFrom',
				type: 'string',
				required: true,
				default: '',
				description: 'Default sender email address',
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
				{
					itemIndex,
					description:
						"Only alphanumeric characters and underscores are allowed in the tool's name, and the name cannot start with a number",
				},
			);
		}

		const toolDescription = this.getNodeParameter('toolDescription', itemIndex) as string;
		const defaultFrom = this.getNodeParameter('defaultFrom', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				// Parse input: expects JSON like { to: "...", subject: "...", body: "..." }
				let params: { to?: string; cc?: string; bcc?: string; subject?: string; body?: string };
				try {
					params = JSON.parse(input);
				} catch {
					params = { to: input };
				}

				if (!params.to) {
					return 'Error: "to" field is required';
				}
				if (!params.subject) {
					return 'Error: "subject" field is required';
				}
				if (!params.body) {
					return 'Error: "body" field is required';
				}

				const response = await dsm.callAny(
					['SYNO.MailClient.Send', 'SYNO.MailPlusServer.Send'],
					['send', 'create'],
					{
						from: defaultFrom,
						to: params.to,
						cc: params.cc,
						bcc: params.bcc,
						subject: params.subject,
						body: params.body,
					},
				);

				return `Email sent successfully to ${params.to}`;
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
