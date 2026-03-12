# PROBE WebStation API — 2026-03-11

## Contexte
- Cible: DSM `darknas` via `https://darknas.tail91a2f7.ts.net:7894`
- Scope: famille `SYNO.WebStation.*`
- Contraintes respectées: **read-only / observabilité uniquement** (aucun write/delete/restart)

---

## 1) Découverte endpoints via `SYNO.API.Info`

### Méthode utilisée
- Requête directe non destructive:
  - `GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all`
- Filtrage local sur préfixe `SYNO.WebStation`

### Résultat
`SYNO.API.Info` expose **18 APIs WebStation** (toutes en `path=entry.cgi`, `minVersion=1`, `maxVersion=1`, `requestFormat=JSON`):

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

> Note: `query=SYNO.WebStation.*` retourne vide sur ce DSM; `query=all` + filtrage local fonctionne.

---

## 2) Tests non destructifs (info/list/status/config read)

## 2.1 Test live actuel (sans SID)
- Probing de méthodes candidates read-only (`info`, `list`, `status`, `config`, `get`, `query`, `read`) sur les 18 APIs.
- Résultats dominants:
  - `103` = méthode inexistante
  - `119` = session/SID invalide ou manquante

Observation: plusieurs APIs répondent `119` sur `list` ou `get`, ce qui indique que la méthode est probablement reconnue mais nécessite session/auth.

## 2.2 Historique probe authentifié (ACTIONS_MATRIX existant)
Source: `n8n-nodes-synology-suite/ACTIONS_MATRIX.json` (généré 2026-02-18)

Sur WebStation:
- Aucun `success` observé
- `errorCode=105` (insufficient privilege) fréquent sur `list` et/ou `get`
- `errorCode=103` sur méthodes non supportées

Exemples (profil historique):
- `SYNO.WebStation.Backup.list -> 105`
- `SYNO.WebStation.HTTP.VHost.list -> 105`
- `SYNO.WebStation.Task.get -> 105`
- `SYNO.WebStation.Status.get -> 105`

Conclusion opérationnelle: même avec session valide (historique), le compte de service n’a pas les droits WebStation manager/admin nécessaires pour lecture utile.

---

## 3) Paramètres minimums + limites permissions

## 3.1 Paramètres minimums observés
- Tronc commun DSM:
  - `api`
  - `version=1` (pour WebStation)
  - `method`
  - `path=entry.cgi`
- Pour appels métier WebStation:
  - `&_sid=<sid>` requis en pratique (sinon `119`)

## 3.2 Limites permissions observées
- **Login actuel échoue** sur ce contexte (`SYNO.API.Auth` v7 et fallback v6): `error code 407`.
- Historique authentifié: appels WebStation read tombent en `105` (insufficient privilege).

Impact:
- Impossible de confirmer/mapper finement les paramètres métier obligatoires (ceux testables seulement après autorisation) tant que le compte n’a pas privilèges WebStation.

---

## 4) Proposition scope v1 node n8n WebStation

Vu les droits actuels, proposer un v1 **safe & utile** orienté discovery/diagnostic:

## v1 recommandé (MVP)
1. **Discover APIs**
   - Action: `listWebStationApis`
   - Impl: `SYNO.API.Info query=all` + filtre `SYNO.WebStation.*`
   - Pas besoin de privilèges WebStation spécifiques.

2. **Probe capability (read-only dry probe)**
   - Action: `probeWebStationReadMethods`
   - Tente `list/get/status/info` par API
   - Retourne matrice `supported/unsupported/permissionDenied/sessionRequired`
   - Objectif: diagnostic de droits environnement.

3. **Auth diagnostics**
   - Action: `testAuthWebStation`
   - Vérifie login DSM + expose code d’erreur normalisé (`407`, `105`, `119`, etc.)
   - Très utile pour support n8n.

## v1.1+ (si droits étendus)
- Lire réellement:
  - Virtual hosts (`HTTP.VHost`)
  - Services/portals (`WebService.Service`, `WebService.Portal`)
  - Runtime/status (`Status`, `Task`)
- Ajouter opérations mutables **uniquement** dans versions ultérieures avec guardrails explicites.

---

## 5) Recommandations d’implémentation n8n

1. **Ne pas bloquer le node sur absence de droits**: retourner un diagnostic structuré plutôt qu’une erreur brute.
2. **Mapper les codes DSM** en messages n8n clairs:
   - `103`: méthode absente
   - `105`: privilèges insuffisants
   - `119`: session invalide/manquante
   - `407`: auth refusée (contexte/login policy)
3. **Sortie JSON standardisée** (par API/méthode):
   - `api`, `method`, `httpStatus`, `success`, `errorCode`, `note`, `requiresSid`, `permissionState`
4. **Feature flag read-only** par défaut sur WebStation tant que les accès admin ne sont pas validés.

---

## Verdict
- Découverte endpoint WebStation: ✅ faite (18 APIs)
- Tests non destructifs: ✅ faits (live + historique)
- Paramètres minimums: ✅ identifiés au niveau protocolaire
- Limites permissions: ✅ clairement bloquantes (`407`, `105`, `119`)
- Scope v1 n8n proposé: ✅ (discovery + diagnostics avant read business)
