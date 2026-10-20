// Blank, unlicensed drafts are not started counts. Historical data is never removed.
export function unfinishedCounts(state){
 return state.sessions.filter(s=>!s.completedAt&&(s.licenseClaimRequired||s.licenseClaimId||Object.keys(s.items||{}).length>0));
}
export function assertCanBeginCount(state,exceptId=null){
 const open=unfinishedCounts(state).find(s=>s.id!==exceptId);
 if(open)throw Error(`יש לסיים קודם את הספירה „${open.name}”. אפשר לחזור אליה ברשימת הספירות השמורות.`);
}
export async function startSequentialCount({state,name,makeSession,access,mutate}){
 assertCanBeginCount(state);
 if(access&&!access.canStart())throw Error('מכסת הספירות נוצלה או שהרישיון אינו פעיל. פנה למנהל.');
 const draft=state.sessions.find(s=>s.id===state.active&&!s.completedAt&&!s.licenseClaimRequired&&!s.licenseClaimId&&Object.keys(s.items||{}).length===0);
 if(!draft&&state.sessions.length>=200)throw Error('הגעת ל־200 ספירות. הורד גיבוי לפני המשך העבודה.');
 const candidate=draft?{...draft,name}:makeSession(name);
 if(access){candidate.licenseClaimRequired=true;if(!await access.acquire(candidate))throw Error('לא ניתן לפתוח ספירה. בדוק את מצב הרישיון או פנה למנהל.');}
 return mutate(()=>{
  assertCanBeginCount(state);
  if(draft)Object.assign(draft,candidate);else state.sessions.push(candidate);
  state.active=candidate.id;
 },false,!!access);
}
