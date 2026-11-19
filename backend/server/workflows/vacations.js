import {z} from 'zod';
import {businessDays} from '../calendar.js';
import {localDate} from '../time.js';
import {date,text,fail,transaction,coverage} from './common.js';

export const vacationInput=z.object({inicio:date,fin:date,mensaje:text.optional().default('')}).strict();
export async function balance(db,person){
  const s=(await db.query('SELECT * FROM saldos_vacaciones WHERE colaborador_id=$1',[person])).rows[0];
  if(!s)return null;
  const reserved=Number((await db.query("SELECT COALESCE(SUM(dias_solicitados),0) dias FROM solicitudes WHERE colaborador_id=$1 AND tipo='vacaciones' AND estado='pendiente'",[person])).rows[0].dias);
  return {...s,dias:Number(s.dias),confirmado:Number(s.dias),reservados:reserved,disponibles:Number(s.dias)-reserved};
}
export async function calculate(db,input,{today=localDate(),future=true}={}){
  const v=vacationInput.parse(input);
  if(v.fin<v.inicio||(Date.parse(v.fin)-Date.parse(v.inicio))/86400000>366||(future&&v.inicio<today))fail('Rango inválido: desde hoy y máximo 366 días',400);
  await coverage(db,v.inicio,v.fin);
  const days=await businessDays(db,v.inicio,v.fin);if(!days)fail('El rango no contiene días hábiles',400);
  return {...v,dias:days};
}
async function available(db,person,v,exclude=null){
  await db.query('SELECT colaborador_id FROM saldos_vacaciones WHERE colaborador_id=$1 FOR UPDATE',[person]);
  if((await db.query("SELECT id FROM solicitudes WHERE colaborador_id=$1 AND estado IN ('pendiente','aprobada') AND fecha_inicio<=$2 AND fecha_fin>=$3 AND ($4 IS NULL OR id<>$4) LIMIT 1",[person,v.fin,v.inicio,exclude])).rows.length)fail('El rango se solapa con otra solicitud pendiente o aprobada');
  if((await db.query('SELECT id FROM incapacidades WHERE colaborador_id=$1 AND inicio<=$2 AND fin>=$3 LIMIT 1',[person,v.fin,v.inicio])).rows.length)fail('El rango se solapa con una incapacidad');
  const b=await balance(db,person);if(!b)fail('No hay saldo de vacaciones registrado',422);
  const own=exclude?Number((await db.query('SELECT dias_solicitados FROM solicitudes WHERE id=$1',[exclude])).rows[0]?.dias_solicitados||0):0;
  if(b.confirmado<v.dias||b.disponibles+own<v.dias)fail('Saldo disponible insuficiente');
  return b;
}
export async function createVacation(db,user,input,options){
  return transaction(db,user.colaborador_id,async c=>{
    const v=await calculate(c,input,options);await available(c,user.colaborador_id,v);
    const r=await c.query("INSERT INTO solicitudes(colaborador_id,tipo,estado,fecha,fecha_inicio,fecha_fin,creada_en,dias_solicitados,mensaje,gestion_portal) VALUES($1,'vacaciones','pendiente',$2,$2,$3,UTC_TIMESTAMP(),$4,$5,1)",[user.colaborador_id,v.inicio,v.fin,v.dias,v.mensaje]);
    await c.query("INSERT INTO solicitudes_auditoria(solicitud_id,usuario_id,estado_nuevo,mensaje,creado_en) VALUES($1,$2,'pendiente',$3,UTC_TIMESTAMP())",[r.insertId,user.id,v.mensaje]);
    return {id:r.insertId,estado:'pendiente',dias_solicitados:v.dias};
  });
}
export async function cancelVacation(db,user,requestId){return transaction(db,user.colaborador_id,async c=>{
  const s=(await c.query('SELECT * FROM solicitudes WHERE id=$1 AND colaborador_id=$2 FOR UPDATE',[requestId,user.colaborador_id])).rows[0];if(!s)fail('Solicitud no encontrada',404);
  if(s.estado!=='pendiente')fail('Solo se pueden cancelar solicitudes pendientes');
  await c.query("UPDATE solicitudes SET estado='cancelada',resuelta_en=UTC_TIMESTAMP(),resuelto_por=$1 WHERE id=$2",[user.id,s.id]);
  await c.query("INSERT INTO solicitudes_auditoria(solicitud_id,usuario_id,estado_anterior,estado_nuevo,creado_en) VALUES($1,$2,'pendiente','cancelada',UTC_TIMESTAMP())",[s.id,user.id]);return {ok:true};
});}
export async function resolveVacation(db,user,requestId,input){
  const v=z.object({estado:z.enum(['aprobada','rechazada']),respuesta:text}).strict().parse(input);
  if(v.estado==='rechazada'&&!v.respuesta)fail('Es obligatorio indicar el motivo del rechazo',400);
  const initial=(await db.query('SELECT colaborador_id FROM solicitudes WHERE id=$1',[requestId])).rows[0];if(!initial)fail('Solicitud no encontrada',404);
  if(initial.colaborador_id===user.colaborador_id)fail('No podés resolver tu propia solicitud',403);
  return transaction(db,initial.colaborador_id,async c=>{
    const s=(await c.query('SELECT * FROM solicitudes WHERE id=$1 FOR UPDATE',[requestId])).rows[0];if(s.estado!=='pendiente')fail('La solicitud ya fue resuelta');
    if(v.estado==='aprobada'&&s.tipo==='vacaciones'){
      const range=await calculate(c,{inicio:String(s.fecha_inicio).slice(0,10),fin:String(s.fecha_fin).slice(0,10)},{future:!!s.gestion_portal});
      const b=await available(c,s.colaborador_id,range,s.id);
      await c.query('UPDATE saldos_vacaciones SET dias=dias-$1,dias_tomados=COALESCE(dias_tomados,0)+$1,actualizado_en=UTC_TIMESTAMP() WHERE colaborador_id=$2 AND dias>=$1',[range.dias,s.colaborador_id]);
      await c.query("INSERT INTO movimientos_vacaciones(colaborador_id,solicitud_id,tipo,delta,saldo_anterior,saldo_nuevo,usuario_id,creado_en) VALUES($1,$2,'aprobacion',$3,$4,$5,$6,UTC_TIMESTAMP())",[s.colaborador_id,s.id,-range.dias,b.confirmado,b.confirmado-range.dias,user.id]);
      await c.query('UPDATE solicitudes SET dias_solicitados=$1 WHERE id=$2',[range.dias,s.id]);
    }
    await c.query('UPDATE solicitudes SET estado=$1,respuesta_rrhh=$2,resuelto_por=$3,aprobador_id=$3,resuelta_en=UTC_TIMESTAMP() WHERE id=$4',[v.estado,v.respuesta,user.id,s.id]);
    await c.query("INSERT INTO solicitudes_auditoria(solicitud_id,usuario_id,estado_anterior,estado_nuevo,mensaje,creado_en) VALUES($1,$2,'pendiente',$3,$4,UTC_TIMESTAMP())",[s.id,user.id,v.estado,v.respuesta]);return {ok:true,estado:v.estado};
  });
}
