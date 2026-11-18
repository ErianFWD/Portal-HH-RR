import {test} from 'node:test';
import assert from 'node:assert/strict';
import {validateSummary,summarizeReport} from '../server/agents/report-summary.js';
import {localDate,utcCutoff,nextFriday} from '../server/time.js';
const facts={ausentes:2,pendientes:4,mayores_72h:1,rotacion_pct:null,vacaciones_riesgo:3,chat_completadas:0,chat_resuelto_pct:null};
const valid={frases:[{metrica:'ausentes',valor:2,texto:'Hay 2 personas ausentes.'},{metrica:'pendientes',valor:4,texto:'Hay 4 solicitudes pendientes.'},{metrica:'rotacion_pct',valor:null,texto:'La rotación está sin base.'}]};
test('valida cifras y rechaza cifras inventadas y tendencias sin evidencia',()=>{
  assert.match(validateSummary(valid,facts),/2 personas/);
  for(const patch of [{valor:200},{texto:'Las ausencias aumentaron a 2 personas.'},{texto:'Hay 2 ausentes y 99 solicitudes.'}]){const copy=structuredClone(valid);Object.assign(copy.frases[0],patch);assert.throws(()=>validateSummary(copy,facts));}
});
test('limita regeneración y entrega fallback marcado cuando el modelo falla',async()=>{let calls=0;const result=await summarizeReport({ausencias:{total:2},pendientes:{total:4,mayores_72h:1},personal:{rotacion_pct:null},vacaciones_riesgo:3,chat:{completadas:0,resuelto_pct:null}},{complete:async()=>{calls++;return {texto:'Inventado'};}});assert.equal(calls,2);assert.equal(result.method,'plantilla');assert.equal(result.text,null);assert.ok(result.error);});
test('resuelve medianoche y corte en Costa Rica sin depender del host',()=>{assert.equal(localDate(new Date('2026-11-18T05:59:00Z')),'2026-11-17');assert.equal(utcCutoff('2026-11-17'),'2026-11-17 13:00:00');assert.equal(nextFriday('2026-11-17'),'2026-11-20');});
