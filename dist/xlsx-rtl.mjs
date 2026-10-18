const encoder=new TextEncoder();
const decoder=new TextDecoder();
const crcTable=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0}return table})();
const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes)crc=crcTable[(crc^byte)&255]^(crc>>>8);return (crc^0xffffffff)>>>0};

export function rightAlignXlsx(input){
 const bytes=new Uint8Array(input),view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
 const u16=(at)=>view.getUint16(at,true),u32=(at)=>view.getUint32(at,true);
 let end=-1;for(let at=bytes.length-22;at>=Math.max(0,bytes.length-65557);at--)if(u32(at)===0x06054b50){end=at;break}
 if(end<0)throw Error('קובץ Excel לא תקין');
 const count=u16(end+10),directoryOffset=u32(end+16);let at=directoryOffset;const entries=[];
 for(let i=0;i<count;i++){
  if(u32(at)!==0x02014b50)throw Error('מבנה Excel לא תקין');
  const method=u16(at+10),crc=u32(at+16),compressedSize=u32(at+20),size=u32(at+24),nameLength=u16(at+28),extraLength=u16(at+30),commentLength=u16(at+32),localOffset=u32(at+42),nameBytes=bytes.slice(at+46,at+46+nameLength),name=decoder.decode(nameBytes);
  if(method!==0)throw Error('לא ניתן לעצב את קובץ Excel בדפדפן הזה');
  const localNameLength=u16(localOffset+26),localExtraLength=u16(localOffset+28),dataStart=localOffset+30+localNameLength+localExtraLength;
  let data=bytes.slice(dataStart,dataStart+compressedSize);
  if(name==='xl/styles.xml'){
   let xml=decoder.decode(data);
   xml=xml.replace(/<cellXfs\b([^>]*)>([\s\S]*?)<\/cellXfs>/,(whole,attrs,body)=>{
    const countMatch=attrs.match(/\bcount="(\d+)"/);if(!countMatch)throw Error('חסרים סגנונות בקובץ Excel');
    const aligned=body.replace(/<xf\b([^>]*?)(?:\/>|>([\s\S]*?)<\/xf>)/g,(_match,xfAttrs,inner='')=>{
     if(inner.includes('<alignment'))return `<xf${xfAttrs}>${inner.replace(/<alignment\b([^>]*)\/>/,(a,aAttrs)=>`<alignment${aAttrs.includes('horizontal=')?aAttrs:aAttrs+' horizontal="right"'}${aAttrs.includes('vertical=')?'':' vertical="center"'}/>` )}</xf>`;
     return `<xf${xfAttrs}><alignment horizontal="right" vertical="center"/></xf>`;
    });
    return `<cellXfs${attrs}>${aligned}</cellXfs>`;
   });
   if(!xml.includes('<cellXfs'))throw Error('לא נמצאו סגנונות בקובץ Excel');data=encoder.encode(xml);
  }
  entries.push({nameBytes,data,crc:crc32(data),time:u16(at+12),date:u16(at+14)});
  at+=46+nameLength+extraLength+commentLength;
 }
 const localParts=[],centralParts=[];let localOffset=0;
 for(const entry of entries){
  const {nameBytes,data}=entry,local=new Uint8Array(30+nameBytes.length+data.length),lv=new DataView(local.buffer);
  lv.setUint32(0,0x04034b50,true);lv.setUint16(4,20,true);lv.setUint16(6,0x0800,true);lv.setUint16(8,0,true);lv.setUint16(10,entry.time,true);lv.setUint16(12,entry.date,true);lv.setUint32(14,entry.crc,true);lv.setUint32(18,data.length,true);lv.setUint32(22,data.length,true);lv.setUint16(26,nameBytes.length,true);lv.setUint16(28,0,true);local.set(nameBytes,30);local.set(data,30+nameBytes.length);localParts.push(local);
  const central=new Uint8Array(46+nameBytes.length),cv=new DataView(central.buffer);cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,entry.time,true);cv.setUint16(14,entry.date,true);cv.setUint32(16,entry.crc,true);cv.setUint32(20,data.length,true);cv.setUint32(24,data.length,true);cv.setUint16(28,nameBytes.length,true);cv.setUint16(30,0,true);cv.setUint16(32,0,true);cv.setUint16(34,0,true);cv.setUint16(36,0,true);cv.setUint32(38,0,true);cv.setUint32(42,localOffset,true);central.set(nameBytes,46);centralParts.push(central);localOffset+=local.length;
 }
 const directorySize=centralParts.reduce((sum,part)=>sum+part.length,0),eocd=new Uint8Array(22),ev=new DataView(eocd.buffer);ev.setUint32(0,0x06054b50,true);ev.setUint16(4,0,true);ev.setUint16(6,0,true);ev.setUint16(8,entries.length,true);ev.setUint16(10,entries.length,true);ev.setUint32(12,directorySize,true);ev.setUint32(16,localOffset,true);ev.setUint16(20,0,true);
 const output=new Uint8Array(localOffset+directorySize+22);let pos=0;for(const part of localParts){output.set(part,pos);pos+=part.length}for(const part of centralParts){output.set(part,pos);pos+=part.length}output.set(eocd,pos);return output;
}
