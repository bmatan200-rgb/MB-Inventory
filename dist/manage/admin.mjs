import {s,connect,message} from '../accounts.mjs';
const $=id=>document.getElementById(id);let b,rows=[];
const used=a=>Number.isSafeInteger(a.countsUsed)?a.countsUsed:0;
const limit=a=>Number.isSafeInteger(a.countLimit)?a.countLimit:0;
function note(t){$('message').textContent=t}
async function load(){const result=await s.getDocs(s.query(s.collection(b.db,'customerAccounts'),s.limit(1000)));rows=result.docs.map(x=>({id:x.id,...x.data()}));render();note(`מוצגים ${rows.length} לקוחות`)}
function localDate(ms){const d=new Date(ms);return new Date(ms-d.getTimezoneOffset()*60000).toISOString().slice(0,16)}
function el(tag,text,cls){const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n}
function button(parent,text,action,cls=''){const n=el('button',text,cls);n.type='button';n.onclick=async()=>{n.disabled=true;try{await action();await load();note('השינוי נשמר')}catch(e){note(message(e))}finally{n.disabled=false}};parent.append(n);return n}
// Read the current account inside each transaction; never overwrite usage from a stale card.
async function update(id,patch){const ref=s.doc(b.db,'customerAccounts',id);await s.runTransaction(b.db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw Error('הלקוח לא נמצא');const a=snap.data();tx.update(ref,{countLimit:limit(a),countsUsed:used(a),lastClaimId:a.lastClaimId||'',...patch(a),updatedAt:s.serverTimestamp()})})}
function render(){
 $('cards').replaceChildren();const term=$('search').value.trim().toLowerCase();
 for(const a of rows.filter(a=>(a.businessName+' '+a.email).toLowerCase().includes(term))){
  const card=el('section',null,'customer-card'),head=el('div',null,'customer-heading');head.append(el('h2',a.businessName),el('span',({active:'פעיל',pending:'ממתין לאישור',blocked:'חסום'})[a.status]||'לא פעיל',`account-badge ${a.status}`));card.append(head,el('p',a.email,'customer-email'));
  const summary=el('div',null,'quota-summary');summary.append(el('strong',`${Math.max(0,limit(a)-used(a))} ספירות זמינות`),el('span',`נוצלו ${used(a)} מתוך ${limit(a)}`));card.append(summary);
  if(limit(a)===0&&used(a)===0){const n=el('div',null,'initial-quota');n.append(el('p','ללקוח הזה עדיין לא הוקצתה ספירה.'));button(n,'הקצה ספירה ראשונה',()=>update(a.id,current=>limit(current)===0&&used(current)===0?{countLimit:1}:{}),'primary');card.append(n)}
  const extras=el('div',null,'add-counts');const label=el('label','ספירות להוספה'),input=el('input');input.type='number';input.min='1';input.max='100000';input.step='1';input.value='1';input.inputMode='numeric';label.append(input);extras.append(label);button(extras,'הוסף ספירות',async()=>{const amount=Number(input.value);if(!Number.isSafeInteger(amount)||amount<1)throw Error('בחר מספר שלם של ספירות להוספה');await update(a.id,current=>{const next=limit(current)+amount;if(next>100000)throw Error('הכמות גדולה מדי');return {countLimit:next}})},'primary');card.append(extras);
  const validity=el('div',null,'validity');validity.append(el('p',a.expiresAt?'בתוקף עד '+new Date(a.expiresAt).toLocaleString('he-IL'):'טרם נקבע תוקף','expiry-status'));const expiryLabel=el('label','תאריך ושעת סיום הרישיון'),expiry=el('input');expiry.type='datetime-local';expiry.value=localDate(a.expiresAt>Date.now()?a.expiresAt:Date.now()+30*86400000);expiryLabel.append(expiry);validity.append(expiryLabel);button(validity,a.status==='active'?'עדכן תוקף':'אשר והפעל לקוח',async()=>{const end=new Date(expiry.value).getTime();if(!Number.isFinite(end)||end<=Date.now())throw Error('בחר תוקף עתידי');await update(a.id,current=>({status:'active',expiresAt:end,...(limit(current)===0&&used(current)===0?{countLimit:1}:{})}))});card.append(validity);
  const more=el('details',null,'more-options');more.append(el('summary','פעולות נוספות'));button(more,'חסום לקוח',async()=>{if(!confirm('לחסום את גישת הלקוח לעריכה? הנתונים שלו לא יימחקו.'))return;await update(a.id,()=>({status:'blocked'}))},'danger');
  if(typeof a.number==='string'&&a.number.trim())button(more,'מחק מספר מזהה ישן מהשרת',async()=>{if(!confirm('למחוק מהשרת את מספר העוסק/ח.פ. הישן? נתוני הדוח המקומיים לא ישתנו.'))return;await update(a.id,()=>({number:''}))});card.append(more);$('cards').append(card)
 }
}
async function enter(){const owner=await s.getDocFromServer(s.doc(b.db,'settings','accountOwner'));if(owner.data()?.uid!==b.auth.currentUser?.uid)throw Error('לחשבון זה אין הרשאת מנהל');$('login').hidden=true;$('panel').hidden=false;await load()}
$('login').onsubmit=async e=>{e.preventDefault();try{b=await connect(true);await s.signInWithEmailAndPassword(b.auth,$('login').elements.email.value.trim(),$('login').elements.password.value);await enter()}catch(e){note(message(e))}};
$('logout').onclick=async()=>{await s.signOut(b.auth);location.reload()};$('refresh').onclick=()=>load().catch(e=>note(message(e)));$('search').oninput=render;
connect(true).then(async c=>{b=c;if(b.auth.currentUser)await enter()}).catch(e=>note(message(e)));
