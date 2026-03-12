import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { DsmApiError } from '../shared/DsmError';
import { executePerItem } from '../shared/NodeExecution';

function rethrowWithDsmGuidance(error: unknown, apiHint: string, methodHint: string): never {
	if (!(error instanceof DsmApiError)) {
		throw error;
	}

	const code = Number(error.details?.code ?? -1);
	const base = `DSM call failed (${apiHint}.${methodHint})`;

	if (code === 407) {
		throw new Error(`${base} [code=407] Authentication flow not completed (DSM policy / 2FA / app permission).`);
	}

	if (code === 401) {
		throw new Error(`${base} [code=401] Unauthorized: verify account permissions for Storage Manager APIs.`);
	}

	if ([102, 103, 104, 105, 106, 107, 119].includes(code)) {
		throw new Error(`${base} [code=${code}] ${String(error.details?.mappedMessage || 'DSM error')}`);
	}

	throw error;
}

export class SynologyStorageManager implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Storage Manager',
		name: 'synologyStorageManager',
		icon: 'file:synology-storage-manager.png',
		group: ['transform'],
		version: 1,
		description: 'Read-only Synology Storage Manager operations for DSM',
		defaults: { name: 'Synology Storage Manager' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				default: 'listVolumes',
				options: [
					{ name: 'List Storage APIs', value: 'listStorageApis' },
					{ name: 'List Volumes', value: 'listVolumes' },
					{ name: 'List Storage Pools', value: 'listStoragePools' },
					{ name: 'List Disks', value: 'listDisks' },
					{ name: 'Get Disk Health', value: 'getDiskHealth' },
					{ name: 'List RAIDs', value: 'listRaids' },
				],
			},
			{
				displayName: 'Disk ID',
				name: 'diskId',
				type: 'string',
				default: '',
				required: true,
				description: 'Disk identifier (for example disk1, sata1, nvme0n1 depending on DSM model)',
				displayOptions: { show: { operation: ['getDiskHealth'] } },
			},
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listStorageApis') {
				try {
					const queried = await dsm.queryApis('SYNO.Storage*,SYNO.Core.Storage*');
					if (queried?.success) return queried;
				} catch {
					// fallback below
				}

				const map = await dsm.getApiInfoMap();
				const entries = Object.entries(map)
					.filter(([name]) => name.startsWith('SYNO.Storage') || name.startsWith('SYNO.Core.Storage'))
					.map(([name, meta]) => ({ name, ...(meta || {}) }));

				return { success: true, data: { apis: entries, total: entries.length } } as IDataObject;
			}

			if (operation === 'listVolumes') {
				try {
					return await dsm.callAny(
						['SYNO.Storage.CGI.Volume', 'SYNO.Core.Storage.Volume', 'SYNO.Storage.Volume'],
						['list', 'get', 'getinfo'],
						{},
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.Storage.CGI.Volume', 'list');
				}
			}

			if (operation === 'listStoragePools') {
				try {
					return await dsm.callAny(
						['SYNO.Storage.CGI.StoragePool', 'SYNO.Core.Storage.StoragePool', 'SYNO.Storage.Pool'],
						['list', 'get', 'getinfo'],
						{},
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.Storage.CGI.StoragePool', 'list');
				}
			}

			if (operation === 'listDisks') {
				try {
					return await dsm.callAny(
						['SYNO.Storage.CGI.Disk', 'SYNO.Core.Storage.Disk', 'SYNO.Storage.Disk'],
						['list', 'get', 'getinfo'],
						{},
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.Storage.CGI.Disk', 'list');
				}
			}

			if (operation === 'getDiskHealth') {
				const diskId = this.getNodeParameter('diskId', i) as string;
				const params: IDataObject = {
					disk_id: diskId,
					disk: diskId,
					id: diskId,
				};

				try {
					return await dsm.callAny(
						['SYNO.Storage.CGI.Disk', 'SYNO.Core.Storage.Disk', 'SYNO.Storage.Disk'],
						['get_health', 'health', 'gethealth', 'get', 'getinfo'],
						params,
					);
				} catch (error) {
					rethrowWithDsmGuidance(error, 'SYNO.Storage.CGI.Disk', 'get_health');
				}
			}

			try {
				return await dsm.callAny(
					['SYNO.Storage.CGI.RAID', 'SYNO.Core.Storage.RAID', 'SYNO.Storage.Raid', 'SYNO.Storage.RAID'],
					['list', 'get', 'getinfo'],
					{},
				);
			} catch (error) {
				rethrowWithDsmGuidance(error, 'SYNO.Storage.CGI.RAID', 'list');
			}
		});
	}
}
