# Probe Synology Download Station API — 2026-03-11

## Contexte
- Cible: `https://darknas.tail91a2f7.ts.net:7894`
- Source creds: `skills/synology-download-station/.env` (utilisés, non exposés)
- Contraintes respectées: **read-only uniquement**, aucune opération destructive/écriture.

---

## 1) Découverte endpoints via `SYNO.API.Info`
Requête utilisée (sans auth, OK):

```http
GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all
```

### Endpoints `SYNO.DownloadStation2.*` détectés (43 APIs DownloadStation total, dont 36 en `DownloadStation2`)

| API | min | max | path |
|---|---:|---:|---|
| SYNO.DownloadStation2.BTSearch | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Captcha | 1 | 2 | entry.cgi |
| SYNO.DownloadStation2.Package.Info | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Package.Module | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Package.Service | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.RSS.Feed | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.RSS.Filter | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.RSS.Item | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.AutoExtraction | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.BT | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.BTSearch | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Emule | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Emule.Location | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.FileHosting | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Settings.FtpHttp | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Global | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Settings.Location | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Nzb | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Rss | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Settings.Scheduler | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Task | 1 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.BT | 1 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.BT.File | 1 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.BT.Peer | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.BT.Tracker | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.Complete | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Task.List | 1 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.List.Polling | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.NZB.File | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Task.NZB.Log | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Task.Source | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.Task.Statistic | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Task.eMule | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.Thumbnail | 2 | 2 | entry.cgi |
| SYNO.DownloadStation2.eMule.Search | 1 | 1 | entry.cgi |
| SYNO.DownloadStation2.eMule.Server | 1 | 1 | entry.cgi |

> Legacy dispo aussi: `SYNO.DownloadStation.Task`, `.Statistic`, `.BTSearch`, etc. (paths dédiés `DownloadStation/*.cgi`).

---

## 2) Tests read-only prioritaires

## 2.1 Auth (bloquant)
Tentative login:

```http
GET /webapi/entry.cgi
  ?api=SYNO.API.Auth
  &version=7
  &method=login
  &account=<user>
  &passwd=<pass>
  &session=DownloadStation
  &format=sid
```

Résultat:
```json
{"success":false,"error":{"code":407}}
```

Même résultat en `version=6`.

En `version=3`:
```json
{"success":false,"error":{"code":400}}
```

➡️ **Aucun SID valide obtenu** dans ce probe. Les appels read-only authentifiés ne peuvent pas être validés fonctionnellement sans corriger l’auth.

### Hypothèse principale
- `407` sur Auth v6/v7 est typiquement lié à une étape supplémentaire d’auth (2FA/OTP/challenge/device token) ou politique de compte.

---

## 2.2 Task list / status / BT search (résultats observés sans SID valide)

### DS2 via `entry.cgi`
| API | method | params min testés | Résultat |
|---|---|---|---|
| SYNO.DownloadStation2.Task.List | list | `offset=0&limit=5` | `code=103` |
| SYNO.DownloadStation2.Task | list | `offset=0&limit=5` | `code=119` |
| SYNO.DownloadStation2.Task.Statistic | get | *(none)* | `code=119` |
| SYNO.DownloadStation2.BTSearch | list | *(none)* | `code=119` |
| SYNO.DownloadStation2.BTSearch | start | `keyword=ubuntu` | `code=119` |

### Legacy DS1 via `entry.cgi`
| API | method | params min testés | Résultat |
|---|---|---|---|
| SYNO.DownloadStation.Task | list | `offset=0&limit=5` | `code=102` |
| SYNO.DownloadStation.Statistic | get | *(none)* | `code=102` |
| SYNO.DownloadStation.BTSearch | list | *(none)* | `code=102` |
| SYNO.DownloadStation.BTSearch | start | `keyword=ubuntu` | `code=102` |

### Legacy DS1 via path dédié (`/webapi/DownloadStation/*.cgi`)
| Endpoint | API/method | Résultat |
|---|---|---|
| `/DownloadStation/task.cgi` | `SYNO.DownloadStation.Task/list` | `code=105` |
| `/DownloadStation/statistic.cgi` | `SYNO.DownloadStation.Statistic/get` | `code=103` |
| `/DownloadStation/btsearch.cgi` | `SYNO.DownloadStation.BTSearch/list` | `code=105` |
| `/DownloadStation/btsearch.cgi` | `SYNO.DownloadStation.BTSearch/start` | `code=105` |

---

## 3) Méthodes/params: ce qui marche vs erreurs

## Marche
- `SYNO.API.Info` query global (sans auth) via `query.cgi`.
- Découverte complète des familles DownloadStation / DownloadStation2.

## Ne marche pas (dans ce contexte)
- Login `SYNO.API.Auth` v7/v6 pour obtenir SID (`code=407`).
- Tous les appels read-only DownloadStation nécessitant session valide (codes observés: 102/103/105/119 selon API/path).

---

## 4) Scope v1 proposé pour node n8n `Synology Download Station`

### Objectif v1 (safe + utile)
1. **Task List** (read-only)
2. **Task Statistics** (read-only)
3. **Task Details/Status** (read-only; via `id` ou enrichissement selon API dispo)
4. **BT Search** (read-only: start/list result)

### Opérations v1 recommandées
- `task.list`
- `task.stats`
- `task.get` (si supporté via `Task` ou `Task.List` + filtre id)
- `bt.searchStart`
- `bt.searchList`

### Paramètres v1 recommandés
- communs: `baseUrl`, `username`, `password`, `verifySSL`, `sessionName` (default `DownloadStation`)
- `task.list`: `offset` (0), `limit` (20), `additional` (optionnel)
- `task.get`: `id` (string, requis)
- `bt.searchStart`: `keyword` (requis), `module` (optionnel)
- `bt.searchList`: `taskid` / `offset` / `limit` (selon comportement API réel une fois auth OK)

### Gestion d’erreurs DSM (important n8n)
- Remonter `error.code` DSM brut + message contextualisé n8n.
- Catégories:
  - `AUTH_REQUIRED` / `AUTH_FAILED` (ex: 102, 103, 105, 407)
  - `INVALID_PARAMETER` (ex: 119, 400)
  - `UNSUPPORTED_METHOD_OR_VERSION`
- Option `Continue On Fail` compatible n8n.

---

## 5) Payloads minimaux (exemples)

## 5.1 Discovery
```http
GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all
```

## 5.2 Login (pré-requis)
```http
GET /webapi/entry.cgi
  ?api=SYNO.API.Auth
  &version=7
  &method=login
  &account=<username>
  &passwd=<password>
  &session=DownloadStation
  &format=sid
```

## 5.3 Task list (DS2)
```http
GET /webapi/entry.cgi
  ?api=SYNO.DownloadStation2.Task.List
  &version=2
  &method=list
  &offset=0
  &limit=20
  &_sid=<sid>
```

## 5.4 Task statistics (DS2)
```http
GET /webapi/entry.cgi
  ?api=SYNO.DownloadStation2.Task.Statistic
  &version=1
  &method=get
  &_sid=<sid>
```

## 5.5 BT search start/list (DS2)
```http
GET /webapi/entry.cgi
  ?api=SYNO.DownloadStation2.BTSearch
  &version=1
  &method=start
  &keyword=ubuntu
  &_sid=<sid>
```

```http
GET /webapi/entry.cgi
  ?api=SYNO.DownloadStation2.BTSearch
  &version=1
  &method=list
  &_sid=<sid>
```

---

## Recommandation immédiate avant implémentation n8n
1. **Débloquer l’auth SID** (investiguer `code=407`):
   - vérifier 2FA/challenge sur compte `OpenClaw`
   - tester `otp_code` si requis
   - vérifier policy DSM (IP/device trust)
2. Rejouer la matrice read-only avec SID valide.
3. Geler les paramètres exacts (notamment BT search list/pagination) selon réponses réelles.

---

## Conclusion courte
- Discovery API: ✅ complet
- Read-only runtime tests: ❌ bloqués par auth (`407`)
- Scope n8n v1 proposé: ✅ prêt (liste/stats/status/bt-search), à valider dès que login SID est opérationnel.
