import {route,buildSearchQuestion} from './router.js';
import {ownData} from './employee.js';
import {policy} from './policy.js';
import {reportMetrics} from './analyst.js';
import {localDate} from '../time.js';
import {policyPartOnly} from './compose.js';

export async function answer(db,user,question,{date=localDate(),routeImpl=route,policyImpl=policy}={}) {
  const start=Date.now();
  const id=(await db.query("INSERT INTO consultas_chat(usuario_id,colaborador_id,pregunta,estado) VALUES($1,$2,$3,'pendiente')",[user.id,user.colaborador_id,question])).insertId;
  async function log(agent,t,sources=[],escalated=false,error=null){await db.query('INSERT INTO intervenciones(consulta_id,agente,evidencias,latencia_ms,escalamiento,error) VALUES($1,$2,$3,$4,$5,$6)',[id,agent,JSON.stringify(sources),Date.now()-t,escalated,error]);}
  const parts=[];let sources=[],escalated=false;
  try {
    const routing=await routeImpl(question,user,date),kind=routing.intencion;
    await db.query('UPDATE consultas_chat SET intencion=$1,tema=$2 WHERE id=$3',[kind,topic(question,kind),id]);
    if(/ticket/i.test(question)&&/cre|confirm|envi|abr/i.test(question)){parts.push('No creé ningún ticket. Este portal no tiene una herramienta para enviarlo o confirmar su creación; podés contactar a RRHH por sus canales internos.');escalated=true;}else if(kind==='restringida'){parts.push('No puedo consultar datos de otras personas ni dar acceso a funciones de RRHH sin los permisos correspondientes.');escalated=true;}
    else if(kind==='fuera_alcance'){parts.push('Puedo ayudarte con políticas de RRHH, tus vacaciones, solicitudes, próximos pagos y evaluaciones.');escalated=true;}
    else {
      // El despachador utiliza una lista fija; nunca ejecuta herramientas o SQL enviados por el LLM.
      const tasks=[];
      if(kind==='dato_personal'||kind==='mixta')tasks.push((async()=>{const t=Date.now();try{const result=await ownData(db,user,question,date);await log('datos',t,result.procedencia,!result.suficiente);return {answer:result.respuesta,sources:[],escalated:!result.suficiente};}catch(e){await log('datos',t,[],true,'ERROR_DATOS');throw e;}})());
      if(kind==='politica'||kind==='mixta')tasks.push((async()=>{const t=Date.now();try{const rawResult=await policyImpl(db,question,date,{searchQuestion:buildSearchQuestion(question,routing.consulta_reformulada),personalHandled:kind==='mixta'});const result={...rawResult,answer:kind==='mixta'?policyPartOnly(rawResult.answer):rawResult.answer};if(!result.answer){result.answer='No pude verificar la parte normativa.';result.sources=[];result.escalated=true;}await log('politicas',t,result.sources,result.escalated);return result;}catch(e){await log('politicas',t,[],true,'ERROR_POLITICAS');return {answer:'No pude verificar la evidencia documental en este momento. Consultá a RRHH.',sources:[],escalated:true};}})());
      if(kind==='reporte'){
        if(user.rol!=='rrhh'){parts.push('Acceso exclusivo para RRHH.');escalated=true;}
        else tasks.push((async()=>{const t=Date.now(),d=await reportMetrics(db,date),vac=d.ausencias.desglose.filter(x=>x.tipo==='vacaciones').reduce((n,x)=>n+x.personas,0);await log('analista',t,['SQL ausencias_agregadas']);return {answer:`Al ${date} hay ${vac} personas de vacaciones y ${d.ausencias.total} personas ausentes en total. Procedencia: SQL, corte 07:00 America/Costa_Rica.`,sources:[],escalated:false};})());
      }
      for(const result of await Promise.all(tasks)){parts.push(result.answer);sources.push(...result.sources);escalated=escalated||result.escalated;}
    }
    await log('orquestador',start,sources,escalated);
    const response=parts.join('\n\n');
    await db.query("UPDATE consultas_chat SET respuesta=$1,citas=$2,resuelta=$3,escalada=$4,latencia_total_ms=$5,estado='completada' WHERE id=$6",[response,JSON.stringify(sources),!escalated,escalated,Date.now()-start,id]);
    return {answer:response,sources,consulta_id:id};
  }catch(error){await log('orquestador',start,[],true,'ERROR_AGENTE');await db.query("UPDATE consultas_chat SET estado='fallida',escalada=1,latencia_total_ms=$1,error='ERROR_AGENTE' WHERE id=$2",[Date.now()-start,id]);throw error;}
}
function topic(question,kind){const q=question.toLowerCase();for(const [key,re] of [['vacaciones',/vacacion|saldo|quedan/],['pagos',/pago|aguinaldo|salario/],['permisos',/permiso|licencia|maternidad|paternidad/],['incapacidades',/incapaci/],['evaluaciones',/evaluaci/],['jornada',/horario|jornada|teletrabaj|asistencia|horas extra/],['beneficios',/beneficio|seguro|capacitaci/]])if(re.test(q))return key;return ['restringida','fuera_alcance','reporte'].includes(kind)?kind:'otras_politicas';}
