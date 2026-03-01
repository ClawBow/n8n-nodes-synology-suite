# REPORT

## Current Status (2026-03-01 18:14) — Structured Service-Based Tools Complete

✅ **PHASE 1: Fixed Architecture (v0.5.2-0.5.3)**
- Rewritten with correct `supplyData()` pattern
- Output: `NodeConnectionTypes.AiTool`
- Integrated LangChain `DynamicTool`
- Added proper icons from service families

✅ **PHASE 2: Icons & Asset Pipeline (v0.5.3)**
- Icons: MailPlus, Drive, Office, API
- Auto-copy assets during build
- Icons appear in n8n UI

✅ **PHASE 3: 12 Individual Tools (v0.6.0)**
- Created one Tool per action (SendEmail, ListFiles, DeleteFile, etc.)
- Published to NPM but needed UI consolidation

✅ **PHASE 4: SERVICE-BASED STRUCTURE (v0.7.0) ⭐⭐**
- **Restructured to 4 Main Service Tools** (cleaner, more organized)

**Synology Drive Tool** (4 actions)
- `upload` — Upload files to Drive
- `list` — List files in folders
- `search` — Search by filename/pattern
- `delete` — Delete files permanently
- 🎨 Icon: synology-drive.png

**Synology Mail Tool** (4 actions)
- `sendemail` — Send emails via MailPlus
- `listmailboxes` — List available mailboxes
- `listmessages` — List messages from mailbox
- `movemessage` — Move messages between folders
- 🎨 Icon: synology-mailplus.png

**Synology Office Tool** (3 actions)
- `listspreadsheets` — List available spreadsheets
- `readrange` — Read cells/ranges from sheets
- `appendrow` — Add rows to spreadsheets
- 🎨 Icon: synology-office.png

**Synology API Tool** (1 action)
- `storagestats` — Get NAS storage capacity/usage
- 🎨 Icon: synology-api.png

**Input Format:** JSON with `action` field + action-specific parameters
```json
{"action": "upload", "filename": "doc.pdf", "content": "..."}
{"action": "list", "path": "/Documents"}
{"action": "sendemail", "to": "user@example.com", "subject": "...", "body": "..."}
```

**Published:** NPM `n8n-nodes-synology-suite@0.7.0` ✅

**Next:** Maxime to install v0.7.0, restart n8n, verify 4 tools appear in AI Agent Tools panel with proper icons

---

## Synology full-action discovery status (2026-02-18 - Discovery Phase Completed)

### Completed
1. Implemented exhaustive probing script: `scripts/probe-actions.py`
   - Logs into DSM using `.env` from `skills/synology-api-discovery` by default.
   - Queries live API catalog via `SYNO.API.Info`.
   - Starts from `synology-api-catalog.full.json` and probes union of catalog + live APIs.
   - Tests candidate methods:
     - `get,list,query,info,start,status,create,update,set,delete,run,stop,search,read,write`
   - Safe-by-default mode skips potentially destructive methods.
   - Supports opt-in destructive mode with `--allow-destructive`.

2. Generated outputs:
   - `ACTIONS_MATRIX.json` (full matrix)
   - `ACTIONS_MATRIX.md` (human summary + coverage)

3. Wired npm scripts:
   - `npm run probe:actions` (safe default)
   - `npm run probe:actions:destructive` (opt-in)

4. Updated README with full-action discovery usage and caveats.

5. Kept project build intact and validated with `npm run build`.

### Discovery run results (safe mode)
- APIs in catalog: **1194**
- APIs discovered live: **1194**
- APIs probed (union): **1194**
- Methods tested: **8358**
- Success responses: **169**
- Error responses: **8189**
- Skipped by safety policy: **9552**

### Remaining gaps / interpretation notes
- High error volume is expected for broad probing without method-specific required params.
- `error code 101` frequently indicates method likely exists but needs additional arguments.
- For deeper validation, add API-specific parameter templates and targeted probes per product family (Drive/Office/MailPlus/etc.).
- Destructive coverage remains intentionally untested in default mode.
