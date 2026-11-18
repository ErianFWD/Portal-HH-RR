import {localDate,utcCutoff,addDays,ZONE,parseJson} from '../time.js';
import {summarizeReport} from './report-summary.js';

export async function reportMetrics(db,date) {
  const start=date.slice(0,7)+'-01',cutoff=utcCutoff(date),yesterday=addDays(date,-1);
  const active="c.fecha_ingreso<=$1 AND (c.fecha_salida IS NULL OR c.fecha_salida>$1)";
  const absences=await db.query(`WITH motivos AS (
    SELECT c.id,c.departamento,'incapacidad' tipo,1 prioridad FROM colaboradores c JOIN incapacidades i ON i.colaborador_id=c.id WHERE ${active} AND i.inicio<=$1 AND i.fin>=$1
    UNION ALL SELECT c.id,c.departamento,s.tipo,CASE WHEN s.tipo='vacaciones' THEN 2 ELSE 3 END FROM colaboradores c JOIN solicitudes s ON s.colaborador_id=c.id WHERE ${active} AND s.estado='aprobada' AND s.tipo IN ('vacaciones','permiso') AND s.fecha_inicio<=$1 AND s.fecha_fin>=$1 AND (s.resuelta_en IS NULL OR s.resuelta_en<=$2)
  ), ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY id ORDER BY prioridad) rn,COUNT(*) OVER(PARTITION BY id) registros FROM motivos)
  SELECT departamento,tipo,COUNT(*) personas,SUM(registros>1) incidencias FROM ranked WHERE rn=1 GROUP BY departamento,tipo`,[date,cutoff]);
  const pending=await db.query(`SELECT COUNT(*) total,COALESCE(SUM(creada_en<DATE_SUB($1,INTERVAL 72 HOUR)),0) mayores_72h FROM solicitudes WHERE creada_en<=$1 AND (resuelta_en>$1 OR (resuelta_en IS NULL AND estado='pendiente'))`,[cutoff]);
  const illness=await db.query(`WITH RECURSIVE dias AS (SELECT CAST($1 AS DATE) dia UNION ALL SELECT DATE_ADD(dia,INTERVAL 1 DAY) FROM dias WHERE dia<$2)
    SELECT COUNT(DISTINCT c.id) personas,COUNT(DISTINCT c.id,d.dia) dias_calendario FROM dias d JOIN incapacidades i ON d.dia BETWEEN i.inicio AND i.fin JOIN colaboradores c ON c.id=i.colaborador_id WHERE c.fecha_ingreso<=$2 AND (c.fecha_salida IS NULL OR c.fecha_salida>$2)`,[start,date]);
  const workforce=await db.query(`SELECT COALESCE(SUM(fecha_ingreso<$1 AND (fecha_salida IS NULL OR fecha_salida>=$1)),0) inicio,COALESCE(SUM(fecha_ingreso<=$2 AND (fecha_salida IS NULL OR fecha_salida>$2)),0) al_corte FROM colaboradores`,[start,date]);
  const movements=await db.query(`SELECT COALESCE(SUM(tipo='ingreso'),0) entradas,COALESCE(SUM(tipo='salida'),0) salidas FROM movimientos_personal WHERE fecha BETWEEN $1 AND $2`,[start,date]);
  const risk=await db.query(`SELECT COUNT(*) personas FROM saldos_vacaciones s JOIN colaboradores c ON c.id=s.colaborador_id WHERE ${active} AND s.dias>20`,[date]);
  const chat=await db.query(`SELECT COUNT(*) total,COALESCE(SUM(estado='completada'),0) completadas,COALESCE(SUM(estado='completada' AND resuelta=1 AND escalada=0),0) resueltas_sin_escalar,COALESCE(SUM(estado='fallida'),0) fallidas,COALESCE(SUM(estado='cancelada'),0) canceladas,AVG(latencia_total_ms) promedio_ms FROM consultas_chat WHERE creado>=$1 AND creado<$2`,[utcCutoff(yesterday,0),utcCutoff(date,0)]);
  const times=await db.query('SELECT latencia_total_ms FROM consultas_chat WHERE creado>=$1 AND creado<$2 AND latencia_total_ms IS NOT NULL ORDER BY latencia_total_ms',[utcCutoff(yesterday,0),utcCutoff(date,0)]);
  const topics=await db.query('SELECT tema,COUNT(*) total FROM consultas_chat WHERE creado>=$1 AND creado<$2 AND tema IS NOT NULL GROUP BY tema ORDER BY total DESC,tema LIMIT 5',[utcCutoff(yesterday,0),utcCutoff(date,0)]);
  const unresolved=await db.query('SELECT tema,COUNT(*) total FROM consultas_chat WHERE creado>=$1 AND creado<$2 AND resuelta=0 GROUP BY tema ORDER BY total DESC LIMIT 5',[utcCutoff(yesterday,0),utcCutoff(date,0)]);
  const numeric=row=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v===null?null:Number(v)]));
  const head=numeric(workforce.rows[0]),moves=numeric(movements.rows[0]),chatData=numeric(chat.rows[0]),base=(head.inicio+head.al_corte)/2;
  return {fecha:date,zona:ZONE,corte_utc:cutoff,ausencias:{total:absences.rows.reduce((n,r)=>n+Number(r.personas),0),desglose:absences.rows.map(r=>({...r,personas:Number(r.personas),incidencias:Number(r.incidencias)}))},pendientes:numeric(pending.rows[0]),incapacidades:numeric(illness.rows[0]),personal:{...head,...moves,rotacion_pct:base?Number((100*moves.salidas/base).toFixed(2)):null},vacaciones_riesgo:Number(risk.rows[0].personas),chat:{...chatData,resuelto_pct:chatData.completadas?Number((100*chatData.resueltas_sin_escalar/chatData.completadas).toFixed(2)):null,p90_ms:times.rows.length?Number(times.rows[Math.ceil(.9*times.rows.length)-1].latencia_total_ms):null,temas:topics.rows,no_resueltas_por_tema:unresolved.rows},procedencia:{metodo:'sql-v1',tablas:['colaboradores','solicitudes','incapacidades','movimientos_personal','saldos_vacaciones','consultas_chat'],reglas:['Corte a las 07:00 America/Costa_Rica; antigüedad estrictamente mayor a 72 horas.','Ausencias distintas; precedencia visual incapacidad, vacaciones, permiso.','Incapacidades: unión de días por persona en el mes hasta el corte.','Rotación: salidas / promedio de personal al inicio y al corte.','Saldo en riesgo: saldo actual consolidado; no reconstruye saldos históricos.']}};
}

export function templateSummary(d) {
  return `Hay ${d.ausencias.total} personas ausentes al corte. Se registran ${d.pendientes.total} solicitudes pendientes, de las cuales ${d.pendientes.mayores_72h} superan 72 horas. La rotación acumulada del mes es ${d.personal.rotacion_pct===null?'sin base':d.personal.rotacion_pct+' %'} y ${d.vacaciones_riesgo} personas tienen más de 20 días de vacaciones disponibles. ${d.chat.completadas===0?'El chat de ayer no tuvo consultas completadas.':`El chat de ayer completó ${d.chat.completadas} consultas y resolvió sin escalar ${d.chat.resuelto_pct} %.`}`;
}

export async function generateDailyReport(db,{date=localDate(),trigger='manual',summarize=summarizeReport}={}) {
  const c=await db.connect();
  try {
    await c.query('BEGIN');
    await c.query("INSERT INTO reportes_diarios(fecha,datos,resumen,estado,disparador) VALUES($1,'{}','','generando',$2) ON DUPLICATE KEY UPDATE fecha=VALUES(fecha)",[date,trigger]);
    const existing=(await c.query('SELECT * FROM reportes_diarios WHERE fecha=$1 FOR UPDATE',[date])).rows[0];
    if(existing.estado==='completado'&&existing.version_metodo){await c.query("INSERT INTO ejecuciones_reporte(fecha,disparador,estado,creado) VALUES($1,$2,'reutilizado',UTC_TIMESTAMP())",[date,trigger]);await c.query('COMMIT');return {...existing,datos:parseJson(existing.datos),reutilizado:true};}
    const data=await reportMetrics(c,date),generated=await summarize(JSON.parse(JSON.stringify(data))),summary=generated.text||templateSummary(data);
    await c.query("UPDATE reportes_diarios SET datos=$1,resumen=$2,zona=$3,estado='completado',generado_en=UTC_TIMESTAMP(),version_metodo='sql-v1',resumen_metodo=$4,error=$5,disparador=$6 WHERE fecha=$7",[JSON.stringify(data),summary,ZONE,generated.method,generated.error,trigger,date]);
    await c.query("INSERT INTO ejecuciones_reporte(fecha,disparador,estado,creado) VALUES($1,$2,'completado',UTC_TIMESTAMP())",[date,trigger]);
    await c.query('COMMIT');return {fecha:date,datos:data,resumen:summary,resumen_metodo:generated.method,error:generated.error,estado:'completado'};
  } catch(error) {
    await c.query('ROLLBACK');
    await db.query("INSERT INTO ejecuciones_reporte(fecha,disparador,estado,error,creado) VALUES($1,$2,'fallido','ERROR_REPORTE',UTC_TIMESTAMP())",[date,trigger]);throw error;
  } finally {c.release();}
}
export async function regenerateReportSummary(db,date,{trigger='manual',summarize=summarizeReport}={}){
  const c=await db.connect();
  try{
    await c.query('BEGIN');
    const report=(await c.query('SELECT * FROM reportes_diarios WHERE fecha=$1 FOR UPDATE',[date])).rows[0];
    if(!report)throw Error('REPORTE_NO_ENCONTRADO');
    const data=parseJson(report.datos),generated=await summarize(JSON.parse(JSON.stringify(data))),text=generated.text||templateSummary(data);
    // Solo cambia la redacción. La instantánea SQL permanece intacta.
    await c.query('UPDATE reportes_diarios SET resumen=$1,resumen_metodo=$2,error=$3 WHERE fecha=$4',[text,generated.method,generated.error,date]);
    await c.query("INSERT INTO ejecuciones_reporte(fecha,disparador,estado,creado) VALUES($1,$2,'resumen_actualizado',UTC_TIMESTAMP())",[date,trigger]);
    await c.query('COMMIT');return {fecha:date,datos:data,resumen:text,resumen_metodo:generated.method,error:generated.error};
  }catch(error){await c.query('ROLLBACK');throw error;}finally{c.release();}
}
