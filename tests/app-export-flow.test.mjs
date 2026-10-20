// Executes the real app event handlers and XLSX writer. DOM and storage are
// isolated doubles; this does not replace a real browser/IndexedDB smoke test.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import * as core from '../dist/core.mjs';
import * as flow from '../dist/count-flow.mjs';
import * as presentation from '../dist/count-presentation.mjs';
import {synchronizeReopen} from '../dist/session-reopen.mjs';
import {rightAlignXlsx} from '../dist/xlsx-rtl.mjs';

const source=(await readFile(new URL('../dist/app.js',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
const html=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');
const xlsxSource=await readFile(new URL('../dist/vendor/xlsx.min.js',import.meta.url),'utf8');
async function app(environment){
 const nodes=new Map(),downloads=[],requests=[],errors=[];
 class Element{
  constructor(){this.value='';this.textContent='';this.children=[];this.open=false;this.classList={add(){},remove(){}};this.dataset={};}
  set id(value){nodes.set(value,this)}
  append(...children){this.children.push(...children)} prepend(...children){this.children.unshift(...children)}
  querySelector(){return new Element()} setAttribute(){} addEventListener(){} focus(){} reset(){}
  showModal(){this.open=true} close(){this.open=false} click(){return this.onclick?.()}
 }
 for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,new Element());
 const roots=new Map();const document={body:new Element(),getElementById:id=>nodes.get(id),createElement:()=>new Element(),addEventListener(){},querySelector:key=>{if(key==='dialog[open]')return null;if(!roots.has(key))roots.set(key,new Element());return roots.get(key)}};
 const access={business:{name:'עסק בדיקה'},canStart:()=>environment.used<environment.limit,
  canWrite:s=>!s.completedAt,acquire:async s=>{if(environment.claims.has(s.id))return true;if(!access.canStart())return false;environment.used++;environment.claims.add(s.id);s.licenseClaimRequired=true;s.licenseClaimId=s.id;return true},reopenGrant:async()=>null,currentReopenToken:()=>'',finish:async s=>s.completedAt};
 const storage={load:async()=>({state:structuredClone(environment.saved)}),getHandle:async()=>null,save:async s=>{core.validateBackup(s);environment.saved=structuredClone(s);return{}},recoveryCopies:async()=>[]};
 const context={...core,...flow,...presentation,synchronizeReopen,rightAlignXlsx,document,milaiAccess:access,
  initFirebaseLicense:async()=>access,openInventoryStorage:async()=>storage,saveExternalCopies:async()=>{},
  navigator:{onLine:true,storage:{}},window:{addEventListener(){}},matchMedia:()=>({matches:false}),
  localStorage:{getItem:()=>null},alert:message=>errors.push(message),confirm:()=>true,
  fetch:async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>[]}},
  URL:{createObjectURL:blob=>{downloads.push(blob);return'blob:test'},revokeObjectURL(){}},
  crypto:globalThis.crypto,Blob,structuredClone,Intl,Date,Number,Math,Map,Set,Promise,Error,
  setTimeout(){return 1},clearTimeout(){},console};
 vm.createContext(context);vm.runInContext(xlsxSource,context);
 const result=await vm.runInContext('(async()=>{'+source+'\nreturn {state:()=>state,openProduct};})()',context);
 return{nodes,downloads,requests,errors,...result,XLSX:context.XLSX};
}
const submit={preventDefault(){}};
async function addItem(a,code,quantity){await a.openProduct(code);a.nodes.get('productName').value='מוצר בדיקה';a.nodes.get('mode').value='units';a.nodes.get('quantity').value=String(quantity);a.nodes.get('unitPrice').value='7.5';a.nodes.get('operation').value='add';await a.nodes.get('productForm').onsubmit(submit)}
async function start(a){a.nodes.get('newSession').onclick();await a.nodes.get('sessionForm').onsubmit(submit)}
async function exportReport(a,number){a.nodes.get('export').onclick();assert.equal(a.nodes.get('businessName').value,'עסק בדיקה');assert.equal(a.nodes.get('businessName').readOnly,true);a.nodes.get('businessNumber').value=number;await a.nodes.get('businessForm').onsubmit(submit);const bytes=Buffer.from(await a.downloads.at(-1).arrayBuffer());const wb=a.XLSX.read(bytes,{type:'buffer'});return a.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''})}

test('actual app handlers: quotas, auto names, archive, export with/without number, reload and preservation',async()=>{
 const env={saved:null,used:0,limit:2,claims:new Set()},a=await app(env);
 assert.equal(a.nodes.has('internalMode'),false);assert.equal(a.nodes.has('businessMode'),false);
 assert.equal(html.includes('id="businessNumber" type="text" inputmode="numeric" maxlength="24" dir="ltr" placeholder="אפשר להשאיר ריק"'),true);
 assert.equal(a.nodes.get('businessDialog').open,false);
 await addItem(a,'000123',4);const first=a.state().sessions[0];assert.match(first.name,/עסק בדיקה — ספירה 1/);assert.equal(env.used,1);
 await start(a);assert.equal(a.state().sessions.length,1);assert.equal(env.used,1);
 let rows=await exportReport(a,'');assert.equal(rows.find(r=>r[0]==='מספר עוסק / ח.פ.')[1],'');assert.equal(rows.at(-1)[0],'000123');assert.equal(rows.at(-1)[2],4);
 rows=await exportReport(a,'987654321');assert.equal(rows.find(r=>r[0]==='מספר עוסק / ח.פ.')[1],'987654321');assert.equal(env.used,1);
 await a.nodes.get('finishCount').onclick();await start(a);assert.equal(a.state().sessions.length,2);assert.equal(env.used,2);assert.match(a.state().sessions[1].name,/ספירה 2/);assert.equal(Object.keys(a.state().sessions[1].items).length,0);
 await addItem(a,'456',3);assert.equal(env.used,2);await a.nodes.get('finishCount').onclick();await start(a);assert.equal(a.state().sessions.length,2);
 env.limit++;await start(a);assert.equal(a.state().sessions.length,3);assert.equal(env.used,3);
 const reloaded=await app(env);assert.equal(reloaded.state().sessions.length,3);assert.equal(reloaded.state().sessions[0].items['000123'].quantity,4);assert.equal(reloaded.state().sessions[1].items['456'].quantity,3);assert.equal(reloaded.state().sessions[0].reportBusiness.number,'987654321');assert.equal(reloaded.state().sessions[2].reportBusiness.number,'');assert.equal(env.used,3);
 assert.equal(a.requests.length,1);assert.equal(a.requests[0].url,'catalog.json');assert.equal(JSON.stringify(a.requests).includes('987654321'),false);assert.deepEqual(a.errors,[]);assert.deepEqual(reloaded.errors,[]);
});
test('loading existing local counts does not rename, delete or alter historical products',async()=>{
 const legacy={version:1,active:'old',sessions:[{id:'old',name:'שם ספירה קיים',created:'2025-01-01',completedAt:1,items:{'123':{code:'123',name:'מוצר ישן',mode:'units',quantity:9,unitPrice:null,updated:'2025-01-01'}}}],custom:{},business:{name:'שם ישן',number:'123456789'}};
 const env={saved:structuredClone(legacy),used:0,limit:1,claims:new Set()},a=await app(env);assert.deepEqual(JSON.parse(JSON.stringify(a.state().sessions)),legacy.sessions);assert.equal(a.state().business.number,'123456789');
});
