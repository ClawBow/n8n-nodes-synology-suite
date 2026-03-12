# Probe non-destructif — DownloadStation2 vs DownloadStation (2026-03-11)

## Périmètre & garde-fous
- Cible DSM: `https://darknas.tail91a2f7.ts.net:7894`
- Discovery: `SYNO.API.Info` via `query.cgi`
- **Strictement read-only**: uniquement `query/list/get/status/getinfo`.
- **Aucune** création/suppression/modification de tâche (pas de `create/delete/pause/resume/edit`).

---

## 1) Inventaire API via `SYNO.API.Info`
Requête:

```http
GET /webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=all
```

Résultat: **43 APIs** liées à DownloadStation
- **DownloadStation (legacy)**: 7
- **DownloadStation2**: 36

### A. Famille legacy `SYNO.DownloadStation.*` (7)
- `SYNO.DownloadStation.BTSearch` (1-1) → `DownloadStation/btsearch.cgi`
- `SYNO.DownloadStation.Info` (1-2) → `DownloadStation/info.cgi`
- `SYNO.DownloadStation.RSS.Feed` (1-1) → `DownloadStation/RSSfeed.cgi`
- `SYNO.DownloadStation.RSS.Site` (1-1) → `DownloadStation/RSSsite.cgi`
- `SYNO.DownloadStation.Schedule` (1-1) → `DownloadStation/schedule.cgi`
- `SYNO.DownloadStation.Statistic` (1-1) → `DownloadStation/statistic.cgi`
- `SYNO.DownloadStation.Task` (1-3) → `DownloadStation/task.cgi`

### B. Famille `SYNO.DownloadStation2.*` (36)
- `SYNO.DownloadStation2.BTSearch` (1-1)
- `SYNO.DownloadStation2.Captcha` (1-2)
- `SYNO.DownloadStation2.Package.Info` (2-2)
- `SYNO.DownloadStation2.Package.Module` (2-2)
- `SYNO.DownloadStation2.Package.Service` (2-2)
- `SYNO.DownloadStation2.RSS.Feed` (1-1)
- `SYNO.DownloadStation2.RSS.Filter` (1-1)
- `SYNO.DownloadStation2.RSS.Item` (1-1)
- `SYNO.DownloadStation2.Settings.AutoExtraction` (1-1)
- `SYNO.DownloadStation2.Settings.BT` (1-1)
- `SYNO.DownloadStation2.Settings.BTSearch` (1-1)
- `SYNO.DownloadStation2.Settings.Emule` (1-1)
- `SYNO.DownloadStation2.Settings.Emule.Location` (1-1)
- `SYNO.DownloadStation2.Settings.FileHosting` (2-2)
- `SYNO.DownloadStation2.Settings.FtpHttp` (1-1)
- `SYNO.DownloadStation2.Settings.Global` (2-2)
- `SYNO.DownloadStation2.Settings.Location` (1-1)
- `SYNO.DownloadStation2.Settings.Nzb` (1-1)
- `SYNO.DownloadStation2.Settings.Rss` (1-1)
- `SYNO.DownloadStation2.Settings.Scheduler` (1-1)
- `SYNO.DownloadStation2.Task` (1-2)
- `SYNO.DownloadStation2.Task.BT` (1-2)
- `SYNO.DownloadStation2.Task.BT.File` (1-2)
- `SYNO.DownloadStation2.Task.BT.Peer` (2-2)
- `SYNO.DownloadStation2.Task.BT.Tracker` (2-2)
- `SYNO.DownloadStation2.Task.Complete` (1-1)
- `SYNO.DownloadStation2.Task.List` (1-2)
- `SYNO.DownloadStation2.Task.List.Polling` (2-2)
- `SYNO.DownloadStation2.Task.NZB.File` (1-1)
- `SYNO.DownloadStation2.Task.NZB.Log` (1-1)
- `SYNO.DownloadStation2.Task.Source` (2-2)
- `SYNO.DownloadStation2.Task.Statistic` (1-1)
- `SYNO.DownloadStation2.Task.eMule` (1-1)
- `SYNO.DownloadStation2.Thumbnail` (2-2)
- `SYNO.DownloadStation2.eMule.Search` (1-1)
- `SYNO.DownloadStation2.eMule.Server` (1-1)

---

## 2) Probe read-only (opérations utiles)

## 2.1 Auth (pré-requis pour les lectures réelles)
Tentatives `SYNO.API.Auth login` sur `entry.cgi` et `auth.cgi`, versions 7/6/3/2 (session `DownloadStation`):
- v7/v6/v3 → `code=401`
- v2 → `code=103`
- **Aucun SID valide obtenu**

Conséquence: les tests fonctionnels read-only sont limités (auth bloquante).

## 2.2 Tableau OK/KO par opération testée
> Légende: **OK** = endpoint joignable + réponse DSM parsable; **KO** = non validé fonctionnellement (auth/params/version).

| Opération | API | Endpoint | Method testée | Résultat brut | Statut |
|---|---|---|---|---|---|
| Discovery catalogue | `SYNO.API.Info` | `query.cgi` | `query` | `success=true` | OK |
| Login SID (DS session) | `SYNO.API.Auth` | `entry.cgi/auth.cgi` | `login` | `401/103` | KO |
| Task list DS2 | `SYNO.DownloadStation2.Task.List` | `entry.cgi` | `list` | `103` | KO |
| Task stats DS2 | `SYNO.DownloadStation2.Task.Statistic` | `entry.cgi` | `get` | `119` | KO |
| BT search list DS2 | `SYNO.DownloadStation2.BTSearch` | `entry.cgi` | `list` | `119` | KO |
| RSS feed list DS2 | `SYNO.DownloadStation2.RSS.Feed` | `entry.cgi` | `list` | `119` | KO |
| RSS item list DS2 | `SYNO.DownloadStation2.RSS.Item` | `entry.cgi` | `list` | `119` | KO |
| Settings global DS2 | `SYNO.DownloadStation2.Settings.Global` | `entry.cgi` | `get` | `119` | KO |
| Settings BT DS2 | `SYNO.DownloadStation2.Settings.BT` | `entry.cgi` | `get` | `119` | KO |
| Package info DS2 | `SYNO.DownloadStation2.Package.Info` | `entry.cgi` | `get` | `119` | KO |
| Package module DS2 | `SYNO.DownloadStation2.Package.Module` | `entry.cgi` | `list` | `119` | KO |
| Package service DS2 | `SYNO.DownloadStation2.Package.Service` | `entry.cgi` | `get` | `119` | KO |
| Task list legacy | `SYNO.DownloadStation.Task` | `DownloadStation/task.cgi` | `list` | `105` | KO |
| Stats legacy | `SYNO.DownloadStation.Statistic` | `DownloadStation/statistic.cgi` | `get` | `103` | KO |
| BT search list legacy | `SYNO.DownloadStation.BTSearch` | `DownloadStation/btsearch.cgi` | `list` | `105` | KO |
| RSS feed list legacy | `SYNO.DownloadStation.RSS.Feed` | `DownloadStation/RSSfeed.cgi` | `list` | `105` | KO |
| RSS site list legacy | `SYNO.DownloadStation.RSS.Site` | `DownloadStation/RSSsite.cgi` | `list` | `105` | KO |
| Package/info legacy | `SYNO.DownloadStation.Info` | `DownloadStation/info.cgi` | `getinfo` | `105` | KO |

### Lecture des KO
- KO = **non validé**, pas destructif, pas d’écriture.
- Les codes montrent que les endpoints existent bien, mais sont refusés/invalidés en l’état (auth ou contraintes de params/version/méthode côté DSM).

---

## 3) Comparaison claire: DownloadStation vs DownloadStation2

## 3.1 Différences de familles/endpoints
- **Legacy (`SYNO.DownloadStation.*`)**: APIs plus compactes, chacune sur son CGI dédié (`DownloadStation/*.cgi`).
- **DS2 (`SYNO.DownloadStation2.*`)**: APIs beaucoup plus granulaires et **centralisées sur `entry.cgi`**.

## 3.2 Différences de méthodes/portée (observées)
- Legacy expose surtout: `Task`, `Statistic`, `BTSearch`, `RSS.*`, `Info`, `Schedule`.
- DS2 ajoute des sous-domaines détaillés:
  - `Task.*` riches (BT peer/tracker/file, NZB log/file, polling, source…)
  - `Settings.*` segmentés (BT, NZB, RSS, scheduler, emule, location…)
  - `Package.*` (info/module/service)
  - composants annexes (`Captcha`, `Thumbnail`, `eMule.*`)

## 3.3 Impacts pour un node n8n
- **Ne pas coder “Task-only”**: DS2 impose une architecture multi-ressources.
- Prévoir un routeur `api + version + method + endpoint` (legacy CGI vs DS2 `entry.cgi`).
- Gestion d’erreurs DSM obligatoire (codes numériques) + mapping UX n8n.
- Auth DSM (SID/challenge) est un prérequis dur avant d’élargir le coverage.

## 3.4 Pourquoi `DownloadStation2` existe (inférence basée API réelle)
D’après l’observation `SYNO.API.Info`, DS2 semble être une évolution d’architecture:
1. **Unification transport** (`entry.cgi`) plutôt que CGIs dispersés.
2. **Modularisation fonctionnelle** (Task/Settings/Package/RSS séparés).
3. **Versioning plus fin** (plusieurs APIs en `v2` ciblées).
4. **Extensibilité package/service** (famille `Package.*`) non visible côté legacy.

En pratique: DS2 n’est pas juste “v2 de Task”, c’est une **surface API plus industrialisée**.

---

## 4) Scope node n8n v1 (priorisé, minimal)

## Priorité P0 (read-only utile)
1. `task.list` (DS2 puis fallback legacy)
2. `task.statistics`
3. `task.get` (ou `task.list` filtré `id`)
4. `btsearch.list` (lecture uniquement)

## Priorité P1 (read-only élargi)
5. `rss.feed.list`
6. `rss.item.list`
7. `settings.global.get`
8. `package.info.get`

## Paramètres minimum
- `baseUrl`
- `username`
- `password`
- `verifySSL` (bool)
- `apiFamily` (`downloadstation2|legacy|auto`, défaut `auto`)
- `offset` (défaut `0`), `limit` (défaut `20`) pour les listes
- `taskId` (optionnel selon opération)
- `keyword` (pour BT search)

## Règles de sécurité v1
- Mode **read-only strict** par défaut (aucune opération write exposée).
- Si un jour write est ajouté: feature flag explicite + confirmation runtime.

---

## 5) Next step recommandé (pour lever les KO)
1. Corriger l’auth DSM pour obtenir `_sid` valide sur session `DownloadStation` (compte, politique auth, éventuel challenge/2FA).
2. Rejouer exactement la matrice read-only ci-dessus avec SID.
3. Figer les méthodes/versions finales réellement acceptées pour chaque opération v1.

---

## Conclusion
- **Inventaire API complet: OK** (DS=7, DS2=36).
- **Probe fonctionnel read-only: bloqué par auth/méthodes** (aucun SID).
- **Comparaison DS vs DS2: claire** — DS2 est une refonte modulaire/centralisée (`entry.cgi`) avec surface API bien plus large.
- **Scope n8n v1 proposé** prêt, avec priorité read-only et paramètres minimum.