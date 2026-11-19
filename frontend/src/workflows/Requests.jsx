import React,{useState,useEffect} from 'react';
import {api,localDay,day} from '../api.js';
import {useAction,Feedback,Balance,RequestDetail,Filters,usePeople} from './Shared.jsx';

export function MyRequests(){
  const [balance,B]=useState(null),[rows,R]=useState([]),[form,F]=useState({inicio:'',fin:'',mensaje:''}),[preview,P]=useState(null),[loaded,L]=useState(false),action=useAction();
  async function load(){const [b,r]=await Promise.all([api('me/vacaciones'),api('me/solicitudes')]);B(b);R(r);L(true);}
  useEffect(()=>{action.run(load);},[]);
  function change(key,value){F(f=>({...f,[key]:value}));P(null);}
  return <section className="card"><h2>Mis solicitudes</h2><Balance value={balance}/><form onSubmit={e=>{e.preventDefault();action.run(async()=>P(await api('me/calcular-solicitud?'+new URLSearchParams({inicio:form.inicio,fin:form.fin}))));}}>
    <div className="form-grid"><label>Fecha inicial<input type="date" disabled={action.busy} required min={localDay()} value={form.inicio} onChange={e=>change('inicio',e.target.value)}/></label><label>Fecha final<input type="date" disabled={action.busy} required min={form.inicio||localDay()} value={form.fin} onChange={e=>change('fin',e.target.value)}/></label></div>
    <label>Mensaje para RRHH (opcional)<textarea maxLength={2000} value={form.mensaje} onChange={e=>F(f=>({...f,mensaje:e.target.value}))}/></label><button className="secondary" disabled={action.busy}>Calcular días hábiles</button>
    {preview&&<div className="confirmation"><p>Solicitarás <b>{preview.dias} días hábiles</b>, del {preview.inicio} al {preview.fin}. Lunes a viernes, excluyendo feriados.</p><button type="button" disabled={action.busy||!balance} onClick={()=>action.run(async()=>{await api('me/solicitudes',form);F({inicio:'',fin:'',mensaje:''});P(null);await load();},'Solicitud enviada a RRHH.')}>Confirmar y enviar solicitud</button></div>}
  </form><Feedback action={action}/><h3>Historial</h3>{loaded&&!rows.length&&<p>Sin solicitudes para mostrar.</p>}{rows.map(row=><article className="report" key={row.id}><RequestDetail row={row}/>{row.estado==='pendiente'&&<button className="secondary" disabled={action.busy} onClick={()=>action.run(async()=>{await api(`me/solicitudes/${row.id}/cancelar`,{});await load();},'Solicitud cancelada; reserva liberada.')}>Cancelar solicitud</button>}</article>)}</section>;
}
export function ManageRequests(){
  const [rows,R]=useState([]),[selected,S]=useState(null),[response,V]=useState(''),[query,Q]=useState(''),[loaded,L]=useState(false),action=useAction(),{people,error}=usePeople();
  async function load(q=query){R(await api('rrhh/solicitudes?'+q));L(true);}
  useEffect(()=>{action.run(()=>load());},[]);
  async function decide(estado){await api(`rrhh/solicitudes/${selected.id}/resolver`,{estado,respuesta:response});S(await api('rrhh/solicitudes/'+selected.id));await load();}
  return <section className="card"><h2>Gestionar solicitudes</h2><Filters type="requests" people={people} onApply={q=>{Q(q);action.run(()=>load(q));}}/>{error&&<p role="alert">{error}</p>}<Feedback action={action}/>{loaded&&!rows.length&&<p>Sin solicitudes para estos filtros.</p>}<div className="table-wrap"><table><thead><tr><th>Colaborador</th><th>Fechas</th><th>Días</th><th>Estado</th><th>Creación</th><th>Detalle</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.nombre}<small>{r.departamento}</small></td><td>{day(r.fecha_inicio)} al {day(r.fecha_fin)}</td><td>{r.dias_solicitados??'Histórico'}</td><td>{r.estado}</td><td>{day(r.creada_en)}</td><td><button disabled={action.busy} onClick={()=>action.run(async()=>{S(await api('rrhh/solicitudes/'+r.id));V('');})}>Revisar</button></td></tr>)}</tbody></table></div>
    {selected&&<section className="confirmation"><h3>{selected.nombre} · Solicitud #{selected.id}</h3><RequestDetail row={selected}/><Balance value={selected.saldo}/>{selected.estado==='pendiente'&&<><label>Respuesta al colaborador (obligatoria para rechazar)<textarea maxLength={2000} value={response} onChange={e=>V(e.target.value)}/></label><div className="actions"><button disabled={action.busy} onClick={()=>action.run(()=>decide('aprobada'),'Solicitud aprobada.')}>Aprobar</button><button className="secondary" disabled={action.busy||!response.trim()} onClick={()=>action.run(()=>decide('rechazada'),'Solicitud rechazada; reserva liberada.')}>Rechazar</button></div></>}<details><summary>Auditoría de decisiones</summary>{selected.auditoria.map(a=><p key={a.id}>{a.estado_nuevo} · {a.email} · {a.mensaje}</p>)}</details></section>}
  </section>;
}
