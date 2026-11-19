import {z} from 'zod';
export const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>Number.isFinite(Date.parse(s))&&new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s);
export const id=z.coerce.number().int().positive();
export const text=z.string().trim().max(2000);
export function fail(message,status=409){throw Object.assign(Error(message),{status,publicMessage:message});}
export async function transaction(db,person,work){
  const c=await db.connect();
  try {await c.query('BEGIN');const row=(await c.query('SELECT id FROM colaboradores WHERE id=$1 AND activo=1 FOR UPDATE',[person])).rows[0];if(!row)fail('Colaborador no encontrado',404);const value=await work(c);await c.query('COMMIT');return value;}
  catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function coverage(db,start,end){
  const years=new Set((await db.query('SELECT anio FROM calendarios_cobertura WHERE anio BETWEEN $1 AND $2',[Number(start.slice(0,4)),Number(end.slice(0,4))])).rows.map(x=>Number(x.anio)));
  for(let y=Number(start.slice(0,4));y<=Number(end.slice(0,4));y++)if(!years.has(y))fail(`RRHH debe confirmar la cobertura del calendario de feriados ${y}`,422);
}
export const utc=value=>value instanceof Date?value:new Date(String(value).replace(' ','T').replace(/Z$/,'')+'Z');
