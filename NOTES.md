# n8n-nodes-synology-suite — Internal Notes (NOT published)

## Project Overview
- **Goal:** Complete n8n node suite for Synology DSM API
- **Status:** Discovery phase completed, implementation starting
- **Owner:** Maxime
- **Created:** Feb 5, 2026

## Completed (Discovery Phase)
✅ **API Discovery Script** (`scripts/probe-actions.py`)
- Exhaustive probing of 1194 Synology APIs
- 8358 methods tested
- Safe-by-default mode (destructive methods skipped)
- Output: `ACTIONS_MATRIX.json` + `ACTIONS_MATRIX.md`
- Test results: 169 successes, 8189 errors (expected for broad probing)

✅ **npm Scripts Wired**
- `npm run probe:actions` (safe mode)
- `npm run probe:actions:destructive` (opt-in)

✅ **Project Build Validated**
- `npm run build` passes
- No breaking changes from discovery phase

## Current Status (2026-03-01 17:25 UTC)
- Discovery complete, actionable matrix exists
- **Implementation STARTED** — MVP AI Agent Tools created
- Created 4 Priority 1 AI Agent Tools (see below)

## AI Agent Tools Implemented (MVP)
✅ **synology_send_email** (`SendEmail.ts`)
- Send emails via Synology MailPlus
- Parameters: to, cc, bcc, subject, body, priority, fromAddress, mailboxId
- AI-friendly schema included

✅ **synology_upload_file** (`UploadFile.ts`)
- Upload files to Synology Drive
- Parameters: destinationPath, fileContent, overwrite, fileSize
- AI-friendly schema included

✅ **synology_list_files** (`ListFiles.ts`)
- List files in NAS folders
- Parameters: folderPath, recursive, sortBy, limit, includeHidden
- AI-friendly schema included

✅ **synology_get_storage_stats** (`GetStorageStats.ts`)
- Get NAS storage capacity/usage
- Parameters: includeDetails
- Returns: total, used, available, percentUsed, status
- AI-friendly schema included

## Location
- All AI Agent Tools in: `/nodes/AIAgentTools/`
- Exported via `/nodes/AIAgentTools/index.ts`

## Next Immediate Tasks
- [ ] **Build/Test** — npm run build + verify nodes compile
- [ ] **Test in n8n** — Create a test workflow using the AI Agent Tools
- [ ] **Create Example Workflows:**
  - [ ] Email Bot (send emails based on user query)
  - [ ] File Manager Bot (list + upload files)
  - [ ] Storage Monitor Bot (check NAS capacity)
- [ ] **Phase 2 Tools** (starting soon):
  - [ ] synology_search_files (Drive)
  - [ ] synology_search_emails (MailPlus)
  - [ ] synology_list_albums (Photos)
  - [ ] synology_get_downloads (DownloadStation)

## Implementation Strategy
1. **Phase 1:** Core API families (Mail, Drive, Office) — 2-3 weeks
2. **Phase 2:** Additional services (Photos, Audio, Video, etc.)
3. **Phase 3:** Destructive operations (update/delete/set) with safeguards
4. **Phase 4:** Error handling & edge cases per API

## Known Challenges
- High error rate (8189/8358) due to missing required params
- Some APIs have unique parameter signatures (need documentation)
- Destructive methods need careful validation
- Different API families have different auth/permission models

## Files & Structure
```
/
├── REPORT.md              — Public summary (current discovery status)
├── NOTES.md               — THIS FILE (internal tracking)
├── scripts/
│   └── probe-actions.py   — Discovery script
├── ACTIONS_MATRIX.json    — Full API matrix (machine-readable)
├── ACTIONS_MATRIX.md      — API coverage summary
├── src/                   — Node implementations (TBD)
└── package.json
```

## Maxime's Feedback/Preferences
- Focus on "real use" APIs first, not everything
- Safe-by-default is good, keep it
- Document edge cases/quirks APIs have
- Consider error handling for timeouts/permission issues

## Technical Debt / Future Improvements
- [ ] Add SSL validation caching for discovery
- [ ] Build parameter validators per API family
- [ ] Create wrapper for common Synology patterns
- [ ] Integration tests with real Synology instance
- [ ] Performance optimization for large batch operations

## Recent Changes
- 2026-02-18: Full discovery completed
- 2026-03-01: Notes file created for project tracking

## Reference Links
- Synology DSM API Docs: (if available)
- n8n Nodes Guide: https://docs.n8n.io/nodes/
- ACTIONS_MATRIX.md: ./ACTIONS_MATRIX.md (local reference)

---

**Next Review:** 2026-03-04 (when starting implementation phase)
**Last updated:** Bob, 2026-03-01 17:21 UTC
