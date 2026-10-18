import * as s from './vendor/firebase-sdk.mjs';
import {firebaseConfig} from './firebase-config.mjs';
export {s};
export async function connect(admin=false){const name=admin?'inventory-accounts-admin':'inventory-accounts-customer';const app=s.getApps().find(a=>a.name===name)||s.initializeApp(firebaseConfig,name);const auth=s.getAuth(app);await s.setPersistence(auth,s.indexedDBLocalPersistence);await new Promise(resolve=>{let stop=()=>{};stop=s.onAuthStateChanged(auth,()=>{stop();resolve()})});return {auth,db:s.getFirestore(app)}}
export function eligible(a,now=Date.now()){return !!a&&a.status==='active'&&Number.isFinite(a.expiresAt)&&a.expiresAt>now}
export function message(e){return ({'auth/invalid-credential':'אימייל או סיסמה שגויים','auth/email-already-in-use':'האימייל כבר רשום. נסה כניסה','auth/weak-password':'בחר סיסמה חזקה יותר','auth/invalid-email':'אימייל לא תקין','auth/network-request-failed':'אין חיבור לשרת','permission-denied':'אין הרשאה. בדוק הגדרת מנהל וכללי אבטחה','auth/too-many-requests':'נסה שוב מאוחר יותר'})[e.code]||e.message||'הפעולה נכשלה'}
