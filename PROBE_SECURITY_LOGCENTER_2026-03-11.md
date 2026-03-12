# PROBE Synology Security Advisor + LogCenter — 2026-03-11

## Contexte & contraintes
- Objectif: préparer un node n8n sécurité/observabilité pour `SYNO.SecurityAdvisor.*` et `SYNO.LogCenter.*`.
- Contrainte respectée: **strictement non destructif** (aucun `create/update/delete/run/start/stop/set/write`).
- Cible DSM: `darknas` (`/webapi`).

## Méthode
1. **Discovery live** via `SYNO.API.Info` (query all + filtrage des familles cibles).
2. **Probe read-only live (sessionless)** des méthodes candidates (`list/get/status/query/info`) pour observer les codes d’erreur actuels.
3. **Cross-check** avec l’artefact runtime existant `API_PROBE_RESULTS.json` (probe exhaustif historique) pour identifier ce qui a déjà fonctionné/échoué avec session valide dans le passé.

---

## 1) Endpoints découverts via `SYNO.API.Info`
### `SYNO.SecurityAdvisor.*` (8 APIs)
- `SYNO.SecurityAdvisor.Conf` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.Conf.Checklist` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.Conf.Checklist.Alert` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.Conf.Location` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.LoginActivity` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.LoginActivity.User` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.Report` (path `entry.cgi`, v1..1)
- `SYNO.SecurityAdvisor.Report.HTML` (path `entry.cgi`, v1..1)

### `SYNO.LogCenter.*` (6 APIs)
- `SYNO.LogCenter.Client` (path `entry.cgi`, v1..2)
- `SYNO.LogCenter.Client.CA` (path `entry.cgi`, v1..1)
- `SYNO.LogCenter.History` (path `entry.cgi`, v1..1)
- `SYNO.LogCenter.Log` (path `entry.cgi`, v1..2)
- `SYNO.LogCenter.RecvRule` (path `entry.cgi`, v1..1)
- `SYNO.LogCenter.Setting.Storage` (path `entry.cgi`, v1..1)

---

## 2) Tests read-only live (aujourd’hui)

## Auth
Tentative `SYNO.API.Auth.login` avec les credentials du skill Synology API discovery:
- Résultat DSM: `code 407` (auth non finalisée/policy sécurité côté DSM).
- Impact: pas de SID exploitable pour valider les endpoints protégés aujourd’hui.

## Probe sessionless (`entry.cgi` sans `_sid`)
Constats généraux:
- `code 119` observé sur certaines combinaisons API/method (`SID not found`).
- `code 103` observé sur la majorité des méthodes génériques non supportées (`method does not exist`).

Exemples représentatifs:
- `SYNO.SecurityAdvisor.Report.list` → `119`
- `SYNO.SecurityAdvisor.LoginActivity.list` → `119`
- `SYNO.SecurityAdvisor.LoginActivity.User.get` → `119`
- `SYNO.LogCenter.Log.list` (v1/v2) → `119`
- `SYNO.LogCenter.History.list` → `119`
- `SYNO.LogCenter.Client.get` (v1/v2) → `119`
- Méthodes non supportées (`status/query/info` etc.) → majoritairement `103`

---

## 3) Ce qui marche/échoue (codes) — d’après artefact runtime existant
Source: `/root/.openclaw/workspace/n8n-nodes-synology-suite/API_PROBE_RESULTS.json` (probe historique exhaustif, non destructif).

### Security Advisor
- **Succès confirmé**:
  - `SYNO.SecurityAdvisor.LoginActivity.User.get` ✅
- **Erreurs fréquentes**:
  - `103` méthode inexistante
  - `105` privilèges insuffisants
  - `114` (observé sur `SYNO.SecurityAdvisor.Conf.Checklist.list`, code DSM non mappé dans le node actuel)

### LogCenter
- **Aucun succès confirmé** sur les méthodes read-only génériques probées (`list/get/status/query/info/search/read`).
- **Erreurs fréquentes**:
  - `103` méthode inexistante
  - `105` privilèges insuffisants

---

## 4) Proposition scope v1 node n8n sécurité/observabilité
Vu l’état actuel (auth `407` aujourd’hui + permissions partielles), proposer un **v1 minimal, robuste, read-only**:

### Ressources/ops v1
1. **SecurityAdvisor / Login Activity User**
   - `getLoginActivityUser` (`SYNO.SecurityAdvisor.LoginActivity.User`, method `get`, v1)
   - C’est la seule opération avec succès observé dans l’artefact runtime.

2. **Custom read-only call (escape hatch)**
   - `customReadCall(api, method, version, params)`
   - Whitelist stricte sur familles:
     - `SYNO.SecurityAdvisor.*`
     - `SYNO.LogCenter.*`
   - Blocklist write methods (hard stop): `create/update/delete/run/start/stop/set/write`.

### Gestion d’erreurs à intégrer (obligatoire)
- `103` méthode non supportée
- `104` version non supportée
- `105` privilèges insuffisants
- `106/107/119` problèmes de session
- `407` auth incomplète/policy sécurité DSM
- `114` code non mappé (prévoir fallback message “DSM code unmapped” + payload brut)

### Hors scope v1
- Toute modification de config LogCenter/SecurityAdvisor.
- Toute action de scan/trigger/manual-run.
- Toute opération write, même si API l’expose.

---

## 5) Conclusion
- Discovery `SYNO.API.Info` validée: **14 APIs** cibles détectées (8 SecurityAdvisor + 6 LogCenter).
- En live aujourd’hui, l’auth DSM retourne `407`, bloquant la validation complète des endpoints protégés.
- Le runtime historique montre un seul endpoint read-only réellement validé: `SYNO.SecurityAdvisor.LoginActivity.User.get`.
- Pour n8n, un **v1 prudent** est recommandé: 1 opération validée + `customReadCall` contrôlé + gestion d’erreurs DSM solide.

## Reco immédiate
1. Débloquer la condition auth DSM (`407`) sur le compte service (policy/2FA/permissions applicatives).
2. Rejouer mini smoke test live après auth OK:
   - `SYNO.SecurityAdvisor.LoginActivity.User.get`
   - `SYNO.SecurityAdvisor.LoginActivity.list`
   - `SYNO.SecurityAdvisor.Report.list`
   - `SYNO.LogCenter.Log.list`
   - `SYNO.LogCenter.History.list`
3. Capturer 2-3 payloads réels pour figer le mapping output n8n (events, sévérité, timestamps, source).
