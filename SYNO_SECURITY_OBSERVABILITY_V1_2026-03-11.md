# SYNO_SECURITY_OBSERVABILITY_V1 — 2026-03-11

## Résumé
Implémentation d’un **nouveau node n8n v1** orienté sécurité/observabilité Synology, en mode prudent et non destructif:
- Node ajouté: `SynologySecurityObservability`
- Opérations:
  1. `getLoginActivityUser` → `SYNO.SecurityAdvisor.LoginActivity.User.get` (v1)
  2. `customReadCall` → appel générique **read-only** avec garde-fous

Chemin source:
- `nodes/SynologySecurityObservability/SynologySecurityObservability.node.ts`
- `nodes/SynologySecurityObservability/synology-security-observability.svg`

---

## Ce qui a été ajouté

## 1) Nouveau node: Synology Security Observability
- `displayName`: **Synology Security Observability**
- `name`: `synologySecurityObservability`
- `version`: 1
- Credential: `synologyDsmApi`
- Icône: `file:synology-security-observability.svg`

### Opération A — `getLoginActivityUser`
- API fixée: `SYNO.SecurityAdvisor.LoginActivity.User`
- Méthode fixée: `get`
- Version fixée: `1`
- Paramètres exposés:
  - `userName` (optionnel)
  - `offset` (défaut 0)
  - `limit` (défaut 100)

### Opération B — `customReadCall`
- Paramètres exposés:
  - `api`
  - `method`
  - `version`
  - `paramsJson`
- **Whitelist API stricte**:
  - `SYNO.SecurityAdvisor.*`
  - `SYNO.LogCenter.*`
- Si `api` est hors whitelist → erreur bloquante immédiate.

---

## 2) Garde-fous anti-destructifs (runtime)
Dans `customReadCall`, blocage explicite des méthodes potentiellement destructives:
- `create`
- `update`
- `set`
- `delete`
- `remove`
- `start`
- `stop`
- `restart`
- `write`
- `run`

Le blocage est fait côté node avant appel DSM (`assertReadOnlyCustomCall`).

---

## 3) Gestion d’erreurs DSM (incluant fallback 114)
Ajout d’un traitement d’erreur dédié (`rethrowWithDsmGuidance`) sur les opérations:
- Codes guidés explicitement: `103`, `104`, `105`, `106`, `107`, `119`, `407`
- **Code `114`**: fallback explicite “DSM unmapped/unknown error code”, avec recommandation de vérifier les logs DSM et détails bruts.
- Les autres erreurs DSM restent relayées proprement (backward-compatible avec le mécanisme existant `DsmApiError`).

---

## 4) Intégration package.json
Mises à jour réalisées:
- `scripts.copy:assets`
  - copie des assets `nodes/SynologySecurityObservability/*.svg|*.png` vers `dist/nodes/SynologySecurityObservability/`
- `n8n.nodes`
  - ajout de `dist/nodes/SynologySecurityObservability/SynologySecurityObservability.node.js`
- `keywords`
  - ajout: `security`, `observability`, `logcenter`, `security-advisor`

Aucune modification destructive ni cassante sur les nodes existants.

---

## 5) Build + smoke
Exécuté avec succès:
- `npm run build` ✅
- `npm run smoke` ✅

Résultat:
- compilation TypeScript OK
- assets copiés (incluant nouvelle icône)
- smoke test global existant OK

---

## Utilisation rapide dans n8n
1. Ajouter le node **Synology Security Observability** dans un workflow.
2. Configurer credential `synologyDsmApi`.
3. Choisir une opération:
   - **Get Login Activity User**: pour interroger l’activité de connexion utilisateur
   - **Custom Read Call (Whitelisted)**: pour tester des endpoints read-only des familles SecurityAdvisor/LogCenter
4. En custom:
   - API doit commencer par `SYNO.SecurityAdvisor.` ou `SYNO.LogCenter.`
   - éviter toute méthode de type write (déjà bloquée automatiquement)

---

## Notes de compatibilité / limites v1
- Scope volontairement minimal et prudent.
- Pas d’opération write/destructive exposée.
- Le comportement dépend des permissions DSM du compte service.
- Si DSM renvoie `407` (auth policy/2FA), il faut corriger la politique DSM côté compte.
