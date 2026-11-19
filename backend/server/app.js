import express from 'express';
import cookieParser from 'cookie-parser';
import bcrypt from 'bcryptjs';
import {randomBytes,createHash} from 'node:crypto';
import {z} from 'zod';
import {answer} from './agents/orchestrator.js';
import {generateDailyReport,regenerateReportSummary} from './agents/analyst.js';
import {dashboard} from './dashboard.js';
import {syncDrive} from './ingestion.js';
import {localDate,parseJson} from './time.js';
import {businessDays} from './calendar.js';
import {workflowRoutes} from './workflows/routes.js';

const hash=s=>createHash('sha256').update(s).digest('hex');
const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s);
export function createApp(db,config,{answerImpl=answer,syncImpl=syncDrive}={}) {
  const app=express(),attempts=new Map(),busy=new Set();
  const opts={httpOnly:true,sameSite:'strict',secure:config.NODE_ENV==='production',path:'/'};
  app.disable('x-powered-by');app.use(express.json({limit:'16kb'}));app.use(cookieParser());
  app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
  async function auth(req,res,next){
    const token=req.cookies.session;if(!token||!/^[a-f0-9]{64}$/.test(token))return res.status(401).json({error:'Iniciá sesión'});
    const r=await db.query('SELECT u.id,u.colaborador_id,u.email,u.rol FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id JOIN colaboradores c ON c.id=u.colaborador_id WHERE s.token_hash=$1 AND s.vence>UTC_TIMESTAMP() AND u.activo=1 AND c.activo=1',[hash(token)]);
    if(!r.rows[0])return res.status(401).json({error:'Sesión vencida'});req.user=r.rows[0];next();
  }
  const hr=(req,res,next)=>req.user.rol==='rrhh'?next():res.status(403).json({error:'Acceso exclusivo para RRHH'});
  app.post('/api/login',async(req,res)=>{
    const {email,password}=z.object({email:z.string().email().max(254),password:z.string().min(1).max(200)}).parse(req.body);
    const now=Date.now(),key=req.ip;
    for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);
    const attempt=attempts.get(key)||{count:0,until:now+15*60000};
    if(attempt.count>=10){res.set('Retry-After',String(Math.ceil((attempt.until-now)/1000)));return res.status(429).json({error:'Demasiados intentos. Intentá más tarde.'});}
    attempt.count++;attempts.set(key,attempt);
    const r=await db.query('SELECT u.* FROM usuarios u JOIN colaboradores c ON c.id=u.colaborador_id WHERE u.email=$1 AND u.activo=1 AND c.activo=1',[email.toLowerCase()]);
    const u=r.rows[0];if(!u||!await bcrypt.compare(password,u.password_hash))return res.status(401).json({error:'Credenciales incorrectas'});
    attempts.delete(key);const token=randomBytes(32).toString('hex');
    if(/^[a-f0-9]{64}$/.test(req.cookies.session||''))await db.query('DELETE FROM sesiones WHERE token_hash=$1',[hash(req.cookies.session)]);
    await db.query('INSERT INTO sesiones VALUES($1,$2,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[hash(token),u.id]);
    res.cookie('session',token,{...opts,maxAge:8*3600000});res.json({email:u.email,rol:u.rol});
  });
  app.get('/api/me',auth,(req,res)=>res.json({email:req.user.email,rol:req.user.rol}));
  app.get('/api/me/calcular-vacaciones',auth,async(req,res)=>{const inicio=dateSchema.parse(req.query.inicio),fin=dateSchema.parse(req.query.fin);if(fin<inicio||(Date.parse(fin)-Date.parse(inicio))/86400000>366)return res.status(400).json({error:'Rango inválido; máximo un año'});res.json({inicio,fin,dias_habiles:await businessDays(db,inicio,fin),horario:'lunes a viernes',fuente:'SQL feriados'});});
  app.post('/api/logout',auth,async(req,res)=>{await db.query('DELETE FROM sesiones WHERE token_hash=$1',[hash(req.cookies.session)]);res.clearCookie('session',opts);res.json({ok:true});});
  workflowRoutes(app,db,auth,hr);
  app.get('/api/me/evaluaciones',auth,async(req,res)=>{res.json((await db.query('SELECT fecha_programada,estado FROM evaluaciones_desempeno WHERE colaborador_id=$1 ORDER BY fecha_programada',[req.user.colaborador_id])).rows);});
  app.get('/api/me/proximo-pago',auth,async(req,res)=>{const r=await db.query('SELECT p.fecha,p.fecha_nominal,p.tipo,p.descripcion FROM calendario_pagos p JOIN colaboradores c ON c.grupo_planilla=p.grupo_planilla WHERE c.id=$1 AND p.fecha>=$2 ORDER BY p.fecha,p.id LIMIT 1',[req.user.colaborador_id,localDate()]);res.json(r.rows[0]??null);});
  app.post('/api/chat',auth,async(req,res)=>{
    const {question,conversacion_id}=z.object({question:z.string().trim().min(1).max(2000),conversacion_id:z.number().int().positive().optional()}).parse(req.body);
    if(busy.has(req.user.id))return res.status(429).json({error:'Esperá a que termine tu consulta anterior.'});
    busy.add(req.user.id);
    try {
      let conversation=conversacion_id;
      if(conversation){if(!(await db.query('SELECT id FROM conversaciones WHERE id=$1 AND usuario_id=$2',[conversation,req.user.id])).rows.length)return res.status(404).json({error:'Conversación no encontrada'});}
      else conversation=(await db.query('INSERT INTO conversaciones(usuario_id,titulo,creada_en) VALUES($1,$2,UTC_TIMESTAMP())',[req.user.id,question.slice(0,120)])).insertId;
      const response=await answerImpl(db,req.user,question);
      await db.query('UPDATE consultas_chat SET conversacion_id=$1 WHERE id=$2 AND usuario_id=$3',[conversation,response.consulta_id,req.user.id]);
      res.json({...response,conversacion_id:conversation});
    }finally{busy.delete(req.user.id);}
  });
  app.get('/api/conversaciones',auth,async(req,res)=>{res.json((await db.query('SELECT id,titulo,creada_en FROM conversaciones WHERE usuario_id=$1 ORDER BY id DESC LIMIT 50',[req.user.id])).rows);});
  app.get('/api/conversaciones/:id/mensajes',auth,async(req,res)=>{
    const id=z.coerce.number().int().positive().parse(req.params.id);
    if(!(await db.query('SELECT id FROM conversaciones WHERE id=$1 AND usuario_id=$2',[id,req.user.id])).rows.length)return res.status(404).json({error:'Conversación no encontrada'});
    const rows=(await db.query('SELECT id,pregunta,respuesta,citas,estado,creado FROM consultas_chat WHERE conversacion_id=$1 AND usuario_id=$2 ORDER BY id',[id,req.user.id])).rows;
    const approved=new Set((await db.query('SELECT id FROM documentos WHERE aprobado=1')).rows.map(r=>r.id));
    res.json(rows.map(r=>{const citations=parseJson(r.citas,[]),revoked=citations.some(c=>!approved.has(c.documento_id));return {...r,respuesta:revoked?'Esta respuesta usa una fuente retirada. Realizá una nueva consulta para verificar la política vigente.':r.respuesta,citas:citations.filter(c=>approved.has(c.documento_id))};}));
  });
  app.get('/api/rrhh/dashboard',auth,hr,async(req,res)=>res.json(await dashboard(db)));
  app.get('/api/rrhh/reportes',auth,hr,async(req,res)=>{const rows=(await db.query('SELECT * FROM reportes_diarios ORDER BY fecha DESC LIMIT 30')).rows;res.json(rows.map(r=>({...r,datos:parseJson(r.datos)})));});
  app.post('/api/rrhh/reportes/generar',auth,hr,async(req,res)=>{const {fecha}=z.object({fecha:dateSchema.optional()}).parse(req.body||{});if(fecha&&fecha>localDate())return res.status(400).json({error:'No se generan reportes futuros'});res.json(await generateDailyReport(db,{date:fecha||localDate(),trigger:'manual:'+req.user.id}));});
  app.get('/api/rrhh/reportes/:fecha',auth,hr,async(req,res)=>{const fecha=dateSchema.parse(req.params.fecha),r=(await db.query('SELECT * FROM reportes_diarios WHERE fecha=$1',[fecha])).rows[0];if(!r)return res.status(404).json({error:'Reporte no encontrado'});res.json({...r,datos:parseJson(r.datos)});});
  app.post('/api/rrhh/reportes/:fecha/resumen',auth,hr,async(req,res)=>{const fecha=dateSchema.parse(req.params.fecha),exists=(await db.query('SELECT fecha FROM reportes_diarios WHERE fecha=$1',[fecha])).rows.length;if(!exists)return res.status(404).json({error:'Reporte no encontrado'});res.json(await regenerateReportSummary(db,fecha,{trigger:'manual:'+req.user.id}));});
  app.post('/api/rrhh/drive/sincronizar',auth,hr,async(req,res)=>res.json(await syncImpl(db,{trigger:'manual:'+req.user.id})));
  app.get('/api/rrhh/drive/estado',auth,hr,async(req,res)=>{res.json((await db.query('SELECT carpeta_id,ultimo_exito,ultimo_intento,resultado FROM drive_estado')).rows.map(r=>({...r,resultado:parseJson(r.resultado)})));});
  app.use((err,req,res,next)=>{if(err instanceof z.ZodError)return res.status(400).json({error:'Datos inválidos'});if(err.publicMessage)return res.status(err.status).json({error:err.publicMessage});console.error('API:',err.original?.code||err.code||err.name);res.status(500).json({error:'No se pudo completar la solicitud. Intentá nuevamente.'});});
  return app;
}
