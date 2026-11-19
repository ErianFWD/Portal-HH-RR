import React,{useState,useRef,useEffect} from 'react';
import {api,day,localTime} from '../api.js';
export function useAction(){
  const [busy,B]=useState(false),[error,E]=useState(''),[success,S]=useState(''),lock=useRef(false);
  async function run(work,message=''){if(lock.current)return;lock.current=true;B(true);E('');S('');try{await work();S(message);}catch(e){E(e.message);}finally{lock.current=false;B(false);}}
  return {busy,error,success,run};
}
export function Feedback({action}){return <>{action.busy&&<p role="status">Procesando…</p>}{action.error&&<p role="alert" className="error">{action.error}</p>}{action.success&&<p role="status" className="success">{action.success}</p>}</>;}
export function Balance({value}){return value?<div className="metrics">{[['Saldo confirmado',value.confirmado],['Reservado en pendientes',value.reservados],['Disponible para solicitar',value.disponibles]].map(([label,n])=><div className="metric" key={label}><span>{label}</span><strong>{n} días</strong></div>)}</div>:<p>No hay saldo registrado. Contactá a RRHH.</p>;}
export function RequestDetail({row}){return <><p>{row.tipo} · {day(row.fecha_inicio)} al {day(row.fecha_fin)} · {row.dias_solicitados??'Sin cálculo histórico'} días · <b>{row.estado}</b></p><p>Mensaje: {row.mensaje||'Sin mensaje'}</p><p>Respuesta de RRHH: {row.respuesta_rrhh||'Sin respuesta'}</p><small>Creada: {localTime(row.creada_en)} · Resolución: {localTime(row.resuelta_en)}</small></>;}
export function Filters({onApply,type,people}){
  const [values,V]=useState({colaborador_id:'',departamento:'',estado:'',inicio:'',fin:''});
  const set=(k,v)=>V(x=>({...x,[k]:v}));
  return <form className="filters" onSubmit={e=>{e.preventDefault();onApply(new URLSearchParams(Object.entries(values).filter(([,v])=>v)).toString());}}>
    <label>Colaborador<select value={values.colaborador_id} onChange={e=>set('colaborador_id',e.target.value)}><option value="">Todos</option>{people.map(p=><option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
    <label>Departamento<select value={values.departamento} onChange={e=>set('departamento',e.target.value)}><option value="">Todos</option>{[...new Set(people.map(p=>p.departamento))].map(d=><option key={d}>{d}</option>)}</select></label>
    <label>Estado<select value={values.estado} onChange={e=>set('estado',e.target.value)}><option value="">Todos</option>{(type==='requests'?['pendiente','aprobada','rechazada','cancelada']:['abierta','cerrada','incidencias']).map(s=><option key={s}>{s}</option>)}</select></label>
    <label>Desde<input type="date" value={values.inicio} onChange={e=>set('inicio',e.target.value)}/></label><label>Hasta<input type="date" value={values.fin} onChange={e=>set('fin',e.target.value)}/></label><button>Filtrar</button>
  </form>;
}
export function usePeople(){const [people,P]=useState([]),[error,E]=useState('');useEffect(()=>{api('rrhh/colaboradores').then(P).catch(e=>E(e.message));},[]);return {people,error};}
