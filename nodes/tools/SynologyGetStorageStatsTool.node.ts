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

export class SynologyGetStorageStatsTool implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Get Storage Stats',
		name: 'synologyGetStorageStatsTool',
		icon: 'file:synology-api.png',
		group: ['output'],
		version: 1,
		description: 'Get NAS storage capacity and usage statistics',
		defaults: { name: 'Synology Get Storage Stats' },
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
				default: 'Get NAS storage capacity and usage statistics',
				description: 'Description for the AI Agent',
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
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		const func = async (input: string): Promise<string> => {
			try {
				const response = await dsm.callAny(
					['SYNO.DiskIO.Status', 'SYNO.Dsm.Volume', 'SYNO.Core.Storage'],
					['get', 'list'],
					{},
				);

				let totalSize = 0;
				let usedSize = 0;

				if (typeof response === 'object' && response !== null) {
					const data = response as any;
					const volumes = Array.isArray(data.volumes) ? data.volumes : [data];

					volumes.forEach((volume: any) => {
						const size = (volume.total_size as number) || 0;
						const used = (volume.used_size as number) || 0;
						totalSize += size;
						usedSize += used;
					});
				}

				const availableSize = totalSize - usedSize;
				const percentUsed = totalSize > 0 ? (usedSize / totalSize) * 100 : 0;

				return `Storage: ${Math.round((usedSize / 1024 / 1024 / 1024))}GB / ${Math.round((totalSize / 1024 / 1024 / 1024))}GB used (${percentUsed.toFixed(1)}%)`;
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
