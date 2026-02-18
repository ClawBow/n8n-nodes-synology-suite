# n8n-nodes-synology-suite

Community nodes for Synology DSM WebAPI.

## Included nodes
- **Synology API**: generic caller (`api + method + version + params`).
- **Synology Drive**: file listing/search/create/move/share + custom call.
- **Synology Office**: Spreadsheet-focused operations + custom call fallback.
- **Synology MailPlus**: mailbox/message practical actions + custom call fallback.

## Credential
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
- `synology-api-catalog.full.json` (full discovered catalog)
- `ALL_APIS.md` (human-readable full list)
- `../syno-drive-apis.json`
- `../syno-office-apis.json`
- `../syno-mailplus-server-apis.json`
- `../syno-mailclient-apis.json`

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
- `ACTIONS_MATRIX.json` (full machine-readable result matrix)
- `ACTIONS_MATRIX.md` (human summary, top valid methods, coverage stats)

Optional destructive probing (use with caution):
```bash
npm run probe:actions:destructive
```

### Caveats
- Many endpoints require mandatory params; `error code 101` often means method likely exists but needs args.
- `error code 103` usually indicates unsupported/non-existent method for that API.
- Running with `--allow-destructive` can trigger state-changing operations. Prefer non-destructive mode unless on a test NAS.

## Additional examples
See [EXAMPLES.md](./EXAMPLES.md) for sample n8n workflow JSON snippets.
