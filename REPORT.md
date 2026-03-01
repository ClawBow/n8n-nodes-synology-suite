# REPORT

## Current Status (2026-03-01 18:02) — Tool Sub-Nodes Complete

✅ **FIXED: AI Agent Tool Sub-Nodes (v0.5.2)**
- **Previously (v0.5.1):** Created nodes as `execute()` → appeared as regular nodes (wrong)
- **Now (v0.5.2):** Rewritten with correct architecture:
  - Use `supplyData()` instead of `execute()`
  - Output type: `NodeConnectionTypes.AiTool` (not `['main']`)
  - Return `DynamicTool` from `@langchain/core/tools`
  - Integrated `nodeNameToToolName()` validation
- **Published:** NPM `n8n-nodes-synology-suite@0.5.2`
- **Tools included:**
  - `SynologyMailPlusSendEmailTool` — Send email via MailPlus
  - `SynologyDriveUploadFileTool` — Upload file to Drive
  - `SynologyDriveListFilesTool` — List Drive files
  - `SynologyGetStorageStatsTool` — Get NAS storage stats

**Next:** Maxime to install v0.5.2, restart n8n, verify tools appear in AI Agent Tools panel

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
