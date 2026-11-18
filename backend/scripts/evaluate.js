import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {parse} from 'csv-parse/sync';
import {createHash} from 'node:crypto';
import {db} from '../server/db.js';
import {config} from '../server/config.js';
import {answer} from '../server/agents/orchestrator.js';

const out=new URL('../../docs/resultados/',import.meta.url),date='2026-11-17';
const intervalArg=process.argv.find(a=>a.startsWith('--interval-ms='));
const interval=intervalArg?Number(intervalArg.split('=')[1]):0;
if(!Number.isFinite(interval)||interval<0||interval>60000)throw Error('Intervalo entre llegadas inválido');
const archive=new URL('evaluacion-'+new Date().toISOString().replace(/[:.]/g,'-')+'/',out);
const csv=value=>'"'+String(value??'').replaceAll('"','""')+'"';
try {
  await mkdir(out,{recursive:true});
  await mkdir(archive,{recursive:true});
  const corpus=(await db.query('SELECT id,nombre,version,hash_contenido FROM documentos WHERE aprobado=1 ORDER BY id')).rows;
  const policies=new Set(corpus.map(d=>d.nombre.match(/POL-\d{2}/)?.[0]).filter(Boolean));
  const metadata={ejecutado_en:new Date().toISOString(),fecha_reloj:date,zona:'America/Costa_Rica',concurrencia:1,intervalo_minimo_llegadas_ms:interval,archivo_historico:archive.pathname.split('/').filter(Boolean).at(-1),modelo:config.DEEPSEEK_MODEL,modelo_embedding:config.VOYAGE_MODEL,umbral:config.RAG_THRESHOLD,timeout_ms:config.LLM_TIMEOUT_MS,corpus_documentos:corpus.length,corpus_hash:createHash('sha256').update(JSON.stringify(corpus)).digest('hex'),estado:'pendiente',nota:'Las filas requieren revisión humana de contenido, fuentes y permisos; no se aprueban por recibir HTTP 200. Intervalo declarado entre llegadas: la latencia se mide desde que se presenta cada pregunta hasta su respuesta completa; no es una prueba de ráfaga.'};
  const codeFiles=['orchestrator','router','classify','policy','employee','vector','deepseek'];
  metadata.codigo_hash=createHash('sha256').update((await Promise.all(codeFiles.map(name=>readFile(new URL('../server/agents/'+name+'.js',import.meta.url),'utf8')))).join('\n')).digest('hex');
  metadata.recuperacion='coseno + términos ponderados por frecuencia, cinco fragmentos, calendario SQL público cuando hay rango explícito';
  metadata.recuperacion+='; contexto de la política principal y secciones vecinas, sin encabezados de portada aislados';
  const fixtureTables=['colaboradores','saldos_vacaciones','solicitudes','incapacidades','calendario_pagos','evaluaciones_desempeno','feriados','seed_versiones'];
  const fixture={};for(const table of fixtureTables){const order=table==='feriados'?'fecha':table==='seed_versiones'?'nombre':table==='saldos_vacaciones'?'colaborador_id':'id';fixture[table]=(await db.query('SELECT * FROM '+table+' ORDER BY '+order)).rows;}
  metadata.fixture_hash=createHash('sha256').update(JSON.stringify(fixture)).digest('hex');
  metadata.nota=metadata.nota.replace('revisión humana','revisión de contenido');
  async function saveMetadata(){for(const folder of [out,archive])await writeFile(new URL('condiciones.json',folder),JSON.stringify(metadata,null,2));}
  if(policies.size<10){metadata.estado='bloqueada_sin_corpus_completo';await saveMetadata();throw Error('Faltan las diez políticas aprobadas de Drive; evaluación de calidad no ejecutada.');}
  const rows=parse(await readFile(new URL('../../docs/guias_rrhh/evaluacion/banco_45_preguntas.csv',import.meta.url),'utf8'),{columns:true,bom:true,skip_empty_lines:true});
  const users=(await db.query("SELECT u.id,u.colaborador_id,u.rol FROM usuarios u JOIN colaboradores c ON c.id=u.colaborador_id WHERE u.activo=1 AND c.activo=1 AND u.email IN ('colaborador@demo.local','rrhh@demo.local')")).rows;
  if(!users.some(u=>u.rol==='colaborador'&&u.colaborador_id===1)||!users.some(u=>u.rol==='rrhh'))throw Error('Faltan las identidades reales de demostración; no se simulan permisos.');
  const fields=Object.keys(rows[0]);
  metadata.identidades=users.map(u=>({usuario_id:u.id,colaborador_id:u.colaborador_id,rol:u.rol}));
  metadata.nota_identidad_rrhh='La pregunta agregada de RRHH usa su identidad de sesión real, vinculada al colaborador 2 del seed; no se promueve al colaborador 1 mediante el texto de la pregunta.';
  async function save(){for(const folder of [out,archive])await writeFile(new URL('banco_45_ejecutado.csv',folder),fields.map(csv).join(',')+'\n'+rows.map(r=>fields.map(k=>csv(r[k])).join(',')).join('\n')+'\n');}
  let previousStart=0;
  await saveMetadata();
  for(const row of rows){
    const wait=Math.max(0,interval-(performance.now()-previousStart));if(wait)await new Promise(resolve=>setTimeout(resolve,wait));
    previousStart=performance.now();
    const user=users.find(u=>u.rol===row.rol),start=performance.now();
    try {const result=await answer(db,user,row.pregunta,{date});row.respuesta_obtenida=result.answer;row.citas_obtenidas=JSON.stringify(result.sources);row.estado='Ejecutada_pendiente_revision';}
    catch{row.respuesta_obtenida='ERROR_EJECUCION';row.citas_obtenidas='[]';row.estado='Fallida';row.correcta='No';}
    row.latencia_ms=Math.round(performance.now()-start);await save();console.log('Pregunta '+row.id+': '+row.estado+' ('+row.latencia_ms+' ms)');
  }
  metadata.estado='ejecutada_pendiente_revision';await saveMetadata();
}catch(error){console.error(error.message);process.exitCode=1;}finally{await db.end();}
