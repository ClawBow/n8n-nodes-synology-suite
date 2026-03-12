# Calendar spec vs node mapping (auto)

| Node op | HTTP | URL | In spec? | Notes |
|---|---|---|---|---|
| `createEvent` | POST | `/api/Calendar/default/v1/event` | ✅ |  |
| `getEvent` | GET | `/api/Calendar/default/v1/event?event_id=${eventId}` | ✅ | spec expects evt_id query param |
| `listEvents` | POST | `/api/Calendar/default/v1/event/list` | ✅ |  |
| `updateEvent` | PUT | `/api/Calendar/default/v1/event` | ✅ | spec uses evt_id + dav_etag + more required fields |
| `deleteEvent` | DELETE | `/api/Calendar/default/v1/event?event_id=${eventId}` | ✅ | spec expects evt_id query param |
| `createTask` | POST | `/api/Calendar/default/v1/task` | ✅ | spec requires more fields (original_cal_id, percent_complete, etc.) |
| `getTask` | GET | `/api/Calendar/default/v1/task?task_id=${taskId}` | ✅ | spec expects evt_id query param |
| `listTasks` | POST | `/api/Calendar/default/v1/task/list` | ✅ |  |
| `updateTask` | PUT | `/api/Calendar/default/v1/task` | ✅ | spec uses evt_id + required fields |
| `deleteTask` | DELETE | `/api/Calendar/default/v1/task?task_id=${taskId}` | ✅ | spec expects evt_id query param |
| `createCalendar` | POST | `/api/Calendar/default/v1/cal` | ✅ | spec requires cal_displayname + cal_type + more |
| `getCalendar` | GET | `/api/Calendar/default/v1/cal?cal_id=${encodeURIComponent(calendarIdParam)}` | ✅ |  |
| `updateCalendar` | PUT | `/api/Calendar/default/v1/cal` | ✅ | spec uses cal_displayname, not cal_name |
| `deleteCalendar` | DELETE | `/api/Calendar/default/v1/cal?cal_id=${encodeURIComponent(calendarIdParam)}` | ✅ |  |
| `updateSettings` | PUT | `/api/Calendar/default/v1/setting` | ✅ |  |
| `listCalendars` | POST | `/api/Calendar/default/v1/cal/list` | ❌ | spec says GET /cal/list with cal_type query |
| `getSettings` | GET | `/api/Calendar/default/v1/setting` | ✅ |  |
| `listTimezones` | GET | `/api/Calendar/default/v1/timezone` | ✅ |  |
| `listContacts` | GET | `/api/Calendar/default/v1/contact` | ✅ |  |
| `customCall` |  | `` | ❌ |  |

## Spec endpoints missing in node

- POST `/api/Calendar/default/v1/login` (x-syno-method: login)
- POST `/api/Calendar/default/v1/logout` (x-syno-method: logout)
- PUT `/api/Calendar/default/v1/event/subevent` (x-syno-method: subevent_set)
- PUT `/api/Calendar/default/v1/event/invite-event` (x-syno-method: invite_event_set)
- PUT `/api/Calendar/default/v1/event/invite-subevent` (x-syno-method: invite_subevent_set)
- PUT `/api/Calendar/default/v1/event/exdate` (x-syno-method: set_exdate)
- PUT `/api/Calendar/default/v1/event/personal-property` (x-syno-method: set_personal_property)
- GET `/api/Calendar/default/v1/cal/list` (x-syno-method: list)
- GET `/api/Calendar/default/v1/cal/export` (x-syno-method: export)