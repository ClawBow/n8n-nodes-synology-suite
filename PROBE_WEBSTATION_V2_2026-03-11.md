# PROBE WebStation API v2 — 2026-03-11

## Contexte & garde-fous
- Cible DSM: `https://darknas.tail91a2f7.ts.net:7894`
- Mission: **probe non destructif** pour préparer un node n8n WebStation
- Contraintes respectées: **aucun write/delete/restart** (DSM)
- Sources utilisées:
  1) Probe live read-only (sans SID et test auth)
  2) Historique authentifié `API_PROBE_RESULTS.json` (repo)

---

## 1) Discovery `SYNO.WebStation.*`

Découverte via:
- `GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all`
- filtrage local sur préfixe `SYNO.WebStation`

Résultat: **18 APIs** exposées (toutes `path=entry.cgi`, `minVersion=1`, `maxVersion=1`)

- SYNO.WebStation.Backup
- SYNO.WebStation.Default
- SYNO.WebStation.Docker
- SYNO.WebStation.ErrorPage
- SYNO.WebStation.HTTP.VHost
- SYNO.WebStation.PHP
- SYNO.WebStation.PHP.Profile
- SYNO.WebStation.Package
- SYNO.WebStation.Python
- SYNO.WebStation.Python.Profile
- SYNO.WebStation.ScriptLanguage
- SYNO.WebStation.ScriptLanguage.Utils
- SYNO.WebStation.Shortcut
- SYNO.WebStation.Status
- SYNO.WebStation.Task
- SYNO.WebStation.WebService.Portal
- SYNO.WebStation.WebService.Portal.Log
- SYNO.WebStation.WebService.Service

---

## 2) Tests lecture/observabilité (list/info/status/config/read)

## 2.1 Probe live read-only (sans SID)
Méthodes testées: `list`, `info`, `status`, `config`, `get`, `query`, `read`

Pattern observé:
- `103` = méthode inexistante
- `119` = SID/session requis (méthode probablement reconnue côté API)

Synthèse live:
- `info`, `status`, `config`, `query`, `read` => **103 sur 18/18 APIs**
- `list` => **119 sur 11 APIs**, `103` sur 7 APIs
- `get` => **119 sur 7 APIs**, `103` sur 11 APIs

Interprétation:
- Le signal utile pour WebStation est surtout sur `list`/`get`.
- `config` ne paraît pas être une méthode publique uniforme dans cette famille (103 partout).

## 2.2 Test auth actuel
Tentatives `SYNO.API.Auth` (v7/v6/v3/v2, sessions `FileStation`/`DownloadStation`/`WebStation`/`Core`) :
- résultat dominant: **401** (auth refusée)
- donc pas de SID exploitable actuellement dans ce run

## 2.3 Historique authentifié (`API_PROBE_RESULTS.json`)
Sur les mêmes APIs WebStation (probe antérieur avec SID valide):
- pas de `success` sur méthodes read candidates
- beaucoup de `105` (insufficient privilege) sur `list` et/ou `get`
- `103` fréquent sur méthodes non supportées

Conclusion croisée:
- **Sans SID**: on voit `119` (session requise)
- **Avec SID historique**: on voit `105` (droits insuffisants)
- Donc le blocage principal pour de la vraie lecture métier est **permission WebStation manager/admin**.

---

## 3) Méthodes dispo + limitations permissions

## 3.1 Matrice API → méthode (lecture)
Légende:
- `KO:119` = session requise
- `KO:105` = privilèges insuffisants (historique authentifié)
- `KO:103` = méthode non existante

- `SYNO.WebStation.Backup` → list:`119` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Default` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Docker` → list:`103` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.ErrorPage` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.HTTP.VHost` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.PHP` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.PHP.Profile` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Package` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Python` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Python.Profile` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.ScriptLanguage` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.ScriptLanguage.Utils` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Shortcut` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Status` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.Task` → list:`119` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.WebService.Portal` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.WebService.Portal.Log` → list:`103` / get:`119` / info:`103` / status:`103` / config:`103` / read:`103`
- `SYNO.WebStation.WebService.Service` → list:`119` / get:`103` / info:`103` / status:`103` / config:`103` / read:`103`

## 3.2 Paramètres minimaux observés
Pour toutes ces APIs:
- `api=<SYNO.WebStation.*>`
- `version=1`
- `method=<list|get|...>`
- endpoint: `/webapi/entry.cgi`
- `&_sid=<sid>` requis pour dépasser `119`

Pour discovery:
- endpoint `/webapi/query.cgi`
- `api=SYNO.API.Info&version=1&method=query&query=all`

## 3.3 Limites permissions
- Auth actuelle: `401` (pas de SID dans ce run)
- Historique avec SID: `105` sur WebStation read
- Donc permissions du compte de service insuffisantes pour observabilité WebStation utile.

---

## 4) Matrice OK/KO + params minimaux (v1 décisionnelle)

## OK (faisable immédiatement)
- Discovery des APIs WebStation via `SYNO.API.Info query=all`
- Probe de capacité read-only (diagnostic) retournant `103/119/105`
- Diagnostics auth/session/permissions structurés

## KO (dans l’état actuel des droits)
- Lecture métier réelle WebStation (inventaire vhost/services/status runtime)
- Toute opération mutable (hors scope + interdite ici)

---

## 5) Scope proposé pour node n8n v1 (safe)

### v1 recommandé
1. `WebStation → Discover APIs`
   - retour: liste des `SYNO.WebStation.*` + versions/path

2. `WebStation → Probe Read Capability`
   - teste `list/get/info/status/config/read`
   - classifie par méthode: `unsupported(103)`, `sessionRequired(119)`, `permissionDenied(105)`, `authFailed(401)`

3. `WebStation → Test Auth`
   - endpoint dédié diagnostic login
   - remonte code DSM + message lisible n8n

### Hors v1 (conditionnel)
- `List VHosts`, `List Services/Portals`, `Get Runtime Status` **uniquement** si permissions admin WebStation confirmées.

---

## 6) Reco d’implémentation rapide
- Ne pas échouer en erreur brute sur `105/119/401` ; renvoyer un JSON de diagnostic exploitable dans les workflows.
- Garder un mode `readOnly=true` par défaut côté node WebStation.
- Mapper codes DSM dans le node:
  - `103` méthode absente
  - `105` privilèges insuffisants
  - `119` session requise/invalide
  - `401` auth refusée

---

## Verdict
- Discovery WebStation: ✅
- Tests read/observabilité non destructifs: ✅
- Méthodes dispo + limites permissions documentées: ✅
- Matrice OK/KO + params minimaux: ✅
- Scope n8n v1 safe proposé: ✅
