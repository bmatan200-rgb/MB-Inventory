import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

class Element{
 constructor(){this.children=[];this.value='';this.textContent='';}
 append(...nodes){this.children.push(...nodes)}
 replaceChildren(...nodes){this.children=[...nodes]}
}
const find=(root,text)=>root.textContent===text?root:root.children.map(n=>find(n,text)).find(Boolean);

test('actual admin handler asks confirmation; cancel writes nothing; accept grants reopening only',async()=>{
 const nodes=new Map(['message','login','panel','cards','search','logout','refresh'].map(id=>[id,new Element()]));
 const account={businessName:'עסק בדיקה',email:'test@example.invalid',status:'active',expiresAt:Date.now()+86400000,countLimit:1,countsUsed:1,lastClaimId:'existing-count'};
 let confirmations=0,accept=false,writes=0;
 const snapshot=data=>({exists:()=>true,data:()=>structuredClone(data)});
 const s={doc:(_,...parts)=>parts.join('/'),collection:()=>'',query:()=>'',limit:()=>0,serverTimestamp:()=>12345,
  getDocFromServer:async()=>snapshot({uid:'manager'}),
  getDocs:async()=>({docs:[{id:'customer',data:()=>structuredClone(account)}]}),
  runTransaction:async(_,fn)=>fn({get:async()=>snapshot(account),update:(_,patch)=>{writes++;Object.assign(account,patch)}})};
 const context={document:{getElementById:id=>nodes.get(id),createElement:()=>new Element()},s,connect:async()=>({db:{},auth:{currentUser:{uid:'manager'}}}),message:e=>e.message,
  confirm:()=>{confirmations++;return accept},crypto:{randomUUID:()=> 'unique-reopen-token'},location:{reload(){}},Date,Number,Math,Error};
 const code=(await readFile(new URL('../dist/manage/admin.mjs',import.meta.url),'utf8')).replace(/^import .*;\n/,'');
 vm.runInNewContext(code,context);
 for(let i=0;i<5;i++)await new Promise(resolve=>setImmediate(resolve));
 let button=find(nodes.get('cards'),'פתח מחדש ספירה אחרונה');assert.ok(button);assert.equal(button.disabled,false);
 await button.onclick();assert.equal(confirmations,1);assert.equal(writes,0);
 accept=true;await button.onclick();assert.equal(confirmations,2);assert.equal(writes,1);
 assert.equal(account.reopenClaimId,'existing-count');assert.equal(account.reopenToken,'unique-reopen-token');assert.equal(account.reopenGrantedAt,12345);
 assert.equal(account.countLimit,1);assert.equal(account.countsUsed,1);
 account.lastClaimId='';await nodes.get('refresh').onclick();button=find(nodes.get('cards'),'פתח מחדש ספירה אחרונה');assert.equal(button.disabled,true);
});
