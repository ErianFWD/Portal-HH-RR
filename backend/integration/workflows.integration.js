import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {Sequelize} from 'sequelize';
import {db,databaseAdapter} from '../server/db.js';
import {config} from '../server/config.js';
import {up} from '../migrations/002_portal.js';
import {up as workflows} from '../migrations/003_workflows.js';
import {createApp} from '../server/app.js';
import {createVacation,resolveVacation,balance} from '../server/workflows/vacations.js';
import {mark,correct,schedule,present,duration} from '../server/workflows/attendance.js';
import {ownData} from '../server/agents/employee.js';

test('flujos reales en MySQL aislado: vacaciones y asistencia',async t=>{
  const name='portalrrhh_workflows_test_'+process.pid;assert.match(name,/^portalrrhh_workflows_test_\d+$/);
  const url=new URL(config.DATABASE_URL);url.pathname='/'+name;
  let testDb,server,created=false;
  const user={id:1,colaborador_id:1,rol:'colaborador'},hr={id:2,colaborador_id:2,rol:'rrhh'},third={id:3,colaborador_id:3,rol:'colaborador'};
  try{
    await db.query('CREATE DATABASE `'+name+'` CHARACTER SET utf8mb4');created=true;
    testDb=databaseAdapter(new Sequelize(url.toString(),{logging:false,timezone:'+00:00',pool:{max:10,min:0}}));
    for(const s of (await readFile(new URL('../migrations/001.sql',import.meta.url),'utf8')).split(';').filter(s=>s.trim()))await testDb.query(s);
    await up(testDb);
    await testDb.query("INSERT INTO colaboradores(id,nombre,departamento,activo,fecha_ingreso) VALUES(1,'Prueba A','Operaciones',1,'2020-01-01'),(2,'Prueba RRHH','RRHH',1,'2020-01-01'),(3,'Prueba B','Operaciones',1,'2020-01-01'),(4,'Sin saldo','RRHH',1,'2020-01-01')");
    await testDb.query("INSERT INTO usuarios(id,colaborador_id,email,password_hash,rol) VALUES(1,1,'a@prueba.local','unused','colaborador'),(2,2,'hr@prueba.local','unused','rrhh'),(3,3,'b@prueba.local','unused','colaborador')");
    await testDb.query('INSERT INTO saldos_vacaciones(colaborador_id,dias,dias_asignados,dias_tomados,ajustes) VALUES(1,10,15,3,0),(2,20,20,0,0),(3,0,0,0,0)');
    await testDb.query("INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha_inicio,fecha_fin,creada_en,resuelta_en) VALUES(1,'vacaciones','aprobada','2025-01-06','2025-01-08','2024-12-01','2024-12-02')");
    await workflows(testDb);await workflows(testDb);
    await testDb.query("INSERT INTO calendarios_cobertura VALUES(2030,'Calendario controlado de prueba',2,UTC_TIMESTAMP()),(2026,'Calendario prueba asistencia',2,UTC_TIMESTAMP())");
    await testDb.query("INSERT INTO feriados(fecha,nombre) VALUES('2030-04-02','Feriado de prueba'),('2026-11-03','Feriado asistencia')");
    const tokens={col:'a'.repeat(64),hr:'b'.repeat(64),third:'c'.repeat(64)};
    for(const [key,uid] of [['col',1],['hr',2],['third',3]])await testDb.query('INSERT INTO sesiones VALUES($1,$2,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 HOUR))',[createHash('sha256').update(tokens[key]).digest('hex'),uid]);
    server=createApp(testDb,{NODE_ENV:'test'}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
    const base='http://127.0.0.1:'+server.address().port;
    const request=async(path,{role='col',body,csrf=true,headers={}}={})=>{const r=await fetch(base+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{Cookie:'session='+tokens[role],'Content-Type':'application/json',...(csrf?{'X-Portal-Request':'1'}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
    const vacation=(inicio,fin=inicio)=>({inicio,fin,mensaje:'Mensaje de prueba'});
    let first;
    await t.test('migración idempotente, ajuste de apertura y aprobadas históricas sin nuevo descuento',async()=>{
      const b=await balance(testDb,1);assert.equal(b.confirmado,10);assert.equal(Number(b.ajustes),-2);assert.equal(Number(b.dias_asignados)-Number(b.dias_tomados)+Number(b.ajustes),10);
      assert.equal(Number((await testDb.query("SELECT COUNT(*) n FROM movimientos_vacaciones WHERE colaborador_id=1 AND tipo='apertura_historica'")).rows[0].n),1);
    });
    await t.test('1,3,5: crear, excluir fines de semana y feriados, reservar separadamente',async()=>{
      const preview=await request('me/calcular-solicitud?inicio=2030-03-30&fin=2030-04-03');assert.equal(preview.status,200);assert.equal(preview.data.dias,2);
      const r=await request('me/solicitudes',{body:vacation('2030-04-01','2030-04-03')});assert.equal(r.status,201);first=r.data.id;
      const b=(await request('me/vacaciones')).data;assert.equal(b.confirmado,10);assert.equal(b.reservados,2);assert.equal(b.disponibles,8);
      const answer=await ownData(testDb,user,'¿Cuál es mi saldo disponible?','2026-11-18');assert.match(answer.respuesta,/2 días reservados/);assert.match(answer.respuesta,/8 días disponibles/);
    });
    await t.test('2: insuficiente y ausencia de registro de saldo',async()=>{
      assert.equal((await request('me/solicitudes',{role:'third',body:vacation('2030-04-01')})).status,409);
      await assert.rejects(createVacation(testDb,{...user,colaborador_id:4},vacation('2030-04-01')),/No hay saldo/);
      assert.equal((await request('me/solicitudes',{body:vacation('2030-05-01','2030-05-31')})).status,409);
    });
    await t.test('4: duplicados, solapamientos, incapacidades y permisos aprobados',async()=>{
      assert.equal((await request('me/solicitudes',{body:vacation('2030-04-03','2030-04-04')})).status,409);
      await testDb.query("INSERT INTO incapacidades(colaborador_id,inicio,fin) VALUES(1,'2030-04-08','2030-04-08')");
      assert.equal((await request('me/solicitudes',{body:vacation('2030-04-08')})).status,409);
      await testDb.query("INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha_inicio,fecha_fin) VALUES(1,'permiso','aprobada','2030-04-09','2030-04-09')");
      assert.equal((await request('me/solicitudes',{body:vacation('2030-04-09')})).status,409);
    });
    await t.test('validación: fecha imposible, pasada, calendario ausente y rango sin hábiles',async()=>{
      for(const body of [vacation('2030-02-30'),vacation('2020-01-01'),vacation('2030-04-07'),vacation('2030-04-03','2030-04-01'),vacation('2030-01-01','2031-04-01')])assert.equal((await request('me/solicitudes',{body})).status,400);
      assert.equal((await request('me/solicitudes',{body:vacation('2031-04-01')})).status,422);
      assert.equal((await request('me/solicitudes',{body:{...vacation('2030-04-10'),colaborador_id:2}})).status,400);
    });
    await t.test('9: no leer ni cancelar ajenas; CSRF y permisos administrativos',async()=>{
      assert.equal((await request(`me/solicitudes/${first}/cancelar`,{role:'third',body:{}})).status,404);
      assert.ok(!(await request('me/solicitudes',{role:'third'})).data.some(s=>s.id===first));
      for(const path of ['rrhh/solicitudes','rrhh/solicitudes/'+first,'rrhh/asistencia','rrhh/horarios/1','rrhh/colaboradores','rrhh/calendarios'])assert.equal((await request(path)).status,403);
      for(const path of [`rrhh/solicitudes/${first}/resolver`,'rrhh/asistencia/1/corregir','rrhh/horarios/1'])assert.equal((await request(path,{body:{}})).status,403);
      assert.equal((await request('me/solicitudes',{body:vacation('2030-04-10'),csrf:false})).status,403);
      assert.equal((await request('me/solicitudes',{body:vacation('2030-04-10'),headers:{'Sec-Fetch-Site':'cross-site'}})).status,403);
    });
    await t.test('6,10: dos decisiones simultáneas descuentan una vez y respuesta visible',async()=>{
      const results=await Promise.all([1,2].map(()=>request(`rrhh/solicitudes/${first}/resolver`,{role:'hr',body:{estado:'aprobada',respuesta:'Aprobado por RRHH'}})));
      assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const b=await balance(testDb,1);assert.equal(b.confirmado,8);assert.equal(b.reservados,0);
      const s=(await request('me/solicitudes')).data.find(s=>s.id===first);assert.equal(s.respuesta_rrhh,'Aprobado por RRHH');assert.equal(s.resuelto_por,2);assert.ok(s.resuelta_en);
      assert.equal(Number((await testDb.query('SELECT COUNT(*) n FROM movimientos_vacaciones WHERE solicitud_id=$1',[first])).rows[0].n),1);
    });
    await t.test('7: rechazo obligatorio y cancelación liberan reserva sin descontar',async()=>{
      const r=await request('me/solicitudes',{body:vacation('2030-04-10')});const path=`rrhh/solicitudes/${r.data.id}/resolver`;
      assert.equal((await request(path,{role:'hr',body:{estado:'rechazada',respuesta:''}})).status,400);
      assert.equal((await request(path,{role:'hr',body:{estado:'rechazada',respuesta:'Reprogramar'}})).status,200);
      const s=await request('me/solicitudes',{body:vacation('2030-04-11')});assert.equal((await request(`me/solicitudes/${s.data.id}/cancelar`,{body:{}})).status,200);
      const b=await balance(testDb,1);assert.equal(b.confirmado,8);assert.equal(b.reservados,0);
    });
    await t.test('8: aprobaciones de distintas solicitudes serializadas sin saldo negativo',async()=>{
      const a=await createVacation(testDb,user,vacation('2030-06-03','2030-06-06')),b=await createVacation(testDb,user,vacation('2030-06-10','2030-06-13'));
      const result=await Promise.all([a,b].map(s=>resolveVacation(testDb,hr,s.id,{estado:'aprobada',respuesta:'OK'})));assert.equal(result.length,2);assert.equal((await balance(testDb,1)).confirmado,0);
      const row=(await testDb.query('SELECT * FROM saldos_vacaciones WHERE colaborador_id=1')).rows[0];assert.equal(Number(row.dias_asignados)-Number(row.dias_tomados)+Number(row.ajustes),0);
    });
    await t.test('reservas concurrentes no exceden saldo y revalidación detecta cambio del saldo',async()=>{
      await testDb.query('UPDATE saldos_vacaciones SET dias=1,dias_asignados=1 WHERE colaborador_id=3');
      const results=await Promise.allSettled(['2030-07-01','2030-07-02'].map(d=>createVacation(testDb,third,vacation(d))));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await balance(testDb,3)).reservados,1);
      const s=results.find(r=>r.status==='fulfilled').value;
      await testDb.query('UPDATE saldos_vacaciones SET dias=0,dias_asignados=0 WHERE colaborador_id=3');
      await assert.rejects(resolveVacation(testDb,hr,s.id,{estado:'aprobada',respuesta:'OK'}),/insuficiente/);
      await resolveVacation(testDb,hr,s.id,{estado:'rechazada',respuesta:'Saldo actualizado'});
    });
    await t.test('revalidar antes de aprobar y no permitir autoaprobación',async()=>{
      const s=await createVacation(testDb,hr,vacation('2030-06-03'));
      await assert.rejects(resolveVacation(testDb,hr,s.id,{estado:'aprobada',respuesta:'OK'}),/propia/);
      await testDb.query("INSERT INTO incapacidades(colaborador_id,inicio,fin) VALUES(2,'2030-06-03','2030-06-03')");
      await assert.rejects(resolveVacation(testDb,{...hr,colaborador_id:3},s.id,{estado:'aprobada',respuesta:'OK'}),/incapacidad/);
    });
    const at=s=>({now:new Date(s)});let closed;
    await t.test('14: salida sin entrada rechazada',async()=>{assert.equal((await request('me/asistencia/salida',{body:{clave:randomUUID()}})).status,409);});
    await t.test('11,12,15: entrada persistida, recarga, medianoche CR y duración',async()=>{
      const r=await mark(testDb,user,'entrada',{clave:randomUUID()},at('2026-11-03T05:30:00Z'));assert.equal(r.estado,'abierta');
      const reloaded=(await request('me/asistencia/actual')).data;assert.equal(reloaded.actual.id,r.id);assert.equal(reloaded.actual.entrada,'2026-11-03T05:30:00.000Z');assert.ok(reloaded.server_now);
      const result=await mark(testDb,user,'salida',{clave:randomUUID()},at('2026-11-03T07:00:00Z'));assert.equal(result.duracion_segundos,5400);closed=result;
      assert.equal(duration({entrada:result.entrada,salida:result.salida},new Date('2040-01-01')),5400);
    });
    await t.test('13: entrada concurrente y reintentos idempotentes',async()=>{
      const input={clave:randomUUID()},now=at('2026-11-04T14:00:00Z');
      const r=await Promise.all([mark(testDb,user,'entrada',input,now),mark(testDb,user,'entrada',input,now)]);assert.equal(r[0].id,r[1].id);
      const attempts=await Promise.allSettled([1,2].map(()=>mark(testDb,user,'entrada',{clave:randomUUID()},now)));assert.ok(attempts.every(r=>r.status==='rejected'));
      const out={clave:randomUUID()};const results=await Promise.all([mark(testDb,user,'salida',out,at('2026-11-04T23:00:00Z')),mark(testDb,user,'salida',out,at('2026-11-04T23:00:00Z'))]);assert.equal(results[0].id,results[1].id);
    });
    await t.test('entradas simultáneas con claves diferentes dejan una sola jornada',async()=>{
      const r=await Promise.allSettled([1,2].map(()=>mark(testDb,user,'entrada',{clave:randomUUID()},at('2026-11-05T14:00:00Z'))));assert.equal(r.filter(v=>v.status==='fulfilled').length,1);
      await assert.rejects(mark(testDb,user,'salida',{clave:randomUUID()},at('2026-11-05T13:00:00Z')),/posterior/);
      await mark(testDb,user,'salida',{clave:randomUUID()},at('2026-11-05T23:00:00Z'));
    });
    await t.test('16,17,18: corregir con motivo, conservar original y evitar solapamiento',async()=>{
      assert.equal((await request(`rrhh/asistencia/${closed.id}/corregir`,{body:{}})).status,403);
      await assert.rejects(correct(testDb,hr,closed.id,{entrada:'2026-11-03T05:30:00Z',salida:'2026-11-03T07:10:00Z',motivo:''}));
      const r=await request(`rrhh/asistencia/${closed.id}/corregir`,{role:'hr',body:{entrada:'2026-11-03T05:30:00Z',salida:'2026-11-03T07:10:00Z',motivo:'Salida olvidada'}});assert.equal(r.status,200);
      const audit=(await request(`rrhh/asistencia/${closed.id}/correcciones`,{role:'hr'})).data;assert.equal(audit.length,1);assert.equal(audit[0].usuario_id,2);assert.ok(audit[0].original);assert.ok(audit[0].nuevo);
      const own=(await request('me/asistencia')).data.find(r=>r.id===closed.id);assert.equal(own.corregida,1);assert.equal(own.observaciones,'Salida olvidada');
      await assert.rejects(correct(testDb,hr,closed.id,{entrada:'2026-11-04T14:30:00Z',salida:'2026-11-04T23:00:00Z',motivo:'Solapamiento'}),/solapa/);
      await assert.rejects(correct(testDb,hr,closed.id,{entrada:'2026-11-03T07:30:00Z',salida:'2026-11-03T07:00:00Z',motivo:'Negativa'}),/posterior/);
    });
    await t.test('18: varios intervalos cerrados el mismo día',async()=>{
      for(const [a,b] of [['14:00','16:00'],['17:00','23:00']]){await mark(testDb,third,'entrada',{clave:randomUUID()},at('2026-11-05T'+a+':00Z'));await mark(testDb,third,'salida',{clave:randomUUID()},at('2026-11-05T'+b+':00Z'));}
      assert.equal(Number((await testDb.query('SELECT COUNT(*) n FROM asistencia WHERE colaborador_id=3 AND salida IS NOT NULL')).rows[0].n),2);
    });
    await t.test('19: horario aplicable, tolerancia, feriados y ausencia; sin sanciones',async()=>{
      await testDb.query("INSERT INTO horarios(colaborador_id,vigente_desde,dias,entrada,salida,tolerancia_min,motivo,creado_en) VALUES(3,'2026-11-06','[1,2,3,4,5]','08:00','17:00',10,'Versión controlada',UTC_TIMESTAMP())");
      let r=await mark(testDb,third,'entrada',{clave:randomUUID()},at('2026-11-06T14:05:00Z'));assert.ok(!r.incidencias.includes('llegada_tardia'));
      r=await mark(testDb,third,'salida',{clave:randomUUID()},at('2026-11-06T22:00:00Z'));assert.ok(r.incidencias.includes('salida_anticipada'));
      r=await mark(testDb,third,'entrada',{clave:randomUUID()},at('2026-11-03T14:30:00Z')).catch(e=>e);assert.match(r.message,/solapa/); // No se inserta un intervalo abierto que cubra registros posteriores.
      const h=await mark(testDb,hr,'entrada',{clave:randomUUID()},at('2026-11-03T14:30:00Z'));assert.ok(h.incidencias.includes('marca_en_feriado'));assert.ok(!h.incidencias.includes('llegada_tardia'));
      const unusual=present(h,new Date('2026-11-05T14:30:00Z'));assert.ok(unusual.incidencias.includes('jornada_abierta_inusual'));assert.equal(unusual.salida,null);
      await mark(testDb,hr,'salida',{clave:randomUUID()},at('2026-11-03T23:00:00Z'));
      const absent=await mark(testDb,hr,'entrada',{clave:randomUUID()},at('2030-06-03T14:30:00Z'));assert.ok(absent.incidencias.includes('marca_en_ausencia'));
      const late=await mark(testDb,user,'entrada',{clave:randomUUID()},at('2026-11-09T14:30:00Z'));assert.ok(late.incidencias.includes('llegada_tardia'));await mark(testDb,user,'salida',{clave:randomUUID()},at('2026-11-09T23:00:00Z'));
    });
    await t.test('horarios versionados, motivo obligatorio y prohibir vigencia retroactiva',async()=>{
      const s={vigente_desde:new Date().toLocaleDateString('sv-SE',{timeZone:'America/Costa_Rica'}),dias:[1,2,3,4,5],entrada:'09:00',salida:'18:00',tolerancia_min:5,motivo:'Nuevo horario'};
      const old=(await testDb.query('SELECT horario_snapshot FROM asistencia WHERE id=$1',[closed.id])).rows[0].horario_snapshot;
      await schedule(testDb,hr,1,s);await assert.rejects(schedule(testDb,hr,1,{...s,motivo:''}));await assert.rejects(schedule(testDb,hr,1,{...s,vigente_desde:'2000-01-01'}),/Vigencia/);
      assert.deepEqual((await testDb.query('SELECT horario_snapshot FROM asistencia WHERE id=$1',[closed.id])).rows[0].horario_snapshot,old);
    });
    await t.test('RRHH recupera una marcación olvidada sin registro previo con auditoría',async()=>{
      const body={colaborador_id:1,entrada:'2026-11-10T14:00:00Z',salida:'2026-11-10T23:00:00Z',motivo:'Olvido de ambas marcas confirmado'};
      assert.equal((await request('rrhh/asistencia',{body})).status,403);
      const r=await request('rrhh/asistencia',{role:'hr',body});assert.equal(r.status,201);
      assert.equal((await request('rrhh/asistencia',{role:'hr',body})).status,409);
      const audit=(await request(`rrhh/asistencia/${r.data.id}/correcciones`,{role:'hr'})).data;assert.equal(audit.length,1);assert.equal(audit[0].usuario_id,2);
      const own=(await request('me/asistencia')).data.find(v=>v.id===r.data.id);assert.equal(own.observaciones,body.motivo);assert.equal(own.corregida,1);
    });
    await t.test('marcación HTTP usa reloj del servidor y rechaza horas arbitrarias',async()=>{
      const bad=await request('me/asistencia/entrada',{role:'third',body:{clave:randomUUID(),entrada:'2000-01-01T00:00:00Z'}});assert.equal(bad.status,400);
      const now=Date.now();const r=await request('me/asistencia/entrada',{role:'third',body:{clave:randomUUID()}});assert.equal(r.status,200);assert.ok(Math.abs(Date.parse(r.data.entrada)-now)<5000);
      const out=await request('me/asistencia/salida',{role:'third',body:{clave:randomUUID()}});assert.equal(out.status,200);
    });
  }finally{
    if(server)await new Promise(r=>server.close(r));if(testDb)await testDb.end();if(created)await db.query('DROP DATABASE IF EXISTS `'+name+'`');await db.end();
  }
});
