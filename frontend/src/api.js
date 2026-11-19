export async function api(path,body){
  const r=await fetch('/api/'+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':'application/json','X-Portal-Request':'1'},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Error de conexión');return data;
}
export const day=d=>String(d||'').slice(0,10);
export const localDay=()=>new Date().toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'});
export const localTime=d=>d?new Intl.DateTimeFormat('es-CR',{timeZone:'America/Costa_Rica',dateStyle:'short',timeStyle:'medium',hourCycle:'h23'}).format(new Date(d)):'—';
export function elapsed(seconds){const n=Math.max(0,Math.floor(seconds));return [Math.floor(n/3600),Math.floor(n/60)%60,n%60].map(v=>String(v).padStart(2,'0')).join(':');}
