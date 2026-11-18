// Búsqueda exacta por coseno para el corpus pequeño del prototipo.
export function cosineSimilarity(a,b){if(!Array.isArray(a)||!Array.isArray(b)||a.length!==1024||b.length!==a.length) return null;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){if(!Number.isFinite(a[i])||!Number.isFinite(b[i]))return null;dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/Math.sqrt(aa*bb):null}
const stop=new Set('que como cuando cual donde cuanto cuantos quien dias puedo debo tengo tiene tienen dame quiero necesito empresa persona personas este esta para por soy una unos unas del las los con sin sobre caso ano anos favor manera informacion respecto'.split(' '));
function terms(text){return [...new Set((text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').match(/[a-z]{3,}/g)||[]).filter(t=>!stop.has(t)).map(t=>t.slice(0,7)))];}
export function rankChunks(rows,query,threshold=0.3,{question='',limit=5}={}){
  const q=terms(question),texts=rows.map(row=>new Set(terms((row.nombre||'')+' '+(row.seccion||'')+' '+(row.contenido||''))));
  const weights=new Map(q.map(t=>[t,1+Math.log((rows.length+1)/(texts.filter(s=>s.has(t)).length+1))])),total=[...weights.values()].reduce((a,b)=>a+b,0);
  return rows.map((row,i)=>{let vector=row.embedding;try{if(typeof vector==='string')vector=JSON.parse(vector);}catch{return null;}
    const similitud=cosineSimilarity(vector,query);if(similitud===null)return null;
    const matches=q.filter(t=>texts[i].has(t)),lexical=total?matches.reduce((n,t)=>n+weights.get(t),0)/total:0;
    if(similitud<threshold&&!(lexical>.1&&matches.some(t=>t.length>=6)))return null;
    return {...row,similitud,lexical,ranking:similitud+.15*lexical};
  }).filter(Boolean).sort((a,b)=>b.ranking-a.ranking).slice(0,limit);
}
