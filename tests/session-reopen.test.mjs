import test from 'node:test';
import assert from 'node:assert/strict';
import {synchronizeReopen} from '../dist/session-reopen.mjs';
import {validateBackup} from '../dist/core.mjs';

test('grant reopens the named saved count when another count is on screen; save/reload preserves it',async()=>{
 const target={id:'last-claimed',name:'ספירה שהסתיימה',completedAt:Date.now()+3600000,licenseClaimRequired:true,licenseClaimId:'last-claimed',items:{'123':{code:'123',name:'מוצר',quantity:5,mode:'units',unitPrice:10}}};
 const other={id:'other',name:'ספירה מוצגת אחרת',completedAt:1000,items:{}};
 const state={version:1,active:other.id,sessions:[target,other],custom:{}};
 const before=structuredClone(state),quota={limit:1,used:1};let disk='';
 const access={reopenSessionId:()=>target.id,reopenGrant:async session=>{assert.equal(session,target);return{sessionId:target.id,token:'manager-approved'}}};
 const mutate=async fn=>{fn();disk=JSON.stringify(validateBackup(state));return true};
 assert.equal(await synchronizeReopen({state,access,mutate}),target);
 const loaded=validateBackup(JSON.parse(disk));
 assert.equal(loaded.sessions[0].completedAt,undefined);
 assert.deepEqual(loaded.sessions[0].items,before.sessions[0].items);
 assert.deepEqual(loaded.sessions[1],before.sessions[1]);
 assert.equal(loaded.active,other.id);assert.deepEqual(quota,{limit:1,used:1});
 target.completedAt=Date.now();
 assert.equal(await synchronizeReopen({state,access,mutate}),null);
 assert.ok(target.completedAt);
});

test('absent authorization or absent local data cannot reopen another count',async()=>{
 const state={sessions:[{id:'local',completedAt:1000,items:{}}]};let writes=0;
 const mutate=async()=>{writes++;return true};
 for(const id of [null,'missing'])assert.equal(await synchronizeReopen({state,access:{reopenSessionId:()=>id},mutate}),null);
 assert.equal(writes,0);assert.equal(state.sessions[0].completedAt,1000);
});
