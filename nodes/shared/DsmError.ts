import type { IDataObject } from 'n8n-workflow';

const DSM_ERROR_CODE_MAP: Record<number, string> = {
	100: 'Unknown error',
	101: 'No parameter of API, method or version',
	102: 'The requested API does not exist',
	103: 'The requested method does not exist',
	104: 'The requested version does not support the functionality',
	105: 'Insufficient user privilege',
	106: 'Session timeout',
	107: 'Session interrupted by duplicate login',
	117: 'Need manager rights',
	119: 'SID not found',
	400: 'Execution failed',
	401: 'Parameter invalid',
	402: 'System is too busy',
	403: 'Permission denied',
	404: 'Resource not found',
	408: 'Request timeout',
	409: 'Conflict',
};

export class DsmApiError extends Error {
	constructor(
		message: string,
		public readonly details: IDataObject,
	) {
		super(message);
		this.name = 'DsmApiError';
	}
}

export function createDsmApiError(
	api: string,
	method: string,
	version: number,
	response: IDataObject,
): DsmApiError {
	const code = Number((response?.error as IDataObject | undefined)?.code ?? -1);
	const mappedMessage = DSM_ERROR_CODE_MAP[code] || 'Unmapped DSM error';
	const message = `DSM API call failed (${api}.${method} v${version}) [code=${code}] ${mappedMessage}`;

	return new DsmApiError(message, {
		api,
		method,
		version,
		code,
		mappedMessage,
		response,
	});
}
