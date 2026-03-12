# SynologyFileStation node — runtime test (2026-03-11)

Scope: validation réelle contre le NAS (pas seulement build/smoke).
Sandbox used: `/OpenClaw/_archive/node-filestation-tests`

## Résultats action par action

- ✅ `list` — OK
- ✅ `info` — OK *(renvoie des infos FileStation globales sur ce NAS; pas des métadonnées fichier détaillées)*
- ✅ `search` — OK (`taskid` renvoyé)
- ✅ `createFolder` — OK
- ✅ `rename` — OK *(quand le fichier existe)*
- ✅ `delete` — OK (cleanup folder)
- ✅ `copyMove` — OK (`taskid` renvoyé, exécution en tâche de fond)
- ✅ `dirsizeStart` — OK (`taskid` renvoyé)
- ✅ `backgroundList` — OK
- ⚠️ `download` — non validé bout-en-bout dans la passe initiale (a échoué parce que le fichier de test n’existait pas après échec upload)
- ❌ `uploadBase64` — KO (DSM error code `119` sur ce compte/session)
- ✅ `customCall` — OK (appel custom FileStation list)

## Détails importants

1. `uploadBase64` échoue de manière reproductible avec `error code 119`.
   - probable cause: droits/permissions FileStation upload du compte d’intégration ou restriction endpoint.

2. `rename` fonctionne correctement dès qu’un fichier existe.
   - vérifié via `copyMove` d’un fichier existant puis `rename` dans le dossier de test.

3. `copyMove` fonctionne en mode tâche asynchrone.
   - il faut lire `backgroundList` pour observer l’état final/erreurs.

## Conclusion

Le node est **majoritairement opérationnel en runtime** (9+ actions validées), avec un blocage principal sur **upload** (code 119) et un test download à refaire après résolution upload ou avec fixture stable.
