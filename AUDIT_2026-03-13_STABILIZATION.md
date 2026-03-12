# Stabilization Audit — 2026-03-13

## Scope
DSM-variant compatibility hardening focused on runtime method/API fallback behavior, with explicit pagination defaults where variant DSM builds commonly return code 120 for missing parameters.

## Inventory (high-level)
Current nodes and dominant API families:
- SynologyApi: generic DSM API caller (`SYNO.*`)
- SynologyCalendar: Calendar REST (`/api/Calendar/default/v1/*`)
- SynologyContacts: `SYNO.Contacts.*`, `SYNO.AddressBook.*`
- SynologyDrive: `SYNO.FileStation.*`, `SYNO.SynologyDrive.*`
- SynologyFileStation: `SYNO.FileStation.*`
- SynologyNote: `SYNO.NoteStation.*`
- SynologyPhotos: `SYNO.Foto.*`
- SynologyChat: `SYNO.Chat.*`
- SynologyMailPlus / Trigger: `SYNO.MailClient.*`, `SYNO.MailPlusServer.*`
- SynologyOffice: `SYNO.Office.*`
- SynologyDownloadStation2: `SYNO.DownloadStation2.*`
- SynologySecurityObservability: `SYNO.SecurityAdvisor.*`, `SYNO.LogCenter.*`
- SynologyStorageManager: Storage APIs via `callAny`
- SynologySheets: Synology Spreadsheet APIs

## Operations adjusted

### Priority set (issues seen recently)

#### Photos
Adjusted operations to use compatibility fallback (`callAny`) across method/API variants:
- listFolders, listAlbums, getAlbum, listItems, listRecent
- searchPhotos, getSearchFilters
- createAlbum, updateAlbum, deleteAlbum
- getItem, updateItem, deleteItem
- addFavorite, removeFavorite
- listSharing, createSharing, updateSharing, deleteSharing
- getThumbnail, downloadItem
- getSettings, updateSettings

Additional hardening:
- explicit pagination defaults retained (`limit`, `offset`)
- passphrase-aware sharing list warning path preserved for DSM code 120 behavior

#### Contacts
Adjusted to API-family fallback between Contacts and AddressBook implementations:
- addressbook CRUD/list
- contact CRUD/list/search
- label CRUD/list
- getInfo, getSettings

Additional hardening:
- explicit defaults for `limit`/`offset` in list/search paths

#### FileStation
Adjusted to fallback API/method patterns for variant support:
- list, createFolder, rename, delete, copyMove
- dirsizeStart, backgroundList

Additional hardening:
- explicit pagination defaults already present and preserved
- binary download output behavior preserved (n8n binary format remains unchanged)

#### Calendar
No behavior change in this pass (node still uses Calendar REST endpoints rather than DSM `entry.cgi` API map). Marked best-effort/unverified for API path variants.

### Secondary set

#### Drive
Added fallback patterns in high-risk areas:
- list/search via FileStation list/browse fallback
- Drive file query operations (`list_starred`, `list_recent`, shared variants)
- labels CRUD/list via label API aliases
- webhooks CRUD/list via webhook API aliases

#### Note
Added fallback patterns for:
- notebooks list/create/get/update
- notes list/get
- tags list/create/update/delete

#### Chat
Hardened with API-family fallbacks:
- channels/posts/users/webhooks/apps list/get/create/send operations
- explicit pagination defaults for list operations

#### SecurityObservability
- `getLoginActivityUser` now uses fallback API/method candidates (`get`/`list` and two API paths)
- explicit defaults for `offset`/`limit`

## Fallback strategies used
- `DsmClient.callAny([...apis], [...methods], params)` for API-family and method-name drift
- conservative aliasing patterns:
  - CRUD: `create|add`, `update|set`, `delete|remove`
  - listing: `list|get`
- parameter compatibility aliases in selected operations (`id` + typed IDs)
- explicit defaults for pagination fields to reduce missing-param incompatibilities

## Best-effort / unverified
- SynologyCalendar: REST endpoint variants not fully normalized in this pass.
- Container Manager probe prep: no new destructive action introduced; probe stage remains separate and pending dedicated validation execution.
- Some speculative aliases (Drive/Note/Chat families) are defensive and compile-tested but require live DSM matrix runtime verification.
