import {addDays,localDate} from './time.js';
import {reportMetrics} from './agents/analyst.js';

export async function dashboard(db,date=localDate()) {
  const current=await reportMetrics(db,date);
  const pending=await db.query("SELECT s.id,c.nombre,c.departamento,s.tipo,s.fecha_inicio,s.fecha_fin,s.creada_en FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id WHERE s.estado='pendiente' ORDER BY s.creada_en,s.id LIMIT 100");
  // Serie derivada de hechos históricos, sin fabricar ejecuciones del scheduler.
  const trend=await db.query(`WITH RECURSIVE dias AS (SELECT CAST($1 AS DATE) fecha UNION ALL SELECT DATE_ADD(fecha,INTERVAL 1 DAY) FROM dias WHERE fecha<$2), ausentes AS (
    SELECT d.fecha,c.id FROM dias d JOIN solicitudes s ON d.fecha BETWEEN s.fecha_inicio AND s.fecha_fin JOIN colaboradores c ON c.id=s.colaborador_id WHERE s.estado='aprobada' AND s.tipo IN ('vacaciones','permiso') AND c.fecha_ingreso<=d.fecha AND (c.fecha_salida IS NULL OR c.fecha_salida>d.fecha) AND (s.resuelta_en IS NULL OR s.resuelta_en<=DATE_ADD(d.fecha,INTERVAL 13 HOUR))
    UNION SELECT d.fecha,c.id FROM dias d JOIN incapacidades i ON d.fecha BETWEEN i.inicio AND i.fin JOIN colaboradores c ON c.id=i.colaborador_id WHERE c.fecha_ingreso<=d.fecha AND (c.fecha_salida IS NULL OR c.fecha_salida>d.fecha)
  ) SELECT d.fecha,COUNT(DISTINCT a.id) ausentes FROM dias d LEFT JOIN ausentes a ON a.fecha=d.fecha GROUP BY d.fecha ORDER BY d.fecha`,[addDays(date,-29),date]);
  const reports=await db.query('SELECT fecha,resumen,estado,resumen_metodo,generado_en FROM reportes_diarios ORDER BY fecha DESC LIMIT 30');
  return {actual:current,pendientes:pending.rows,tendencia:trend.rows.map(r=>({...r,ausentes:Number(r.ausentes)})),reportes:reports.rows};
}
