// This module sends download events only. Totals are never sent to the browser.
const endpoint=new URL('./api/download-stats.php',import.meta.url);
const storageKey='rls-download-outbox-v1';
const products=new Set(['kit','suit','training','windbreaker','winter']);
const maxAge=48*60*60*1000;
let pending=[],sending=false,retryTimer=null;

function valid(event){
  return event&&/^[a-f0-9]{32}$/.test(event.event_id)&&products.has(event.product)&&
    Number.isFinite(event.createdAt)&&event.createdAt>Date.now()-maxAge;
}
function read(){
  try{const value=JSON.parse(localStorage.getItem(storageKey)||'[]');return Array.isArray(value)?value.filter(valid):[];}catch{return [];}
}
function merge(){
  pending=[...new Map([...read(),...pending].filter(valid).map(event=>[event.event_id,event])).values()].slice(-100);
}
function persist(){
  try{if(pending.length)localStorage.setItem(storageKey,JSON.stringify(pending));else localStorage.removeItem(storageKey);}catch{}
}
function eventId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID().replaceAll('-','');
  const bytes=new Uint8Array(16);
  if(globalThis.crypto?.getRandomValues)crypto.getRandomValues(bytes);
  else for(let i=0;i<bytes.length;i++)bytes[i]=Math.floor(Math.random()*256);
  return Array.from(bytes,value=>value.toString(16).padStart(2,'0')).join('');
}
async function flush(){
  if(sending||!/^https?:$/.test(location.protocol)||navigator.onLine===false)return;
  sending=true;clearTimeout(retryTimer);
  try{
    merge();
    while(pending.length){
      const event=pending[0];
      const controller=new AbortController();
      const timeout=setTimeout(()=>controller.abort(),8000);
      let response;
      try{
        response=await fetch(endpoint,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({event_id:event.event_id,product:event.product}),
          credentials:'same-origin',cache:'no-store',redirect:'error',
          keepalive:true,referrerPolicy:'same-origin',signal:controller.signal
        });
      }finally{clearTimeout(timeout);}
      if(response.status!==204)break;
      // Another tab can send the same event; the server deduplicates by event_id.
      merge();pending=pending.filter(item=>item.event_id!==event.event_id);persist();
    }
  }catch{}finally{
    sending=false;
    if(pending.length)retryTimer=setTimeout(flush,30000);
  }
}
export function recordMockupDownload(product){
  try{
    if(!products.has(product)||!/^https?:$/.test(location.protocol))return;
    merge();pending.push({event_id:eventId(),product,createdAt:Date.now()});
    pending=pending.slice(-100);persist();void flush();
  }catch{}
}
window.addEventListener('online',()=>{void flush();});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')void flush();});
// Retry events from a previous visit without recording a page view.
pending=read();if(pending.length)void flush();
