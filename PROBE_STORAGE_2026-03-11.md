# PROBE_STORAGE_2026-03-11

## Scope
- Probe **non-destructif** des APIs `SYNO.Storage.*` pour préparation node n8n v1.
- Objectif: discovery + tests read-only (pools/volumes/disks/health/status/info) sans aucune action de modification.
- Cible DSM: `https://darknas.tail91a2f7.ts.net:7894`
- Date (UTC): 2026-03-11

## Méthodo
1. Discovery via `SYNO.API.Info` (`method=query`, `query=all`) **sans SID**.
2. Test auth SID (login `SYNO.API.Auth`, v7) avec creds runtime (`SYNO_DSM_USER/SYNO_DSM_PASS`) pour vérifier faisabilité des appels authentifiés.
3. Probes read-only sur `SYNO.Storage.*`:
   - Méthodes testées: `list`, `get`, `query`, `info`, `status`, `health` (et sur core APIs: `read`, `search`, `load`, `overview`, `summary`, `monitor`).
   - Params minimaux: `{}` puis `{"id":"0"}` (quand applicable).
4. Aucune méthode destructive appelée.

## Résultat global
- Discovery `SYNO.Storage.*`: **OK**
- Login SID: **KO** (`error.code=401`)
- Conséquence: appels read-only authentifiés non validables de bout en bout dans cette session.

## 1) Discovery endpoints `SYNO.Storage.*`
`SYNO.API.Info` retourne **22 APIs** Storage exposées:

- `SYNO.Storage.CGI.BtrfsDedupe` (entry.cgi, v1)
- `SYNO.Storage.CGI.Cache.Protection` (entry.cgi, v1)
- `SYNO.Storage.CGI.Check` (entry.cgi, v1)
- `SYNO.Storage.CGI.DetectedPool` (entry.cgi, v1)
- `SYNO.Storage.CGI.DualEnclosure` (entry.cgi, v1)
- `SYNO.Storage.CGI.Enclosure` (entry.cgi, v1)
- `SYNO.Storage.CGI.EncryptionKeyVault` (entry.cgi, v1)
- `SYNO.Storage.CGI.EncryptionKeyVault.UnlockMode` (entry.cgi, v1)
- `SYNO.Storage.CGI.Flashcache` (entry.cgi, v1)
- `SYNO.Storage.CGI.HddMan` (entry.cgi, v1)
- `SYNO.Storage.CGI.KMIP` (entry.cgi, v1)
- `SYNO.Storage.CGI.Pool` (entry.cgi, v1)
- `SYNO.Storage.CGI.Scrubbing` (entry.cgi, v1)
- `SYNO.Storage.CGI.Smart` (entry.cgi, v1)
- `SYNO.Storage.CGI.Smart.Scheduler` (entry.cgi, v1)
- `SYNO.Storage.CGI.Spare` (entry.cgi, v1)
- `SYNO.Storage.CGI.Spare.Conf` (entry.cgi, v1)
- `SYNO.Storage.CGI.Storage` (entry.cgi, v1)
- `SYNO.Storage.CGI.TaipeiEnclosure` (entry.cgi, v1)
- `SYNO.Storage.CGI.Volume` (entry.cgi, v1)
- `SYNO.Storage.CGI.Volume.Installer` (entry.cgi, v1)
- `SYNO.Storage.CGI.Volume.OfflineOp` (entry.cgi, v1)

## 2) Matrice OK/KO (scope node v1 priorisé)
Légende:
- **OK** = `success=true`
- **KO(119)** = SID requis/invalid (méthode probablement existante, auth manquante)
- **KO(103)** = méthode inexistante pour cette API/version

### Core v1 (priorité)

- `SYNO.Storage.CGI.Storage`
  - `info` -> KO(103), params minimaux: `{}`
  - `status` -> KO(103), params minimaux: `{}`
  - `query` -> KO(103), params minimaux: `{}`

- `SYNO.Storage.CGI.Pool`
  - `list` -> KO(103), params minimaux: `{}`
  - `get` -> KO(103), params minimaux: `{}` / `{"id":"0"}`
  - `status` -> KO(103), params minimaux: `{}`
  - `info` -> KO(103), params minimaux: `{}`

- `SYNO.Storage.CGI.Volume`
  - `list` -> KO(103), params minimaux: `{}`
  - `get` -> KO(103), params minimaux: `{}` / `{"id":"0"}`
  - `status` -> KO(103), params minimaux: `{}`
  - `info` -> KO(103), params minimaux: `{}`

- `SYNO.Storage.CGI.HddMan` (disks)
  - `get` -> **KO(119)**, params minimaux: `{}`
  - `list` -> KO(103), params minimaux: `{}`
  - `status` -> KO(103), params minimaux: `{}`
  - `info` -> KO(103), params minimaux: `{}`

- `SYNO.Storage.CGI.Smart` (health)
  - `list` -> **KO(119)**, params minimaux: `{}`
  - `health` -> KO(103), params minimaux: `{}`
  - `status` -> KO(103), params minimaux: `{}`
  - `info` -> KO(103), params minimaux: `{}`

- `SYNO.Storage.CGI.Check`
  - `status` -> KO(103), params minimaux: `{}`
  - `get` -> KO(103), params minimaux: `{}`
  - `list` -> KO(103), params minimaux: `{}`

### Agrégat Storage (22 APIs x 6 méthodes read-only testées)
- Total appels: 132
- `KO(103)`: 125
- `KO(119)`: 7
- `OK`: 0

Interprétation:
- Les APIs existent (discovery OK), mais les couples `API+method` “génériques” sont rarement valides.
- Les occurrences `119` indiquent des méthodes probablement correctes mais bloquées sans SID valide.

## 3) Erreurs observées
- `401` (auth login): identifiants/session non acceptés pour obtenir SID.
- `119`: SID absent/invalide.
- `103`: méthode non disponible sur API/version ciblée.

## 4) Reco pour implémentation node v1
1. **Bloquant principal**: rétablir login SID (service account + droits Storage Manager read-only).
2. Après SID OK, lancer une passe “method discovery ciblée” sur:
   - `SYNO.Storage.CGI.HddMan` (point de départ: `get`)
   - `SYNO.Storage.CGI.Smart` (point de départ: `list`)
   - puis `Pool` / `Volume` avec dictionnaire de méthodes DSM réelles (pas seulement `list/get/info/status`).
3. Garder la policy non-destructive stricte (pas de `create/set/update/delete/run/start/stop`).

## Artifacts de probe
- JSON brut principal: `n8n-nodes-synology-suite/tmp_storage_probe.json`
- JSON core methods: `n8n-nodes-synology-suite/tmp_storage_probe_core_methods.json`

