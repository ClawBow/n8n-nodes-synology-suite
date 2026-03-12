# PROBE AudioStation V2 — 2026-03-11

## TL;DR
- Probe **non destructif** effectué (read-only uniquement).
- Découverte `SYNO.AudioStation.*` faite via artefact `API_PROBE_RESULTS.json` (issu de `SYNO.API.Info` live antérieur sur la même cible DSM).
- Revalidation live tentée aujourd’hui via skill `synology-audio-station`, mais bloquée à l’auth (`SYNO.API.Auth.login` code **401**).
- Pour le scope demandé (artists/albums/songs/search/playlists/folders/info), la matrice OK/KO est exploitable pour préparer un node n8n v1 read-only.

---

## 1) Discovery `SYNO.AudioStation.*` via API.Info
Source utilisée:
- `n8n-nodes-synology-suite/API_PROBE_RESULTS.json`
- `generatedAt`: `2026-02-18T12:29:39.801242+00:00`
- `context.baseUrl`: `https://darknas.tail91a2f7.ts.net:7894`

APIs AudioStation découvertes: **27**

- SYNO.AudioStation.Album (`AudioStation/album.cgi`, v1..3)
- SYNO.AudioStation.Artist (`AudioStation/artist.cgi`, v1..4)
- SYNO.AudioStation.Browse.Playlist (`entry.cgi`, v1..1)
- SYNO.AudioStation.Composer (`AudioStation/composer.cgi`, v1..2)
- SYNO.AudioStation.Cover (`AudioStation/cover.cgi`, v1..3)
- SYNO.AudioStation.Download (`AudioStation/download.cgi`, v1..1)
- SYNO.AudioStation.Folder (`AudioStation/folder.cgi`, v1..3)
- SYNO.AudioStation.Genre (`AudioStation/genre.cgi`, v1..3)
- SYNO.AudioStation.Info (`AudioStation/info.cgi`, v1..6)
- SYNO.AudioStation.Lyrics (`AudioStation/lyrics.cgi`, v1..2)
- SYNO.AudioStation.LyricsSearch (`AudioStation/lyrics_search.cgi`, v1..2)
- SYNO.AudioStation.MediaServer (`AudioStation/media_server.cgi`, v1..1)
- SYNO.AudioStation.Pin (`entry.cgi`, v1..1)
- SYNO.AudioStation.Playlist (`AudioStation/playlist.cgi`, v1..3)
- SYNO.AudioStation.Proxy (`AudioStation/proxy.cgi`, v1..2)
- SYNO.AudioStation.Radio (`AudioStation/radio.cgi`, v1..2)
- SYNO.AudioStation.RemotePlayer (`AudioStation/remote_player.cgi`, v1..3)
- SYNO.AudioStation.RemotePlayerStatus (`AudioStation/remote_player_status.cgi`, v1..2)
- SYNO.AudioStation.Search (`AudioStation/search.cgi`, v1..1)
- SYNO.AudioStation.Song (`AudioStation/song.cgi`, v1..3)
- SYNO.AudioStation.Stream (`AudioStation/stream.cgi`, v1..2)
- SYNO.AudioStation.Tag (`entry.cgi`, v1..1)
- SYNO.AudioStation.VoiceAssistant.Browse (`entry.cgi`, v1..1)
- SYNO.AudioStation.VoiceAssistant.Challenge (`entry.cgi`, v1..1)
- SYNO.AudioStation.VoiceAssistant.Info (`entry.cgi`, v1..1)
- SYNO.AudioStation.VoiceAssistant.Stream (`entry.cgi`, v1..1)
- SYNO.AudioStation.WebPlayer (`AudioStation/web_player.cgi`, v1..1)

---

## 2) Tests read-only ciblés (artists/albums/songs/search/playlists/folders/info)

### 2.1 Revalidation live aujourd’hui
Commande testée:
- `python3 skills/synology-audio-station/scripts/syno_cli.py info`

Résultat:
- `SYNO.API.Auth.login` → `{"error":{"code":401},"success":false}`
- Donc pas de session `_sid` exploitable pour exécuter les appels AudioStation live aujourd’hui.

### 2.2 Matrice OK/KO (basée sur probe live antérieur conservé)

| API | Path | Version max | Méthodes OK | Méthodes KO notables |
|---|---|---:|---|---|
| `SYNO.AudioStation.Artist` | `AudioStation/artist.cgi` | 4 | `list` | `get/query/info/status/search/read` → code 103 |
| `SYNO.AudioStation.Album` | `AudioStation/album.cgi` | 3 | `list` | `get/query/info/status/search/read` → code 103 |
| `SYNO.AudioStation.Song` | `AudioStation/song.cgi` | 3 | `list`, `search` | `get/query/info/status/read` → code 103 |
| `SYNO.AudioStation.Search` | `AudioStation/search.cgi` | 1 | `list` | `get/query/info/status/search/read` → code 103 |
| `SYNO.AudioStation.Playlist` | `AudioStation/playlist.cgi` | 3 | `list` | `get/query/info/status/search/read` → code 103 |
| `SYNO.AudioStation.Folder` | `AudioStation/folder.cgi` | 3 | `list` | `get/query/info/status/search/read` → code 103 |
| `SYNO.AudioStation.Info` | `AudioStation/info.cgi` | 6 | *(aucune dans ce probe générique)* | `get/list/query/info/status/search/read` → code 103 |

> Note importante: l’absence de succès sur `SYNO.AudioStation.Info` ici vient du **probe générique de méthodes candidates**. Il est possible que cette API requière une méthode spécifique non testée par cette matrice (ex: autre nom de méthode + params requis).

---

## 3) Paramètres read-only qui passent
Pattern confirmé sur les endpoints listants:
- `method=list`
- pagination: `offset`, `limit`
- + paramètres de base DSM: `api`, `version`, `_sid`

Exemple type:
```
GET /webapi/AudioStation/artist.cgi
  ?api=SYNO.AudioStation.Artist
  &version=4
  &method=list
  &offset=0
  &limit=20
  &_sid=<sid>
```

Recherche chansons:
- `SYNO.AudioStation.Song` avec `method=search` = **OK** (dans la matrice)
- paramètre minimal recommandé côté node: `keyword`

---

## 4) Erreurs DSM observées
- **401** (aujourd’hui): échec login (`SYNO.API.Auth.login`) → session non ouverte.
- **103** (matrice de probe): méthode inexistante pour la combinaison API/method testée.

Codes à gérer dans le node (minimum):
- `103` method does not exist
- `104` version not supported
- `105` insufficient privilege
- `106/107/119` problèmes de session SID
- `400/401` auth/paramètres login invalides selon contexte DSM

---

## 5) Scope v1 recommandé pour le node n8n (AudioStation, read-only)

### Ressources/opérations v1
1. Artist → `list` (offset, limit)
2. Album → `list` (offset, limit)
3. Song → `list` (offset, limit)
4. Song → `search` (keyword, offset?, limit?)
5. Playlist → `list` (offset, limit)
6. Folder → `list` (offset, limit)

### `Info` en v1 ?
- Optionnel: garder en **feature flag / experimental** tant que la méthode exacte n’est pas validée live dans cette session.

### Paramètres minimum côté node
- Communs: `offset` (0), `limit` (20)
- Search song: `keyword` (required)
- Avancé (facultatif): `additionalParams` (JSON) en read-only strict

### Hors scope v1
- streaming/download
- contrôle remote player
- toute opération create/update/delete/set/write

---

## 6) Verdict
- **Objectif préparation n8n atteint** pour un v1 read-only robuste (list + song.search).
- Discovery `SYNO.AudioStation.*` et matrice OK/KO disponibles.
- Blocage actuel = auth live (401), à corriger avant QA finale sur NAS.

## Next step conseillé (rapide)
1. Réparer auth DSM côté credentials/session policy.
2. Rejouer smoke test live sur les 6 opérations v1.
3. Capturer 2-3 payloads réels (artist/album/song) pour stabiliser le mapping de sortie n8n.
