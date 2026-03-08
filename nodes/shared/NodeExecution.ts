import type { IDataObject, IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';

function toSafeErrorObject(error: unknown): IDataObject {
	if (!error) return { message: 'Unknown error' };
	const e = error as any;
	const out: IDataObject = {
		message: String(e?.message || error),
	};
	if (e?.name) out.name = String(e.name);
	if (e?.code !== undefined) out.code = e.code as any;
	if (e?.stack) out.stack = String(e.stack).split('\n').slice(0, 8).join('\n');
	if (e?.details && typeof e.details === 'object') out.details = e.details as IDataObject;
	if (e?.response?.status !== undefined) out.status = e.response.status as any;
	if (e?.response?.data !== undefined) out.responseData = e.response.data as any;
	return out;
}

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
						details: toSafeErrorObject(error),
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
