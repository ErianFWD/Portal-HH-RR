import {db} from '../server/db.js';
import {localDate,parseJson} from '../server/time.js';
import {regenerateReportSummary} from '../server/agents/analyst.js';
import {writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
try{
  const date=localDate(),before=(await db.query('SELECT datos FROM reportes_diarios WHERE fecha=$1',[date])).rows[0];if(!before)throw Error('Primero debe existir el reporte');
  const result=await regenerateReportSummary(db,date,{trigger:'autorizacion-usuario-metricas-ficticias-2026-11-18'});
  if(hash(parseJson(before.datos))!==hash(result.datos))throw Error('Cambió la instantánea; validación fallida');
  const verification={verificado_en:new Date().toISOString(),fecha:date,datos_hash:hash(result.datos),datos_inmutables:true,metodo:result.resumen_metodo,resumen:result.resumen,error:result.error,autorizacion:'El usuario autorizó expresamente métricas ficticias agregadas para DeepSeek en el chat del 2026-11-18; no se enviaron nombres ni preguntas.'};
  await writeFile(new URL('../../docs/resultados/validacion_resumen_ia.json',import.meta.url),JSON.stringify(verification,null,2));console.log(JSON.stringify(verification,null,2));
}finally{await db.end();}
