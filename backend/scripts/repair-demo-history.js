import {db} from '../server/db.js';
import {config} from '../server/config.js';
import {writeFile} from 'node:fs/promises';
if(config.NODE_ENV!=='development')throw Error('Solo datos ficticios de desarrollo');
const c=await db.connect(),version='coherencia-historia-v2';
try{
  await c.query('BEGIN');
  if((await c.query('SELECT nombre FROM seed_versiones WHERE nombre=$1',[version])).rows.length){await c.query('ROLLBACK');console.log('Reparación ya aplicada');}
  else{
    const people=(await c.query('SELECT id,nombre FROM colaboradores')).rows;
    if(people.length<50||people.some(p=>!/^Persona ficticia \d+$/.test(p.nombre)))throw Error('No se modifican datos ajenos al seed ficticio');
    const eligible=(await c.query("SELECT id FROM colaboradores WHERE id>3 AND fecha_ingreso<='2026-09-01' AND (fecha_salida IS NULL OR fecha_salida>'2026-11-12') ORDER BY id LIMIT 8")).rows;
    if(eligible.length<8)throw Error('No hay personal elegible suficiente para la historia');
    for(const month of ['2026-09','2026-10','2026-11']){
      const requests=(await c.query("SELECT id FROM solicitudes WHERE fixture_clave LIKE $1 ORDER BY id",['hist-'+month+'-%'])).rows;
      for(let i=0;i<requests.length;i++)await c.query('UPDATE solicitudes SET colaborador_id=$1 WHERE id=$2',[eligible[i%5].id,requests[i].id]);
      const illnesses=(await c.query('SELECT id FROM incapacidades WHERE referencia_simulada LIKE $1 ORDER BY id',['HIST-INC-'+month+'-%'])).rows;
      for(let i=0;i<illnesses.length;i++)await c.query('UPDATE incapacidades SET colaborador_id=$1 WHERE id=$2',[eligible[5+i%3].id,illnesses[i].id]);
    }
    await c.query("UPDATE incapacidades i JOIN colaboradores c ON c.id=i.colaborador_id SET i.inicio=GREATEST(i.inicio,c.fecha_ingreso),i.fin=GREATEST(i.fin,c.fecha_ingreso) WHERE i.referencia_simulada LIKE 'INC-SIM-%' AND i.inicio<c.fecha_ingreso");
    await c.query("UPDATE solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id SET s.creada_en=GREATEST(s.creada_en,DATE_ADD(CAST(c.fecha_ingreso AS DATETIME),INTERVAL 15 HOUR)) WHERE s.fixture_clave IS NULL AND s.creada_en<CAST(c.fecha_ingreso AS DATETIME)");
    await c.query("UPDATE saldos_vacaciones s JOIN colaboradores c ON c.id=s.colaborador_id SET s.periodo_inicio=DATE_ADD(c.fecha_ingreso,INTERVAL (350*FLOOR(DATEDIFF('2026-11-17',c.fecha_ingreso)/350)) DAY),s.periodo_fin=DATE_ADD(c.fecha_ingreso,INTERVAL (350*FLOOR(DATEDIFF('2026-11-17',c.fecha_ingreso)/350)+349) DAY) WHERE c.fecha_ingreso<='2026-11-17'");
    const invalid=(await c.query("SELECT (SELECT COUNT(*) FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id WHERE s.fecha_inicio<c.fecha_ingreso OR s.creada_en<CAST(c.fecha_ingreso AS DATETIME))+(SELECT COUNT(*) FROM incapacidades i JOIN colaboradores c ON c.id=i.colaborador_id WHERE i.inicio<c.fecha_ingreso) total")).rows[0];
    if(Number(invalid.total)!==0)throw Error('Persisten incoherencias temporales; no se confirma la reparación');
    await c.query('INSERT INTO seed_versiones(nombre,aplicado_en) VALUES($1,UTC_TIMESTAMP())',[version]);await c.query('COMMIT');
    const result={version,fecha:new Date().toISOString(),incidencias_temporales_restantes:0,historia_vacaciones_ids:eligible.slice(0,5).map(r=>r.id),historia_incapacidades_ids:eligible.slice(5).map(r=>r.id),nota:'Solo seed ficticio. Se reasignaron hechos históricos a personal ya ingresado; se alinearon fechas administrativas y periodos de 350 días. No se recalcularon ni alteraron los saldos numéricos del fixture ni las solicitudes SOL-001 a SOL-003.'};
    await writeFile(new URL('../../docs/resultados/coherencia_seed.json',import.meta.url),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }
}catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();await db.end();}
