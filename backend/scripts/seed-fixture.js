import {db} from '../server/db.js';
import {config} from '../server/config.js';
if(config.NODE_ENV!=='development')throw Error('Fixture solo para desarrollo');
const c=await db.connect();
try{
  await c.query('BEGIN');
  const done=await c.query('SELECT nombre FROM seed_versiones WHERE nombre=$1',['guias-2026-11-17-v1']);
  if(done.rows.length){await c.query('ROLLBACK');console.log('Fixture ya aplicado; no se modificaron datos');}
  else {
    const people=await c.query('SELECT id,nombre FROM colaboradores');
    if(people.rows.length<250||people.rows.some(p=>!/^Persona ficticia \d+$/.test(p.nombre)))throw Error('El fixture requiere los 250 colaboradores ficticios del seed; no se modifican otros datos');
    await c.query(`UPDATE colaboradores c SET puesto='Asistente de servicios',fecha_ingreso=COALESCE(fecha_ingreso,(SELECT MIN(m.fecha) FROM movimientos_personal m WHERE m.colaborador_id=c.id AND m.tipo='ingreso'),'2024-01-08'),fecha_salida=CASE WHEN activo=0 THEN (SELECT MAX(m.fecha) FROM movimientos_personal m WHERE m.colaborador_id=c.id AND m.tipo='salida') ELSE NULL END`);
    await c.query("UPDATE colaboradores SET fecha_ingreso='2024-01-08',departamento='Administración' WHERE id=1");
    await c.query("UPDATE movimientos_personal SET fecha='2024-01-08' WHERE colaborador_id=1 AND tipo='ingreso'");
    await c.query("UPDATE colaboradores SET fecha_ingreso='2024-02-01' WHERE id=251");
    await c.query("INSERT INTO movimientos_personal(colaborador_id,tipo,fecha,motivo_simulado) VALUES(251,'ingreso','2024-02-01','Ingreso simulado anterior a salida')");
    await c.query("UPDATE solicitudes SET creada_en=DATE_ADD(CAST(fecha AS DATETIME),INTERVAL 15 HOUR),fecha_inicio=DATE_ADD(fecha,INTERVAL 20 DAY),fecha_fin=DATE_ADD(fecha,INTERVAL 22 DAY)");
    await c.query("UPDATE saldos_vacaciones SET periodo_inicio='2026-01-01',periodo_fin='2026-12-16',dias_asignados=GREATEST(dias,15),dias_tomados=GREATEST(15-dias,0),ajustes=0,actualizado_en=UTC_TIMESTAMP()");
    await c.query('UPDATE saldos_vacaciones SET dias=12,dias_asignados=15,dias_tomados=3 WHERE colaborador_id=1');
    for(const [clave,id,tipo,inicio,fin,estado] of [['SOL-001',1,'permiso','2026-11-20','2026-11-20','pendiente'],['SOL-002',2,'vacaciones','2026-11-16','2026-11-18','aprobada'],['SOL-003',3,'vacaciones','2026-11-17','2026-11-19','aprobada']])await c.query(`INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha,fecha_inicio,fecha_fin,creada_en,resuelta_en,fixture_clave) VALUES($1,$2,$3,$4,$4,$5,'2026-11-12 15:00:00',$6,$7)`,[id,tipo,estado,inicio,fin,estado==='aprobada'?'2026-11-13 15:00:00':null,clave]);
    await c.query("INSERT INTO evaluaciones_desempeno(colaborador_id,fecha_programada,estado,clave) VALUES(1,'2026-12-15','programada','EVA-COL-001-2026')");
    await c.query("INSERT INTO calendario_pagos(fecha,fecha_nominal,descripcion,tipo,grupo_planilla,clave,fuente) VALUES('2026-11-30','2026-11-30','Pago simulado del fixture','salario','general','fixture-pago-2026-11-30','fixture_controlado.json')");
    await c.query("UPDATE incapacidades SET entidad='CCSS',tipo_administrativo='enfermedad',referencia_simulada=CONCAT('INC-SIM-',id)");
    await c.query("INSERT INTO seed_versiones VALUES('guias-2026-11-17-v1',UTC_TIMESTAMP())");
    await c.query('COMMIT');console.log('Fixture integrado: 251 colaboradores conservados, saldo 12, solicitud y evaluación de prueba');
  }
}catch(e){await c.query('ROLLBACK');console.error(e.message);process.exitCode=1}finally{c.release();await db.end()}
