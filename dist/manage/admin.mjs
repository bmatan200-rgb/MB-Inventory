import {s,connect,message} from '../accounts.mjs';
const $=id=>document.getElementById(id);let b,rows=[];
const used=a=>Number.isSafeInteger(a.countsUsed)?a.countsUsed:0;
const limit=a=>Number.isSafeInteger(a.countLimit)?a.countLimit:0;
function note(t){$('message').textContent=t}
async function load(){const result=await s.getDocs(s.query(s.collection(b.db,'customerAccounts'),s.limit(1000)));rows=result.docs.map(x=>({id:x.id,...x.data()}));render();note(`מוצגים ${rows.length} לקוחות`)}
function localDate(ms){const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n}
function button(parent,text,action,cls=''){const n=el('button',text,cls);n.type='button';n.onclick=async()=>{n.disabled=true;try{if(await action()===false)return;await load();note('השינוי נשמר')}catch(e){note(message(e))}finally{n.disabled=false}};parent.append(n);return n}
// Read the current account inside each transaction; never overwrite usage from a stale card.
async function update(id,patch){const ref=s.doc(b.db,'customerAccounts',id);await s.runTransaction(b.db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('הלקוח לא נמצא');const a=snap.data();tx.update(ref,{countLimit:limit(a),countsUsed:used(a),lastClaimId:a.lastClaimId||'',...patch(a),updatedAt:s.serverTimestamp()})})}
async function showTermsReceipts(account){
 const result=await s.getDocs(s.query(s.collection(b.db,'customerAccounts',account.id,'termsAcceptances'),s.limit(100)));
 const dialog=el('dialog',null,'account-dialog');const close=el('button','סגירה','outline');close.type='button';close.onclick=()=>{dialog.close();dialog.remove()};dialog.append(el('h2','אישורי תקנון'),el('p',account.businessName+' · '+account.email),close);
 const receipts=result.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.acceptedAt?.toMillis?.()||0)-(a.acceptedAt?.toMillis?.()||0));
 if(!receipts.length)dialog.append(el('p','טרם נשמר אישור תקנון לחשבון הזה.'));
 for(const receipt of receipts){const section=el('section');section.append(el('h3',receipt.acceptedAt?.toDate?'אושר ב־'+receipt.acceptedAt.toDate().toLocaleString('he-IL'):'אישור שמור'),el('p','מזהה נוסח: '+receipt.termsId));const details=el('details');details.append(el('summary','הצגת הנוסח שאושר'));const text=el('pre',receipt.termsText||'');text.style.whiteSpace='pre-wrap';text.style.fontFamily='inherit';details.append(text);section.append(details);dialog.append(section)}
 document.body.append(dialog);dialog.showModal();
}
function render(){
 $('cards').replaceChildren();const term=$('search').value.trim().toLowerCase();
 for(const a of rows.filter(a=>(a.businessName+' '+a.email).toLowerCase().includes(term))){
  const card=el('section',null,'customer-card'),head=el('div',null,'customer-heading');head.append(el('h2',a.businessName),el('span',({active:'פעיל',pending:'ממתין לאישור',blocked:'חסום'})[a.status]||'לא פעיל',`account-badge ${a.status}`));card.append(head,el('p',a.email,'customer-email'));
  const summary=el('div',null,'quota-summary');summary.append(el('strong',`${Math.max(0,limit(a)-used(a))} ספירות נותרו`),el('span',`מכסה: ${limit(a)} · נוצלו: ${used(a)}`));card.append(summary);
  button(card,'הוסף ספירה',async()=>{await update(a.id,current=>{if(limit(current)>=100000)throw Error('הגעת למכסה המרבית');return {countLimit:limit(current)+1}})},'primary add-one');
  const reopen=button(card,'פתח מחדש ספירה אחרונה',async()=>{
   if(!confirm('האם אתה בטוח שברצונך לפתוח מחדש את הספירה האחרונה של הלקוח? המוצרים והכמויות יישמרו, ולא תנוצל ספירה נוספת.'))return false;
   await update(a.id,current=>{
    if(current.status!=='active'||current.expiresAt<=Date.now())throw Error('יש להפעיל את הרישיון ולקבוע תוקף עתידי לפני פתיחה מחדש');
    if(!current.lastClaimId)throw Error('אין ספירה רשומה לפתיחה מחדש');
    return {reopenClaimId:current.lastClaimId,reopenToken:crypto.randomUUID(),reopenGrantedAt:s.serverTimestamp()};
   });
  },'outline');
  reopen.disabled=!a.lastClaimId;
  const validity=el('div',null,'validity');validity.append(el('p',a.expiresAt?'בתוקף עד '+new Date(a.expiresAt).toLocaleString('he-IL'):'טרם נקבע תוקף','expiry-status'));const expiryLabel=el('label','תאריך ושעת סיום הרישיון'),expiry=el('input');expiry.type='datetime-local';expiry.value=localDate(a.expiresAt>Date.now()?a.expiresAt:Date.now()+30*86400000);expiryLabel.append(expiry);validity.append(expiryLabel);button(validity,a.status==='active'?'עדכן תוקף':'אשר והפעל לקוח',async()=>{const end=new Date(expiry.value).getTime();if(!Number.isFinite(end)||end<=Date.now())throw Error('בחר תוקף עתידי');await update(a.id,current=>({status:'active',expiresAt:end,...(limit(current)===0&&used(current)===0?{countLimit:1}:{})}))});card.append(validity);
  const more=el('details',null,'more-options');more.append(el('summary','פעולות נוספות'));const consent=el('button','אישורי תקנון','outline');consent.type='button';consent.onclick=async()=>{consent.disabled=true;try{await showTermsReceipts(a)}catch(e){note(message(e))}finally{consent.disabled=false}};more.append(consent);button(more,'חסום לקוח',async()=>{if(!confirm('לחסום את גישת הלקוח לעריכה? הנתונים שלו לא יימחקו.'))return;await update(a.id,()=>({status:'blocked'}))},'danger');
  if(typeof a.number==='string'&&a.number.trim())button(more,'מחק מספר מזהה ישן מהשרת',async()=>{if(!confirm('למחוק מהשרת את מספר העוסק/ח.פ. הישן? נתוני הדוח המקומיים לא ישתנו.'))return;await update(a.id,()=>({number:''}))});card.append(more);$('cards').append(card)
 }
}
async function enter(){const owner=await s.getDocFromServer(s.doc(b.db,'settings','accountOwner'));if(owner.data()?.uid!==b.auth.currentUser?.uid)throw Error('לחשבון זה אין הרשאת מנהל');$('login').hidden=true;$('panel').hidden=false;await load()}
$('login').onsubmit=async e=>{e.preventDefault();try{b=await connect(true);await s.signInWithEmailAndPassword(b.auth,$('login').elements.email.value.trim(),$('login').elements.password.value);await enter()}catch(e){note(message(e))}};
$('logout').onclick=async()=>{await s.signOut(b.auth);location.reload()};$('refresh').onclick=()=>load().catch(e=>note(message(e)));$('search').oninput=render;
connect(true).then(async c=>{b=c;if(b.auth.currentUser)await enter()}).catch(e=>note(message(e)));
