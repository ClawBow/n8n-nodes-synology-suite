import type { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class SynologySpreadsheetApi implements ICredentialType {
	name = 'synologySpreadsheetApi';
	displayName = 'Synology Spreadsheet API';
	documentationUrl =
		'https://github.com/openclaw/synology-spreadsheet-api-docs';
	properties: INodeProperties[] = [
		{
			displayName: 'Spreadsheet API Base URL',
			name: 'baseUrl',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'https://darknas.tail91a2f7.ts.net:3000',
			description:
				'Base URL of the Spreadsheet API service (e.g., https://darknas.tail91a2f7.ts.net:3000)',
		},
		{
			displayName: 'DSM Username',
			name: 'username',
			type: 'string',
			default: '',
			required: true,
			placeholder: 'OpenClaw',
			description: 'Synology DSM username for authentication',
		},
		{
			displayName: 'DSM Password',
			name: 'password',
			type: 'string',
			typeOptions: {
				password: true,
			},
			default: '',
			required: true,
			description: 'Synology DSM password for authentication',
		},
		{
			displayName: 'DSM Host',
			name: 'host',
			type: 'string',
			default: '',
			required: true,
			placeholder: '192.168.1.35:5703',
			description: 'Synology DSM host and Office port. Must be LAN IP (e.g., 192.168.1.35:5703)',
		},
		{
			displayName: 'DSM Protocol',
			name: 'protocol',
			type: 'options',
			default: 'http',
			required: true,
			options: [
				{ name: 'HTTP', value: 'http' },
				{ name: 'HTTPS', value: 'https' },
			],
			description: 'Protocol for DSM Office connection. Use HTTP for LAN connections',
		},
	];

	// Test: try to authorize and get a token
	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{ $credentials.baseUrl }}',
			url: '/spreadsheets/authorize',
			method: 'POST',
			body: {
				username: '={{ $credentials.username }}',
				password: '={{ $credentials.password }}',
				host: '={{ $credentials.host }}',
				protocol: '={{ $credentials.protocol }}',
			},
			headers: {
				'Content-Type': 'application/json',
			},
			timeout: 15000,
		},
	};
}
