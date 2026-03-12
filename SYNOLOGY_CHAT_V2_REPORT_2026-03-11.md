# Synology Chat v2 report — 2026-03-11

## Scope completed
Updated `nodes/SynologyChat/SynologyChat.node.ts` to add requested v2 operations while keeping v1 compatibility.

### Added operations
- `listPosts` (requires `channelId`)
- `getChannel` (requires `channelId`)
- `createIncomingWebhook` (requires `channelId` + `webhookName`)

### Backward compatibility
Existing operations preserved unchanged:
- `listChannels`
- `listUsers`
- `getUser`
- `listIncomingWebhooks`
- `listApps`
- `sendMessage`
- `customChatCall`

## API behavior validation on this NAS
Runtime probes were executed against DSM WebAPI using the integration account.

### Parameter names confirmed
- `SYNO.Chat.Post.list`: `channel_id`, `offset`, `limit` ✅
- `SYNO.Chat.Webhook.Incoming.create`: `channel_id`, `name` ✅

### `getChannel` method reality (important)
- `SYNO.Chat.Channel.get` returns `code=103` (method not found) on this NAS.
- `SYNO.Chat.Channel.info/query` also return `code=103`.
- Therefore, node implementation uses safe fallback:
  - call `SYNO.Chat.Channel.list`
  - filter locally by `channel_id`
  - return matched channel as `data.channel`

This is the only reliable behavior observed on this NAS while preserving a `getChannel` UX.

## Per-operation runtime probe status
Using discovered `channel_id=1`.

- **listPosts** → **OK**
  - Call: `SYNO.Chat.Post.list(channel_id, offset, limit)`
  - Result: success=true, posts returned

- **getChannel** → **OK** (fallback mode)
  - Effective call: `SYNO.Chat.Channel.list` + local filter by `channel_id`
  - Result: channel matched and returned
  - Native `get` method status: **KO**, error `103`

- **createIncomingWebhook** → **OK**
  - Call: `SYNO.Chat.Webhook.Incoming.create(channel_id, name)`
  - Result: success=true, token returned

## If permissions are blocked at runtime (guidance)
If these ops fail in another environment/account, expected DSM error codes and guidance:

- `105` (Insufficient user privilege)
- `117` (Need manager rights)
- `403` (Permission denied)

Fallback guidance:
1. Verify Chat app permissions for the integration account in DSM/Chat admin.
2. Test with `listChannels` and `listIncomingWebhooks` first to confirm visibility scope.
3. Use `customChatCall` for diagnostics when endpoint behavior differs by DSM version.
4. For `getChannel`, if native `get` is unavailable, rely on list+filter strategy.

## Build + smoke test
- `npm run build` ✅ (TypeScript compile + assets copy)
- Runtime smoke probes for all 3 new operations ✅

## Notes
- `createIncomingWebhook` probe creates a real webhook token (non-destructive but persistent). If needed, cleanup should be handled manually via DSM/Chat UI or corresponding delete endpoint (not added in this task).
