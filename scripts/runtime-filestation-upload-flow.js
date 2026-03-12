#!/usr/bin/env node
const { DsmClient } = require('../dist/nodes/shared/DsmClient.js');

const creds = {
  baseUrl: process.env.SYNO_DSM_URL,
  username: process.env.SYNO_DSM_USER,
  password: process.env.SYNO_DSM_PASS,
  sessionName: process.env.SYNO_SESSION_NAME || 'FileStation',
  ignoreSslIssues: true,
};

if (!creds.baseUrl || !creds.username || !creds.password) {
  console.error('Missing env: SYNO_DSM_URL, SYNO_DSM_USER, SYNO_DSM_PASS');
  process.exit(1);
}

async function main() {
  const dsm = new DsmClient(creds);
  const root = '/OpenClaw/_archive/node-filestation-tests';
  const folder = `${root}/flow-${Date.now()}`;
  const file = `flow-upload-${Date.now()}.txt`;
  const renamed = `flow-renamed-${Date.now()}.txt`;
  const filePath = `${folder}/${file}`;

  const out = { folder };

  out.createFolder = await dsm.callAuto('SYNO.FileStation.CreateFolder', 'create', {
    folder_path: root,
    name: folder.split('/').pop(),
    force_parent: true,
  });

  out.upload = await dsm.uploadFile(Buffer.from('OpenClaw upload flow test\n', 'utf8'), file, folder, true, true);

  out.rename = await dsm.callAuto('SYNO.FileStation.Rename', 'rename', {
    path: filePath,
    name: renamed,
  });

  out.delete = await dsm.callAuto('SYNO.FileStation.Delete', 'delete', {
    path: JSON.stringify([folder]),
    recursive: true,
  });

  console.log(JSON.stringify({ success: true, out }, null, 2));
}

main().catch((e) => {
  console.error(JSON.stringify({ success: false, error: e?.message || String(e), stack: e?.stack }, null, 2));
  process.exit(1);
});
