import {checksum} from './inventory-storage.mjs';
export async function saveExternalCopies(directory,state){
 if(await directory.queryPermission({mode:'readwrite'})!=='granted')throw Error('לא נשמר גיבוי חיצוני: אין הרשאת כתיבה לתיקייה');
 const raw=JSON.stringify(state),hash=await checksum(raw),scope=(await checksum(state.business?.number||'local')).slice(0,12),prefix=`MB-Inventory-${scope}-`,latest=`${prefix}latest.json`;
 async function write(name){const h=await directory.getFileHandle(name,{create:true}),w=await h.createWritable();await w.write(raw);await w.close();if(await checksum(await(await h.getFile()).text())!==hash)throw Error('בדיקת הגיבוי החיצוני נכשלה')}
 await write(latest);
 // Remove only timestamped copies made by older versions, after the new file is verified.
 for await(const [name,handle] of directory.entries())if(handle.kind==='file'&&name.startsWith(prefix)&&/^[0-9TZ._-]+\.json$/.test(name.slice(prefix.length)))await directory.removeEntry(name);
 return {copies:1,savedAt:Date.now()};
}
