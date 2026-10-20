import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {licenseQuota,hasAvailableCount,claimCount} from '../dist/license-quota.mjs';
import {synchronizeReopen} from '../dist/session-reopen.mjs';

class Element {
 constructor(){this.children=[];this.nodes=new Map();this.dataset={};this.elements={businessName:{},password:{}};this.textContent='';}
 append(...nodes){this.children.push(...nodes)} prepend(...nodes){this.children.unshift(...nodes)}
 querySelector(key){if(!this.nodes.has(key))this.nodes.set(key,new Element());return this.nodes.get(key)}
 setAttribute(){} addEventListener(){} showModal(){} close(){}
}

test('real client access code receives a manager snapshot, unlocks the existing count, and denies replay',async()=>{
 const root=new Element(),events=new EventTarget(),document={body:root,hidden:false,createElement:()=>new Element(),querySelector:key=>root.querySelector(key),dispatchEvent:event=>events.dispatchEvent(event),addEventListener:(...args)=>events.addEventListener(...args)};
 let account={status:'active',expiresAt:Date.now()+86400000,countLimit:1,countsUsed:1,lastClaimId:'existing'};
 let listen;const snap=data=>({exists:()=>true,data:()=>({...data}),metadata:{fromCache:false}});
 const sdk={doc:(_,...parts)=>parts.join('/'),getDocFromServer:async ref=>snap(ref.includes('/countClaims/')?{sessionId:'existing'}:account),onSnapshot:(_ref,_options,callback)=>{listen=callback;callback(snap(account));return()=>{}}};
 const context={s:sdk,connect:async()=>({db:{},auth:{currentUser:{uid:'customer'}}}),eligible:a=>a?.status==='active'&&a.expiresAt>Date.now(),message:e=>e.message,
  licenseQuota,hasAvailableCount,claimCount,document,navigator:{onLine:true},window:{addEventListener(){}},CustomEvent,Date,Number,Math,Set,setInterval(){}};
 const source=(await readFile(new URL('../dist/account-access.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/gm,'').replace('export async function','async function');
 const init=vm.runInNewContext(source+'\ninitFirebaseLicense',context);
 const access=await init();for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
 const target={id:'existing',name:'ספירה',licenseClaimRequired:true,licenseClaimId:'existing',completedAt:Date.now()+3600000,items:{keep:{quantity:8}}};
 const state={sessions:[target]};let saved;
 const mutate=async fn=>{fn();saved=JSON.parse(JSON.stringify(state));return true};
 assert.equal(access.canWrite(target),false);
 assert.equal(await synchronizeReopen({state,access,mutate}),null);
 account={...account,reopenClaimId:'existing',reopenToken:'grant-1'};listen(snap(account));
 assert.equal(await synchronizeReopen({state,access,mutate}),target);
 assert.equal(access.canWrite(target),true);assert.equal(access.canStart(),false);
 assert.equal(saved.sessions[0].items.keep.quantity,8);assert.equal(account.countsUsed,1);
 target.completedAt=Date.now();target.reopenClosedToken=access.currentReopenToken();
 assert.equal(await synchronizeReopen({state,access,mutate}),null);assert.equal(access.canWrite(target),false);
 account={...account,reopenToken:'grant-2'};listen(snap(account));
 assert.equal(await synchronizeReopen({state,access,mutate}),target);assert.equal(access.canWrite(target),true);
});
