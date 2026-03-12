# n8n-nodes-synology-suite — STATUS CURRENT (2026-03-11)

## Ce qui est clair et validé
- Package publié: `0.31.21`
- 10 nodes présents:
  - SynologyDrive
  - SynologySheets
  - SynologyCalendar
  - SynologyNote
  - SynologyPhotos
  - SynologyContacts
  - SynologyMailPlus
  - SynologyMailPlusTrigger
  - SynologyOffice
  - SynologyApi
- Correctifs credentials déjà publiés:
  - `0.31.20` (DSM credential test)
  - `0.31.21` (Spreadsheet credential test)

## Ce qui a été testé mais bloque / partiel
- Docs/Slides Synology:
  - retour support: pas d’API publique officiellement dispo pour l’instant.
- Certains endpoints Synology restent ambigus selon service/port/auth (ex: flows Office/API internes), donc besoin de confirmation officielle + doc à jour.
- L’état de `REPORT.md` est en retard par rapport aux dernières versions et validations.

## Règle de lecture projet (source of truth)
1. `STATUS_CURRENT.md` (ce fichier) = état opérationnel actuel
2. `memory/YYYY-MM-DD.md` = journal brut quotidien
3. `MEMORY.md` = long terme
4. `REPORT.md` = historique/release, mais peut être décalé

## Actions immédiates recommandées
- Mettre à jour `REPORT.md` pour refléter 0.31.20/0.31.21.
- Préparer 2 messages Synology:
  - feature request (Docs/Slides API)
  - demande de clarification API catalog/versioning/prérequis endpoint.
- Continuer roadmap sur APIs réellement ouvertes et documentées.
