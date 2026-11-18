import {z} from 'zod';
import {completion} from '../llm.js';
import {prompts} from '../prompts.js';
import {config} from '../config.js';

const keys=['ausentes','pendientes','mayores_72h','rotacion_pct','vacaciones_riesgo','chat_completadas','chat_resuelto_pct'];
const schema=z.object({frases:z.array(z.object({metrica:z.enum(keys),valor:z.number().nullable(),texto:z.string().min(5).max(320)}).strict()).min(3).max(5)}).strict();
export function factsFromReport(d){return {ausentes:d.ausencias.total,pendientes:d.pendientes.total,mayores_72h:d.pendientes.mayores_72h,rotacion_pct:d.personal.rotacion_pct,vacaciones_riesgo:d.vacaciones_riesgo,chat_completadas:d.chat.completadas,chat_resuelto_pct:d.chat.resuelto_pct};}
export function validateSummary(candidate,facts){
  const result=schema.parse(candidate),seen=new Set(),labels={ausentes:/ausen/i,pendientes:/pendien/i,mayores_72h:/72 horas/i,rotacion_pct:/rotaci/i,vacaciones_riesgo:/vacacion/i,chat_completadas:/chat|consulta/i,chat_resuelto_pct:/chat|consulta/i};
  for(const f of result.frases){
    if(seen.has(f.metrica)||f.valor!==facts[f.metrica]||!labels[f.metrica].test(f.texto)||/aument|dismin|subi|baj[oó]|creci|reduj|mejor|empeor|tendencia|respecto|comparad|diagn[oó]stico/i.test(f.texto))throw Error('RESUMEN_NO_SUSTENTADO');
    seen.add(f.metrica);
    const nums=(f.texto.match(/\d+(?:[.,]\d+)?/g)||[]).map(v=>Number(v.replace(',','.')));
    if(f.valor===null){if(nums.length||!/sin (base|consultas)/i.test(f.texto))throw Error('RESUMEN_SIN_BASE');}
    else if(!nums.includes(f.valor)||nums.some(n=>n!==f.valor&&!(f.metrica==='mayores_72h'&&n===72)&&!(f.metrica==='vacaciones_riesgo'&&n===20)))throw Error('RESUMEN_NUMERO_INVALIDO');
  }
  return result.frases.map(f=>f.texto).join(' ');
}
export async function summarizeReport(data,{complete=completion}={}){
  if(complete===completion&&config.ANALYST_LLM_ENABLED!=='true')return {text:null,method:'plantilla',error:'LLM_ANALISTA_NO_AUTORIZADO'};
  const facts=Object.freeze(factsFromReport(data));
  for(let attempt=0;attempt<2;attempt++){
    try {const result=await complete(prompts.analista+' Devolvé JSON {frases:[{metrica,valor,texto}]}, entre 3 y 5 frases, una métrica por frase. metrica debe ser una de las claves recibidas; valor debe copiar exactamente su cifra. Escribí números con dígitos, nunca letras. No hagas comparaciones ni afirmaciones de tendencia. Si el valor es null, decí sin base o sin consultas. No agregues otras cifras, fechas, nombres ni conclusiones causales.',{metricas:facts},{json:true,maxTokens:650});return {text:validateSummary(result,facts),method:'llm',error:null};}catch{}
  }
  return {text:null,method:'plantilla',error:'LLM_NO_VALIDADO'};
}
