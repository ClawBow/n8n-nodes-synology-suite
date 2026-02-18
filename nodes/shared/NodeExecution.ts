import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

export async function executePerItem(
	context: IExecuteFunctions,
	handler: (itemIndex: number) => Promise<IDataObject>,
): Promise<INodeExecutionData[][]> {
	const items = context.getInputData();
	const output: INodeExecutionData[] = [];

	for (let i = 0; i < items.length; i++) {
		try {
			const data = await handler(i);
			output.push({ json: data });
		} catch (error) {
			if (context.continueOnFail()) {
				output.push({
					json: {
						error: (error as Error).message,
						details: error as IDataObject,
					},
					pairedItem: i,
				});
				continue;
			}
			throw error;
		}
	}

	return [output];
}
