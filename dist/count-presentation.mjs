// Local report metadata only. This module never performs network requests.
export function nextCountDetails(state,businessName='',now=new Date()){
 const year=now.getFullYear();
 const used=state.sessions.filter(s=>s.inventoryYear===year||new Date(s.created).getFullYear()===year);
 const sequence=Math.max(0,...used.map(s=>Number.isSafeInteger(s.countSequence)?s.countSequence:0),used.filter(s=>s.completedAt||s.licenseClaimRequired||s.licenseClaimId||Object.keys(s.items||{}).length).length)+1;
 const suffix=`ספירה ${sequence} — ${year}`,prefix=String(businessName||'').trim();
 return {name:prefix?`${prefix.slice(0,80-suffix.length-3)} — ${suffix}`:suffix,inventoryYear:year,countSequence:sequence};
}
export function reportBusiness(session,localBusiness={},accountBusiness=null){
 // A saved report belongs to its count; do not rename historical reports on login.
 return {...localBusiness,...(session.reportBusiness||accountBusiness||{})};
}
export function attachCountDetails(session,details,business){
 Object.assign(session,details,{reportMode:'business',reportBusiness:{...business,number:''}});
}
export function buildReportRows({session,business,custom={},catalog=new Map(),now=new Date()}){
 const rows=Object.values(session.items),priced=rows.filter(x=>x.unitPrice!==null&&x.unitPrice!==undefined);
 const total=priced.reduce((sum,x)=>sum+x.quantity*x.unitPrice,0),units=rows.filter(x=>x.mode==='units').reduce((sum,x)=>sum+x.quantity,0),weight=rows.filter(x=>x.mode==='weight').reduce((sum,x)=>sum+x.quantity,0);
 const meta=[['דוח ספירת מלאי',business.name||''],['שם העסק',business.name||''],['סוג העסק',business.type||''],['מספר עוסק / ח.פ.',business.number||''],['סניף / מחסן',business.branch||''],['נספר על ידי',business.counter||''],['שם הספירה',session.name],['שנת הספירה',session.inventoryYear||new Date(session.created||now).getFullYear()],['תאריך הפקת הדוח',new Intl.DateTimeFormat('he-IL').format(now)],['מוצרים שונים שנספרו',rows.length],['סך יחידות שנספרו',units],['סך משקל שנספר (ק״ג)',Number(weight.toFixed(3))],['שווי מוצרים עם מחיר ללא מע״מ (₪)',Number(total.toFixed(2))],['מוצרים ללא מחיר',rows.length-priced.length]];
 const headerIndex=meta.length+1;
 return {headerIndex,data:[...meta,[],['ברקוד','שם מוצר','כמות','יחידת מידה','מחיר ליחידה / ק״ג ללא מע״מ (₪)'],...rows.map(x=>[x.code,x.name||custom[x.code]?.name||catalog.get(x.code)?.name||'מוצר ללא שם',x.quantity,x.mode==='weight'?'ק״ג':'יחידות',x.unitPrice??null])]};
}
