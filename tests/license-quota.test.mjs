import test from 'node:test';
import assert from 'node:assert/strict';
import {claimCount,hasAvailableCount,licenseQuota} from '../dist/license-quota.mjs';

function memoryFirestore(initial){
 const data=new Map(Object.entries(initial));let queue=Promise.resolve();
 const ref=(...parts)=>({path:parts.join('/')});
 const snapshot=value=>({exists:()=>value!==undefined,data:()=>value&&structuredClone(value)});
 const s={doc:(_db,...parts)=>ref(...parts),serverTimestamp:()=>1000,runTransaction:async(_db,callback)=>{
  let release;const previous=queue;queue=new Promise(resolve=>release=resolve);await previous;
  try{const writes=[];const tx={get:async r=>snapshot(data.get(r.path)),update:(r,v)=>writes.push(['update',r.path,v]),set:(r,v)=>writes.push(['set',r.path,v])};const result=await callback(tx);const next=new Map(data);
   for(const [op,path,value] of writes){if(op==='update'){const old=next.get(path);if(!old)throw Error('missing account');next.set(path,{...old,...value})}else{if(next.has(path))throw Error('claim exists');next.set(path,structuredClone(value))}}
   const account=next.get('customerAccounts/customer-1');for(const [op,path] of writes.filter(x=>x[0]==='set')){const claim=next.get(path);if(!account||account.countsUsed>(account.countLimit)||account.lastClaimId!==claim.sessionId)throw Error('quota rules denied claim')}
   data.clear();for(const [k,v] of next)data.set(k,v);return result;
  }finally{release()}
 }};
 return {s,db:{},data};
}
const active={uid:'customer-1',businessName:'בדיקת חנות',status:'active',expiresAt:Date.now()+86400000,countLimit:2,countsUsed:0,lastClaimId:''};

test('two sessions consume two slots; a third is blocked; granting one permits it',async()=>{
 const {s,db,data}=memoryFirestore({'customerAccounts/customer-1':active});
 const first={id:'count-1'},second={id:'count-2'},third={id:'count-3'};
 await claimCount(s,db,'customer-1',first);await claimCount(s,db,'customer-1',second);
 assert.equal(data.get('customerAccounts/customer-1').countsUsed,2);
 await assert.rejects(claimCount(s,db,'customer-1',third),/מכסת הספירות נוצלה/);
 const account=data.get('customerAccounts/customer-1');data.set('customerAccounts/customer-1',{...account,countLimit:3});
 await claimCount(s,db,'customer-1',third);assert.equal(data.get('customerAccounts/customer-1').countsUsed,3);
});

test('refresh and duplicate claim for the same session do not consume another slot',async()=>{
 const {s,db,data}=memoryFirestore({'customerAccounts/customer-1':active});const session={id:'stable-session'};
 await claimCount(s,db,'customer-1',session);session.licenseClaimId=undefined;
 await claimCount(s,db,'customer-1',session);assert.equal(data.get('customerAccounts/customer-1').countsUsed,1);assert.equal(session.licenseClaimRequired,true);
});

test('concurrent starts cannot exceed the account quota',async()=>{
 const {s,db,data}=memoryFirestore({'customerAccounts/customer-1':active});
 const results=await Promise.allSettled(['a','b','c'].map(id=>claimCount(s,db,'customer-1',{id})));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,2);assert.equal(data.get('customerAccounts/customer-1').countsUsed,2);
});

test('expiry extension does not change the granted or used count',()=>{
 const account={...active,countsUsed:2,countLimit:3};const extended={...account,expiresAt:Date.now()+60*86400000};
 assert.deepEqual(licenseQuota(extended),{limit:3,used:2});assert.equal(hasAvailableCount(extended),true);
});

test('expired or blocked accounts cannot start, even if quota remains',()=>{
 assert.equal(hasAvailableCount({...active,expiresAt:Date.now()-1}),false);assert.equal(hasAvailableCount({...active,status:'blocked'}),false);
});

 test('one-count license blocks another session before and after completion',async()=>{
 const {s,db,data}=memoryFirestore({'customerAccounts/customer-1':{...active,countLimit:1}});
 const first={id:'only-count',items:{product:{quantity:5}}};
 await claimCount(s,db,'customer-1',first);
 await assert.rejects(claimCount(s,db,'customer-1',{id:'second-before-finish'}),/מכסת הספירות נוצלה/);
 first.completedAt=Date.now();
 await assert.rejects(claimCount(s,db,'customer-1',{id:'second-after-finish'}),/מכסת הספירות נוצלה/);
 assert.equal(data.get('customerAccounts/customer-1').countsUsed,1);
 assert.equal(first.items.product.quantity,5);
});
