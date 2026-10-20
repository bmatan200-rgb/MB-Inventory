import test from 'node:test';
import assert from 'node:assert/strict';
import {nextCountDetails,attachCountDetails,reportBusiness,buildReportRows} from '../dist/count-presentation.mjs';
import {startSequentialCount} from '../dist/count-flow.mjs';
import {validateBackup} from '../dist/core.mjs';

test('first and second counts in the same year have distinct names; prior items survive a save/reload',async()=>{
 const state={version:1,active:'first',sessions:[{id:'first',name:'הספירה שלי',created:'2026-01-01',items:{}}],custom:{}};
 const now=new Date('2026-10-20T12:00:00Z'),business={name:'מכולת כהן',number:'old-number'};
 const start=async()=>{const details=nextCountDetails(state,business.name,now);return startSequentialCount({state,name:details.name,makeSession:name=>({id:'second',name,created:now.toISOString(),items:{}}),prepareSession:s=>attachCountDetails(s,details,business),access:{canStart:()=>true,acquire:async s=>{s.licenseClaimRequired=true;s.licenseClaimId=s.id;return true}},mutate:async fn=>{fn();return true}})};
 await start();assert.equal(state.sessions[0].name,'מכולת כהן — ספירה 1 — 2026');assert.equal(state.sessions[0].reportBusiness.number,'');
 state.sessions[0].items['000123']={code:'000123',name:'חלב',mode:'units',quantity:4,unitPrice:5,updated:now.toISOString()};state.sessions[0].completedAt=now.getTime();
 await start();assert.equal(state.sessions[1].name,'מכולת כהן — ספירה 2 — 2026');assert.deepEqual(state.sessions[1].items,{});
 const reloaded=validateBackup(JSON.parse(JSON.stringify(state)));assert.equal(reloaded.sessions[0].items['000123'].quantity,4);assert.equal(reloaded.sessions[0].name,'מכולת כהן — ספירה 1 — 2026');
});
test('new year restarts numbering; long business names fit existing backup format',()=>{
 const state={sessions:[{created:'2026-01-01',inventoryYear:2026,countSequence:5,items:{},completedAt:1}]};
 const details=nextCountDetails(state,'א'.repeat(100),new Date('2027-02-01'));assert.equal(details.countSequence,1);assert.equal(details.inventoryYear,2027);assert.ok(details.name.length<=80);
});
test('optional business number keeps the report field, all item columns, totals and text barcodes',()=>{
 const session={name:'ספירה 1 — 2026',inventoryYear:2026,items:{a:{code:'000123',name:'חלב',quantity:2,mode:'units',unitPrice:5},b:{code:'456',name:'אגוזים',quantity:1.5,mode:'weight',unitPrice:10}}};
 for(const number of ['', '123456789']){const {data,headerIndex}=buildReportRows({session,business:{name:'עסק בדיקה',number}});assert.deepEqual(data.find(r=>r[0]==='מספר עוסק / ח.פ.'),['מספר עוסק / ח.פ.',number]);assert.equal(data.find(r=>r[0]==='שווי מוצרים עם מחיר ללא מע״מ (₪)')[1],25);assert.equal(data[headerIndex].length,5);assert.equal(data[headerIndex+1][0],'000123');assert.equal(data.length-headerIndex-1,2)}
});
test('historical business snapshot is not overwritten by another account or new profile name',()=>{
 const s={reportBusiness:{name:'עסק ישן',number:'123'}};assert.equal(reportBusiness(s,{name:'מקומי'},{name:'חשבון אחר'}).name,'עסק ישן');
 assert.equal(reportBusiness({}, {name:'מקומי'}, {name:'מהחשבון'}).name,'מהחשבון');
});
