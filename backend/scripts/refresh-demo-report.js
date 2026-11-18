import {writeFile,mkdir} from 'node:fs/promises';
import {db} from '../server/db.js';
import {config} from '../server/config.js';
import {localDate,parseJson} from '../server/time.js';
import {reportMetrics,generateDailyReport} from '../server/agents/analyst.js';
if(config.NODE_ENV!=='development')throw Error('Solo seed ficticio');
try{
  const people=(await db.query('SELECT nombre FROM colaboradores')).rows;
  if(people.some(p=>!/^Persona ficticia \d+$/.test(p.nombre)))throw Error('No se modifican reportes de datos ajenos al seed');
  const date=process.argv[2]||localDate();if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date>localDate())throw Error('Fecha inválida');
  const old=(await db.query('SELECT * FROM reportes_diarios WHERE fecha=$1',[date])).rows[0],current=await reportMetrics(db,date);
  if(!old)throw Error('No hay reporte para revisar');
  const previous=parseJson(old.datos);
  const relevant=d=>JSON.stringify({ausencias:d.ausencias,pendientes:d.pendientes,incapacidades:d.incapacidades,personal:d.personal,vacaciones_riesgo:d.vacaciones_riesgo,chat:d.chat});
  if(relevant(previous)===relevant(current)){console.log('El reporte ya coincide con el fixture corregido');}
  else{
    const dir=new URL('../../docs/resultados/',import.meta.url);await mkdir(dir,{recursive:true});
    const archive='reporte_antes_correccion_fixture_'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
    await writeFile(new URL(archive,dir),JSON.stringify({...old,datos:previous,motivo:'Corrección auditada de datos ficticios de origen; la instantánea previa se conserva en este archivo.'},null,2));
    await db.query("UPDATE reportes_diarios SET estado='pendiente_revision' WHERE fecha=$1",[date]);
    await db.query("INSERT INTO ejecuciones_reporte(fecha,disparador,estado,creado) VALUES($1,'coherencia-historia-v2','reabierto_por_fixture',UTC_TIMESTAMP())",[date]);
    const result=await generateDailyReport(db,{date,trigger:'correccion-auditada-fixture-v2'});
    console.log(JSON.stringify({fecha:date,pendientes:result.datos.pendientes,resumen_metodo:result.resumen_metodo,archivo_previo:archive}));
  }
}finally{await db.end();}
