import type {
	ICredentialType,
	INodeProperties,
	ICredentialTestRequest,
} from 'n8n-workflow';

export class SynologyDsmApi implements ICredentialType {
	name = 'synologyDsmApi';
	displayName = 'Synology DSM API';
	documentationUrl = 'https://kb.synology.com';

	properties: INodeProperties[] = [
		{ displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'https://darknas.tail91a2f7.ts.net:7894', required: true },
		{ displayName: 'Username', name: 'username', type: 'string', default: '', required: true },
		{ displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '', required: true },
		{ displayName: 'Session Name', name: 'sessionName', type: 'string', default: 'FileStation' },
		{ displayName: 'Ignore SSL Issues', name: 'ignoreSslIssues', type: 'boolean', default: true },
	];

	// Test avec retry côté n8n (le framework gère les retries sur 401/403)
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/webapi/query.cgi',
			method: 'GET',
			qs: {
				api: 'SYNO.API.Info',
				version: '1',
				method: 'query',
				query: 'all',
			},
			skipSslCertificateValidation: '={{ $credentials.ignoreSslIssues }}',
			timeout: 15000,
		},
	};
}
