# PROBE Docker DSM API — 2026-03-11

## Scope
Probe **non destructif** des endpoints `SYNO.Docker.*` pour préparer un node n8n v1.

Objectifs couverts:
1. Discovery `SYNO.Docker.*`
2. Tests read-only (containers/images/projects/networks/log/resource)
3. Zéro action destructive
4. Matrice OK/KO + erreurs DSM + params minimaux
5. Priorité scope node v1

---

## Méthodo

### A) Tentative live (aujourd’hui)
- Outil: `skills/synology-api-discovery/scripts/syno_cli.py`
- Résultat: **échec auth**
  - login via `.env` skill => `error.code=400`
  - login via env runtime `SYNO_DSM_*` (script Python direct) => `error.code=401`
- Impact: impossible de refaire un probe live complet aujourd’hui sans credentials/session valides.

### B) Fallback fiable (dernier probe complet disponible)
- Source: `API_PROBE_RESULTS.json`
- Timestamp: `2026-02-18T12:29:39.322287+00:00`
- Contexte: mode safe (`allowDestructive=false`), méthode candidates incluant read-only + méthodes destructives **skippées**.

---

## 1) Discovery endpoints `SYNO.Docker.*`

Endpoints découverts dans DSM (12):

1. `SYNO.Docker.Container` (v1)
2. `SYNO.Docker.Container.Log` (v1)
3. `SYNO.Docker.Container.PkgProfile` (v1)
4. `SYNO.Docker.Container.Profile` (v1)
5. `SYNO.Docker.Container.Resource` (v1)
6. `SYNO.Docker.Image` (v1)
7. `SYNO.Docker.Log` (v1)
8. `SYNO.Docker.Migrate` (v1)
9. `SYNO.Docker.Network` (v1)
10. `SYNO.Docker.Project` (v1)
11. `SYNO.Docker.Registry` (v2 max)
12. `SYNO.Docker.Utils` (v1)

Tous exposés sur `path=entry.cgi` dans ce probe.

---

## 2) Tests read-only (priorité node v1)

### Cible v1 demandée
- Containers: `SYNO.Docker.Container`
- Images: `SYNO.Docker.Image`
- Projects: `SYNO.Docker.Project`
- Networks: `SYNO.Docker.Network`
- Logs: `SYNO.Docker.Container.Log` / `SYNO.Docker.Log`
- Resource: `SYNO.Docker.Container.Resource`

### Résultat global
- **Aucun call read-only en succès** dans le probe disponible.
- Cause dominante: **droits insuffisants (`error 105`)** sur les méthodes qui semblent pertinentes (`get`, `list` selon API).
- Les autres méthodes testées (`query/info/status/search/read`) retournent majoritairement **`error 103` (method does not exist)**.

---

## 3) Matrice OK/KO (node v1)

| Capability v1 | API | Méthode candidate | Statut | Détail DSM |
|---|---|---|---|---|
| List containers | `SYNO.Docker.Container` | `list` | KO | `105` insufficient privilege |
| Get container | `SYNO.Docker.Container` | `get` | KO | `105` insufficient privilege |
| Container logs | `SYNO.Docker.Container.Log` | `get` | KO | `105` insufficient privilege |
| Container resource | `SYNO.Docker.Container.Resource` | `get` | KO | `105` insufficient privilege |
| List images | `SYNO.Docker.Image` | `list` | KO | `105` insufficient privilege |
| Get image | `SYNO.Docker.Image` | `get` | KO | `105` insufficient privilege |
| List projects | `SYNO.Docker.Project` | `list` | KO | `105` insufficient privilege |
| Get project | `SYNO.Docker.Project` | `get` | KO | `105` insufficient privilege |
| List networks | `SYNO.Docker.Network` | `list` | KO | `105` insufficient privilege |
| Get network | `SYNO.Docker.Network` | `get` | KO | `105` insufficient privilege |
| Docker log feed (global) | `SYNO.Docker.Log` | `list` | KO | `105` insufficient privilege |

> Lecture: KO ici = KO **permissionnel** (pas KO technique de transport). HTTP=200 mais JSON `success=false`.

---

## 4) Erreurs DSM observées (Docker)

- `105`: **Insufficient privilege** (bloquant principal)
- `103`: **Method does not exist** (sur méthodes génériques non supportées par l’API)

Pas de `101` (missing parameter) sur ces endpoints Docker dans le dataset utilisé, donc rien n’indique un simple manque de paramètre côté méthodes testées.

---

## 5) Paramètres minimaux (déduits)

Pour les méthodes Docker candidates testées:
- Requis minimum: `api`, `version`, `method`, `_sid`
- URL: `/webapi/entry.cgi`

Exemple minimal:
```http
GET /webapi/entry.cgi?api=SYNO.Docker.Container&version=1&method=list&_sid=<SID>
```

État actuel: même avec ces paramètres minimaux, la réponse retourne `105` (droits), donc le blocage n’est pas lié aux paramètres.

---

## 6) Contrainte sécurité / non-destruction

✅ Respecté:
- Aucune méthode destructive exécutée (`start/create/update/set/delete/run/stop/write`)
- Probe orienté read-only uniquement

---

## Conclusion opérationnelle (pour node n8n v1)

- **Faisabilité technique API**: endpoints Docker existent bien (`SYNO.Docker.*` découvert).
- **Faisabilité immédiate côté compte actuel**: **NON** (permissions insuffisantes `105`).
- **Action nécessaire avant implémentation v1**:
  1. Obtenir un compte DSM avec privilèges Docker/Container Manager adaptés (lecture au minimum).
  2. Refaire le probe live (mêmes tests) pour confirmer les méthodes réellement exploitables (`list/get` par ressource).

Sans montée de privilèges, le node Docker v1 restera KO en exécution réelle.

---

## Artefacts utilisés
- `/root/.openclaw/workspace/n8n-nodes-synology-suite/API_PROBE_RESULTS.json`
- Tentatives live 2026-03-11 (auth failures):
  - `syno_cli.py list --prefix SYNO.Docker` => code 400
  - script Python direct via `SYNO_DSM_*` => code 401
