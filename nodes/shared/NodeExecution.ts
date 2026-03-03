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
			
			// Check if handler returned { json, binary } structure
			if (data && typeof data === 'object' && 'json' in data && 'binary' in data) {
				output.push({
					json: (data as any).json,
					binary: (data as any).binary,
				} as INodeExecutionData);
			} else {
				// Otherwise wrap in json property
				output.push({ json: data } as INodeExecutionData);
			}
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
