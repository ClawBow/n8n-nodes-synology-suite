import axios, { AxiosInstance } from 'axios';
import https from 'https';
import type { ICredentialDataDecryptedObject, IDataObject } from 'n8n-workflow';
import { createDsmApiError, DsmApiError } from './DsmError';

export interface DsmCredentials {
	baseUrl: string;
	username: string;
	password: string;
	sessionName: string;
	ignoreSslIssues: boolean;
}

type ApiInfoEntry = {
	path?: string;
	minVersion?: number;
	maxVersion?: number;
};

export function normalizeCredentials(creds: ICredentialDataDecryptedObject): DsmCredentials {
	return {
		baseUrl: String(creds.baseUrl).replace(/\/$/, ''),
		username: String(creds.username),
		password: String(creds.password),
		sessionName: String(creds.sessionName || 'FileStation'),
		ignoreSslIssues: Boolean(creds.ignoreSslIssues),
	};
}

function normalizeParamValue(value: unknown): unknown {
	if (value === undefined || value === null) return undefined;
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	if (typeof value === 'object' && !Array.isArray(value)) return JSON.stringify(value);
	if (Array.isArray(value)) return JSON.stringify(value);
	return value;
}

export class DsmClient {
	private readonly client: AxiosInstance;
	private sid?: string;
	private apiInfoCache?: Record<string, ApiInfoEntry>;

	constructor(private readonly creds: DsmCredentials) {
		this.client = axios.create({
			timeout: 60000,
			httpsAgent: new https.Agent({ rejectUnauthorized: !creds.ignoreSslIssues }),
		});
	}

	async login(): Promise<void> {
		const { data } = await this.client.get(`${this.creds.baseUrl}/webapi/entry.cgi`, {
			params: {
				api: 'SYNO.API.Auth',
				version: '7',
				method: 'login',
				account: this.creds.username,
				passwd: this.creds.password,
				session: this.creds.sessionName,
				format: 'sid',
			},
		});

		if (!data?.success) {
			throw new Error(`DSM login failed: ${JSON.stringify(data)}`);
		}
		this.sid = data.data.sid;
	}

	async getApiInfoMap(forceRefresh = false): Promise<Record<string, ApiInfoEntry>> {
		if (this.apiInfoCache && !forceRefresh) return this.apiInfoCache;
		const response = await this.call('SYNO.API.Info', 'query', 1, { query: 'all' }, false);
		if (!response.success || !response.data) {
			throw new Error(`Failed to fetch API info map: ${JSON.stringify(response)}`);
		}
		this.apiInfoCache = response.data as Record<string, ApiInfoEntry>;
		return this.apiInfoCache;
	}

	async queryApis(query: string): Promise<IDataObject> {
		return this.call('SYNO.API.Info', 'query', 1, { query }, false);
	}

	async callAuto(api: string, method: string, extraParams: IDataObject = {}): Promise<IDataObject> {
		const map = await this.getApiInfoMap();
		const version = map[api]?.maxVersion ?? 1;
		return this.call(api, method, version, extraParams, false);
	}

	async callAny(
		apiCandidates: string[],
		methodCandidates: string[],
		extraParams: IDataObject = {},
	): Promise<IDataObject> {
		const failures: IDataObject[] = [];
		for (const api of apiCandidates) {
			for (const method of methodCandidates) {
				try {
					return await this.callAuto(api, method, extraParams);
				} catch (error) {
					if (error instanceof DsmApiError) {
						failures.push(error.details);
						const code = Number(error.details.code);
						if (![102, 103, 104].includes(code)) {
							throw error;
						}
						continue;
					}
					throw error;
				}
			}
		}

		throw new Error(`No compatible API/method found. Tried: ${JSON.stringify({ apiCandidates, methodCandidates, failures })}`);
	}

	async call(
		api: string,
		method: string,
		version: number,
		extraParams: IDataObject = {},
		retryOnAuthError = true,
	): Promise<IDataObject> {
		if (!this.sid) await this.login();

		const normalized: IDataObject = {};
		for (const [key, value] of Object.entries(extraParams)) {
			const normalizedValue = normalizeParamValue(value);
			if (normalizedValue !== undefined) normalized[key] = normalizedValue;
		}

		const params: IDataObject = {
			api,
			method,
			version,
			_sid: this.sid as string,
			...normalized,
		};

		const { data } = await this.client.get(`${this.creds.baseUrl}/webapi/entry.cgi`, { params });

		if (!data?.success && retryOnAuthError) {
			const code = data?.error?.code;
			if ([105, 106, 107, 119].includes(code)) {
				await this.login();
				return this.call(api, method, version, extraParams, false);
			}
		}

		if (!data?.success) {
			throw createDsmApiError(api, method, version, data as IDataObject);
		}

		return data as IDataObject;
	}
}
