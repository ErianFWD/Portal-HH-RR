import {z} from 'zod';
import {localDate,parseJson} from '../time.js';
import {date,text,id,fail,transaction,coverage,utc} from './common.js';

export function duration(row,now=new Date()){return Math.max(0,Math.floor(((row.salida?utc(row.salida):now)-utc(row.entrada))/1000));}
export function present(row,now=new Date()){
  const incidencias=parseJson(row.incidencias,[]);if(!row.salida&&duration(row,now)>16*3600)incidencias.push('jornada_abierta_inusual');
  return {...row,incidencias,horario_snapshot:parseJson(row.horario_snapshot,{}),duracion_segundos:duration(row,now),estado:row.salida?'cerrada':'abierta',server_now:now.toISOString()};
}
export async function interpret(db,person,entry,exit){
  const day=localDate(entry),h=(await db.query('SELECT * FROM horarios WHERE colaborador_id=$1 AND vigente_desde<=$2 ORDER BY vigente_desde DESC,id DESC LIMIT 1',[person,day])).rows[0];
  const incidents=[],snapshot={fecha:day,horario:h||null};
  if(!h){incidents.push('sin_horario');return {incidents,snapshot};}
  let calendar=true;try{await coverage(db,day,day);}catch(e){if(e.status!==422)throw e;calendar=false;incidents.push('calendario_sin_cobertura');}
  const holiday=(await db.query('SELECT nombre FROM feriados WHERE fecha=$1',[day])).rows;
  const absences=(await db.query("SELECT id,tipo FROM solicitudes WHERE colaborador_id=$1 AND estado='aprobada' AND fecha_inicio<=$2 AND fecha_fin>=$2 UNION ALL SELECT id,'incapacidad' tipo FROM incapacidades WHERE colaborador_id=$1 AND inicio<=$2 AND fin>=$2",[person,day])).rows;
  snapshot.feriados=holiday;snapshot.ausencias=absences;snapshot.calendario_confirmado=calendar;
  if(holiday.length){incidents.push('marca_en_feriado');return {incidents,snapshot};}
  if(absences.length){incidents.push('marca_en_ausencia');return {incidents,snapshot};}
  if(!parseJson(h.dias,[]).includes(new Date(day+'T12:00:00Z').getUTCDay())){incidents.push('fuera_de_dia_laboral');return {incidents,snapshot};}
  if(calendar){
    const start=new Date(day+'T'+h.entrada+'-06:00'),end=new Date(day+'T'+h.salida+'-06:00');
    if(entry-start>h.tolerancia_min*60000)incidents.push('llegada_tardia');
    if(exit&&end-exit>h.tolerancia_min*60000)incidents.push('salida_anticipada');
  }
  return {incidents,snapshot};
}
async function overlaps(db,person,entry,exit,exclude=null){
  if(exit&&exit<entry)fail('La salida debe ser posterior o igual a la entrada',400);
  if((await db.query('SELECT id FROM asistencia WHERE colaborador_id=$1 AND ($4 IS NULL OR id<>$4) AND ($3 IS NULL OR entrada<$3) AND (salida IS NULL OR salida>$2) LIMIT 1',[person,entry,exit,exclude])).rows.length)fail('El intervalo se solapa con otra jornada');
}
export const markInput=z.object({clave:z.string().uuid()}).strict();
export async function mark(db,user,action,input,{now=new Date()}={}){
  const {clave}=markInput.parse(input);
  return transaction(db,user.colaborador_id,async c=>{
    const previous=(await c.query('SELECT * FROM marcas_idempotencia WHERE colaborador_id=$1 AND clave=$2',[user.colaborador_id,clave])).rows[0];
    if(previous){if(previous.accion!==action)fail('La clave ya se usó para otra acción');return present((await c.query('SELECT * FROM asistencia WHERE id=$1',[previous.asistencia_id])).rows[0],now);}
    const open=(await c.query('SELECT * FROM asistencia WHERE colaborador_id=$1 AND salida IS NULL FOR UPDATE',[user.colaborador_id])).rows[0];let rowId;
    if(action==='entrada'){
      if(open)fail('Ya tenés una jornada abierta');await overlaps(c,user.colaborador_id,now,null);
      const {incidents,snapshot}=await interpret(c,user.colaborador_id,now,null);
      rowId=(await c.query('INSERT INTO asistencia(colaborador_id,entrada,incidencias,horario_snapshot) VALUES($1,$2,$3,$4)',[user.colaborador_id,now,JSON.stringify(incidents),JSON.stringify(snapshot)])).insertId;
    }else{
      if(!open)fail('No hay una entrada abierta');const entry=utc(open.entrada);await overlaps(c,user.colaborador_id,entry,now,open.id);
      // La salida usa el horario y contexto capturados en la entrada, aun si RRHH publicó otro horario.
      const snapshot=parseJson(open.horario_snapshot,{}),incidents=parseJson(open.incidencias,[]),h=snapshot.horario;
      if(h&&snapshot.calendario_confirmado&&!snapshot.feriados?.length&&!snapshot.ausencias?.length&&parseJson(h.dias,[]).includes(new Date(snapshot.fecha+'T12:00:00Z').getUTCDay())&&new Date(snapshot.fecha+'T'+h.salida+'-06:00')-now>h.tolerancia_min*60000)incidents.push('salida_anticipada');
      rowId=open.id;await c.query('UPDATE asistencia SET salida=$1,incidencias=$2 WHERE id=$3',[now,JSON.stringify(incidents),rowId]);
    }
    await c.query('INSERT INTO marcas_idempotencia VALUES($1,$2,$3,$4)',[user.colaborador_id,clave,action,rowId]);
    return present((await c.query('SELECT * FROM asistencia WHERE id=$1',[rowId])).rows[0],now);
  });
}
const instant=z.string().datetime({offset:true}).transform(s=>new Date(s));
export const correctionInput=z.object({entrada:instant,salida:instant.nullable(),motivo:text.min(1)}).strict();
export async function recover(db,user,input){
  const v=correctionInput.extend({colaborador_id:id}).parse(input);
  if(v.entrada>new Date()||(v.salida&&v.salida>new Date()))fail('No se permiten marcas futuras',400);
  if(v.salida&&v.salida<=v.entrada)fail('El intervalo recuperado debe tener duración positiva',400);
  return transaction(db,v.colaborador_id,async c=>{
    await overlaps(c,v.colaborador_id,v.entrada,v.salida);
    const {incidents,snapshot}=await interpret(c,v.colaborador_id,v.entrada,v.salida);
    const result=await c.query('INSERT INTO asistencia(colaborador_id,entrada,salida,incidencias,horario_snapshot,observaciones,corregida) VALUES($1,$2,$3,$4,$5,$6,1)',[v.colaborador_id,v.entrada,v.salida,JSON.stringify(incidents),JSON.stringify(snapshot),v.motivo]);
    await c.query("INSERT INTO asistencia_correcciones(asistencia_id,usuario_id,motivo,original,nuevo,creado_en) VALUES($1,$2,$3,'null',$4,UTC_TIMESTAMP())",[result.insertId,user.id,v.motivo,JSON.stringify({entrada:v.entrada,salida:v.salida,incidencias:incidents,horario_snapshot:snapshot})]);
    return {ok:true,id:result.insertId};
  });
}
export async function correct(db,user,recordId,input){
  const v=correctionInput.parse(input),initial=(await db.query('SELECT colaborador_id FROM asistencia WHERE id=$1',[recordId])).rows[0];if(!initial)fail('Registro no encontrado',404);
  if(v.entrada>new Date()||(v.salida&&v.salida>new Date()))fail('No se permiten marcas futuras',400);
  return transaction(db,initial.colaborador_id,async c=>{
    const old=(await c.query('SELECT * FROM asistencia WHERE id=$1 FOR UPDATE',[recordId])).rows[0];await overlaps(c,old.colaborador_id,v.entrada,v.salida,recordId);
    const {incidents,snapshot}=await interpret(c,old.colaborador_id,v.entrada,v.salida);
    const next={entrada:v.entrada,salida:v.salida,incidencias:incidents,horario_snapshot:snapshot,observaciones:v.motivo};
    await c.query('INSERT INTO asistencia_correcciones(asistencia_id,usuario_id,motivo,original,nuevo,creado_en) VALUES($1,$2,$3,$4,$5,UTC_TIMESTAMP())',[recordId,user.id,v.motivo,JSON.stringify(old),JSON.stringify(next)]);
    await c.query('UPDATE asistencia SET entrada=$1,salida=$2,incidencias=$3,horario_snapshot=$4,observaciones=$5,corregida=1 WHERE id=$6',[v.entrada,v.salida,JSON.stringify(incidents),JSON.stringify(snapshot),v.motivo,recordId]);return {ok:true};
  });
}
export const scheduleInput=z.object({vigente_desde:date,dias:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(a=>new Set(a).size===a.length),entrada:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),salida:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),tolerancia_min:z.number().int().min(0).max(120),motivo:text.min(1)}).strict();
export async function schedule(db,user,person,input){
  const v=scheduleInput.parse(input);if(v.vigente_desde<localDate()||v.salida<=v.entrada)fail('Vigencia desde hoy; la salida debe ser posterior a la entrada',400);
  return transaction(db,person,async c=>{await c.query('INSERT INTO horarios(colaborador_id,vigente_desde,dias,entrada,salida,tolerancia_min,motivo,usuario_id,creado_en) VALUES($1,$2,$3,$4,$5,$6,$7,$8,UTC_TIMESTAMP())',[person,v.vigente_desde,JSON.stringify(v.dias),v.entrada,v.salida,v.tolerancia_min,v.motivo,user.id]);return {ok:true};});
}
