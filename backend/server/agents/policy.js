import {config} from '../config.js';
import {embed} from './embeddings.js';
import {rankChunks} from './vector.js';
import {generatePolicyAnswer} from './deepseek.js';

export async function policy(db, question) {
  if (!config.VOYAGE_API_KEY || !config.DEEPSEEK_API_KEY) return {answer:'No hay evidencia documental disponible: falta configurar la búsqueda o el modelo.',sources:[],escalated:true};
  const v=JSON.parse(await embed(question,'query'));
  const r=await db.query('SELECT d.nombre,d.enlace,d.version,d.vigencia,f.seccion,f.contenido,f.embedding FROM fragmentos f JOIN documentos d ON d.id=f.documento_id WHERE d.aprobado=true');
  const rows=rankChunks(r.rows,v);
  if(!rows.length)return {answer:'No encontré evidencia suficiente en los documentos aprobados.',sources:[],escalated:true};
  const answer=await generatePolicyAnswer({apiKey:config.DEEPSEEK_API_KEY,model:config.DEEPSEEK_MODEL,question,evidence:rows.map(({contenido,seccion,nombre})=>({contenido,seccion,nombre}))});
  return {answer,sources:rows.map(({nombre,enlace,version,vigencia,seccion})=>({nombre,enlace,version,vigencia,seccion})),escalated:false};
}
