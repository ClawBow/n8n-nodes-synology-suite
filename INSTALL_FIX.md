# Install/Update Fix - v0.10.1+

## Problem (v0.7.0 - v0.10.0)

**Issue:** Every install/update via n8n UI failed with:
```
Error loading package "n8n-nodes-synology-suite": Failed to save installed package
Cause: duplicate key value violates unique constraint PK_8ebd28194e4f792f96b5933423fc439df97d9689
```

**Root Cause:** Tool nodes had identical `displayName` to regular nodes:
- Regular node: `displayName: "Synology Drive"`
- Tool node: `displayName: "Synology Drive"` ← **DUPLICATE!**

PostgreSQL constraint on `installed_nodes.name` column requires unique names. When n8n tried to insert both, it violated the PRIMARY KEY.

**Workaround (Manual):**
1. Delete package from container
2. Remove from package.json
3. Clean PostgreSQL tables
4. `npm install` manually
5. INSERT entries manually in PostgreSQL
6. Restart

This was required for every version from v0.7.0 to v0.10.0. **Not tenable.**

---

## Solution (v0.10.1+)

**Fix:** Renamed all tool node displayNames to be unique:
```typescript
// Before (❌)
displayName: 'Synology Drive'
displayName: 'Synology Mail'
displayName: 'Synology Office'
displayName: 'Synology API'

// After (✅)
displayName: 'Synology Drive (AI Agent)'
displayName: 'Synology Mail (AI Agent)'
displayName: 'Synology Office (AI Agent)'
displayName: 'Synology API (AI Agent)'
```

**Result:** 
- ✅ Install via n8n UI: **CLEAN**
- ✅ Update via n8n UI: **CLEAN**
- ✅ No manual SQL inserts needed
- ✅ Works like all other community nodes

---

## Lesson for Multi-Node Packages

When a package exports multiple nodes (especially similar ones like regular + tool variants):

⚠️ **CRITICAL:** Ensure all node `displayName` values are **globally unique** within the package.

PostgreSQL Primary Key constraint on `installed_nodes(name)` will reject duplicate names during registration.

**Good pattern:**
```typescript
// Regular node
displayName: 'Synology Drive'

// Tool variant
displayName: 'Synology Drive (AI Agent)'
// OR
displayName: 'Synology Drive Tool'
// OR
displayName: '[Tool] Synology Drive'
```

**Bad pattern:**
```typescript
// Both have same name → constraint violation!
displayName: 'Synology Drive'
displayName: 'Synology Drive'
```

---

## Testing

Install/Update tested and confirmed working in v0.10.1 → v0.10.2 via n8n UI without errors.
