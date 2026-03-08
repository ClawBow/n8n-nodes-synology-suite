import type {
	IDataObject,
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { DsmClient, normalizeCredentials } from '../shared/DsmClient';
import { executePerItem } from '../shared/NodeExecution';

export class SynologyNote implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Note',
		name: 'synologyNote',
		icon: 'file:synology-note-logo.png',
		group: ['transform'],
		version: 1,
		description: 'Create, read, and manage Synology Note notebooks, notes, and to-do lists',
		defaults: { name: 'Synology Note' },
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
					// Notebooks
					{ name: 'List Notebooks', value: 'listNotebooks' },
					{ name: 'Create Notebook', value: 'createNotebook' },
					{ name: 'Get Notebook', value: 'getNotebook' },
					{ name: 'Update Notebook', value: 'updateNotebook' },
					{ name: 'Delete Notebook', value: 'deleteNotebook' },
					
					// Notes
					{ name: 'List Notes', value: 'listNotes' },
					{ name: 'Create Note', value: 'createNote' },
					{ name: 'Get Note', value: 'getNote' },
					{ name: 'Update Note', value: 'updateNote' },
					{ name: 'Delete Note', value: 'deleteNote' },
					
					// Tags
					{ name: 'List Tags', value: 'listTags' },
					{ name: 'Create Tag', value: 'createTag' },
					{ name: 'Update Tag', value: 'updateTag' },
					{ name: 'Delete Tag', value: 'deleteTag' },
					
					// Shortcuts
					{ name: 'List Shortcuts', value: 'listShortcuts' },
					{ name: 'Create Shortcut', value: 'createShortcut' },
					{ name: 'Delete Shortcut', value: 'deleteShortcut' },
					
					// To-Do Items
					{ name: 'List Todos', value: 'listTodos' },
					{ name: 'Create Todo', value: 'createTodo' },
					{ name: 'Update Todo', value: 'updateTodo' },
					{ name: 'Delete Todo', value: 'deleteTodo' },
					
					// Search & Sharing
					{ name: 'Search Notes', value: 'searchNotes' },
					{ name: 'List Sharing', value: 'listSharing' },
					{ name: 'Add Sharing', value: 'addSharing' },
					{ name: 'Remove Sharing', value: 'removeSharing' },
					
					// Export / Import
					{ name: 'Export Note', value: 'exportNote' },
					{ name: 'Export Notebook', value: 'exportNotebook' },
					{ name: 'Import Notebook', value: 'importNotebook' },
					
					// Trash
					{ name: 'List Trash', value: 'listTrash' },
					{ name: 'Restore from Trash', value: 'restoreTrash' },
					{ name: 'Empty Trash', value: 'emptyTrash' },
					
					// Info & Settings
					{ name: 'Get Info', value: 'getInfo' },
					{ name: 'List Note APIs', value: 'listApis' },
				],
				default: 'listNotebooks',
			},

			// Common params
			{ displayName: 'Notebook ID', name: 'notebookId', type: 'string', default: '', displayOptions: { show: { operation: ['getNotebook', 'updateNotebook', 'deleteNotebook', 'listNotes', 'createNote', 'searchNotes'] } } },
			{ displayName: 'Notebook Name', name: 'notebookName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createNotebook', 'updateNotebook'] } } },
			{ displayName: 'Note ID', name: 'noteId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['getNote', 'updateNote', 'deleteNote', 'exportNote'] } } },
			{ displayName: 'Note Title', name: 'noteTitle', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createNote', 'updateNote'] } } },
			{ displayName: 'Note Content', name: 'noteContent', type: 'string', typeOptions: { rows: 5 }, default: '', displayOptions: { show: { operation: ['createNote', 'updateNote'] } } },
			{ displayName: 'Tag Name', name: 'tagName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createTag', 'updateTag'] } } },
			{ displayName: 'Tag ID', name: 'tagId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['updateTag', 'deleteTag'] } } },
			{ displayName: 'Shortcut Name', name: 'shortcutName', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createShortcut'] } } },
			{ displayName: 'Shortcut Target', name: 'shortcutTarget', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createShortcut'] } } },
			{ displayName: 'Todo Title', name: 'todoTitle', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['createTodo', 'updateTodo'] } } },
			{ displayName: 'Todo ID', name: 'todoId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['updateTodo', 'deleteTodo'] } } },
			{ displayName: 'Todo Completed', name: 'todoCompleted', type: 'boolean', default: false, displayOptions: { show: { operation: ['createTodo', 'updateTodo'] } } },
			{ displayName: 'Search Keyword', name: 'searchKeyword', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['searchNotes'] } } },
			{ displayName: 'Shared User', name: 'sharedUser', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['addSharing', 'removeSharing'] } } },
			{ displayName: 'Export Format', name: 'exportFormat', type: 'options', options: [
				{ name: 'HTML', value: 'html' },
				{ name: 'PDF', value: 'pdf' },
				{ name: 'Word', value: 'word' },
				{ name: 'Markdown', value: 'markdown' },
			], default: 'html', displayOptions: { show: { operation: ['exportNote', 'exportNotebook'] } } },
			{ displayName: 'Item ID (Trash)', name: 'trashItemId', type: 'string', default: '', required: true, displayOptions: { show: { operation: ['restoreTrash'] } } },
			{ displayName: 'Limit', name: 'limit', type: 'number', default: 50, displayOptions: { show: { operation: ['listNotebooks', 'listNotes', 'listTags', 'listTodos', 'listTrash'] } } },
			{ displayName: 'Offset', name: 'offset', type: 'number', default: 0, displayOptions: { show: { operation: ['listNotebooks', 'listNotes', 'listTags', 'listTodos', 'listTrash'] } } },
		],
	};

	async execute(this: IExecuteFunctions) {
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const dsm = new DsmClient(creds);

		return executePerItem(this, async (i) => {
			const operation = this.getNodeParameter('operation', i) as string;

			if (operation === 'listApis') {
				return dsm.queryApis('SYNO.NoteStation.*');
			}

			// Notebooks
			if (operation === 'listNotebooks') {
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.NoteStation.Notebook', 'list', { limit, offset });
			}

			if (operation === 'createNotebook') {
				const notebookName = this.getNodeParameter('notebookName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Notebook', 'create', { name: notebookName });
			}

			if (operation === 'getNotebook') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Notebook', 'get', { notebook_id: notebookId });
			}

			if (operation === 'updateNotebook') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				const notebookName = this.getNodeParameter('notebookName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Notebook', 'update', { notebook_id: notebookId, name: notebookName });
			}

			if (operation === 'deleteNotebook') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Notebook', 'delete', { notebook_id: notebookId });
			}

			// Notes
			if (operation === 'listNotes') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				const limit = this.getNodeParameter('limit', i) as number;
				const offset = this.getNodeParameter('offset', i) as number;
				return dsm.callAuto('SYNO.NoteStation.Note', 'list', { notebook_id: notebookId, limit, offset });
			}

			if (operation === 'createNote') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				const noteTitle = this.getNodeParameter('noteTitle', i) as string;
				const noteContent = this.getNodeParameter('noteContent', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Note', 'create', { notebook_id: notebookId, title: noteTitle, content: noteContent });
			}

			if (operation === 'getNote') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Note', 'get', { note_id: noteId });
			}

			if (operation === 'updateNote') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				const noteTitle = this.getNodeParameter('noteTitle', i) as string;
				const noteContent = this.getNodeParameter('noteContent', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Note', 'update', { note_id: noteId, title: noteTitle, content: noteContent });
			}

			if (operation === 'deleteNote') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Note', 'delete', { note_id: noteId });
			}

			// Tags
			if (operation === 'listTags') {
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.NoteStation.Tag', 'list', { limit });
			}

			if (operation === 'createTag') {
				const tagName = this.getNodeParameter('tagName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Tag', 'create', { name: tagName });
			}

			if (operation === 'updateTag') {
				const tagId = this.getNodeParameter('tagId', i) as string;
				const tagName = this.getNodeParameter('tagName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Tag', 'update', { tag_id: tagId, name: tagName });
			}

			if (operation === 'deleteTag') {
				const tagId = this.getNodeParameter('tagId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Tag', 'delete', { tag_id: tagId });
			}

			// Shortcuts
			if (operation === 'listShortcuts') {
				return dsm.callAuto('SYNO.NoteStation.Shortcut', 'list', {});
			}

			if (operation === 'createShortcut') {
				const shortcutName = this.getNodeParameter('shortcutName', i) as string;
				const shortcutTarget = this.getNodeParameter('shortcutTarget', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Shortcut', 'create', { name: shortcutName, target: shortcutTarget });
			}

			if (operation === 'deleteShortcut') {
				const shortcutName = this.getNodeParameter('shortcutName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Shortcut', 'delete', { name: shortcutName });
			}

			// Todos
			if (operation === 'listTodos') {
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.NoteStation.Todo', 'list', { limit });
			}

			if (operation === 'createTodo') {
				const todoTitle = this.getNodeParameter('todoTitle', i) as string;
				const todoCompleted = this.getNodeParameter('todoCompleted', i) as boolean;
				return dsm.callAuto('SYNO.NoteStation.Todo', 'create', { title: todoTitle, completed: todoCompleted });
			}

			if (operation === 'updateTodo') {
				const todoId = this.getNodeParameter('todoId', i) as string;
				const todoTitle = this.getNodeParameter('todoTitle', i) as string;
				const todoCompleted = this.getNodeParameter('todoCompleted', i) as boolean;
				return dsm.callAuto('SYNO.NoteStation.Todo', 'update', { todo_id: todoId, title: todoTitle, completed: todoCompleted });
			}

			if (operation === 'deleteTodo') {
				const todoId = this.getNodeParameter('todoId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Todo', 'delete', { todo_id: todoId });
			}

			// Search
			if (operation === 'searchNotes') {
				const searchKeyword = this.getNodeParameter('searchKeyword', i) as string;
				return dsm.callAuto('SYNO.NoteStation.FTS', 'search', { keyword: searchKeyword });
			}

			// Sharing
			if (operation === 'listSharing') {
				return dsm.callAuto('SYNO.NoteStation.Sharing', 'list', {});
			}

			if (operation === 'addSharing') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				const sharedUser = this.getNodeParameter('sharedUser', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Sharing', 'create', { note_id: noteId, user: sharedUser });
			}

			if (operation === 'removeSharing') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				const sharedUser = this.getNodeParameter('sharedUser', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Sharing', 'delete', { note_id: noteId, user: sharedUser });
			}

			// Export
			if (operation === 'exportNote') {
				const noteId = this.getNodeParameter('noteId', i) as string;
				const exportFormat = this.getNodeParameter('exportFormat', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Export.Note', 'export', { note_id: noteId, format: exportFormat });
			}

			if (operation === 'exportNotebook') {
				const notebookId = this.getNodeParameter('notebookId', i) as string;
				const exportFormat = this.getNodeParameter('exportFormat', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Export.Notebook', 'export', { notebook_id: notebookId, format: exportFormat });
			}

			if (operation === 'importNotebook') {
				const notebookName = this.getNodeParameter('notebookName', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Import.Notebook', 'import', { name: notebookName });
			}

			// Trash
			if (operation === 'listTrash') {
				const limit = this.getNodeParameter('limit', i) as number;
				return dsm.callAuto('SYNO.NoteStation.Trash', 'list', { limit });
			}

			if (operation === 'restoreTrash') {
				const trashItemId = this.getNodeParameter('trashItemId', i) as string;
				return dsm.callAuto('SYNO.NoteStation.Trash', 'restore', { item_id: trashItemId });
			}

			if (operation === 'emptyTrash') {
				return dsm.callAuto('SYNO.NoteStation.Trash', 'empty', {});
			}

			// Info
			if (operation === 'getInfo') {
				return dsm.callAuto('SYNO.NoteStation.Info', 'get', {});
			}

			throw new Error(`Unknown operation: ${operation}`);
		});
	}
}
