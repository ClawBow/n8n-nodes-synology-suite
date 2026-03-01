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

export class SynologyDriveListFilesTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology List Files',
		name: 'synologyDriveListFilesTool',
		icon: 'file:synology-drive.png',
		group: ['output'],
		version: 1,
		description: 'List files in a Synology Drive folder',
		defaults: { name: 'Synology List Files' },
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
				default: 'List files in a Synology Drive folder',
				description: 'Description for the AI Agent',
			},
			{
				displayName: 'Default Folder Path',
				name: 'defaultPath',
				type: 'string',
				required: true,
				default: '/Documents',
				description: 'Default folder path to list (e.g., /Documents)',
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
		const defaultPath = this.getNodeParameter('defaultPath', itemIndex) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				// Parse input: expects path as string or JSON
				let path = input;
				try {
					const params = JSON.parse(input);
					if (params.path) {
						path = params.path;
					}
				} catch {
					path = input || defaultPath;
				}

				const response = await dsm.callAny(
					['SYNO.Dsm.Share', 'SYNO.FolderSharing'],
					['list', 'get'],
					{
						path,
						limit: 100,
					},
				);

				let files: string[] = [];
				if (Array.isArray(response)) {
					files = response.map((f: any) => f.name || f);
				} else if (typeof response === 'object' && response !== null) {
					const fileArray = (response as any).files || response;
					files = Array.isArray(fileArray) ? fileArray.map((f: any) => f.name || f) : [];
				}

				const fileList = files.slice(0, 10).join(', ');
				return `Files in ${path}: ${fileList}${files.length > 10 ? ' ... and more' : ''}`;
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
