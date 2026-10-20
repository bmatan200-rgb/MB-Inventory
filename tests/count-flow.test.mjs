import test from 'node:test';
import assert from 'node:assert/strict';
import {startSequentialCount,assertCanBeginCount} from '../dist/count-flow.mjs';
import {applyReopenGrant} from '../dist/license-quota.mjs';

function flow(sessions){
 const state={active:sessions[0].id,sessions};let acquired=0;
 const access={canStart:()=>true,acquire:async session=>{acquired++;session.licenseClaimId=session.id;return true}};
 const args={state,name:'חדשה',makeSession:name=>({id:'new',name,items:{}}),access,mutate:async fn=>{fn();return true}};
 return{state,args,acquired:()=>acquired};
}
test('extra quota does not permit a new count while an existing count is unfinished',async()=>{
 const first={id:'old',name:'קיימת',items:{'123':{quantity:7}},licenseClaimRequired:true},f=flow([first]),before=structuredClone(f.state);
 await assert.rejects(startSequentialCount(f.args),/יש לסיים קודם/);
 assert.equal(f.acquired(),0);assert.deepEqual(f.state,before);
 first.completedAt=1000;await startSequentialCount(f.args);
 assert.equal(f.acquired(),1);assert.equal(f.state.sessions.length,2);assert.equal(first.items['123'].quantity,7);
});
test('the first blank draft is reused; an empty licensed count still blocks another',async()=>{
 const draft={id:'draft',name:'הספירה שלי',items:{}},f=flow([draft]);
 await startSequentialCount(f.args);assert.equal(f.state.sessions.length,1);assert.equal(draft.name,'חדשה');
 await assert.rejects(startSequentialCount(f.args),/יש לסיים קודם/);assert.equal(f.acquired(),1);
});
test('historical multiple unfinished counts stay intact and must be finished before another start',async()=>{
 const sessions=[{id:'a',name:'א',licenseClaimRequired:true,items:{}},{id:'b',name:'ב',licenseClaimRequired:true,items:{}}],f=flow(sessions);
 sessions[0].completedAt=1000;
 await assert.rejects(startSequentialCount(f.args),/יש לסיים קודם/);assert.equal(f.state.sessions.length,2);
 sessions[1].completedAt=1000;await startSequentialCount(f.args);assert.equal(f.state.sessions.length,3);
});
test('reopening an existing count blocks a new start and cannot be bypassed using a blank draft',()=>{
 const closed={id:'closed',name:'ישנה',completedAt:1000,licenseClaimRequired:true,items:{}};
 applyReopenGrant(closed,{sessionId:closed.id,token:'manager'});
 const state={sessions:[closed,{id:'draft',name:'ריקה',items:{}}]};
 assert.throws(()=>assertCanBeginCount(state,'draft'),/יש לסיים קודם/);
});
