import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyPhotos implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Photos',
		name: 'synologyPhotos',
		icon: 'file:synology-photos-logo.png',
		group: ['transform'],
		version: 1,
		description: 'Browse, manage, and organize Synology Photos (albums, items, sharing)',
		defaults: { name: 'Synology Photos' },
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
					// Browse
					{ name: 'Get User Info', value: 'getUserInfo' },
					{ name: 'List Folders', value: 'listFolders' },
					{ name: 'List Albums', value: 'listAlbums' },
					{ name: 'Get Album', value: 'getAlbum' },
					{ name: 'List Items in Album', value: 'listItems' },
					{ name: 'List Recent Items', value: 'listRecent' },
					{ name: 'List Timeline', value: 'listTimeline' },
					
					// Search & Filter
					{ name: 'Search Photos', value: 'searchPhotos' },
					{ name: 'Get Search Filters', value: 'getSearchFilters' },
					
					// Album Management
					{ name: 'Create Album', value: 'createAlbum' },
					{ name: 'Update Album', value: 'updateAlbum' },
					{ name: 'Delete Album', value: 'deleteAlbum' },
					
					// Items
					{ name: 'Get Item Details', value: 'getItem' },
					{ name: 'Update Item', value: 'updateItem' },
					{ name: 'Delete Item', value: 'deleteItem' },
					
					// Favorites & Starring
					{ name: 'Add to Favorite', value: 'addFavorite' },
					{ name: 'Remove from Favorite', value: 'removeFavorite' },
					
					// Sharing
					{ name: 'List Sharing', value: 'listSharing' },
					{ name: 'Create Sharing Link', value: 'createSharing' },
					{ name: 'Update Sharing', value: 'updateSharing' },
					{ name: 'Delete Sharing', value: 'deleteSharing' },
					
					// Thumbnails & Download
					{ name: 'Get Thumbnail', value: 'getThumbnail' },
					{ name: 'Download Item', value: 'downloadItem' },
					
					// Settings
					{ name: 'Get Settings', value: 'getSettings' },
					{ name: 'Update Settings', value: 'updateSettings' },
					
					// Utility
					{ name: 'Get User Quota', value: 'getUserQuota' },
					{ name: 'List Photos APIs', value: 'listApis' },
				],
				default: 'getUserInfo',
			},

			// Common params
			{ displayName: 'Folder ID', name: 'folderId', type: 'string', default: '', displayOptions: { show: { operation: ['listItems'] } } },
			{ displayName: 'Album ID', name: 'albumId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getAlbum', 'updateAlbum', 'deleteAlbum', 'createSharing'] } } },
			{ displayName: 'Album Name', name: 'albumName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createAlbum', 'updateAlbum'] } } },
			{ displayName: 'Item ID', name: 'itemId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getItem', 'updateItem', 'deleteItem', 'addFavorite', 'removeFavorite', 'downloadItem', 'getThumbnail'] } } },
			{ displayName: 'Search Keyword', name: 'searchKeyword', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['searchPhotos'] } } },
			{ displayName: 'Share Link Name', name: 'shareLinkName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createSharing', 'updateSharing'] } } },
			{ displayName: 'Share Password', name: 'sharePassword', type: 'string', typeOptions: { password: true }, default: '', displayOptions: { show: { operation: ['createSharing', 'updateSharing'] } } },
			{ displayName: 'Share Permission', name: 'sharePermission', type: 'options', options: [
				{ name: 'View', value: 'view' },
				{ name: 'Download', value: 'download' },
				{ name: 'Upload', value: 'upload' },
			], default: 'view', displayOptions: { show: { operation: ['createSharing', 'updateSharing'] } } },
			{ displayName: 'Thumbnail Size', name: 'thumbnailSize', type: 'options', options: [
				{ name: 'Small (96px)', value: 'sm' },
				{ name: 'Medium (256px)', value: 'md' },
				{ name: 'Large (512px)', value: 'lg' },
			], default: 'md', displayOptions: { show: { operation: ['getThumbnail'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listFolders', 'listAlbums', 'listItems', 'listRecent', 'listTimeline', 'searchPhotos'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listFolders', 'listAlbums', 'listItems', 'listRecent', 'listTimeline', 'searchPhotos'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listApis') {
				return dsm.queryApis('SYNO.Foto.*');
			}

			// User Info
			if (operation === 'getUserInfo') {
				return dsm.callAuto('SYNO.Foto.UserInfo', 'get', {});
			}

			// Browse
			if (operation === 'listFolders') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Foto.Browse.Folder', 'list', { limit, offset });
			}

			if (operation === 'listAlbums') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Foto.Browse.Album', 'list', { limit, offset });
			}

			if (operation === 'getAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Album', 'get', { album_id: albumId });
			}

			if (operation === 'listItems') {
				const folderId = this.getNodeParameter('folderId', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Foto.Browse.Item', 'list', { folder_id: folderId, limit, offset });
			}

			if (operation === 'listRecent') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.Foto.Browse.RecentlyAdded', 'list', { limit, offset });
			}

			if (operation === 'listTimeline') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAny(
					['SYNO.Foto.Browse.Timeline'],
					['get', 'list'],
					{ limit, offset },
				);
			}

			// Search
			if (operation === 'searchPhotos') {
				const keyword = this.getNodeParameter('searchKeyword', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.Foto.Search.Search', 'list', { keyword, limit });
			}

			if (operation === 'getSearchFilters') {
				return dsm.callAuto('SYNO.Foto.Search.Filter', 'list', {});
			}

			// Album Management
			if (operation === 'createAlbum') {
				const albumName = this.getNodeParameter('albumName', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Album', 'create', { name: albumName });
			}

			if (operation === 'updateAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				const albumName = this.getNodeParameter('albumName', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Album', 'update', { album_id: albumId, name: albumName });
			}

			if (operation === 'deleteAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Album', 'delete', { album_id: albumId });
			}

			// Items
			if (operation === 'getItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Item', 'get', { item_id: itemId });
			}

			if (operation === 'updateItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Item', 'update', { item_id: itemId });
			}

			if (operation === 'deleteItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Browse.Item', 'delete', { item_id: itemId });
			}

			// Favorites
			if (operation === 'addFavorite') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Favorite', 'add', { item_id: itemId });
			}

			if (operation === 'removeFavorite') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Favorite', 'remove', { item_id: itemId });
			}

			// Sharing
			if (operation === 'listSharing') {
				return dsm.callAuto('SYNO.Foto.Sharing.Misc', 'list', {});
			}

			if (operation === 'createSharing') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				const password = this.getNodeParameter('sharePassword', i) as string;
				const permission = this.getNodeParameter('sharePermission', i) as string;
				return dsm.callAuto('SYNO.Foto.Sharing.Misc', 'create', { 
					album_id: albumId, 
					name: linkName, 
					password: password || undefined,
					permission 
				});
			}

			if (operation === 'updateSharing') {
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				const password = this.getNodeParameter('sharePassword', i) as string;
				return dsm.callAuto('SYNO.Foto.Sharing.Misc', 'update', { name: linkName, password: password || undefined });
			}

			if (operation === 'deleteSharing') {
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				return dsm.callAuto('SYNO.Foto.Sharing.Misc', 'delete', { name: linkName });
			}

			// Thumbnails & Download
			if (operation === 'getThumbnail') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				const size = this.getNodeParameter('thumbnailSize', i) as string;
				return dsm.callAuto('SYNO.Foto.Thumbnail', 'get', { item_id: itemId, size });
			}

			if (operation === 'downloadItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAuto('SYNO.Foto.Download', 'get', { item_id: itemId });
			}

			// Settings
			if (operation === 'getSettings') {
				return dsm.callAuto('SYNO.Foto.Setting.User', 'get', {});
			}

			if (operation === 'updateSettings') {
				return dsm.callAuto('SYNO.Foto.Setting.User', 'update', {});
			}

			// Quota
			if (operation === 'getUserQuota') {
				return dsm.callAuto('SYNO.Foto.UserInfo', 'get', {});
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
