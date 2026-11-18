import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'csv-parse/sync';
import {db} from '../server/db.js';
import {route,buildSearchQuestion} from '../server/agents/router.js';
import {policy} from '../server/agents/policy.js';
import {embedMany} from '../server/agents/embeddings.js';
const ids=new Set((process.argv[2]||'1,3,7,12,13,14,19,20,23,26,29,31,32,36,37,42,43').split(','));
const rows=parse(await readFile(new URL('../../docs/guias_rrhh/evaluacion/banco_45_preguntas.csv',import.meta.url),'utf8'),{columns:true,bom:true}).filter(r=>ids.has(r.id)),results=[];
try{
  const routes=[];for(const row of rows)routes.push(await route(row.pregunta,{rol:'colaborador'},'2026-11-17'));
  const searches=routes.map((r,i)=>buildSearchQuestion(rows[i].pregunta,r.consulta_reformulada));
  const vectors=await embedMany(searches,'query',{retries:2,timeoutMs:30000});
  for(let i=0;i<rows.length;i++){
    let diagnosis;
    const p=await policy(db,rows[i].pregunta,'2026-11-17',{searchQuestion:searches[i],personalHandled:routes[i].intencion==='mixta',embedImpl:async()=>vectors[i],onDecision:d=>{diagnosis=d;}});
    results.push({id:rows[i].id,ruta:routes[i],respuesta:p.answer,citas:p.sources,diagnostico:diagnosis});
    await writeFile(new URL('../../docs/resultados/calibracion_recuperacion.json',import.meta.url),JSON.stringify({nota:'Diagnóstico de recuperación con embeddings de consulta agrupados. No se usa para latencia ni aprobación de 45 preguntas. Las preguntas de calibración pertenecen al banco conocido; no prueban generalización.',resultados:results},null,2));
    console.log('Diagnóstico '+rows[i].id+': '+(p.escalated?'abstención':'con fuentes'));
  }
}finally{await db.end();}
