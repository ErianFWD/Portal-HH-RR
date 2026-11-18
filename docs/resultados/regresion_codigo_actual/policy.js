import {config} from '../config.js';
import {embed} from './embeddings.js';
import {rankChunks} from './vector.js';
import {generatePolicyAnswer} from './deepseek.js';
import {localDate} from '../time.js';
import {z} from 'zod';
import {dateRangeFromQuestion,businessDays} from '../calendar.js';
const responseSchema=z.object({respuesta:z.string().min(1),suficiente:z.boolean(),motivo:z.string(),fragmentos:z.array(z.number().int().positive())});

export async function policy(db, question, date=localDate(),{searchQuestion=question,onDecision=()=>{},embedImpl=embed,personalHandled=false}={}) {
  if (!config.VOYAGE_API_KEY || !config.DEEPSEEK_API_KEY) return {answer:'No hay evidencia documental disponible: falta configurar la búsqueda o el modelo.',sources:[],escalated:true};
  const v=JSON.parse(await embedImpl(searchQuestion,'query'));
  const r=await db.query("SELECT d.id documento_id,f.id fragmento_id,d.nombre,d.enlace,COALESCE(d.version_politica,CONCAT('revisión Drive ',d.version)) version,d.vigencia,f.seccion,f.orden,f.contenido,f.embedding FROM fragmentos f JOIN documentos d ON d.id=f.documento_id WHERE d.aprobado=true AND (d.vigente_desde IS NULL OR d.vigente_desde<=$1) AND (d.vigente_hasta IS NULL OR d.vigente_hasta>=$1) AND f.modelo_embedding=$2 AND f.dimension=1024",[date,config.VOYAGE_MODEL]);
  const meaningful=r.rows.filter(row=>row.seccion!=='Contenido'||r.rows.filter(other=>other.documento_id===row.documento_id).length===1);
  const rows=rankChunks(meaningful,v,config.RAG_THRESHOLD,{question:searchQuestion});
  const primary=rows[0]?.documento_id,primaryChunks=meaningful.filter(row=>row.documento_id===primary);
  if(primaryChunks.reduce((n,row)=>n+row.contenido.length,0)<=12000)for(const row of primaryChunks)if(!rows.some(hit=>hit.fragmento_id===row.fragmento_id))rows.push(row);
  // Agrega secciones vecinas del mismo documento y versión para no aislar excepciones.
  for(const hit of [...rows])for(const neighbor of meaningful.filter(row=>row.documento_id===hit.documento_id&&Math.abs(Number(row.orden)-Number(hit.orden))===1))if(!rows.some(row=>row.fragmento_id===neighbor.fragmento_id))rows.push(neighbor);
  const range=dateRangeFromQuestion(question);let calendar=null;
  if(range&&range.inicio.slice(0,4)===range.fin.slice(0,4)){
    const calendars=r.rows.filter(row=>/feriados[_ -]?\d{4}/i.test(row.nombre)&&row.nombre.includes(range.inicio.slice(0,4)));
    if(calendars.length){calendar={...range,dias_habiles:await businessDays(db,range.inicio,range.fin),fuente:'SQL feriados, jornada de lunes a viernes'};for(const chunk of calendars)if(!rows.some(r=>r.fragmento_id===chunk.fragmento_id))rows.push(chunk);}
  }
  if(!rows.length)return {answer:'No encontré evidencia suficiente en los documentos aprobados.',sources:[],escalated:true};
  const raw=await generatePolicyAnswer({apiKey:config.DEEPSEEK_API_KEY,model:config.DEEPSEEK_MODEL,question:`Fecha local: ${date}. Pregunta: ${question}`,calendar,personalHandled,evidence:rows.map(({fragmento_id,contenido,seccion,nombre})=>({fragmento_id:Number(fragmento_id),contenido,seccion,nombre})),structured:true,timeoutMs:config.LLM_TIMEOUT_MS});
  const result=responseSchema.parse(JSON.parse(raw)),allowed=new Set(rows.map(r=>Number(r.fragmento_id)));
  onDecision({pregunta:question,consulta_busqueda:searchQuestion,candidatos:rows.map(r=>({fragmento_id:Number(r.fragmento_id),nombre:r.nombre,seccion:r.seccion,similitud:r.similitud,lexical:r.lexical})),resultado:result});
  if(!result.suficiente||!result.fragmentos.length||result.fragmentos.some(id=>!allowed.has(id)))return {answer:'No encontré evidencia suficiente en las fuentes vigentes. Podés consultar a RRHH.',sources:[],escalated:true};
  return {answer:result.respuesta,sources:rows.filter(r=>result.fragmentos.includes(Number(r.fragmento_id))).map(({documento_id,fragmento_id,nombre,enlace,version,vigencia,seccion})=>({documento_id,fragmento_id,nombre,enlace,version,vigencia,seccion,drive_url:enlace,titulo:nombre})),escalated:false};
}
