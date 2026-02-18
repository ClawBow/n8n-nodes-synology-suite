# EXAMPLES

Sample snippets to paste/adapt in n8n node parameter fields.

## 1) Office - write values into a range
Operation: `Write Range / Cells`

- `fileId`: `12345`
- `sheetId`: `1`
- `range`: `A1:C2`
- `values`:
```json
[["Name","Email","Status"],["Max","max@example.com","ok"]]
```
- `extraParamsJson`:
```json
{"locale":"en_US"}
```

## 2) Office - append row
Operation: `Append Row`

- `fileId`: `12345`
- `sheetId`: `1`
- `rowValues`:
```json
["2026-02-18","invoice-202","paid"]
```

## 3) MailPlus - list messages with pagination
Operation: `List Messages`

- `mailboxId`: `INBOX`
- `offset`: `0`
- `limit`: `100`
- `returnAll`: `true`
- `extraParamsJson`:
```json
{"sort":"date","order":"desc"}
```

## 4) MailPlus - move batch messages
Operation: `Move Message`

- `messageIds`:
```json
["1001","1002","1003"]
```
- `destinationMailboxId`: `Archive`

## 5) Drive - search and poll completion
Operation: `Search Files`

- `path`: `/home`
- `keyword`: `contract`
- `recursive`: `true`
- `waitForCompletion`: `true`
- `pollIntervalMs`: `1500`
- `pollTimeoutMs`: `45000`

## 6) Drive - create share link with expiration
Operation: `Create Share Link`

- `path`: `/home/contracts/contract-42.pdf`
- `linkName`: `contract-42-share`
- `linkPassword`: `secret123`
- `expireDate`: `2026-03-01`
- `enableDownload`: `true`

## 7) Generic custom call fallback
Node: `Synology API`

- `api`: `SYNO.FileStation.Search`
- `method`: `list`
- `versionMode`: `auto`
- `paramsJson`:
```json
{"taskid":"abc123"}
```
