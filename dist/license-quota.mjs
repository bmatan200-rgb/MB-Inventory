export function licenseQuota(account){return{limit:Number.isSafeInteger(account?.countLimit)?account.countLimit:0,used:Number.isSafeInteger(account?.countsUsed)?account.countsUsed:0}}
export function hasAvailableCount(account,now=Date.now()){const q=licenseQuota(account);return !!account&&account.status==='active'&&Number.isFinite(account.expiresAt)&&account.expiresAt>now&&q.used<q.limit}
export async function claimCount(s,db,uid,session,now=Date.now()){
 if(!session||typeof session.id!=='string'||!session.id)throw Error('מזהה הספירה אינו תקין');
 session.licenseClaimRequired=true;
 const accountRef=s.doc(db,'customerAccounts',uid),claimRef=s.doc(db,'customerAccounts',uid,'countClaims',session.id);
 await s.runTransaction(db,async tx=>{
  const claim=await tx.get(claimRef),snap=await tx.get(accountRef),account=snap.data()||{};
  if(account.status!=='active'||!Number.isFinite(account.expiresAt)||account.expiresAt<=now)throw Error('החשבון אינו פעיל');
  if(claim.exists()){
   if(claim.data()?.sessionId!==session.id)throw Error('רישום הספירה אינו תקין');
   return;
  }
  const q=licenseQuota(account);
  if(q.used>=q.limit)throw Error('מכסת הספירות נוצלה. פנה למנהל להוספת ספירה');
  tx.update(accountRef,{countsUsed:q.used+1,lastClaimId:session.id});
  tx.set(claimRef,{sessionId:session.id,createdAt:s.serverTimestamp()});
 });
 session.licenseClaimId=session.id;
 return session.id;
}

// A grant applies once, to one existing session; it never changes inventory or quota.
export function applyReopenGrant(session,grant){
 if(!session?.completedAt||!grant?.token||grant.sessionId!==session.id||session.reopenAppliedToken===grant.token||session.reopenClosedToken===grant.token)return false;
 delete session.completedAt;
 session.reopenAppliedToken=grant.token;
 return true;
}
