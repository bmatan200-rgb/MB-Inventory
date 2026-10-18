export function validCode(code){return typeof code==='string'&&/^\d{1,32}$/.test(code)}
export function applyItem(session,item,operation='add'){
 if(!validCode(item.code)||typeof item.name!=='string'||!item.name.trim()||item.name.length>180)throw Error('יש להזין ברקוד ספרתי ושם מוצר');
 if(!['units','weight'].includes(item.mode)||!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>1e9)throw Error('יש להזין כמות גדולה מאפס');
 if(item.mode==='units'&&!Number.isInteger(item.quantity))throw Error('בספירה ביחידות יש להזין מספר שלם');
 const old=session.items[item.code];
 if(old&&operation==='add'&&old.mode!==item.mode)throw Error('כדי לשנות בין יחידות למשקל, בחר החלפת הכמות הקיימת');
 const quantity=Math.round((item.quantity+(old&&operation==='add'?old.quantity:0))*1000000)/1000000;
 if(quantity>1e9)throw Error('הכמות גדולה מדי');
 const unitPrice=item.unitPrice===undefined?(old?.unitPrice??null):item.unitPrice;
 if(unitPrice!==null&&(!Number.isFinite(unitPrice)||unitPrice<0||unitPrice>1e9))throw Error('יש להזין מחיר תקין ללא מע״מ, אפס ומעלה');
 session.items[item.code]={code:item.code,name:item.name.trim(),mode:item.mode,quantity,unitPrice:unitPrice===null?null:Math.round(unitPrice*100)/100,updated:new Date().toISOString()};
}
export function validateBackup(data){
 if(!data||data.version!==1||!Array.isArray(data.sessions)||!data.sessions.length||data.sessions.length>200||!data.sessions.some(s=>s.id===data.active)||!data.custom||typeof data.custom!=='object'||Array.isArray(data.custom))throw Error('קובץ הגיבוי אינו תקין');
 let count=0;const ids=new Set();
 for(const s of data.sessions){if(!s||typeof s.id!=='string'||ids.has(s.id)||typeof s.name!=='string'||s.name.length>80||!s.items||typeof s.items!=='object'||Array.isArray(s.items))throw Error('מבנה ספירה לא תקין');if(s.completedAt!==undefined&&(!Number.isFinite(s.completedAt)||s.completedAt<=0))throw Error('מועד סיום ספירה אינו תקין');if(s.inventoryYear!==undefined&&(!Number.isInteger(s.inventoryYear)||s.inventoryYear<2020||s.inventoryYear>2100))throw Error('שנת מלאי אינה תקינה');if(s.countId!==undefined&&(typeof s.countId!=='string'||s.countId.length>100))throw Error('מזהה מחזור אינו תקין');ids.add(s.id);for(const [code,item] of Object.entries(s.items)){if(!item||code!==item.code)throw Error('מוצר לא תקין');const check={items:{}};applyItem(check,item,'replace');if(++count>100000)throw Error('הגיבוי גדול מדי')}}
 for(const [code,p] of Object.entries(data.custom)){if(!validCode(code)||!p||typeof p.name!=='string'||!p.name.trim()||p.name.length>180||!['units','weight'].includes(p.mode))throw Error('מאגר מקומי לא תקין')}
 return data;
}
