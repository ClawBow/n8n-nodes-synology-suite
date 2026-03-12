import {
	IExecuteFunctions,
	IHttpRequestMethods,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
	NodeOperationError,
} from 'n8n-workflow';
import axios from 'axios';
import https from 'https';
import { normalizeCredentials } from '../shared/DsmClient';

export class SynologyCalendar implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Synology Calendar',
		name: 'synologyCalendar',
		icon: 'file:synology-calendar-logo.png',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter.operation}}',
		description: 'Interact with Synology Calendar API (Events, Tasks, Calendars)',
		defaults: {
			name: 'Synology Calendar',
		},
		inputs: ['main'],
		outputs: ['main'],
		credentials: [
			{
				name: 'synologyDsmApi',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Create Event', value: 'createEvent', action: 'Create an event' },
					{ name: 'Get Event', value: 'getEvent', action: 'Get an event' },
					{ name: 'List Events', value: 'listEvents', action: 'List events' },
					{ name: 'Update Event', value: 'updateEvent', action: 'Update an event' },
					{ name: 'Delete Event', value: 'deleteEvent', action: 'Delete an event' },
					{ name: 'Create Task', value: 'createTask', action: 'Create a task' },
					{ name: 'Get Task', value: 'getTask', action: 'Get a task' },
					{ name: 'List Tasks', value: 'listTasks', action: 'List tasks' },
					{ name: 'Update Task', value: 'updateTask', action: 'Update a task' },
					{ name: 'Delete Task', value: 'deleteTask', action: 'Delete a task' },
					{ name: 'Create Calendar', value: 'createCalendar', action: 'Create a calendar' },
					{ name: 'Get Calendar', value: 'getCalendar', action: 'Get a calendar' },
					{ name: 'Update Calendar', value: 'updateCalendar', action: 'Update a calendar' },
					{ name: 'Delete Calendar', value: 'deleteCalendar', action: 'Delete a calendar' },
					{ name: 'Update Settings', value: 'updateSettings', action: 'Update settings' },
					{ name: 'List Calendars', value: 'listCalendars', action: 'List calendars' },
					{ name: 'Get Settings', value: 'getSettings', action: 'Get settings' },
					{ name: 'List Timezones', value: 'listTimezones', action: 'List timezones' },
					{ name: 'List Contacts', value: 'listContacts', action: 'List contacts' },
					{ name: 'Custom Call', value: 'customCall', action: 'Make a custom call' },
				],
				default: 'listEvents',
			},

			// EVENTS
			{
				displayName: 'Calendar ID',
				name: 'calendarId',
				type: 'string',
				placeholder: '/admin/home/',
				required: true,
				displayOptions: { show: { operation: ['createEvent'] } },
				default: '',
				description: 'Target calendar ID',
			},
			{
				displayName: 'Event Title',
				name: 'summary',
				type: 'string',
				required: true,
				displayOptions: { show: { operation: ['createEvent', 'updateEvent'] } },
				default: '',
				description: 'Event title',
			},
			{
				displayName: 'Is All Day',
				name: 'isAllDay',
				type: 'boolean',
				displayOptions: { show: { operation: ['createEvent', 'updateEvent'] } },
				default: false,
				description: 'All-day event',
			},
			{
				displayName: 'Start Time (Unix)',
				name: 'dtstart',
				type: 'number',
				required: true,
				displayOptions: { show: { operation: ['createEvent', 'updateEvent'] } },
				default: 0,
				description: 'Start time (Unix timestamp)',
			},
			{
				displayName: 'End Time (Unix)',
				name: 'dtend',
				type: 'number',
				required: true,
				displayOptions: { show: { operation: ['createEvent', 'updateEvent'] } },
				default: 0,
				description: 'End time (Unix timestamp)',
			},
			{
				displayName: 'Event ID',
				name: 'eventId',
				type: 'number',
				required: true,
				displayOptions: { show: { operation: ['getEvent', 'updateEvent', 'deleteEvent'] } },
				default: 0,
				description: 'Event ID',
			},

			// TASKS
			{
				displayName: 'Task Title',
				name: 'taskTitle',
				type: 'string',
				required: true,
				displayOptions: { show: { operation: ['createTask', 'updateTask'] } },
				default: '',
				description: 'Task title',
			},
			{
				displayName: 'Task ID',
				name: 'taskId',
				type: 'number',
				required: true,
				displayOptions: { show: { operation: ['getTask', 'updateTask', 'deleteTask'] } },
				default: 0,
				description: 'Task ID',
			},

			// CALENDARS
			{
				displayName: 'Calendar Name',
				name: 'calendarName',
				type: 'string',
				required: true,
				displayOptions: { show: { operation: ['createCalendar', 'updateCalendar'] } },
				default: '',
				description: 'Calendar display name',
			},
			{
				displayName: 'Calendar ID',
				name: 'calendarIdParam',
				type: 'string',
				placeholder: '/admin/home/',
				required: true,
				displayOptions: { show: { operation: ['getCalendar', 'updateCalendar', 'deleteCalendar'] } },
				default: '',
				description: 'Calendar ID',
			},
			{
				displayName: 'Calendar Type',
				name: 'calendarType',
				type: 'options',
				displayOptions: { show: { operation: ['createCalendar', 'listCalendars'] } },
				options: [
					{ name: 'All', value: 'all' },
					{ name: 'Event', value: 'event' },
					{ name: 'Todo', value: 'todo' },
				],
				default: 'all',
				description: 'Calendar type filter',
			},

			// CUSTOM CALL
			{
				displayName: 'Method',
				name: 'method',
				type: 'options',
				displayOptions: { show: { operation: ['customCall'] } },
				options: [
					{ name: 'GET', value: 'GET' },
					{ name: 'POST', value: 'POST' },
					{ name: 'PUT', value: 'PUT' },
					{ name: 'DELETE', value: 'DELETE' },
				],
				default: 'GET',
				description: 'HTTP method',
			},
			{
				displayName: 'Endpoint',
				name: 'endpoint',
				type: 'string',
				placeholder: '/api/Calendar/default/v1/event',
				required: true,
				displayOptions: { show: { operation: ['customCall'] } },
				default: '',
				description: 'API endpoint path',
			},
			{
				displayName: 'Body',
				name: 'body',
				type: 'json',
				displayOptions: { show: { operation: ['customCall'] } },
				default: '{}',
				description: 'JSON request body',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];
		const operation = this.getNodeParameter('operation', 0) as string;
		const creds = normalizeCredentials(await this.getCredentials('synologyDsmApi'));
		const client = axios.create({
			timeout: 60000,
			httpsAgent: new https.Agent({ rejectUnauthorized: !creds.ignoreSslIssues }),
		});
		let sid: string | undefined;

		const login = async (): Promise<void> => {
			const { data } = await client.get(`${creds.baseUrl}/webapi/auth.cgi`, {
				params: {
					api: 'SYNO.API.Auth',
					version: '7',
					method: 'login',
					account: creds.username,
					passwd: creds.password,
					session: creds.sessionName,
					format: 'sid',
				},
				validateStatus: () => true,
			});
			if (!data?.success || !data?.data?.sid) {
				throw new NodeOperationError(this.getNode(), `DSM Calendar login failed: ${JSON.stringify(data)}`);
			}
			sid = data.data.sid;
		};

		const requestSynology = async (options: { method: IHttpRequestMethods; url: string; body?: unknown; timeout?: number; retryAuth?: boolean; [key: string]: unknown }) => {
			if (!sid) await login();
			const run = async () => client.request({
				method: options.method,
				url: `${creds.baseUrl}${options.url}`,
				data: options.body,
				timeout: options.timeout ?? 10000,
				headers: {
					'X-SYNO-TOKEN': sid as string,
					Cookie: `id=${sid as string}`,
				},
				validateStatus: () => true,
			});

			let response = await run();
			const d = response.data;
			if (!d?.success && [105, 106, 107, 119].includes(Number(d?.error?.code)) && options.retryAuth !== false) {
				await login();
				response = await run();
			}
			return response.data;
		};

		for (let i = 0; i < items.length; i++) {
			try {
				let responseData: any;

				switch (operation) {
					case 'createEvent': {
						const calendarId = this.getNodeParameter('calendarId', i) as string;
						const summary = this.getNodeParameter('summary', i) as string;
						const isAllDay = this.getNodeParameter('isAllDay', i) as boolean;
						const dtstart = this.getNodeParameter('dtstart', i) as number;
						const dtend = this.getNodeParameter('dtend', i) as number;

						const body = { cal_id: calendarId, summary, is_all_day: isAllDay, dtstart, dtend };

						responseData = await requestSynology({
							method: 'POST' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/event',
							json: true,
							timeout: 15000,
							body: body,
						});
						break;
					}

					case 'getEvent': {
						const eventId = this.getNodeParameter('eventId', i) as number;
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/event?evt_id=${eventId}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'listEvents': {
						responseData = await requestSynology({
							method: 'POST' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/event/list',
							json: true,
							timeout: 10000,
							body: { limit: 100 },
						});
						break;
					}

					case 'updateEvent': {
						const eventId = this.getNodeParameter('eventId', i) as number;
						const summary = this.getNodeParameter('summary', i) as string;
						const dtstart = this.getNodeParameter('dtstart', i) as number;
						const dtend = this.getNodeParameter('dtend', i) as number;

						const body = { evt_id: eventId, summary, dtstart, dtend };

						responseData = await requestSynology({
							method: 'PUT' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/event',
							json: true,
							timeout: 15000,
							body: body,
						});
						break;
					}

					case 'deleteEvent': {
						const eventId = this.getNodeParameter('eventId', i) as number;
						responseData = await requestSynology({
							method: 'DELETE' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/event?evt_id=${eventId}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'createTask': {
						const taskTitle = this.getNodeParameter('taskTitle', i) as string;
						responseData = await requestSynology({
							method: 'POST' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/task',
							json: true,
							timeout: 15000,
							body: { summary: taskTitle },
						});
						break;
					}

					case 'getTask': {
						const taskId = this.getNodeParameter('taskId', i) as number;
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/task?evt_id=${taskId}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'listTasks': {
						responseData = await requestSynology({
							method: 'POST' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/task/list',
							json: true,
							timeout: 10000,
							body: { limit: 100 },
						});
						break;
					}

					case 'updateTask': {
						const taskId = this.getNodeParameter('taskId', i) as number;
						const taskTitle = this.getNodeParameter('taskTitle', i) as string;

						responseData = await requestSynology({
							method: 'PUT' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/task',
							json: true,
							timeout: 15000,
							body: { evt_id: taskId, summary: taskTitle },
						});
						break;
					}

					case 'deleteTask': {
						const taskId = this.getNodeParameter('taskId', i) as number;
						responseData = await requestSynology({
							method: 'DELETE' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/task?evt_id=${taskId}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'createCalendar': {
						const calendarName = this.getNodeParameter('calendarName', i) as string;
						const calendarType = this.getNodeParameter('calendarType', i, 'event') as string;
						responseData = await requestSynology({
							method: 'POST' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/cal',
							json: true,
							timeout: 15000,
							body: {
								cal_displayname: calendarName,
								cal_description: '',
								cal_color: '#2E6BE6',
								is_hidden_in_cal: false,
								is_hidden_in_list: false,
								notify_alarm_by_browser: true,
								notify_alarm_by_mail: false,
								notify_evt_by_browser: true,
								notify_evt_by_mail: false,
								notify_import_cal_by_browser: true,
								notify_import_cal_by_mail: false,
								cal_type: calendarType,
							},
						});
						break;
					}

					case 'getCalendar': {
						const calendarIdParam = this.getNodeParameter('calendarIdParam', i) as string;
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/cal?cal_id=${encodeURIComponent(calendarIdParam)}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'updateCalendar': {
						const calendarIdParam = this.getNodeParameter('calendarIdParam', i) as string;
						const calendarName = this.getNodeParameter('calendarName', i, 'Updated Calendar') as string;

						responseData = await requestSynology({
							method: 'PUT' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/cal',
							json: true,
							timeout: 15000,
							body: {
								cal_id: calendarIdParam,
								original_cal_id: calendarIdParam,
								cal_displayname: calendarName,
								cal_description: '',
								cal_color: '#2E6BE6',
								is_hidden_in_cal: false,
								is_hidden_in_list: false,
								notify_alarm_by_browser: true,
								notify_alarm_by_mail: false,
								notify_evt_by_browser: true,
								notify_evt_by_mail: false,
								notify_import_cal_by_browser: true,
								notify_import_cal_by_mail: false,
							},
						});
						break;
					}

					case 'deleteCalendar': {
						const calendarIdParam = this.getNodeParameter('calendarIdParam', i) as string;
						responseData = await requestSynology({
							method: 'DELETE' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/cal?cal_id=${encodeURIComponent(calendarIdParam)}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'updateSettings': {
						responseData = await requestSynology({
							method: 'PUT' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/setting',
							json: true,
							timeout: 10000,
							body: {},
						});
						break;
					}

					case 'listCalendars': {
						const calendarType = this.getNodeParameter('calendarType', i, 'all') as string;
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: `/api/Calendar/default/v1/cal/list?cal_type=${encodeURIComponent(calendarType)}`,
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'getSettings': {
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/setting',
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'listTimezones': {
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/timezone',
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'listContacts': {
						responseData = await requestSynology({
							method: 'GET' as IHttpRequestMethods,
							url: '/api/Calendar/default/v1/contact',
							json: true,
							timeout: 10000,
						});
						break;
					}

					case 'customCall': {
						const method = this.getNodeParameter('method', i) as string;
						const endpoint = this.getNodeParameter('endpoint', i) as string;
						const body = this.getNodeParameter('body', i) as any;

						const options: any = {
							method: method as IHttpRequestMethods,
							url: endpoint,
							json: true,
							timeout: 10000,
						};

						if (body && (method === 'POST' || method === 'PUT')) {
							options.body = body;
						}

						responseData = await requestSynology(options);
						break;
					}

					default:
						throw new NodeOperationError(
							this.getNode(),
							`Operation "${operation}" not implemented`,
						);
				}

				const executionData = this.helpers.constructExecutionMetaData(
					this.helpers.returnJsonArray(responseData),
					{ itemData: { item: i } },
				);

				returnData.push(...executionData);
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: error instanceof Error ? error.message : String(error) },
						pairedItem: i,
					});
				} else {
					throw error;
				}
			}
		}

		return [returnData];
	}
}
