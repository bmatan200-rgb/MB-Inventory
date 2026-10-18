import {checksum} from './inventory-storage.mjs';
import {validateBackup} from './core.mjs';
export async function saveExternalCopies(directory,state){
 if(await directory.queryPermission({mode:'readwrite'})!=='granted')throw Error('לא נשמר גיבוי חיצוני: אין הרשאת כתיבה לתיקייה');
 const raw=JSON.stringify(state),hash=await checksum(raw),stamp=new Date().toISOString().replace(/[:.]/g,'-'),scope=(await checksum(state.business?.number||'local')).slice(0,12),prefix=`MB-Inventory-${scope}-`;
 async function write(name){const h=await directory.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(raw);await w.close();if(await checksum(await(await h.getFile()).text())!==hash)throw Error('בדיקת הגיבוי החיצוני נכשלה')}
 await write(`${prefix}${stamp}.json`);let names=[];for await(const [name,handle] of directory.entries())if(handle.kind==='file'&&name.startsWith(prefix)&&/^[0-9TZ._-]+\.json$/.test(name.slice(prefix.length))){try{validateBackup(JSON.parse(await(await(await directory.getFileHandle(name)).getFile()).text()));names.push(name)}catch{}}names.sort();
 // Seed three independently readable files on the first backup; then rotate only our own files.
 for(let i=names.length;i<3;i++){const name=`${prefix}${stamp}_${i}.json`;await write(name);names.push(name)}names.sort();for(const name of names.slice(0,-3))await directory.removeEntry(name);
 return {copies:3,savedAt:Date.now()};
}
