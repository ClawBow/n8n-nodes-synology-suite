# Synology Chat v1 — quick runtime probe (2026-03-11)

## APIs detected via SYNO.API.Info
Detected (examples):
- SYNO.Chat.Channel
- SYNO.Chat.Post
- SYNO.Chat.User
- SYNO.Chat.Webhook.Incoming
- SYNO.Chat.App
- (+ many others)

## Tested methods with integration account
- ✅ SYNO.Chat.Channel.list
- ✅ SYNO.Chat.User.list
- ✅ SYNO.Chat.User.get
- ✅ SYNO.Chat.Webhook.Incoming.list
- ✅ SYNO.Chat.App.list

- ❌ SYNO.Chat.Post.list -> ERR_403
- ⚠️ Some `get` methods return ERR_401 / ERR_105 / ERR_117 depending on endpoint/params/permissions

## Node scope chosen for v1
- listChannels
- listUsers
- getUser
- listIncomingWebhooks
- listApps
- customChatCall

Rationale: ship stable read/list ops first, keep custom fallback for advanced endpoints.
