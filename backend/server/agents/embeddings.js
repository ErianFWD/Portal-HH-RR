import {config} from '../config.js';
export async function embedMany(texts,input_type,{fetchImpl=fetch,retries=input_type==='document'?3:0,sleep=ms=>new Promise(r=>setTimeout(r,ms)),timeoutMs=input_type==='document'?30000:config.LLM_TIMEOUT_MS}={}) {
  if(!config.VOYAGE_API_KEY)throw Error('Falta VOYAGE_API_KEY');
  if(!texts.length)return [];
  if(texts.length>128)throw Error('Demasiados textos por lote');
  for(let attempt=0;;attempt++){
    const response=await fetchImpl('https://api.voyageai.com/v1/embeddings',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+config.VOYAGE_API_KEY},body:JSON.stringify({input:texts,model:config.VOYAGE_MODEL,input_type}),signal:AbortSignal.timeout(timeoutMs)});
    if(response.status===429&&attempt<retries){const seconds=Number(response.headers?.get('retry-after'));await sleep(Math.min(60000,Math.max(1000,Number.isFinite(seconds)&&seconds>0?seconds*1000:21000*(attempt+1))));continue;}
    if(!response.ok){const error=Error('Voyage respondió '+response.status);error.status=response.status;throw error;}
    const data=(await response.json()).data;
    if(!Array.isArray(data)||data.length!==texts.length)throw Error('Lote de embeddings incompleto');
    const ordered=[...data].sort((a,b)=>a.index-b.index);
    if(ordered.some((row,i)=>row.index!==i||!Array.isArray(row.embedding)||row.embedding.length!==1024||!row.embedding.every(Number.isFinite)))throw Error('Embedding inválido');
    return ordered.map(row=>JSON.stringify(row.embedding));
  }
}
export async function embed(text,input_type){return (await embedMany([text],input_type))[0];}
