# SynologyDownloadStation2 v1 — Implémentation & tests (2026-03-11)

## Objectif
Implémenter un node n8n **read-first** `SynologyDownloadStation2` sans actions destructives.

---

## 1) Implémentation réalisée

### Nouveau node
- Fichier créé: `nodes/SynologyDownloadStation2/SynologyDownloadStation2.node.ts`
- Icône créée: `nodes/SynologyDownloadStation2/synology-downloadstation2.svg`

### Opérations exposées (read-first)
- `listTasks`
- `getTask` (paramètre `taskId`)
- `listBtSearchResults` (paramètres `keyword`, `offset`, `limit`)
- `listRssFeeds` (si endpoint dispo)
- `getPackageInfo`
- `customReadCall` (whitelist explicite)

### Détails techniques
- Fallback multi-API via `callAny` entre familles:
  - `SYNO.DownloadStation2.*`
  - `SYNO.DownloadStation.*`
- Gestion d’erreurs DSM contextualisée (notamment `401`, `407`, `102`, `103`, `105`, `106`, `107`, `119`).

---

## 2) Sécurité read-only (customReadCall)

### Whitelist API
- Autorisé uniquement si préfixe:
  - `SYNO.DownloadStation2.`
  - `SYNO.DownloadStation.`

### Blocage méthodes destructives
Bloquées par pattern (case-insensitive):
- `create`, `add`, `upload`, `edit`, `update`, `set`
- `delete`, `remove`
- `pause`, `resume`
- `start`, `stop`
- `clear`, `clean`, `move`, `rename`, `force_*`

> Résultat: `customReadCall` reste borné à des méthodes de lecture.

---

## 3) Intégration package

### `package.json`
- `scripts.copy:assets`: ajout copie assets `SynologyDownloadStation2` (svg/png)
- `n8n.nodes`: ajout
  - `dist/nodes/SynologyDownloadStation2/SynologyDownloadStation2.node.js`
- `keywords`: ajout
  - `downloadstation`, `downloadstation2`, `torrent`, `rss`

### Smoke
- `scripts/smoke-check.sh` mis à jour pour vérifier:
  - `dist/nodes/SynologyDownloadStation2/SynologyDownloadStation2.node.js`

---

## 4) Build + smoke

Exécuté dans `/root/.openclaw/workspace/n8n-nodes-synology-suite`:

- `npm run build` ✅
- `npm run smoke` ✅

Artifacts présents:
- `dist/nodes/SynologyDownloadStation2/SynologyDownloadStation2.node.js`
- `dist/nodes/SynologyDownloadStation2/synology-downloadstation2.svg`

---

## 5) Runtime read-only NAS (compte OpenClaw)

Test runtime effectué en read-only via `DsmClient` sur endpoints cibles du node.
Source creds: `skills/synology-download-station/.env` (non exposés).

### Résultats
- `login` → ❌ `code=401`
- `listTasks` → ❌ bloqué par login (`401`)
- `getTask` → ❌ bloqué par login (`401`)
- `listBtSearchResults` → ❌ bloqué par login (`401`)
- `listRssFeeds` → ❌ bloqué par login (`401`)
- `getPackageInfo` → ❌ bloqué par login (`401`)

### Interprétation
- Le node compile et s’exécute, mais le **runtime DSM est bloqué en auth** avec ces credentials/politiques actuelles.
- Aucune action d’écriture n’a été tentée.

---

## 6) Contraintes respectées
- ✅ Aucun create/delete/pause/resume de tâche implémenté dans les opérations standards.
- ✅ `customReadCall` borné + méthodes destructives bloquées.
- ✅ Modifs minimales (nouveau node + asset + package/smoke).
- ✅ Pas de publication npm.

---

## Fichiers touchés
- `nodes/SynologyDownloadStation2/SynologyDownloadStation2.node.ts` (créé)
- `nodes/SynologyDownloadStation2/synology-downloadstation2.svg` (créé)
- `package.json` (intégration node/assets/keywords)
- `scripts/smoke-check.sh` (smoke export check)
