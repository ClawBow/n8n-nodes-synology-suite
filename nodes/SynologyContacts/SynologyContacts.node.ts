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
					// Addressbooks
					{ name: 'List Addressbooks', value: 'listAddressbooks' },
					{ name: 'Get Addressbook', value: 'getAddressbook' },
					{ name: 'Create Addressbook', value: 'createAddressbook' },
					{ name: 'Update Addressbook', value: 'updateAddressbook' },
					{ name: 'Delete Addressbook', value: 'deleteAddressbook' },
					
					// Contacts
					{ name: 'List Contacts', value: 'listContacts' },
					{ name: 'Get Contact', value: 'getContact' },
					{ name: 'Create Contact', value: 'createContact' },
					{ name: 'Update Contact', value: 'updateContact' },
					{ name: 'Delete Contact', value: 'deleteContact' },
					
					// Labels/Groups
					{ name: 'List Labels', value: 'listLabels' },
					{ name: 'Create Label', value: 'createLabel' },
					{ name: 'Update Label', value: 'updateLabel' },
					{ name: 'Delete Label', value: 'deleteLabel' },
					
					// Search
					{ name: 'Search Contacts', value: 'searchContacts' },
					
					// Settings
					{ name: 'Get Info', value: 'getInfo' },
					{ name: 'Get Settings', value: 'getSettings' },
					
					// Utility
					{ name: 'List Contacts APIs', value: 'listApis' },
				],
				default: 'listAddressbooks',
			},

			// Common params
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

			// Addressbooks
			if (operation === 'listAddressbooks') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Contacts.Addressbook', 'list', { limit, offset });
			}

			if (operation === 'getAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				return dsm.callAuto('SYNO.Contacts.Addressbook', 'get', { addressbook_id: addressbookId });
			}

			if (operation === 'createAddressbook') {
				const addressbookName = this.getNodeParameter('addressbookName', i) as string;
				return dsm.callAuto('SYNO.Contacts.Addressbook', 'create', { name: addressbookName });
			}

			if (operation === 'updateAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const addressbookName = this.getNodeParameter('addressbookName', i) as string;
				return dsm.callAuto('SYNO.Contacts.Addressbook', 'update', { addressbook_id: addressbookId, name: addressbookName });
			}

			if (operation === 'deleteAddressbook') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				return dsm.callAuto('SYNO.Contacts.Addressbook', 'delete', { addressbook_id: addressbookId });
			}

			// Contacts
			if (operation === 'listContacts') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Contacts.Contact', 'list', { addressbook_id: addressbookId, limit, offset });
			}

			if (operation === 'getContact') {
				const contactId = this.getNodeParameter('contactId', i) as string;
				return dsm.callAuto('SYNO.Contacts.Contact', 'get', { contact_id: contactId });
			}

			if (operation === 'createContact') {
				const addressbookId = this.getNodeParameter('addressbookId', i) as string;
				const firstName = this.getNodeParameter('contactFirstName', i) as string;
				const lastName = this.getNodeParameter('contactLastName', i) as string;
				const email = this.getNodeParameter('contactEmail', i) as string;
				const phone = this.getNodeParameter('contactPhone', i) as string;
				const org = this.getNodeParameter('contactOrg', i) as string;
				return dsm.callAuto('SYNO.Contacts.Contact', 'create', { 
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
				return dsm.callAuto('SYNO.Contacts.Contact', 'update', { 
					contact_id: contactId,
					first_name: firstName,
					last_name: lastName || undefined,
					email: email || undefined,
					phone: phone || undefined,
					organization: org || undefined,
				});
			}

			if (operation === 'deleteContact') {
				const contactId = this.getNodeParameter('contactId', i) as string;
				return dsm.callAuto('SYNO.Contacts.Contact', 'delete', { contact_id: contactId });
			}

			// Labels
			if (operation === 'listLabels') {
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.Contacts.Label', 'list', { limit });
			}

			if (operation === 'createLabel') {
				const labelName = this.getNodeParameter('labelName', i) as string;
				return dsm.callAuto('SYNO.Contacts.Label', 'create', { name: labelName });
			}

			if (operation === 'updateLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				const labelName = this.getNodeParameter('labelName', i) as string;
				return dsm.callAuto('SYNO.Contacts.Label', 'update', { label_id: labelId, name: labelName });
			}

			if (operation === 'deleteLabel') {
				const labelId = this.getNodeParameter('labelId', i) as string;
				return dsm.callAuto('SYNO.Contacts.Label', 'delete', { label_id: labelId });
			}

			// Search
			if (operation === 'searchContacts') {
				const keyword = this.getNodeParameter('searchKeyword', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.Contacts.Contact', 'search', { keyword, limit });
			}

			// Info
			if (operation === 'getInfo') {
				return dsm.callAuto('SYNO.Contacts.Info', 'get', {});
			}

			if (operation === 'getSettings') {
				return dsm.callAuto('SYNO.Contacts.AdminSetting', 'get', {});
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
