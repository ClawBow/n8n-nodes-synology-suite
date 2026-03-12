import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyContacts implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Contacts',
		name: 'synologyContacts',
		icon: 'file:synology-contacts-logo.png',
		group: ['transform'],
		version: 1,
		description: 'Manage Synology Contacts (addressbooks, contacts, labels)',
		defaults: { name: 'Synology Contacts' },
		inputs: ['main'],
		outputs: ['main'],
		credentials: [{ name: 'synologyDsmApi', required: true }],
		usableAsTool: true,
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				options: [
					{ name: 'List Addressbooks', value: 'listAddressbooks' },
					{ name: 'Get Addressbook', value: 'getAddressbook' },
					{ name: 'Create Addressbook', value: 'createAddressbook' },
					{ name: 'Update Addressbook', value: 'updateAddressbook' },
					{ name: 'Delete Addressbook', value: 'deleteAddressbook' },
					{ name: 'List Contacts', value: 'listContacts' },
					{ name: 'Get Contact', value: 'getContact' },
					{ name: 'Create Contact', value: 'createContact' },
					{ name: 'Update Contact', value: 'updateContact' },
					{ name: 'Delete Contact', value: 'deleteContact' },
					{ name: 'List Labels', value: 'listLabels' },
					{ name: 'Create Label', value: 'createLabel' },
					{ name: 'Update Label', value: 'updateLabel' },
					{ name: 'Delete Label', value: 'deleteLabel' },
					{ name: 'Search Contacts', value: 'searchContacts' },
					{ name: 'Get Info', value: 'getInfo' },
					{ name: 'Get Settings', value: 'getSettings' },
					{ name: 'List Contacts APIs', value: 'listApis' },
				],
				default: 'listAddressbooks',
			},
			{ displayName: 'Addressbook ID', name: 'addressbookId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getAddressbook', 'updateAddressbook', 'deleteAddressbook', 'listContacts', 'createContact'] } } },
			{ displayName: 'Addressbook Name', name: 'addressbookName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createAddressbook', 'updateAddressbook'] } } },
			{ displayName: 'Contact ID', name: 'contactId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getContact', 'updateContact', 'deleteContact'] } } },
			{ displayName: 'Contact First Name', name: 'contactFirstName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createContact', 'updateContact'] } } },
			{ displayName: 'Contact Last Name', name: 'contactLastName', type: 'string', default: '', displayOptions: { show: { operation: ['createContact', 'updateContact'] } } },
			{ displayName: 'Contact Email', name: 'contactEmail', type: 'string', default: '', displayOptions: { show: { operation: ['createContact', 'updateContact'] } } },
			{ displayName: 'Contact Phone', name: 'contactPhone', type: 'string', default: '', displayOptions: { show: { operation: ['createContact', 'updateContact'] } } },
			{ displayName: 'Contact Organization', name: 'contactOrg', type: 'string', default: '', displayOptions: { show: { operation: ['createContact', 'updateContact'] } } },
			{ displayName: 'Label Name', name: 'labelName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createLabel', 'updateLabel'] } } },
			{ displayName: 'Label ID', name: 'labelId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['updateLabel', 'deleteLabel'] } } },
			{ displayName: 'Search Keyword', name: 'searchKeyword', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['searchContacts'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listAddressbooks', 'listContacts', 'listLabels', 'searchContacts'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listAddressbooks', 'listContacts', 'listLabels', 'searchContacts'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const addressbookApis = ['SYNO.Contacts.Addressbook', 'SYNO.AddressBook.AddressBook'];
			const contactApis = ['SYNO.Contacts.Contact', 'SYNO.AddressBook.Contact'];
			const labelApis = ['SYNO.Contacts.Label', 'SYNO.AddressBook.Label', 'SYNO.AddressBook.Group'];

			if (operation === 'listApis') {
				const all = await dsm.getApiInfoMap();
				const entries = Object.entries(all)
					.filter(([name]) =>
						name.startsWith('SYNO.Contacts.') ||
						name.startsWith('SYNO.AddressBook.') ||
						name.startsWith('SYNO.Cal.Contact')
					)
					.sort(([a], [b]) => a.localeCompare(b));

				const data = Object.fromEntries(entries);
				return {
					success: true,
					count: entries.length,
					apis: entries.map(([name]) => name),
					data,
				};
			}

			if (operation === 'listAddressbooks') {
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(addressbookApis, ['list', 'get'], { limit, offset });
			}

			if (operation === 'getAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				return dsm.callAny(addressbookApis, ['get', 'list'], { addressbook_id: addressbookId, id: addressbookId });
			}

			if (operation === 'createAddressbook') {
				const addressbookName = this.getNodeParameter('addressbookName', i) as string;
				return dsm.callAny(addressbookApis, ['create', 'add'], { name: addressbookName });
			}

			if (operation === 'updateAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const addressbookName = this.getNodeParameter('addressbookName', i) as string;
				return dsm.callAny(addressbookApis, ['update', 'set'], { addressbook_id: addressbookId, id: addressbookId, name: addressbookName });
			}

			if (operation === 'deleteAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				return dsm.callAny(addressbookApis, ['delete', 'remove'], { addressbook_id: addressbookId, id: addressbookId });
			}

			if (operation === 'listContacts') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(contactApis, ['list', 'get'], { addressbook_id: addressbookId, limit, offset });
			}

			if (operation === 'getContact') {
				const contactId = this.getNodeParameter('contactId', i) as string;
				return dsm.callAny(contactApis, ['get', 'list'], { contact_id: contactId, id: contactId });
			}

			if (operation === 'createContact') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const firstName = this.getNodeParameter('contactFirstName', i) as string;
				const lastName = this.getNodeParameter('contactLastName', i) as string;
				const email = this.getNodeParameter('contactEmail', i) as string;
				const phone = this.getNodeParameter('contactPhone', i) as string;
				const org = this.getNodeParameter('contactOrg', i) as string;
				return dsm.callAny(contactApis, ['create', 'add'], {
					addressbook_id: addressbookId,
					first_name: firstName,
					last_name: lastName || undefined,
					email: email || undefined,
					phone: phone || undefined,
					organization: org || undefined,
				});
			}

			if (operation === 'updateContact') {
				const contactId = this.getNodeParameter('contactId', i) as string;
				const firstName = this.getNodeParameter('contactFirstName', i) as string;
				const lastName = this.getNodeParameter('contactLastName', i) as string;
				const email = this.getNodeParameter('contactEmail', i) as string;
				const phone = this.getNodeParameter('contactPhone', i) as string;
				const org = this.getNodeParameter('contactOrg', i) as string;
				return dsm.callAny(contactApis, ['update', 'set'], {
					contact_id: contactId,
					id: contactId,
					first_name: firstName,
					last_name: lastName || undefined,
					email: email || undefined,
					phone: phone || undefined,
					organization: org || undefined,
				});
			}

			if (operation === 'deleteContact') {
				const contactId = this.getNodeParameter('contactId', i) as string;
				return dsm.callAny(contactApis, ['delete', 'remove'], { contact_id: contactId, id: contactId });
			}

			if (operation === 'listLabels') {
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(labelApis, ['list', 'get'], { limit, offset });
			}

			if (operation === 'createLabel') {
				const labelName = this.getNodeParameter('labelName', i) as string;
				return dsm.callAny(labelApis, ['create', 'add'], { name: labelName });
			}

			if (operation === 'updateLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				const labelName = this.getNodeParameter('labelName', i) as string;
				return dsm.callAny(labelApis, ['update', 'set'], { label_id: labelId, id: labelId, name: labelName });
			}

			if (operation === 'deleteLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				return dsm.callAny(labelApis, ['delete', 'remove'], { label_id: labelId, id: labelId });
			}

			if (operation === 'searchContacts') {
				const keyword = this.getNodeParameter('searchKeyword', i) as string;
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(contactApis, ['search', 'query', 'list'], { keyword, q: keyword, limit, offset });
			}

			if (operation === 'getInfo') {
				return dsm.callAny(['SYNO.Contacts.Info', 'SYNO.AddressBook.Info'], ['get', 'list'], {});
			}

			if (operation === 'getSettings') {
				return dsm.callAny(['SYNO.Contacts.AdminSetting', 'SYNO.AddressBook.Settings'], ['get', 'list'], {});
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
