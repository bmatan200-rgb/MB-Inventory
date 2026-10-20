import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {saveAcceptance,readAcceptance,acceptanceMatches} from '../dist/terms-acceptance.mjs';
import {TERMS_ID,TERMS_SHA256,TERMS_TEXT} from '../dist/terms-data.mjs';

function backend(initial={}){
 const data=new Map(Object.entries(initial));let writes=0,timestamp=100;
 const snap=value=>({exists:()=>value!==undefined,data:()=>structuredClone(value)});
 const s={doc:(_,...p)=>p.join('/'),serverTimestamp:()=>({serverTime:++timestamp}),getDocFromServer:async ref=>snap(data.get(ref)),runTransaction:async(_,fn)=>{
  const pending=[];await fn({get:async ref=>snap(data.get(ref)),set:(ref,value)=>pending.push([ref,value])});
  for(const [ref,value] of pending){data.set(ref,structuredClone(value));writes++}
 }};
 return {s,data,writes:()=>writes};
}
test('new account and immutable receipt are saved together without extra identity fields',async()=>{
 const b=backend(),account={uid:'new',email:'demo@example.invalid',businessName:'בדיקה',status:'pending',expiresAt:0,countLimit:1,countsUsed:0,lastClaimId:''};
 const receipt=await saveAcceptance(b.s,{},'new',account);assert.ok(acceptanceMatches(receipt,'new'));assert.equal(receipt.termsText,TERMS_TEXT);assert.ok(receipt.acceptedAt.serverTime);
 assert.equal(b.data.get('customerAccounts/new').countLimit,1);assert.equal(b.data.get('customerAccounts/new').countsUsed,0);assert.equal(b.writes(),2);
 assert.deepEqual(Object.keys(receipt).sort(),['uid','accepted','termsId','termsSha256','termsText','acceptedAt'].sort());
 const original=structuredClone(receipt);await saveAcceptance(b.s,{},'new',account);assert.equal(b.writes(),2);assert.deepEqual(await readAcceptance(b.s,{},'new'),original);
});
test('existing account keeps expiry, quotas and reopen grants when accepting terms',async()=>{
 const original={uid:'existing',email:'x@example.invalid',businessName:'עסק',status:'active',expiresAt:9999999999999,countLimit:2,countsUsed:2,lastClaimId:'last',reopenToken:'grant',reopenClaimId:'last'};
 const b=backend({'customerAccounts/existing':original});await saveAcceptance(b.s,{},'existing');assert.deepEqual(b.data.get('customerAccounts/existing'),original);assert.equal(b.writes(),1);
 assert.equal(acceptanceMatches(await readAcceptance(b.s,{},'existing'),'someone-else'),false);
});
test('malformed existing receipt is never silently replaced',async()=>{
 const path=`customerAccounts/u/termsAcceptances/${TERMS_ID}`,bad={uid:'u',accepted:true,termsText:'changed'};
 const b=backend({'customerAccounts/u':{uid:'u'},[path]:bad});await assert.rejects(saveAcceptance(b.s,{},'u'),/לא ניתן לאמת/);assert.deepEqual(b.data.get(path),bad);assert.equal(b.writes(),0);
});
test('published hash and Firestore validation bind the receipt to the complete approved text',async()=>{
 assert.equal(createHash('sha256').update(TERMS_TEXT).digest('hex'),TERMS_SHA256);
 const rules=await readFile(new URL('../firestore.rules',import.meta.url),'utf8');assert.ok(rules.includes(JSON.stringify(TERMS_TEXT)));assert.ok(rules.includes(TERMS_SHA256));
 assert.ok(rules.includes('acceptedTermsAfter(uid)'));assert.ok(rules.includes('termsText == approvedTermsText()'));assert.ok(rules.includes('acceptedAt == request.time'));
});
