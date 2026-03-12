# n8n-nodes-synology-suite

Community nodes for Synology DSM WebAPI.

- **NPM**: https://www.npmjs.com/package/n8n-nodes-synology-suite
- **GitHub**: https://github.com/ClawBow/n8n-nodes-synology-suite
- **Issues**: https://github.com/ClawBow/n8n-nodes-synology-suite/issues

## Project status

> ⚠️ **Work in progress / actively expanding**
>
> This package is under active development. New Synology APIs are added progressively, coverage is improving release after release, and some operations can still be unstable depending on DSM version/build.
>
> Bugs are possible (especially on less common DSM/API variants). I’m actively fixing them and extending coverage over time.

## Included nodes (current)

- **Synology API**: generic DSM caller (`api + method + version + params`)
- **Synology Drive**: file operations, search, links, team folders, labels, webhooks
- **Synology Sheets**: spreadsheet reads/writes, range ops, exports, batch updates
- **Synology Office**: Office-family fallback + custom calls
- **Synology MailPlus**: mailbox/message/label/filter operations
- **Synology MailPlus Trigger**: incoming mail events (webhook style)
- **Synology Calendar**: calendars, events, tasks, settings, timezone helpers
- **Synology Note**: notebooks, notes, todos, tags, search, trash, sharing
- **Synology Photos**: browse, albums, sharing, favorites, thumbnails
- **Synology Contacts**: addressbooks, contacts, labels, search
- **Synology File Station**: list/info/search/copy/move/delete/upload/download/background tasks
- **Synology Chat**: users/channels/posts/webhooks/apps + custom chat calls
- **Synology Security Observability**: security/logcenter-style discovery and operations
- **Synology DownloadStation2**: modern Download Station operations

## Coverage philosophy

Goal: cover as much of the Synology API surface as possible with stable operation-based nodes.

- New API families are added incrementally.
- Unsupported or DSM-variant methods can still be reached via `Custom * Call` operations.
- Runtime probing artifacts are included to document what is actually available on real NAS targets.

## Credentials

`Synology DSM API`
- Base URL (example: `https://your-nas:5001`)
- Username
- Password
- Session Name (default `FileStation`)
- Ignore SSL Issues (for self-signed certs)

## Node usage examples

### Synology Office
- **List Spreadsheets**: choose `List Spreadsheets`, set folder ID and limit.
- **Read Range / Cells**: choose `Read Range / Cells`, set `fileId`, optional `sheetId`, and A1 range (`A1:C20`).
- **Write Range / Cells**: choose `Write Range / Cells`, provide A1 range and a 2D JSON values array.
- **Append Row**: provide `rowValues` JSON array.
- If your DSM build uses different method names, keep using operation mode and pass `extraParamsJson`, or use `Custom Office Call`.

### Synology MailPlus
- **List Mailboxes**: operation `List Mailboxes`.
- **List Messages**: operation `List Messages`, optionally enable `Return All` for auto-pagination.
- **Get Message Detail**: set `messageId`.
- **Move Message**: set `messageIds` JSON array and destination mailbox.
- **Mark Read / Unread**: set `messageId` + boolean `read`.
- **Add / Remove Label**: set `messageId`, `labelId`, and label action.

### Synology Drive
- **List Files**: supports offset/limit and `Return All`.
- **Search Files**: can `Wait for Completion` and poll search task results.
- **Create Share Link**: supports link password, expiration date, and download toggle.
- `Custom Drive Call` remains available for unsupported variants.

## Error handling

DSM error responses are normalized and include:
- `api`
- `method`
- `version`
- DSM `code`
- mapped human message

All nodes use n8n `continueOnFail()` behavior. If enabled, each failing item emits an error payload instead of stopping the workflow.

## Local test

```bash
npm install
npm run build
npm run smoke
```

## Troubleshooting

- **`code=102/103/104`**: API/method/version mismatch on your DSM version. Use `Custom * Call` mode or provide additional params in `extraParamsJson`.
- **`code=105/106/107/119`**: auth/session issue. Verify credentials and session name. Re-login retry is automatic once.
- **Mail label operations fail**: MailPlus versions differ. Try custom call and inspect available methods through `List Mail APIs`.
- **Office sheet operation fails**: different Office method names exist between builds. Operation mode already attempts multiple method candidates; if still failing, switch to custom call.

## API inventories captured from your NAS

- [`synology-api-catalog.full.json`](https://github.com/ClawBow/n8n-nodes-synology-suite/blob/main/synology-api-catalog.full.json) (full discovered catalog)
- [`ALL_APIS.md`](https://github.com/ClawBow/n8n-nodes-synology-suite/blob/main/ALL_APIS.md) (human-readable full list)

Additional per-service inventories (`syno-drive-apis.json`, `syno-office-apis.json`, `syno-mailplus-server-apis.json`, `syno-mailclient-apis.json`) are generated in the **workspace root** during local probing and are not part of this repository by default.

## Full-action discovery (exhaustive probe)

The repository includes an exhaustive action discovery script that probes a conservative method set on every discovered DSM API:

- candidate methods: `get,list,query,info,start,status,create,update,set,delete,run,stop,search,read,write`
- default safety mode skips potentially destructive methods (`start/create/update/set/delete/run/stop/write`)
- credentials are loaded from `../skills/synology-api-discovery/.env` by default

Run (safe default):

```bash
npm run probe:actions
```

Outputs:
- `API_PROBE_RESULTS.json` (full machine-readable probe results)
- `API_PROBE_SUMMARY.md` (human summary, top valid methods, coverage stats)

Optional destructive probing (use with caution):

```bash
npm run probe:actions:destructive
```

### Caveats

- Many endpoints require mandatory params; `error code 101` often means method likely exists but needs args.
- `error code 103` usually indicates unsupported/non-existent method for that API.
- Running with `--allow-destructive` can trigger state-changing operations. Prefer non-destructive mode unless on a test NAS.

## About Synology Office API docs/slides access

Some Synology Office API docs/slides or private support resources are not publicly accessible via API and may require Synology-side access/enablement.

If you need access, open a request via official channels:
- Synology Support Center: https://account.synology.com/support
- Synology KB portal: https://kb.synology.com/
- Synology Community: https://community.synology.com/

If you already received specific support links from Synology, add them here so other users can request the same access path.

## Additional examples

See [EXAMPLES.md](./EXAMPLES.md) for sample n8n workflow JSON snippets.
