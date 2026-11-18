import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {config} from '../server/config.js';
const base='http://127.0.0.1:5173/api/',sessions={},checks=[];
async function call(path,{role,body}={}){
  const response=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{...(role?{Cookie:sessions[role]}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
  return {response,data:await response.json()};
}
try{
  for(const role of ['colaborador','rrhh']){
    const {response,data}=await call('login',{body:{email:role+'@demo.local',password:config.DEMO_PASSWORD}});
    assert.equal(response.status,200,'Login de demostración');assert.equal(data.rol,role);
    sessions[role]=response.headers.get('set-cookie').split(';')[0];checks.push({prueba:'login_'+role,correcta:true});
  }
  const balance=await call('me/vacaciones',{role:'colaborador'});assert.equal(Number(balance.data.dias),12);checks.push({prueba:'saldo_propio_SQL',correcta:true});
  assert.equal((await call('rrhh/dashboard',{role:'colaborador'})).response.status,403);checks.push({prueba:'dashboard_colaborador_403',correcta:true});
  const dashboard=await call('rrhh/dashboard',{role:'rrhh'});assert.equal(dashboard.response.status,200);assert.equal(dashboard.data.tendencia.length,30);checks.push({prueba:'dashboard_rrhh_30_dias',correcta:true});
  const chat=await call('chat',{role:'colaborador',body:{question:'¿Cuál es mi saldo de vacaciones?'}});assert.equal(chat.response.status,200);assert.match(chat.data.answer,/12(?:\.00)? días/);checks.push({prueba:'chat_real_con_SQL',correcta:true});
  assert.equal((await call('conversaciones/'+chat.data.conversacion_id+'/mensajes',{role:'rrhh'})).response.status,404);checks.push({prueba:'historial_ajeno_404',correcta:true});
  const own=await call('conversaciones/'+chat.data.conversacion_id+'/mensajes',{role:'colaborador'});assert.equal(own.response.status,200);assert.equal(own.data.length,1);checks.push({prueba:'historial_propio_persistido',correcta:true});
  const policy=await call('chat',{role:'colaborador',body:{question:'¿Con cuánta anticipación debo solicitar vacaciones?'}});assert.equal(policy.response.status,200);assert.match(policy.data.answer,/10 días hábiles/);assert.ok(policy.data.sources.length>0);assert.ok(policy.data.sources.every(s=>/^https:\/\/(?:docs\.google\.com|drive\.google\.com)\//.test(s.enlace)));checks.push({prueba:'RAG_real_con_fuentes_Drive_por_HTTP',correcta:true});
  await writeFile(new URL('../../docs/resultados/smoke_http.json',import.meta.url),JSON.stringify({verificado_en:new Date().toISOString(),entrada:'Vite 127.0.0.1:5173 con proxy API y sesiones reales del demo',checks,aprobada:true},null,2));
  console.log('HTTP real: '+checks.length+' verificaciones correctas; sin registrar contraseñas ni cookies.');
}finally{for(const role of Object.keys(sessions))try{await call('logout',{role,body:{}});}catch{}}
