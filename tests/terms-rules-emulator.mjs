// Run only with the local Firestore emulator and a demo project.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {TERMS_ID,TERMS_SHA256,TERMS_TEXT} from '../dist/terms-data.mjs';
const root=process.env.INVENTORY_TEST_MODULES;
const {createRequire}=await import('node:module');
const require=createRequire(root?`${root}/package.json`:import.meta.url);
const {initializeTestEnvironment,assertSucceeds,assertFails}=require('@firebase/rules-unit-testing');
const sdk=require('firebase/firestore');
const {doc,setDoc,getDoc,updateDoc,deleteDoc,writeBatch,serverTimestamp,Timestamp,runTransaction}=sdk;
if(!process.env.FIRESTORE_EMULATOR_HOST)throw Error('FIRESTORE_EMULATOR_HOST is required; production execution is forbidden');
const env=await initializeTestEnvironment({projectId:'demo-milai-terms',firestore:{rules:await readFile(new URL('../firestore.rules',import.meta.url),'utf8')}});
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS',name)};
const receipt=uid=>({uid,accepted:true,termsId:TERMS_ID,termsSha256:TERMS_SHA256,termsText:TERMS_TEXT,acceptedAt:serverTimestamp()});
const account=uid=>({uid,email:`${uid}@example.invalid`,businessName:'בדיקה',status:'pending',expiresAt:0,countLimit:1,countsUsed:0,lastClaimId:'',createdAt:serverTimestamp()});
try{
 await env.withSecurityRulesDisabled(async c=>{await setDoc(doc(c.firestore(),'settings','accountOwner'),{uid:'owner'})});
 const db=env.authenticatedContext('new',{email:'new@example.invalid'}).firestore(),ar=doc(db,'customerAccounts','new'),rr=doc(db,'customerAccounts','new','termsAcceptances',TERMS_ID);
 await check('registration without a receipt is denied',()=>assertFails(setDoc(ar,account('new'))));
 await check('account and complete consent commit atomically',async()=>{const b=writeBatch(db);b.set(ar,account('new'));b.set(rr,receipt('new'));await assertSucceeds(b.commit())});
 await check('owner can read the receipt',()=>assertSucceeds(getDoc(rr)));
 await check('another customer cannot read or create this customer receipt',async()=>{const other=env.authenticatedContext('other',{email:'other@example.invalid'}).firestore();await assertFails(getDoc(doc(other,'customerAccounts','new','termsAcceptances',TERMS_ID)));await assertFails(setDoc(doc(other,'customerAccounts','new','termsAcceptances','fake'),receipt('other')))});
 await check('receipt cannot be updated or deleted by its user',async()=>{await assertFails(updateDoc(rr,{termsText:'changed'}));await assertFails(deleteDoc(rr))});
 const owner=env.authenticatedContext('owner').firestore();await check('manager can read but cannot rewrite an approval',async()=>{const r=doc(owner,'customerAccounts','new','termsAcceptances',TERMS_ID);await assertSucceeds(getDoc(r));await assertFails(updateDoc(r,{acceptedAt:Timestamp.now()}))});
 await env.withSecurityRulesDisabled(async c=>{const d=c.firestore();await setDoc(doc(d,'customerAccounts','existing'),{...account('existing'),status:'active',expiresAt:Date.now()+86400000,countLimit:2,countsUsed:1,lastClaimId:'old'});await setDoc(doc(d,'customerAccounts','existing','countClaims','old'),{sessionId:'old',createdAt:Timestamp.now()})});
 const edb=env.authenticatedContext('existing',{email:'existing@example.invalid'}).firestore(),er=doc(edb,'customerAccounts','existing','termsAcceptances',TERMS_ID);
 await check('changed body, hash, timestamp, uid or extra fields are rejected',async()=>{for(const patch of [{termsText:'changed'},{termsSha256:'fake'},{acceptedAt:Timestamp.fromMillis(1)},{uid:'other'},{extra:'data'},{accepted:false}])await assertFails(setDoc(er,{...receipt('existing'),...patch}))});
 const claim=()=>runTransaction(edb,async tx=>{const a=doc(edb,'customerAccounts','existing'),r=doc(edb,'customerAccounts','existing','countClaims','next'),snap=await tx.get(a);tx.update(a,{countsUsed:snap.data().countsUsed+1,lastClaimId:'next'});tx.set(r,{sessionId:'next',createdAt:serverTimestamp()})});
 await check('new quota claim before consent is denied',()=>assertFails(claim()));
 await check('existing customer accepts without changing its license',async()=>{const a=doc(edb,'customerAccounts','existing'),before=(await getDoc(a)).data();await assertSucceeds(setDoc(er,receipt('existing')));assert.deepEqual((await getDoc(a)).data(),before)});
 await check('valid quota transaction still succeeds after consent',()=>assertSucceeds(claim()));
 await check('quota cannot be inflated after consent',()=>assertFails(updateDoc(doc(edb,'customerAccounts','existing'),{countLimit:999})));
 await check('manager expiry update preserves normal license rules',()=>assertSucceeds(updateDoc(doc(owner,'customerAccounts','existing'),{expiresAt:Date.now()+2*86400000,updatedAt:serverTimestamp()})));
 console.log(`${passed} emulator security scenarios passed`);
}finally{await env.cleanup()}
