# Investigation — Synology FileStation upload error 119

Date: 2026-03-11  
Repo: `/root/.openclaw/workspace/n8n-nodes-synology-suite`

## Scope
Investigate reproducible `uploadBase64` failures returning DSM error `119` while most FileStation ops succeed.

## What I did

### 1) Reproduced code 119 with a minimal raw request
I used a direct multipart POST to `SYNO.FileStation.Upload` **without `_sid`**.

Result:
```json
{"error":{"code":119},"success":false}
```

This confirms code `119` is an auth/session problem on upload requests (missing/invalid session), not a generic file-path/permissions error.

### 2) Verified upload can succeed on the same account/permissions
Using the same account and destination (`/OpenClaw/_archive/node-filestation-tests`) with a valid session (`_sid` in query), upload succeeds.

So the account and folder rights are not globally blocking upload.

### 3) Tested stale-session behavior against current client logic
Before fix, upload path had no auth-recovery branch unlike `call()`.

I simulated:
1. login
2. invalidate session (logout)
3. call `uploadFile(...)` with stale sid

This is the critical edge case consistent with intermittent `119` in runtime.

## Root cause (strongest)
`DsmClient.uploadFile()` did **not** handle auth/session-expired errors (`105/106/107/119`) the way `DsmClient.call()` already does.

So if the sid is stale at upload time, upload returns code `119` and fails directly.

## Code fix applied
File changed:
- `nodes/shared/DsmClient.ts`

Changes:
1. In `uploadFile()`, added a one-time auth recovery flow:
   - If upload response is not success and DSM code is one of `[105,106,107,119]`, then:
     - `login()` again
     - retry upload once
2. Kept existing multipart semantics (`_sid` in query) and kept change minimal.
3. Minor multipart boundary hardening (dynamic boundary string).

## Validation after fix

### Build + smoke
- `npm run build` ✅
- `npm run smoke` ✅

### Runtime repro test (post-fix)
Using compiled client:
- A) no-sid raw upload still returns code 119 (expected, confirms repro remains valid)
- B) forced stale sid + `uploadFile(...)` now succeeds due to relogin+retry

Observed result:
```json
{"success":true,"fileName":"relogin-test.txt","path":"/OpenClaw/_archive/node-filestation-tests", ...}
```

## Conclusion
Status: **fixed in client logic** for the most likely real runtime cause (expired/invalid sid during upload).

`uploadBase64` should now recover automatically from session-related `119` instead of failing hard.

## If 119 still appears after this patch
Most likely external/environmental causes to check next:
1. Reverse proxy behavior for multipart POST to `/webapi/entry.cgi` (query string stripping, WAF rules).
2. DSM-side security modules/session policy terminating sid between steps.
3. Different runtime base URL path rewriting in n8n vs local test route.
4. SessionName mismatch configured in credentials at runtime (less likely, but verify exact credential in executing workflow).

Suggested admin checks:
- Compare direct NAS URL vs proxied URL in n8n credentials.
- Capture DSM nginx/proxy logs around failing upload.
- Verify no middleware strips `_sid` query for multipart POST.

---

## Quick reproducibility snippet used (summary)
- Raw multipart upload without sid => `119`.
- Force stale sid then call `DsmClient.uploadFile()` => now succeeds after auto relogin.
