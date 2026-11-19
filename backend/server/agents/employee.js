import {balance as vacationBalance} from '../workflows/vacations.js';
export async function ownBalance(db,user){const saldo=await db.models.SaldoVacaciones.findOne({attributes:['dias'],where:{colaborador_id:user.colaborador_id},raw:true});return saldo?.dias??null}
export function supportedPersonalQuestion(question){const q=question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');return /saldo|me quedan|disponibles|proxim[oa].*(pago|evaluacion)|estado.*solicitud|\bmis? solicitudes?\b/.test(q);}
export async function ownData(db,user,question,date) {
  const q=question.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const results=[],provenance=[];
  if(/pago|pagan/.test(q)) {
    const r=await db.query('SELECT p.fecha,p.tipo FROM calendario_pagos p JOIN colaboradores c ON c.grupo_planilla=p.grupo_planilla WHERE c.id=$1 AND p.fecha>=$2 ORDER BY p.fecha,p.id LIMIT 1',[user.colaborador_id,date]);
    results.push(r.rows.length?`Tu próximo pago está programado para ${String(r.rows[0].fecha).slice(0,10)} (${r.rows[0].tipo}).`:'No hay un próximo pago registrado para tu grupo.');provenance.push('calendario_pagos');
  }
  if(/evaluacion/.test(q)) {
    const r=await db.query("SELECT fecha_programada,estado FROM evaluaciones_desempeno WHERE colaborador_id=$1 AND fecha_programada>=$2 ORDER BY fecha_programada,id LIMIT 1",[user.colaborador_id,date]);
    results.push(r.rows.length?`Tu próxima evaluación está programada para ${String(r.rows[0].fecha_programada).slice(0,10)} (${r.rows[0].estado}).`:'No hay una próxima evaluación registrada.');provenance.push('evaluaciones_desempeno');
  }
  if(/solicitud|estado.*permiso/.test(q)) {
    let target=null;
    const explicit=q.match(/\b(\d{4}-\d{2}-\d{2})\b/);if(explicit)target=explicit[1];
    else if(/viernes/.test(q)){const {nextFriday,addDays}=await import('../time.js');target=nextFriday(date);if(/pasado|anterior/.test(q))target=addDays(target,-7);}
    const r=await db.query('SELECT id,tipo,estado,fecha_inicio,fecha_fin,respuesta_rrhh FROM solicitudes WHERE colaborador_id=$1'+(target?' AND fecha_inicio<=$2 AND fecha_fin>=$2':'')+' ORDER BY creada_en DESC,id DESC LIMIT 10',target?[user.colaborador_id,target]:[user.colaborador_id]);
    if(!target&&r.rows.length>1)results.push('¿A qué solicitud te referís? Indicá su fecha para consultar el estado.');
    else results.push(r.rows.length?r.rows.map(s=>`Tu solicitud de ${s.tipo} del ${String(s.fecha_inicio).slice(0,10)} está ${s.estado}.${s.respuesta_rrhh?' Respuesta de RRHH: '+s.respuesta_rrhh:''}`).join('\n'):'No encontré una solicitud tuya para esa fecha.');
    provenance.push('solicitudes');
  }
  if(/saldo|quedan|disponible|sobren/.test(q)){const b=await vacationBalance(db,user.colaborador_id);results.push(b===null?'No encontré tu saldo de vacaciones.':`Tu saldo de vacaciones es de ${b.confirmado} días confirmados; ${b.reservados} días reservados en solicitudes pendientes y ${b.disponibles} días disponibles para nuevas solicitudes.`);provenance.push('saldos_vacaciones','solicitudes');}
  if(!results.length)results.push('No hay una herramienta autorizada para consultar ese dato personal. Podés consultar a RRHH.');
  return {respuesta:results.join('\n\n'),procedencia:provenance,fecha_consulta:date,suficiente:!results.some(r=>/^No |^¿/.test(r))};
}
