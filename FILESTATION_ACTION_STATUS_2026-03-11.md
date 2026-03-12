# FileStation — Statut actions testées (2026-03-11)

Contexte: validation rapide via `skills/synology-filestation-inspector` (read-only focus).

| Action | Commande utilisée | Statut | Résultat / Notes |
|---|---|---|---|
| list | `python3 scripts/syno_cli.py list --path /OpenClaw` | ✅ OK | Liste des dossiers/fichiers retournée correctement |
| info | `python3 scripts/syno_cli.py info --path /OpenClaw` | ✅ OK | Métadonnées FileStation retournées (support sharing, uid/gid, etc.) |
| background-list | `python3 scripts/syno_cli.py background-list --limit 20` | ✅ OK | Historique tâches récupéré; présence d'erreurs `code 408` sur certains `CopyMove` |
| dirsize-start | `python3 scripts/syno_cli.py dirsize-start --path /OpenClaw/team-folder` | ✅ OK | Task lancée, `taskid=1773218017BD91B53A` |

## Observations clés
- La couche FileStation est opérationnelle pour inspection/audit.
- Des tâches de fond historiques montrent des erreurs ponctuelles `408` sur des opérations `CopyMove`.
- Les actions de cette skill restent orientées read-only + lancement dirsize (pas de mutation destructive par défaut).

## Suite recommandée
1. Ajouter test ciblé des endpoints FileStation critiques côté node principal (List/Search/CopyMove/CreateFolder/Rename/Delete).
2. Documenter la signification locale de `code 408` (timeout vs permission vs path lock) avec cas de repro minimal.
3. Créer une matrice `endpoint -> paramètres minimum -> résultat attendu` pour éviter les faux négatifs.
