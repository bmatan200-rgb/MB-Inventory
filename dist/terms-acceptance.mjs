import {TERMS_ID,TERMS_SHA256,TERMS_TEXT} from './terms-data.mjs';

export function acceptanceMatches(value,uid){
 return !!value&&value.uid===uid&&value.accepted===true&&value.termsId===TERMS_ID&&value.termsSha256===TERMS_SHA256&&value.termsText===TERMS_TEXT&&value.acceptedAt!=null;
}
export function acceptanceRef(s,db,uid){return s.doc(db,'customerAccounts',uid,'termsAcceptances',TERMS_ID)}
export async function readAcceptance(s,db,uid){
 const snap=await s.getDocFromServer(acceptanceRef(s,db,uid));
 return snap.exists()?snap.data():null;
}
// The account and its first consent record are committed together. Existing
// accounts and immutable receipts are never overwritten by this operation.
export async function saveAcceptance(s,db,uid,newAccount=null){
 if(!uid)throw Error('יש להתחבר לחשבון כדי לשמור את האישור');
 const accountRef=s.doc(db,'customerAccounts',uid),receiptRef=acceptanceRef(s,db,uid);
 await s.runTransaction(db,async tx=>{
  const account=await tx.get(accountRef),receipt=await tx.get(receiptRef);
  if(receipt.exists()&&!acceptanceMatches(receipt.data(),uid))throw Error('לא ניתן לאמת את אישור התנאים. פנה לתמיכה');
  if(!account.exists()){
   if(!newAccount||newAccount.uid!==uid)throw Error('כרטיס החשבון אינו קיים. יש להשלים הרשמה');
   tx.set(accountRef,{...newAccount,createdAt:s.serverTimestamp()});
  }
  if(!receipt.exists())tx.set(receiptRef,{uid,accepted:true,termsId:TERMS_ID,termsSha256:TERMS_SHA256,termsText:TERMS_TEXT,acceptedAt:s.serverTimestamp()});
 });
 return readAcceptance(s,db,uid);
}
