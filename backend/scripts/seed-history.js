import {readFile} from 'node:fs/promises';
import {parse} from 'csv-parse/sync';
import {db} from '../server/db.js';
import {config} from '../server/config.js';
import {up as workflows} from '../migrations/003_workflows.js';
import {businessDays} from '../server/calendar.js';

if(config.NODE_ENV!=='development')throw Error('Seed solo para desarrollo');
const c=await db.connect(),version='historia-y-calendarios-2026-v1';
try {
  await c.query('BEGIN');
  if((await c.query('SELECT nombre FROM seed_versiones WHERE nombre=$1',[version])).rows.length){await c.query('ROLLBACK');console.log('Historia ya aplicada');}
  else {
    const people=(await c.query('SELECT id,nombre FROM colaboradores ORDER BY id FOR UPDATE')).rows;
    if(people.length<50||people.some(p=>!/^Persona ficticia \d+$/.test(p.nombre)))throw Error('Se requiere el seed ficticio existente');
    for(const month of ['2026-09','2026-10','2026-11']) {
      for(let n=0;n<5;n++) {
        const id=11+n,begin=month+'-02',end=month+'-06',created=month+'-01 14:00:00',resolved=month+'-01 16:00:00';
        await c.query("INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha,fecha_inicio,fecha_fin,creada_en,resuelta_en,fixture_clave) VALUES($1,'vacaciones','aprobada',$2,$2,$3,$4,$5,$6)",[id,begin,end,created,resolved,`hist-${month}-${id}`]);
      }
      for(let n=0;n<3;n++)await c.query("INSERT INTO incapacidades(colaborador_id,inicio,fin,entidad,tipo_administrativo,referencia_simulada) VALUES($1,$2,$3,'CCSS','enfermedad',$4)",[31+n,month+'-09',month+'-12',`HIST-INC-${month}-${n}`]);
    }
    const root=new URL('../../docs/paquete_rrhh/Documentacion_RRHH/calendarios/',import.meta.url);
    for(const row of parse(await readFile(new URL('feriados_2026.csv',root),'utf8'),{columns:true,skip_empty_lines:true,bom:true}))await c.query('INSERT INTO feriados(fecha,nombre,clasificacion,fuente) VALUES($1,$2,$3,$4) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre),clasificacion=VALUES(clasificacion),fuente=VALUES(fuente)',[row.fecha,row.nombre,row.clasificacion_legal,row.fuente]);
    for(const row of parse(await readFile(new URL('pagos_2026.csv',root),'utf8'),{columns:true,skip_empty_lines:true,bom:true}))await c.query('INSERT INTO calendario_pagos(fecha,fecha_nominal,descripcion,tipo,grupo_planilla,clave,fuente) VALUES($1,$2,$3,$4,$5,$6,$7) ON DUPLICATE KEY UPDATE fecha=VALUES(fecha),fecha_nominal=VALUES(fecha_nominal)',[row.fecha_pago,row.fecha_nominal,'Calendario interno ficticio 2026',row.tipo,row.grupo_planilla,row.id,'paquete_rrhh/calendarios/pagos_2026.csv']);
    for(const s of (await c.query("SELECT id,fecha_inicio,fecha_fin FROM solicitudes WHERE tipo='vacaciones' AND estado='pendiente'")).rows)await c.query('UPDATE solicitudes SET dias_solicitados=$1 WHERE id=$2',[await businessDays(c,String(s.fecha_inicio).slice(0,10),String(s.fecha_fin).slice(0,10)),s.id]);
    await c.query('INSERT INTO seed_versiones(nombre,aplicado_en) VALUES($1,UTC_TIMESTAMP())',[version]);await c.query('COMMIT');console.log('Historia de tres meses y calendarios importados; sin crear reportes históricos ficticios');
  }
  await workflows(db);
}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();await db.end();}
