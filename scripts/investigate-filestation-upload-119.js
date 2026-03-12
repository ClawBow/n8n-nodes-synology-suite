#!/usr/bin/env node
const axios = require('axios');
const https = require('https');

const baseUrl = process.env.SYNO_DSM_URL;
const username = process.env.SYNO_DSM_USER;
const password = process.env.SYNO_DSM_PASS;
const session = process.env.SYNO_SESSION_NAME || 'FileStation';

if (!baseUrl || !username || !password) {
  console.error('Missing env: SYNO_DSM_URL, SYNO_DSM_USER, SYNO_DSM_PASS');
  process.exit(1);
}

const client = axios.create({
  timeout: 60000,
  httpsAgent: new https.Agent({ rejectUnauthorized: false }),
  validateStatus: () => true,
});

function q(v) { return v === undefined || v === null ? '' : String(v); }

function buildMultipart(parts, boundary) {
  const chunks = [];
  for (const p of parts) {
    chunks.push(Buffer.from(`--${boundary}\r\n`));
    if (p.filename) {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"; filename="${p.filename}"\r\n`));
      chunks.push(Buffer.from(`Content-Type: ${p.contentType || 'application/octet-stream'}\r\n\r\n`));
      chunks.push(Buffer.isBuffer(p.value) ? p.value : Buffer.from(String(p.value)));
      chunks.push(Buffer.from('\r\n'));
    } else {
      chunks.push(Buffer.from(`Content-Disposition: form-data; name="${p.name}"\r\n\r\n${q(p.value)}\r\n`));
    }
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(chunks);
}

async function login() {
  const { data } = await client.get(`${baseUrl}/webapi/entry.cgi`, {
    params: {
      api: 'SYNO.API.Auth',
      version: '7',
      method: 'login',
      account: username,
      passwd: password,
      session,
      format: 'sid',
    },
  });
  if (!data?.success) throw new Error(`Login failed: ${JSON.stringify(data)}`);
  return data.data.sid;
}

async function apiInfo(sid) {
  const { data } = await client.get(`${baseUrl}/webapi/entry.cgi`, {
    params: { api: 'SYNO.API.Info', version: '1', method: 'query', query: 'SYNO.FileStation.Upload', _sid: sid },
  });
  return data?.data?.['SYNO.FileStation.Upload'] || null;
}

async function uploadVariant({ sid, label, path, fileName, includeSidQuery, includeSidField, version, method = 'upload' }) {
  const boundary = `----oc-${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  const parts = [
    { name: 'api', value: 'SYNO.FileStation.Upload' },
    { name: 'version', value: String(version) },
    { name: 'method', value: method },
    { name: 'path', value: path },
    { name: 'create_parents', value: 'true' },
    { name: 'overwrite', value: 'true' },
  ];
  if (includeSidField) parts.push({ name: '_sid', value: sid });
  parts.push({ name: 'file', filename: fileName, contentType: 'text/plain', value: Buffer.from(`hello ${Date.now()}\n`) });

  const body = buildMultipart(parts, boundary);

  const { data } = await client.post(`${baseUrl}/webapi/entry.cgi`, body, {
    params: includeSidQuery ? { _sid: sid } : {},
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    maxBodyLength: Infinity,
  });

  const code = data?.error?.code;
  return { label, success: data?.success === true, code: code ?? null, raw: data };
}

async function main() {
  const testDir = '/OpenClaw/_archive/node-filestation-tests';
  const sid = await login();
  const info = await apiInfo(sid);
  const maxVersion = Number(info?.maxVersion || 2);

  const variants = [
    { label: 'A_no_sid', includeSidQuery: false, includeSidField: false, version: Math.min(2, maxVersion) },
    { label: 'B_sid_query_v2', includeSidQuery: true, includeSidField: false, version: 2 },
    { label: 'C_sid_form_v2', includeSidQuery: false, includeSidField: true, version: 2 },
    { label: 'D_sid_both_v2', includeSidQuery: true, includeSidField: true, version: 2 },
    { label: 'E_sid_query_v3', includeSidQuery: true, includeSidField: false, version: Math.min(3, maxVersion) },
  ];

  const results = [];
  for (const v of variants) {
    const r = await uploadVariant({
      sid,
      label: v.label,
      path: testDir,
      fileName: `${v.label}.txt`,
      includeSidQuery: v.includeSidQuery,
      includeSidField: v.includeSidField,
      version: v.version,
    });
    results.push(r);
  }

  console.log(JSON.stringify({
    baseUrl,
    session,
    uploadApi: info,
    results: results.map(r => ({ label: r.label, success: r.success, code: r.code })),
  }, null, 2));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(1);
});
