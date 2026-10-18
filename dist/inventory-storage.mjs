import {validateBackup} from './core.mjs';
export const INVENTORY_KEY='milai-click-v1';
const request=r=>new Promise((resolve,reject)=>{r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
const finish=tx=>new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('השמירה בוטלה'))});
export async function checksum(raw){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(x=>x.toString(16).padStart(2,'0')).join('')}
export async function checkedSnapshot(value){if(!value||typeof value.raw!=='string'||await checksum(value.raw)!==value.hash)throw Error('בדיקת תקינות השמירה נכשלה');return validateBackup(JSON.parse(value.raw))}
export async function openInventoryStorage({indexedDB=globalThis.indexedDB,local=globalThis.localStorage}={}){
 const r=indexedDB.open('mb-inventory-local-v1',1);r.onupgradeneeded=()=>{for(const name of ['current','backups','handles'])r.result.createObjectStore(name)};const db=await request(r);let revision=0;
 const read=async(store,key)=>{const tx=db.transaction(store,'readonly');return request(tx.objectStore(store).get(key))};
 async function load(){const existing=await read('current','state');if(existing){revision=existing.revision;const state=await checkedSnapshot(existing);return {state,migrated:false}}
  const raw=local.getItem(INVENTORY_KEY);if(!raw)return {state:null,migrated:false};const state=validateBackup(JSON.parse(raw)),hash=await checksum(raw),tx=db.transaction(['current','backups'],'readwrite'),done=finish(tx);
  // Recheck within the atomic transaction: a second tab must never overwrite a completed migration.
  const current=tx.objectStore('current'),get=current.get('state');let raced=false;get.onsuccess=()=>{if(get.result){raced=true;return}current.put({raw,hash,revision:1},'state');tx.objectStore('backups').put({raw,hash,createdAt:Date.now(),kind:'migration'},'original-localStorage')};await done;if(raced)return load();revision=1;local.setItem('mb-inventory-storage-mode','indexeddb');return {state,migrated:true};
 }
 async function save(state){const raw=JSON.stringify(validateBackup(state)),hash=await checksum(raw),expected=revision,tx=db.transaction(['current','backups'],'readwrite'),done=finish(tx),current=tx.objectStore('current'),backups=tx.objectStore('backups');let conflict=false;
  const get=current.get('state');get.onsuccess=()=>{const old=get.result;if((old?.revision||0)!==expected){conflict=true;tx.abort();return}if(old){backups.put({...old,createdAt:Date.now(),kind:'auto'},`${Date.now()}-${crypto.randomUUID()}`)}current.put({raw,hash,revision:expected+1},'state');const keys=backups.getAllKeys();keys.onsuccess=()=>{const auto=keys.result.filter(x=>x!=='original-localStorage').sort();for(const key of auto.slice(0,-3))backups.delete(key)}};
  try{await done}catch(e){if(conflict)throw Error('הנתונים עודכנו בלשונית אחרת. רענן לפני המשך העבודה');throw e}revision=expected+1;
  let warning='';try{local.setItem(INVENTORY_KEY,raw);local.setItem('mb-inventory-storage-mode','indexeddb')}catch{warning='נשמר ב־IndexedDB. עותק התאימות הישן לא עודכן; מומלץ להוריד גיבוי'}return {warning};
 }
 async function recoveryCopies(){const tx=db.transaction('backups','readonly');const rows=await request(tx.objectStore('backups').getAll());const valid=[];for(const x of rows)try{await checkedSnapshot(x);valid.push(x)}catch{}return valid.sort((a,b)=>b.createdAt-a.createdAt)}
 async function setHandle(handle){const tx=db.transaction('handles','readwrite'),done=finish(tx);tx.objectStore('handles').put(handle,'external');await done}
 return {db,load,save,recoveryCopies,setHandle,getHandle:()=>read('handles','external'),close:()=>db.close()};
}
export function mergeInventory(current,incoming,options={}){
 validateBackup(current);validateBackup(incoming);const next=structuredClone(current),added=[];
 for(const s of incoming.sessions){const old=next.sessions.find(x=>x.id===s.id);if(old&&JSON.stringify(old)===JSON.stringify(s))continue;const copy=structuredClone(s);if(old){copy.id=crypto.randomUUID();copy.name=('עותק מגיבוי: '+copy.name).slice(0,80)}next.sessions.push(copy);added.push(copy)}
 if(next.sessions.length>200)throw Error('המיזוג יחרוג ממגבלת 200 הספירות; לא שונו נתונים');
 for(const [code,p] of Object.entries(incoming.custom))if(!next.custom[code])next.custom[code]=structuredClone(p);
 let resumed=false;const target=next.sessions.find(s=>s.id===options.resumeIntoEmpty),source=incoming.sessions.find(s=>s.id===incoming.active);
 // Only an empty authorized session may receive a continuation. The source copy remains in the list.
 if(target&&source&&options.authorizedCountId&&!target.completedAt&&!source.completedAt&&Object.keys(target.items).length===0&&(!source.inventoryYear||source.inventoryYear===options.authorizedSeason)&&(!source.countId||source.countId===options.authorizedCountId)){
  const id=target.id;Object.assign(target,structuredClone(source),{id,countId:options.authorizedCountId,inventoryYear:options.authorizedSeason});resumed=true;
 }
 return {state:validateBackup(next),added,resumed};
}
