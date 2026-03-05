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
	private requestQueue: Array<() => Promise<any>> = [];
	private activeRequests = 0;
	private readonly maxConcurrent = 10;

	constructor(private readonly creds: DsmCredentials) {
		this.client = axios.create({
			timeout: 60000,
			httpsAgent: new https.Agent({ rejectUnauthorized: !creds.ignoreSslIssues }),
		});
	}

	private async executeWithRateLimit<T>(fn: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const task = async () => {
				try {
					this.activeRequests++;
					const result = await fn();
					resolve(result);
				} catch (error) {
					reject(error);
				} finally {
					this.activeRequests--;
					this.processQueue();
				}
			};

			if (this.activeRequests < this.maxConcurrent) {
				task();
			} else {
				this.requestQueue.push(task);
			}
		});
	}

	private processQueue(): void {
		if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrent) {
			const task = this.requestQueue.shift();
			if (task) {
				task().catch(() => {
					/* error handling done in task */
				});
			}
		}
	}

	private async retryWithExponentialBackoff<T>(
		fn: () => Promise<T>,
		maxRetries = 3,
	): Promise<T> {
		let lastError: any;
		for (let attempt = 0; attempt < maxRetries; attempt++) {
			try {
				return await fn();
			} catch (error: any) {
				lastError = error;
				// Check if it's a 402 error (Payment Required) or rate limit
				const status = error?.response?.status;
				const code = error?.response?.data?.error?.code;
				
				if (status === 402 || code === 402 || (error?.response?.status >= 429 && error?.response?.status <= 429)) {
					if (attempt < maxRetries - 1) {
						const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
						await new Promise(resolve => setTimeout(resolve, delay));
						continue;
					}
				}
				throw error;
			}
		}
		throw lastError;
	}

	async uploadFile(fileBuffer: Buffer, fileName: string, destPath: string, overwrite: boolean, createParents: boolean): Promise<IDataObject> {
		return this.executeWithRateLimit(async () => {
			return this.retryWithExponentialBackoff(async () => {
				if (!this.sid) {
					await this.login();
				}

				try {
					// Build multipart body manually
					const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
					const lines: string[] = [];

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="api"');
					lines.push('');
					lines.push('SYNO.FileStation.Upload');

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="version"');
					lines.push('');
					lines.push('2');

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="method"');
					lines.push('');
					lines.push('upload');

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="path"');
					lines.push('');
					lines.push(destPath);

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="create_parents"');
					lines.push('');
					lines.push(createParents ? 'true' : 'false');

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="overwrite"');
					lines.push('');
					lines.push(overwrite ? 'true' : 'false');

					lines.push(`--${boundary}`);
					lines.push(`Content-Disposition: form-data; name="file"; filename="${fileName}"`);
					lines.push('Content-Type: application/octet-stream');
					lines.push('');

					const header = Buffer.from(lines.join('\r\n') + '\r\n');
					const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
					const body = Buffer.concat([header, fileBuffer, footer]);

					const uploadUrl = `${this.creds.baseUrl}/webapi/entry.cgi`;
					const response = await this.client.post(uploadUrl, body, {
						params: { _sid: this.sid },
						headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
						validateStatus: () => true,
					});

					const result = response.data as IDataObject;

					if (result.success === true) {
						return { success: true, fileName, path: destPath, data: result.data };
					} else {
						return { success: false, error: result.error || 'Upload failed', data: result };
					}
				} catch (error) {
					return { success: false, error: `Upload operation failed: ${error}` };
				}
			});
		});
	}

	async login(): Promise<void> {
		return this.executeWithRateLimit(async () => {
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
		});
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
		return this.executeWithRateLimit(async () => {
			return this.retryWithExponentialBackoff(async () => {
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

				const { data } = await this.client.get(`${this.creds.baseUrl}/webapi/entry.cgi`, { params, validateStatus: () => true });

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
			});
		});
	}

	async downloadFile(filePath: string): Promise<Buffer> {
		return this.executeWithRateLimit(async () => {
			return this.retryWithExponentialBackoff(async () => {
				if (!this.sid) {
					await this.login();
				}

				try {
					const downloadUrl = `${this.creds.baseUrl}/webapi/entry.cgi`;
					const params = {
						api: 'SYNO.FileStation.Download',
						version: 2,
						method: 'download',
						path: filePath,
						mode: 'download',
						_sid: this.sid as string,
					};

					const response = await this.client.get(downloadUrl, {
						params,
						responseType: 'arraybuffer',
						validateStatus: () => true,
					});

					if (!response.data) {
						throw new Error('No data received from download');
					}

					return Buffer.from(response.data);
				} catch (error) {
					if (error instanceof Error && error.message.includes('401')) {
						// Session expired, retry with new login
						await this.login();
						return this.downloadFile(filePath);
					}
					throw error;
				}
			});
		});
	}
}
