import {z} from 'zod';
import {id,date,text,fail,transaction} from './common.js';
import {balance,calculate,createVacation,cancelVacation,resolveVacation} from './vacations.js';
import {mark,present,correct,recover,schedule} from './attendance.js';

const filterSchema=z.object({colaborador_id:id.optional(),departamento:z.string().max(255).optional(),estado:z.string().max(40).optional(),inicio:date.optional(),fin:date.optional()});
function filters(query,type){
  const f=filterSchema.parse(query),parts=[],params=[];
  const add=(sql,value)=>{params.push(value);parts.push(sql.replace('?',`$${params.length}`));};
  if(f.inicio&&f.fin&&f.fin<f.inicio)fail('Rango de filtros inválido',400);
  if(f.colaborador_id)add('c.id=?',f.colaborador_id);if(f.departamento)add('c.departamento=?',f.departamento);
  if(type==='solicitudes'){
    if(f.estado)add('s.estado=?',f.estado);if(f.inicio)add('s.fecha_fin>=?',f.inicio);if(f.fin)add('s.fecha_inicio<=?',f.fin);
  }else{
    if(f.estado==='abierta')parts.push('s.salida IS NULL');else if(f.estado==='cerrada')parts.push('s.salida IS NOT NULL');
    else if(f.estado==='incidencias')parts.push("(JSON_LENGTH(s.incidencias)>0 OR (s.salida IS NULL AND s.entrada<DATE_SUB(UTC_TIMESTAMP(),INTERVAL 16 HOUR)))");
    if(f.inicio)add('(s.salida IS NULL OR s.salida>=?)',new Date(f.inicio+'T00:00:00-06:00'));
    if(f.fin)add('s.entrada<=?',new Date(f.fin+'T23:59:59.999-06:00'));
  }
  return {where:parts.length?' WHERE '+parts.join(' AND '):'',params};
}
export function workflowRoutes(app,db,auth,hr){
  // Cabecera no simple: un sitio externo no puede enviarla con cookies sin un preflight CORS permitido.
  const csrf=(req,res,next)=>req.get('X-Portal-Request')==='1'&&req.get('Sec-Fetch-Site')!=='cross-site'?next():res.status(403).json({error:'Solicitud de escritura no autorizada'});
  app.get('/api/me/vacaciones',auth,async(req,res)=>res.json(await balance(db,req.user.colaborador_id)));
  app.get('/api/me/calcular-solicitud',auth,async(req,res)=>res.json(await calculate(db,{inicio:req.query.inicio,fin:req.query.fin})));
  app.get('/api/me/solicitudes',auth,async(req,res)=>res.json((await db.query('SELECT * FROM solicitudes WHERE colaborador_id=$1 ORDER BY creada_en DESC,id DESC',[req.user.colaborador_id])).rows));
  app.post('/api/me/solicitudes',auth,csrf,async(req,res)=>res.status(201).json(await createVacation(db,req.user,req.body)));
  app.post('/api/me/solicitudes/:id/cancelar',auth,csrf,async(req,res)=>res.json(await cancelVacation(db,req.user,id.parse(req.params.id))));
  app.get('/api/rrhh/colaboradores',auth,hr,async(req,res)=>res.json((await db.query('SELECT id,nombre,departamento FROM colaboradores WHERE activo=1 ORDER BY nombre')).rows));
  app.get('/api/rrhh/solicitudes',auth,hr,async(req,res)=>{const f=filters(req.query,'solicitudes');res.json((await db.query('SELECT s.*,c.nombre,c.departamento FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id'+f.where+' ORDER BY s.creada_en DESC,s.id DESC',f.params)).rows);});
  app.get('/api/rrhh/solicitudes/:id',auth,hr,async(req,res)=>{
    const s=(await db.query('SELECT s.*,c.nombre,c.departamento FROM solicitudes s JOIN colaboradores c ON c.id=s.colaborador_id WHERE s.id=$1',[id.parse(req.params.id)])).rows[0];if(!s)fail('Solicitud no encontrada',404);
    res.json({...s,saldo:await balance(db,s.colaborador_id),auditoria:(await db.query('SELECT a.*,u.email FROM solicitudes_auditoria a JOIN usuarios u ON u.id=a.usuario_id WHERE solicitud_id=$1 ORDER BY a.id',[s.id])).rows});
  });
  app.post('/api/rrhh/solicitudes/:id/resolver',auth,hr,csrf,async(req,res)=>res.json(await resolveVacation(db,req.user,id.parse(req.params.id),req.body)));
  app.get('/api/me/asistencia',auth,async(req,res)=>res.json((await db.query('SELECT * FROM asistencia WHERE colaborador_id=$1 ORDER BY entrada DESC,id DESC',[req.user.colaborador_id])).rows.map(r=>present(r))));
  app.get('/api/me/asistencia/actual',auth,async(req,res)=>{const r=(await db.query('SELECT * FROM asistencia WHERE colaborador_id=$1 AND salida IS NULL',[req.user.colaborador_id])).rows[0];res.json({actual:r?present(r):null,server_now:new Date().toISOString()});});
  for(const action of ['entrada','salida'])app.post('/api/me/asistencia/'+action,auth,csrf,async(req,res)=>res.json(await mark(db,req.user,action,req.body)));
  app.get('/api/rrhh/asistencia',auth,hr,async(req,res)=>{const f=filters(req.query,'asistencia');res.json((await db.query('SELECT s.*,c.nombre,c.departamento FROM asistencia s JOIN colaboradores c ON c.id=s.colaborador_id'+f.where+' ORDER BY s.entrada DESC,s.id DESC',f.params)).rows.map(r=>present(r)));});
  app.post('/api/rrhh/asistencia',auth,hr,csrf,async(req,res)=>res.status(201).json(await recover(db,req.user,req.body)));
  app.get('/api/rrhh/asistencia/:id/correcciones',auth,hr,async(req,res)=>res.json((await db.query('SELECT a.*,u.email FROM asistencia_correcciones a JOIN usuarios u ON u.id=a.usuario_id WHERE asistencia_id=$1 ORDER BY a.id',[id.parse(req.params.id)])).rows));
  app.post('/api/rrhh/asistencia/:id/corregir',auth,hr,csrf,async(req,res)=>res.json(await correct(db,req.user,id.parse(req.params.id),req.body)));
  app.get('/api/rrhh/horarios/:persona',auth,hr,async(req,res)=>res.json((await db.query('SELECT h.*,u.email FROM horarios h LEFT JOIN usuarios u ON u.id=h.usuario_id WHERE h.colaborador_id=$1 ORDER BY vigente_desde DESC,h.id DESC',[id.parse(req.params.persona)])).rows));
  app.post('/api/rrhh/horarios/:persona',auth,hr,csrf,async(req,res)=>res.json(await schedule(db,req.user,id.parse(req.params.persona),req.body)));
  app.get('/api/rrhh/calendarios',auth,hr,async(req,res)=>res.json((await db.query('SELECT * FROM calendarios_cobertura ORDER BY anio')).rows));
  app.post('/api/rrhh/calendarios',auth,hr,csrf,async(req,res)=>{
    const v=z.object({anio:z.number().int().min(2020).max(2100),fuente:text.min(1).max(255)}).strict().parse(req.body);
    // Una confirmación es inmutable y deja constancia de quién verificó el calendario cargado.
    await transaction(db,req.user.colaborador_id,async c=>{if((await c.query('SELECT anio FROM calendarios_cobertura WHERE anio=$1',[v.anio])).rows.length)fail('El año ya está confirmado');await c.query('INSERT INTO calendarios_cobertura VALUES($1,$2,$3,UTC_TIMESTAMP())',[v.anio,v.fuente,req.user.id]);});res.json({ok:true});
  });
}
