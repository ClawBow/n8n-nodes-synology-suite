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

	private buildWebApiUrl(path = 'entry.cgi'): string {
		const cleanPath = String(path || 'entry.cgi').replace(/^\/+/, '');
		return `${this.creds.baseUrl}/webapi/${cleanPath}`;
	}

	private async resolveApiPath(api: string): Promise<string> {
		// Core APIs are always available via entry.cgi
		if (api === 'SYNO.API.Info' || api === 'SYNO.API.Auth') {
			return 'entry.cgi';
		}

		if (this.apiInfoCache?.[api]?.path) {
			return String(this.apiInfoCache[api].path);
		}

		try {
			const map = await this.getApiInfoMap();
			if (map?.[api]?.path) {
				return String(map[api].path);
			}
		} catch {
			// Fallback to entry.cgi when API map is unavailable
		}

		return 'entry.cgi';
	}

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

				// Retry policy for transient load/rate issues
				let shouldRetry = false;
				let code: number | undefined;
				let status: number | undefined;

				// Axios-style errors
				status = error?.response?.status;
				code = error?.response?.data?.error?.code;

				// DSM wrapped errors (DsmApiError)
				if (error instanceof DsmApiError) {
					const dsmCode = Number(error.details?.code);
					if (!Number.isNaN(dsmCode)) code = dsmCode;
				}

				// 402 = System is too busy (DSM), 408 timeout, 429 rate limit
				if (code === 402 || code === 408 || status === 402 || status === 408 || status === 429) {
					shouldRetry = true;
				}

				if (shouldRetry && attempt < maxRetries - 1) {
					const baseDelay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
					const jitter = Math.floor(Math.random() * 300);
					const delay = baseDelay + jitter;
					await new Promise(resolve => setTimeout(resolve, delay));
					continue;
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

				const uploadVersion = (() => {
					const v = this.apiInfoCache?.['SYNO.FileStation.Upload']?.maxVersion;
					return typeof v === 'number' && v >= 2 ? Math.min(v, 3) : 2;
				})();

				const doUpload = async (): Promise<IDataObject> => {
					// Build multipart body manually
					const boundary = `----OpenClawBoundary${Date.now().toString(16)}`;
					const lines: string[] = [];

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="api"');
					lines.push('');
					lines.push('SYNO.FileStation.Upload');

					lines.push(`--${boundary}`);
					lines.push('Content-Disposition: form-data; name="version"');
					lines.push('');
					lines.push(String(uploadVersion));

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
						params: { _sid: this.sid as string },
						headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
						validateStatus: () => true,
					});

					return (response.data || {}) as IDataObject;
				};

				let result = await doUpload();
				if (result.success !== true) {
					const code = Number((result.error as IDataObject | undefined)?.code);
					if ([105, 106, 107, 119].includes(code)) {
						await this.login();
						result = await doUpload();
					}
				}

				if (result.success === true) {
					return { success: true, fileName, path: destPath, data: result.data };
				}

				return { success: false, error: result.error || 'Upload failed', data: result };
			});
		});
	}

	async login(): Promise<void> {
		return this.executeWithRateLimit(async () => {
			const authPaths = ['entry.cgi', 'auth.cgi'];
			const authVersions = [7, 6, 3, 2];
			const failures: Array<{ path: string; version: number; data?: unknown }> = [];

			for (const path of authPaths) {
				for (const version of authVersions) {
					const { data } = await this.client.get(this.buildWebApiUrl(path), {
						params: {
							api: 'SYNO.API.Auth',
							version: String(version),
							method: 'login',
							account: this.creds.username,
							passwd: this.creds.password,
							session: this.creds.sessionName,
							format: 'sid',
						},
						validateStatus: () => true,
					});

					if (data?.success && data?.data?.sid) {
						this.sid = data.data.sid;
						return;
					}

					failures.push({ path, version, data });
				}
			}

			throw new Error(`DSM login failed on all auth variants: ${JSON.stringify(failures)}`);
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

				const apiPath = await this.resolveApiPath(api);
				const { data } = await this.client.get(this.buildWebApiUrl(apiPath), { params, validateStatus: () => true });

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
