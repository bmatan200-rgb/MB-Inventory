import {applyReopenGrant} from './license-quota.mjs';

// Resolve the exact server-authorized session, even when another local count is displayed.
export async function synchronizeReopen({state,access,mutate}){
 const id=access?.reopenSessionId?.();
 if(!id)return null;
 const target=state.sessions.find(session=>session.id===id);
 if(!target?.completedAt)return null;
 const grant=await access.reopenGrant(target);
 if(!grant||!state.sessions.includes(target))return null;
 let changed=false;
 const saved=await mutate(()=>{changed=applyReopenGrant(target,grant)},false,true);
 return saved&&changed?target:null;
}
