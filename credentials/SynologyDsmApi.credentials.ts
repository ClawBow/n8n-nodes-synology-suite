import type { ICredentialType, INodeProperties } from 'n8n-workflow';

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
}
