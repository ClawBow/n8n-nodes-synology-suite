# PROBE Synology Audio Station — 2026-03-11

## Contexte & contraintes
- Objectif: préparer un node n8n pour `SYNO.AudioStation.*` (read-only).
- Contrainte respectée: **aucune opération write** exécutée.

## Méthode
1. Tentative de probe live (auth + appels read-only) via les scripts skill `synology-audio-station`.
2. En parallèle, exploitation des artefacts de probe exhaustif existants (`ACTIONS_MATRIX.json`) générés depuis `SYNO.API.Info` sur la même cible DSM.

## Résultat auth live (aujourd'hui)
Tentative login `SYNO.API.Auth` (sessions: `AudioStation`, `FileStation`, `DSM`, etc.) avec les credentials `.env`:
- Réponse DSM: `{"success":false,"error":{"code":407}}`
- Impact: impossible de refaire des appels `SYNO.AudioStation.*` live dans cette session.

> Interprétation probable: étape de sécurité/auth complémentaire requise côté DSM (ex: OTP/2FA/policy), credentials seuls insuffisants actuellement.

## 1) APIs AudioStation disponibles (via `SYNO.API.Info` — artefact probe existant)
Source: `ACTIONS_MATRIX.json` (generatedAt `2026-02-18T12:29:39Z`, base `https://darknas.tail91a2f7.ts.net:7894`).

Total détecté: **27 APIs** `SYNO.AudioStation.*`:
- `SYNO.AudioStation.Album` (`AudioStation/album.cgi`, v1..3)
- `SYNO.AudioStation.Artist` (`AudioStation/artist.cgi`, v1..4)
- `SYNO.AudioStation.Browse.Playlist` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.Composer` (`AudioStation/composer.cgi`, v1..2)
- `SYNO.AudioStation.Cover` (`AudioStation/cover.cgi`, v1..3)
- `SYNO.AudioStation.Download` (`AudioStation/download.cgi`, v1..1)
- `SYNO.AudioStation.Folder` (`AudioStation/folder.cgi`, v1..3)
- `SYNO.AudioStation.Genre` (`AudioStation/genre.cgi`, v1..3)
- `SYNO.AudioStation.Info` (`AudioStation/info.cgi`, v1..6)
- `SYNO.AudioStation.Lyrics` (`AudioStation/lyrics.cgi`, v1..2)
- `SYNO.AudioStation.LyricsSearch` (`AudioStation/lyrics_search.cgi`, v1..2)
- `SYNO.AudioStation.MediaServer` (`AudioStation/media_server.cgi`, v1..1)
- `SYNO.AudioStation.Pin` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.Playlist` (`AudioStation/playlist.cgi`, v1..3)
- `SYNO.AudioStation.Proxy` (`AudioStation/proxy.cgi`, v1..2)
- `SYNO.AudioStation.Radio` (`AudioStation/radio.cgi`, v1..2)
- `SYNO.AudioStation.RemotePlayer` (`AudioStation/remote_player.cgi`, v1..3)
- `SYNO.AudioStation.RemotePlayerStatus` (`AudioStation/remote_player_status.cgi`, v1..2)
- `SYNO.AudioStation.Search` (`AudioStation/search.cgi`, v1..1)
- `SYNO.AudioStation.Song` (`AudioStation/song.cgi`, v1..3)
- `SYNO.AudioStation.Stream` (`AudioStation/stream.cgi`, v1..2)
- `SYNO.AudioStation.Tag` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.VoiceAssistant.Browse` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.VoiceAssistant.Challenge` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.VoiceAssistant.Info` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.VoiceAssistant.Stream` (`entry.cgi`, v1..1)
- `SYNO.AudioStation.WebPlayer` (`AudioStation/web_player.cgi`, v1..1)

## 2) Endpoints read-only testés (artistes/albums/songs/playlists/folders)
### APIs cibles
- `SYNO.AudioStation.Artist` / `artist.cgi` / v4
- `SYNO.AudioStation.Album` / `album.cgi` / v3
- `SYNO.AudioStation.Song` / `song.cgi` / v3
- `SYNO.AudioStation.Playlist` / `playlist.cgi` / v3
- `SYNO.AudioStation.Folder` / `folder.cgi` / v3

### Méthodes validées
D'après probe runtime existant:
- **Artist**: `method=list` ✅
- **Album**: `method=list` ✅
- **Song**: `method=list` ✅, `method=search` ✅
- **Playlist**: `method=list` ✅
- **Folder**: `method=list` ✅

### Params qui marchent (read-only)
Pattern recommandé (confirmé par scripts skill):
- `offset` (int, stringifié côté query)
- `limit` (int, stringifié côté query)

Exemple (artist):
- path: `AudioStation/artist.cgi`
- query: `api=SYNO.AudioStation.Artist&version=4&method=list&offset=0&limit=20&_sid=...`

Même pattern pour Album/Song/Playlist/Folder (version API adaptée).

## 3) Erreurs DSM relevées
### Pendant ce probe (2026-03-11)
- `SYNO.API.Auth.login` → **code 407** (auth non finalisée / sécurité requise).

### Pendant probe runtime existant (AudioStation)
Pour les APIs cibles, hors méthodes valides (`list`, `song.search`), les méthodes génériques testées (`get`, `query`, `info`, `status`, `read`, `search` sur certaines APIs) renvoient majoritairement:
- **code 103** = method does not exist.

Implication node n8n: exposer uniquement les méthodes réellement supportées, sinon fallback `customCall` avec gestion d’erreur DSM structurée.

## 4) Proposition scope v1 node n8n (AudioStation)
### Ressources / opérations v1
1. **Artist**
   - `listArtists(offset, limit)`
2. **Album**
   - `listAlbums(offset, limit)`
3. **Song**
   - `listSongs(offset, limit)`
   - `searchSongs(keyword, offset?, limit?)`
4. **Playlist**
   - `listPlaylists(offset, limit)`
5. **Folder**
   - `listFolders(offset, limit)`
6. **Info (optionnel mais utile)**
   - `getAudioStationInfo()` (`SYNO.AudioStation.Info`)

### Paramètres v1
- Communs: `offset` (default 0), `limit` (default 20, max configurable)
- Search song: `keyword` (required), + pagination
- Avancé: `additionalFields` / `extraParamsJson` (escape hatch read-only)

### Gestion d’erreurs à intégrer
- `103` méthode non supportée (mismatch API/method)
- `104` version non supportée
- `105` privilèges insuffisants
- `106/107/119` session expirée/interrompue
- `407` auth incomplète (si policy DSM/2FA)

### Hors scope v1 (à garder pour v2+)
- `stream`, `download`, `playlist create/update/delete`, `remote player control`, voice assistant ops.

## 5) Conclusion
- **Faisable en v1 read-only** avec un périmètre propre centré sur `list*` + `song.search`.
- Les endpoints/méthodes utiles sont identifiés.
- Blocage actuel: auth runtime (`code 407`) empêche la revalidation live aujourd’hui; néanmoins les résultats de probe runtime existant donnent une base solide pour implémentation n8n v1.

## Reco immédiate
Avant QA finale du node:
1. Régler la condition auth DSM qui provoque `407` (OTP/policy).
2. Rejouer un mini smoke test live sur 6 opérations v1.
3. Capturer 3 payloads réels (artist/album/song) pour figer le mapping n8n output.
