#!/usr/bin/env python3
"""Full Synology DSM action probing (safe-by-default).

- Loads credentials from skills/synology-api-discovery/.env by default
- Logs into DSM
- Queries API list (SYNO.API.Info)
- Probes method candidates per API
- Skips potentially destructive methods unless --allow-destructive
- Writes:
  - ACTIONS_MATRIX.json
  - ACTIONS_MATRIX.md
"""

from __future__ import annotations

import argparse
import json
import os
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests
import urllib3

METHOD_CANDIDATES = [
    "get",
    "list",
    "query",
    "info",
    "start",
    "status",
    "create",
    "update",
    "set",
    "delete",
    "run",
    "stop",
    "search",
    "read",
    "write",
]

# Conservative safety default (skip unless explicitly allowed)
DESTRUCTIVE_METHODS = {"start", "create", "update", "set", "delete", "run", "stop", "write"}

DSM_CODE_NOTES = {
    101: "Missing parameter (often means method exists but needs required params)",
    102: "API does not exist",
    103: "Method does not exist",
    104: "Version not supported",
    105: "Insufficient privilege",
    106: "Session timeout",
    107: "Session interrupted",
    117: "Need manager rights",
    119: "SID not found / invalid session",
    400: "Execution failed / invalid operation",
    401: "Parameter invalid",
    402: "System busy",
    403: "Task not found",
    404: "Invalid task",
}


@dataclass
class ApiDef:
    name: str
    path: str
    min_version: int
    max_version: int


def load_env_file(env_path: Path) -> Dict[str, str]:
    out: Dict[str, str] = {}
    if env_path.exists():
        for raw in env_path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    out.update(os.environ)
    return out


class SynologyClient:
    def __init__(self, env: Dict[str, str]):
        self.base_url = env["SYNOLOGY_URL"].rstrip("/")
        self.username = env["SYNOLOGY_USERNAME"]
        self.password = env["SYNOLOGY_PASSWORD"]
        self.session_name = env.get("SESSION_NAME", "FileStation")
        self.verify_ssl = env.get("VERIFY_SSL", "true").lower() == "true"
        if not self.verify_ssl:
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        self.session = requests.Session()
        self.sid: str | None = None

    def _get(self, path: str, params: Dict[str, Any]) -> requests.Response:
        url = f"{self.base_url}/webapi/{path.lstrip('/')}"
        return self.session.get(url, params=params, timeout=60, verify=self.verify_ssl)

    def login(self) -> None:
        resp = self._get(
            "entry.cgi",
            {
                "api": "SYNO.API.Auth",
                "version": "7",
                "method": "login",
                "account": self.username,
                "passwd": self.password,
                "session": self.session_name,
                "format": "sid",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success"):
            raise RuntimeError(f"Login failed: {data}")
        self.sid = data["data"]["sid"]

    def list_apis(self) -> Dict[str, ApiDef]:
        if not self.sid:
            raise RuntimeError("Not logged in")
        resp = self._get(
            "entry.cgi",
            {
                "api": "SYNO.API.Info",
                "version": "1",
                "method": "query",
                "query": "all",
                "_sid": self.sid,
            },
        )
        resp.raise_for_status()
        j = resp.json()
        if not j.get("success"):
            raise RuntimeError(f"SYNO.API.Info query failed: {j}")

        result: Dict[str, ApiDef] = {}
        for name, spec in j.get("data", {}).items():
            result[name] = ApiDef(
                name=name,
                path=spec.get("path", "entry.cgi"),
                min_version=int(spec.get("minVersion", 1)),
                max_version=int(spec.get("maxVersion", 1)),
            )
        return result

    def probe(self, api: ApiDef, method: str, version: int | None = None) -> Tuple[int | None, Dict[str, Any] | None, str | None]:
        if not self.sid:
            raise RuntimeError("Not logged in")

        v = version if version is not None else api.max_version
        params = {"api": api.name, "version": str(v), "method": method, "_sid": self.sid}

        try:
            resp = self._get(api.path, params)
            http_status = resp.status_code
            payload = resp.json()
            return http_status, payload, None
        except requests.RequestException as e:
            return None, None, f"request_error: {type(e).__name__}: {e}"
        except ValueError as e:
            return resp.status_code if "resp" in locals() else None, None, f"invalid_json: {e}"


def load_catalog_apis(catalog_path: Path) -> Dict[str, ApiDef]:
    data = json.loads(catalog_path.read_text(encoding="utf-8"))
    apis = data.get("apis", []) if isinstance(data, dict) else []
    out: Dict[str, ApiDef] = {}
    for item in apis:
        try:
            name = item["name"]
            out[name] = ApiDef(
                name=name,
                path=item.get("path", "entry.cgi"),
                min_version=int(item.get("minVersion", 1)),
                max_version=int(item.get("maxVersion", 1)),
            )
        except Exception:
            continue
    return out


def build_markdown(matrix: Dict[str, Any]) -> str:
    stats = matrix["stats"]
    lines: List[str] = []
    lines.append("# ACTIONS_MATRIX")
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Generated at: `{matrix['generatedAt']}`")
    lines.append(f"- DSM base URL: `{matrix['context'].get('baseUrl', 'unknown')}`")
    lines.append(f"- APIs in catalog: **{stats['apisCatalog']}**")
    lines.append(f"- APIs discovered live: **{stats['apisLive']}**")
    lines.append(f"- APIs probed (union): **{stats['apisProbed']}**")
    lines.append(f"- Methods tested: **{stats['methodsTested']}**")
    lines.append(f"- Success responses: **{stats['successCount']}**")
    lines.append(f"- Error responses: **{stats['errorCount']}**")
    lines.append(f"- Skipped (safety): **{stats['skippedCount']}**")
    lines.append("")

    lines.append("## Top valid methods")
    lines.append("")
    top = sorted(matrix["methodStats"].items(), key=lambda kv: kv[1]["success"], reverse=True)
    for method, m in top:
        lines.append(
            f"- `{method}`: success={m['success']}, error={m['error']}, skipped={m['skipped']}"
        )
    lines.append("")

    lines.append("## Coverage stats")
    lines.append("")
    if stats["methodsTested"]:
        coverage = (stats["successCount"] / stats["methodsTested"]) * 100
        lines.append(f"- Success coverage: **{coverage:.2f}%** of tested API-method calls")
    else:
        lines.append("- Success coverage: **0.00%**")

    lines.append("")
    lines.append("## API summary (top 80 by #success)")
    lines.append("")

    api_rows = []
    for api_name, api_data in matrix["apis"].items():
        methods = api_data.get("methods", {})
        succ = sum(1 for m in methods.values() if m.get("status") == "success")
        err = sum(1 for m in methods.values() if m.get("status") == "error")
        skp = sum(1 for m in methods.values() if m.get("status") == "skipped")
        api_rows.append((api_name, succ, err, skp))

    api_rows.sort(key=lambda x: x[1], reverse=True)

    lines.append("| API | success | error | skipped |")
    lines.append("|---|---:|---:|---:|")
    for name, succ, err, skp in api_rows[:80]:
        lines.append(f"| `{name}` | {succ} | {err} | {skp} |")

    lines.append("")
    lines.append("> Note: `error code 101` (missing parameter) often indicates a method likely exists but requires mandatory arguments.")
    return "\n".join(lines) + "\n"


def main() -> None:
    repo_root = Path(__file__).resolve().parents[1]
    default_env = repo_root.parent / "skills" / "synology-api-discovery" / ".env"

    parser = argparse.ArgumentParser(description="Probe Synology API methods safely")
    parser.add_argument("--catalog", default=str(repo_root / "synology-api-catalog.full.json"), help="Path to catalog JSON")
    parser.add_argument("--env-file", default=str(default_env), help="Path to .env with DSM credentials")
    parser.add_argument("--output-json", default=str(repo_root / "ACTIONS_MATRIX.json"), help="Output ACTIONS_MATRIX.json path")
    parser.add_argument("--output-md", default=str(repo_root / "ACTIONS_MATRIX.md"), help="Output ACTIONS_MATRIX.md path")
    parser.add_argument("--allow-destructive", action="store_true", help="Allow probing potentially destructive methods")
    parser.add_argument("--sleep-ms", type=int, default=0, help="Delay between requests")
    args = parser.parse_args()

    catalog_path = Path(args.catalog)
    env_path = Path(args.env_file)
    output_json = Path(args.output_json)
    output_md = Path(args.output_md)

    env = load_env_file(env_path)

    client = SynologyClient(env)
    client.login()

    catalog_apis = load_catalog_apis(catalog_path)
    live_apis = client.list_apis()

    # Union: start from catalog, override with live definitions when available.
    merged: Dict[str, ApiDef] = dict(catalog_apis)
    merged.update(live_apis)

    method_stats = {m: {"success": 0, "error": 0, "skipped": 0} for m in METHOD_CANDIDATES}

    apis_out: Dict[str, Any] = {}
    methods_tested = 0
    success_count = 0
    error_count = 0
    skipped_count = 0

    for api_name in sorted(merged.keys()):
        api = merged[api_name]
        entry = {
            "path": api.path,
            "minVersion": api.min_version,
            "maxVersion": api.max_version,
            "inCatalog": api_name in catalog_apis,
            "discoveredLive": api_name in live_apis,
            "methods": {},
        }

        for method in METHOD_CANDIDATES:
            if (method in DESTRUCTIVE_METHODS) and (not args.allow_destructive):
                entry["methods"][method] = {
                    "status": "skipped",
                    "note": "Skipped by safety policy (potentially destructive); pass --allow-destructive to probe",
                }
                method_stats[method]["skipped"] += 1
                skipped_count += 1
                continue

            methods_tested += 1
            http_status, payload, probe_err = client.probe(api, method, api.max_version)
            result: Dict[str, Any]

            if probe_err:
                result = {"status": "error", "httpStatus": http_status, "error": probe_err}
                error_count += 1
                method_stats[method]["error"] += 1
            else:
                assert payload is not None
                if payload.get("success") is True:
                    result = {
                        "status": "success",
                        "httpStatus": http_status,
                        "success": True,
                        "note": "success",
                    }
                    success_count += 1
                    method_stats[method]["success"] += 1
                else:
                    dsm_error = payload.get("error", {}) if isinstance(payload, dict) else {}
                    code = dsm_error.get("code")
                    note = DSM_CODE_NOTES.get(code, "DSM returned error")
                    result = {
                        "status": "error",
                        "httpStatus": http_status,
                        "success": False,
                        "errorCode": code,
                        "note": note,
                    }
                    if isinstance(dsm_error, dict) and "errors" in dsm_error:
                        result["details"] = dsm_error.get("errors")
                    error_count += 1
                    method_stats[method]["error"] += 1

            entry["methods"][method] = result

            if args.sleep_ms > 0:
                time.sleep(args.sleep_ms / 1000)

        apis_out[api_name] = entry

    matrix = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "context": {
            "baseUrl": client.base_url,
            "allowDestructive": args.allow_destructive,
            "methodCandidates": METHOD_CANDIDATES,
            "destructiveMethods": sorted(list(DESTRUCTIVE_METHODS)),
            "envFile": str(env_path),
            "catalogFile": str(catalog_path),
        },
        "stats": {
            "apisCatalog": len(catalog_apis),
            "apisLive": len(live_apis),
            "apisProbed": len(merged),
            "methodsTested": methods_tested,
            "successCount": success_count,
            "errorCount": error_count,
            "skippedCount": skipped_count,
        },
        "methodStats": method_stats,
        "apis": apis_out,
    }

    output_json.write_text(json.dumps(matrix, ensure_ascii=False, indent=2), encoding="utf-8")
    output_md.write_text(build_markdown(matrix), encoding="utf-8")

    print(
        json.dumps(
            {
                "ok": True,
                "outputJson": str(output_json),
                "outputMd": str(output_md),
                "stats": matrix["stats"],
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
