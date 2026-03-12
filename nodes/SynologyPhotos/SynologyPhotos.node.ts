import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { DsmApiError } from '../shared/DsmError';
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
			{ displayName: 'Share Password / Passphrase', name: 'sharePassword', type: 'string', typeOptions: { password: true }, default: '', displayOptions: { show: { operation: ['createSharing', 'updateSharing', 'listSharing'] } } },
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
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listFolders', 'listAlbums', 'listItems', 'listRecent', 'listTimeline', 'searchPhotos', 'listSharing', 'getUserInfo', 'getUserQuota'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listFolders', 'listAlbums', 'listItems', 'listRecent', 'listTimeline', 'searchPhotos', 'listSharing', 'getUserInfo', 'getUserQuota'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;
			const albumApis = ['SYNO.Foto.Browse.Album', 'SYNO.Foto.Album'];
			const itemApis = ['SYNO.Foto.Browse.Item', 'SYNO.Foto.Item'];
			const shareApis = ['SYNO.Foto.PublicSharing', 'SYNO.Foto.Sharing.Misc'];

			if (operation === 'listApis') {
				return dsm.queryApis('SYNO.Foto.*');
			}

			// User Info
			if (operation === 'getUserInfo') {
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(['SYNO.Foto.UserInfo'], ['get', 'list'], { id: '0', limit, offset });
			}

			// Browse
			if (operation === 'listFolders') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAny(['SYNO.Foto.Browse.Folder', 'SYNO.Foto.Folder'], ['list', 'get'], { limit, offset });
			}

			if (operation === 'listAlbums') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAny(albumApis, ['list', 'get'], { limit, offset });
			}

			if (operation === 'getAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				return dsm.callAny(albumApis, ['get', 'list'], { album_id: albumId, id: albumId });
			}

			if (operation === 'listItems') {
				const folderId = this.getNodeParameter('folderId', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAny(itemApis, ['list', 'get'], { folder_id: folderId, limit, offset });
			}

			if (operation === 'listRecent') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAny(['SYNO.Foto.Browse.RecentlyAdded', 'SYNO.Foto.Browse.Recent'], ['list', 'get'], { limit, offset });
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
				return dsm.callAny(['SYNO.Foto.Search.Search', 'SYNO.Foto.Search'], ['list', 'query', 'search'], { keyword, limit, offset: 0 });
			}

			if (operation === 'getSearchFilters') {
				return dsm.callAny(['SYNO.Foto.Search.Filter', 'SYNO.Foto.Search'], ['list', 'get_filter'], { limit: 100, offset: 0 });
			}

			// Album Management
			if (operation === 'createAlbum') {
				const albumName = this.getNodeParameter('albumName', i) as string;
				return dsm.callAny(albumApis, ['create', 'add'], { name: albumName });
			}

			if (operation === 'updateAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				const albumName = this.getNodeParameter('albumName', i) as string;
				return dsm.callAny(albumApis, ['update', 'set'], { album_id: albumId, id: albumId, name: albumName });
			}

			if (operation === 'deleteAlbum') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				return dsm.callAny(albumApis, ['delete', 'remove'], { album_id: albumId, id: albumId });
			}

			// Items
			if (operation === 'getItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(itemApis, ['get', 'list'], { item_id: itemId, id: itemId });
			}

			if (operation === 'updateItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(itemApis, ['update', 'set'], { item_id: itemId, id: itemId });
			}

			if (operation === 'deleteItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(itemApis, ['delete', 'remove'], { item_id: itemId, id: itemId });
			}

			// Favorites
			if (operation === 'addFavorite') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(['SYNO.Foto.Favorite'], ['add', 'create'], { item_id: itemId });
			}

			if (operation === 'removeFavorite') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(['SYNO.Foto.Favorite'], ['remove', 'delete'], { item_id: itemId });
			}

			// Sharing
			if (operation === 'listSharing') {
				const limit = this.getNodeParameter('limit', i, 50) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				const passphrase = this.getNodeParameter('sharePassword', i, '') as string;
				try {
					return await dsm.callAny(
						['SYNO.Foto.PublicSharing', 'SYNO.Foto.Sharing.Misc'],
						['get', 'list', 'query'],
						{ limit, offset, passphrase },
					);
				} catch (error) {
					if (error instanceof DsmApiError && Number(error.details?.code) === 120 && !passphrase) {
						return {
							success: false,
							warning: 'Synology Photos requires a passphrase for listing public sharing links on this DSM build. Set "Share Password / Passphrase" and retry.',
							error: error.details,
						};
					}
					throw error;
				}
			}

			if (operation === 'createSharing') {
				const albumId = this.getNodeParameter('albumId', i) as string;
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				const password = this.getNodeParameter('sharePassword', i) as string;
				const permission = this.getNodeParameter('sharePermission', i) as string;
				return dsm.callAny(shareApis, ['create', 'add'], { 
					album_id: albumId, 
					name: linkName, 
					password: password || undefined,
					permission 
				});
			}

			if (operation === 'updateSharing') {
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				const password = this.getNodeParameter('sharePassword', i) as string;
				return dsm.callAny(shareApis, ['update', 'set'], { name: linkName, password: password || undefined, passphrase: password || undefined });
			}

			if (operation === 'deleteSharing') {
				const linkName = this.getNodeParameter('shareLinkName', i) as string;
				return dsm.callAny(shareApis, ['delete', 'remove'], { name: linkName });
			}

			// Thumbnails & Download
			if (operation === 'getThumbnail') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				const size = this.getNodeParameter('thumbnailSize', i) as string;
				return dsm.callAny(['SYNO.Foto.Thumbnail'], ['get', 'list'], { item_id: itemId, size });
			}

			if (operation === 'downloadItem') {
				const itemId = this.getNodeParameter('itemId', i) as string;
				return dsm.callAny(['SYNO.Foto.Download'], ['get', 'download'], { item_id: itemId });
			}

			// Settings
			if (operation === 'getSettings') {
				return dsm.callAny(['SYNO.Foto.Setting.User', 'SYNO.Foto.Setting'], ['get', 'list'], {});
			}

			if (operation === 'updateSettings') {
				return dsm.callAny(['SYNO.Foto.Setting.User', 'SYNO.Foto.Setting'], ['update', 'set'], {});
			}

			// Quota
			if (operation === 'getUserQuota') {
				const limit = this.getNodeParameter('limit', i, 1) as number;
				const offset = this.getNodeParameter('offset', i, 0) as number;
				return dsm.callAny(['SYNO.Foto.UserInfo'], ['get', 'list'], { id: '0', limit, offset });
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
