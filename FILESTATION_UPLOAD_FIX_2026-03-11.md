# FILESTATION upload fix report (2026-03-11)

Repo: `/root/.openclaw/workspace/n8n-nodes-synology-suite`
Scope: unblock `SYNO.FileStation.Upload` returning DSM error `119`.

## TL;DR
Le code `119` est bien lié à la session (`_sid`) côté upload multipart. La variante fiable est: **`_sid` en query string** (`entry.cgi?...&_sid=...`) avec multipart normal (`name="file"`) ; `_sid` dans le formulaire seul ne suffit pas (119).  
Patch minimal appliqué dans `DsmClient.uploadFile()` + validation runtime complète OK (`createFolder -> upload -> rename -> delete`).

---

## 1) Reproduction minimale du 119
Script ajouté:
- `scripts/investigate-filestation-upload-119.js`

Résultat réel:

```json
{
  "results": [
    { "label": "A_no_sid", "success": false, "code": 119 },
    { "label": "B_sid_query_v2", "success": true, "code": null },
    { "label": "C_sid_form_v2", "success": false, "code": 119 },
    { "label": "D_sid_both_v2", "success": true, "code": null },
    { "label": "E_sid_query_v3", "success": true, "code": null }
  ]
}
```

Conclusion repro:
- ❌ sans `_sid` => `119`
- ❌ `_sid` uniquement en champ multipart => `119`
- ✅ `_sid` en query => OK (v2 et v3)

---

## 2) Variantes testées / variante fiable
Variantes comparées:
- structure multipart standard (`api`, `version`, `method`, `path`, `create_parents`, `overwrite`, `file`)
- placement `_sid` (absent / query / form / les deux)
- version API 2 vs 3

Variante fiable retenue:
- `POST /webapi/entry.cgi?_sid=<sid>`
- multipart `name="file"`
- `api=SYNO.FileStation.Upload`
- `method=upload`
- `version=2|3` (selon dispo API)

---

## 3) Patch appliqué
Fichier modifié:
- `nodes/shared/DsmClient.ts`

Changements:
1. **Auth recovery sur upload** (déjà présent dans ce cycle):
   - si upload renvoie `105/106/107/119`, relogin puis retry unique.
2. **Version upload dynamique**:
   - utilise `SYNO.FileStation.Upload.maxVersion` (cap à 3), fallback 2.
3. Conservation de la variante fiable:
   - `_sid` transmis en **query param** sur le POST multipart.

Impact: modif minimale, localisée à `uploadFile()`.

---

## 4) Validation runtime (flow complet)
Script ajouté:
- `scripts/runtime-filestation-upload-flow.js`

Flow exécuté dans dossier autorisé uniquement:
- `/OpenClaw/_archive/node-filestation-tests`

Résultat:
- ✅ `createFolder`
- ✅ `upload`
- ✅ `rename`
- ✅ `delete`

Extrait:
```json
{
  "success": true,
  "out": {
    "createFolder": { "success": true },
    "upload": { "success": true },
    "rename": { "success": true },
    "delete": { "success": true }
  }
}
```

Validation complémentaire session expirée:
- login -> logout (sid invalidé) -> `uploadFile()`
- ✅ upload réussi via relogin automatique.

---

## 5) Build + smoke
Commandes:
- `npm run build` ✅
- `npm run smoke` ✅

---

## 6) Notes opérationnelles
- Aucune opération destructive hors `/OpenClaw/_archive`.
- Aucun publish npm.
- Pour diagnostiquer d’éventuels cas restants: vérifier proxy/WAF qui pourrait strip la query `_sid` sur multipart POST.
