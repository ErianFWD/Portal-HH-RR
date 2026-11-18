import {readFile,writeFile} from 'node:fs/promises';
import {parse} from 'csv-parse/sync';
import {createHash} from 'node:crypto';
import {db} from '../server/db.js';
import {answer} from '../server/agents/orchestrator.js';
const root=new URL('../../docs/resultados/',import.meta.url),date='2026-11-17';
try{
  const bank=parse(await readFile(new URL('../../docs/guias_rrhh/evaluacion/banco_45_preguntas.csv',import.meta.url),'utf8'),{columns:true,bom:true});
  const users=(await db.query("SELECT id,colaborador_id,rol FROM usuarios WHERE email IN ('colaborador@demo.local','rrhh@demo.local') AND activo=1")).rows;
  const conditions=JSON.parse(await readFile(new URL('condiciones.json',root),'utf8'));
  const files=['orchestrator','router','classify','policy','employee','vector','deepseek','compose'];
  const hash=createHash('sha256').update((await Promise.all(files.map(name=>readFile(new URL('../server/agents/'+name+'.js',import.meta.url),'utf8')))).join('\n')).digest('hex');
  const checks={9:r=>r.answer.includes('2026-11-30'),19:r=>/12(?:\.00)? días/.test(r.answer)&&r.sources.some(s=>/Acumulación/.test(s.seccion))&&!/no (?:hay evidencia|puedo)[^.]*?(?:saldo|cuántos días te quedan)/i.test(r.answer),25:r=>/hay 2 personas de vacaciones/.test(r.answer),44:r=>r.answer.startsWith('No creé ningún ticket.')};
  const result={fecha:new Date().toISOString(),fecha_reloj:date,evaluacion_base:conditions.archivo_historico,codigo_hash:hash,nota:'Pruebas dirigidas posteriores a la corrida completa. No sustituyen filas, latencias ni puntuación de las 45 preguntas. Los cuatro errores originales permanecen en el CSV medido.',casos:[]};
  for(const id of [9,19,25,44]){
    const row=bank.find(r=>Number(r.id)===id),user=users.find(u=>u.rol===row.rol),start=performance.now();
    const response=await answer(db,user,row.pregunta,{date});
    result.casos.push({id,rol:user.rol,respuesta:response.answer,citas:response.sources,latencia_ms:Math.round(performance.now()-start),correcta:checks[id](response)});
    console.log('Regresión '+id+': '+(result.casos.at(-1).correcta?'correcta':'fallida'));
  }
  result.aprobada=result.casos.every(r=>r.correcta);await writeFile(new URL('regresion_post_evaluacion.json',root),JSON.stringify(result,null,2));
  if(!result.aprobada)process.exitCode=1;
}finally{await db.end();}
