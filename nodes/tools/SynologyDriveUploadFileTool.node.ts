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

export class SynologyDriveUploadFileTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Upload File',
		name: 'synologyDriveUploadFileTool',
		icon: 'file:synology-drive.png',
		group: ['output'],
		version: 1,
		description: 'Upload a file to Synology Drive',
		defaults: { name: 'Synology Upload File' },
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
				default: 'Upload a file to Synology Drive',
				description: 'Description for the AI Agent',
			},
			{
				displayName: 'Default Destination Folder',
				name: 'defaultPath',
				type: 'string',
				required: true,
				default: '/Documents',
				description: 'Default destination folder path (e.g., /Documents)',
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
				// Parse input: expects JSON like { filename: "...", content: "..." } or path as string
				let params: { filename?: string; content?: string; path?: string };
				try {
					params = JSON.parse(input);
				} catch {
					params = { filename: input };
				}

				if (!params.filename) {
					return 'Error: "filename" field is required';
				}
				if (!params.content) {
					return 'Error: "content" field is required';
				}

				const path = params.path || `${defaultPath}/${params.filename}`;

				const response = await dsm.callAny(
					['SYNO.Dsm.Share', 'SYNO.FolderSharing'],
					['upload', 'create'],
					{
						path,
						content: params.content,
						overwrite: 'false',
					},
				);

				return `File uploaded successfully to ${path}`;
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
