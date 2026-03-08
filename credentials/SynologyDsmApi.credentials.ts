import type { ICredentialType, INodeProperties } from 'n8n-workflow';

export class SynologyDsmApi implements ICredentialType {
	name = 'synologyDsmApi';
	displayName = 'Synology DSM API';
	documentationUrl = 'https://kb.synology.com';

	test = {
		request: {
			method: 'GET' as const,
			// Lightweight connectivity probe for credential test.
			// Keep SSL bypass forced here because n8n credential tester can ignore per-credential SSL flags.
			url: '={{$credentials.baseUrl}}/webapi/query.cgi',
			skipSslCertificateValidation: true,
			qs: {
				api: 'SYNO.API.Info',
				version: '1',
				method: 'query',
				query: 'SYNO.API.Auth',
			},
		},
		rules: [
			{
				type: 'responseSuccessBody' as const,
				properties: {
					key: 'success',
					value: true,
					message: 'DSM connectivity check failed. Check URL or SSL settings.',
				},
			},
		],
	};

	properties: INodeProperties[] = [
		{ displayName: 'Base URL', name: 'baseUrl', type: 'string', default: 'https://darknas.tail91a2f7.ts.net:7894', required: true },
		{ displayName: 'Username', name: 'username', type: 'string', default: '', required: true },
		{ displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '', required: true },
		{ displayName: 'Session Name', name: 'sessionName', type: 'string', default: 'FileStation' },
		{ displayName: 'Ignore SSL Issues', name: 'ignoreSslIssues', type: 'boolean', default: true },
	];
}
