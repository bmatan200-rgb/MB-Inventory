export function formatIsraelDateTime(ms){
 if(!Number.isFinite(ms))throw Error('תאריך אינו תקין');
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(ms),v=Object.fromEntries(parts.map(x=>[x.type,x.value]));return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}
export function parseIsraelDateTime(text){
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text))throw Error('בחר תאריך ושעה תקינים');
 const target=Date.parse(text+'Z');if(!Number.isFinite(target))throw Error('תאריך אינו תקין');let result=target;
 for(let i=0;i<4;i++)result+=target-Date.parse(formatIsraelDateTime(result)+'Z');
 if(formatIsraelDateTime(result)!==text)throw Error('השעה אינה קיימת במעבר שעון קיץ, או שהתאריך אינו תקין');return result;
}
