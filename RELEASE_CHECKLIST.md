# RELEASE_CHECKLIST

Pragmatic checklist for clean npm + GitHub releases.

## 1) Pre-flight

- [ ] You are on `main`
- [ ] `git status` is clean
- [ ] Correct GitHub links in `package.json` (`repository`, `homepage`, `bugs`)
- [ ] README links are valid (especially `EXAMPLES.md`)

## 2) Validate locally

```bash
npm install
npm run build
npm run smoke
```

- [ ] Build passes
- [ ] Smoke checks pass

## 3) Version bump

Choose one:

```bash
npm version patch
# or
npm version minor
# or
npm version major
```

- [ ] Version bump created commit + tag

## 4) Push Git + tags

```bash
git push origin main --follow-tags
```

- [ ] Commit is on GitHub
- [ ] Tag is visible on GitHub

## 5) Publish npm

```bash
npm publish
```

- [ ] Publish succeeded

## 6) Post-publish verification

```bash
npm view n8n-nodes-synology-suite dist-tags --json
npm view n8n-nodes-synology-suite@latest version description --json
npm view n8n-nodes-synology-suite@latest repository.url homepage bugs.url --json
```

- [ ] `latest` points to expected version
- [ ] Description is up to date
- [ ] Repository links are correct (`ClawBow`)

## 7) NPM UI cache note

If npm page still shows old data, it is usually cache/CDN delay.
Use direct links to confirm:

- `https://www.npmjs.com/package/n8n-nodes-synology-suite/v/<version>`
- `https://registry.npmjs.org/n8n-nodes-synology-suite/latest`

---

## Optional: one-shot command sequence

```bash
npm run build && npm run smoke && npm version patch && git push origin main --follow-tags && npm publish
```
