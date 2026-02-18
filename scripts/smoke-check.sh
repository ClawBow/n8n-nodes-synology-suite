#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

echo "[smoke] building TypeScript"
npm run build >/tmp/synology-suite-build.log 2>&1 || {
  echo "[smoke] build failed"
  cat /tmp/synology-suite-build.log
  exit 1
}

echo "[smoke] checking node exports in dist"
test -f dist/nodes/SynologyApi/SynologyApi.node.js
test -f dist/nodes/SynologyDrive/SynologyDrive.node.js
test -f dist/nodes/SynologyOffice/SynologyOffice.node.js
test -f dist/nodes/SynologyMailPlus/SynologyMailPlus.node.js

echo "[smoke] ok"
